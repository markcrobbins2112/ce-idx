---
title: S-00035-checkboxer
description:
zdot: z.202605161942557398
created: 2026-05-16 23:42
updated: 2026-05-16 23:42
completed: 2026-05-18 00:51
tags:


---

# S-00035-checkboxer

## Technical Specification
- [X] OK: Bug [[B-00001,S-00035-prefix-keeps-accumulating-for-checkboxer]]
- [X] OK: Bug [[B-00001,S-00035-have-unwanted-zdots-in-the-cycle]]
- [X] OK: BUG [[B-00001,S-00035-cycling-cannot-go-to-small-x-items]]



Toggles through Labels of a bulleted item in markdown file:
If the line the cursor is on is bulleted, toggle cycles through:
### Start cycle 1
- some text
- [ ] some text
- [ ] NEW: some text
- [X] some text
- [X] OK: some text
- [X] FIXED: some text
- [ ] FAIL: some text
- [ ] FIX: some text
End cycle 1 - return to start
### Start cycle 2
- [x] some text
- [X] some text
End Cycle 2 join cycle 1 at [X] OK:

### Start cycle 3
- [x] FAIL: some text
- [X] OK: some text
End Cycle 3 join cycle 1 at [X] FIXED:

### Start cycle 4
- [x] FIX: some text
- [X] OK: some text
End Cycle 4 join cycle 1 at [X] FIXED:


In markdown file:
- [x] NEW: Remove Bind to Alt+F10 space
- [x] NEW: Remove Bind to Ctrl+Alt+space
- [x] NEW: Bind to Ctrl+Alt+F10


### Tests for To do tree AI Ignore
### Test 1
start
- ok
end


### Paint Tests for To do tree AI Ignore
- some text
- [ ] check
- [ ] FAIL: check
- [ ] FIX: check
- [ ] OK: error
- [ ] FIXED: error
- [ ] NEW: star

- [X] check
- [X] FAIL: alert
- [X] FIX: alert-solid
- [X] OK: shield-check
- [X] FIXED: checkbox
- [X] NEW: star

- [x] check
- [x] FAIL: check-circle
- [x] FIX: check-circle
- [x] OK: alert-fill
- [x] FIXED: alert
- [x] NEW: star




## Infrastructure

## Performance Requirements