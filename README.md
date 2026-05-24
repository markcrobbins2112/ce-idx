<!-- markdownlint-disable MD013 -->
# 🗺️ Incredibly Desirable Experience (IDX)


Welcome to the **Incredibly Desirable Experience (IDX)**!
![Logo](icon.jpg)

This extension transforms standard Markdown files (default: `idx.md`) into your workspace's active,
high-performance interactive file explorer index. Rather than wrestling with a chaotic directory tree or crowded browser sidebars, you can write rich,
organized workspace indexes incorporating tasks checklist, progress ratios, headings, and detailed annotations. IDX dynamically parses these file structures,
overlays real-time state decorations, and registers keyboard-centric commands to speed up your development flow.

---

## ✨ Primary Features
- Also See [FEATURES](FEATURES.md)

### 🔵⚪🟢 1. Active Gutter State Indicators
As you review your index markdown file (`idx.md`), **IDX** places colored vector decorations directly into the editor gutters:
- 🔵 **Blue circle**: The target file or directory is missing representation on your local disk.
- ⚪ **Gray outline**: The file or directory exists locally, but is closed.
- 🟢 **Green circle**: The file or directory exists and is open inside an active editor tab.

### 📶 2. Hierarchical Context Parsers
- **Smart Nesting**: Spacing indentation defines layout roots. If you indent items under `src/`, child paths are parsed and searched relative to that folder.
- **Auto-Extension Resolvers**: If a fileline points to `src/index` without listing its file extensions, the system matches
candidates (`.ts`, `.tsx`, `.js`, etc.) against disk files, allowing clutter-free names in your documents.

### ⚙️ 3. Quick Fix & Auto-Genesis Actions
- **Checkbox Toggler**: Press `Cmd + .` or `Ctrl + .` (or click the VS Code lightbulb) when focusing checkbox strings (`[ ]` or `[x]`)
to instantly toggle their completion state.
- **Blue-dot Auto-Creation**: If an indexed path displays a blue dot (missing on disk), trigger the Quick Fix code action to recursively create the folder
structures and touch the empty template instantly on your machine.

---

## 🕹️ Configured Commands Cheatsheet

| Command ID | Command Title & Description |
| :--- | :--- |
| `idx.openIdx`<br>&nbsp; | **IDX: Open/Edit Index File**<br>Opens your configured index, prompting to create one if none exist. |
| `idx.update`<br>&nbsp;<br>&nbsp; | **IDX: Update File Listings**<br>Scans the workspace, appends new files under `## New Files`, and moves dead references to `## Missing Files`. |
| `idx.gotoFile`<br>&nbsp;<br>&nbsp; | **IDX: Go to File/Folder under Cursor**<br>Launches files or directories. Folders prompt a customizable QuickPick splitting Open (🟢) & Closed (⚪) items. Supports instant focus previews dynamically! |
| `idx.returnToIdx`<br>&nbsp; | **IDX: Return to Index Location**<br>Jumps from any active file back to its primary representation inside `idx.md`. |
| `idx.returnToIdxPicker`<br>&nbsp; | **IDX: Return to Index Location via Picker**<br>Searches and navigates back to index lines through a clean folder picker. |
| `idx.jumpAny`<br>&nbsp;<br>&nbsp; | **IDX: Jump to Any File (List All)**<br>Global fuzzy matcher for files, highlighting checkboxes metrics (`☑ 1/3`) and recurrence counts. |
| `idx.jumpWithin`<br>&nbsp; | **IDX: Jump Within Index Listings**<br>Quick search index lines styled and grouped cleanly by headers. |
| `idx.copyProjectUnlisted`<br>&nbsp; | **IDX: Copy Project Unlisted Filelines to Clipboard**<br>Exports all unlisted files as markdown checkbox checklist items. |
| `idx.copyProjectUnlistedPicker`<br>&nbsp; | **IDX: Pick and Copy Project Unlisted Filelines**<br>Multi-select dropdown to manually pick which unlisted items to copy. |
| `idx.toggleCheckbox`<br>&nbsp; | **IDX: Toggle Checkbox on Current Line**<br>Direct command shortcut to check/uncheck checkboxes. |
| `idx.createMissing`<br>&nbsp; | **IDX: Create Missing File or Folder**<br>Fires file and folder generation flows instantaneously. |

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
  ]
}
```

- **`idx.indexFilename`**: Defines which index name file gets treated as your central interface dashboard.
- **`idx.excludePatterns`**: Extends target exclusion lists. File updates and unlisted copy queries will automatically ignore directories matching these expressions.

---

## 🧪 Documentation Guides

For in-depth explanations and checklists, read:
- **[FEATURES.md](./FEATURES.md)**: Explore interactive UX setups and descriptions.
- **[MANUAL.md](./MANUAL.md)**: Inspect backend caches, parsing steps, and bundle layouts.
- **[TESTING.md](./TESTING.md)**: Follow the automated QA checkboxes walkthrough tracker.
