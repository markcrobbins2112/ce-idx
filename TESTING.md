<!-- markdownlint-disable MD013 -->
# IDX Quality Assurance Walkthrough & Test Suite

You can use this interactive test sheet directly with IDX inside VS Code to verify that all systems are fully functional. Put your cursor on these checkbox lines, and use our Quick Actions to mark them done!

---

## 🔵 Setup & Environment Check
- [ ] Create a Workspace configuration in VS Code.
- [ ] Add `idx.md` (or your configured index file) to the root directory.
- [ ] Add `"idx.excludePatterns"` in your user `settings.json` and verify custom paths are ignored.

---

## 🟢 Indicator & Gutter Checks
- [ ] **Blue Gutter Circles**: Write a line pointing to a non-existent file:
  - `- [ ] src/missing-file.ts`
  - Verify a 🔵 blue indicator displays in the gutter of `idx.md`.
- [ ] **Gray Gutter Circles**: Create an actual file on disk:
  - Verify the indicator switches to a ⚪ gray outline.
- [ ] **Green Gutter Circles**: Double click or open that file in an editor tab:
  - Focus back on `idx.md` and verify the indicator switches to a 🟢 green circle.

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
- [ ] **Auto-Extension Fallback Matcher**:
  - Write standard index lines targeting local items but omitting suffixes (e.g. `src/extension` instead of `src/extension.ts`).
  - Open `src/extension.ts` in an active tab.
  - Verify that `src/extension` displays a 🟢 green indicator (resolved and matched).

---

## 🕹️ Command Suite Walkthrough

- [ ] **`idx.openIdx`** (IDX: Open/Edit Index File)
  - Close `idx.md`. Fire the command and confirm it re-opens or focuses your default index dashboard.
- [ ] **`idx.update`** (IDX: Update File Listings)
  - Run the update script. Confirm newly added files are placed under `## New Files` section, and missing paths move to `## Missing Files`.
- [ ] **`idx.gotoFile`** (IDX: Go to File/Folder under Cursor)
  - Trigger command over folders. Verify a QuickPick launches grouping open vs closed items along with checkbox task counters.
- [ ] **`idx.returnToIdx`** (IDX: Return to Index Location)
  - Open a separate source code file (e.g., `src/extension.ts`). Fire the keyboard command and confirm it closes or leaves that tab to highlight the reference in `idx.md`.
- [ ] **`idx.jumpAny`** (IDX: Jump to Any File)
  - Trigger command. Confirm you can fuzzy search all project files, grouped clean by open/closed status.
- [ ] **`idx.copyProjectUnlisted`** (IDX: Copy Project Unlisted Filelines)
  - Fire command and paste results into `idx.md`. Verify it copies unlisted items with checkbox structures, respecting your custom ignored exclusion patterns.
