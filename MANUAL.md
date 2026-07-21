---
title: MANUAL
---

<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable MD040 -->

# MANUAL

This guide describes the structural architecture, module layout, internal algorithms, optimization behaviors, and technical specifications of the IDX VS Code Extension codebase.

---

## 🏗️ 1. Architecture Overview

IDX is designed as a standalone, zero-dependency VS Code extension optimized for fast startup and low resource overhead. It compiles into a single CommonJS bubble via its configuration pipeline.

The implementation flow is divided into three key systems:
![IDX System](assets/system.png)

```
+-------------------------------------------------------------+
|                     IDX Markdown Document                   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|             Indentation & Heading Context Parser            |
|       (Tracks scopes, checkboxes, eligible suffixes)        |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------+-----------------------------+
|             Cache             |          Decoration         |
|   (fileStatsCache, watchers)  |  (circles, squares vector)  |
+-------------------------------+-----------------------------+
```

---

## 🧠 2. Core Modules & Systems

### A. Non-blocking In-Memory Statistics Cache (`fileStatsCache`)
To prevent heavy disk IO bottlenecks when a user typing in `idx.md` triggers parser passes, IDX stores filesystem check states in memory:
- **The Problem**: Executing recursive `fs.existsSync` or `fs.statSync` inside 300ms debounce typing loops causes noticeable editor stutters in larger workspaces.
- **The Solution**: An in-memory cache map stores:
  ```typescript
  const fileStatsCache = new Map<string, { exists: boolean; isFolder: boolean }>();
  ```
  Path lookups are handled instantly. If a path check misses, a single synchronous fallback initializes the cache entry.
- **FS Watcher Synchronization**:
  We bind a workspace filesystem watcher to monitor creation, deletion, and volume edits:
  ```typescript
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidCreate(uri => {
    fileStatsCache.delete(uri.fsPath);
    updateAllVisibleDecorations(manager);
  });
  ```
  This strategy achieves zero file-sync overhead during idle coding periods while responding to changes on disk immediately.

### B. Indentation Tracking & Contextual Hierarchy Parser
The parser `parseIdxMarkdown` processes files line-by-line while tracking folder layers:
1. **Scope Parsing**: Tracks markdown heading layers (`#`, `##`, `###`). Scopes clear folder indentations to prevent context bleeding.
2. **Indentation Sizing**: Calculates the exact spacing leading a line (counting tab sizes as `4` spaces).
3. **Folder Context Stack**:
   - If a path is verified to be a folder, it is pushed onto `folderStack: Array<{ indentation: number, resolvedPath: string }>` alongside its indent-signature.
   - On succeeding lines, the stack is popped until the current indentation exceeds that of the parent folder. This maintains strict directory scoping without requiring complex configurations.

---

## 🔎 3. Core Algorithm: Candidate Resolve Logic

When a filespec is evaluated, it resolves via multiple layers:
1. **Absolute & Parent Relative Resolution**: Evaluated relative to the active folder in the indentation stack, or against the workspace root.
2. **Extension List Candidates**: If the token is extensionless or ends in `.*`, the system draws files configured in `idx.eligibleExtensions` (default: `js,ts,md,txt,json,jsonc`), ordering candidates by preferences.
3. **Multi-Match Evaluation**: If a string maps to multiple physical files over different directories, it is flagged as `isMultiMatch`:
   - Visualized on the gutter with rectangular square signs (outline ▫️ if closed, filled ▪️ if open).
   - Activates picker queries during navigation (`idx.gotoFile` and `idx.openFile`) to let the developer select which location to open.

---

## 🛰️ 4. Commands, Keybindings & Context Flags

The extension establishes real-time event updates to drive the availability of key commands via contexts:
- **Context Flags**:
  - `idxFileActive`: True when focus is on the `idx.md` workspace index file.
  - `idxCursorOnFileLine`: True when the cursor focuses any line holding a parsed path filespec.
- **Key Navigation Commands**:
  - **`idx.gotoFile`** (F2): Opens and fully activates/focuses the target.
  - **`idx.openFile`** (Alt+F2): Uses preview-safe backgrounds rendering with `preserveFocus: true` so the user remains fully on the index.
  - **`idx.closeFile`** (F4): Resolves paths for the current line and closes corresponding editor tab groups.
  - **`idx.toggleCheckbox`** (Insert X): Alters bracket contents `[ ]` <-> `[x]` on disk.
  - **`idx.setKeybindings`**: Resolves global User keybindings directory (supporting VS Code, Insiders, VSCodium, Code-OSS, and Cursor) to write customized bindings.
  - **`idx.collectEditors`** (Ctrl+` F11): MultiSelect picker list open editors to move them safely to selected or new tab groups.
  - **`idx.closeAllMarkdownEditors`** (Ctrl+` Ctrl+F4): Closes non-active markdown sheets.
  - **`idx.closeAllMarkdownEditorsInGroup`** (Ctrl+` F4): Selection interface to close group markdown editors.
- **Multi-line Range Operations**:
  - Commands prefixing `idx.*Selected*` evaluate filespecs matching all user-highlighted lines, performing bulk opens, bulk closes, bulk checkbox checks, unchecks, deletions, and additions recursively.
- **Real-time Glyph Margin Renderers**:
  - Gutter decorations are initialized in the `editor.glyphMargin` layout area automatically for an extremely premium and clear visual representation.
- **Filespec Syntax Highlighting**:
  - Semantic colors are applied dynamically based on the exact filespec type (such as cyan for parent folders dependency, or yellow for explicit directories).

---

## 🔧 5. Workspace Build & Configuration

The build stack consists of:
- **Transpilation**: TypeScript definitions paired with a custom `tsconfig.json` set to generate CommonJS modules.
- **Verification Tools**: Dry-run checking can be performed safely via `npx tsc --noEmit`.
