<!-- markdownlint-disable MD001 -->
<!-- markdownlint-disable MD009 -->
<!-- markdownlint-disable MD018 -->
<!-- markdownlint-disable MD056 -->
<!-- markdownlint-disable MD060 -->

# IDX
./.vscode/settings.json


- [ ] ./text2.txt
- [ ] ./text3.txt

# [X] ./text2.txt
# [ ] ./text3.txt


# ./text2.txt
# ./text2.txt


# [ ] ./text2.txt
# [ ] ./text3.txt

#./text2.txt
#./text3.txt


- ./text2.txt
- ./text3.txt

./xt*.txt
C:\_\__\idx\test-fixture\text2.txt
./text6.txt

- [X] OK: ./text2.txt
- [X] OK: ./text3.txt

## Keys for commands
eee
ee

| Keys               | Command Name                  | Command Description                  | When                                                       |
| ------------------ | ----------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| ` i                | idx.openIdx                   | Go To Index File                     | !idxFileActive                                             |
| f5                 | idx.update                    | Update Index File Listings           | idxFileActive                                              |
| f2                 | idx.gotoFile                  | Edit Files                           | idxCursorOnFileLine || idxFileActive && editorHasSelection |
| alt+f2             | idx.openFile                  | Open Files                           | idxFileActive && editorHasSelection                        |
| f4                 | idx.closeFile                 | Close Files                          | idxCursorOnFileLine || idxFileActive && editorHasSelection |
| ` backspace        | idx.returnToIdx               | Return to Index Location             | !idxFileActive                                             |
| ` ctrl+backspace   | idx.returnToIdxPicker         | Return to Index Location Picker      | !idxFileActive                                             |
| alt+` i            | idx.jumpAny                   | Jump to Any File (List All)          | idxFileActive                                              |
| alt+` alt+i        | idx.jumpWithin                | Jump Within Index Listings           | idxFileActive                                              |
| alt+i ctrl+insert  | idx.copyProjectUnlisted       | Copy Unindexed Filelines             | idxFileActive                                              |
| alt+i alt+insert   | idx.copyProjectUnlistedPicker | Copy Unindexed Filelines from Picker | idxFileActive                                              |
| insert x           | idx.toggleCheckbox            | Toggle Checkbox X                    | always                                                     |
| (none)             | idx.createMissing             | Create Missing File or Folder        | always                                                     |
| (none)             | idx.setKeybindings            | Set User Keybindings                 | always                                                     |
| ctrl+` f11         | idx.collectEditors            | Collect and Group Editors            | always                                                     |
| ctrl+` f4          | idx.closeAllMarkdownEditors   | Close All Markdown Editors           | always                                                     |
| ctrl+alt+f10       | idx.checkboxer                | Checkbox Label Toggle                | always                                                     |
| ctrl+alt+shift+f10 | idx.checkboxTag               | Checkbox Tag                         | always                                                     |
| (none)             | idx.pickCommand               | Pick an IDX Command                  | always                                                     |
| (none)             | idx.copyKeybindings           | Copy Commands to Clipboard           | always                                                     |
| (none)             | idx.removeSelectedCheckboxes  | Remove Selection Checkboxes          | always                                                     |
| (none)             | idx.addSelectedCheckboxes     | Add Checkboxes to Selection          | always                                                     |

## Need two context when flags

## Need new commands

## When for commands



## New Setting
## Other filespecs
## Directory filespecs on files
## Colors for multi-matching filelines

## New Files
- [ ] parent/AITASKS.md
- [ ] parent/TESTING.md
- [ ] parent/SPEC.md
- [ ] parent/README.md
- [ ] parent/MANUAL.md
- [ ] parent/FEATURES.md
- [ ] parent/extension.ts
- [ ] parent/AILOG.md
- [ ] parent/AGENTS.md
- [ ] parent/.gitignore
