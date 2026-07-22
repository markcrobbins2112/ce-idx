---
title: SPEC
---

<!-- # TEMPLATE: SPEC.template.md -->
<!--
# SPEC
# Any text bounded by double curly braces {{like this}} is a placeholder for you to fill out.
# Replace those placeholders with real paths, rules, and project constraints.
#
# INSTRUCTIONS FOR THE AI AGENT:
# This file tracks formal specifications, comparing originally requested guidelines
# against actual implemented items. Document architectural challenges, optimization rules,
# compatibility constraints, and platform limits.
-->

<!-- markdownlint-disable MD013 -->

# SPEC
<a id="a-spec"></a>[TOC](#toc-spec)

This document compiles the user requirements and instructions from `AGENTS.md` and related files and provides detailed documentation of how the extension was architected and built.


## 📑 AI Primary Files
<a id="a-aiprimaryfiles"></a>[TOC](#toc-aiprimaryfiles)
- 🔹 [AGENTS.md](../AGENTS.md)
- 🔹 [ARCHIVE.md](ARCHIVE.md)
- 🔹 [BUILD.md](BUILD.md)
- 🔹 [CODE.md](CODE.md)
- 🔹 [DESIGN.md](DESIGN.md)
- 🔹 [FEATURES.md](FEATURES.md)
- 🔹 [LOG.md](LOG.md)
- 🔹 [MANUAL.md](MANUAL.md)
- 🔹 [README.md](../README.md)
- 🔸 [SPEC.md](SPEC.md)
- 🔹 [TASKS.md](TASKS.md)
- 🔹 [TERMS.md](TERMS.md)
- 🔹 [TESTING.md](TESTING.md)
- 🔹 [VERSIONS.md](VERSIONS.md)

---

<!-- TOC location -->
## 🔍 Table of Contents
<!-- Maintained by script -->
- [SPEC](#a-spec) <a id="toc-spec"></a> ^toc-spec
  - [📑 AI Primary Files](#a-aiprimaryfiles) <a id="toc-aiprimaryfiles"></a> ^toc-aiprimaryfiles
  - [🔗 External Application Protocols & URI Schemes](#a-externalapplicationprotocolsurischemes) <a id="toc-externalapplicationprotocolsurischemes"></a> ^toc-externalapplicationprotocolsurischemes
  - [💻 Native OS Integration Details](#a-nativeosintegrationdetails) <a id="toc-nativeosintegrationdetails"></a> ^toc-nativeosintegrationdetails
  - [📋 Originally Requested Specifications](#a-originallyrequestedspecifications) <a id="toc-originallyrequestedspecifications"></a> ^toc-originallyrequestedspecifications
  - [🎯 Implemented Technical Concerns & Optimization Features](#a-implementedtechnicalconcernsoptimizationfeatures) <a id="toc-implementedtechnicalconcernsoptimizationfeatures"></a> ^toc-implementedtechnicalconcernsoptimizationfeatures
  - [🚦 Internal Function Signatures & System Exit Codes](#a-internalfunctionsignaturessystemexitcodes) <a id="toc-internalfunctionsignaturessystemexitcodes"></a> ^toc-internalfunctionsignaturessystemexitcodes
    - [Data Models & State Layouts](#a-datamodelsstatelayouts) <a id="toc-datamodelsstatelayouts"></a> ^toc-datamodelsstatelayouts
  - [🚀 Go to...](#a-goto) <a id="toc-goto"></a> ^toc-goto
---
## 🔗 External Application Protocols & URI Schemes
<a id="a-externalapplicationprotocolsurischemes"></a>[TOC](#toc-externalapplicationprotocolsurischemes)

<!-- template: link contract
### {{Protocol/Application Name}} Link Contract
<a id="a-protocolapplicationnamelinkcontract"></a>[TOC](#toc-protocolapplicationnamelinkcontract)
- **Target Schema:** `{{schema://action}}`
- **Query String Map:**

  | Parameter | Type | Required | Description / Constraints |
  | :--- | :--- | :--- | :--- |
  | `{{param1}}` | `{{String}}` | Yes | {{Absolute target path. Must be URL-encoded (UTF-8).}} |
  | `{{param2}}` | `{{String}}` | No | {{Optional workspace name override fallback logic.}} |
-->

---

## 💻 Native OS Integration Details
<a id="a-nativeosintegrationdetails"></a>[TOC](#toc-nativeosintegrationdetails)

<!-- template: config
### Registry / Configuration Mappings
<a id="a-registryconfigurationmappings"></a>[TOC](#toc-registryconfigurationmappings)
- **System Hook Target:** `{{HKEY_CLASSES_ROOT\Directory\shell\YourAction}}`
- **Properties Mapping:**
  - `{{KeyName}}` (Default): `"{{Action Display Name}}"`
  - `"{{Icon}}"`: `{{REG_SZ}}` absolute path to targeted graphic resource asset.
-->

<!-- template: file attr
### File & Folder Attribute Masks
<a id="a-filefolderattributemasks"></a>[TOC](#toc-filefolderattributemasks)
- **Configuration Context Target:** `{{filename.ext}}` (Must be set to `{{+H}}` Hidden and `{{+S}}` System).
- **Directory Workspace Parent:** Must have the `{{+R}}` Read-Only flag set for host engine processing loop.
-->

---

## 📋 Originally Requested Specifications
<a id="a-originallyrequestedspecifications"></a>[TOC](#toc-originallyrequestedspecifications)

<!-- template: request
- **{{Request Guideline Title}}**: {{Describe originally listed conditions, specifications, and layout bounds}}
-->

---

## 🎯 Implemented Technical Concerns & Optimization Features
<a id="a-implementedtechnicalconcernsoptimizationfeatures"></a>[TOC](#toc-implementedtechnicalconcernsoptimizationfeatures)

<!-- template: optimization
- **{{Optimization / Safety Feature Name}}**:
  - **The Problem**: {{Details}}
  - **The Solution / Code Implementation**: {{Details}}
-->

---

## 🚦 Internal Function Signatures & System Exit Codes
<a id="a-internalfunctionsignaturessystemexitcodes"></a>[TOC](#toc-internalfunctionsignaturessystemexitcodes)

<!-- template: status codes
### Engine Error / Exit Status Codes
<a id="a-engineerrorexitstatuscodes"></a>[TOC](#toc-engineerrorexitstatuscodes)

| Code (Integer) | Semantic Definition | Trigger Condition |
| :--- | :--- | :--- |
| `0` | `Success` | Complete flawless lifecycle termination. |
| `1` | `{{ERR_MISSING_ARGS}}` | Script executed without critical incoming command-line arguments. |
| `2` | `{{ERR_ENV_UNDEFINED}}` | Target environment variables were unreadable, corrupt, or blank. |
| `3` | `{{ERR_PATH_NOT_FOUND}}` | Physical asset disk lookup evaluation loop failed. |
| `4` | `{{ERR_LINK_COLLISION}}` | Colliding structural link or directory target already occupied. |
-->

---
### Data Models & State Layouts
<a id="a-datamodelsstatelayouts"></a>[TOC](#toc-datamodelsstatelayouts)

<!-- template: data layout
<details>
<summary>🖥️ INI</summary>

```ini
; Expected raw configuration template dataset example
[{{SectionHeader}}]
{{KeyName}}={{C:\Path\To\Asset.ext}}
{{IndexName}}={{0}}
```

</details>
-->

---

## 🚀 Go to...
<a id="a-goto"></a>[TOC](#toc-goto)
- 🔹 [AGENTS.md](../AGENTS.md)
- 🔹 [ARCHIVE.md](ARCHIVE.md)
- 🔹 [BUILD.md](BUILD.md)
- 🔹 [CODE.md](CODE.md)
- 🔹 [DESIGN.md](DESIGN.md)
- 🔹 [FEATURES.md](FEATURES.md)
- 🔹 [LOG.md](LOG.md)
- 🔹 [MANUAL.md](MANUAL.md)
- 🔹 [README.md](../README.md)
- 🔸 [SPEC.md](SPEC.md)
- 🔹 [TASKS.md](TASKS.md)
- 🔹 [TERMS.md](TERMS.md)
- 🔹 [TESTING.md](TESTING.md)
- 🔹 [VERSIONS.md](VERSIONS.md)

<!-- # TEMPLATE: SPEC.template.md -->
