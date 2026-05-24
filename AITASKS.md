## Need two context when flags
- idxFileActive
- idxCursorOnFileLine: idx File is active and current line has a filepath

## Need new commands
- idx.openFile: when - idxCursorOnFileLine - same as idx.gotoFile but no file activation
- idx.closeFile: when - idxCursorOnFileLine - close an open file

## When for commands
idx.openIdx: when - !idxFileActive
idx.update: when - idxFileActive
idx.gotoFile: when - idxCursorOnFileLine
idx.openFile: when - idxCursorOnFileLine
idx.closeFile: when - idxCursorOnFileLine
idx.returnToIdx: when - !idxFileActive
idx.returnToIdxPicker: when - !idxFileActive
idx.jumpAny: when - idxFileActive
idx.jumpWithin: when - idxFileActive
idx.copyProjectUnlisted: when - none
idx.copyProjectUnlistedPicker: when - none
idx.toggleCheckbox: when - idxFileActive
idx.createMissing: when - idxCursorOnFileLine

## Keys for commands
idx.openIdx: when - !idxFileActive - "`i"
idx.update: when - idxFileActive - "F5"
idx.gotoFile: when - idxCursorOnFileLine - "F2"
idx.openFile: when - idxCursorOnFileLine - "alt+F2"
idx.closeFile: when - idxCursorOnFileLine - "F4"
idx.returnToIdx: when - !idxFileActive - "` i"
idx.returnToIdxPicker: when - !idxFileActive - "`i"
idx.jumpAny: when - idxFileActive - "alt+` i"
idx.jumpWithin: when - idxFileActive - "alt+` alt+i"
idx.copyProjectUnlisted: when - idxFileActive - "alt+i ctrl+insert"
idx.copyProjectUnlistedPicker: when - idxFileActive - "alt+i alt+insert"
idx.toggleCheckbox: when - idxFileActive - "insert x"
idx.createMissing: when - idxCursorOnFileLine

## New Setting
- Eligable Extensions List
  - Comma seperated list of extensions
  - Ordered by preference
  - Default: js,ts,md,txt,json,jsonc
  - Used to determine if a ambiguous filespec is valid
    - Example 'filenameonly'
      - if filenamelonly exists in any workspace directory, then is a valid filespec
        - if multiple matches from different directories occurs then
          - whenever the open/goto file commands offer a picker to choose the directory file to open
          - whenever the returnToIdx/returnToIdxPicker commands occur, then the filespec is generic so that:
            - returning from filenameonly in any workspace directory could return to this filespec
      - if not exists in any workspace dir, the gutter indicator is treated as not a valid filespec, and:
        - the 'open/goto' commands offer a picker to choose the directory to create the file in
          - whenever the returnToIdx/returnToIdxPicker commands cannot occur, since the file does not exist
            - returning from filenameonly in any workspace directory could return to this filespec
    - Example 'filenameonly.*'
      - if filenamelonly.{any ext in ext list} exists in any workspace directory, then is a valid filespec
        - if multiple matches from different exts or directories occurs then
          - whenever the open/goto file commands offer a picker to choose the file ext, then a picker for the directories is offered if neccessary to determin the file
          - whenever the returnToIdx/returnToIdxPicker commands occur, then the filespec is generic so that:
            - returning from filenameonly.{any ext in list} in any workspace directory could return to this filespec
              - offer a picker to choose whether to return to matching filespecs
      - if filenameonly.{any ext in ext list} not exists in any workspace dir, the gutter indicator is treated as not a valid filespec, and:
        - the 'open/goto' commands offer a picker to the ext to create and a picker choose the directory to create the file in
          - whenever the returnToIdx/returnToIdxPicker commands cannot occur, since the file does not exist but
            - if the file returning from is a filename.{ext not in ext list} then offer a picker of all eligable filespecs
            - returning from filenameonly.{ext not in ext list} in any workspace directory could return to this filespec
## Other filespecs
- Example: filename.ext
  - will match any filename.ext in any workspace directory
  - use a square of proper color in the gutter
  - use some other shape of proper color for multiple matches
  - for open/goto file command use a picker to differentiate mmultiple matches from different dirs
    - whenever the returnToIdx/returnToIdxPicker commands occur, then the filespec is generic so that:
      - if the file returning from is a filename.ext then offer a picker of all eligable filespecs
      - returning from filename.ext in any workspace directory could return to this filespec
## Directory filespecs on files
- Example: filename.ext
  - multi directory, as described above
- Exmple: ./filename.ext
  - proper relative path, treat it as such
- Exmple: /filename.ext
  - directory is inherited from a folderspec found as a parent, example:
    - ./parentfolder
      - random text lines (optional)
      - /filename.ext
    - the sythesized path would be:
      - ./parentfolder/filename.ext
## Colors for multi-matching filelines
- if any are open then green
- if none are open and any exist then white

## Implement these and update the UPPERCASE.md files