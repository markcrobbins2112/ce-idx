# IDX
./.vscode/settings.json
- [X] ./text.txt
- [ ] FAIL: ./text.txt

- [ ] ./text2.txt
- [ ] ./text3.txt

./t*.txt
C:\_\__\idx\test-fixture\text2.txt
./text6.txt

- [X] OK: ./text2.txt
- [X] OK: ./text2.txt

## Keys for commands
eee
ee

| Keys              | Command Name                  | Command Description                      | When                |
| ----------------- | ----------------------------- | ---------------------------------------- | ------------------- |
| ` i               | idx.openIdx                   | Open/Edit Index File                     | !idxFileActive      |
| f5                | idx.update                    | Update File Listings                     | idxFileActive       |
| f2                | idx.gotoFile                  | Go to File/Folder under Cursor           | idxCursorOnFileLine |
| alt+f2            | idx.openFile                  | Open File under Cursor (No Focus)        | idxCursorOnFileLine |
| f4                | idx.closeFile                 | Close Open File under Cursor             | idxCursorOnFileLine |
| ` backspace       | idx.returnToIdx               | Return to Index Location                 | !idxFileActive      |
| ` ctrl+backspace  | idx.returnToIdxPicker         | Return to Index Location Picker          | !idxFileActive      |
| alt+` i           | idx.jumpAny                   | Jump to Any File (List All)              | idxFileActive       |
| alt+` alt+i       | idx.jumpWithin                | Jump Within Index Listings               | idxFileActive       |
| alt+i ctrl+insert | idx.copyProjectUnlisted       | Copy Project Unlisted Filelines          | idxFileActive       |
| alt+i alt+insert  | idx.copyProjectUnlistedPicker | Pick and Copy Project Unlisted Filelines | idxFileActive       |
| insert x          | idx.toggleCheckbox            | Toggle Checkbox on Current Line          | always              |
| ctrl+` f11        | idx.collectEditors            | Collect Editors                          | always              |
| ctrl+` f4         | idx.closeAllMarkdownEditors   | Close All Markdown Editors               | always              |
| ctrl+alt+f10      | idx.checkboxer                | Checkboxer Label Toggle                  | always              |
| (none)            | idx.copyKeybindings           | Copy Keybindings to Clipboard            | always              |

- idx.openIdx: ` i (!idxFileActive)
- idx.update: f5 (idxFileActive)
- idx.gotoFile: f2 (idxCursorOnFileLine)
- idx.openFile: alt+f2 (idxCursorOnFileLine)
- idx.closeFile: f4 (idxCursorOnFileLine)
- idx.returnToIdx: ` r (!idxFileActive)
- idx.returnToIdxPicker: ` i (!idxFileActive)
- idx.jumpAny: alt+` i (idxFileActive)
- idx.jumpWithin: alt+` alt+i (idxFileActive)
- idx.copyProjectUnlisted: alt+i ctrl+insert (idxFileActive)
- idx.copyProjectUnlistedPicker: alt+i alt+insert (idxFileActive)
- idx.toggleCheckbox: insert x (always)
- idx.collectEditors: ctrl+` f11 (always)
- idx.closeAllMarkdownEditors: ctrl+` f4 (always)
- idx.checkboxer: ctrl+alt+f10 (always)
- idx.copyKeybindings:  (always)

## Need two context when flags

## Need new commands

## When for commands



## New Setting
## Other filespecs
## Directory filespecs on files
## Colors for multi-matching filelines

## Missing Files

## New Files
- [ ] parent/AITASKS.md
- [ ] parent/TESTING.md
