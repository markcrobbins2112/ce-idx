<!-- markdownlint-disable MD013 -->
# IDX: Extension Specifications & Implementation Details

Back to [README](README.md)

This document compiles the user requirements and instructions from `AGENTS.md` and provides detailed documentation of how the extension was architected and built.

---

## 📋 Originally Requested Specifications

### 1. Application & Identification
- **Name**: `idx` (Incredibly Desirable Experience)
- **Title**: Incredibly Desirable Experience
- **Description**: Use Markdown as a file explorer.
- **Author/Publisher**: `markrobbins`
- **Settings Hook**:
  - Index Filename: `idx.indexFilename` setting (default: `idx.md`)

### 2. Format Specification
- Inside the Markdown index file (e.g., `idx.md`), certain lines are scanned as **"filelines"**:
  - **Syntax**: `{optional: tabs/spaces/icons/checkboxes/prefix} {filepath} {optional: other text/suffix}`
  - Below a `fileline`, there may be indented child elements (which can be any notes or nested `filelines`).
  - A `filepath` may represent a file or folder:
    - May be absolute or relative to the workspace root.
    - May be relative to a parent fileline folder (evaluated based on the hierarchy of list indentation).

- examples in `idx.md` ...
```markdown
<!-- these are examples of a fileline -->
./filename <!-- relative filepath -->
C:/filename <!-- absolute filepath -->
random text ./filename random text
- [ ] {random text} ./filename {random text}
	{ random child text}
```

### 3. Dynamic UI Gutter Indicators
While editing `idx.md`, gutter icons appear next to filelines on a reasonable schedule:
- 🔵 **Blue circle**: The specified file or folder does not exist.
- ⚪ **Gray outline/circle**: The file or folder exists offline but is closed.
- 🟢 **Green circle**: The file or folder exists AND is currently open/visible in active VS Code tabs.

### 4. Custom Command Palette Rules
- `idx.openIdx`: Focuses the active index file or requests/creates the default configuration if absent.
- `idx.update`: Synchronizes file changes inside the workspace:
  - Appends newly discovered project files under `## New Files`.
  - Shifts files that no longer exist to `## Missing Files`.
- `idx.gotoFile`: Focuses or opens the file/folder under the cursor or the closest parent folder.
  - If pointing to a folder, triggers a QuickPick with:
    - `📁 Select folder in file explorer` (first item).
    - Open files (prefixed with 🟢, grouped under "Open Files").
    - Remaining closed files (prefixed with ⚪, grouped under "Closed Files").
    - Displays detail parameters including occurrence counts and checkbox task accomplishments.
- `idx.returnToIdx`: When working in other source files, highlights/focuses the corresponding path in `idx.md`.
Appends files under `## New Files` if they aren't already listed.
- `idx.returnToIdxPicker`: Returns to the index file targeting a chosen line using a dropdown representation of all available filelines.
- `idx.jumpAny`: A global search dropdown of all project files categorized as open (🟢) or closed (⚪) with dynamic occurrence counts and checkbox progress metrics.
- `idx.jumpWithin`: Quick-jump search through all indexed filelines grouped by parent headings.
- `idx.copyProjectUnlisted`: Copies unlisted workspace files directly to the clipboard formatted as markdown checkmarks.
- `idx.copyProjectUnlistedPicker`: Multi-select dropdown to choose specific unlisted files to copy.

---

## 🛠️ Implementation Details (How We Built It)

We built the core logic using VS Code's rich API model with zero runtime dependencies (bundled with ultra-fast `esbuild` for speed and simplicity). Below is an architecture breakdown of each component.

### 1. Robust Markdown Fileline Parser (`parseIdxMarkdown`)
To enable nested directory parsing, absolute/relative resolution, and parent folder context, the file scanner processes each line sequentially:
- **Heading Scopes**: Tracks the active header (`#`, `##`, etc.) to group references under markdown headings. Heading changes clear the indentation stack.
- **Indentation Analysis**: Calculates the absolute indentation of each line (tabs count as `4` spaces).
A folder stack keeps track of current parent directories. Folder entries are pushed to the stack and popped once indentation retreats.
- **Path Detection & Resolution**:
  1. We split the text into tokens after stripping bullets (`-`, `*`) and markdown checkboxes (`[ ]`, `[x]`).
  2. For each token, we check absolute path existence or relative context under the closest active parent folder (from the hierarchy stack).
  3. If it exists or contains directory separators / filename suffixes, we tag it as the **target filepath**.
- **Checkbox Detection**: Detects checkboxes `[ ]` or `[x]` and extracts ranges so we can display live counts and status e.g., `☑ 1/2`.

```typescript
// Sample parsing signature:
interface FileLine {
  lineIndex: number;
  lineText: string;
  indentation: number;
  heading: string;
  filepath: string;
  resolvedPath: string;
  exists: boolean;
  isFolder: boolean;
  prefix: string;
  suffix: string;
  checkbox?: {
    checked: boolean;
    range: vscode.Range;
  };
}
```

### 2. High-Performance Gutter Decoration System
To avoid lag, UI decorations are executed via highly optimized timers and SVGs:
- **SVG Vector Generation**: Custom base64-encoded SVGs are loaded direct-to-memory to draw sharp, non-pixelated graphics without loading static assets:
  - **Blue Circle**: `fill="#3b82f6"`
  - **Gray Outline Circle**: `fill="none" stroke="#94a3b8" stroke-width="2"`
  - **Green Active Circle**: `fill="#22c55e"`
- **Active State Monitoring**: Gutter paintings are recalculated under debounce timers (`300ms`) responding to file modifications,
updates in tabs focus (`onDidChangeActiveTextEditor`), and background scheduling checks.

### 3. Integrated VS Code Commands
- **Dynamic QuickPick Menus**: VS Code's standard `QuickPick` components are customized with specific prefix indicators (🟢, ⚪, 📁),
groups/separators, and responsive focus event callbacks. For example:
  - In `idx.gotoFile`, as the user sweeps/focuses distinct files, the background editor dynamically reveals the file in previews (`preview: true`)
using `vscode.window.showTextDocument([...], { preserveFocus: true })`.
- **Clipboard Utility Support**: Built-in OS Clipboard bridges `vscode.env.clipboard.writeText()` allow seamless bulk copies of newly
added files formatted as task checkboxes (`- [ ] file.ts`).
- **Dynamic Updates**:
  - `idx.update` parses the active workspaces, excluding patterns like `node_modules`, `.git`, and boundaries defined in active lists, seamlessly appending elements to corresponding Markdown heading sections.

---

## 📦 Bundling and Environment

- **Build Pipeline**: Configured with `esbuild` (`build.js`) targets Node v16 for high efficiency and tiny bundle footprints.
- **Type Checking**: Standard `tsconfig.json` CommonJS compiler configurations targeting modern JavaScript guidelines with strict type check guarantees.
- **Directory Bootstrapper**: `makedirs.bat` enables rapid project bootstrap on local developer workspaces with clean folder layouts.

---

## 🎯 Implemented Technical Concerns & Optimization Features

During development, all five proposed suggestions and architecture concerns have been fully resolved and successfully integrated into our core product release:

### 1. In-Memory Stats Caching with Active FS Watcher (Zero Disk Overhead)
- **Design & Implementation**: Added an in-memory statistics cache (`fileStatsCache`) containing key-value listings of resolved paths to their respective existences and directory markers. Since calling synchronous disk checks inside editor keypress event-debounce cycles can block the extension host thread, `parseIdxMarkdown` reads entries directly from the cache.
- **FS Synchronization**: Configured a `vscode.workspace.createFileSystemWatcher('**/*')` hook. Whenever a file/folder is created, written/modified, or deleted on disk, the watcher instantly invalidates or removes the path's cache entry and triggers a gutter paint refresh, ensuring real-time UI accuracy without continuous disk lookup overhead.

### 2. Intelligent Candidate File Suffix Resolvers
- **Design & Implementation**: Refactored the path scanner to resolve extension-less tokens (e.g. `src/extension` or `main`). If a fileline lists a resource token without an extension, the system automatically builds and evaluates candidates against popular developer extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css`, `.html`, `.md`).
- **Resolution Priority**: Absolute, parent-relative, or workspace root candidates are matched in real-time. If a resource suffix matches a valid file on disk, it seamlessly links and acts as the target file. Absent indicators default to folders if they lack suffixes or terminate with standard slashes (`/` or `\`).

### 3. Quick Action Interactive Checkbox Toggler
- **Design & Implementation**: Implemented a core command `idx.toggleCheckbox`. To reduce checklist-editing friction, we created an `IdxCodeActionProvider` that binds to Markdown text files.
- **User Interaction**: When a user's cursor rests on any line containing checkboxes (e.g. `[ ]` or `[x]`), a standard VS Code Quick Action lightbulb appears. Selecting "Mark task as completed" (or "Mark task as incomplete") fires the toggle action to edit the target character range in a single step.

### 4. CodeAction "Auto-Genesis" Creator for Missing Filelines
- **Design & Implementation**: Integrated quick-fix decorators inside `IdxCodeActionProvider` for blue gutter circles (missing filelines).
- **User Interaction**: Hovering or positioning the text cursor over an uncreated file or directory line summons a Code Action: `📄 Create file: path` or `📁 Create directory: path`. Executing this action programmatically creates any parent directories recursively (`fs.mkdirSync` with `recursive: true`), creates the file/folder templates instantly on disk, clears the stats cache associated with the paths, registers the file as active, and focuses the edit tab automatically!

### 5. Highly Custom Configurable Directory Exclusion Lists
- **Design & Implementation**: Exposed a custom setting array `idx.excludePatterns` inside `package.json` with a rich default block featuring `node_modules`, `.git`, `.vscode`, `dist`, `.next`, `build`, and `out`.
- **Path Exclusions Check**: Integrated an active regex/split matching utility `isPathExcluded` and dynamic glob concatenator `getExcludeGlob()`. Standard command synchronization, unlisted clipboard actions, and search palettes dynamically ignore paths matching the configured exclusions, resulting in an eye-safe, clutter-free index environment optimized for custom developer layouts.

Back to [README](README.md)
Next  [MANUAL](MANUAL.md)