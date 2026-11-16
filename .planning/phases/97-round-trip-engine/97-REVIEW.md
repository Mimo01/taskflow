---
phase: 97-round-trip-engine
reviewed: 2026-11-16T19:43:07Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - taskflow/src/lib/wiki/editor/emit.ts
  - taskflow/src/lib/wiki/editor/engine.ts
  - taskflow/src/lib/wiki/editor/escape.ts
  - taskflow/src/lib/wiki/editor/index.ts
  - taskflow/src/lib/wiki/editor/schema.ts
  - taskflow/src/lib/wiki/editor/types.ts
  - taskflow/src/lib/wiki/editor/parse/blocks.ts
  - taskflow/src/lib/wiki/editor/parse/color.ts
  - taskflow/src/lib/wiki/editor/parse/inline.ts
  - taskflow/src/lib/wiki/editor/parse/lists.ts
  - taskflow/src/lib/wiki/editor/parse/macros.ts
  - taskflow/src/lib/wiki/editor/parse/marks.ts
  - taskflow/src/lib/wiki/editor/parse/panels.ts
  - taskflow/src/lib/wiki/editor/parse/source.ts
  - taskflow/src/lib/wiki/editor/parse/tables.ts
  - taskflow/src/lib/wiki/pipeline.ts
  - taskflow/src/lib/wiki/preprocess.ts
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/package.json
findings:
  critical: 5
  warning: 9
  info: 5
  total: 19
status: issues_found
---

# Phase 97: Code Review Report

**Reviewed:** 2026-11-16T19:43:07Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

The load path holds up. `parseWiki` followed by `emitWiki` reproduces unedited text, and when it does not, `loadWiki` demotes the block or fails. `saveWiki` returns the original for an unchanged doc. The problems are in two places:

1. **The renderer changes.** The new panel-family rewrite regresses panels that open mid-line (inside list items or paragraphs). Panel titles and color values are copied into HTML attributes without escaping, so a user can forge the new `data-wiki-headerless` marker and delete a real table header row.
2. **The emitter on edited documents.** This is the Phase 98 input. Schema-valid docs lose content (raw atoms inside list items or cells), corrupt tables (an empty cell emits `||`), and typed literal text turns into mentions, images or macros on save. When escaping cannot reproduce the doc, the emitter silently keeps the plain text, and `saveWiki` never re-checks what it writes.

Every BLOCKER and most WARNINGs below were reproduced with scratch scripts (jiti) against the current tree. The outputs are quoted inline.

## Critical Issues

### CR-01: Panel rewrite breaks panels that open mid-line (list items, paragraphs, headings): regression

**File:** `taskflow/src/lib/wiki/preprocess.ts:988-1010`
**Issue:** Panels that are not in a table row are now emitted as `<div …>\n\n${body}\n\n</div>`. When the opener is mid-line, the blank lines split the surrounding markdown block. The list is cut short and later items render as literal text. Before (at 13666a35) vs now:

```
"* item one {note}nested{note} tail\n* item two"
OLD: <ul><li>item one <div data-callout="note">nested</div> tail</li><li>item two</li></ul>
NEW: <ul><li>item one <div data-callout="note"></div></li></ul><p>nested</p> tail * item two

"# step {warning}careful{warning}\n# step two"
NEW: <ol><li>step <div data-callout="warning"></div></li></ol><p>careful</p>1. step two
```

Paragraph openers (`Intro {info}x{info} and …`) also produce an empty `<p></p>` inside the callout, and the text after the closer ends up outside any paragraph.
**Fix:** Use the blank-line-wrapped block form only when the opener starts its line and the closer ends its line. Otherwise keep the inline form, as `inTableRow` already does:

```ts
const ownLine = (str: string, offset: number, len: number) =>
  (offset === 0 || str[offset - 1] === '\n') &&
  (offset + len === str.length || str[offset + len] === '\n');
// inTableRow(...) || !ownLine(str, offset, m.length) ? <span …> / inline <div> : block <div>
```

### CR-02: Unescaped `"` in panel titles and color values allows HTML attribute injection, including forging `data-wiki-headerless`

**File:** `taskflow/src/lib/wiki/preprocess.ts:223-234, 995-1009, 1040-1046`; `taskflow/src/lib/wiki/pipeline.ts:183-201`; claim at `preprocess.ts:363-365`
**Issue:** The raw-source escape (line 720) only covers `& < >`. Titles (`[^}]+`) and color values are then pasted into `data-title="${title}"` / `data-color="${hex}"`, so a `"` closes the attribute and the rest of the title becomes new attributes. The comment at 363-365 says the headerless marker "cannot be typed". It can, and `rehypeDropHeaderlessThead` then deletes a real, user-authored header row. Reproduced:

```
'||Secret header{info:title=x" data-wiki-headerless="1}a{info}||h2||\n|c|d|'
-> <table><tbody><tr><td>c</td><td>d</td></tr></tbody></table>   (header row gone)
'||H1{color:red" data-wiki-headerless="}z{color}||H2||\n|c|d|'   -> same
'{info:title=a" id="x" tabindex="1" aria-label="pwn}body{info}'
-> <div data-callout="info" data-title="a" id="user-content-x" tabindex="1">
```

No script runs, because sanitize still applies. But attacker-controlled attributes reach the sanitized tree, and the stated marker invariant does not hold. Titles may also contain `\n\n`, which ends the HTML block early.
**Fix:** Attribute-escape every interpolated value, and restrict the marker match to the injected position:

```ts
const attr = (s: string) => s.replace(/"/g, '&quot;').replace(/\n/g, ' ');
`<div data-callout="${type}" data-title="${attr(title)}">`
`<span data-color="${attr(hex)}">`
```

Also make `hasHeaderlessMarker` check only `thead > tr > th:first-child > span` instead of searching the whole subtree.

### CR-03: Emitter drops or flattens non-paragraph blocks inside list items and table cells (data loss)

**File:** `taskflow/src/lib/wiki/editor/emit.ts:288-296` (listSegments), `339-353` (cellSegments)
**Issue:** The schema allows `listItem: paragraph block*` and `tableCell: block+`. The emitter only handles paragraphs, nested lists and cell panels. Every other block goes through `inlineSegments(kid.content)` or `prose(textOf(kid))`. A `rawBlock` has no `content`, so its `raw` text disappears. Code blocks, tables, quotes and headings lose their structure. Reproduced:

```
listItem[p("a"), codeBlock("x = 1"), rawBlock("{status:x}")]  -> "* a\nx = 1\n"   ({status:x} lost)
tableCell[rawBlock("{foo}")]                                    -> "||"           (content lost, row corrupted)
```

**Fix:** Emit non-inline children through `blockSegments`/`emitBlockNode`. For constructs wiki cannot express inside an item or cell, throw or return a failure so the caller keeps source mode. Never write `textOf`. At minimum, `rawBlock` must always emit `attrs.raw`.

### CR-04: Empty table cells emit `||`, and cell hard breaks emit a raw newline (table corruption on common edits)

**File:** `taskflow/src/lib/wiki/editor/emit.ts:356-370`, `36-37`
**Issue:** User-created cells and parsed cells with no padding have `padL = ''`. Clearing such a cell, or adding a row/column in the editor, emits `|a||c|`. Jira reads `||` as a header separator, and the parser rejects the row as mixed, so the table becomes raw. A `hardBreak` created in the editor has `src: null`, which falls back to `'\n'`. Inside a cell that splits the row, and in a header row it breaks the table outright. Reproduced: `|a||c|` → rawBlock; `||a\nb||c||` → rawBlock.
**Fix:** In `cellSegments`, emit `' '` when the emitted cell text is empty and `padL`/`padR` are both empty. Emit `hardBreak` with `src == null` as `\\\\` when the context is `cell`, and preferably in every context other than paragraph.

### CR-05: Typed literal text that re-parses as an atom becomes live markup on save (mentions, images, attachments, macros, emoticons)

**File:** `taskflow/src/lib/wiki/editor/emit.ts:194-205` (display), `225-236` (inlineSegments)
**Issue:** `display()` represents an atom by its source spelling. So a text node `[~admin]` and a mention atom whose `src` is `[~admin]` look the same, `fits(plain)` passes, and nothing is escaped. Reproduced, with every case re-parsing as an atom:

```
"ping [~admin] now"                -> text,mention,text      (Jira notifies admin)
"img !http://e.example/p.png! x"   -> text,image,text        (external image load)
"a [^secret.pdf] b"                -> text,attachment,text
"macro {status:colour=Red} x"      -> text,rawInline,text
"see (x) here"                     -> text,emoticon,text
```

This breaks SAFE-06 ("typed text is never read as markup").
**Fix:** Make `display` tell atoms apart from text, for example `return '\u0001' + n.type + ':' + src + '\u0001'` for non-text nodes. Then a text-vs-atom mismatch fails `fits` and the existing escape pass adds `\[` / `\!` / `\{`. Add `(` handling (emoticons) to the escape table.

## Warnings

### WR-01: Unexpressible edits fall back silently to "leave as typed", and saveWiki never verifies its output

**File:** `taskflow/src/lib/wiki/editor/emit.ts:258-259, 93-104`; `taskflow/src/lib/wiki/editor/engine.ts:93-95`
**Issue:** When escaping cannot reproduce the doc, `inlineSegments` returns the plain emission. Reproduced corruptions:

- bold over `" hello"` → `x* hello*y` (literal asterisks)
- intraword italic → `x_a_y`
- bold across a hardBreak → `*one\ntwo*`. The editor re-parses this as literal text, but the renderer shows `<em>` (italic).
- mono containing `}` → `{{a}b}}` (re-parses as a rawInline macro)
- link href containing `]` → `[t|https://x/a]b]` (href truncated)

`saveWiki` returns this text with no check.
**Fix:** Fall back to brace forms (`{*}…{*}`, `{_}…{_}`) for marks at word or whitespace boundaries, and trim whitespace out of mark ranges. Reject or encode `]`/`|` in hrefs. In `saveWiki`, re-parse the emitted text and compare it structurally with `current` (ignoring spelling attrs). On mismatch, return a failure so Phase 98 can warn or switch to source mode instead of writing corrupted text.

### WR-02: Recorded spellings override edited attributes (edits silently dropped)

**File:** `taskflow/src/lib/wiki/editor/emit.ts:47, 52, 61, 96, 435`
**Issue:** `mention` emits `attrs.src` before `attrs.id`. The same happens for image `name/params`, attachment `name/label`, color `open` over `value`, and code `open` over `language`. If Phase 98 changes the attribute but not `src`/`open` (the natural `updateAttributes({id})`), the old spelling is written back. The change of person, image or language disappears without any signal.
**Fix:** Use the recorded spelling only when it still encodes the current attributes, for example re-derive `id` from `src` and compare. Otherwise emit the canonical form. For color, use `open` only if `COLOR_OPEN.exec(open)?.[1] === value`.

### WR-03: Code/noformat body containing its own closer is emitted unguarded

**File:** `taskflow/src/lib/wiki/editor/emit.ts:433-439`
**Issue:** A user typing `{code}` inside a code block produces `{code}\na\n{code}\n*b*\n{code}`. The block ends early and the rest is read as wiki markup (`*b*` becomes bold).
**Fix:** If the body contains `{code}`, switch the wrapper to `{noformat}`, and the reverse. If it contains both, refuse to emit (fail the save).

### WR-04: Emitter writes unvalidated attribute values into macro syntax

**File:** `taskflow/src/lib/wiki/editor/emit.ts:96, 332, 435`
**Issue:** Color `value`, panel `params`/`type`, and code `language` are interpolated without checks. `value: 'red;x'` emits `{color:red;x}`. A value or title containing `}` breaks the macro. The parser's `isSafeColor` gate (T-97-27) is not applied when writing.
**Fix:** Gate `value` with `isSafeColor`, `language` with `/^[a-z]+$/`, `type` with the panel name set, and reject `}`/`\n` in params. When a check fails, throw so the save fails closed.

### WR-05: Empty list item emits a stray `*`, and a heading with a hard break splits

**File:** `taskflow/src/lib/wiki/editor/emit.ts:286-287, 463-464, 417-421`
**Issue:** `render` strips trailing whitespace, so an empty item's `* ` becomes `*`. That no longer matches `LIST_LINE`, so it turns into a literal `*` continuation of the previous item (reproduced: `"* a\n*\n* b"`). A heading containing a `hardBreak` emits `h1. a\nb`, which re-parses as a heading plus a paragraph.
**Fix:** Skip or refuse empty items (or emit ` `). For heading context, emit `hardBreak` as `\\\\`, or reject it in the schema (`heading` content `text*` without hardBreak).

### WR-06: `bq.` continuation scan is mutually recursive and quadratic, and overflows the stack into a whole-doc raw fallback

**File:** `taskflow/src/lib/wiki/editor/parse/blocks.ts:110-114, 164-165`
**Issue:** `startsBlock(j)` calls `scanSpecial(j)`, which for a `bq.` line loops over `startsBlock(j+1)`, and so on. Recursion depth equals the number of consecutive `bq.` lines, and each top-level block repeats the work. Measured: 2000 lines take 169 ms, 4000 lines take 2.17 s, and around 8000 lines overflow the stack. `parseWiki`'s catch then turns the whole document into a single rawBlock (rich editing is lost for the entire text).
**Fix:** `startsBlock` only needs a yes/no answer. Make it a cheap predicate (regex tests for bq/heading/rule/macro opener/table start) and do not call `scanSpecial` from it, or memoise `scanSpecial` per line index.

### WR-07: `\x00LI` sentinel expansion is unbounded and throws on NUL-containing input

**File:** `taskflow/src/lib/wiki/pipeline.ts:227-231`; `taskflow/src/lib/wiki/preprocess.ts:620-627`
**Issue:** `' '.repeat(Number(n))` trusts the digits. Input `a\n\x00LI99999999999b\x00 x` throws `RangeError: Invalid string length` from `wikiToMarkdown`, which crashes the WikiRenderer render. The replacement also runs after code bodies are restored, so code content is exposed to it.
**Fix:** Strip `\x00` from the raw input at the top of `preprocessJiraMarkup`. That fixes every sentinel, including CODEBODY, LINK and USCORE. Also run the LI replacement before the CODEBODY restore, and cap `n` (for example `Math.min(n, 64)`).

### WR-08: `|` inside inline info/note/warning/tip callouts in table rows is not escaped

**File:** `taskflow/src/lib/wiki/preprocess.ts:223-234, 995-1009`
**Issue:** `flattenInlineCalloutsForTableRow` escapes `|` for `{panel}` only. The new info/warning/note/tip forms and the `inTableRow` span path never escape it. `|a|{info:title=t}x|y{info}|b|` renders the callout as `x` plus an extra `y` cell, and the column count changes. The editor's `splitRow` treats that `|` as inside the panel, so the renderer and the editor disagree about the structure.
**Fix:** Apply the same `transformPanelListItems` + `\|` escape to every callout type in both table-row paths.

### WR-09: Ragged tables are modelled as `table` nodes, and editor normalisation will rewrite them

**File:** `taskflow/src/lib/wiki/editor/parse/tables.ts:186-200`
**Issue:** `parseTableRun` accepts rows with different cell counts. prosemirror-tables' `fixTables` pads such tables with empty cells on the first doc-changing transaction. The next `saveWiki` then emits the padded cells, which become `||` through CR-04, even though the user never touched the table.
**Fix:** Return null (keep the table raw) when the row widths differ, or record the original widths and drop padding cells on emit.

## Info

### IN-01: Inline scanning is quadratic on unclosed openers, contradicting the "linear" docs (T-97-26)

**File:** `taskflow/src/lib/wiki/editor/parse/marks.ts:123-131, 155-158`; `taskflow/src/lib/wiki/editor/parse/inline.ts:175-177`
**Issue:** `m.indexOf(COLOR_CLOSE …)` / `m.indexOf('}' …)` scan to the end of the line for each unclosed opener. Measured: `{color:red}a ` repeated takes 6.8 s at 650 KB and 27 s at 1.3 MB. Jira's 32 KB field limit keeps real inputs in the millisecond range. `inline.ts` also compiles a new `RegExp` for every `{`.
**Fix:** Precompute next-closer arrays per line, as `stopNext` already does. Hoist `cm` to module scope.

### IN-02: `inTableRow` copies the rest of the string for every match

**File:** `taskflow/src/lib/wiki/preprocess.ts:993-994`
**Fix:** `str.startsWith('|', str.lastIndexOf('\n', offset - 1) + 1)`.

### IN-03: `title=a|borderStyle=…` parameters render the whole parameter string as the title

**File:** `taskflow/src/lib/wiki/editor/parse/panels.ts:21-22`; `taskflow/src/lib/wiki/preprocess.ts:997`
**Issue:** The editor models these, and the renderer shows `a|borderStyle=…` as the title. Jira shows `a`. This is a parity divergence that both sides share.

### IN-04: Typed `h1. ` / `bq. ` at paragraph start cannot be escaped and silently becomes a block

**File:** `taskflow/src/lib/wiki/editor/emit.ts:258-259`
**Issue:** This is documented, but Phase 98 should surface it to the user. Reproduced: paragraph text `h1. hi` → heading.

### IN-05: A list nested under a `-` list emits `**`, which the parser rejects

**File:** `taskflow/src/lib/wiki/editor/emit.ts:269-280`
**Issue:** `- a\n** b` re-parses as a rawBlock.
**Fix:** Emit `-` lists as `*` once they have children, or use `-*`-style runs consistently with `build()`.

---

_Reviewed: 2026-11-16T19:43:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
