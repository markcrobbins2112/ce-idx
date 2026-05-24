import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

//#region _interfaces
// Representation of a fileline parsed from idx.md
interface FileLine {
	lineIndex: number;
	lineText: string;
	indentation: number;
	heading: string;         // closest parent heading name
	filepath: string;        // visual token extracted, e.g., 'src/extension.ts'
	resolvedPath: string;    // absolute file system path
	resolvedPaths?: string[]; // all matching absolute paths for multi-matches
	isMultiMatch?: boolean;   // true if multiple files matched
	exists: boolean;
	isFolder: boolean;
	prefix: string;          // prefix before the path, excluding checkbox
	suffix: string;          // suffix after the path
	checkbox?: {
		checked: boolean;
		range: vscode.Range;
	};
}
//#endregion _interfaces

//#region _cache
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
//#endregion _cache

//#region _utils
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

// Sanitize a file spec word from punctuation
function sanitizeFileSpecWord(word: string): string {
	return word.replace(/^[:;,"'({<\s]+|[:;,"'({>\s]+$/g, '')
		.replace(/[\]})"'>]+$/g, '')
		.replace(/^[\[({"'<]+/g, '');
}

// Global caching of all files in the workspace (excluding excluded templates)
let workspaceFilesCache: string[] = [];
let workspaceFilesCacheTime = 0;

async function getAllWorkspaceFiles(workspaceRoot: string): Promise<string[]> {
	const now = Date.now();
	if (now - workspaceFilesCacheTime < 3000 && workspaceFilesCache.length > 0) {
		return workspaceFilesCache;
	}
	const uris = await vscode.workspace.findFiles("**/*", getExcludeGlob());
	workspaceFilesCache = uris.map(u => u.fsPath).filter(f => !isPathExcluded(f, workspaceRoot));
	workspaceFilesCacheTime = now;
	return workspaceFilesCache;
}

// Global caching of all directories in the workspace
async function getAllWorkspaceDirectories(workspaceRoot: string): Promise<string[]> {
	const files = await getAllWorkspaceFiles(workspaceRoot);
	const dirs = new Set<string>();
	dirs.add(workspaceRoot);
	for (const f of files) {
		const dir = path.dirname(f);
		if (!isPathExcluded(dir, workspaceRoot)) {
			dirs.add(dir);
		}
	}
	return Array.from(dirs);
}

// Get preference-ordered list of extensions
function getEligibleExtensions(): string[] {
	const config = vscode.workspace.getConfiguration("idx");
	const extStr = config.get<string>("eligibleExtensions", "js,ts,md,txt,json,jsonc") || config.get<string>("eligableExtensions", "js,ts,md,txt,json,jsonc") || "js,ts,md,txt,json,jsonc";
	return extStr.split(',').map(e => e.trim().replace(/^\./, "").toLowerCase()).filter(Boolean);
}

// Resolve a filespec token to actual paths on disk
async function resolveFileSpec(
	token: string,
	indentation: number,
	folderStack: { indentation: number; resolvedPath: string }[],
	workspaceRoot: string,
	allWorkspaceFiles: string[],
	eligibleExts: string[]
): Promise<{ matchedPaths: string[]; isMultiMatch: boolean }> {
	const parentFolder = folderStack.findLast(f => f.indentation < indentation);
	const parentPath = parentFolder ? parentFolder.resolvedPath : workspaceRoot;

	// 1. Relative paths
	if (token.startsWith('./') || token.startsWith('../')) {
		const target = path.resolve(parentPath, token);
		const exists = fs.existsSync(target);
		return { matchedPaths: exists ? [target] : [], isMultiMatch: false };
	}

	// 2. Folder spec inherited suffix (starts with /)
	if (token.startsWith('/')) {
		const target = path.resolve(parentPath, token.substring(1));
		const exists = fs.existsSync(target);
		return { matchedPaths: exists ? [target] : [], isMultiMatch: false };
	}

	// 3. Nested path without leading slash/dot (e.g., "src/main.ts")
	if (token.includes('/') || token.includes('\\')) {
		let target = path.resolve(parentPath, token);
		if (fs.existsSync(target)) {
			return { matchedPaths: [target], isMultiMatch: false };
		}
		target = path.resolve(workspaceRoot, token);
		if (fs.existsSync(target)) {
			return { matchedPaths: [target], isMultiMatch: false };
		}
		return { matchedPaths: [], isMultiMatch: false };
	}

	// 4. Ambiguous / workspace-wide (no slashes)
	const tokenLower = token.toLowerCase();

	if (token.endsWith('.*')) {
		const baseName = token.slice(0, -2).toLowerCase();
		const matches = allWorkspaceFiles.filter(fPath => {
			const filename = path.basename(fPath);
			const ext = path.extname(fPath).replace(/^\./, "").toLowerCase();
			const base = path.basename(fPath, path.extname(fPath)).toLowerCase();
			return base === baseName && eligibleExts.includes(ext);
		});

		matches.sort((a, b) => {
			const extA = path.extname(a).replace(/^\./, "").toLowerCase();
			const extB = path.extname(b).replace(/^\./, "").toLowerCase();
			return eligibleExts.indexOf(extA) - eligibleExts.indexOf(extB);
		});

		return { matchedPaths: matches, isMultiMatch: matches.length > 1 };
	}

	if (token.includes('.')) {
		const matches = allWorkspaceFiles.filter(fPath => path.basename(fPath).toLowerCase() === tokenLower);
		return { matchedPaths: matches, isMultiMatch: matches.length > 1 };
	}

	const matches = allWorkspaceFiles.filter(fPath => path.basename(fPath).toLowerCase() === tokenLower);
	return { matchedPaths: matches, isMultiMatch: matches.length > 1 };
}

// Check if a file line matches the current file path for jump/return features
function doesFileLineMatchCurrentPath(fl: FileLine, currentPath: string, eligibleExts: string[]): boolean {
	if (fl.resolvedPath === currentPath) {
		return true;
	}
	if (fl.isMultiMatch && fl.resolvedPaths && fl.resolvedPaths.includes(currentPath)) {
		return true;
	}
	const token = fl.filepath;
	if (token.startsWith('.') || token.startsWith('/') || token.includes('/') || token.includes('\\')) {
		return fl.resolvedPath === currentPath;
	}
	const currentBasename = path.basename(currentPath);
	const currentExt = path.extname(currentPath).replace(/^\./, "").toLowerCase();
	const currentBaseNoExt = path.basename(currentPath, path.extname(currentPath)).toLowerCase();

	if (token.endsWith('.*')) {
		const tokenBase = token.slice(0, -2).toLowerCase();
		if (currentBaseNoExt === tokenBase) {
			return true;
		}
	} else if (!token.includes('.')) {
		if (currentBasename.toLowerCase() === token.toLowerCase()) {
			return true;
		}
	} else {
		if (currentBasename.toLowerCase() === token.toLowerCase()) {
			return true;
		}
	}
	return false;
}
//#endregion _utils

//#region _idx
// Robust recursive file explorer parser
async function parseIdxMarkdown(documentText: string, workspaceRoot: string, openFilePaths: Set<string>): Promise<FileLine[]> {
	const lines = documentText.split(/\r?\n/);
	const fileLines: FileLine[] = [];
	const folderStack: { indentation: number; resolvedPath: string }[] = [];
	let currentHeading = "Index Folder";

	const eligibleExts = getEligibleExtensions();
	const allWorkspaceFiles = await getAllWorkspaceFiles(workspaceRoot);

	for (let i = 0; i < lines.length; i++) {
		const lineText = lines[i];
		const trimmed = lineText.trim();
		if (!trimmed) continue;

		// Check if it is a heading to update our current heading context
		if (trimmed.startsWith('#')) {
			currentHeading = trimmed.replace(/^#+\s+/, '');
			folderStack.length = 0;
			continue;
		}

		const indentation = getIndentation(lineText);

		const lineRegex = /^([-*+]\s+|\d+\.\s+)?(?:\[([ xX])\]\s*)?(.*)$/;
		const match = trimmed.match(lineRegex);
		if (!match) continue;

		const bullet = match[1] || "";
		const checkboxChar = match[2];
		const rest = match[3] || "";

		if (!rest.trim()) continue;

		const words = rest.split(/\s+/);
		let filepathIndex = -1;
		let candidateFilepath = "";
		let cleanedFilepath = "";
		let resolvedPathsResult: string[] = [];

		for (let w = 0; w < words.length; w++) {
			const word = words[w];
			const cleaned = sanitizeFileSpecWord(word);
			if (!cleaned) continue;

			const ext = path.extname(cleaned).substring(1).toLowerCase();
			const isEligibleOrCommonExt = eligibleExts.includes(ext) || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'html', 'less', 'scss', 'yml', 'yaml', 'toml', 'xml', 'ini', 'cfg', 'conf', 'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'py', 'rb', 'pl', 'pm', 'php', 'aspx', 'jsp', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'kt', 'kts', 'swift', 'rs', 'go', 'lock', 'env', 'gitignore'].includes(ext);
			const isExplicitPath = cleaned.includes('/') || cleaned.includes('\\') || cleaned.endsWith('.*') || cleaned.startsWith('.') || (cleaned.includes('.') && isEligibleOrCommonExt);

			const { matchedPaths } = await resolveFileSpec(cleaned, indentation, folderStack, workspaceRoot, allWorkspaceFiles, eligibleExts);

			if (matchedPaths.length > 0 || isExplicitPath) {
				filepathIndex = w;
				candidateFilepath = word;
				cleanedFilepath = cleaned;
				resolvedPathsResult = matchedPaths;
				break;
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

		const exists = resolvedPathsResult.length > 0;
		const isMultiMatch = resolvedPathsResult.length > 1;

		let resolvedPath = "";
		if (exists) {
			resolvedPath = resolvedPathsResult[0];
		} else {
			const parentFolder = folderStack.findLast(f => f.indentation < indentation);
			const parentPath = parentFolder ? parentFolder.resolvedPath : workspaceRoot;

			let cleanToken = cleanedFilepath;
			if (cleanToken.startsWith('./')) {
				cleanToken = cleanToken.substring(2);
			} else if (cleanToken.startsWith('/')) {
				cleanToken = cleanToken.substring(1);
			}

			resolvedPath = path.resolve(parentPath, cleanToken);
		}

		let isFolder = false;
		if (exists) {
			isFolder = getCachedFileStats(resolvedPath).isFolder;
		} else {
			isFolder = !cleanedFilepath.includes('.') || cleanedFilepath.endsWith('/') || cleanedFilepath.endsWith('\\');
		}

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
			resolvedPaths: resolvedPathsResult,
			isMultiMatch,
			exists,
			isFolder,
			prefix,
			suffix,
			checkbox: checkboxInfo
		});
	}

	return fileLines;
}
//#endregion _idx

//#region _classes
//#region _class_GutterDecorationManager
class GutterDecorationManager {
	//#region _class_GutterDecorationManager_vars
	private blueDecorationType: vscode.TextEditorDecorationType;
	private whiteDecorationType: vscode.TextEditorDecorationType;
	private greenDecorationType: vscode.TextEditorDecorationType;
	private whiteSquareDecorationType: vscode.TextEditorDecorationType;
	private greenSquareDecorationType: vscode.TextEditorDecorationType;
	private updateTimeout: NodeJS.Timeout | undefined;
	//#endregion _class_GutterDecorationManager_vars

	//#region _class_GutterDecorationManager_ctor
	constructor() {
		const blueSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="#3b82f6" /></svg>`
		).toString('base64');

		const whiteSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill="none" stroke="#94a3b8" stroke-width="2" /></svg>`
		).toString('base64');

		const greenSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="#22c55e" /></svg>`
		).toString('base64');

		const whiteSquareSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="#94a3b8" stroke-width="2" rx="1.5" /></svg>`
		).toString('base64');

		const greenSquareSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" fill="#22c55e" rx="1.5" /></svg>`
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

		this.whiteSquareDecorationType = vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.parse(`data:image/svg+xml;base64,${whiteSquareSvg}`),
			gutterIconSize: 'contain'
		});

		this.greenSquareDecorationType = vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.parse(`data:image/svg+xml;base64,${greenSquareSvg}`),
			gutterIconSize: 'contain'
		});
	}
	//#endregion _class_GutterDecorationManager_ctor

	//#region _class_GutterDecorationManager_functions
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
			editor.setDecorations(this.whiteSquareDecorationType, []);
			editor.setDecorations(this.greenSquareDecorationType, []);
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

		const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, openFilePaths);

		const blueRanges: vscode.Range[] = [];
		const whiteRanges: vscode.Range[] = [];
		const greenRanges: vscode.Range[] = [];
		const whiteSquareRanges: vscode.Range[] = [];
		const greenSquareRanges: vscode.Range[] = [];

		for (const fl of fileLines) {
			const range = new vscode.Range(fl.lineIndex, 0, fl.lineIndex, 0);
			if (!fl.exists) {
				blueRanges.push(range);
			} else if (fl.isMultiMatch) {
				const isAnyOpen = fl.resolvedPaths ? fl.resolvedPaths.some(p => openFilePaths.has(p)) : false;
				if (isAnyOpen) {
					greenSquareRanges.push(range);
				} else {
					whiteSquareRanges.push(range);
				}
			} else {
				if (openFilePaths.has(fl.resolvedPath)) {
					greenRanges.push(range);
				} else {
					whiteRanges.push(range);
				}
			}
		}

		editor.setDecorations(this.blueDecorationType, blueRanges);
		editor.setDecorations(this.whiteDecorationType, whiteRanges);
		editor.setDecorations(this.greenDecorationType, greenRanges);
		editor.setDecorations(this.whiteSquareDecorationType, whiteSquareRanges);
		editor.setDecorations(this.greenSquareDecorationType, greenSquareRanges);
	}

	public dispose() {
		this.blueDecorationType.dispose();
		this.whiteDecorationType.dispose();
		this.greenDecorationType.dispose();
		this.whiteSquareDecorationType.dispose();
		this.greenSquareDecorationType.dispose();
	}
	//#endregion _class_GutterDecorationManager_functions
}
//#endregion _class_GutterDecorationManager

//#region _class_IdxCodeActionProvider
class IdxCodeActionProvider implements vscode.CodeActionProvider {
	//#region _class_IdxCodeActionProvider_functions
	public async provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	): Promise<vscode.CodeAction[]> {
		const actions: vscode.CodeAction[] = [];
		const lineIndex = range.start.line;
		const lineText = document.lineAt(lineIndex).text;

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

		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders) {
			const workspaceRoot = workspaceFolders[0].uri.fsPath;
			const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
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
	//#endregion _class_IdxCodeActionProvider_functions
}
//#endregion _class_IdxCodeActionProvider

//#region _class_IdxStatusBarContainer
class IdxStatusBarContainer {
	//#region _class_IdxStatusBarContainer_vars
	static statusBarItem: vscode.StatusBarItem | undefined;
	//#endregion _class_IdxStatusBarContainer_vars

	//#region _class_IdxStatusBarContainer_functions
	/** Initialize the status bar item
	 * @static
	 * @param {vscode.ExtensionContext} context The extension context to push subscriptions
	 */
	static init(context: vscode.ExtensionContext) {
		const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		item.text = "IDX: Active: 🔴 No | Fileline: 🔴 No";
		item.tooltip = "IDX Context Status Tracker";
		item.command = "idx.openIdx";
		item.show();
		IdxStatusBarContainer.statusBarItem = item;
		context.subscriptions.push(item);
	}

	/** Update status bar content based on current flags
	 * @static
	 * @param {boolean} fileActive True if the configured idx.md file is currently active
	 * @param {boolean} cursorOnFileLine True if the cursor is currently on a parsed fileline
	 */
	static update(fileActive: boolean, cursorOnFileLine: boolean) {
		const item = IdxStatusBarContainer.statusBarItem;
		if (item) {
			const activeStr = fileActive ? "🟢 Yes" : "🔴 No";
			const filelineStr = cursorOnFileLine ? "🟢 Yes" : "🔴 No";
			item.text = `IDX: Active: ${activeStr} | Fileline: ${filelineStr}`;
		}
	}
	//#endregion _class_IdxStatusBarContainer_functions
}
//#endregion _class_IdxStatusBarContainer
//#endregion _classes

//#region _state
let activeIdxFileLines: FileLine[] = [];
let activeIdxUri: string | null = null;
let activeIdxText: string | null = null;

async function getOrUpdateActiveFileLines(editor: vscode.TextEditor, workspaceRoot: string): Promise<FileLine[]> {
	const doc = editor.document;
	const text = doc.getText();
	if (activeIdxUri === doc.uri.toString() && activeIdxText === text) {
		return activeIdxFileLines;
	}
	activeIdxFileLines = await parseIdxMarkdown(text, workspaceRoot, new Set());
	activeIdxUri = doc.uri.toString();
	activeIdxText = text;
	return activeIdxFileLines;
}

async function updateContexts() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.commands.executeCommand('setContext', 'idxFileActive', false);
		vscode.commands.executeCommand('setContext', 'idxCursorOnFileLine', false);
		const Sbc_ = IdxStatusBarContainer;
		Sbc_.update(false, false);
		return;
	}

	const doc = editor.document;
	const config = vscode.workspace.getConfiguration("idx");
	const idxFilename = config.get<string>("indexFilename", "idx.md");

	if (path.basename(doc.uri.fsPath) !== idxFilename) {
		vscode.commands.executeCommand('setContext', 'idxFileActive', false);
		vscode.commands.executeCommand('setContext', 'idxCursorOnFileLine', false);
		const Sbc_ = IdxStatusBarContainer;
		Sbc_.update(false, false);
		return;
	}

	vscode.commands.executeCommand('setContext', 'idxFileActive', true);

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		vscode.commands.executeCommand('setContext', 'idxCursorOnFileLine', false);
		const Sbc_ = IdxStatusBarContainer;
		Sbc_.update(true, false);
		return;
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const fileLines = await getOrUpdateActiveFileLines(editor, workspaceRoot);
	const cursorLine = editor.selection.active.line;

	const hasFileLine = fileLines.some(fl => fl.lineIndex === cursorLine);
	vscode.commands.executeCommand('setContext', 'idxCursorOnFileLine', hasFileLine);
	const Sbc_ = IdxStatusBarContainer;
	Sbc_.update(true, hasFileLine);
}
//#endregion _state

//#region _gutter_helper
function updateAllVisibleDecorations(manager: GutterDecorationManager) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	for (const editor of vscode.window.visibleTextEditors) {
		manager.triggerUpdate(editor, workspaceRoot);
	}
}
//#endregion _gutter_helper

//#region _pickers
function buildPickerItem(fPath: string, isOpen: boolean, fileLines: FileLine[], workspaceRoot: string): vscode.QuickPickItem & { resolvedPath: string } {
	const filename = path.basename(fPath);
	const relPath = path.relative(workspaceRoot, fPath).replace(/\\/g, '/');
	const emoji = isOpen ? "🟢" : "⚪";

	const occurrences = fileLines.filter(fl => fl.resolvedPath === fPath || (fl.isMultiMatch && fl.resolvedPaths && fl.resolvedPaths.includes(fPath)));
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

	const fileLines = await parseIdxMarkdown(idxDocument.getText(), workspaceRoot, openFilePaths);

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

async function showIdxLinePicker(idxDocument: vscode.TextDocument) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const openFilePaths = new Set<string>();
	const fileLines = await parseIdxMarkdown(idxDocument.getText(), workspaceRoot, openFilePaths);

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
			vscode.window.showTextDocument(idxDocument);
		}
		quickPick.hide();
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}
//#endregion _pickers

//#region _settings
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
//#endregion _settings

//#region _commands
async function handleMissingFileCreation(fl: FileLine, workspaceRoot: string) {
	let targetFilename = fl.filepath;
	let extChosen = "";

	if (targetFilename.endsWith('.*')) {
		const eligibleExts = getEligibleExtensions();
		const baseNoExt = targetFilename.slice(0, -2);
		const extChoice = await vscode.window.showQuickPick(eligibleExts.map(e => `.${e}`), {
			placeHolder: `Select extension to create for '${baseNoExt}':`
		});
		if (!extChoice) return;
		extChosen = extChoice;
		targetFilename = baseNoExt + extChoice;
	}

	let targetDir = "";
	const isAmbiguous = !fl.filepath.startsWith('.') && !fl.filepath.startsWith('/') && !fl.filepath.includes('/') && !fl.filepath.includes('\\');

	if (isAmbiguous) {
		const dirs = await getAllWorkspaceDirectories(workspaceRoot);
		const relativeDirs = dirs.map(d => ({
			label: d === workspaceRoot ? "./ (Workspace Root)" : path.relative(workspaceRoot, d).replace(/\\/g, '/'),
			absolutePath: d
		}));
		const dirChoice = await vscode.window.showQuickPick(relativeDirs, {
			placeHolder: `Select directory to create file '${targetFilename}':`
		});
		if (!dirChoice) return;
		targetDir = dirChoice.absolutePath;
	} else {
		targetDir = path.dirname(fl.resolvedPath);
	}

	const finalPath = path.join(targetDir, isAmbiguous ? targetFilename : path.basename(fl.resolvedPath));

	try {
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}
		if (fl.isFolder) {
			fs.mkdirSync(finalPath, { recursive: true });
			vscode.window.showInformationMessage(`Created directory: ${finalPath}`);
		} else {
			fs.writeFileSync(finalPath, '', 'utf8');
			vscode.window.showInformationMessage(`Created file: ${finalPath}`);
			const doc = await vscode.workspace.openTextDocument(finalPath);
			await vscode.window.showTextDocument(doc);
		}
		fileStatsCache.delete(finalPath);
		fileStatsCache.delete(targetDir);
		vscode.commands.executeCommand('idx.update');
	} catch (err: any) {
		vscode.window.showErrorMessage(`Failed to create item: ${err.message}`);
	}
}

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
	const fileLines = await parseIdxMarkdown(mainText, workspaceRoot, openFilePaths);

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
	const prevMissingFileLines = await parseIdxMarkdown(prevHeadingText, workspaceRoot, openFilePaths);
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
	const prevNewFileLines = await parseIdxMarkdown(prevNewText, workspaceRoot, openFilePaths);
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
	await resolveFilelineUnderCursor(false);
}

async function openFileCommand() {
	await resolveFilelineUnderCursor(true);
}

async function resolveFilelineUnderCursor(preserveFocus: boolean) {
	const idxEditor = vscode.window.activeTextEditor;
	if (!idxEditor) return;

	const document = idxEditor.document;
	const cursorLine = idxEditor.selection.active.line;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, new Set());

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
	} else if (targetFileLine.isMultiMatch && targetFileLine.resolvedPaths && targetFileLine.resolvedPaths.length > 1) {
		const qpItems = targetFileLine.resolvedPaths.map(p => {
			const rel = path.relative(workspaceRoot, p).replace(/\\/g, '/');
			return {
				label: path.basename(p),
				description: rel,
				resolvedPath: p
			};
		});
		const selected = await vscode.window.showQuickPick(qpItems, {
			placeHolder: `Multiple files match '${targetFileLine.filepath}'. Select one:`
		});
		if (selected) {
			try {
				const doc = await vscode.workspace.openTextDocument(selected.resolvedPath);
				await vscode.window.showTextDocument(doc, { preserveFocus, preview: false });
			} catch (e) {
				vscode.window.showErrorMessage(`Could not open file: ${selected.resolvedPath}`);
			}
		}
	} else {
		if (targetFileLine.exists) {
			try {
				const doc = await vscode.workspace.openTextDocument(targetFileLine.resolvedPath);
				await vscode.window.showTextDocument(doc, { preserveFocus, preview: false });
			} catch (e) {
				vscode.window.showErrorMessage(`Could not open file: ${targetFileLine.resolvedPath}`);
			}
		} else {
			await handleMissingFileCreation(targetFileLine, workspaceRoot);
		}
	}
}

async function closeFileCommand() {
	const idxEditor = vscode.window.activeTextEditor;
	if (!idxEditor) return;

	const document = idxEditor.document;
	const cursorLine = idxEditor.selection.active.line;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
	let targetFileLine: FileLine | undefined = undefined;
	for (let l = cursorLine; l >= 0; l--) {
		const found = fileLines.find(fl => fl.lineIndex === l);
		if (found) {
			targetFileLine = found;
			break;
		}
	}

	if (!targetFileLine) {
		vscode.window.showInformationMessage("No file path found on the current line.");
		return;
	}

	const pathsToClose = new Set<string>();
	if (targetFileLine.isMultiMatch && targetFileLine.resolvedPaths) {
		for (const p of targetFileLine.resolvedPaths) {
			pathsToClose.add(p);
		}
	} else if (targetFileLine.exists) {
		pathsToClose.add(targetFileLine.resolvedPath);
	}

	if (pathsToClose.size === 0) {
		vscode.window.showInformationMessage("Target file does not exist.");
		return;
	}

	let closedAny = false;
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputText && pathsToClose.has(tab.input.uri.fsPath)) {
				await vscode.window.tabGroups.close(tab);
				closedAny = true;
			}
		}
	}

	if (closedAny) {
		vscode.window.showInformationMessage(`Closed open file(s) for '${targetFileLine.filepath}'.`);
	} else {
		vscode.window.showInformationMessage(`File '${targetFileLine.filepath}' is not currently open.`);
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

	const fileLines = await parseIdxMarkdown(idxDoc.getText(), workspaceRoot, new Set());
	const eligibleExts = getEligibleExtensions();
	const matches = fileLines.filter(fl => doesFileLineMatchCurrentPath(fl, currentPath, eligibleExts));

	if (matches.length > 0) {
		let chosenMatch = matches[0];
		if (matches.length > 1) {
			const qpItems = matches.map(fl => ({
				label: `Line ${fl.lineIndex + 1}: ${fl.lineText.trim()}`,
				description: fl.heading,
				detail: fl.filepath,
				fileLine: fl
			}));
			const selected = await vscode.window.showQuickPick(qpItems, {
				placeHolder: "Multiple index lines match current file. Choose one to return to:"
			});
			if (selected) {
				chosenMatch = selected.fileLine;
			} else {
				return;
			}
		}

		const pos = new vscode.Position(chosenMatch.lineIndex, 0);
		idxEditor.selection = new vscode.Selection(pos, pos);
		idxEditor.revealRange(idxEditor.selection, vscode.TextEditorRevealType.InCenter);
	} else {
		const currentExt = path.extname(currentPath).replace(/^\./, "").toLowerCase();
		if (!eligibleExts.includes(currentExt)) {
			const choice = await vscode.window.showInformationMessage(
				`Current file extension '${currentExt}' is not in the eligible list. Append checklist to index?`,
				"Yes",
				"No"
			);
			if (choice !== "Yes") return;
		}

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

	const fileLines = await parseIdxMarkdown(idxText, workspaceRoot, openFilePaths);

	const workspaceFiles = await vscode.workspace.findFiles("**/*", getExcludeGlob());
	const uniquePaths = new Set(workspaceFiles.map(f => f.fsPath));

	for (const fl of fileLines) {
		if (!fl.isFolder) {
			uniquePaths.add(fl.resolvedPath);
			if (fl.isMultiMatch && fl.resolvedPaths) {
				for (const p of fl.resolvedPaths) {
					uniquePaths.add(p);
				}
			}
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

	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
	const listedPaths = new Set(fileLines.map(fl => fl.resolvedPath));
	if (fileLines) {
		for (const fl of fileLines) {
			if (fl.isMultiMatch && fl.resolvedPaths) {
				for (const p of fl.resolvedPaths) {
					listedPaths.add(p);
				}
			}
		}
	}

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

	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
	const listedPaths = new Set(fileLines.map(fl => fl.resolvedPath));
	if (fileLines) {
		for (const fl of fileLines) {
			if (fl.isMultiMatch && fl.resolvedPaths) {
				for (const p of fl.resolvedPaths) {
					listedPaths.add(p);
				}
			}
		}
	}

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

	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, new Set());
	const fl = fileLines.find(item => item.lineIndex === targetLine);

	if (!fl || fl.exists) {
		vscode.window.showInformationMessage("Target file already exists or line is not recognized as a missing path.");
		return;
	}

	await handleMissingFileCreation(fl, workspaceRoot);
}
//#endregion _commands

//#region _setups
function watchSetup(context: vscode.ExtensionContext, manager: GutterDecorationManager): NodeJS.Timeout {
	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	const handleFsChange = (uri: vscode.Uri) => {
		fileStatsCache.delete(uri.fsPath);
		updateAllVisibleDecorations(manager);
	};
	watcher.onDidCreate(handleFsChange);
	watcher.onDidChange(handleFsChange);
	watcher.onDidDelete(handleFsChange);
	context.subscriptions.push(watcher);

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async editor => {
		if (editor) {
			updateAllVisibleDecorations(manager);
			await updateContexts();
		} else {
			await updateContexts();
		}
	}));

	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(async event => {
		if (vscode.window.activeTextEditor && event.textEditor === vscode.window.activeTextEditor) {
			await updateContexts();
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async event => {
		const config = vscode.workspace.getConfiguration("idx");
		const idxFilename = config.get<string>("indexFilename", "idx.md");
		if (path.basename(event.document.uri.fsPath) === idxFilename) {
			if (activeIdxUri === event.document.uri.toString()) {
				activeIdxText = null;
			}
			updateAllVisibleDecorations(manager);
			await updateContexts();
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(() => {
		updateAllVisibleDecorations(manager);
	}));

	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(() => {
		updateAllVisibleDecorations(manager);
	}));

	const interval = setInterval(() => {
		updateAllVisibleDecorations(manager);
	}, 5000);

	return interval;
}

function commandsSetup(context: vscode.ExtensionContext) {
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

	context.subscriptions.push(vscode.commands.registerCommand('idx.openFile', async () => {
		await openFileCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.closeFile', async () => {
		await closeFileCommand();
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
//#endregion _setups

//#region _activate
export function activate(context: vscode.ExtensionContext) {
	const manager = new GutterDecorationManager();
	const interval = watchSetup(context, manager);

	const Sbc_ = IdxStatusBarContainer;
	Sbc_.init(context);

	context.subscriptions.push({
		dispose() {
			clearInterval(interval);
			manager.dispose();
		}
	});

	updateAllVisibleDecorations(manager);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			{ scheme: 'file', language: 'markdown' },
			new IdxCodeActionProvider(),
			{
				providedCodeActionKinds: [vscode.CodeActionKind.RefactorRewrite, vscode.CodeActionKind.QuickFix]
			}
		)
	);
	commandsSetup(context);
	updateContexts();
}

export function deactivate() { }
//#endregion _activate
