import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Global in-memory cache of file existences and directory status to prevent disk I/O overhead on keypresses
const fileStatsCache = new Map<string, { exists: boolean; isFolder: boolean }>();

// Helper to check and cache file status
function getCachedFileStats(resolvedPath: string): { exists: boolean; isFolder: boolean } {
	let cached = fileStatsCache.get(resolvedPath);
	if (!cached) {
		let exists = false;
		let isFolder = false;
		try {
			exists = fs.existsSync(resolvedPath);
			if (exists) {
				isFolder = fs.statSync(resolvedPath).isDirectory();
			}
		} catch (err) {
			// Ignore errors
		}
		cached = { exists, isFolder };
		fileStatsCache.set(resolvedPath, cached);
	}
	return cached;
}

// Check if a path matches the excluded patterns from setting
function isPathExcluded(filePath: string, workspaceRoot: string): boolean {
	const config = vscode.workspace.getConfiguration("idx");
	const excludes = config.get<string[]>("excludePatterns", []);
	const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

	for (const pattern of excludes) {
		const cleanPattern = pattern.replace(/^\*\*?\//, '').replace(/\/\*\*?$/, '');
		if (relPath.split('/').includes(cleanPattern) || relPath.startsWith(cleanPattern)) {
			return true;
		}
	}
	return false;
}

function getExcludeGlob(): string {
	const config = vscode.workspace.getConfiguration("idx");
	const excludes = config.get<string[]>("excludePatterns", []);
	if (excludes.length === 0) return "**/node_modules/**";
	if (excludes.length === 1) return excludes[0];
	return `{${excludes.join(',')}}`;
}

// Representation of a fileline parsed from idx.md
interface FileLine {
	lineIndex: number;
	lineText: string;
	indentation: number;
	heading: string;         // closest parent heading name
	filepath: string;        // visual token extracted, e.g., 'src/extension.ts'
	resolvedPath: string;    // absolute file system path
	exists: boolean;
	isFolder: boolean;
	prefix: string;          // prefix before the path, excluding checkbox
	suffix: string;          // suffix after the path
	checkbox?: {
		checked: boolean;
		range: vscode.Range;
	};
}

// Utility to count indentation spaces (treating tabs as 4 spaces)
function getIndentation(line: string): number {
	const match = line.match(/^([ \t]*)/);
	if (!match) return 0;
	let indent = 0;
	for (const char of match[1]) {
		if (char === '\t') {
			indent += 4;
		} else {
			indent += 1;
		}
	}
	return indent;
}

// Robust recursive file explorer parser
function parseIdxMarkdown(documentText: string, workspaceRoot: string, openFilePaths: Set<string>): FileLine[] {
	const lines = documentText.split(/\r?\n/);
	const fileLines: FileLine[] = [];
	const folderStack: { indentation: number; resolvedPath: string }[] = [];
	let currentHeading = "Index Folder";

	for (let i = 0; i < lines.length; i++) {
		const lineText = lines[i];
		const trimmed = lineText.trim();
		if (!trimmed) continue;

		// Check if it is a heading to update our current heading context
		if (trimmed.startsWith('#')) {
			currentHeading = trimmed.replace(/^#+\s+/, '');
			// Clear folder stack because a heading resets the directory prefix
			folderStack.length = 0;
			continue;
		}

		const indentation = getIndentation(lineText);

		// Regular expression to strip list bullets & checkboxes
		// Group 1: bullet list markers (e.g. "- ", "* ", "+ ", "1. ")
		// Group 2: checkbox character [x] or [ ]
		// Group 3: the rest of the text
		const lineRegex = /^([-*+]\s+|\d+\.\s+)?(?:\[([ xX])\]\s*)?(.*)$/;
		const match = trimmed.match(lineRegex);
		if (!match) continue;

		const bullet = match[1] || "";
		const checkboxChar = match[2];
		const rest = match[3] || "";

		if (!rest.trim()) continue;

		// Find the candidate filepath token
		const words = rest.split(/\s+/);
		let filepathIndex = -1;
		let candidateFilepath = "";
		let cleanedFilepath = "";

		for (let w = 0; w < words.length; w++) {
			const word = words[w];
			// Strip trailing and leading punctuation (colons, commas, parenthesis, brackets, quotes)
			const cleaned = word.replace(/^[:;,"'({\[\]})'"]+|[:;,"'({\[\]})'"]+$/g, '');
			if (!cleaned) continue;

			let existsTemp = false;
			let isExplicitPath = cleaned.includes('/') || cleaned.includes('\\') || cleaned.includes('.');

			let resolvedTemp = "";
			const candidates = [cleaned];

			// Suggest common extensions if none present
			if (!cleaned.includes('.')) {
				const commonExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md'];
				for (const ext of commonExtensions) {
					candidates.push(cleaned + ext);
				}
			}

			for (const cand of candidates) {
				if (path.isAbsolute(cand)) {
					resolvedTemp = cand;
					existsTemp = getCachedFileStats(resolvedTemp).exists;
				} else {
					let parentPath = workspaceRoot;
					const parentFolder = folderStack.findLast(f => f.indentation < indentation);
					if (parentFolder) {
						parentPath = parentFolder.resolvedPath;
					}
					resolvedTemp = path.resolve(parentPath, cand);
					existsTemp = getCachedFileStats(resolvedTemp).exists;

					if (!existsTemp) {
						// Fallback to workspace root
						const workspaceTemp = path.resolve(workspaceRoot, cand);
						if (getCachedFileStats(workspaceTemp).exists) {
							resolvedTemp = workspaceTemp;
							existsTemp = true;
						}
					}
				}
				if (existsTemp) {
					cleanedFilepath = cand; // matched path candidate
					break;
				}
			}

			if (existsTemp || isExplicitPath) {
				filepathIndex = w;
				candidateFilepath = word;
				if (!cleanedFilepath) {
					cleanedFilepath = cleaned;
				}
				break;
			}
		}

		// Fallback if no matching word is found but first is a potential path
		if (filepathIndex === -1 && words.length > 0) {
			const firstWord = words[0];
			const cleaned = firstWord.replace(/^[:;,"'({\[\]})'"]+|[:;,"'({\[\]})'"]+$/g, '');
			if (cleaned && (cleaned.includes('.') || cleaned.includes('/') || cleaned.includes('\\') || /^[a-zA-Z0-9_\-]+$/.test(cleaned))) {
				filepathIndex = 0;
				candidateFilepath = firstWord;
				cleanedFilepath = cleaned;
			}
		}

		if (filepathIndex === -1) {
			continue;
		}

		const filepathStartIndex = lineText.indexOf(candidateFilepath);
		if (filepathStartIndex === -1) continue;

		const fullPrefix = lineText.substring(0, filepathStartIndex);
		const suffix = lineText.substring(filepathStartIndex + candidateFilepath.length);

		let prefix = fullPrefix;
		let checkboxInfo: FileLine['checkbox'] = undefined;

		if (checkboxChar !== undefined) {
			const checkboxStr = `[${checkboxChar}]`;
			const checkboxIdx = fullPrefix.indexOf(checkboxStr);
			if (checkboxIdx !== -1) {
				prefix = fullPrefix.substring(0, checkboxIdx) + fullPrefix.substring(checkboxIdx + checkboxStr.length);
				const checkboxRange = new vscode.Range(
					new vscode.Position(i, checkboxIdx),
					new vscode.Position(i, checkboxIdx + checkboxStr.length)
				);
				checkboxInfo = {
					checked: checkboxChar.toLowerCase() === 'x',
					range: checkboxRange
				};
			}
		}

		// Determine absolute path on disk
		let resolvedPath = "";
		let exists = false;

		const resolvedCandidates = [cleanedFilepath];
		if (!cleanedFilepath.includes('.')) {
			const commonExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md'];
			for (const ext of commonExtensions) {
				resolvedCandidates.push(cleanedFilepath + ext);
			}
		}

		for (const cand of resolvedCandidates) {
			if (path.isAbsolute(cand)) {
				resolvedPath = cand;
				exists = getCachedFileStats(resolvedPath).exists;
			} else {
				let parentPath = workspaceRoot;
				const parentFolder = folderStack.findLast(f => f.indentation < indentation);
				if (parentFolder) {
					parentPath = parentFolder.resolvedPath;
				}
				resolvedPath = path.resolve(parentPath, cand);
				exists = getCachedFileStats(resolvedPath).exists;

				if (!exists) {
					const workspaceTemp = path.resolve(workspaceRoot, cand);
					if (getCachedFileStats(workspaceTemp).exists) {
						resolvedPath = workspaceTemp;
						exists = true;
					}
				}
			}
			if (exists) {
				break;
			}
		}

		if (!exists) {
			if (path.isAbsolute(cleanedFilepath)) {
				resolvedPath = cleanedFilepath;
			} else {
				let parentPath = workspaceRoot;
				const parentFolder = folderStack.findLast(f => f.indentation < indentation);
				if (parentFolder) {
					parentPath = parentFolder.resolvedPath;
				}
				resolvedPath = path.resolve(parentPath, cleanedFilepath);
			}
		}

		// Folder identification
		let isFolder = false;
		if (exists) {
			isFolder = getCachedFileStats(resolvedPath).isFolder;
		} else {
			isFolder = !cleanedFilepath.includes('.') || cleanedFilepath.endsWith('/') || cleanedFilepath.endsWith('\\');
		}

		// Maintain file folder hierarchy in stack
		while (folderStack.length > 0 && folderStack[folderStack.length - 1].indentation >= indentation) {
			folderStack.pop();
		}
		if (isFolder) {
			folderStack.push({ indentation, resolvedPath });
		}

		fileLines.push({
			lineIndex: i,
			lineText,
			indentation,
			heading: currentHeading,
			filepath: cleanedFilepath,
			resolvedPath,
			exists,
			isFolder,
			prefix,
			suffix,
			checkbox: checkboxInfo
		});
	}

	return fileLines;
}

// Gutter decoration manager
class GutterDecorationManager {
	private blueDecorationType: vscode.TextEditorDecorationType;
	private whiteDecorationType: vscode.TextEditorDecorationType;
	private greenDecorationType: vscode.TextEditorDecorationType;
	private updateTimeout: NodeJS.Timeout | undefined;

	constructor() {
		// Elegant SVG blue circle for missing files
		const blueSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="#3b82f6" /></svg>`
		).toString('base64');

		// Subtle outline grey circle for existing closed files
		const whiteSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill="none" stroke="#94a3b8" stroke-width="2" /></svg>`
		).toString('base64');

		// Vibrant green circle for open active elements
		const greenSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="#22c55e" /></svg>`
		).toString('base64');

		this.blueDecorationType = vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.parse(`data:image/svg+xml;base64,${blueSvg}`),
			gutterIconSize: 'contain'
		});

		this.whiteDecorationType = vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.parse(`data:image/svg+xml;base64,${whiteSvg}`),
			gutterIconSize: 'contain'
		});

		this.greenDecorationType = vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.parse(`data:image/svg+xml;base64,${greenSvg}`),
			gutterIconSize: 'contain'
		});
	}

	public triggerUpdate(editor: vscode.TextEditor, workspaceRoot: string) {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
		}
		this.updateTimeout = setTimeout(() => this.update(editor, workspaceRoot), 300);
	}

	private async update(editor: vscode.TextEditor, workspaceRoot: string) {
		const document = editor.document;
		const config = vscode.workspace.getConfiguration("idx");
		const idxFilename = config.get<string>("indexFilename", "idx.md");

		if (path.basename(document.uri.fsPath) !== idxFilename) {
			editor.setDecorations(this.blueDecorationType, []);
			editor.setDecorations(this.whiteDecorationType, []);
			editor.setDecorations(this.greenDecorationType, []);
			return;
		}

		// Retrieve both tabs and loaded docs to track active files
		const openFilePaths = new Set<string>();
		try {
			for (const group of vscode.window.tabGroups.all) {
				for (const tab of group.tabs) {
					if (tab.input instanceof vscode.TabInputText) {
						openFilePaths.add(tab.input.uri.fsPath);
					}
				}
			}
		} catch (e) { }
		for (const doc of vscode.workspace.textDocuments) {
			openFilePaths.add(doc.uri.fsPath);
		}

		const fileLines = parseIdxMarkdown(document.getText(), workspaceRoot, openFilePaths);

		const blueRanges: vscode.Range[] = [];
		const whiteRanges: vscode.Range[] = [];
		const greenRanges: vscode.Range[] = [];

		for (const fl of fileLines) {
			const range = new vscode.Range(fl.lineIndex, 0, fl.lineIndex, 0);
			if (!fl.exists) {
				blueRanges.push(range);
			} else if (openFilePaths.has(fl.resolvedPath)) {
				greenRanges.push(range);
			} else {
				whiteRanges.push(range);
			}
		}

		editor.setDecorations(this.blueDecorationType, blueRanges);
		editor.setDecorations(this.whiteDecorationType, whiteRanges);
		editor.setDecorations(this.greenDecorationType, greenRanges);
	}

	public dispose() {
		this.blueDecorationType.dispose();
		this.whiteDecorationType.dispose();
		this.greenDecorationType.dispose();
	}
}

function updateAllVisibleDecorations(manager: GutterDecorationManager) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	for (const editor of vscode.window.visibleTextEditors) {
		manager.triggerUpdate(editor, workspaceRoot);
	}
}

// Building nice picklist items with checkboxes details and frequencies
function buildPickerItem(fPath: string, isOpen: boolean, fileLines: FileLine[], workspaceRoot: string): vscode.QuickPickItem & { resolvedPath: string } {
	const filename = path.basename(fPath);
	const relPath = path.relative(workspaceRoot, fPath).replace(/\\/g, '/');
	const emoji = isOpen ? "🟢" : "⚪";

	const occurrences = fileLines.filter(fl => fl.resolvedPath === fPath);
	const count = occurrences.length;

	const checkboxOccurrences = occurrences.filter(fl => fl.checkbox !== undefined);
	let checkboxDetail = "";
	if (checkboxOccurrences.length > 0) {
		const checkedCount = checkboxOccurrences.filter(fl => fl.checkbox?.checked).length;
		const totalCount = checkboxOccurrences.length;
		checkboxDetail = ` ☑ ${checkedCount}/${totalCount}`;
	}

	const detail = `📖 ${count}${checkboxDetail}`;

	return {
		label: `${emoji} ${filename}`,
		description: relPath,
		detail,
		resolvedPath: fPath
	};
}

// Offering a select list for items inside a directory
async function showFolderPicklist(folderPath: string, idxDocument: vscode.TextDocument, workspaceRoot: string) {
	let filesInFolder: string[] = [];
	try {
		const entries = fs.readdirSync(folderPath);
		for (const entry of entries) {
			const entryPath = path.join(folderPath, entry);
			const stat = fs.statSync(entryPath);
			if (stat.isFile()) {
				filesInFolder.push(entryPath);
			}
		}
	} catch (err) {
		vscode.window.showErrorMessage(`Could not read folder content: ${folderPath}`);
		return;
	}

	const openFilePaths = new Set<string>();
	try {
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputText) {
					openFilePaths.add(tab.input.uri.fsPath);
				}
			}
		}
	} catch (e) { }
	for (const doc of vscode.workspace.textDocuments) {
		openFilePaths.add(doc.uri.fsPath);
	}

	const fileLines = parseIdxMarkdown(idxDocument.getText(), workspaceRoot, openFilePaths);

	const openList: string[] = [];
	const closedList: string[] = [];

	for (const filePath of filesInFolder) {
		if (openFilePaths.has(filePath)) {
			openList.push(filePath);
		} else {
			closedList.push(filePath);
		}
	}

	const qpItems: (vscode.QuickPickItem & { action?: () => void; resolvedPath?: string })[] = [];

	// Command item
	qpItems.push({
		label: "📁 Select folder in file explorer",
		description: path.relative(workspaceRoot, folderPath).replace(/\\/g, '/'),
		action: () => {
			vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(folderPath));
		}
	});

	if (openList.length > 0) {
		qpItems.push({
			kind: vscode.QuickPickItemKind.Separator,
			label: "Open Files"
		});
		for (const filePath of openList) {
			qpItems.push({
				...buildPickerItem(filePath, true, fileLines, workspaceRoot),
				action: async () => {
					const doc = await vscode.workspace.openTextDocument(filePath);
					await vscode.window.showTextDocument(doc);
				}
			});
		}
	}

	if (closedList.length > 0) {
		qpItems.push({
			kind: vscode.QuickPickItemKind.Separator,
			label: "Closed Files"
		});
		for (const filePath of closedList) {
			qpItems.push({
				...buildPickerItem(filePath, false, fileLines, workspaceRoot),
				action: async () => {
					const doc = await vscode.workspace.openTextDocument(filePath);
					await vscode.window.showTextDocument(doc);
				}
			});
		}
	}

	const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { action?: () => void; resolvedPath?: string }>();
	quickPick.title = `Contents of ${path.basename(folderPath)}`;
	quickPick.items = qpItems;

	quickPick.onDidChangeActive(async (activeItems) => {
		if (activeItems.length > 0 && activeItems[0].resolvedPath) {
			const targetPath = activeItems[0].resolvedPath;
			if (openFilePaths.has(targetPath)) {
				try {
					const doc = await vscode.workspace.openTextDocument(targetPath);
					await vscode.window.showTextDocument(doc, { preserveFocus: true, preview: true });
				} catch (e) { }
			}
		}
	});

	quickPick.onDidAccept(() => {
		const selected = quickPick.selectedItems[0];
		if (selected) {
			if (selected.action) {
				selected.action();
			}
		}
		quickPick.hide();
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

// Shared jump and picker line scrolling implementation
async function showIdxLinePicker(idxDocument: vscode.TextDocument) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const openFilePaths = new Set<string>();
	const fileLines = parseIdxMarkdown(idxDocument.getText(), workspaceRoot, openFilePaths);

	const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { lineIndex?: number }>();
	quickPick.title = "Jump Within Index";
	quickPick.placeholder = "Select a fileline to preview & scroll";

	const qpItems: (vscode.QuickPickItem & { lineIndex?: number })[] = [];
	let lastHeading = "";

	for (const fl of fileLines) {
		if (fl.heading !== lastHeading) {
			qpItems.push({
				kind: vscode.QuickPickItemKind.Separator,
				label: fl.heading
			});
			lastHeading = fl.heading;
		}

		const checkboxIcon = fl.checkbox ? (fl.checkbox.checked ? "☑ " : "☐ ") : "";
		const filename = path.basename(fl.filepath);
		const label = `${checkboxIcon}${filename}`;
		const description = `line: ${fl.lineIndex + 1}`;
		const detail = `${fl.prefix}${fl.suffix}`.trim();

		qpItems.push({
			label,
			description,
			detail,
			lineIndex: fl.lineIndex
		});
	}

	quickPick.items = qpItems;

	const idxEditor = await vscode.window.showTextDocument(idxDocument);

	quickPick.onDidChangeActive(async (activeItems) => {
		if (activeItems.length > 0 && activeItems[0].lineIndex !== undefined) {
			const lineIndex = activeItems[0].lineIndex;
			const revealRange = new vscode.Range(lineIndex, 0, lineIndex, 0);
			idxEditor.revealRange(revealRange, vscode.TextEditorRevealType.InCenter);
		}
	});

	quickPick.onDidAccept(() => {
		const selected = quickPick.selectedItems[0];
		if (selected && selected.lineIndex !== undefined) {
			const line = selected.lineIndex;
			const pos = new vscode.Position(line, 0);
			idxEditor.selection = new vscode.Selection(pos, pos);
			idxEditor.revealRange(idxEditor.selection, vscode.TextEditorRevealType.InCenter);
			// Ensure focus updates
			vscode.window.showTextDocument(idxDocument);
		}
		quickPick.hide();
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

// Retrieve index Uri resolver helper
async function getIndexUri(): Promise<vscode.Uri | undefined> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		vscode.window.showErrorMessage("No workspace open.");
		return undefined;
	}
	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const config = vscode.workspace.getConfiguration("idx");
	const idxFilename = config.get<string>("indexFilename", "idx.md");
	return vscode.Uri.file(path.join(workspaceRoot, idxFilename));
}

// ----------------------------------------------------
// Core Command Execution Handlers
// ----------------------------------------------------

async function openIdxCommand() {
	const idxUri = await getIndexUri();
	if (!idxUri) return;

	if (!fs.existsSync(idxUri.fsPath)) {
		const choice = await vscode.window.showInformationMessage(
			`Index file '${path.basename(idxUri.fsPath)}' does not exist. Create it?`,
			"Yes",
			"No"
		);
		if (choice === "Yes") {
			const template = `# Workspace Index\n\n## Project Files\n- [ ] package.json\n- [ ] src/extension.ts\n`;
			fs.writeFileSync(idxUri.fsPath, template, 'utf8');
		} else {
			return;
		}
	}

	const doc = await vscode.workspace.openTextDocument(idxUri);
	await vscode.window.showTextDocument(doc);
}

async function updateIdxCommand(document: vscode.TextDocument) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const allFiles = await vscode.workspace.findFiles("**/*", getExcludeGlob());
	const allExistingPaths = new Set(allFiles.map(f => f.fsPath));

	const text = document.getText();
	const lines = text.split(/\r?\n/);

	let mainLines: string[] = [];
	let missingSectionLines: string[] = [];
	let newSectionLines: string[] = [];
	let currentSection: 'main' | 'missing' | 'new' = 'main';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (trimmed.startsWith('## ') && trimmed.toLowerCase().includes('missing files')) {
			currentSection = 'missing';
			continue;
		} else if (trimmed.startsWith('## ') && trimmed.toLowerCase().includes('new files')) {
			currentSection = 'new';
			continue;
		} else if (trimmed.startsWith('#') && currentSection !== 'main') {
			currentSection = 'main';
		}

		if (currentSection === 'main') {
			mainLines.push(line);
		} else if (currentSection === 'missing') {
			missingSectionLines.push(line);
		} else if (currentSection === 'new') {
			newSectionLines.push(line);
		}
	}

	const mainText = mainLines.join('\n');
	const openFilePaths = new Set<string>();
	const fileLines = parseIdxMarkdown(mainText, workspaceRoot, openFilePaths);

	const missingFileLines: FileLine[] = [];
	const validFileLines: FileLine[] = [];
	const mainLineIsMissingMap = new Set<number>();

	for (const fl of fileLines) {
		if (!fl.exists) {
			missingFileLines.push(fl);
			mainLineIsMissingMap.add(fl.lineIndex);
		} else {
			validFileLines.push(fl);
		}
	}

	const filteredMainLines = mainLines.filter((_, idx) => !mainLineIsMissingMap.has(idx));
	const listedPaths = new Set(validFileLines.map(fl => fl.resolvedPath));
	const newFiles: string[] = [];

	for (const filePath of allExistingPaths) {
		if (filePath === document.uri.fsPath) continue;
		if (isPathExcluded(filePath, workspaceRoot)) continue;

		if (!listedPaths.has(filePath)) {
			const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
			newFiles.push(relPath);
		}
	}

	const finalMissingLines: string[] = [];
	const prevHeadingText = missingSectionLines.join('\n');
	const prevMissingFileLines = parseIdxMarkdown(prevHeadingText, workspaceRoot, openFilePaths);
	for (const fl of prevMissingFileLines) {
		if (!getCachedFileStats(fl.resolvedPath).exists) {
			finalMissingLines.push(fl.lineText);
		}
	}
	for (const fl of missingFileLines) {
		finalMissingLines.push(fl.lineText);
	}

	const finalNewLines: string[] = [];
	const prevNewText = newSectionLines.join('\n');
	const prevNewFileLines = parseIdxMarkdown(prevNewText, workspaceRoot, openFilePaths);
	const alreadyInFinalNew = new Set<string>();

	for (const fl of prevNewFileLines) {
		if (getCachedFileStats(fl.resolvedPath).exists && !listedPaths.has(fl.resolvedPath)) {
			finalNewLines.push(fl.lineText);
			alreadyInFinalNew.add(fl.resolvedPath);
		}
	}

	for (const relPath of newFiles) {
		const absPath = path.resolve(workspaceRoot, relPath);
		if (!alreadyInFinalNew.has(absPath)) {
			finalNewLines.push(`- [ ] ${relPath}`);
		}
	}

	let finalContent = filteredMainLines.join('\n').trimEnd();

	if (finalMissingLines.length > 0) {
		finalContent += `\n\n## Missing Files\n` + finalMissingLines.map(l => l.trimEnd()).join('\n');
	}

	if (finalNewLines.length > 0) {
		finalContent += `\n\n## New Files\n` + finalNewLines.map(l => l.trimEnd()).join('\n');
	}
	finalContent += '\n';

	const edit = new vscode.WorkspaceEdit();
	edit.replace(
		document.uri,
		new vscode.Range(0, 0, document.lineCount, 0),
		finalContent
	);
	await vscode.workspace.applyEdit(edit);
	vscode.window.showInformationMessage("Index list updated successfully.");
}

async function gotoFileCommand() {
	const idxEditor = vscode.window.activeTextEditor;
	if (!idxEditor) return;

	const document = idxEditor.document;
	const cursorLine = idxEditor.selection.active.line;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const fileLines = parseIdxMarkdown(document.getText(), workspaceRoot, new Set());

	let targetFileLine: FileLine | undefined = undefined;
	for (let l = cursorLine; l >= 0; l--) {
		const found = fileLines.find(fl => fl.lineIndex === l);
		if (found) {
			targetFileLine = found;
			break;
		}
	}

	if (!targetFileLine) {
		vscode.window.showInformationMessage("No file or folder path found at or above current line.");
		return;
	}

	if (targetFileLine.isFolder) {
		await showFolderPicklist(targetFileLine.resolvedPath, document, workspaceRoot);
	} else {
		try {
			const doc = await vscode.workspace.openTextDocument(targetFileLine.resolvedPath);
			await vscode.window.showTextDocument(doc);
		} catch (e) {
			vscode.window.showErrorMessage(`Could not open file: ${targetFileLine.resolvedPath}`);
		}
	}
}

async function returnToIdxCommand() {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) return;

	const currentPath = activeEditor.document.uri.fsPath;
	const idxUri = await getIndexUri();
	if (!idxUri) return;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	// Don't recursive open the index on itself
	if (currentPath === idxUri.fsPath) {
		return;
	}

	if (!fs.existsSync(idxUri.fsPath)) {
		const choice = await vscode.window.showInformationMessage(
			`Index file does not exist. Create and add this file?`,
			"Yes",
			"No"
		);
		if (choice === "Yes") {
			fs.writeFileSync(idxUri.fsPath, `# Index\n\n## New Files\n`, 'utf8');
		} else {
			return;
		}
	}

	const idxDoc = await vscode.workspace.openTextDocument(idxUri);
	const idxEditor = await vscode.window.showTextDocument(idxDoc);

	const fileLines = parseIdxMarkdown(idxDoc.getText(), workspaceRoot, new Set());
	const matches = fileLines.filter(fl => fl.resolvedPath === currentPath);

	if (matches.length > 0) {
		const currentIdxCursor = idxEditor.selection.active.line;
		let bestMatch = matches.find(m => m.lineIndex >= currentIdxCursor);
		if (!bestMatch) {
			bestMatch = [...matches].reverse().find(m => m.lineIndex < currentIdxCursor);
		}
		if (!bestMatch) {
			bestMatch = matches[0];
		}

		const pos = new vscode.Position(bestMatch.lineIndex, 0);
		idxEditor.selection = new vscode.Selection(pos, pos);
		idxEditor.revealRange(idxEditor.selection, vscode.TextEditorRevealType.InCenter);
	} else {
		// Append code line to ## New Files section
		const text = idxDoc.getText();
		const lines = text.split(/\r?\n/);
		let newFilesHeadingIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim().startsWith("## ") && lines[i].toLowerCase().includes("new files")) {
				newFilesHeadingIndex = i;
				break;
			}
		}

		const relativePath = path.relative(workspaceRoot, currentPath).replace(/\\/g, '/');
		const insertLineText = `- [ ] ${relativePath}`;
		const edit = new vscode.WorkspaceEdit();

		if (newFilesHeadingIndex !== -1) {
			const pos = new vscode.Position(newFilesHeadingIndex + 1, 0);
			edit.insert(idxDoc.uri, pos, `${insertLineText}\n`);
			await vscode.workspace.applyEdit(edit);

			const newPos = new vscode.Position(newFilesHeadingIndex + 1, 0);
			idxEditor.selection = new vscode.Selection(newPos, newPos);
			idxEditor.revealRange(idxEditor.selection, vscode.TextEditorRevealType.InCenter);
		} else {
			const pos = new vscode.Position(idxDoc.lineCount, 0);
			const endsWithNewline = text.endsWith('\n');
			const appendText = `${endsWithNewline ? "" : "\n"}\n## New Files\n${insertLineText}\n`;
			edit.insert(idxDoc.uri, pos, appendText);
			await vscode.workspace.applyEdit(edit);

			const newPos = new vscode.Position(idxDoc.lineCount - 2, 0);
			idxEditor.selection = new vscode.Selection(newPos, newPos);
			idxEditor.revealRange(idxEditor.selection, vscode.TextEditorRevealType.InCenter);
		}
	}
}

async function showJumpAnyPicker() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const idxUri = await getIndexUri();
	let idxText = "";
	if (idxUri && fs.existsSync(idxUri.fsPath)) {
		try {
			idxText = fs.readFileSync(idxUri.fsPath, 'utf8');
		} catch (e) { }
	}

	const openFilePaths = new Set<string>();
	try {
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputText) {
					openFilePaths.add(tab.input.uri.fsPath);
				}
			}
		}
	} catch (e) { }

	const fileLines = parseIdxMarkdown(idxText, workspaceRoot, openFilePaths);

	const workspaceFiles = await vscode.workspace.findFiles("**/*", getExcludeGlob());
	const uniquePaths = new Set(workspaceFiles.map(f => f.fsPath));

	for (const fl of fileLines) {
		if (!fl.isFolder) {
			uniquePaths.add(fl.resolvedPath);
		}
	}

	const openList: string[] = [];
	const closedList: string[] = [];

	for (const fPath of uniquePaths) {
		if (idxUri && fPath === idxUri.fsPath) continue;
		if (isPathExcluded(fPath, workspaceRoot)) continue;
		if (openFilePaths.has(fPath)) {
			openList.push(fPath);
		} else {
			closedList.push(fPath);
		}
	}

	const qpItems: (vscode.QuickPickItem & { resolvedPath?: string })[] = [];

	if (openList.length > 0) {
		qpItems.push({
			kind: vscode.QuickPickItemKind.Separator,
			label: "Open Files"
		});
		for (const fPath of openList) {
			qpItems.push(buildPickerItem(fPath, true, fileLines, workspaceRoot));
		}
	}

	if (closedList.length > 0) {
		qpItems.push({
			kind: vscode.QuickPickItemKind.Separator,
			label: "Closed Files"
		});
		for (const fPath of closedList) {
			qpItems.push(buildPickerItem(fPath, false, fileLines, workspaceRoot));
		}
	}

	const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { resolvedPath?: string }>();
	quickPick.title = "Jump to Any File";
	quickPick.items = qpItems;

	quickPick.onDidChangeActive(async (activeItems) => {
		if (activeItems.length > 0 && activeItems[0].resolvedPath) {
			const targetPath = activeItems[0].resolvedPath;
			if (openFilePaths.has(targetPath)) {
				try {
					const doc = await vscode.workspace.openTextDocument(targetPath);
					await vscode.window.showTextDocument(doc, { preserveFocus: true, preview: true });
				} catch (e) { }
			}
		}
	});

	quickPick.onDidAccept(async () => {
		const selected = quickPick.selectedItems[0];
		if (selected && selected.resolvedPath) {
			try {
				const doc = await vscode.workspace.openTextDocument(selected.resolvedPath);
				await vscode.window.showTextDocument(doc);
			} catch (e) {
				vscode.window.showErrorMessage(`Could not open file: ${selected.resolvedPath}`);
			}
		}
		quickPick.hide();
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

async function copyProjectUnlistedCommand(document: vscode.TextDocument) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const fileLines = parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
	const listedPaths = new Set(fileLines.map(fl => fl.resolvedPath));

	const workspaceFiles = await vscode.workspace.findFiles("**/*", getExcludeGlob());
	const unlisted: string[] = [];

	for (const file of workspaceFiles) {
		if (file.fsPath === document.uri.fsPath) continue;
		if (isPathExcluded(file.fsPath, workspaceRoot)) continue;
		if (!listedPaths.has(file.fsPath)) {
			const relPath = path.relative(workspaceRoot, file.fsPath).replace(/\\/g, '/');
			unlisted.push(`- [ ] ${relPath}`);
		}
	}

	if (unlisted.length === 0) {
		vscode.window.showInformationMessage("All project files are already indexed.");
		return;
	}

	const textToCopy = unlisted.join('\n');
	await vscode.env.clipboard.writeText(textToCopy);
	vscode.window.showInformationMessage(`Copied ${unlisted.length} unlisted project files to clipboard.`);
}

async function copyProjectUnlistedPickerCommand(document: vscode.TextDocument) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const fileLines = parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
	const listedPaths = new Set(fileLines.map(fl => fl.resolvedPath));

	const workspaceFiles = await vscode.workspace.findFiles("**/*", getExcludeGlob());
	const qpItems: vscode.QuickPickItem[] = [];

	for (const file of workspaceFiles) {
		if (file.fsPath === document.uri.fsPath) continue;
		if (isPathExcluded(file.fsPath, workspaceRoot)) continue;
		if (!listedPaths.has(file.fsPath)) {
			const relPath = path.relative(workspaceRoot, file.fsPath).replace(/\\/g, '/');
			qpItems.push({
				label: path.basename(file.fsPath),
				description: relPath
			});
		}
	}

	if (qpItems.length === 0) {
		vscode.window.showInformationMessage("All project files are already indexed.");
		return;
	}

	const quickPick = vscode.window.createQuickPick();
	quickPick.title = "Select Unlisted Files to Copy";
	quickPick.placeholder = "Select files to copy as checkboxes to the clipboard";
	quickPick.canSelectMany = true;
	quickPick.items = qpItems;

	quickPick.onDidAccept(async () => {
		const selected = quickPick.selectedItems;
		if (selected && selected.length > 0) {
			const listText = selected.map(item => `- [ ] ${item.description}`).join('\n');
			await vscode.env.clipboard.writeText(listText);
			vscode.window.showInformationMessage(`Copied ${selected.length} chosen checkboxes to clipboard.`);
		}
		quickPick.hide();
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

async function toggleCheckboxCommand() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const document = editor.document;
	const cursorLine = editor.selection.active.line;
	const lineText = document.lineAt(cursorLine).text;

	// Pattern matching [ ] or [x] or [X]
	const match = lineText.match(/\[([ xX])\]/);
	if (!match) {
		vscode.window.showInformationMessage("No checkbox found on the current line.");
		return;
	}

	const checkboxChar = match[1];
	const index = lineText.indexOf(`[${checkboxChar}]`);
	if (index === -1) return;

	const newChar = checkboxChar === ' ' ? 'x' : ' ';
	const range = new vscode.Range(
		new vscode.Position(cursorLine, index + 1),
		new vscode.Position(cursorLine, index + 2)
	);

	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, range, newChar);
	await vscode.workspace.applyEdit(edit);
}

async function createMissingCommand(lineIndex?: number) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const document = editor.document;
	const targetLine = lineIndex !== undefined ? lineIndex : editor.selection.active.line;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const fileLines = parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
	const fl = fileLines.find(item => item.lineIndex === targetLine);

	if (!fl || fl.exists) {
		vscode.window.showInformationMessage("Target file already exists or line is not recognized as a missing path.");
		return;
	}

	try {
		const parentDir = path.dirname(fl.resolvedPath);
		if (!fs.existsSync(parentDir)) {
			fs.mkdirSync(parentDir, { recursive: true });
		}

		if (fl.isFolder) {
			if (!fs.existsSync(fl.resolvedPath)) {
				fs.mkdirSync(fl.resolvedPath, { recursive: true });
				vscode.window.showInformationMessage(`Created folder: ${fl.filepath}`);
			}
		} else {
			fs.writeFileSync(fl.resolvedPath, '', 'utf8');
			vscode.window.showInformationMessage(`Created file: ${fl.filepath}`);
			const doc = await vscode.workspace.openTextDocument(fl.resolvedPath);
			await vscode.window.showTextDocument(doc);
		}

		// Invalidate cache entry and trigger visible decorations repaint
		fileStatsCache.delete(fl.resolvedPath);
		fileStatsCache.delete(parentDir);
	} catch (err: any) {
		vscode.window.showErrorMessage(`Failed to create item: ${err.message}`);
	}
}

class IdxCodeActionProvider implements vscode.CodeActionProvider {
	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	): vscode.CodeAction[] {
		const actions: vscode.CodeAction[] = [];
		const lineIndex = range.start.line;
		const lineText = document.lineAt(lineIndex).text;

		// Checkbox toggler Code Action
		const checkboxMatch = lineText.match(/\[([ xX])\]/);
		if (checkboxMatch) {
			const isChecked = checkboxMatch[1].toLowerCase() === 'x';
			const checkboxAction = new vscode.CodeAction(
				isChecked ? "☐ Mark task as incomplete" : "☑ Mark task as completed",
				vscode.CodeActionKind.RefactorRewrite
			);
			checkboxAction.command = {
				command: 'idx.toggleCheckbox',
				title: 'IDX: Toggle Checkbox',
				arguments: []
			};
			actions.push(checkboxAction);
		}

		// Missing path creation Code Action
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders) {
			const workspaceRoot = workspaceFolders[0].uri.fsPath;
			const fileLines = parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
			const fl = fileLines.find(item => item.lineIndex === lineIndex);
			if (fl && !fl.exists) {
				const createAction = new vscode.CodeAction(
					fl.isFolder ? `📁 Create directory: ${fl.filepath}` : `📄 Create file: ${fl.filepath}`,
					vscode.CodeActionKind.QuickFix
				);
				createAction.command = {
					command: 'idx.createMissing',
					title: 'IDX: Create Missing Fileline',
					arguments: [lineIndex]
				};
				actions.push(createAction);
			}
		}

		return actions;
	}
}

// ----------------------------------------------------
// Activation Entrypoint
// ----------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
	const manager = new GutterDecorationManager();

	// Invalidate cached stats when file system modifications occur
	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	const handleFsChange = (uri: vscode.Uri) => {
		fileStatsCache.delete(uri.fsPath);
		updateAllVisibleDecorations(manager);
	};
	watcher.onDidCreate(handleFsChange);
	watcher.onDidChange(handleFsChange);
	watcher.onDidDelete(handleFsChange);
	context.subscriptions.push(watcher);

	// Gutter notification bindings
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateAllVisibleDecorations(manager);
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => {
		updateAllVisibleDecorations(manager);
	}));

	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(() => {
		updateAllVisibleDecorations(manager);
	}));

	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(() => {
		updateAllVisibleDecorations(manager);
	}));

	// Automatic schedule updates
	const interval = setInterval(() => {
		updateAllVisibleDecorations(manager);
	}, 5000);

	context.subscriptions.push({
		dispose() {
			clearInterval(interval);
			manager.dispose();
		}
	});

	// Perform initial gutter paint
	updateAllVisibleDecorations(manager);

	// Code Action registrations
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			{ scheme: 'file', language: 'markdown' },
			new IdxCodeActionProvider(),
			{
				providedCodeActionKinds: [vscode.CodeActionKind.RefactorRewrite, vscode.CodeActionKind.QuickFix]
			}
		)
	);

	// Command registries
	context.subscriptions.push(vscode.commands.registerCommand('idx.openIdx', async () => {
		await openIdxCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.update', async () => {
		const idxUri = await getIndexUri();
		if (!idxUri) return;
		try {
			const idxDoc = await vscode.workspace.openTextDocument(idxUri);
			await updateIdxCommand(idxDoc);
		} catch (e) {
			vscode.window.showErrorMessage(`Index file is not found or could not be open.`);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.gotoFile', async () => {
		await gotoFileCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.returnToIdx', async () => {
		await returnToIdxCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.returnToIdxPicker', async () => {
		const idxUri = await getIndexUri();
		if (!idxUri || !fs.existsSync(idxUri.fsPath)) {
			vscode.window.showErrorMessage(`Index file is not available.`);
			return;
		}
		const idxDoc = await vscode.workspace.openTextDocument(idxUri);
		await showIdxLinePicker(idxDoc);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.jumpAny', async () => {
		await showJumpAnyPicker();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.jumpWithin', async () => {
		const idxUri = await getIndexUri();
		if (!idxUri || !fs.existsSync(idxUri.fsPath)) {
			vscode.window.showErrorMessage(`Index file is not available.`);
			return;
		}
		const idxDoc = await vscode.workspace.openTextDocument(idxUri);
		await showIdxLinePicker(idxDoc);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.copyProjectUnlisted', async () => {
		const idxUri = await getIndexUri();
		if (!idxUri || !fs.existsSync(idxUri.fsPath)) {
			vscode.window.showErrorMessage(`Index file is not available.`);
			return;
		}
		const idxDoc = await vscode.workspace.openTextDocument(idxUri);
		await copyProjectUnlistedCommand(idxDoc);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.copyProjectUnlistedPicker', async () => {
		const idxUri = await getIndexUri();
		if (!idxUri || !fs.existsSync(idxUri.fsPath)) {
			vscode.window.showErrorMessage(`Index file is not available.`);
			return;
		}
		const idxDoc = await vscode.workspace.openTextDocument(idxUri);
		await copyProjectUnlistedPickerCommand(idxDoc);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.toggleCheckbox', async () => {
		await toggleCheckboxCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.createMissing', async (lineIndex?: number) => {
		await createMissingCommand(lineIndex);
	}));
}

export function deactivate() { }
