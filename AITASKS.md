<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable MD037 -->
# AITASKS

## New Commands
### Set User Keybindings
- MultiSelect Picklist that will Control Which extension keybindings are written to keybindings.json
  - keybindings are written or removed dynamically according to the selection

### Collect Editors
- when idx.md is active
- key "ctrl+` f11"
- with open files
  - multiSelect picker listing open editors
    - with selected files, a new picker listing groups to move selected editors to, or new group

### Close all markdown editors
- when idx.md is active
- key "ctrl+` ctrl+f4"
- do not close idx.md

### Close all markdown editors in group
- when idx.md is active
- key "ctrl+` f4"
- picker to select group
- do not close idx.md

## Use Glyph Margin instead of Gutter for icons
- change the visibilty of the Glyph Margin to true automatically

## Paint the filespec of a fileline
- for filespec types, color the text
  - fullpath: white
  - relativepath: light grey
  - filenameonly: red
  - parent dependent /filename or /filename.ext: cyan
  - directory unspecified filename.ext: orange
  - folder ./folder or fullpath/folder: yellow
  - wildcard: filenameonly.* or *.ext or /filename.* or or /file*.* or etc: purple

## Operate on selected lines
- for every filespec in selection, make these commands available
  - openFile
  - closeFile
  - gotoFile - open the files and offer a picker for which file to activate
  - checkCheckbox - picker to choose whether to use X or x
  - uncheckCheckbox
  - removeCheckboxes
  - addCheckboxes - picker to choose: unchecked, X or x
  - make some of those above into commands as neccessary

## Implement these and update the UPPERCASE.md files


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
