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
  - Exclude Patterns: `idx.excludePatterns` setting (default: ignores node_modules, .git, etc.)
  - Eligible Extensions List: `idx.eligibleExtensions` setting (default: `js,ts,md,txt,json,jsonc`)

### 2. Format Specification
- Inside the Markdown index file (e.g., `idx.md`), certain lines are scanned as **"filelines"**:
  - **Syntax**: `{optional: tabs/spaces/icons/checkboxes/prefix} {filepath} {optional: other text/suffix}`
  - Below a `fileline`, there may be indented child elements (which can be any notes or nested `filelines`).
  - A `filepath` may represent a file or folder:
    - May be absolute or relative to the workspace root.
    - May be relative to a parent fileline folder (evaluated based on the hierarchy of list indentation).

- Examples in `idx.md`:
```markdown
<!-- these are examples of a fileline -->
./filename <!-- relative filepath -->
C:/filename <!-- absolute filepath -->
random text ./filename random text
- [ ] {random text} ./filename {random text}
	{ random child text}
```

### 3. Dynamic UI Gutter Indicators
While editing `idx.md`, custom gutter icons appear next to filelines on a reasonable schedule:
- 🔵 **Blue circle**: The specified file or folder does not exist.
- ⚪ **Gray outline circle**: The file or folder exists offline but is closed.
- 🟢 **Green solid circle**: The file or folder exists AND is currently open/visible in active VS Code tabs.
- ▫️ **Gray outline square**: Multiple files match this ambiguous filename, and all are closed.
- ▪️ **Green solid square**: Multiple files match this ambiguous filename, and at least one is open in an active editor tab.

### 4. Custom Command Palette Rules & Contexts
We require two context flags for command availability:
- `idxFileActive`: True when the open editor is the configured `idx.md` index file.
- `idxCursorOnFileLine`: True when the cursor rests on a line holding a parsed fileline.

Commands:
- `idx.openIdx`: Focuses the active index file or requests/creates the default configuration if absent. (Available when `!idxFileActive`)
- `idx.update`: Synchronizes file changes inside the workspace, appending newly discovered project files under `## New Files` and shifting files that no longer exist to `## Missing Files`. (Available when `idxFileActive`)
- `idx.gotoFile`: Focuses or opens the file/folder under the cursor. (Available when `idxCursorOnFileLine`)
- `idx.openFile`: Same as `idx.gotoFile` but opens/reveals the file in background in preview mode without shifting focus away from `idx.md`. (Available when `idxCursorOnFileLine`)
- `idx.closeFile`: Closes the active tab(s) corresponding to the filespec on the current cursor line. (Available when `idxCursorOnFileLine`)
- `idx.returnToIdx`: When working in other source files, highlights/focuses the corresponding path in `idx.md` (or appends as checksum if missing). (Available when `!idxFileActive`)
- `idx.returnToIdxPicker`: Returns to the index file targeting a chosen line using a dropdown representation of all available filelines. (Available when `!idxFileActive`)
- `idx.jumpAny`: A global search dropdown of all project files categorized as open (🟢) or closed (⚪). (Available when `idxFileActive`)
- `idx.jumpWithin`: Quick-jump search through all indexed filelines grouped by parent headings. (Available when `idxFileActive`)
- `idx.copyProjectUnlisted`: Copies unlisted workspace files directly to the clipboard formatted as markdown checkmarks. (Available when `idxFileActive`)
- `idx.copyProjectUnlistedPicker`: Multi-select dropdown to choose specific unlisted files to copy. (Available when `idxFileActive`)
- `idx.toggleCheckbox`: Programmatically checks/unchecks checkbox on cursor line. (Available when `idxFileActive`)
- `idx.createMissing`: Launches creation flow for file or directory on cursor line. (Available when `idxCursorOnFileLine`)

---

## 🛠️ Implementation Details (How We Built It)

We built the core logic using VS Code's rich API model with zero runtime dependencies (bundled with ultra-fast `esbuild` for speed and simplicity). Below is an architecture breakdown of each component.

### 1. Robust Markdown Fileline Parser (`parseIdxMarkdown`)
To enable nested directory parsing, absolute/relative resolution, and parent folder context, the file scanner processes each line sequentially:
- **Heading Scopes**: Tracks the active header to group references under markdown headings. Heading changes clear the indentation stack.
- **Indentation Analysis**: Calculates the absolute indentation of each line (tabs count as `4` spaces). A folder stack keeps track of current parent directories. Folder entries are pushed to the stack and popped once indentation retreats.
- **Path Detection & Resolution**:
  1. We split the text into tokens after stripping bullets (`-`, `*`) and markdown checkboxes (`[ ]`, `[x]`).
  2. For each token, we check absolute path existence or relative context under the closest active parent folder (from the hierarchy stack). If it matches, we tag it as the target.
  3. If extension-less or using wildcard suffix (`.*`), we filter workspace files matching eligible extensions configured in `eligibleExtensions`.

### 2. High-Performance Gutter Decoration System
To avoid lag, UI decorations are executed via highly optimized timers and SVGs:
- **SVG Vector Generation**: Custom base64-encoded SVGs are loaded direct-to-memory to draw sharp, non-pixelated graphics without loading static assets:
  - **Blue Circle**: `fill="#3b82f6"`
  - **Gray Outline Circle**: `fill="none" stroke="#94a3b8" stroke-width="2"`
  - **Green Active Circle**: `fill="#22c55e"`
  - **Gray Outline Square**: `fill="none" stroke="#94a3b8" stroke-width="2" rx="1.5"` for closed multi-match.
  - **Green Active Square**: `fill="#22c55e" rx="1.5"` for open multi-match.
- **Active State Monitoring**: Gutter paintings are recalculated under debounce timers (`300ms`) responding to file modifications, updates in tabs focus (`onDidChangeActiveTextEditor`), and background scheduling checks.

### 3. Integrated VS Code Commands
- **Dynamic QuickPick Menus**: VS Code's standard `QuickPick` components are customized with specific prefix indicators (🟢, ⚪, 📁), groups/separators, and responsive focus event callbacks.
- **Clipboard Utility Support**: Built-in OS Clipboard bridges `vscode.env.clipboard.writeText()` allow seamless bulk copies of newly added files formatted as task checkboxes (`- [ ] file.ts`).

---

## 🎯 Implemented Technical Concerns & Optimization Features

During development, all proposed suggestions and architecture concerns have been fully resolved and successfully integrated into our core product release:

1. **In-Memory Stats Caching with Active FS Watcher (Zero Disk Overhead)**: Stats are cached in a local map to avoid thread blocking, refreshed selectively via a filesystem watcher.
2. **Intelligent Candidate File Suffix Resolvers**: Matches extensions dynamically based on alphabetical or configuration-preferred list.
3. **Quick Action Interactive Checkbox Toggler**: Simple lightbulb commands edits `[ ]` to `[x]` instantly.
4. **CodeAction "Auto-Genesis" Creator for Missing Filelines**: Programmatically recursive directory creations and empty file touch, with picker configurations if filespec is ambiguous or uses `.*`.
5. **Highly Custom Configurable Directory Exclusion Lists**: Central settings pattern that is respected strictly across all features.

Back to [README](README.md)
Next  [MANUAL](MANUAL.md)
