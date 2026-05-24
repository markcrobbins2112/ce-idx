<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable MD037 -->
# AITASKS

## New Commands
### [x] Set User Keybindings
- [x] MultiSelect Picklist that will Control Which extension keybindings are written to keybindings.json
  - [x] keybindings are written or removed dynamically according to the selection

### [x] Collect Editors
- [x] when idx.md is active
- [x] key "ctrl+` f11"
- [x] with open files
  - [x] multiSelect picker listing open editors
    - [x] with selected files, a new picker listing groups to move selected editors to, or new group

### [x] Close all markdown editors
- [x] when idx.md is active
- [x] key "ctrl+` ctrl+f4"
- [x] do not close idx.md

### [x] Close all markdown editors in group
- [x] when idx.md is active
- [x] key "ctrl+` f4"
- [x] picker to select group
- [x] do not close idx.md

## [x] Use Glyph Margin instead of Gutter for icons
- [x] change the visibilty of the Glyph Margin to true automatically

## [x] Paint the filespec of a fileline
- [x] for filespec types, color the text
  - [x] fullpath: white
  - [x] relativepath: light grey
  - [x] filenameonly: red
  - [x] parent dependent /filename or /filename.ext: cyan
  - [x] directory unspecified filename.ext: orange
  - [x] folder ./folder or fullpath/folder: yellow
  - [x] wildcard: filenameonly.* or *.ext or /filename.* or or /file*.* or etc: purple

## [x] Operate on selected lines
- [x] for every filespec in selection, make these commands available
  - [x] openFile
  - [x] closeFile
  - [x] gotoFile - open the files and offer a picker for which file to activate
  - [x] checkCheckbox - picker to choose whether to use X or x
  - [x] uncheckCheckbox
  - [x] removeCheckboxes
  - [x] addCheckboxes - picker to choose: unchecked, X or x
  - [x] make some of those above into commands as neccessary

## [x] Implement these and update the UPPERCASE.md files


## Need two context when flags
- [x] idxFileActive
- [x] idxCursorOnFileLine: idx File is active and current line has a filepath

## Need new commands
- [x] idx.openFile: when - idxCursorOnFileLine - same as idx.gotoFile but no file activation
- [x] idx.closeFile: when - idxCursorOnFileLine - close an open file

## When for commands
- [x] idx.openIdx: when - !idxFileActive
- [x] idx.update: when - idxFileActive
- [x] idx.gotoFile: when - idxCursorOnFileLine
- [x] idx.openFile: when - idxCursorOnFileLine
- [x] idx.closeFile: when - idxCursorOnFileLine
- [x] idx.returnToIdx: when - !idxFileActive
- [x] idx.returnToIdxPicker: when - !idxFileActive
- [x] idx.jumpAny: when - idxFileActive
- [x] idx.jumpWithin: when - idxFileActive
- [x] idx.copyProjectUnlisted: when - none
- [x] idx.copyProjectUnlistedPicker: when - none
- [x] idx.toggleCheckbox: when - idxFileActive
- [x] idx.createMissing: when - idxCursorOnFileLine

## Keys for commands
- [x] idx.openIdx: when - !idxFileActive - "`i"
- [x] idx.update: when - idxFileActive - "F5"
- [x] idx.gotoFile: when - idxCursorOnFileLine - "F2"
- [x] idx.openFile: when - idxCursorOnFileLine - "alt+F2"
- [x] idx.closeFile: when - idxCursorOnFileLine - "F4"
- [x] idx.returnToIdx: when - !idxFileActive - "` i"
- [x] idx.returnToIdxPicker: when - !idxFileActive - "`i"
- [x] idx.jumpAny: when - idxFileActive - "alt+` i"
- [x] idx.jumpWithin: when - idxFileActive - "alt+` alt+i"
- [x] idx.copyProjectUnlisted: when - idxFileActive - "alt+i ctrl+insert"
- [x] idx.copyProjectUnlistedPicker: when - idxFileActive - "alt+i alt+insert"
- [x] idx.toggleCheckbox: when - idxFileActive - "insert x"
- [x] idx.createMissing: when - idxCursorOnFileLine

## New Setting
- [x] Eligable Extensions List
  - [x] Comma seperated list of extensions
  - [x] Ordered by preference
  - [x] Default: js,ts,md,txt,json,jsonc
  - [x] Used to determine if a ambiguous filespec is valid
    - [x] Example 'filenameonly'
      - [x] if filenamelonly exists in any workspace directory, then is a valid filespec
        - [x] if multiple matches from different directories occurs then
          - [x] whenever the open/goto file commands offer a picker to choose the directory file to open
          - [x] whenever the returnToIdx/returnToIdxPicker commands occur, then the filespec is generic so that:
            - [x] returning from filenameonly in any workspace directory could return to this filespec
      - [x] if not exists in any workspace dir, the gutter indicator is treated as not a valid filespec, and:
        - [x] the 'open/goto' commands offer a picker to choose the directory to create the file in
          - [x] whenever the returnToIdx/returnToIdxPicker commands cannot occur, since the file does not exist
            - [x] returning from filenameonly in any workspace directory could return to this filespec
    - [x] Example 'filenameonly.*'
      - [x] if filenamelonly.{any ext in ext list} exists in any workspace directory, then is a valid filespec
        - [x] if multiple matches from different exts or directories occurs then
          - [x] whenever the open/goto file commands offer a picker to choose the file ext, then a picker for the directories is offered if neccessary to determin the file
          - [x] whenever the returnToIdx/returnToIdxPicker commands occur, then the filespec is generic so that:
            - [x] returning from filenameonly.{any ext in list} in any workspace directory could return to this filespec
              - [x] offer a picker to choose whether to return to matching filespecs
      - [x] if filenameonly.{any ext in ext list} not exists in any workspace dir, the gutter indicator is treated as not a valid filespec, and:
        - [x] the 'open/goto' commands offer a picker to the ext to create and a picker choose the directory to create the file in
          - [x] whenever the returnToIdx/returnToIdxPicker commands cannot occur, since the file does not exist but
            - [x] if the file returning from is a filename.{ext not in ext list} then offer a picker of all eligable filespecs
            - [x] returning from filenameonly.{ext not in ext list} in any workspace directory could return to this filespec
## Other filespecs
- Example: filename.ext
  - [x] will match any filename.ext in any workspace directory
  - [x] use a square of proper color in the gutter
  - [x] use some other shape of proper color for multiple matches
  - [x] for open/goto file command use a picker to differentiate mmultiple matches from different dirs
    - [x] whenever the returnToIdx/returnToIdxPicker commands occur, then the filespec is generic so that:
      - [x] if the file returning from is a filename.ext then offer a picker of all eligable filespecs
      - [x] returning from filename.ext in any workspace directory could return to this filespec
## Directory filespecs on files
- Example: filename.ext
  - [x] multi directory, as described above
- Exmple: ./filename.ext
  - [x] proper relative path, treat it as such
- Exmple: /filename.ext
  - [x] directory is inherited from a folderspec found as a parent, example:
    - [x] ./parentfolder
      - [x] random text lines (optional)
      - [x] /filename.ext
    - [x] the sythesized path would be:
      - [x] ./parentfolder/filename.ext
## Colors for multi-matching filelines
- if any are open then green
- if none are open and any exist then white
