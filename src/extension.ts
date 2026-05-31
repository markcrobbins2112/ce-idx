import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';


// Reusable line highlight decoration using a theme-aware background color
const pickerLineHighlightDecoration0 = vscode.window.createTextEditorDecorationType({
	isWholeLine: true,
	backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
	// Optional visual anchors: matches VS Code's native find match style boundary
	overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.rangeHighlightForeground'),
	overviewRulerLane: vscode.OverviewRulerLane.Full
});
// A high-visibility highlight configuration that bypasses theme restrictions
const pickerLineHighlightDecoration = vscode.window.createTextEditorDecorationType({
	isWholeLine: true,
	// transclucent fallback value that works on both dark and light interfaces
	backgroundColor: 'rgba(255, 235, 59, 0.18)',

	// Gutter accent lines can force immediate structural drawing
	gutterIconPath: undefined,
	overviewRulerLane: vscode.OverviewRulerLane.Full,

	// A thick border block drawn on the left side of the row line numbers
	borderWidth: '0 0 0 4px',
	borderStyle: 'solid',
	borderColor: '#ffeb3b', // Bright amber/yellow highlight strip accent
});

//#region _consts
// Define the valid tags we are matching
const TAGS = ['NEW:', 'OK:', 'FIXED:', 'FAIL:', 'BUG:', 'DONE:'] as const;
const CommandMetadataContainer_descriptions = {
	"idx.openIdx": "Go To Index File",
	"idx.update": "Update Index File Listings",
	"idx.gotoFile": "Edit Files",
	"idx.openFile": "Open Files",
	"idx.closeFile": "Close Files",
	"idx.returnToIdx": "Return to Index Location",
	"idx.returnToIdxPicker": "Return to Index Location Picker",
	"idx.jumpAny": "Jump to Any File (List All)",
	"idx.jumpWithin": "Jump Within Index Listings",
	"idx.copyProjectUnlisted": "Copy Unindexed Filelines",
	"idx.copyProjectUnlistedPicker": "Copy Unindexed Filelines from Picker",
	"idx.toggleCheckbox": "Toggle Checkbox X",
	"idx.createMissing": "Create Missing File or Folder",
	"idx.setKeybindings": "Set User Keybindings",
	"idx.collectEditors": "Collect and Group Editors",
	"idx.closeAllMarkdownEditors": "Close All Markdown Editors",
	"idx.checkboxer": "Checkbox Label Toggle",
	"idx.checkboxTag": "Checkbox Tag",
	"idx.pickCommand": "Pick an IDX Command",
	"idx.copyKeybindings": "Copy Commands to Clipboard",
	"idx.removeSelectedCheckboxes": "Remove Selection Checkboxes",
	"idx.addSelectedCheckboxes": "Add Checkboxes to Selection",
	"idx.newFilespec": "New Filespec",
	"idx.checkboxTagJump": "Checkbox Tag Jump",
	"idx.fileMentions": "File Mentions",
	"idx.newCheckboxLine": "New Checkbox Line"
};
const defaultKeybindings = [
	{ "command": "idx.openIdx", "key": "` i", "when": "!idxFileActive" },
	{ "command": "idx.update", "key": "f5", "when": "idxFileActive" },
	{ "command": "idx.gotoFile", "key": "f2", "when": "idxCursorOnFileLine || idxFileActive && editorHasSelection" },
	{ "command": "idx.openFile", "key": "alt+f2", "when": "idxFileActive && editorHasSelection" },
	{ "command": "idx.closeFile", "key": "f4", "when": "idxCursorOnFileLine || idxFileActive && editorHasSelection" },
	{ "command": "idx.returnToIdx", "key": "` backspace", "when": "!idxFileActive" },
	{ "command": "idx.returnToIdxPicker", "key": "` ctrl+backspace", "when": "!idxFileActive" },
	{ "command": "idx.jumpAny", "key": "alt+` i", "when": "idxFileActive" },
	{ "command": "idx.jumpWithin", "key": "alt+` alt+i", "when": "idxFileActive" },
	{ "command": "idx.copyProjectUnlisted", "key": "alt+i ctrl+insert", "when": "idxFileActive" },
	{ "command": "idx.copyProjectUnlistedPicker", "key": "alt+i alt+insert", "when": "idxFileActive" },
	{ "command": "idx.toggleCheckbox", "key": "insert x" },
	{ "command": "idx.collectEditors", "key": "ctrl+` f11" },
	{ "command": "idx.closeAllMarkdownEditors", "key": "ctrl+` f4" },
	{ "command": "idx.checkboxer", "key": "ctrl+alt+f10" },
	{ "command": "idx.checkboxTag", "key": "ctrl+alt+shift+f10" },
	{ "command": "idx.pickCommand", "key": "" },
	{ "command": "idx.copyKeybindings", "key": "" },
	{ "command": "idx.newFilespec", "key": "insert f" },
	{ "command": "idx.checkboxTagJump", "key": "alt+` t" },
	{ "command": "idx.fileMentions", "key": "alt+` m" },
	{ "command": "idx.newCheckboxLine", "key": "insert c" }
];
//#endregion _consts
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
	filepathRange?: vscode.Range;
}

// Renamed interface to fit your updated data structures
interface FileLineShort {
	lineText: string;
	lineIndex: number;
	filepath: string;
	resolvedPath: string;
	exists: boolean;
	isFolder?: boolean;
	isMultiMatch?: boolean;
	resolvedPaths?: string[];
}
interface CheckboxItem {
	lineText: string;
	lineNumber: number;
	tagType: string; // 'none' or one of the TAGS
	stateLabel: string; // ToDo, ToReview, Done
	remainingText: string;
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

/** Get the standard user configuration directory for VS Code on all platforms
 * Supporting standard VS Code, Insiders, VSCodium, Code-OSS, and Cursor.
 * @returns {string} The platform-specific absolute directory path.
 */
function getVSCodeUserDir(): string {
	const home = os.homedir();
	const appName = vscode.env.appName || 'Code';
	const appLower = appName.toLowerCase();
	let folderName = 'Code';
	if (appLower.includes('cursor')) {
		folderName = 'Cursor';
	} else if (appLower.includes('insiders')) {
		folderName = 'Code - Insiders';
	} else if (appLower.includes('vscodium')) {
		folderName = 'VSCodium';
	} else if (appLower.includes('oss')) {
		folderName = 'Code - OSS';
	}

	let userPath = '';
	if (process.platform === 'win32') {
		const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
		userPath = path.join(appData, folderName, 'User');
	} else if (process.platform === 'darwin') {
		userPath = path.join(home, 'Library', 'Application Support', folderName, 'User');
	} else {
		userPath = path.join(home, '.config', folderName, 'User');
	}
	return userPath;
}

/** Safely parse JSON configuration files with possible comment/trailing comma markup
 * @param {string} content - The JSON text content
 * @returns {any[]} The parsed array or an empty array if invalid
 */
function parseJSONSafely(content: string): any[] {
	const cleaned = content
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*/g, '')
		.trim();
	if (!cleaned) {
		return [];
	}
	try {
		return JSON.parse(cleaned);
	} catch (e) {
		try {
			const looseJson = cleaned.replace(/,\s*([\]}])/g, '$1');
			return JSON.parse(looseJson);
		} catch (e2) {
			return [];
		}
	}
}

// Sanitize a file spec word from punctuation
function sanitizeFileSpecWord(word: string): string {
	return word.replace(/^[:;,"'({<\s]+|[:;,"'({>\s]+$/g, '')
		.replace(/[\]})"'>]+$/g, '')
		.replace(/^[\[({"'<]+/g, '');
}

// Check if nested filespec has a valid existing directory part
function isValidExplicitPathWithSlashes(token: string, parentPath: string, workspaceRoot: string): boolean {
	const normalized = token.replace(/\\/g, '/');
	if (normalized.startsWith('./') || normalized.startsWith('../') || normalized.startsWith('/')) {
		return true;
	}

	const lastSlash = normalized.lastIndexOf('/');
	if (lastSlash === -1) {
		return true;
	}

	const dirPart = token.substring(0, lastSlash);

	const targetParentDir = path.resolve(parentPath, dirPart);
	if (fs.existsSync(targetParentDir) && fs.statSync(targetParentDir).isDirectory()) {
		return true;
	}

	const targetWorkspaceDir = path.resolve(workspaceRoot, dirPart);
	if (fs.existsSync(targetWorkspaceDir) && fs.statSync(targetWorkspaceDir).isDirectory()) {
		return true;
	}

	return false;
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

// Helper to convert wildcard pattern with * to a regular expression
function wildcardToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
	return new RegExp(regexStr, 'i');
}
//#endregion _utils

//#region _utils2
// Check if a resolved absolute path matches a wildcard filespec token
function isPathMatchWildcard(filePath: string, wildcardToken: string, parentPath: string, workspaceRoot: string): boolean {
	let token = wildcardToken;
	let filePattern = token;
	let baseDir = parentPath;

	if (token.startsWith('/')) {
		baseDir = parentPath;
		filePattern = token.substring(1);
	} else if (token.startsWith('./') || token.startsWith('../')) {
		let normalized = token.replace(/\\/g, '/');
		const lastSlash = normalized.lastIndexOf('/');
		const dirPart = token.substring(0, lastSlash);
		filePattern = token.substring(lastSlash + 1);
		baseDir = path.resolve(parentPath, dirPart);
	} else if (token.includes('/') || token.includes('\\')) {
		let normalized = token.replace(/\\/g, '/');
		const lastSlash = normalized.lastIndexOf('/');
		const dirPart = token.substring(0, lastSlash);
		filePattern = token.substring(lastSlash + 1);
		baseDir = path.resolve(parentPath, dirPart);
	} else {
		const regex = wildcardToRegex(token);
		return regex.test(path.basename(filePath));
	}

	const baseDirLower = baseDir.toLowerCase().replace(/\\/g, '/');
	const filePathLower = filePath.toLowerCase().replace(/\\/g, '/');
	if (filePathLower.startsWith(baseDirLower + '/')) {
		const relativePart = filePath.substring(baseDir.length + 1).replace(/\\/g, '/');
		if (filePattern.includes('/')) {
			return wildcardToRegex(filePattern).test(relativePart);
		} else {
			return wildcardToRegex(filePattern).test(path.basename(filePath));
		}
	}
	return false;
}

// Helper to determine lines within a selection
function getSelectedLinesForSelection(editor: vscode.TextEditor, sel: vscode.Selection): number[] {
	if (sel.isEmpty) {
		return [sel.active.line];
	}

	const startLine = sel.start.line;
	const endLine = sel.end.line;

	if (startLine === endLine) {
		const lineLength = editor.document.lineAt(startLine).text.length;
		if (sel.start.character === 0 || sel.end.character >= lineLength) {
			return [startLine];
		}
		return [];
	}

	const lines: number[] = [];
	lines.push(startLine);

	for (let l = startLine + 1; l < endLine; l++) {
		lines.push(l);
	}

	const endLineLength = editor.document.lineAt(endLine).text.length;
	if (sel.end.character >= endLineLength) {
		lines.push(endLine);
	}

	return lines;
}

// Get all unique line indices selected across all active editor cursors/selections
function getSelectedLines(editor: vscode.TextEditor): number[] {
	const allLines = new Set<number>();
	let hasActiveSelection = false;

	for (const sel of editor.selections) {
		if (!sel.isEmpty) {
			hasActiveSelection = true;
			const lines = getSelectedLinesForSelection(editor, sel);
			for (const l of lines) {
				allLines.add(l);
			}
		}
	}

	if (!hasActiveSelection) {
		for (const sel of editor.selections) {
			allLines.add(sel.active.line);
		}
	}

	return Array.from(allLines).sort((a, b) => { return a - b; });
}

//#endregion _utils2


//#region _utils3
// Filter a list of FileLines to only those present in the provided selected line numbers
function getFileLinesInSelection(document: vscode.TextDocument, fileLines: FileLine[], selectedLines: number[]): FileLine[] {
	const selectedLinesSet = new Set(selectedLines);
	return fileLines.filter(fl => { return selectedLinesSet.has(fl.lineIndex); });
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
	let parentFolder = undefined;
	for (let i = folderStack.length - 1; i >= 0; i--) {
		if (folderStack[i].indentation < indentation) {
			parentFolder = folderStack[i];
			break;
		}
	}
	const parentPath = parentFolder ? parentFolder.resolvedPath : workspaceRoot;

	// Support wildcards containing * anywhere in filespec
	if (token.includes('*')) {
		if (token.startsWith('./') || token.startsWith('../') || token.startsWith('/') || token.includes('/') || token.includes('\\')) {
			let normalized = token.replace(/\\/g, '/');
			let baseDir = parentPath;
			let filePattern = token;

			if (token.startsWith('/')) {
				baseDir = parentPath;
				filePattern = token.substring(1);
			} else if (token.startsWith('./') || token.startsWith('../') || token.includes('/')) {
				const lastSlash = normalized.lastIndexOf('/');
				const dirPart = token.substring(0, lastSlash);
				filePattern = token.substring(lastSlash + 1);
				baseDir = path.resolve(parentPath, dirPart);
				if (!fs.existsSync(baseDir) && !token.startsWith('./') && !token.startsWith('../')) {
					baseDir = path.resolve(workspaceRoot, dirPart);
				}
			}

			if (fs.existsSync(baseDir) && fs.statSync(baseDir).isDirectory()) {
				try {
					const baseDirLower = baseDir.toLowerCase().replace(/\\/g, '/');
					const wildcardRegex = wildcardToRegex(filePattern);
					const matches = allWorkspaceFiles.filter(fPath => {
						const fPathNormalized = fPath.replace(/\\/g, '/');
						if (fPathNormalized.toLowerCase().startsWith(baseDirLower + '/')) {
							const relativeToDir = fPath.substring(baseDir.length + 1).replace(/\\/g, '/');
							if (filePattern.includes('/')) {
								return wildcardToRegex(filePattern).test(relativeToDir);
							} else {
								return wildcardRegex.test(path.basename(fPath));
							}
						}
						return false;
					});
					return { matchedPaths: matches, isMultiMatch: matches.length > 1 };
				} catch (e) {
					return { matchedPaths: [], isMultiMatch: false };
				}
			}
			return { matchedPaths: [], isMultiMatch: false };
		} else {
			const wildcardRegex = wildcardToRegex(token);
			const matches = allWorkspaceFiles.filter(fPath => {
				const filename = path.basename(fPath);
				return wildcardRegex.test(filename);
			});
			return { matchedPaths: matches, isMultiMatch: matches.length > 1 };
		}
	}

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
		const matches = allWorkspaceFiles.filter(fPath => { return path.basename(fPath).toLowerCase() === tokenLower; });
		return { matchedPaths: matches, isMultiMatch: matches.length > 1 };
	}

	const matches = allWorkspaceFiles.filter(fPath => { return path.basename(fPath).toLowerCase() === tokenLower; });
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
/**
 * Categorization helper using the renamed FileLineShort model mapping
 */
function getFilespecTypeGroup(fl: FileLineShort): string {
	if (fl.isFolder) return 'Folders';
	if (fl.filepath.includes('*')) return 'Wildcards (Globs)';
	if (fl.isMultiMatch) return 'Ambiguous (Multi-Match)';
	if (!fl.exists) return 'Broken Paths (Missing Files)';
	return 'Valid Files';
}

/**
 * Fallback regex baseline string locator
 */
function fallbackParseMarkdownFilespecs(document: vscode.TextDocument, workspaceRoot: string): FileLineShort[] {
	const results: FileLineShort[] = [];
	const checkboxFileRegex = /^\s*([\s\-\*]*\[([ xX])\])\s*(.*\.(?:ts|js|md|json|txt|py|sh|html|css).*)$/i;

	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i);
		const match = line.text.match(checkboxFileRegex);
		if (match) {
			const filepath = match[3].trim().split(' ')[0];
			results.push({
				lineText: line.text,
				lineIndex: i,
				filepath: filepath,
				resolvedPath: path.resolve(workspaceRoot, filepath),
				exists: true
			});
		}
	}
	return results;
}
//#endregion _utils3

//#region _idx
/**
 * Core Markdown Document Parser Engine
 * Scans document line-by-line, tracks nested headings,
 * strips tags/checkboxes, and resolves valid workspace path strings.
 */
/**
 * Core Markdown Document Parser Engine
 * Scans document line-by-line, tracks nested headings,
 * strips tags/checkboxes, and resolves valid workspace path strings.
 *
 * Satisfies:
 * 1. Filespec can appear anywhere on a line (loops through all words).
 * 2. Follows original wildcard/glob disk verification lifecycle.
 * 3. Follows original folder stack inheritance hierarchies.
 * 4. Follows original index-based string range bounds calculations.
 */
export async function parseIdxMarkdown(
	documentText: string,
	workspaceRoot: string,
	openFilePaths: Set<string>
): Promise<FileLine[]> {
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

		// 1. Contextually Update Heading Blocks (Follows Original)
		if (trimmed.startsWith('#')) {
			currentHeading = trimmed.replace(/^#+\s+/, '');
			folderStack.length = 0; // Reset folder hierarchy on new headings
		}

		const indentation = getIndentation(lineText);

		// 2. Extract Structural Prefixes and Checkboxes (Follows Original)
		const lineRegex = /^(?:#+\s+)?(?:([-*+]\s+|\d+\.\s+)?(?:\[([ xX])\]\s*)?)?(.*)$/;
		const match = trimmed.match(lineRegex);
		if (!match) continue;

		const bullet = match[1] || "";
		const checkboxChar = match[2];
		const rest = match[3] || "";

		if (!rest.trim()) continue;

		const words = rest.split(/\s+/);

		// Look past custom status keywords if they prefix the word chain
		let wordsToScan = [...words];
		if (wordsToScan.length > 0) {
			const potentialTag = wordsToScan[0].toUpperCase();
			const isKnownTag = TAGS.some(tag => tag.toUpperCase() === potentialTag || tag.toUpperCase() === potentialTag + ':');
			if (isKnownTag || potentialTag.endsWith(':')) {
				wordsToScan.shift(); // Remove status token from path scanning
			}
		}

		let filepathIndex = -1;
		let candidateFilepath = "";
		let cleanedFilepath = "";
		let resolvedPathsResult: string[] = [];

		// 3. Scan line tokens programmatically (Principle 1: Filespec Anywhere)
		for (let w = 0; w < wordsToScan.length; w++) {
			const word = wordsToScan[w];
			let cleaned = sanitizeFileSpecWord(word);
			if (!cleaned) continue;

			// Uniformly allow and normalize backslashes upfront
			cleaned = cleaned.replace(/\\/g, '/').replace(/\/+/g, '/');

			const ext = path.extname(cleaned).substring(1).toLowerCase();
			const isEligibleOrCommonExt = eligibleExts.includes(ext) || [
				'png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'html', 'less', 'scss',
				'yml', 'yaml', 'toml', 'xml', 'ini', 'cfg', 'conf', 'sh', 'bash',
				'zsh', 'bat', 'cmd', 'ps1', 'py', 'rb', 'pl', 'pm', 'php', 'aspx',
				'jsp', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'kt', 'kts', 'swift',
				'rs', 'go', 'lock', 'env', 'gitignore'
			].includes(ext);

			const isAbsoluteDrive = /^[a-zA-Z]:\//.test(cleaned);
			let isExplicitPath = isAbsoluteDrive || cleaned.includes('/') || cleaned.endsWith('.*') || cleaned.startsWith('.') || (cleaned.includes('.') && isEligibleOrCommonExt);

			if (isExplicitPath && cleaned.includes('/') && !isAbsoluteDrive) {
				let parentFolder = undefined;
				for (let idx = folderStack.length - 1; idx >= 0; idx--) {
					if (folderStack[idx].indentation < indentation) {
						parentFolder = folderStack[idx];
						break;
					}
				}
				const parentPath = parentFolder ? parentFolder.resolvedPath : workspaceRoot;
				if (!isValidExplicitPathWithSlashes(cleaned, parentPath, workspaceRoot)) {
					isExplicitPath = false;
				}
			}

			// Call original resolution logic callback (Principle 2: Glob Verification)
			const { matchedPaths } = await resolveFileSpec(cleaned, indentation, folderStack, workspaceRoot, allWorkspaceFiles, eligibleExts);

			if (matchedPaths.length > 0 || isExplicitPath) {
				filepathIndex = w;
				candidateFilepath = word; // Retain raw word formatting for exact character match index
				cleanedFilepath = cleaned;
				resolvedPathsResult = matchedPaths;
				break;
			}
		}

		if (filepathIndex === -1) {
			continue;
		}

		// 4. Calculate Character Spans and Boundaries Safely (Principle 4: Original Range Calculations)
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
		const isMultiMatch = resolvedPathsResult.length > 1 || cleanedFilepath.includes('*') || cleanedFilepath.includes('?');

		let resolvedPath = "";
		if (exists) {
			resolvedPath = resolvedPathsResult[0];
		} else {
			let parentFolder = undefined;
			for (let idx = folderStack.length - 1; idx >= 0; idx--) {
				if (folderStack[idx].indentation < indentation) {
					parentFolder = folderStack[idx];
					break;
				}
			}
			const parentPath = parentFolder ? parentFolder.resolvedPath : workspaceRoot;

			let cleanToken = cleanedFilepath;
			if (cleanToken.startsWith('./')) {
				cleanToken = cleanToken.substring(2);
			} else if (cleanToken.startsWith('/')) {
				cleanToken = cleanToken.substring(1);
			}

			resolvedPath = /^[a-zA-Z]:\//.test(cleanToken) ? path.normalize(cleanToken) : path.resolve(parentPath, cleanToken);
		}

		// 5. Update Folder Hierarchy Stack Tracking Matrix (Principle 3: Folderspec Inheritance)
		let isFolder = false;
		if (exists) {
			isFolder = getCachedFileStats(resolvedPath).isFolder;
		} else {
			isFolder = !cleanedFilepath.includes('.') || cleanedFilepath.endsWith('/');
		}

		while (folderStack.length > 0 && folderStack[folderStack.length - 1].indentation >= indentation) {
			folderStack.pop();
		}
		if (isFolder) {
			folderStack.push({ indentation, resolvedPath });
		}

		const filepathRange = new vscode.Range(
			new vscode.Position(i, filepathStartIndex),
			new vscode.Position(i, filepathStartIndex + candidateFilepath.length)
		);

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
			checkbox: checkboxInfo,
			filepathRange
		});
	}

	return fileLines;
}
//#endregion _idx

//#region _idx2
// Robust recursive file explorer parser
async function parseIdxMarkdown0(documentText: string, workspaceRoot: string, openFilePaths: Set<string>): Promise<FileLine[]> {
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
		}

		const indentation = getIndentation(lineText);

		const lineRegex = /^(?:#+\s+)?(?:([-*+]\s+|\d+\.\s+)?(?:\[([ xX])\]\s*)?)?(.*)$/;
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

			let isExplicitPath = cleaned.includes('/') || cleaned.includes('\\') || cleaned.endsWith('.*') || cleaned.startsWith('.') || (cleaned.includes('.') && isEligibleOrCommonExt);

			if (isExplicitPath && (cleaned.includes('/') || cleaned.includes('\\'))) {
				let parentFolder = undefined;
				for (let idx = folderStack.length - 1; idx >= 0; idx--) {
					if (folderStack[idx].indentation < indentation) {
						parentFolder = folderStack[idx];
						break;
					}
				}
				const parentPath = parentFolder ? parentFolder.resolvedPath : workspaceRoot;
				if (!isValidExplicitPathWithSlashes(cleaned, parentPath, workspaceRoot)) {
					isExplicitPath = false;
				}
			}

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
			let parentFolder = undefined;
			for (let i = folderStack.length - 1; i >= 0; i--) {
				if (folderStack[i].indentation < indentation) {
					parentFolder = folderStack[i];
					break;
				}
			}
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

		const filepathRange = new vscode.Range(
			new vscode.Position(i, filepathStartIndex),
			new vscode.Position(i, filepathStartIndex + candidateFilepath.length)
		);

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
			checkbox: checkboxInfo,
			filepathRange
		});
	}

	return fileLines;
}
//#endregion _idx2

//#region _classes
//#region _class_AdvancedMarkdownFoldingProvider
export class AdvancedMarkdownFoldingProvider implements vscode.FoldingRangeProvider {
	public provideFoldingRanges(
		document: vscode.TextDocument,
		context: vscode.FoldingContext,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.FoldingRange[]> {
		const ranges: vscode.FoldingRange[] = [];
		const lineCount = document.lineCount;

		for (let i = 0; i < lineCount; i++) {
			if (token.isCancellationRequested) return [];

			const line = document.lineAt(i);
			if (line.isEmptyOrWhitespace) continue;

			const text = line.text;

			// --- STRATEGY A: MARKDOWN HEADERS ---
			const headerMatch = text.match(/^(#{1,6})\s+/);
			if (headerMatch) {
				const currentLevel = headerMatch[1].length;
				let endLine = lineCount - 1;

				for (let j = i + 1; j < lineCount; j++) {
					const nextText = document.lineAt(j).text;
					const nextHeaderMatch = nextText.match(/^(#{1,6})\s+/);
					if (nextHeaderMatch) {
						const nextLevel = nextHeaderMatch[1].length;
						// Higher or equal header hierarchy level terminates the block
						if (nextLevel <= currentLevel) {
							endLine = j - 1;
							break;
						}
					}
				}
				endLine = this.trimTrailingWhitespaceLines(document, i, endLine);
				if (endLine > i) {
					ranges.push(new vscode.FoldingRange(i, endLine, vscode.FoldingRangeKind.Region));
				}
				continue; // Line handled by header strategy
			}

			// --- STRATEGY B: CODE BLOCKS (```) ---
			const codeBlockMatch = text.match(/^(\s*)```/);
			if (codeBlockMatch) {
				let endLine = -1;
				for (let j = i + 1; j < lineCount; j++) {
					// Match closing block at the same or less indentation
					if (document.lineAt(j).text.trim().startsWith('```')) {
						endLine = j;
						break;
					}
				}
				if (endLine > i) {
					ranges.push(new vscode.FoldingRange(i, endLine, vscode.FoldingRangeKind.Imports));
					i = endLine; // Fast-forward loop past the code block boundaries
				}
				continue;
			}

			// --- STRATEGY C: BULLETS & ARBITRARY INDENTATION ---
			// Calculate base visual indentation space length
			const currentIndent = this.getIndentLevel(text);

			// Detect if line is a bullet item list row
			const isBullet = /^\s*([\-\*\+ ]|\d+\.)\s+/.test(text);

			let endLine = i;
			for (let j = i + 1; j < lineCount; j++) {
				const nextLine = document.lineAt(j);
				if (nextLine.isEmptyOrWhitespace) continue;

				// Headers instantly break open indent strings or loose bullets
				if (/^(#{1,6})\s+/.test(nextLine.text)) break;

				const nextIndent = this.getIndentLevel(nextLine.text);

				// If next line is deeper, it belongs to the child block tree
				if (nextIndent > currentIndent) {
					endLine = j;
				}
				// If it shares the same indentation, check if they are siblings in a bullet list
				else if (nextIndent === currentIndent && isBullet) {
					// Siblings don't collapse together; stop grouping here so individual items collapse separately
					break;
				} else {
					// Indentation shrank; scope blocks have ended
					break;
				}
			}

			endLine = this.trimTrailingWhitespaceLines(document, i, endLine);
			if (endLine > i) {
				ranges.push(new vscode.FoldingRange(i, endLine));
			}
		}

		return ranges;
	}

	/**
	 * Helper to compute true visual workspace tab indentation weights
	 */
	private getIndentLevel(text: string): number {
		const match = text.match(/^(\s*)/);
		if (!match) return 0;

		// Convert hard tabs to a standard 4-space weighting scale
		return match[1].replace(/\t/g, '    ').length;
	}

	/**
	 * Trims blank empty rows off the bottom of ranges so folding folds neatly
	 */
	private trimTrailingWhitespaceLines(document: vscode.TextDocument, start: number, end: number): number {
		while (end > start && document.lineAt(end).isEmptyOrWhitespace) {
			end--;
		}
		return end;
	}
}
//#endregion _class_AdvancedMarkdownFoldingProvider

//#region _class_GutterDecorationManager
class GutterDecorationManager {
	//#region _class_GutterDecorationManager_vars
	private blueDecorationType: vscode.TextEditorDecorationType;
	private whiteDecorationType: vscode.TextEditorDecorationType;
	private greenDecorationType: vscode.TextEditorDecorationType;
	private whiteSquareDecorationType: vscode.TextEditorDecorationType;
	private greenSquareDecorationType: vscode.TextEditorDecorationType;
	private blankDecorationType: vscode.TextEditorDecorationType;
	private updateTimeout: NodeJS.Timeout | undefined;

	private fullpathStyle: vscode.TextEditorDecorationType;
	private relativepathStyle: vscode.TextEditorDecorationType;
	private filenameonlyStyle: vscode.TextEditorDecorationType;
	private parentdependentStyle: vscode.TextEditorDecorationType;
	private directoryunspecifiedStyle: vscode.TextEditorDecorationType;
	private folderStyle: vscode.TextEditorDecorationType;
	private wildcardStyle: vscode.TextEditorDecorationType;
	//#endregion _class_GutterDecorationManager_vars

	//#region _class_GutterDecorationManager_ctor
	constructor() {
		// Automatically enable glyph margin
		try {
			vscode.workspace.getConfiguration('editor').update('glyphMargin', true, vscode.ConfigurationTarget.Global);
			vscode.workspace.getConfiguration('editor').update('glyphMargin', true, vscode.ConfigurationTarget.Workspace);
			vscode.workspace.getConfiguration('editor', { languageId: 'markdown' }).update('glyphMargin', true, vscode.ConfigurationTarget.Global);
			vscode.workspace.getConfiguration('editor', { languageId: 'markdown' }).update('glyphMargin', true, vscode.ConfigurationTarget.Workspace);
		} catch (e) { }

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

		const blueUri = vscode.Uri.parse(`data:image/svg+xml;base64,${blueSvg}`);
		const whiteUri = vscode.Uri.parse(`data:image/svg+xml;base64,${whiteSvg}`);
		const greenUri = vscode.Uri.parse(`data:image/svg+xml;base64,${greenSvg}`);
		const whiteSquareUri = vscode.Uri.parse(`data:image/svg+xml;base64,${whiteSquareSvg}`);
		const greenSquareUri = vscode.Uri.parse(`data:image/svg+xml;base64,${greenSquareSvg}`);

		const blankSvg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"></svg>`
		).toString('base64');
		const blankUri = vscode.Uri.parse(`data:image/svg+xml;base64,${blankSvg}`);

		this.blueDecorationType = vscode.window.createTextEditorDecorationType({
			glyphMarginIconPath: blueUri,
			glyphMarginIconSize: 'contain',
			before: {
				contentIconPath: blueUri,
				margin: '0 8px 0 0',
				width: '12px',
				height: '12px'
			}
		} as any);

		this.whiteDecorationType = vscode.window.createTextEditorDecorationType({
			glyphMarginIconPath: whiteUri,
			glyphMarginIconSize: 'contain',
			before: {
				contentIconPath: whiteUri,
				margin: '0 8px 0 0',
				width: '12px',
				height: '12px'
			}
		} as any);

		this.greenDecorationType = vscode.window.createTextEditorDecorationType({
			glyphMarginIconPath: greenUri,
			glyphMarginIconSize: 'contain',
			before: {
				contentIconPath: greenUri,
				margin: '0 8px 0 0',
				width: '12px',
				height: '12px'
			}
		} as any);

		this.whiteSquareDecorationType = vscode.window.createTextEditorDecorationType({
			glyphMarginIconPath: whiteSquareUri,
			glyphMarginIconSize: 'contain',
			before: {
				contentIconPath: whiteSquareUri,
				margin: '0 8px 0 0',
				width: '12px',
				height: '12px'
			}
		} as any);

		this.greenSquareDecorationType = vscode.window.createTextEditorDecorationType({
			glyphMarginIconPath: greenSquareUri,
			glyphMarginIconSize: 'contain',
			before: {
				contentIconPath: greenSquareUri,
				margin: '0 8px 0 0',
				width: '12px',
				height: '12px'
			}
		} as any);

		this.blankDecorationType = vscode.window.createTextEditorDecorationType({
			glyphMarginIconPath: blankUri,
			glyphMarginIconSize: 'contain',
			before: {
				margin: '0 8px 0 0',
				width: '12px',
				height: '12px',
				contentText: '\u00a0'
			}
		} as any);

		// Filespec colors decoration types
		this.fullpathStyle = vscode.window.createTextEditorDecorationType({ color: '#ffffff' });
		this.relativepathStyle = vscode.window.createTextEditorDecorationType({ color: '#d1d5db' });
		this.filenameonlyStyle = vscode.window.createTextEditorDecorationType({ color: '#ef4444' });
		this.parentdependentStyle = vscode.window.createTextEditorDecorationType({ color: '#06b6d4' });
		this.directoryunspecifiedStyle = vscode.window.createTextEditorDecorationType({ color: '#f97316' });
		this.folderStyle = vscode.window.createTextEditorDecorationType({ color: '#eab308' });
		this.wildcardStyle = vscode.window.createTextEditorDecorationType({ color: '#a855f7' });
	}
	//#endregion _class_GutterDecorationManager_ctor

	//#region _class_GutterDecorationManager_functions
	public triggerUpdate(editor: vscode.TextEditor, workspaceRoot: string) {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
		}
		this.updateTimeout = setTimeout(() => this.update(editor, workspaceRoot), 300);
	}

	public updateInstantly(editor: vscode.TextEditor, workspaceRoot: string) {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
		}
		this.update(editor, workspaceRoot);
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
			editor.setDecorations(this.blankDecorationType, []);
			editor.setDecorations(this.fullpathStyle, []);
			editor.setDecorations(this.relativepathStyle, []);
			editor.setDecorations(this.filenameonlyStyle, []);
			editor.setDecorations(this.parentdependentStyle, []);
			editor.setDecorations(this.directoryunspecifiedStyle, []);
			editor.setDecorations(this.folderStyle, []);
			editor.setDecorations(this.wildcardStyle, []);
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

		const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, openFilePaths);

		const blueRanges: vscode.Range[] = [];
		const whiteRanges: vscode.Range[] = [];
		const greenRanges: vscode.Range[] = [];
		const whiteSquareRanges: vscode.Range[] = [];
		const greenSquareRanges: vscode.Range[] = [];

		const fullpathRanges: vscode.Range[] = [];
		const relativepathRanges: vscode.Range[] = [];
		const filenameonlyRanges: vscode.Range[] = [];
		const parentdependentRanges: vscode.Range[] = [];
		const directoryunspecifiedRanges: vscode.Range[] = [];
		const folderRanges: vscode.Range[] = [];
		const wildcardRanges: vscode.Range[] = [];

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

			if (fl.filepathRange) {
				const token = fl.filepath;
				if (token.indexOf('*') !== -1) {
					wildcardRanges.push(fl.filepathRange);
				} else if (fl.isFolder) {
					folderRanges.push(fl.filepathRange);
				} else if (path.isAbsolute(token) || /^[a-zA-Z]:[/\\]/.test(token)) {
					fullpathRanges.push(fl.filepathRange);
				} else if (token.startsWith('./') || token.startsWith('../')) {
					relativepathRanges.push(fl.filepathRange);
				} else if (token.startsWith('/')) {
					parentdependentRanges.push(fl.filepathRange);
				} else if (token.indexOf('.') !== -1 && token.indexOf('/') === -1 && token.indexOf('\\') === -1) {
					directoryunspecifiedRanges.push(fl.filepathRange);
				} else {
					filenameonlyRanges.push(fl.filepathRange);
				}
			}
		}

		const filespecLineIndices = new Set<number>(fileLines.map(fl => fl.lineIndex));
		const blankRanges: vscode.Range[] = [];
		for (let l = 0; l < document.lineCount; l++) {
			if (!filespecLineIndices.has(l)) {
				blankRanges.push(new vscode.Range(l, 0, l, 0));
			}
		}

		editor.setDecorations(this.blueDecorationType, blueRanges);
		editor.setDecorations(this.whiteDecorationType, whiteRanges);
		editor.setDecorations(this.greenDecorationType, greenRanges);
		editor.setDecorations(this.whiteSquareDecorationType, whiteSquareRanges);
		editor.setDecorations(this.greenSquareDecorationType, greenSquareRanges);
		editor.setDecorations(this.blankDecorationType, blankRanges);

		editor.setDecorations(this.fullpathStyle, fullpathRanges);
		editor.setDecorations(this.relativepathStyle, relativepathRanges);
		editor.setDecorations(this.filenameonlyStyle, filenameonlyRanges);
		editor.setDecorations(this.parentdependentStyle, parentdependentRanges);
		editor.setDecorations(this.directoryunspecifiedStyle, directoryunspecifiedRanges);
		editor.setDecorations(this.folderStyle, folderRanges);
		editor.setDecorations(this.wildcardStyle, wildcardRanges);
	}

	public dispose() {
		this.blueDecorationType.dispose();
		this.whiteDecorationType.dispose();
		this.greenDecorationType.dispose();
		this.whiteSquareDecorationType.dispose();
		this.greenSquareDecorationType.dispose();
		this.blankDecorationType.dispose();

		this.fullpathStyle.dispose();
		this.relativepathStyle.dispose();
		this.filenameonlyStyle.dispose();
		this.parentdependentStyle.dispose();
		this.directoryunspecifiedStyle.dispose();
		this.folderStyle.dispose();
		this.wildcardStyle.dispose();
	}
	//#endregion _class_GutterDecorationManager_functions
}
//#endregion _class_GutterDecorationManager
//#endregion _classes
//#region _classes2

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

//#region _class_CommandMetadataContainer
class CommandMetadataContainer {
	static readonly descriptions: { [cmd: string]: string } = CommandMetadataContainer_descriptions;
}
//#endregion _class_CommandMetadataContainer
//#endregion _classes2

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
	if (!workspaceFolders) {
		return;
	}
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	for (const editor of vscode.window.visibleTextEditors) {
		manager.triggerUpdate(editor, workspaceRoot);
	}
}

function updateAllVisibleDecorationsInstantly(manager: GutterDecorationManager) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return;
	}
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	for (const editor of vscode.window.visibleTextEditors) {
		manager.updateInstantly(editor, workspaceRoot);
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

			// Highlight active tracking line inside your idx.md editor instance
			const decorationRange = new vscode.Range(lineIndex, 0, lineIndex, 0);
			idxEditor.setDecorations(pickerLineHighlightDecoration, [decorationRange]);
		}
	});
	quickPick.onDidAccept(() => {
		const selected = quickPick.selectedItems[0];

		// Flush out trailing decoration updates safely
		idxEditor.setDecorations(pickerLineHighlightDecoration, []);

		if (selected && selected.lineIndex !== undefined) {
			const line = selected.lineIndex;
			const pos = new vscode.Position(line, 0);
			idxEditor.selection = new vscode.Selection(pos, pos);
			idxEditor.revealRange(idxEditor.selection, vscode.TextEditorRevealType.InCenter);
			vscode.window.showTextDocument(idxDocument);
		}
		quickPick.hide();
	});

	quickPick.onDidHide(() => {
		idxEditor.setDecorations(pickerLineHighlightDecoration, []);
		quickPick.dispose();
	});
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

//#region _commands1
export function registerFileMentionsCommand(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('idx.fileMentions', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = editor.document;
		const cursorLine = editor.selection.active.line;

		// 1. Resolve Workspace Root Path
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;
		const workspaceRoot = workspaceFolders[0].uri.fsPath;

		// 2. Fetch Open Editor Paths
		const openFilePaths = new Set<string>();
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputText) {
					openFilePaths.add(tab.input.uri.fsPath);
				}
			}
		}

		// 3. Scan document for all filespec rows via the new multi-directory engine
		let allFileLines: FileLineShort[] = [];
		try {
			//allFileLines = await (global as any).parseIdxMarkdown(document.getText(), workspaceRoot, openFilePaths);
			allFileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, openFilePaths);
		} catch (e) {
			// If the global hook isn't active, ensure you call your local module import directly
			vscode.window.showErrorMessage("Could not invoke parseIdxMarkdown pipeline.");
			return;
		}

		if (allFileLines.length === 0) {
			vscode.window.showInformationMessage('No filespec lines discovered inside this document.');
			return;
		}

		// 4. Resolve the targeted Filespec at or above the cursor line position
		let activeFilespec: FileLineShort | undefined = undefined;
		for (let l = cursorLine; l >= 0; l--) {
			const found = allFileLines.find(fl => fl.lineIndex === l);
			if (found) {
				activeFilespec = found;
				break;
			}
		}

		if (!activeFilespec) {
			vscode.window.showInformationMessage("No file or folder path found at or above current line.");
			return;
		}

		const targetPathToken = activeFilespec.filepath;

		// 5. Filter for lines that share the exact same written token (excluding the active line itself)
		const matchingMentions = allFileLines.filter(fl => fl.filepath === targetPathToken && fl.lineIndex !== cursorLine);

		if (matchingMentions.length === 0) {
			vscode.window.showInformationMessage(`No other lines mention the filespec token: "${targetPathToken}"`);
			return;
		}

		// 6. Group and sort mentions by their explicit structural file path resolution types
		matchingMentions.sort((a, b) => {
			const typeA = determinePathResolutionType(a);
			const typeB = determinePathResolutionType(b);
			const typeCompare = typeA.localeCompare(typeB);
			if (typeCompare !== 0) return typeCompare;
			return a.lineIndex - b.lineIndex; // Fallback chronological row sort
		});

		// 7. Map elements to QuickPickItems with clear visual icons
		type MentionPickItem = vscode.QuickPickItem & { targetLine?: number };
		const pickerItems: MentionPickItem[] = [];
		let currentGroupHeader = '';

		matchingMentions.forEach(fl => {
			const pathType = determinePathResolutionType(fl);

			// Inject structural separators when changing resolution families
			if (pathType !== currentGroupHeader) {
				currentGroupHeader = pathType;
				pickerItems.push({
					kind: vscode.QuickPickItemKind.Separator,
					label: `${currentGroupHeader} [Sorted by Line]`
				});
			}

			// Parse state decorations
			const stateLabel = parseCheckboxStateLabel(fl.lineText);
			const cleanTextDescription = fl.lineText.replace(/^\s*([\s\-\*]*\[([ xX])\])\s*/, '').trim();

			// Set up tailored file badge status markers
			let contextGutterBadge = "$(primitive-square) [Direct]";
			if (fl.isMultiMatch) {
				// Multi-match indicator shapes as per spec rules
				contextGutterBadge = `$(layers) [Multi-Match: ${fl.resolvedPaths?.length || 2} dirs]`;
			} else if (fl.filepath.startsWith('/')) {
				contextGutterBadge = "$(key) [Inherited Path]";
			} else if (!fl.exists) {
				contextGutterBadge = "$(warning) [Missing]";
			}

			pickerItems.push({
				label: `[${stateLabel}] Line ${fl.lineIndex + 1}`,
				description: `${contextGutterBadge} — ${cleanTextDescription}`,
				detail: fl.filepath === fl.resolvedPath ? fl.filepath : `${fl.filepath} ➔ ${path.basename(fl.resolvedPath)}`,
				targetLine: fl.lineIndex
			});
		});

		// 8. Open the selection tracking viewport window
		const quickPick = vscode.window.createQuickPick<MentionPickItem>();
		quickPick.items = pickerItems;
		quickPick.placeholder = `Mentions matching filespec '${targetPathToken}' (${matchingMentions.length} found)`;

		quickPick.onDidChangeActive(items => {
			if (items.length > 0 && items[0].targetLine !== undefined) {
				const targetLine = items[0].targetLine;
				const targetRange = new vscode.Range(targetLine, 0, targetLine, 0);

				// 1. Reveal line position in the center of the viewport
				editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);

				// 2. Apply background color highlight decoration to the active line
				const decorationRange = new vscode.Range(targetLine, 0, targetLine, 0);
				editor.setDecorations(pickerLineHighlightDecoration, [decorationRange]);
			}
		});

		quickPick.onDidAccept(() => {
			const selection = quickPick.selectedItems[0];
			quickPick.hide();

			// Clear decorations before moving the permanent cursor
			editor.setDecorations(pickerLineHighlightDecoration, []);

			if (selection && selection.targetLine !== undefined) {
				const targetLine = selection.targetLine;
				const position = new vscode.Position(targetLine, 0);
				editor.selection = new vscode.Selection(position, position);
				editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
			}
		});

		quickPick.onDidHide(() => {
			// ALWAYS clear lines decoration if the picker is dismissed or cancelled
			editor.setDecorations(pickerLineHighlightDecoration, []);
			quickPick.dispose();
		});

		quickPick.show();
	});

	context.subscriptions.push(disposable);
}

/**
 * Categorizes filespec references by path configuration behavior type
 */
function determinePathResolutionType(fl: FileLineShort): string {
	if (!fl.exists) return "⚠️ Broken Filespec Links";
	if (fl.isMultiMatch) return "🔀 Ambiguous Multi-Directory Queries";
	if (fl.filepath.startsWith('./') || fl.filepath.startsWith('../')) return "📍 Explicit Relative Offsets";
	if (fl.filepath.startsWith('/')) return "🌿 Inherited Directory Synthetics";
	return "📄 Standard Single Matches";
}

function parseCheckboxStateLabel(text: string): string {
	const match = text.match(/^\s*[\s\-\*]*\[([ xX])\]/);
	if (!match) return 'ToDo';
	const char = match[1];
	if (char === 'x') return 'ToReview';
	if (char === 'X') return 'Done';
	return 'ToDo';
}
//#endregion _commands1

//#region _commands2
export function registerCheckboxTagJumpCommand(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('idx.checkboxTagJump', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = editor.document;
		const totalLines = document.lineCount;
		const scanResults: CheckboxItem[] = [];

		// 1. Scan document for checkbox structures using a comprehensive Regex
		// Captures standard [ ], [x], and [X] checkbox sequences
		const checkboxRegex = /^\s*([\s\-\*]*\[([ xX])\])\s*(.*)$/;

		for (let i = 0; i < totalLines; i++) {
			const line = document.lineAt(i);
			const match = line.text.match(checkboxRegex);

			if (match) {
				const charState = match[2];
				const contentText = match[3].trim();

				let stateLabel = 'ToDo';
				if (charState === 'x') stateLabel = 'ToReview';
				if (charState === 'X') stateLabel = 'Done';

				// Look for known tags at the beginning of the remaining content text
				let matchedTag = 'none';
				let remainingText = contentText;

				for (const tag of TAGS) {
					if (contentText.startsWith(tag)) {
						matchedTag = tag;
						remainingText = contentText.substring(tag.length).trim();
						break;
					}
				}

				scanResults.push({
					lineText: line.text,
					lineNumber: i,
					tagType: matchedTag,
					stateLabel,
					remainingText
				});
			}
		}

		if (scanResults.length === 0) {
			vscode.window.showInformationMessage('No markdown checkboxes detected in this file.');
			return;
		}

		// 2. Count distributions for Picker #1
		const tagCounts: Record<string, number> = { 'none': 0 };
		TAGS.forEach(t => tagCounts[t] = 0);
		scanResults.forEach(item => tagCounts[item.tagType]++);

		const firstPickerItems = Object.keys(tagCounts)
			.filter(tag => tagCounts[tag] > 0) // Only display active categories
			.map(tag => ({
				label: tag,
				description: `Count: ${tagCounts[tag]}`
			}));

		// Display Picker #1 (Multi-select tag filter)
		const selectedTags = await vscode.window.showQuickPick(firstPickerItems, {
			placeHolder: 'Choose checkbox tag categories to view',
			canPickMany: true
		});

		if (!selectedTags || selectedTags.length === 0) return;
		const targetTagNames = selectedTags.map(t => t.label);

		// Filter matched elements to pass along to Picker #2
		const filteredOccurrences = scanResults.filter(item => targetTagNames.includes(item.tagType));

		// Sort occurrences by tag type so they group cleanly under structural separators
		filteredOccurrences.sort((a, b) => a.tagType.localeCompare(b.tagType));

		// 3. Build occurrence menu items using VS Code's structural layout
		type OccurrencePickItem = vscode.QuickPickItem & { itemRef?: CheckboxItem };
		const secondPickerItems: OccurrencePickItem[] = [];
		let lastSeenTag = '';

		filteredOccurrences.forEach(occur => {
			if (occur.tagType !== lastSeenTag) {
				lastSeenTag = occur.tagType;
				secondPickerItems.push({
					kind: vscode.QuickPickItemKind.Separator,
					label: `Tag Type: ${lastSeenTag.replace(':', '')}`
				});
			}

			secondPickerItems.push({
				label: `[${occur.stateLabel}] Line ${occur.lineNumber + 1}`,
				description: occur.remainingText,
				detail: occur.remainingText,
				itemRef: occur
			});
		});

		// Generate customized window picker to support live scrolling focus events
		const secondQuickPick = vscode.window.createQuickPick<OccurrencePickItem>();
		secondQuickPick.items = secondPickerItems;
		secondQuickPick.canSelectMany = true;
		secondQuickPick.placeholder = 'Select target check lines (Use Search to match labels/descriptions)';

      // Track user's focus cursor line dynamically to scroll the active text area
        secondQuickPick.onDidChangeActive(items => {
            if (items.length > 0 && items[0].itemRef) {
                const targetLine = items[0].itemRef.lineNumber;
                const targetRange = new vscode.Range(targetLine, 0, targetLine, 0);

                // Scroll layout
                editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);

                // Paint targeted row line background
                const decorationRange = new vscode.Range(targetLine, 0, targetLine, 0);
                editor.setDecorations(pickerLineHighlightDecoration, [decorationRange]);
            }
        });

        secondQuickPick.onDidAccept(async () => {
            const finalChosenItems = secondQuickPick.selectedItems.filter(i => i.itemRef !== undefined);
            secondQuickPick.hide();

            // Wipe temporary visual decorations
            editor.setDecorations(pickerLineHighlightDecoration, []);

            if (finalChosenItems.length === 0) return;

            // ... (keep your choice action logic picker: 'Goto Line' / 'Copy Lines')
        });

        secondQuickPick.onDidHide(() => {
            editor.setDecorations(pickerLineHighlightDecoration, []);
            secondQuickPick.dispose();
        });
		secondQuickPick.show();
	});

	context.subscriptions.push(disposable);
}
//#endregion _commands2

//#region _commands3
export function registerNewFilespecCommand(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('idx.newFilespec', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const document = editor.document;
		const selection = editor.selection;
		const currentLine = document.lineAt(selection.active.line);
		const currentText = currentLine.text;

		// 1. Gather workspace files (skipping node_modules)
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showInformationMessage('No workspace folder open.');
			return;
		}

		const fileUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
		const fileItems: (vscode.QuickPickItem & { relativePath: string })[] = fileUris.map(uri => {
			const relativePath = vscode.workspace.asRelativePath(uri, false);
			return {
				label: path.basename(relativePath),
				detail: relativePath,
				relativePath: relativePath
			};
		});

		// 2. Setup the dynamic File Picker
		const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { relativePath?: string }>();
		quickPick.placeholder = 'Select a file to insert';

		const selectManyItem = { label: '$(list-unordered) [Select Many Options]', description: 'Click to select multiple files' };
		quickPick.items = [selectManyItem, ...fileItems];

		let selectedFiles: string[] = [];

		quickPick.onDidAccept(async () => {
			const selected = quickPick.selectedItems;

			// Handle "Select Many" toggle mode
			if (selected.length === 1 && selected[0].label === selectManyItem.label) {
				quickPick.canSelectMany = true;
				quickPick.items = fileItems;
				quickPick.placeholder = 'Select multiple files, then click OK or press Enter';
				return;
			}

			if (selected.length === 0) {
				quickPick.hide();
				return;
			}

			selectedFiles = selected
				.filter(item => item.relativePath !== undefined)
				.map(item => item.relativePath!);

			quickPick.hide();

			// 3. Setup Second Picker (Identical to New Checkbox Line)
			const indentMatch = currentText.match(/^(\s*)/);
			const indentation = indentMatch ? indentMatch[0] : '';

			const headerMatch = currentText.trim().match(/^(#+)\s/);
			const currentHeaderLevel = headerMatch ? headerMatch[1].length : 0;

			const prefixItems: (vscode.QuickPickItem & { prefix: string })[] = [];

			if (currentHeaderLevel > 0) {
				prefixItems.push({
					label: 'Same level header',
					description: '#'.repeat(currentHeaderLevel),
					prefix: '#'.repeat(currentHeaderLevel) + ' '
				});
				prefixItems.push({
					label: 'Parent level header',
					description: '#'.repeat(Math.max(1, currentHeaderLevel - 1)),
					prefix: '#'.repeat(Math.max(1, currentHeaderLevel - 1)) + ' '
				});
				prefixItems.push({
					label: 'Sub level header',
					description: '#'.repeat(currentHeaderLevel + 1),
					prefix: '#'.repeat(currentHeaderLevel + 1) + ' '
				});
			} else {
				prefixItems.push({ label: 'Same level header', description: '###', prefix: '### ' });
				prefixItems.push({ label: 'Parent level header', description: '##', prefix: '## ' });
				prefixItems.push({ label: 'Sub level header', description: '####', prefix: '#### ' });
			}

			prefixItems.push({ label: 'Bullet', description: '-', prefix: '- ' });
			prefixItems.push({ label: 'Empty', description: 'No prefix', prefix: '' });

			const selectedPrefix = await vscode.window.showQuickPick(prefixItems, {
				placeHolder: 'Select a prefix for your new checkbox line',
			});

			if (!selectedPrefix) {
				return; // User cancelled
			}

			// 4. Construct text block containing checkboxes and file paths
			const textToInsert = selectedFiles.map((relPath, index) => {
				// Format: [Indentation][Selected Prefix][Checkbox Option][File Path]
				const lineContent = `${indentation}${selectedPrefix.prefix}[ ] ${relPath}`;

				// If it is the first file, don't double up on the current cursor line's indentation
				if (index === 0) {
					return `${selectedPrefix.prefix}[ ] ${relPath}`;
				}
				return lineContent;
			}).join('\n');

			// 5. Insert text block into editor at current cursor position
			await editor.edit(editBuilder => {
				editBuilder.insert(selection.active, textToInsert);
			});
		});

		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	});

	context.subscriptions.push(disposable);
}
//#endregion _commands3

//#region _commands4
export function registerNewCheckboxLineCommand(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('idx.newCheckboxLine', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const document = editor.document;
		const selection = editor.selection;
		const currentLine = document.lineAt(selection.active.line);
		const currentText = currentLine.text;

		// 1. Preserve indentation
		const indentMatch = currentText.match(/^(\s*)/);
		const indentation = indentMatch ? indentMatch[1] : '';

		// 2. Analyze the current line to find markdown headers
		const headerMatch = currentText.trim().match(/^(#+)\s/);
		const currentHeaderLevel = headerMatch ? headerMatch[1].length : 0;

		// 3. Define picker options dynamically based on the current context
		const items: (vscode.QuickPickItem & { prefix: string })[] = [];

		if (currentHeaderLevel > 0) {
			// Context: User is currently on a header line
			items.push({
				label: 'Same level header',
				description: '#'.repeat(currentHeaderLevel),
				prefix: '#'.repeat(currentHeaderLevel) + ' '
			});
			items.push({
				label: 'Parent level header',
				description: '#'.repeat(Math.max(1, currentHeaderLevel - 1)),
				prefix: '#'.repeat(Math.max(1, currentHeaderLevel - 1)) + ' '
			});
			items.push({
				label: 'Sub level header',
				description: '#'.repeat(currentHeaderLevel + 1),
				prefix: '#'.repeat(currentHeaderLevel + 1) + ' '
			});
		} else {
			// Context: User is on a normal line (default fallback to H3)
			items.push({ label: 'Same level header', description: '###', prefix: '### ' });
			items.push({ label: 'Parent level header', description: '##', prefix: '## ' });
			items.push({ label: 'Sub level header', description: '####', prefix: '#### ' });
		}

		// Add bullet and empty options
		items.push({ label: 'Bullet', description: '-', prefix: '- ' });
		items.push({ label: 'Empty', description: 'No prefix', prefix: '' });

		// 4. Show the picker
		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a prefix for your new checkbox line',
		});

		if (!selected) {
			return; // User canceled
		}

		// 5. Construct the empty checkbox string: [prefix][[ ]]
		const checkboxString = `${indentation}${selected.prefix}[ ] `;

		// 6. Insert new line below current line
		await editor.edit(editBuilder => {
			const insertPosition = new vscode.Position(selection.active.line + 1, 0);

			if (selection.active.line === document.lineCount - 1) {
				// If it's the last line, insert a newline character first
				editBuilder.insert(currentLine.range.end, `\n${checkboxString}`);
			} else {
				editBuilder.insert(insertPosition, `${checkboxString}\n`);
			}
		});

		// 7. Move cursor to the end of the newly inserted checkbox line
		const newLineNumber = selection.active.line + 1;
		const newLineTarget = document.lineAt(newLineNumber);
		const newSelection = new vscode.Selection(newLineTarget.range.end, newLineTarget.range.end);
		editor.selection = newSelection;
	});

	context.subscriptions.push(disposable);
}

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
//#endregion _commands4

//#region _commands5
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
//#endregion _commands5

//#region _commands6
// section 1
async function showWildcardPicker(targetFileLine: FileLine, allWorkspaceFiles: string[], preserveFocus: boolean) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) { return; }
	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const editor = vscode.window.activeTextEditor;
	if (!editor) { return; }
	const document = editor.document;

	// Determine parentPath
	let parentFileLine: FileLine | undefined = undefined;
	const openFilePaths = new Set<string>();
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputText) {
				openFilePaths.add(tab.input.uri.fsPath);
			}
		}
	}
	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, openFilePaths);
	for (let i = 0; i < fileLines.length; i++) {
		const fl = fileLines[i];
		if (fl.lineIndex === targetFileLine.lineIndex) {
			break;
		}
		if (fl.isFolder && fl.indentation < targetFileLine.indentation) {
			parentFileLine = fl;
		}
	}
	const parentPath = parentFileLine ? parentFileLine.resolvedPath : workspaceRoot;
	//end section 1
	// section 2

	// Loop back to redraw picker after state updates
	while (true) {
		const currentOpenPaths = new Set<string>();
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputText) {
					currentOpenPaths.add(tab.input.uri.fsPath);
				}
			}
		}

		const eligibleExts = getEligibleExtensions();
		const { matchedPaths } = await resolveFileSpec(
			targetFileLine.filepath,
			targetFileLine.indentation,
			parentFileLine ? [{ indentation: parentFileLine.indentation, resolvedPath: parentFileLine.resolvedPath }] : [],
			workspaceRoot,
			await getAllWorkspaceFiles(workspaceRoot),
			eligibleExts
		);

		const openFiles = matchedPaths.filter(p => { return currentOpenPaths.has(p); });
		const existingClosedFiles = matchedPaths.filter(p => { return !currentOpenPaths.has(p); });

		const uncreatedFiles: FileLine[] = [];
		for (const fl of fileLines) {
			if (!fl.exists && !fl.filepath.includes('*')) {
				if (isPathMatchWildcard(fl.resolvedPath, targetFileLine.filepath, parentPath, workspaceRoot)) {
					uncreatedFiles.push(fl);
				}
			}
		}

		const qpItems: vscode.QuickPickItem[] = [];

		let uncreatedItem: vscode.QuickPickItem | undefined = undefined;
		if (uncreatedFiles.length > 0) {
			uncreatedItem = {
				label: `$(plus) ${uncreatedFiles.length} of uncreated files`,
				description: `Create and open matching files`
			};
			qpItems.push(uncreatedItem);
		}

		let closeItem: vscode.QuickPickItem | undefined = undefined;
		if (openFiles.length > 0) {
			closeItem = {
				label: `$(close) Close files`,
				description: `Close some or all open files`
			};
			qpItems.push(closeItem);
		}

		if (openFiles.length > 0) {
			qpItems.push({ label: "Open Files", kind: vscode.QuickPickItemKind.Separator });
			for (const f of openFiles) {
				qpItems.push({
					label: path.basename(f),
					description: path.relative(workspaceRoot, f).replace(/\\/g, '/'),
					detail: "Open in editor"
				});
			}
		}

		if (existingClosedFiles.length > 0) {
			qpItems.push({ label: "Existing Files", kind: vscode.QuickPickItemKind.Separator });
			for (const f of existingClosedFiles) {
				qpItems.push({
					label: path.basename(f),
					description: path.relative(workspaceRoot, f).replace(/\\/g, '/'),
					detail: "Click to open"
				});
			}
		}

		if (qpItems.length === 0) {
			vscode.window.showInformationMessage("No files match wildcard pattern.");
			return;
		}

		const choice = await vscode.window.showQuickPick(qpItems, {
			placeHolder: `Files matching pattern: ${targetFileLine.filepath}`,
			canPickMany: preserveFocus
		}) as any;

		if (!choice) {
			return;
		}

		if (preserveFocus) {
			const choices = choice as vscode.QuickPickItem[];
			if (choices.length === 0) {
				return;
			}

			const selectedUncreated = choices.find(item => uncreatedItem && item.label === uncreatedItem.label);
			const selectedClose = choices.find(item => closeItem && item.label === closeItem.label);

			if (selectedUncreated) {
				const createQpItems = uncreatedFiles.map(fl => {
					return {
						label: path.basename(fl.resolvedPath),
						description: path.relative(workspaceRoot, fl.resolvedPath).replace(/\\/g, '/'),
						fileLine: fl,
						picked: true
					};
				});

				const selectedToCreate = await vscode.window.showQuickPick(createQpItems, {
					placeHolder: "Select files to create and open:",
					canPickMany: true
				});

				if (selectedToCreate && selectedToCreate.length > 0) {
					for (const item of selectedToCreate) {
						await handleMissingFileCreation(item.fileLine, workspaceRoot);
					}
					fileStatsCache.clear();
					for (const fl of fileLines) {
						const stats = getCachedFileStats(fl.resolvedPath);
						fl.exists = stats.exists;
						fl.isFolder = stats.isFolder;
					}
				}
				continue;
			}

			if (selectedClose) {
				const closeQpItems = openFiles.map(f => {
					return {
						label: path.basename(f),
						description: path.relative(workspaceRoot, f).replace(/\\/g, '/'),
						filePath: f,
						picked: true
					};
				});

				const selectedToClose = await vscode.window.showQuickPick(closeQpItems, {
					placeHolder: "Select files to close:",
					canPickMany: true
				});

				if (selectedToClose && selectedToClose.length > 0) {
					const pathsToClose = new Set(selectedToClose.map(item => { return item.filePath; }));
					for (const group of vscode.window.tabGroups.all) {
						for (const tab of group.tabs) {
							if (tab.input instanceof vscode.TabInputText && pathsToClose.has(tab.input.uri.fsPath)) {
								await vscode.window.tabGroups.close(tab);
							}
						}
					}
				}
				continue;
			}

			// Open all selected files
			for (const item of choices) {
				const chosenPathPart = item.description;
				if (chosenPathPart) {
					try {
						const absPath = path.resolve(workspaceRoot, chosenPathPart);
						const doc = await vscode.workspace.openTextDocument(absPath);
						await vscode.window.showTextDocument(doc, { preserveFocus: true, preview: false });
					} catch (e) { }
				}
			}
			return;

		} else {
			const singleChoice = choice as vscode.QuickPickItem;
			if (uncreatedItem && singleChoice.label === uncreatedItem.label) {
				const createQpItems = uncreatedFiles.map(fl => {
					return {
						label: path.basename(fl.resolvedPath),
						description: path.relative(workspaceRoot, fl.resolvedPath).replace(/\\/g, '/'),
						fileLine: fl,
						picked: true
					};
				});

				const selectedToCreate = await vscode.window.showQuickPick(createQpItems, {
					placeHolder: "Select files to create and open:",
					canPickMany: true
				});

				if (selectedToCreate && selectedToCreate.length > 0) {
					for (const item of selectedToCreate) {
						await handleMissingFileCreation(item.fileLine, workspaceRoot);
					}
					fileStatsCache.clear();
					for (const fl of fileLines) {
						const stats = getCachedFileStats(fl.resolvedPath);
						fl.exists = stats.exists;
						fl.isFolder = stats.isFolder;
					}
				}
				continue;
			}

			if (closeItem && singleChoice.label === closeItem.label) {
				const closeQpItems = openFiles.map(f => {
					return {
						label: path.basename(f),
						description: path.relative(workspaceRoot, f).replace(/\\/g, '/'),
						filePath: f,
						picked: true
					};
				});

				const selectedToClose = await vscode.window.showQuickPick(closeQpItems, {
					placeHolder: "Select files to close:",
					canPickMany: true
				});

				if (selectedToClose && selectedToClose.length > 0) {
					const pathsToClose = new Set(selectedToClose.map(item => { return item.filePath; }));
					for (const group of vscode.window.tabGroups.all) {
						for (const tab of group.tabs) {
							if (tab.input instanceof vscode.TabInputText && pathsToClose.has(tab.input.uri.fsPath)) {
								await vscode.window.tabGroups.close(tab);
							}
						}
					}
				}
				continue;
			}

			const chosenPathPart = singleChoice.description;
			if (chosenPathPart) {
				try {
					const absPath = path.resolve(workspaceRoot, chosenPathPart);
					const doc = await vscode.workspace.openTextDocument(absPath);
					await vscode.window.showTextDocument(doc, { preserveFocus: false, preview: false });
				} catch (e) { }
				return;
			}
		}
	}
}
//end section 2

//#endregion _commands6

//#region _commands7
async function gotoFileCommand() {
	await resolveFilelineUnderCursor(false);
}

async function openFileCommand() {
	await resolveFilelineUnderCursor(true);
}
//#endregion _commands7

//#region _commands8
async function resolveFilelineUnderCursor(preserveFocus: boolean) {
	const idxEditor = vscode.window.activeTextEditor;
	if (!idxEditor) { return; }

	const document = idxEditor.document;
	const cursorLine = idxEditor.selection.active.line;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) { return; }
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const openFilePaths = new Set<string>();
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputText) {
				openFilePaths.add(tab.input.uri.fsPath);
			}
		}
	}

	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, openFilePaths);

	const selectedLines = getSelectedLines(idxEditor);
	const selectedFileLines = getFileLinesInSelection(document, fileLines, selectedLines);

	if (selectedFileLines.length === 0) {
		let fallbackFileLine: FileLine | undefined = undefined;
		for (let l = cursorLine; l >= 0; l--) {
			const found = fileLines.find(fl => { return fl.lineIndex === l; });
			if (found) {
				fallbackFileLine = found;
				break;
			}
		}
		if (!fallbackFileLine) {
			vscode.window.showInformationMessage("No file or folder path found at or above current line.");
			return;
		}
		selectedFileLines.push(fallbackFileLine);
	}

	// Case 1: Exactly 1 file line is selected (or we resolved to fallback)
	if (selectedFileLines.length === 1) {
		const targetFileLine = selectedFileLines[0];

		if (targetFileLine.filepath.includes('*')) {
			const allWorkspaceFiles = await getAllWorkspaceFiles(workspaceRoot);
			await showWildcardPicker(targetFileLine, allWorkspaceFiles, preserveFocus);
			return;
		}

		if (targetFileLine.isFolder) {
			await showFolderPicklist(targetFileLine.resolvedPath, document, workspaceRoot);
		} else if (targetFileLine.isMultiMatch && targetFileLine.resolvedPaths && targetFileLine.resolvedPaths.length > 1) {
			const qpItems = targetFileLine.resolvedPaths.map(p => {
				const rel = path.relative(workspaceRoot, p).replace(/\\/g, '/');
				const isOpen = openFilePaths.has(p);
				return {
					label: path.basename(p),
					description: (isOpen ? "$(circle-filled) [Open] " : "$(circle-outline) [Closed] ") + rel,
					resolvedPath: p
				};
			});
			if (preserveFocus) {
				const selected = await vscode.window.showQuickPick(qpItems, {
					placeHolder: `Multiple files match '${targetFileLine.filepath}'. Select files to open:`,
					canPickMany: true
				});
				if (selected && selected.length > 0) {
					for (const s of selected) {
						try {
							const doc = await vscode.workspace.openTextDocument(s.resolvedPath);
							await vscode.window.showTextDocument(doc, { preserveFocus: true, preview: false });
						} catch (e) { }
					}
				}
			} else {
				const selected = await vscode.window.showQuickPick(qpItems, {
					placeHolder: `Multiple files match '${targetFileLine.filepath}'. Select one:`
				});
				if (selected) {
					try {
						const doc = await vscode.workspace.openTextDocument(selected.resolvedPath);
						await vscode.window.showTextDocument(doc, { preserveFocus: false, preview: false });
					} catch (e) {
						vscode.window.showErrorMessage(`Could not open file: ${selected.resolvedPath}`);
					}
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
				const choice = await vscode.window.showQuickPick([
					{ label: `$(file-add) Create "${targetFileLine.filepath}"`, create: true },
					{ label: "$(close) Cancel", create: false }
				], {
					placeHolder: `File "${targetFileLine.filepath}" does not exist. Do you want to create it?`
				});
				if (choice && choice.create) {
					await handleMissingFileCreation(targetFileLine, workspaceRoot);
				}
			}
		}
		return;
	}

	// Case 2: Broad/multiple selection
	const pathsToOpen = new Set<string>();
	const missingFileLines: FileLine[] = [];

	for (const fl of selectedFileLines) {
		if (fl.isFolder) {
			continue;
		}
		if (fl.filepath.includes('*')) {
			const eligibleExts = getEligibleExtensions();
			const allWorkspaceFiles = await getAllWorkspaceFiles(workspaceRoot);
			const { matchedPaths } = await resolveFileSpec(
				fl.filepath,
				fl.indentation,
				[],
				workspaceRoot,
				allWorkspaceFiles,
				eligibleExts
			);
			for (const p of matchedPaths) {
				pathsToOpen.add(p);
			}
		} else if (fl.isMultiMatch && fl.resolvedPaths) {
			for (const p of fl.resolvedPaths) {
				pathsToOpen.add(p);
			}
		} else if (fl.exists) {
			pathsToOpen.add(fl.resolvedPath);
		} else {
			missingFileLines.push(fl);
		}
	}

	if (missingFileLines.length > 0) {
		const result = await vscode.window.showWarningMessage(
			`${missingFileLines.length} selected files do not exist. Create them?`,
			"Yes", "No"
		);
		if (result === "Yes") {
			for (const mfl of missingFileLines) {
				await handleMissingFileCreation(mfl, workspaceRoot);
				if (fs.existsSync(mfl.resolvedPath)) {
					pathsToOpen.add(mfl.resolvedPath);
				}
			}
			fileStatsCache.clear();
		}
	}

	if (pathsToOpen.size === 0) {
		vscode.window.showInformationMessage("No valid files to open in selection.");
		return;
	}

	if (preserveFocus) {
		const qpItems = Array.from(pathsToOpen).map(p => {
			const isOpen = openFilePaths.has(p);
			const rel = path.relative(workspaceRoot, p).replace(/\\/g, '/');
			return {
				label: path.basename(p),
				description: (isOpen ? "$(circle-filled) [Open] " : "$(circle-outline) [Closed] ") + rel,
				resolvedPath: p,
				picked: true
			};
		});

		const selectedToOpen = await vscode.window.showQuickPick(qpItems, {
			placeHolder: "Select files to open from selection:",
			canPickMany: true
		});

		if (selectedToOpen && selectedToOpen.length > 0) {
			const openedDocs: vscode.TextDocument[] = [];
			for (const item of selectedToOpen) {
				try {
					const doc = await vscode.workspace.openTextDocument(item.resolvedPath);
					await vscode.window.showTextDocument(doc, { preserveFocus: true, preview: false });
					openedDocs.push(doc);
				} catch (e) { }
			}
			vscode.window.showInformationMessage(`Opened ${openedDocs.length} file(s) from selection.`);
		}
	} else {
		const currentOpen = new Set<string>();
		for (const group of vscode.window.tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputText) {
					currentOpen.add(tab.input.uri.fsPath);
				}
			}
		}

		const sortedPaths = Array.from(pathsToOpen).sort((a, b) => {
			const aOpen = currentOpen.has(a) ? 0 : 1;
			const bOpen = currentOpen.has(b) ? 0 : 1;
			if (aOpen !== bOpen) { return aOpen - bOpen; }
			return path.basename(a).localeCompare(path.basename(b));
		});

		const qpItems = sortedPaths.map(p => {
			const isOpen = currentOpen.has(p);
			const rel = path.relative(workspaceRoot, p).replace(/\\/g, '/');
			return {
				label: path.basename(p),
				description: (isOpen ? "$(circle-filled) [Open] " : "$(circle-outline) [Closed] ") + rel,
				resolvedPath: p
			};
		});

		const choice = await vscode.window.showQuickPick(qpItems, {
			placeHolder: "Select which file from selection to activate:"
		});

		if (choice) {
			try {
				const doc = await vscode.workspace.openTextDocument(choice.resolvedPath);
				await vscode.window.showTextDocument(doc, { preserveFocus: false, preview: false });
			} catch (e) { }
		}
	}
}
//#endregion _commands8

//#region _commands9
async function closeFileCommand() {
	const idxEditor = vscode.window.activeTextEditor;
	if (!idxEditor) { return; }

	const document = idxEditor.document;
	const cursorLine = idxEditor.selection.active.line;

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) { return; }
	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	const fileLines = await parseIdxMarkdown(document.getText(), workspaceRoot, new Set());

	const selectedLines = getSelectedLines(idxEditor);
	const selectedFileLines = getFileLinesInSelection(document, fileLines, selectedLines);

	if (selectedFileLines.length === 0) {
		let fallbackFileLine: FileLine | undefined = undefined;
		for (let l = cursorLine; l >= 0; l--) {
			const found = fileLines.find(fl => { return fl.lineIndex === l; });
			if (found) {
				fallbackFileLine = found;
				break;
			}
		}
		if (!fallbackFileLine) {
			vscode.window.showInformationMessage("No file path found on the current line.");
			return;
		}
		selectedFileLines.push(fallbackFileLine);
	}

	const pathsToClose = new Set<string>();
	for (const fl of selectedFileLines) {
		if (fl.isFolder) { continue; }

		if (fl.filepath.includes('*')) {
			const eligibleExts = getEligibleExtensions();
			const allWorkspaceFiles = await getAllWorkspaceFiles(workspaceRoot);
			const { matchedPaths } = await resolveFileSpec(
				fl.filepath,
				fl.indentation,
				[],
				workspaceRoot,
				allWorkspaceFiles,
				eligibleExts
			);
			for (const p of matchedPaths) {
				pathsToClose.add(p);
			}
		} else if (fl.isMultiMatch && fl.resolvedPaths) {
			for (const p of fl.resolvedPaths) {
				pathsToClose.add(p);
			}
		} else if (fl.exists) {
			pathsToClose.add(fl.resolvedPath);
		}
	}

	if (pathsToClose.size === 0) {
		vscode.window.showInformationMessage("No active files match selection to close.");
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
		vscode.window.showInformationMessage(`Closed open file(s) matching selection.`);
	} else {
		vscode.window.showInformationMessage(`No matching files were currently open.`);
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
//#endregion _commands9

//#region _commands10
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
//#endregion _commands10

//#region _commands11
async function toggleCheckboxCommand() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) { return; }

	const document = editor.document;
	const selectedLines = getSelectedLines(editor);

	// Find all selected lines that contain a checkbox
	const checkboxLines: { line: number; match: RegExpMatchArray; index: number }[] = [];
	for (const line of selectedLines) {
		const text = document.lineAt(line).text;
		const match = text.match(/\[([ xX])\]/);
		if (match) {
			const idx = text.indexOf(`[${match[1]}]`);
			if (idx !== -1) {
				checkboxLines.push({ line, match, index: idx });
			}
		}
	}

	if (checkboxLines.length === 0) {
		vscode.window.showInformationMessage("No checkboxes found on selected line(s).");
		return;
	}

	// Determine the next state based on the first checkbox
	const firstChar = checkboxLines[0].match[1];
	let newChar = 'x';
	if (firstChar === 'X') {
		newChar = ' ';
	} else if (firstChar === ' ') {
		newChar = 'x';
	} else if (firstChar === 'x') {
		newChar = 'X';
	}

	const edit = new vscode.WorkspaceEdit();
	for (const item of checkboxLines) {
		const range = new vscode.Range(
			new vscode.Position(item.line, item.index + 1),
			new vscode.Position(item.line, item.index + 2)
		);
		edit.replace(document.uri, range, newChar);
	}
	await vscode.workspace.applyEdit(edit);
}

async function checkboxerCommand() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const document = editor.document;
	const selectedLines = getSelectedLines(editor);

	// Gather all selected markdown lines (bulleted, headers, or plain)
	interface BulletLine {
		line: number;
		indent: string;
		bullet: string;
		hasCheckbox: boolean;
		checkboxChar: string;
		label: string;
		coreText: string;
	}

	const bulletLines: BulletLine[] = [];
	for (const line of selectedLines) {
		const lineText = document.lineAt(line).text;
		const match = lineText.match(/^(\s*)([-*+]\s+|\#+\s+|[0-9]+\.\s+)?(.*)$/);
		if (match) {
			const indent = match[1];
			const bullet = match[2] || "";
			const rest = match[3];

			let hasCheckbox = false;
			let checkboxChar = "";
			let label = "";
			let coreText = rest;

			const cbMatch = rest.match(/^\[([ xX])\]\s*/);
			if (cbMatch) {
				hasCheckbox = true;
				checkboxChar = cbMatch[1];
				const afterCb = rest.substring(cbMatch[0].length);
				const labelMatch = afterCb.match(/^([a-zA-Z]+):\s*/);
				if (labelMatch) {
					label = labelMatch[1];
					coreText = afterCb.substring(labelMatch[0].length);
				} else {
					coreText = afterCb;
				}
			} else {
				const labelMatch = rest.match(/^([a-zA-Z]+):\s*/);
				if (labelMatch) {
					label = labelMatch[1];
					coreText = rest.substring(labelMatch[0].length);
				}
			}

			bulletLines.push({
				line,
				indent,
				bullet,
				hasCheckbox,
				checkboxChar,
				label,
				coreText
			});
		}
	}

	if (bulletLines.length === 0) {
		vscode.window.showInformationMessage("No valid markdown lines found in selected line(s).");
		return;
	}

	// Compute next state based on the first line
	const first = bulletLines[0];
	const tags = ["", "NEW", "OK", "FIXED", "FAIL", "BUG", "DONE"];
	const currentTag = first.label;
	let nextTag = "NEW";
	const currentIdx = tags.indexOf(currentTag);
	if (currentIdx !== -1) {
		nextTag = tags[(currentIdx + 1) % tags.length];
	}

	const edit = new vscode.WorkspaceEdit();
	for (const item of bulletLines) {
		let replacement = item.coreText;
		if (item.hasCheckbox) {
			const cbStr = `[${item.checkboxChar}] `;
			if (nextTag !== '') {
				replacement = `${cbStr}${nextTag}: ${item.coreText}`;
			} else {
				replacement = `${cbStr}${item.coreText}`;
			}
		} else {
			if (nextTag !== '') {
				replacement = `${nextTag}: ${item.coreText}`;
			}
		}

		const finalLineText = `${item.indent}${item.bullet}${replacement}`;
		const lineText = document.lineAt(item.line).text;
		const lineRange = new vscode.Range(
			new vscode.Position(item.line, 0),
			new vscode.Position(item.line, lineText.length)
		);
		edit.replace(document.uri, lineRange, finalLineText);
	}

	await vscode.workspace.applyEdit(edit);
}

async function checkboxTagCommand() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const document = editor.document;
	const selectedLines = getSelectedLines(editor);

	interface BulletLine {
		line: number;
		indent: string;
		bullet: string;
		hasCheckbox: boolean;
		checkboxChar: string;
		label: string;
		coreText: string;
	}

	const bulletLines: BulletLine[] = [];
	for (const line of selectedLines) {
		const lineText = document.lineAt(line).text;
		const match = lineText.match(/^(\s*)([-*+]\s+|\#+\s+|[0-9]+\.\s+)?(.*)$/);
		if (match) {
			const indent = match[1];
			const bullet = match[2] || "";
			const rest = match[3];

			let hasCheckbox = false;
			let checkboxChar = "";
			let label = "";
			let coreText = rest;

			const cbMatch = rest.match(/^\[([ xX])\]\s*/);
			if (cbMatch) {
				hasCheckbox = true;
				checkboxChar = cbMatch[1];
				const afterCb = rest.substring(cbMatch[0].length);
				const labelMatch = afterCb.match(/^([a-zA-Z]+):\s*/);
				if (labelMatch) {
					label = labelMatch[1];
					coreText = afterCb.substring(labelMatch[0].length);
				} else {
					coreText = afterCb;
				}
			} else {
				const labelMatch = rest.match(/^([a-zA-Z]+):\s*/);
				if (labelMatch) {
					label = labelMatch[1];
					coreText = rest.substring(labelMatch[0].length);
				}
			}

			bulletLines.push({
				line,
				indent,
				bullet,
				hasCheckbox,
				checkboxChar,
				label,
				coreText
			});
		}
	}

	if (bulletLines.length === 0) {
		vscode.window.showInformationMessage("No valid markdown lines found in selected line(s).");
		return;
	}

	const tags = ["{none}", "NEW", "OK", "FIXED", "FAIL", "BUG", "DONE"];
	const selection = await vscode.window.showQuickPick(tags, {
		placeHolder: "Select tag to apply"
	});

	if (selection === undefined) {
		return;
	}

	const nextTag = selection === "{none}" ? "" : selection;

	const edit = new vscode.WorkspaceEdit();
	for (const item of bulletLines) {
		let replacement = item.coreText;
		if (item.hasCheckbox) {
			const cbStr = `[${item.checkboxChar}] `;
			if (nextTag !== '') {
				replacement = `${cbStr}${nextTag}: ${item.coreText}`;
			} else {
				replacement = `${cbStr}${item.coreText}`;
			}
		} else {
			if (nextTag !== '') {
				replacement = `${nextTag}: ${item.coreText}`;
			}
		}

		const finalLineText = `${item.indent}${item.bullet}${replacement}`;
		const lineText = document.lineAt(item.line).text;
		const lineRange = new vscode.Range(
			new vscode.Position(item.line, 0),
			new vscode.Position(item.line, lineText.length)
		);
		edit.replace(document.uri, lineRange, finalLineText);
	}

	await vscode.workspace.applyEdit(edit);
}

function isCommandApplicable(command: string, editor: vscode.TextEditor | undefined, hasFileLine: boolean, isIdxActive: boolean): boolean {
	switch (command) {
		case "idx.openIdx":
		case "idx.returnToIdx":
		case "idx.returnToIdxPicker":
			return !isIdxActive;
		case "idx.update":
		case "idx.jumpAny":
		case "idx.jumpWithin":
		case "idx.copyProjectUnlisted":
		case "idx.copyProjectUnlistedPicker":
			return isIdxActive;
		case "idx.gotoFile":
		case "idx.closeFile":
			const hasSel = editor ? !editor.selection.isEmpty : false;
			return hasFileLine || (isIdxActive && hasSel);
		case "idx.openFile":
			const hasSel2 = editor ? !editor.selection.isEmpty : false;
			return isIdxActive && hasSel2;
		default:
			// All other commands are always applicable
			return true;
	}
}
//#endregion _commands11

//#region _commands12
async function pickCommandCommand() {
	const editor = vscode.window.activeTextEditor;
	let isIdxActive = false;
	let hasFileLine = false;

	if (editor) {
		const doc = editor.document;
		const config = vscode.workspace.getConfiguration("idx");
		const idxFilename = config.get<string>("indexFilename", "idx.md");
		if (path.basename(doc.uri.fsPath) === idxFilename) {
			isIdxActive = true;
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders) {
				const workspaceRoot = workspaceFolders[0].uri.fsPath;
				const fileLines = await getOrUpdateActiveFileLines(editor, workspaceRoot);
				const cursorLine = editor.selection.active.line;
				hasFileLine = fileLines.some(fl => fl.lineIndex === cursorLine);
			}
		}
	}

	const Cmc_ = CommandMetadataContainer;
	const allCmds = Object.keys(Cmc_.descriptions);

	const applicable: vscode.QuickPickItem[] = [];
	const nonApplicable: vscode.QuickPickItem[] = [];

	for (const cmd of allCmds) {
		if (cmd === "idx.pickCommand") {
			continue;
		}
		const desc = Cmc_.descriptions[cmd] || cmd;
		const item: vscode.QuickPickItem = {
			label: desc,
			detail: cmd
		};
		if (isCommandApplicable(cmd, editor, hasFileLine, isIdxActive)) {
			applicable.push(item);
		} else {
			nonApplicable.push(item);
		}
	}

	const quickPickItems: vscode.QuickPickItem[] = [];
	if (applicable.length > 0) {
		quickPickItems.push({
			label: "Applicable Commands",
			kind: vscode.QuickPickItemKind.Separator
		});
		quickPickItems.push(...applicable);
	}
	if (nonApplicable.length > 0) {
		quickPickItems.push({
			label: "Non-Applicable Commands",
			kind: vscode.QuickPickItemKind.Separator
		});
		quickPickItems.push(...nonApplicable);
	}

	const selected = await vscode.window.showQuickPick(quickPickItems, {
		placeHolder: "Select an IDX command to execute"
	});

	if (selected && selected.detail) {
		await vscode.commands.executeCommand(selected.detail);
	}
}

async function copyKeybindingsCommand() {
	const headers = ["Keys", "Command Name", "Command Description", "When"];
	const Cmc_ = CommandMetadataContainer;
	const rows = Object.keys(Cmc_.descriptions).map(cmd => {
		const kb = defaultKeybindings.find(k => k.command === cmd);
		const key = kb ? (kb.key || "(none)") : "(none)";
		const desc = Cmc_.descriptions[cmd] || "";
		const when = kb ? (kb.when || "always") : "always";
		return [key, cmd, desc, when];
	});

	const colWidths = headers.map((h, i) => { return Math.max(h.length, ...rows.map(r => { return r[i].length; })); });

	const pad = (str: string, width: number) => {
		return str + " ".repeat(Math.max(0, width - str.length));
	};

	const headerRow = "| " + headers.map((h, i) => { return pad(h, colWidths[i]); }).join(" | ") + " |";
	const dividerRow = "| " + headers.map((_, i) => { return "-".repeat(colWidths[i]); }).join(" | ") + " |";
	const dataRows = rows.map(r => { return "| " + r.map((cell, i) => { return pad(cell, colWidths[i]); }).join(" | ") + " |"; });

	const tableText = [headerRow, dividerRow, ...dataRows].join('\n');

	await vscode.env.clipboard.writeText(tableText);
	vscode.window.showInformationMessage("Copied IDX commands list as a formatted table to clipboard.");
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

function ensureDefaultKeybindings() {
	try {
		const userDir = getVSCodeUserDir();
		const keybindingsFile = path.join(userDir, 'keybindings.json');
		let currentCustomKeys: any[] = [];
		let fileExists = fs.existsSync(keybindingsFile);
		if (fileExists) {
			const content = fs.readFileSync(keybindingsFile, 'utf8');
			currentCustomKeys = parseJSONSafely(content);
			if (!Array.isArray(currentCustomKeys)) {
				currentCustomKeys = [];
			}
		}

		let modified = false;
		for (const defaultKb of defaultKeybindings) {
			if (defaultKb.key === "") { continue; }
			const hasCmd = currentCustomKeys.some(ck => { return ck.command === defaultKb.command; });
			if (!hasCmd) {
				currentCustomKeys.push(defaultKb);
				modified = true;
			}
		}

		if (modified || !fileExists) {
			if (!fs.existsSync(userDir)) {
				fs.mkdirSync(userDir, { recursive: true });
			}
			fs.writeFileSync(keybindingsFile, JSON.stringify(currentCustomKeys, null, '\t'), 'utf8');
		}
	} catch (e) {
		// Silent fallback
	}
}
//#endregion _commands12

//#region _commands13
async function setKeybindingsCommand() {
	const userDir = getVSCodeUserDir();
	const keybindingsFile = path.join(userDir, 'keybindings.json');

	let currentCustomKeys: any[] = [];
	if (fs.existsSync(keybindingsFile)) {
		try {
			const content = fs.readFileSync(keybindingsFile, 'utf8');
			currentCustomKeys = parseJSONSafely(content);
			if (!Array.isArray(currentCustomKeys)) {
				currentCustomKeys = [];
			}
		} catch (e) {
			currentCustomKeys = [];
		}
	}

	const Cmc_ = CommandMetadataContainer;

	const sortedKeybindings = [...defaultKeybindings].sort((a, b) => {
		const whenA = a.when || "always";
		const whenB = b.when || "always";
		if (whenA !== whenB) {
			return whenA.localeCompare(whenB);
		}
		return a.command.localeCompare(b.command);
	});

	const qpItems: (vscode.QuickPickItem & { keybinding?: any })[] = [];
	let currentWhen: string | null = null;

	for (const kb of sortedKeybindings) {
		const whenStr = kb.when || "always";
		if (whenStr !== currentWhen) {
			currentWhen = whenStr;
			qpItems.push({
				label: currentWhen,
				kind: vscode.QuickPickItemKind.Separator
			});
		}

		const matches = currentCustomKeys.some(ck => { return ck.command === kb.command && ck.key === kb.key; });

		qpItems.push({
			label: kb.key || "(none)",
			description: Cmc_.descriptions[kb.command] || "",
			detail: kb.command,
			picked: matches,
			keybinding: kb
		} as any);
	}

	const selected = await vscode.window.showQuickPick(qpItems, {
		placeHolder: "Select keybindings to write to global User keybindings.json:",
		canPickMany: true,
		matchOnDescription: true,
		matchOnDetail: true
	});

	if (!selected) {
		return;
	}

	// Remove our commands that were NOT selected while leaving others untouched
	const otherKeybindings = currentCustomKeys.filter(ck => {
		if (!ck || !ck.command) {
			return false;
		}
		const cmd = ck.command;
		const isOurs = cmd.startsWith('idx.') || cmd.startsWith('-idx.');
		return !isOurs;
	});

	const keysToWrite = [
		...otherKeybindings,
		...selected.map(s => s.keybinding)
	];

	try {
		if (!fs.existsSync(userDir)) {
			fs.mkdirSync(userDir, { recursive: true });
		}
		fs.writeFileSync(keybindingsFile, JSON.stringify(keysToWrite, null, '\t'), 'utf8');
		vscode.window.showInformationMessage(`Updated custom global keybindings.json with selection.`);
	} catch (err: any) {
		vscode.window.showErrorMessage(`Failed to write keybindings.json: ${err.message}`);
	}
}

async function collectEditorsCommand() {
	const originalActiveEditor = vscode.window.activeTextEditor;
	const originalDocUri = originalActiveEditor?.document.uri;

	const openTabs: { tab: vscode.Tab; label: string; docUri: vscode.Uri }[] = [];
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputText) {
				openTabs.push({
					tab,
					label: tab.label,
					docUri: tab.input.uri
				});
			}
		}
	}

	if (openTabs.length === 0) {
		vscode.window.showInformationMessage("No open editors found.");
		return;
	}

	const qpItems = openTabs.map(ot => ({
		label: ot.label,
		description: ot.docUri.fsPath,
		tabInfo: ot
	}));

	const selectedItems = await vscode.window.showQuickPick(qpItems, {
		placeHolder: "Select editors to collect/move:",
		canPickMany: true
	});

	if (!selectedItems || selectedItems.length === 0) {
		return;
	}

	const targetGroupPickerItems: { label: string; viewColumn?: vscode.ViewColumn; isNew: boolean }[] = [];

	const groups = vscode.window.tabGroups.all;
	const activeGroup = vscode.window.tabGroups.activeTabGroup;
	const activeGroupIdx = groups.indexOf(activeGroup);
	if (activeGroupIdx !== -1) {
		targetGroupPickerItems.push({
			label: `Active Group ${activeGroupIdx + 1}`,
			viewColumn: activeGroup.viewColumn,
			isNew: false
		});
	}
	groups.forEach((g, idx) => {
		if (g !== activeGroup) {
			targetGroupPickerItems.push({
				label: `Move to Group ${idx + 1}`,
				viewColumn: g.viewColumn,
				isNew: false
			});
		}
	});

	targetGroupPickerItems.push({
		label: "Move to New Group",
		isNew: true
	});

	const groupChoice = await vscode.window.showQuickPick(targetGroupPickerItems, {
		placeHolder: "Select target group:"
	});

	if (!groupChoice) {
		return;
	}

	let targetColumn: vscode.ViewColumn | undefined;
	let useCommand: string | undefined;

	if (groupChoice.isNew) {
		const directionChoice = await vscode.window.showQuickPick([
			{ label: "Above", cmd: "workbench.action.moveEditorToAboveGroup" },
			{ label: "Below", cmd: "workbench.action.moveEditorToBelowGroup" },
			{ label: "Right", cmd: "workbench.action.moveEditorToRightGroup" },
			{ label: "Left", cmd: "workbench.action.moveEditorToLeftGroup" },
			{ label: "New Window", cmd: "workbench.action.moveEditorToNewWindow" }
		], {
			placeHolder: "Select direction/window for the new group:"
		});

		if (!directionChoice) {
			return;
		}
		useCommand = directionChoice.cmd;
	} else {
		targetColumn = groupChoice.viewColumn || vscode.ViewColumn.One;
	}

	if (useCommand) {
		const firstItem = selectedItems[0].tabInfo;
		try {
			const doc = await vscode.workspace.openTextDocument(firstItem.docUri);
			await vscode.window.showTextDocument(doc, { viewColumn: firstItem.tab.group.viewColumn, preserveFocus: false });
			await vscode.commands.executeCommand(useCommand);

			const newActiveGroup = vscode.window.tabGroups.activeTabGroup;
			const targetCol = newActiveGroup.viewColumn;

			for (let i = 1; i < selectedItems.length; i++) {
				const ot = selectedItems[i].tabInfo;
				try {
					const remDoc = await vscode.workspace.openTextDocument(ot.docUri);
					await vscode.window.tabGroups.close(ot.tab);
					await vscode.window.showTextDocument(remDoc, {
						viewColumn: targetCol,
						preserveFocus: true
					});
				} catch (e) { }
			}
		} catch (e) { }
	} else {
		for (const item of selectedItems) {
			const ot = item.tabInfo;
			try {
				if (ot.tab.group.viewColumn !== targetColumn) {
					const doc = await vscode.workspace.openTextDocument(ot.docUri);
					await vscode.window.tabGroups.close(ot.tab);
					await vscode.window.showTextDocument(doc, {
						viewColumn: targetColumn,
						preserveFocus: true
					});
				}
			} catch (e) { }
		}
	}

	if (originalDocUri) {
		try {
			const doc = await vscode.workspace.openTextDocument(originalDocUri);
			await vscode.window.showTextDocument(doc, { preserveFocus: false });
		} catch (e) { }
	}

	vscode.window.showInformationMessage(`Moved ${selectedItems.length} editor(s) to selected group.`);
}

interface CloseQuickPickItem extends vscode.QuickPickItem {
	action: 'all' | 'group';
	group?: vscode.TabGroup;
}
//#endregion _commands13

//#region _commands14
async function closeAllMarkdownEditorsCommand() {
	const config = vscode.workspace.getConfiguration("idx");
	const idxFilename = config.get<string>("indexFilename", "idx.md");

	const tabGroups = vscode.window.tabGroups;
	const activeGroup = tabGroups.activeTabGroup;

	let totalMarkdownCount = 0;
	const groupCounts = new Map<vscode.TabGroup, number>();

	for (const group of tabGroups.all) {
		let count = 0;
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputText) {
				const fsPath = tab.input.uri.fsPath;
				const basename = path.basename(fsPath);
				if (basename !== idxFilename && (basename.endsWith('.md') || basename.endsWith('.markdown'))) {
					count++;
				}
			}
		}
		groupCounts.set(group, count);
		totalMarkdownCount += count;
	}

	if (totalMarkdownCount === 0) {
		vscode.window.showInformationMessage("No open markdown editors found.");
		return;
	}

	const qpItems: CloseQuickPickItem[] = [];

	qpItems.push({
		label: `close all ${totalMarkdownCount}`,
		description: "All groups",
		action: 'all'
	});

	const activeGroupCount = groupCounts.get(activeGroup) || 0;

	qpItems.push({
		label: `close this group ${activeGroupCount}`,
		description: "[focused]",
		action: 'group',
		group: activeGroup
	});

	tabGroups.all.forEach((g, idx) => {
		const count = groupCounts.get(g) || 0;
		qpItems.push({
			label: `close group ${idx + 1} ${count}`,
			description: g === activeGroup ? "focused" : "",
			action: 'group',
			group: g
		});
	});

	const choice = await vscode.window.showQuickPick(qpItems, {
		placeHolder: "Select markdown editors to close:"
	});

	if (!choice) {
		return;
	}

	let closedCount = 0;
	if (choice.action === 'all') {
		for (const group of tabGroups.all) {
			for (const tab of group.tabs) {
				if (tab.input instanceof vscode.TabInputText) {
					const fsPath = tab.input.uri.fsPath;
					const basename = path.basename(fsPath);
					if (basename !== idxFilename && (basename.endsWith('.md') || basename.endsWith('.markdown'))) {
						try {
							await tabGroups.close(tab);
							closedCount++;
						} catch (e) { }
					}
				}
			}
		}
		vscode.window.showInformationMessage(`Closed ${closedCount} markdown editor(s) across all groups.`);
	} else if (choice.action === 'group' && choice.group) {
		for (const tab of choice.group.tabs) {
			if (tab.input instanceof vscode.TabInputText) {
				const fsPath = tab.input.uri.fsPath;
				const basename = path.basename(fsPath);
				if (basename !== idxFilename && (basename.endsWith('.md') || basename.endsWith('.markdown'))) {
					try {
						await tabGroups.close(tab);
						closedCount++;
					} catch (e) { }
				}
			}
		}
		const groupIndex = tabGroups.all.indexOf(choice.group);
		vscode.window.showInformationMessage(`Closed ${closedCount} markdown editor(s) in Group ${groupIndex + 1}.`);
	}
}

async function removeSelectedCheckboxesCommand() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const document = editor.document;
	const selections = editor.selections;

	const edit = new vscode.WorkspaceEdit();
	let matchedCount = 0;

	for (const sel of selections) {
		for (let lineIdx = sel.start.line; lineIdx <= sel.end.line; lineIdx++) {
			const lineText = document.lineAt(lineIdx).text;
			const match = lineText.match(/^(\s*)([-*+]|\#+|[0-9]+\.)?\s*\[([ xX])\]\s*(.*)$/);
			if (match) {
				const indent = match[1];
				const prefix = match[2];
				const rest = match[4];

				let replacement = "";
				if (prefix) {
					replacement = `${indent}${prefix} ${rest}`;
				} else {
					replacement = `${indent}${rest}`;
				}

				const range = new vscode.Range(
					new vscode.Position(lineIdx, 0),
					new vscode.Position(lineIdx, lineText.length)
				);
				edit.replace(document.uri, range, replacement);
				matchedCount++;
			}
		}
	}

	if (matchedCount > 0) {
		await vscode.workspace.applyEdit(edit);
		vscode.window.showInformationMessage(`Removed ${matchedCount} checkbox(es).`);
	} else {
		vscode.window.showInformationMessage("No checkboxes found in current selection.");
	}
}

async function addSelectedCheckboxesCommand() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const choice = await vscode.window.showQuickPick([
		"☐ Unchecked [ ]",
		"☑ Checked lower [x]",
		"☑ Checked upper [X]"
	], {
		placeHolder: "Select checkbox starting style to add:"
	});
	if (!choice) {
		return;
	}

	let checkboxStr = "[ ] ";
	if (choice.includes("[x]")) {
		checkboxStr = "[x] ";
	} else if (choice.includes("[X]")) {
		checkboxStr = "[X] ";
	}

	const document = editor.document;
	const selections = editor.selections;

	const edit = new vscode.WorkspaceEdit();
	let addedCount = 0;

	for (const sel of selections) {
		for (let lineIdx = sel.start.line; lineIdx <= sel.end.line; lineIdx++) {
			const lineText = document.lineAt(lineIdx).text;
			if (/\[([ xX])\]/.test(lineText)) {
				continue;
			}

			const match = lineText.match(/^(\s*)([-*+]|\#+|[0-9]+\.)?\s*(.*)$/);
			if (match) {
				const indent = match[1];
				const prefix = match[2];
				const rest = match[3];

				let replacement = "";
				if (prefix) {
					replacement = `${indent}${prefix} ${checkboxStr}${rest}`;
				} else {
					replacement = `${indent}${checkboxStr}${rest}`;
				}

				const range = new vscode.Range(
					new vscode.Position(lineIdx, 0),
					new vscode.Position(lineIdx, lineText.length)
				);
				edit.replace(document.uri, range, replacement);
				addedCount++;
			}
		}
	}

	if (addedCount > 0) {
		await vscode.workspace.applyEdit(edit);
		vscode.window.showInformationMessage(`Added ${addedCount} checkbox(es) to selection.`);
	} else {
		vscode.window.showInformationMessage("All lines in selection already have checkboxes.");
	}
}
//#endregion _commands14
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
			updateAllVisibleDecorationsInstantly(manager);
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
		updateAllVisibleDecorationsInstantly(manager);
	}));

	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(() => {
		updateAllVisibleDecorationsInstantly(manager);
	}));

	const interval = setInterval(() => {
		updateAllVisibleDecorations(manager);
	}, 5000);

	return interval;
}
async function configureMarkdownFoldingSettings() {
	// Access the targeted "[markdown]" configuration block
	const config = vscode.workspace.getConfiguration('[markdown]');

	// Target Global (User) settings. Use false if you only want to change it for the current workspace.
	const targetConfiguration = vscode.ConfigurationTarget.Global;

	try {
		// Update each configuration property sequentially
		await config.update('editor.folding', true, targetConfiguration);
		await config.update('editor.foldingStrategy', 'provider', targetConfiguration);
		await config.update('editor.showFoldingControls', 'mouseover', targetConfiguration);
	} catch (error) {
		console.error('Failed to automatically write markdown folding settings:', error);
	}
}
function commandsSetup(context: vscode.ExtensionContext) {
	registerNewCheckboxLineCommand(context);
	registerCheckboxTagJumpCommand(context);
	registerNewFilespecCommand(context);
	registerFileMentionsCommand(context);
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

	context.subscriptions.push(vscode.commands.registerCommand('idx.setKeybindings', async () => {
		await setKeybindingsCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.collectEditors', async () => {
		await collectEditorsCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.closeAllMarkdownEditors', async () => {
		await closeAllMarkdownEditorsCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.checkboxer', async () => {
		await checkboxerCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.copyKeybindings', async () => {
		await copyKeybindingsCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.checkboxTag', async () => {
		await checkboxTagCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.pickCommand', async () => {
		await pickCommandCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.removeSelectedCheckboxes', async () => {
		await removeSelectedCheckboxesCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('idx.addSelectedCheckboxes', async () => {
		await addSelectedCheckboxesCommand();
	}));
}
//#endregion _setups

//#region _activate
export function activate(context: vscode.ExtensionContext) {
	ensureDefaultKeybindings();
	const manager = new GutterDecorationManager();
	const interval = watchSetup(context, manager);

	configureMarkdownFoldingSettings();
	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider(
			{ language: 'markdown', scheme: 'file' },
			new AdvancedMarkdownFoldingProvider()
		)
	);

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
