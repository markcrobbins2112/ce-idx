<!-- markdownlint-disable MD013 -->
# IDX Features Guide
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

Back to [README](README.md)
Next  [SPEC](SPEC.md)
Next  [MANUAL](MANUAL.md)
