---
phase: 97-round-trip-engine
reviewed: 2026-11-16T21:14:08Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - taskflow/src/lib/wiki/editor/emit.ts
  - taskflow/src/lib/wiki/editor/engine.ts
  - taskflow/src/lib/wiki/editor/escape.ts
  - taskflow/src/lib/wiki/editor/save-check.ts
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
findings:
  critical: 2
  warning: 6
  info: 2
  total: 10
status: issues_found
---

# Phase 97: Code Review Report (re-review after 97-11..97-14)

**Reviewed:** 2026-11-16T21:14:08Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This is a re-review of the gap-closure commits `5e799119..HEAD` (97-11 through 97-14), checked against the prior report's 5 critical, 9 warning and 5 info findings.

The gap closure holds up where it was aimed:

- Mid-line panels render inside their list item or paragraph again.
- Attribute injection into callout and color attributes is closed, and the headerless marker is matched by position only.
- Raw atoms inside list items and cells are written verbatim.
- Empty cells and hard breaks in cells no longer corrupt tables.
- Recorded spellings give way after an attribute edit.
- `saveWiki` now re-parses its output and fails closed.

I probed `checkSaved` rule by rule (rules 1 to 5) for a way to make it accept text that the editor parser reads back differently, and found none. The projection is sound with respect to `parseWiki`.

The problem is what `parseWiki` is checked against. The save check's only oracle is the editor parser, and `parseWiki` disagrees with the renderer that TaskFlow uses (and with Jira) in several places. So the fail-closed guarantee covers "reads back the same in the editor", not "renders as typed":

- **Macros typed as text become live.** Typed `a {code}x{code} b`, `{info}…{info}` and `{quote}…{quote}` mid-line are saved unescaped and render as a code block, callout or quote (CR-01).
- **The new escapes render as garbage.** The escapes that 97-12 introduced (`\*`, `\_`, `\^`, `\~`, `\{`, `\[`, `\!`) are shown by TaskFlow's own renderer as literal HTML-tag text (CR-02).

Every finding marked "verified" was reproduced with `jiti` scratch scripts against the current tree. The scripts were kept in the session scratchpad, not in the repo. The outputs are quoted inline.

## Prior findings

| ID | Status | Evidence |
|----|--------|----------|
| CR-01 panel mid-line regression | **Fixed** | `preprocess.ts:1009-1029`: `ownLine` keeps mid-line panels inline. Verified: `* item one {note}nested{note} tail\n* item two` gives `<ul><li>item one <span data-callout="note">nested</span> tail</li><li>item two</li></ul>`. |
| CR-02 attribute injection / forged headerless marker | **Fixed** | `attr()` at `preprocess.ts:170-172` is applied at 190, 224, 237, 936, 941, 961, 966, 1020-1028 and 1062-1063. The marker match is positional at `pipeline.ts:183-205`. Verified: `\|\|Secret{info:title=x" data-wiki-headerless="1}a{info}\|\|h2\|\|…` keeps its thead, and the quote is encoded as `&#x22;`. Two sibling interpolations were missed (new WR-05). |
| CR-03 non-paragraph blocks in items/cells dropped | **Fixed** | `emit.ts:437-447, 502-512`. Raw atoms are written verbatim, and other block types throw `WikiEmitError`, which `saveWiki` (`engine.ts:100-106`) turns into `failed`. Verified: item `[p a, rawBlock {status:x}]` gives `* a\n{status:x}` (saved). Item `[p a, codeBlock]` fails with "cannot emit a codeBlock inside a list item". A cell holding rawBlock `{foo}` gives `\|{foo}\|b\|` (saved). |
| CR-04 empty cells `\|\|`, raw newline in cells | **Fixed** | `emit.ts:529-534` writes a single space for an empty cell. `emit.ts:42-49` writes `\\\\` for a new hard break in a cell, heading or quote. Verified: `\|a\| \|c\|` and `\|\|a\\\\b\|\|c\|\|`, both saved and read back. |
| CR-05 typed atom look-alikes go live | **Partially fixed** | `emit.ts:336-349` tags atoms in `display()`, and `escape.ts:53-74` handles emoticon tokens. Verified: `[~admin]`, `!http://…!`, `[^secret.pdf]`, `{status:…}` and `(+)` are all escaped, and `(x)` fails with a reason. Two gaps remain. Block-macro look-alikes typed mid-line are still saved live (new CR-01). The escapes themselves render as garbage in TaskFlow (new CR-02). |
| WR-01 silent "leave as typed" / no save verification | **Fixed (fail closed)** | `save-check.ts:265-296` and `engine.ts:96-107`. Verified: intraword italic, bold across a hard break, mono containing `}`, and a link href containing `]` all return `failed`. Bold over `" hello"` is hoisted to `x *hello*y` and saved correctly. The check still accepts output where the parser and the renderer disagree (new WR-01). |
| WR-02 recorded spelling overrides edited attrs | **Fixed** | `emit.ts:58-83` (`stillSpells`, `colorOpen`) and `emit.ts:576-582` (`codeOpenHolds`). Verified: mention id edited to `bob` gives `[~bob]`. Color edited to blue gives `{color:blue}`. Language edited to python gives `{code:python}`. |
| WR-03 code body containing `{code}` | **Fixed (fail closed)** | Verified: a body of `a\n{code}\n*b*` returns `failed` ("3 top-level blocks, the edit has 1"). No automatic switch to `{noformat}`, so the user has to take the source-mode path. |
| WR-04 unvalidated attrs written into macros | **Fixed (fail closed)** | Verified: color `red;x`, panel params `title=a}b` and language `a}b` each return `failed`. |
| WR-05 empty list item `*`, heading hard break | **Partially fixed** | The empty item now fails closed (verified). A heading hard break now emits `h1. a\\\\b`, which the editor reads back, but the TaskFlow renderer splits it into `<h1>a</h1><p>b</p>` (new WR-01). |
| WR-06 `bq.` mutual recursion / stack overflow | **Still open** | `parse/blocks.ts:110-114, 164-165` are unchanged in this range. |
| WR-07 `\x00LI` sentinel unbounded | **Still open** | `pipeline.ts:246-249` is unchanged, and the input is still not stripped of NUL. Verified: `wikiToHtml('a\n\x00LI99999999999b\x00 x')` throws `RangeError: Invalid string length`. |
| WR-08 `\|` inside inline info/note/warning/tip in table rows | **Still open** | Verified: `\|a\|{info:title=t}x\|y{info}\|b\|` renders 4 cells (`a`, callout `x`, `y`, `b`), while `loadWiki` returns `rich` with the editor's 3-cell model. |
| WR-09 ragged tables modelled as `table` | **Partially fixed** | Padding no longer corrupts the table (CR-04 fix). `parse/tables.ts:186-200` still accepts ragged rows, though. Any `fixTables` padding in Phase 98 would be saved silently, because `checkSaved` compares against the padded doc. Unverified: this needs the Phase 98 editor. |
| IN-01 quadratic inline scan | **Still open** | `parse/marks.ts` and `parse/inline.ts` are unchanged in this range. |
| IN-02 `inTableRow` copies the string tail | **Still open** | `preprocess.ts:1007-1008`. The new `ownLine` (1009-1014) adds two more slices per match. |
| IN-03 `title=a\|borderStyle=…` parity | **Still open** | `parse/panels.ts:21-22` is unchanged. |
| IN-04 typed `h1. ` / `bq. ` becomes a block | **Fixed (fail closed)** | Verified: `failed` with the reason "The text starts with `h1. `, which has no escape spelling…" (`escape.ts:47-52`). |
| IN-05 nested list under `-` emits `**` | **Fixed (fail closed)** | Verified: adding a nested list under `- a` returns `failed`. |

## Critical Issues

### CR-01: Typed block-macro text mid-line is saved unescaped and renders live (code block / callout / quote)

**File:** `taskflow/src/lib/wiki/editor/emit.ts:369-380`, `taskflow/src/lib/wiki/editor/save-check.ts:265-296`
**Issue:** `inlineSegments` escapes only when the editor's own re-parse differs. `parseWiki` reads `{code}`, `{noformat}`, `{quote}` and the panel family as plain text when they open mid-line. So `fits(plain)` passes, nothing is escaped, and `checkSaved` (same parser) accepts the text. The renderer, and Jira, treat these macros as live wherever they appear. This is the same SAFE-06 class as the prior CR-05, but for block macros, which the 97-12 fix did not cover. Verified (paragraph or list item typed by the user, then `saveWiki`, then `wikiToHtml`):

```
p("a {code}x{code} b")      -> saved "a {code}x{code} b"  -> <p>a ```<br> x</p><pre><code class="language-b"></code></pre>
p("a {info}x{info} b")      -> saved unescaped            -> <p>a <span data-callout="info">x</span> b</p>
p("a {quote}q{quote} b")    -> saved unescaped            -> <p>a > q<br> b</p>
p("a {noformat}x{noformat} b") -> saved unescaped         -> <p>a <code> x</code> b</p>
item("a {code}x{code}")     -> saved "* a {code}x{code}"  -> list item split, empty <pre> after it
```

The `{code}` case also swallows the rest of the line as a language name (`language-b`).
**Fix:** Escape the opening brace of these macro names whenever they appear in typed text, not only when the editor parser would read them. In `escape.ts` treat `{` as a site, and force the escape (bypassing the `keep` minimiser) when it starts `{code`, `{noformat`, `{quote`, `{panel`, `{info`, `{note`, `{warning`, `{tip` or `{color`:

```ts
const LIVE_MACRO = /\{(?:code|noformat|quote|panel|info|note|warning|tip|color)\b/g;
// in inlineSegments: escape these sites unconditionally, then run the minimiser on the rest
```

Better, make the save check renderer-aware: compare `wikiToHtml(emitted)` with `wikiToHtml(emitWiki(escapedOnlyTextDoc))`, or at least assert that no typed text node's characters appear inside a renderer element that the edited doc has no node for.

### CR-02: The new backslash escapes render as literal HTML-tag text in TaskFlow's renderer

**File:** `taskflow/src/lib/wiki/editor/escape.ts:61-126` (producer); `taskflow/src/lib/wiki/preprocess.ts` (no backslash-escape handling except `\+` at ~786 and `\\`); `taskflow/src/lib/wiki/pipeline.ts:230-251`
**Issue:** 97-12 makes the emitter write `\*`, `\_`, `\^`, `\~`, `\{`, `\[` and `\!` routinely for typed text. Jira honours these, but TaskFlow's preview and display pipeline does not. jira2md still converts the delimiters, and the leftover backslash then markdown-escapes the generated `<`, so the user sees raw tag text right after saving. Verified (`saveWiki` output fed to `wikiToHtml`):

```
typed "a *b* c"                 -> saved "a \*b\* c"               -> <p>a &#x3C;strong>b&#x3C;/strong> c</p>
typed "a _b_ c"                 -> saved "a \_b\_ c"               -> <p>a &#x3C;em>b&#x3C;/em> c</p>
typed "a ^b^ c" / "a ~b~ c"     -> "\^b\^" / "\~b\~"               -> literal "<sup>b</sup>" / "<sub>b</sub>"
typed "ping [~admin] now"       -> saved "ping [\~admin] now"      -> <p>ping &#x3C;~admin> now</p>
typed "{color:red}x{color}"     -> saved "\{color:red}x\{color}"   -> literal '<span data-color="red">x</span>'
typed "img !http://e.example/p.png! x" -> "\!…\!"                  -> literal '<img src="…' plus an autolink
```

The `loadWiki` equivalence check does not catch this, because both sides go through the same broken renderer. The text written to Jira is probably correct. What TaskFlow shows for it is corrupted.
**Fix:** Teach `preprocessJiraMarkup` the Jira escape set before jira2md runs, the same way `\+` is already handled. Replace `\X` for `X` in `ESCAPABLE_CHARS` with an entity or sentinel (`&#42;`, `&#95;`, `&#94;`, `&#126;`, `&#123;`, `&#91;`, `&#33;`, …) so that no later regex can pair it. Add a renderer test for every character in `ESCAPABLE_CHARS`.

## Warnings

### WR-01: The save check accepts parser/renderer divergences (multi-line delimiters, heading `\\`)

**File:** `taskflow/src/lib/wiki/editor/save-check.ts:265-296`; `taskflow/src/lib/wiki/preprocess.ts:899-914`
**Issue:** Wherever `parseWiki` and the renderer disagree, the check accepts text that renders differently from the edited doc. Verified:

```
p("*one", hardBreak, "two*")  -> saved "*one\ntwo*"  -> <p><em>one<br> two</em></p>   (typed literal text shows italic)
p("_one", hardBreak, "two_")  -> saved "_one\ntwo_"  -> <p><em>one<br> two</em></p>
heading("a", hardBreak, "b")  -> saved "h1. a\\\\b"  -> <h1>a</h1><p>b</p>           (heading split)
```

Jira's handling of the first two is unverified. The TaskFlow display is verified.
**Fix:** Either close the gaps in the renderer (keep `*`/`_` pairing per line; render `\\` inside a heading as `<br>`), or escape conservatively. Treat a `*`/`_` that has a matching delimiter after a hard break as a site, so the emitter writes `\*one\ntwo\*`.

### WR-02: Toggling a table's header row always fails to save

**File:** `taskflow/src/lib/wiki/editor/emit.ts:519-527`; `taskflow/src/lib/wiki/editor/save-check.ts:214-217`; `taskflow/src/lib/wiki/editor/parse/tables.ts:198`
**Issue:** The parser derives `headerless` from the first cell, but the emitter and `shape()` use the stored `headerless` attr. prosemirror-tables' `toggleHeaderRow` changes cell types, not that attr. Verified: load `||h1||h2||\n|a|b|`, change the first row to `tableCell`, save → `failed` ("block 0 (table) does not read back as the edited structure"). Going the other way, adding a header row to a headerless table makes the emitter write `|` for the header cells (line 527), and the save also fails. The behaviour is fail-closed, but a basic table edit can never be saved.
**Fix:** Derive the attr instead of trusting it. In `tableSegments` use `const headerless = table.content?.[0]?.content?.[0]?.type !== 'tableHeader'`, and in `shape()` drop `headerless` (the per-cell `header` flags already carry it), or derive it the same way.

### WR-03: The first block gets a spurious leading blank line after edits

**File:** `taskflow/src/lib/wiki/editor/emit.ts:702`; `taskflow/src/lib/wiki/editor/schema.ts:33`
**Issue:** The schema default is `gap: 1`, and `emitWiki` uses `block.attrs.gap` even for `i === 0` (unlike `bodyText` at line 458). A user-created first block, or the old second block after the first is deleted, is written with a leading `\n`. Verified: load `a\n\nb`, delete paragraph `a`, save → `"\nb"`. The same happens for every doc built from scratch (`"\n{code}\nx = 1\n{code}"`). `checkSaved` filters empty paragraphs, so it does not notice. The result is byte churn and a leading blank line written to Jira.
**Fix:** Record the original leading gap on the doc (for example a `lead` attr set by the parser) and use it for the first block only. Otherwise use `0` when `i === 0`.

### WR-04: The escape minimiser picks escapes the editor parser accepts, not ones Jira honours (`[\~admin]`)

**File:** `taskflow/src/lib/wiki/editor/emit.ts:405-410`
**Issue:** The `keep` loop removes escapes in insertion order, so it keeps whichever later escape still satisfies `parseWiki`. For a typed `[~admin]` it drops `\[` and keeps `\~`, producing `[\~admin]`. Whether Jira treats `[\~admin]` as a non-mention, non-link literal is unverified. It may render a bracket link to `~admin`. TaskFlow renders it as `<~admin>` (CR-02). The same mechanism decides every escape, with the editor parser as the only judge.
**Fix:** For atom look-alikes, escape the opening delimiter (`\[`, `\!`, `\{`), which Jira documents as literal. Only minimise among mark delimiters.

### WR-05: `attr()` hardening missed sibling interpolations (mention display name, attachment href)

**File:** `taskflow/src/lib/wiki/preprocess.ts:961, 966` (`${name}`), `985, 994` (`href="${url}"`)
**Issue:** 97-11 attribute-escaped `data-id`, but the user-map display name is still pasted into HTML unescaped, and attachment URLs are not passed through `attr()`. Verified: `wikiToHtml('hi [~bob] x', undefined, {bob: 'Bob <img src="https://tracker.example/p.gif"> X'})` gives `<mention data-id="bob">Bob <img src="https://tracker.example/p.gif"> X</mention>`. That is a live external image (tracking pixel) taken from a Jira display name. An attachment URL containing `"` truncates the href (`https://j.example/a" data-wiki-x="1` → `href="https://j.example/a"`). Sanitize keeps this from becoming script execution.
**Fix:** HTML-escape `name` (`& < > "`). Wrap the attachment `url` in `attr()` as the image path already does at 936/941.

### WR-06: A typed backslash before any markup character can never be saved

**File:** `taskflow/src/lib/wiki/editor/escape.ts:25-29`; `taskflow/src/lib/wiki/editor/emit.ts:403-404`
**Issue:** `\` is not an escape site, and `\X` re-parses as an escape atom, so text such as `C:\Users\{name}`, `foo\_bar` or `a\\b` always returns `failed` ("does not read back as the edited structure"), with no actionable reason. Verified for all three. This is fail-closed, but common in technical descriptions (paths, regexes), and the reason string does not tell the user what to change.
**Fix:** Spell a literal backslash that precedes an escapable character (Jira accepts `\\` only as a line break, so use `{{…}}` monospace or an entity), or add an `unspellableReason` branch naming the backslash so Phase 98 can show a workaround.

## Info

### IN-01: Emoticon tokens without an inner escapable character make common text unsaveable

**File:** `taskflow/src/lib/wiki/editor/escape.ts:53-57`
**Issue:** `f(x) = 1`, `option (i)` and `turn it (on)` all return `failed` (verified for `f(x)` and `(x)`). This matches the renderer's unbounded emoticon regexes (`preprocess.ts:404-420`), so it is consistent. It is still a frequent fail-closed trigger, and Phase 98 should present it clearly.

### IN-02: Rule 3 accepts paragraph-to-hard-break conversion in items and cells

**File:** `taskflow/src/lib/wiki/editor/save-check.ts:157-191`
**Issue:** The rule is intentional and documented, and rendering is equivalent. The consequence is that after reload, a list item or cell that had two paragraphs becomes one paragraph with a break. Phase 98 undo/dirty logic should not assume the saved doc re-loads to `current`.

---

_Reviewed: 2026-11-16T21:14:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
