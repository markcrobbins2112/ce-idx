<!-- markdownlint-disable MD013 -->
# AGENTS

## Application
- create a vscode extension called 'idx'

## Specifications
- All detailed functional requirements, UI parameters, features, commands, and implementation details have been moved to [SPEC.md](./SPEC.md). Please refer to SPEC.md for full context on how this extension is designed and built.

## Markdown
- Use dashes instead of asterisks for bullet items
- When completing a task, always use a lowercase x (e.g., `[x]`) for checkbox lists. This applies ONLY to tasks completed in the active development session. Pre-existing tasks completed in previous sessions that are marked with uppercase `X` (e.g., `[X]`) must be preserved and NOT converted to lowercase `x` or otherwise altered.
- Always update UPPERCASE.md files (such as AITASKS.md, AILOG.md, etc.) when tasks are completed or work is performed

## File Restrictions
- Do not create new files, only work on the uploaded files.
- Do NOT alter `unzip-latest.js`, `tsconfig.json`, `build.js`, or `.gitignore`.
- **package.json**: Only modify `activationEvents` and `contributes` fields. Do NOT change scripts, dependencies, or other fields unless explicitly requested.

### Inline Tasks
- comments in the form of //! {instructions} found in ts code are AI Tasks

## Project Context
- **Test Fixture**: The `test-fixture` directory is not part of the application code; it is used exclusively for testing purposes and AI interaction.

## Implementation Guidelines
- **Encoding Safety**: Preserve UTF-8 encoding and avoid bulk read/write rewrites of `extension.js` (or other icon-heavy files) that can corrupt emoji/icon literals (mojibake). Prefer small targeted patches, and after icon-related edits run lint and quickly verify shared icon constants still render correctly.

- **Linter & Build**: Always run `lint_applet` after edits before finishing your turn.

## Coding Style
- **Indentation**: Use tabs for indentation.
- **Braces**: Always use braces for control structures (if, for, while, etc.).

### Typescript Code Style
- use <https://google.github.io/styleguide/tsguide.html#container-classes>
  - except Container Classes - which we want

### Container Classes
```js
class TheContainer {
	static const val = 1;
	static fn() {}
}
```
- but no globals
```js
const val = TheContainer.val;
const fn = TheContainer.fn;
```
- use like this
```js
function x() {
	const Tc_ = TheContainer;
	Tc_.fn();
}
```
- not like this
```js
function x() {
	TheContainer.fn();
}
```

## Static methods
- Use static methods
```js
class StaticMethods() {
	static method() {}
}
```
- not
```js
StaticMethods.method = function () {}
```

### Avoid static this references
- this is fine, allowed

## JsDocs

### Use when possible
- @exports
- @imports

- @param
- @returns
- @callback
- @throws

- @enum
- @type
- @typedef

- @global
- @class
- @extends
- @static
- @private
- @protected
- @public
- @override
- @readonly
- @satisfiees
- @template

- @constructor
- @var
- @member
- @memberof
- @property

- @see
- @todo
- @example

### Types of class members
- use @var for members that are values
- use @member for members that are functions
- use @property for members that are get/set


### Type Expressions
- always use type expressions in jsdocs
  - @member {readonly ActionsTargetTypes} allowedTargetTypes

### JsDoc Layout
```js
/** {brief title}
 * {long description}
 * {more}
 * {@example}
 * {@see}
 */
```

## Global Function Ordering
- if in a region, order by dependency within the region, meaning a function is listed after the ones it is dependent on
- not in a region, order by dependency
- if no dependencies, order alphabetically

## Regions
- classes are to be kept in a region named _classes
- classes are to be wrapped in a region named _class_{classname}

### Regions inside classes
- _class_{classname}_types
- _class_{classname}_vars
- _class_{classname}_properties
- _class_{classname}_members
- _class_{classname}_ctor
- _class_{classname}_functions
