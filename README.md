<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable MD038 -->
# 🗺️ Incredibly Desirable Experience (IDX)

Welcome to the **Incredibly Desirable Experience (IDX)**!
![Logo](icon.jpg)

This extension transforms standard Markdown files (default: `idx.md`) into your workspace's active, high-performance interactive file explorer index. Rather than wrestling with a chaotic directory tree or crowded browser sidebars, you can write rich, organized workspace indexes incorporating tasks checklist, progress ratios, headings, and detailed annotations. IDX dynamically parses these file structures, overlays real-time state decorations, and registers keyboard-centric commands to speed up your development flow.

---

## ✨ Primary Features
- Also See [FEATURES](FEATURES.md)

### 🔵⚪🟢▫️▪️ 1. Active Gutter State Indicators
As you review your index markdown file (`idx.md`), **IDX** places colored vector decorations directly into the editor gutters:
- 🔵 **Blue circle**: The target file or directory is missing representation on your local disk.
- ⚪ **Gray outline**: The file or directory exists locally, but is closed.
- 🟢 **Green circle**: The file or directory exists and is open inside an active editor tab.
- ▫️ **Gray outline square**: Multiple files match this ambiguous filename, and all are closed.
- ▪️ **Green solid square**: Multiple files match this ambiguous filename, and at least one is open in an active editor tab.

### 📶 2. Hierarchical Context Parsers
- **Smart Nesting**: Spacing indentation defines layout roots. If you indent items under `src/`, child paths are parsed and searched relative to that folder.
- **Auto-Extension Resolvers**: If a fileline points to `src/index` without listing its file extensions, the system matches candidates (`.ts`, `.tsx`, `.js`, etc.) against disk files, allowing clutter-free names in your documents.
- **Eligible Extensions list**: Comma-separated list configuration `idx.eligibleExtensions` lets you dictate preferred order of candidate checks.

### ⚙️ 3. Quick Fix & Auto-Genesis Actions
- **Checkbox Toggler**: Press `Cmd + .` or `Ctrl + .` (or click the VS Code lightbulb) when focusing checkbox strings (`[ ]` or `[x]`) to instantly toggle their completion state.
- **Blue-dot Auto-Creation**: If an indexed path displays a blue dot (missing on disk), trigger the Quick Fix code action to recursively create the folder structures and touch the empty template instantly on your machine. If the path is ambiguous, you are prompted with a directory chooser QuickPick!

---

## 🕹️ Configured Commands Cheatsheet

| Command ID | Keybinding | When Context | Description |
| :--- | :--- | :--- | :--- |
| `idx.openIdx` | `` ` i `` | `!idxFileActive` | Opens your configured index, prompting to create one if none exist. |
| `idx.update` | `F5` | `idxFileActive` | Scans the workspace, appends new files under `## New Files`, and moves dead references to `## Missing Files`. |
| `idx.gotoFile` | `F2` | `idxCursorOnFileLine` | Navigates to file or folder under cursor (shifts focus). |
| `idx.openFile` | `Alt+F2` | `idxCursorOnFileLine` | Opens target file in preview mode in background without shifting focus. |
| `idx.closeFile` | `F4` | `idxCursorOnFileLine` | Instantly closes the open file tab corresponding to the cursor line. |
| `idx.returnToIdx` | `` ` r `` | `!idxFileActive` | Jumps from any active file back to its representation in `idx.md`. |
| `idx.returnToIdxPicker` | `` ` i `` | `!idxFileActive` | Jumps back to index targeting a chosen line using dropdown menu. |
| `idx.jumpAny` | `Alt+` ` i` | `idxFileActive` | Global fuzzy matcher for all workspace files grouped by open/closed status. |
| `idx.jumpWithin` | `Alt+` ` Alt+i` | `idxFileActive` | Quick-search indexed lines grouped by headers. |
| `idx.copyProjectUnlisted` | `Alt+i Ctrl+Insert` | `idxFileActive` | Copies all unlisted files as checklist checkboxes. |
| `idx.copyProjectUnlistedPicker` | `Alt+i Alt+Insert` | `idxFileActive` | Pick specific unlisted files via menu to copy. |
| `idx.toggleCheckbox` | `Insert X` | `idxFileActive` | Direct command shortcut to check/uncheck checkmarks. |
| `idx.createMissing` | - | `idxCursorOnFileLine` | Programmatically triggers generation flow for targets. |

---

## 🔧 Extensible Settings Configurations

Configure these options directly within your Global/Workspace VS Code settings:

```json
{
  "idx.indexFilename": "idx.md",
  "idx.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/.next/**",
    "**/build/**",
    "**/out/**",
    "**/.vscode/**"
  ],
  "idx.eligibleExtensions": "js,ts,md,txt,json,jsonc"
}
```

- **`idx.indexFilename`**: Defines which index name file gets treated as your central interface dashboard.
- **`idx.excludePatterns`**: Extends target exclusion lists to selectively ignore directories in searches and listings.
- **`idx.eligibleExtensions`**: Dictates checking order when matching extensionless or `.*` filepaths.

---

## 🧪 Documentation Guides

For in-depth explanations and checklists, read:
- **[FEATURES.md](./FEATURES.md)**: Explore interactive UX setups and descriptions.
- **[MANUAL.md](./MANUAL.md)**: Inspect backend caches, parsing steps, and bundle layouts.
- **[TESTING.md](./TESTING.md)**: Follow the automated QA checkboxes walkthrough tracker.
