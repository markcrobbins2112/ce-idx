<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable MD038 -->
# IDX Quality Assurance Walkthrough & Test Suite

You can use this interactive test sheet directly with IDX inside VS Code to verify that all systems are fully functional. Put your cursor on these checkbox lines, and use our Quick Actions to mark them done!

---

## 🔵 Setup & Environment Check
- [ ] Create a Workspace configuration in VS Code.
- [ ] Add `idx.md` (or your configured index file) to the root directory.
- [ ] Add `"idx.excludePatterns"` in your user `settings.json` and verify custom paths are ignored.
- [ ] Add `"idx.eligibleExtensions"` in your workspace settings and customize preferred extension matching order.

---

## 🟢 Indicator, Gutter & Multi-Match Checks
- [ ] **Blue Gutter Circles**: Write a line pointing to a non-existent file:
  - `- [ ] src/missing-file.ts`
  - Verify a 🔵 blue indicator displays in the gutter of `idx.md`.
- [ ] **Gray Gutter Circles**: Create an actual file on disk:
  - Verify the indicator switches to a ⚪ gray outline.
- [ ] **Green Gutter Circles**: Double click or open that file in an editor tab:
  - Focus back on `idx.md` and verify the indicator switches to a 🟢 green circle.
- [ ] **Multi-Match Squares**: Create two different files named `server.ts` and `src/server.ts`:
  - Write a fileline: `- [ ] server.ts`
  - Since it has multiple matches in different directories, verify the gutter shows a gray outline square ▫️.
- [ ] **Open Multi-Match Squares**: Open one of the matching files (e.g., `src/server.ts`):
  - Focus back on `idx.md` and verify the gutter switches to a green solid square ▪️.

---

## ⚡ Active Action & Suggestion Testing
- [ ] **Fast Hover Checkbox Action**:
  - Focus cursor on line `- [ ] src/missing-file.ts`.
  - Press `Ctrl + .` / `Cmd + .` or click the lightbulb.
  - Select "Mark task as completed".
  - Verify the string gets edited inline to `- [x] src/missing-file.ts`.
- [ ] **Auto-Genesis File Creation (Quick Fix)**:
  - Select an uncreated file path showing a blue dot.
  - Fire Quick Action (`Cmd + .`).
  - Choose "📄 Create file: src/missing-file.ts".
  - Verify all parent folders are created recursively and empty file is touched on disk.
- [ ] **Ambiguous Choice File Creation**:
  - Write a non-existent ambiguous token: `- [ ] new-missing-file`
  - Trigger Quick Fix code action and choose create file.
  - Verify you are presented with a directory selection QuickPick prompting where in the workspace to construct the file.

---

## 🕹️ Command Suite Walkthrough

- [ ] **`idx.openIdx`** (IDX: Open/Edit Index File) (Key: `` ` i `` when `!idxFileActive`)
  - Close `idx.md`. Fire the key shortcut and confirm it re-opens or focuses your default index dashboard.
- [ ] **`idx.update`** (IDX: Update File Listings) (Key: `F5` when `idxFileActive`)
  - Run the update script. Confirm newly added files are placed under `## New Files` section, and missing paths move to `## Missing Files`.
- [ ] **`idx.gotoFile`** (IDX: Go to File/Folder under Cursor) (Key: `F2` when `idxCursorOnFileLine`)
  - Trigger command over folders. Verify a QuickPick launches grouping open vs closed items along with checkbox task counters.
- [ ] **`idx.openFile`** (IDX: Open File under Cursor (No Focus)) (Key: `Alt+F2` when `idxCursorOnFileLine`)
  - Trigger command on a fileline. Verify the target document is loaded in preview mode in the background while focus remains perfectly focused on `idx.md`.
- [ ] **`idx.closeFile`** (IDX: Close Open File under Cursor) (Key: `F4` when `idxCursorOnFileLine`)
  - Hover over an open item's line in `idx.md` and trigger F4. Verify matching active tabs are swiftly closed.
- [ ] **`idx.returnToIdx`** (IDX: Return to Index Location) (Key: `` ` r `` when `!idxFileActive`)
  - Open a separate source code file (e.g., `src/extension.ts`). Fire the keyboard command and confirm it closes or leaves that tab to highlight the reference in `idx.md`.
- [ ] **`idx.jumpAny`** (IDX: Jump to Any File) (Key: `Alt+` ` i` when `idxFileActive`)
  - Trigger command. Confirm you can fuzzy search all project files, grouped clean by open/closed status.
- [ ] **`idx.copyProjectUnlisted`** (IDX: Copy Project Unlisted Filelines) (Key: `Alt+i Ctrl+Insert`)
  - Fire command and paste results into `idx.md`. Verify it copies unlisted items with checkbox structures, respecting your custom ignored exclusion patterns.

---

## 🚀 Advanced Utilities & Multi-line QA List
- [ ] **Global User Keybindings Config (`idx.setKeybindings`)**:
  - Open IDX Index, trigger CMD/Ctrl+Shift+P -> "IDX: Set User Keybindings".
  - Select items from QuickPick. Verify they are written directly to your global User `keybindings.json` (supported across VS Code, Insiders, VSCodium, Code-OSS, and Cursor).
- [ ] **Collect Editors (`idx.collectEditors`)**:
  - Open multiple file tabs, trigger Ctrl+` F11. Select specific tabs in the QuickPick and a target pane/new group to rearrange your editor structures instantly.
- [ ] **Bulk Markdown Closes**:
  - Run `idx.closeAllMarkdownEditors` (on index, Key: `Ctrl+` Ctrl+F4`) or `idx.closeAllMarkdownEditorsInGroup` (Key: `Ctrl+` F4`). Verify all other open markdown files are closed, leaving the active `idx.md` index open.
- [ ] **Multi-line Range Operations**:
  - Highlight multiple filelines in `idx.md`. Select any of the multi-line commands (e.g. `idx.openSelectedFiles` or `idx.checkSelectedCheckboxes`). Verify actions are applied to all valid highlighted targets simultaneously.
- [ ] **Cursor Environment Compatibility**:
  - Run the extension in Cursor. Verify the extension detects Cursor correctly via `vscode.env.appName` and maps the configuration data to Cursor's User path.
