---
title: CODE
---

<!-- # TEMPLATE: CODE.template.md -->
<!--
# CODE
# Any text bounded by double curly braces {{like this}} is a placeholder for you to fill out.
# Replace those placeholders with real paths, rules, and project constraints.
#
# INSTRUCTIONS FOR THE AI AGENT:
# This file governs programming guidelines, syntax conventions, indentation (tabs vs spaces),
# ordering, and regions formatting. Every single code file must adhere strictly to these rules!
-->

<!-- markdownlint-disable MD013 -->

# CODE
<a id="a-code"></a>[TOC](#toc-code)

## 📑 AI Primary Files
<a id="a-aiprimaryfiles"></a>[TOC](#toc-aiprimaryfiles)
- 🔹 [AGENTS.md](../AGENTS.md)
- 🔹 [ARCHIVE.md](ARCHIVE.md)
- 🔹 [BUILD.md](BUILD.md)
- 🔸 [CODE.md](CODE.md)
- 🔹 [DESIGN.md](DESIGN.md)
- 🔹 [FEATURES.md](FEATURES.md)
- 🔹 [LOG.md](LOG.md)
- 🔹 [MANUAL.md](MANUAL.md)
- 🔹 [README.md](../README.md)
- 🔹 [SPEC.md](SPEC.md)
- 🔹 [TASKS.md](TASKS.md)
- 🔹 [TERMS.md](TERMS.md)
- 🔹 [TESTING.md](TESTING.md)
- 🔹 [VERSIONS.md](VERSIONS.md)

---

<!-- TOC location -->
## 🔍 Table of Contents
<!-- Maintained by script -->
- [CODE](#a-code) <a id="toc-code"></a> ^toc-code
  - [📑 AI Primary Files](#a-aiprimaryfiles) <a id="toc-aiprimaryfiles"></a> ^toc-aiprimaryfiles
  - [🛠️ Implementation Guidelines](#a-implementationguidelines) <a id="toc-implementationguidelines"></a> ^toc-implementationguidelines
  - [📝 Markdown Guidelines](#a-markdownguidelines) <a id="toc-markdownguidelines"></a> ^toc-markdownguidelines
  - [✒️ Formatting & Syntax Style](#a-formattingsyntaxstyle) <a id="toc-formattingsyntaxstyle"></a> ^toc-formattingsyntaxstyle
  - [🛡️ Robustness & Error-Handling Frameworks](#a-robustnesserrorhandlingframeworks) <a id="toc-robustnesserrorhandlingframeworks"></a> ^toc-robustnesserrorhandlingframeworks
  - [📂 Regions Division Style](#a-regionsdivisionstyle) <a id="toc-regionsdivisionstyle"></a> ^toc-regionsdivisionstyle
  - [🚀 Go to...](#a-goto) <a id="toc-goto"></a> ^toc-goto
---
## 🛠️ Implementation Guidelines
<a id="a-implementationguidelines"></a>[TOC](#toc-implementationguidelines)
- **Encoding Safety**: Preserve UTF-8 signatures. Ensure icons, characters, emojis, and unicode symbols are written cleanly without corruption (mojibake).
- **Target Changes Only**: Avoid complete file rewrites. Prefer minor, highly precise surgical patches to retain existing code blocks and comments intact.

---

## 📝 Markdown Guidelines
<a id="a-markdownguidelines"></a>[TOC](#toc-markdownguidelines)
- Use dashes (`-`) instead of asterisks (`*`) for Bullet list items.
- Maintain UPPERCASE.md documents cleanly with alphabetical features lists, updated logs, and checked backlogs.
- **TOC and Section Linking Format**:
  All headers must use the explicit anchor ID format prefixed with `a-` and `toc-` respectively. Below each header, insert the matching TOC locator:
  ```markdown
  ## My Header
  <a id="a-myheader"></a>[TOC](#toc-myheader)
  ```
  And in the Table of Contents, each item must be formatted exactly as:
  ```markdown
  - [My Header](#a-myheader) <a id="toc-myheader"></a> ^toc-myheader
  ```
- **TOC Indentation & Nesting Rules**:
  TOC bullet list items must be hierarchically indented according to their heading level:
  - Establish a 0-indent baseline using the minimum heading level in the document (usually `##`).
  - Indent sub-headers by exactly 2 spaces per nesting level (e.g., `  - [Sub Heading](#a-subheading)...` for `### Sub Heading`).
- **No Leftover/Redundant Anchors**:
  Always ensure there is only a single `<!-- TOC location -->` marker block and eliminate legacy forms like `[TOC](#table-of-contents)`.
- **Unique Heading IDs (Serialization to prevent MD024 violations)**:
  Duplicate heading content is strictly prohibited. To prevent collisions, duplicate headings must be programmatically or manually serialized:
  - **Log Entry Subheadings**: Subheadings of log entries (e.g., `🎯 Primary Goals & Requirements`, `🛠️ Completed Changes in this Session`, `🔸 Affected Files` occurring under a log entry parent header like `### 📅 [YYYY-MM-DDTHH:MM:SSZ]`) must have the log entry's sanitized timestamp appended directly to their anchor IDs (e.g., `<a id="a-primarygoalsrequirements20260722t071100z"></a>[TOC](#toc-primarygoalsrequirements20260722t071100z)`).
  - **Other Duplicate Headings**: All other duplicate headings in a file must be made unique by appending an incremental index suffix starting with `-1` (e.g., `a-settings`, `a-settings-1`, `a-settings-2`).
- **Standard Heading Increments (MD001 & MD002)**: Headings must start with a level 1 title (`# TITLE`) and increment sequentially by exactly one level at a time (e.g., never jump directly from `#` to `###`).
- **No Bare URL Links (MD034)**: Never print raw URLs directly in paragraph text. Always wrap raw URLs in angle brackets (e.g., `<https://example.com>`) or form standard markdown links (e.g., `[Example](https://example.com)`).
- **Inline HTML Tag Limitations (MD033)**: Limit inline HTML elements to explicitly permitted tags (e.g., `<a>`, `<br>`, `<details>`, `<div>`, `<summary>`, `<span>`, `<img>`, etc.). Disallowed inline elements must not be used.
- **Spaces Surrounding List Items (MD030)**: Ensure there is exactly one space after a list bullet marker (`-`) or order number.
- **Horizontal Rule Consistency (MD035)**: Always use a consistent character and spacing format for horizontal dividers (e.g., `---`).
- **No Trailing Spaces (MD009)**: Do not leave trailing whitespaces at the end of lines, unless explicitly using 2 spaces to declare a hard break.
- **Code Block Fences inside Details**:
  Fenced code blocks inside `<details>` elements must specify a language identifier and be surrounded by blank lines:
  ```markdown
  <!-- enclosing all fences -->
  <details>
      <summary>Summary Title<!-- use lang from fence --></summary>

  ```json
  {
      // MD040: Fenced code blocks must specify a language identifier
      "MD040": true,

      // MD031: Fenced code blocks must be surrounded by blank lines
      "MD031": true
  }
  ```

  </details>
  ```
- **Testing Command References**:
  In `TESTING.md` (and elsewhere), if you reference a command to test (e.g., `shard.formatRegionsOfFile`), do NOT use standard backtick code formatting (e.g., `` `shard.formatRegionsOfFile` ``). Instead, format it as an absolute tool copy link:
  `[shard.formatRegionsOfFile](aip://copy/shard.formatRegionsOfFile)`.
- **Testing File References**:
  In `TESTING.md` (and elsewhere), if you reference a file (e.g., `/test.jsonc`), do NOT use standard backtick code formatting (e.g., `` `/test.jsonc` ``). Instead, format it as a standard markdown link relative to the folder (e.g., `[../test.jsonc](../test.jsonc)`).
- **Comment-Based Templates Guideline**:
  - **File-Level Template Designation**: Each file managed by a template must declare its upstream template link at the top using `<!-- # TEMPLATE: Filename.template.md -->`. This indicates the file is governed by structured standards and can be synchronized.
  - **Inline Block Templates**: Utilize standard inline comments like `<!-- template: component-name ... -->` as reusable blueprints that can be copy-pasted and instantiated to preserve consistent, repeatable structures (e.g., log entries, active tasks, features).
  - **Placeholder Interpolation**: Double curly braces `{{placeholder}}` indicate configurable/dynamic entries. Populating them with real, concrete values (e.g., package names, specific constraints) completes the template instantiation process.

---

## ✒️ Formatting & Syntax Style
<a id="a-formattingsyntaxstyle"></a>[TOC](#toc-formattingsyntaxstyle)
- **Indentation**: {{Specify spacing preference [e.g., "Use tabs for indentation" or "Use 2 spaces"]}}
- **Braces and Blocks**: {{Specify structural block guidelines [e.g., "Always use braces for control expressions, never inline single-line statements without brackets"]}}
- **Naming Conventions**: {{Specify casing for variables, functions, and files [e.g., camelCase, PascalCase, snake_case]}}
- **Global Function Ordering**: {{Specify function ordering policies [e.g., "Order alphabetically" or "Listed immediately after dependencies"]}}

---

## 🛡️ Robustness & Error-Handling Frameworks
<a id="a-robustnesserrorhandlingframeworks"></a>[TOC](#toc-robustnesserrorhandlingframeworks)
- **Primary Paradigm:** {{Specify failure capturing, e.g., Structured Try/Catch blocks, return tuples, or local error code checking values}}
- **Defensive Coding Checks:** Always validate that external dependencies, arguments, and file paths exist before performing destructive disk mutations.
- **Logging Integration:** Failures must write details to stderr or an internal diagnostics log before terminating execution.
- **Inline Comments:** Document the "Why" behind complex code logic or architectural workarounds. Do not explain obvious language features.

---

<!--
  INSTRUCTION: Specify standard regions delimiters (#region / #endregion)
  and naming rules to group structures systematically.
-->
## 📂 Regions Division Style
<a id="a-regionsdivisionstyle"></a>[TOC](#toc-regionsdivisionstyle)
- **Structures**: Wrap classes or data blocks inside system structures regions named `_globals`, `_classes`, or custom container dividers.
- **Example Regions Map**:
  ```text
  // #region _globals
  const g_settingX = "Value";
  // #endregion

  // #region _classes
  class Handler { ... }
  // #endregion
  ```

---
## 🚀 Go to...
<a id="a-goto"></a>[TOC](#toc-goto)
- 🔹 [AGENTS.md](../AGENTS.md)
- 🔹 [ARCHIVE.md](ARCHIVE.md)
- 🔹 [BUILD.md](BUILD.md)
- 🔸 [CODE.md](CODE.md)
- 🔹 [DESIGN.md](DESIGN.md)
- 🔹 [FEATURES.md](FEATURES.md)
- 🔹 [LOG.md](LOG.md)
- 🔹 [MANUAL.md](MANUAL.md)
- 🔹 [README.md](../README.md)
- 🔹 [SPEC.md](SPEC.md)
- 🔹 [TASKS.md](TASKS.md)
- 🔹 [TERMS.md](TERMS.md)
- 🔹 [TESTING.md](TESTING.md)
- 🔹 [VERSIONS.md](VERSIONS.md)

<!-- # TEMPLATE: CODE.template.md -->
