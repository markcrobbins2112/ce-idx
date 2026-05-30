<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable MD037 -->
<!-- markdownlint-disable MD007 -->
# AITASKS

## [ ] Implement these and update the UPPERCASE.md files (Never check this item, just do it)

## Incoming tasks from chat
- [X] Fix the keybindings picker to allow search on detail and description

## New Tasks
### [ ] NEW: checkbox commands should work on non bulleted boxes
- like:{no chars}[ ]
- like: - [ ]
- like: # [ ]
- like: ## [ ]
- like: ### [ ]
- like: #### [ ]
- like: ##### [ ]
- like: ###### [ ]

### [X] Goto file on non-existent file
- [X] should offer picker to ask if want create

### [X] Change Copy Keybindings to Clipboard
- make it Copy Commands, same format

### [X] idx.checkSelectedCheckboxes does not show up in Copy Keybindings

## New Commands
### [X] Set User Keybindings
- [X] MultiSelect Picklist that will Control Which extension keybindings are written to keybindings.json
  - [X] keybindings are written or removed dynamically according to the selection

### [ ] Collect Editors
- [X] when idx.md is active :UNDO
  - [X] when always
- [X] key "ctrl+` f11"
- [X] with open files
  - [X] multiSelect picker listing open editors
    - [X] with selected files, a new picker listing groups to move selected editors to, or new group
      - [X] editors were copied, not moved
	  - [ ] NEW: item for Active Group {number} at the top
	  - [ ] NEW: focus should return to the original tab

### [X] Close all markdown editors
- [X] when idx.md is active :UNDO
  - [X] when always
- [X] key "ctrl+` f4"
- [X] do not close idx.md
- [X] offer a picker with items
  - [X] close all {count} [focused]
  - [X] close this group {count}
  - [X] close group {number} {count}

### [X] Close all markdown editors in group
- [X] Remove this feature
- [X] when idx.md is active
- [X] key "ctrl+` f4"
- [X] picker to select group
- [X] do not close idx.md

## [X] Use Glyph Margin instead of Gutter for icons [abort]
- [X] change the visibilty of the Glyph Margin to true automatically

## [ ] FAIL: Lines with no characters did not get a blank :before
- [ ] try this again and don't lose the working icon functionality

## [X] OK: Lines in idx.md should have a :before icon,
- if line does not have explicit icon, then use a blank so that all lines render equally spaced from the left

## [X] Line icon
- [X] seems to get stuck on green, especially when launched from idx.md
  - [X] make these update faster

## [X] Command to copy all commands and their assigned keys to clipboard with notification
- [X] format the commands into columns
  - [X] keys
  - [X] command name
  - [X] command description
  - [X] when

## [X] Bad filespace detection
- example
	- '| ` i               | idx.openIdx                   | Open/Edit Index File                     | !idxFileActive      |'
	- detection on Open/Edit
  	- [X] filter - unless there is an Open dir with a Edit subdir, they should not be recognized as a filespec

## [X] listing to set keybindings
- [X] format the commands
  - [X] separator: when [orderby when, then command name]
  - [X] label: [key]
  - [X] description: command description
  - [X] detail: command name

## [X] Change Bindings
- [X] idx.returnToIdx: ` r (!idxFileActive)
  - [X] to "` backspace"
- [X] idx.returnToIdxPicker: ` i (!idxFileActive)
  - [X] to "` ctrl+backspace"


## [x] ensure these keybindings are written by default
- [x] idx.gotoFile: f2 (idxCursorOnFileLine)
- [x] idx.openFile: alt+f2 (idxCursorOnFileLine)
- [x] idx.closeFile: f4 (idxCursorOnFileLine)
- [x] idx.returnToIdx: ` backspace (!idxFileActive)
- [x] idx.returnToIdxPicker: ` i (!idxFileActive)
- [x] idx.toggleCheckbox: insert x (always)
- [x] idx.checkboxer: ctrl+alt+f10 (always)

## [X] filspecs with wildcards
- example
	- ./t*.txt
	- these specs can also appear as globs
	- with files matching the spec
    	- picker should provide a listing of open files as a group,
    	- followed by existing files as a group
    	- at the top of list should be an item 'close files' that will offer a multi-select picker
    	- when that picker is done the previous picker should show with its state updated
	- if there are files that are not created
	- then an item at the top would say '{number} of uncreated files'
  		- and choosing that would offer a multi-select picker to create and open selected files
  		- when that picker is done the previous picker should appear with its state updated

-
## [X] Checkbox cycling
- [X] when: always
- [X] current (insert x) should cycle
- [X] [X] => [ ] => [x] =>[X]

## [X] More Checkbox cycling
- [X] when: always
- [X] see ai/S-00035-checkboxer.md
- [X] assign this to key ctrl+alt+f10

## [X] Checkbox cyclers apply to selected text
- [X] if items selected are in different check states, they are synchronized
- [X] all items selected are cycled


## [X] Paint the filespec of a fileline
- [X] for filespec types, color the text
  - [X] fullpath: white
  - [X] relativepath: light grey
  - [X] filenameonly: red
  - [X] parent dependent /filename or /filename.ext: cyan
  - [X] directory unspecified filename.ext: orange
  - [X] folder ./folder or fullpath/folder: yellow
  - [X] wildcard: filenameonly.* or *.ext or /filename.* or or /file*.* or etc: purple

## [X] selections
	- [X] if a selection is not including the full line then that line is not counted in the selection
	- [X] if a selection is including the remainder of aline then that line is counted in the selection
	- [X] if a selection is not present, assume the cursor line is the selection

## [X] multi cursor
- [X] make commands handle multi cursor
- [X] put a list here of commands that are multi cursor
- [X] put a list here of commands that are not multi cursor

## [X] change idx.openFile
- [X] when from idxCursorOnFileLine to idxFileActive
- [X] add to that when - {has selection}
- [X] adjust other commands that work off selection
  - [X] idxCursorOnFileLine may not be true, see selections

## Rename Commands
- [ ] Mark Selected Lines Incomplete => Mark Selected Lines with Checkboxes as Incomplete
- [ ] Mark Selected Lines Complete => Mark Selected Lines with Checkboxes as Complete

## [ ] Operate on selected lines
- [ ] for every filespec in selection, make these commands available
  - [X] OK: openFile
    - [X] should provide multi-picker of open/not open files that match
    	- [ ] NEW: picker should be multi select
    - [X] observed only opening the files withing selection then offering a picker
  - [X] OK: closeFile
    - [X] should ensure all the files in the selected filespecs are closed
  - [X]: gotoFile - offer a picker for which file to open and activate
    - [X] should offer a picker with open files at the top
  - [X] checkCheckbox - picker to choose whether to use X or x
  - [X] uncheckCheckbox
  - [ ] FAIL: removeCheckboxes
    - [ ] when line is a header like
      - '# [ ] ./text2.txt'
      - then the unwanted result is
      - '#./text2.txt'
  - [X] addCheckboxes - picker to choose: unchecked, X or x
  - [ ] FAIL: addCheckboxes - picker to choose: unchecked, X or x
    - [ ] when line is a header like
    - '# ./text2.txt'
    - then the unwanted result is
    - '- [ ] # ./text2.txt'
  - [X] make some of those above into commands as neccessary

## [X] Need two context when flags
- [X] idxFileActive
- [X] idxCursorOnFileLine: idx File is active and current line has a filepath

## Need new commands
- [X] idx.openFile: when - idxCursorOnFileLine - same as idx.gotoFile but no file activation
- [X] idx.closeFile: when - idxCursorOnFileLine - close an open file

## When for commands
- [X] idx.openIdx: when - !idxFileActive
- [X] idx.update: when - idxFileActive
- [X] idx.gotoFile: when - idxCursorOnFileLine
- [X] idx.openFile: when - idxCursorOnFileLine
- [X] idx.closeFile: when - idxCursorOnFileLine
- [X] idx.returnToIdx: when - !idxFileActive
- [X] idx.returnToIdxPicker: when - !idxFileActive
- [X] idx.jumpAny: when - idxFileActive
- [X] idx.jumpWithin: when - idxFileActive
- [X] idx.copyProjectUnlisted: when - none
- [X] idx.copyProjectUnlistedPicker: when - none
- [X] idx.toggleCheckbox: when - idxFileActive
- [X] idx.createMissing: when - idxCursorOnFileLine

## Keys for commands
- [X] idx.openIdx: when - !idxFileActive - "`i"
- [X] idx.update: when - idxFileActive - "F5"
- [X] idx.gotoFile: when - idxCursorOnFileLine - "F2"
- [X] idx.openFile: when - idxCursorOnFileLine - "alt+F2"
- [X] idx.closeFile: when - idxCursorOnFileLine - "F4"
- [X] idx.returnToIdx: when - !idxFileActive - "` i"
- [X] idx.returnToIdxPicker: when - !idxFileActive - "`i"
- [X] idx.jumpAny: when - idxFileActive - "alt+` i"
- [X] idx.jumpWithin: when - idxFileActive - "alt+` alt+i"
- [X] idx.copyProjectUnlisted: when - idxFileActive - "alt+i ctrl+insert"
- [X] idx.copyProjectUnlistedPicker: when - idxFileActive - "alt+i alt+insert"
- [X] idx.toggleCheckbox: when - idxFileActive - "insert x"
- [X] idx.createMissing: when - idxCursorOnFileLine

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
