---
title: FEATURES
---

<!-- markdownlint-disable MD013 -->

# FEATURES
Back to [README](README.md)

Welcome to **Incredibly Desirable Experience (IDX)**!

This guide details all the user-facing capabilities, UI patterns, and commands offered by the extension to turn your Markdown indexes into interactive, lightning-fast file explorers.

---

## 🎨 1. Real-time Gutter Indicators

As you open and edit your index markdown files (default: `idx.md`), IDX watches your filesystem and active editors in real-time, inserting sharp vector-based icons directly into your line gutters. This provides immediate spatial context for your project.

| Icon | Gutter Shape / Color | Meaning / State |
| :---: | :--- | :--- |
| 🔵 | **Blue dot circle** | The referenced file or folder does *not* exist on your disk. |
| ⚪ | **Gray outline circle** | The file/folder exists locally, but is currently closed. |
| 🟢 | **Green dot circle** | The file/folder exists AND is currently open in one of your active editors. |
| ▫️ | **Gray outline square** | Multiple files match this ambiguous filename, and all are closed. |
| ▪️ | **Green solid square** | Multiple files match this ambiguous filename, and at least one is open. |

---

## 📂 2. Markdown Fileline Exploration

You are no longer restricted to a rigid, tree-only file explorer sidebar. You can write rich markdown documentation, insert task checklists, and sketch hierarchical structures. Any line pointing to a valid disk entry (or standard workspace relative path) behaves as an **interactive fileline**:

- **Indentation Trees**: IDX parses indentation levels (with standard whitespace or tab formatting) to automatically determine file or folder hierarchy.
- **Smart Relative Matching**: If folder `src/` is defined with high indentations, child items listed directly underneath it will automatically evaluate relative to `src/` rather than the workspace root.
- **Auto-completion Helper**: If you omit common file endings (e.g. `extension` instead of `extension.ts`), IDX automatically resolves and displays the item if a matching developer extension is present on disk.
- **Eligible Extensions list**: Configure `idx.eligibleExtensions` (default: `js,ts,md,txt,json,jsonc`) to customize the order of file extensions checked when evaluating ambiguous filespecs.

---

## ⚙️ 3. Quick-Fix Code Actions

To keep you in a keyboard-focused flow state, IDX registers standard VS Code Code Actions (accessible via the `Command + .` / `Ctrl + .` keybind, or by clicking the VS Code yellow lightbulb):

### 📄 Checklist Toggling
If your cursor sits on a line with checkbox indicators:
- `- [ ] path/to/file.ts` -> **"Mark task as completed"** toggles it to `- [x] path/to/file.ts`.
- `- [x] path/to/file.ts` -> **"Mark task as incomplete"** toggles it back to `- [ ] path/to/file.ts`.

### ⚡ Auto-Genesis Missing Items (Blue Dots)
If a fileline points to a non-existent file or folder (highlighted by a blue dot):
- Selecting the line summons a Quick Fix action: **"Create file: path"** or **"Create directory: path"**.
- Selecting the action recursively creates the target parent directory path, makes the file/folder of your descriptor, clears the internal cache, and focuses the newly written tab instantly!
- If the filespec is **ambiguous** (has no directory information), a QuickPick prompts you to select where in the workspace to create the file based on the directory structure! Or if the path ends with `.*`, a QuickPick will prompt you to choose from one of your configured eligible extensions.

---

## 🕹️ 4. Advanced Navigation Commands

Every navigational action is engineered to prevent context-switching:

### 📁 Direct Navigation (`idx.gotoFile` & `idx.openFile`)
- **`idx.gotoFile`** (F2): Opens the file under the cursor and shifts keyboard focus to that editor tab.
- **`idx.openFile`** (Alt+F2): Opens/reveals the file under the cursor in the background in preview mode, leaving the keyboard focus completely on the `idx.md` index file for continued explorer navigation.
- If point-of-interest is a **folder**: Displays an interactive QuickPick of the directory contents:
  - First index options to reveal folder in the OS native file explorer.
  - Groups files into **Open Files** (prefixed with 🟢) and **Closed Files** (prefixed with ⚪).
  - Displays checkbox progression metrics (e.g., `☑ 1/2`) and index occurrence counts alongside files.
  - *Dynamic Hover Preview*: While scrolling through the popup items, the background editor automatically previews the files in real-time, maintaining keyboard focus on the menu!

### ❌ Close Navigation (`idx.closeFile`)
- **`idx.closeFile`** (F4): Instantly closes the open file tab corresponding to the file path on the current cursor line, facilitating super-tidy workspace state cleanup.

### 🔄 Workspace Refactoring (`idx.update`)
- Automatically scans your workspace directory (strictly respecting custom configurations).
- Newly discovered files are cleanly appended underneath the `## New Files` section.
- Missing files are relocated to the `## Missing Files` segment.

### 🔌 Return to Index Location (`idx.returnToIdx`)
- When editing any source file, instantly closes, focuses, or opens your `idx.md` workspace index.
- Automatically scrolls your cursor to the first occurrence matching the active file.
- If the active file lacks indexing, it appends it to your index under `## New Files`.

### 🔍 Search Jumps (`idx.jumpAny` & `idx.jumpWithin`)
- Search your active workspace or index lines with responsive, fuzzy text match QuickPicks. It features real-time backgrounds preview, checklists status counters, and occurrence markers.

---

## 🌈 5. Syntax Highlighting, Bulk Selection Actions & More

To elevate the visual experience and streamline bulk refactoring, IDX implements semantic filespec coloring, range-based selection actions, and custom environment management tools:

### 🎨 Semantic Filespec Coloring
Each type of filespec has designated color highlighting so you can instantly recognize the scope of lines:
- **fullpath**: Pure white (`#ffffff`) for explicit paths.
- **relativepath**: Light grey (`#d1d5db`) for project-bounded paths.
- **filenameonly**: Bold red (`#ef4444`) for floating files that require careful context resolution.
- **parentdependent**: Soft cyan (`#06b6d4`) for entries relying on active folders.
- **directoryunspecified**: Orange (`#f97316`) for ambiguous entries without folders.
- **folder**: Vivid yellow (`#eab308`) highlighting directory entries.
- **wildcard**: Purple (`#a855f7`) for pattern matched elements (e.g. `*.ts`, `*.*`).

### 📦 Multi-line Bulk Operations
When holding standard cursor ranges (selecting multiple lines), IDX activates selection-aware actions:
- **Open Selected Files (No Focus)** (`idx.openSelectedFiles`): Opens all highlighted files without shifting focus.
- **Close Selected Files** (`idx.closeSelectedFiles`): Closes editor tabs corresponding to selected paths.
- **Go to Selected File/Folder** (`idx.gotoSelectedFile`): Opens the clicked/active files in your selection.
- **Mark Selected Lines Completed** (`idx.checkSelectedCheckboxes`): Updates bulk checklists to active state (`x` or `X`).
- **Mark Selected Lines Incomplete** (`idx.uncheckSelectedCheckboxes`): Unchecks all matching checklists.
- **Remove Selection Checkboxes** (`idx.removeSelectedCheckboxes`): Removes checkbox brackets on selected lines.
- **Add Checkboxes to Selection** (`idx.addSelectedCheckboxes`): Appends checkboxes to selected targets.

### ⚙️ User Utilities
- **Set User Keybindings (`idx.setKeybindings`)**: Interactive QuickPick allowing users to write extension shortcuts directly into their global User `keybindings.json` (supports standard VS Code, Insiders, VSCodium, Code-OSS, and Cursor).
- **Collect Editors (`idx.collectEditors`)**: Stitches together scattered files into organized layout groups.
- **Close All Markdown Editors (`idx.closeAllMarkdownEditors`)**: Closes all loose markdown tabs while preserving the principal explorer `idx.md`.

---

## 📋 6. Complete Commands Directory

Below is the exhaustive catalog of every command registered by the IDX extension. These can be triggered via the VS Code Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`), custom key bindings, or contextual menus:

| Command ID | Implemented Name & Action | Context Active | Intended Keys |
| :--- | :--- | :--- | :--- |
| **`idx.openIdx`** | Open Index | `!idxFileActive` | `` `i `` |
| **`idx.update`**| Update Index Workspace | `idxFileActive` | `F5` |
| **`idx.gotoFile`** | Goto File / Directory Picker | `idxCursorOnFileLine` | `F2` |
| **`idx.openFile`** | Open File in Background | `idxCursorOnFileLine` | `Alt+F2` |
| **`idx.closeFile`** | Close File Editor | `idxCursorOnFileLine` | `F4` |
| **`idx.returnToIdx`** | Return to Index Location | `!idxFileActive` | `` ` backspace `` |
| **`idx.returnToIdxPicker`** | Return Match Picker | `!idxFileActive` | `` ` ctrl+backspace `` or `` `i `` |
| **`idx.jumpAny`** | Fuzzy Search Jump | `idxFileActive` | `alt+` i` |
| **`idx.jumpWithin`** | Local Search Jump | `idxFileActive` | `alt+` alt+i` |
| **`idx.copyProjectUnlisted`** | Copy Project Unlisted Paths | None / Menu | `alt+i ctrl+insert` |
| **`idx.copyProjectUnlistedPicker`** | Pick and Copy Unlisted Paths | None / Menu | `alt+i alt+insert` |
| **`idx.toggleCheckbox`** | Toggle/Cycle Checkbox | `idxFileActive` | `insert x` |
| **`idx.checkboxer`** | Multi-Checkbox Cycler | Always | `ctrl+alt+f10` |
| **`idx.createMissing`** | Auto-Genesis Missing Items | `idxCursorOnFileLine` | None / Action |
| **`idx.setKeybindings`** | Write User Keybindings | Always | None / Palette |
| **`idx.collectEditors`** | Group Leftover Editors | Always | `ctrl+` f11` |
| **`idx.closeAllMarkdownEditors`** | Tidy Markdown Editors | Always | `ctrl+` f4` |
| **`idx.copyKeybindings`** | Copy Shortcuts to Clipboard | Always | None / Palette |
| **`idx.openSelectedFiles`** | Open Selected Matches | Multiple Selection | None / Menu |
| **`idx.closeSelectedFiles`** | Close Selected Matches | Multiple Selection | None / Menu |
| **`idx.gotoSelectedFile`** | Open Active Selection | Multiple Selection | None / Menu |
| **`idx.checkSelectedCheckboxes`** | Check Selected Bullets | Multiple Selection | None / Menu |
| **`idx.uncheckSelectedCheckboxes`** | Uncheck Selected Bullets | Multiple Selection | None / Menu |
| **`idx.removeSelectedCheckboxes`** | Strip Selection Checkboxes | Multiple Selection | None / Menu |
| **`idx.addSelectedCheckboxes`** | Add Checkboxes to Selection | Multiple Selection | None / Menu |

---

Back to [README](README.md)
Next  [SPEC](SPEC.md)
Next  [MANUAL](MANUAL.md)
