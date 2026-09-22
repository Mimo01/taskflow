---
status: resolved
trigger: "there is a bug in the wiki renderer, this raw text: [-text-|www.example.com] doesnt render the link with strikethrough but as a regular link with dashes on both sides"
created: 2026-09-22
updated: 2026-09-22
---

## Symptoms

- Expected: `[-text-|www.example.com]` should render as a link to www.example.com with the link text "text" shown in strikethrough (per Jira wiki `-...-` strikethrough markup combined with `[text|url]` link markup).
- Actual: Renders as a regular (non-strikethrough) link, and the dash characters render literally as part of the link text (e.g. "-text-").
- Errors: None observed (silent rendering bug, not a crash/exception).
- Timeline: Always broken as far as the user is aware; not a regression from a recent change — likely a longstanding gap in how the link-markup regex and strikethrough-markup regex interact/order in WikiRenderer.
- Reproduction: Type/paste `[-text-|www.example.com]` into any content rendered by WikiRenderer (e.g. an issue description or comment) and view the rendered output.

## Current Focus

reasoning_checkpoint:
  hypothesis: "jira2md's own strikethrough rule `/(\\s+)-(\\S+.*?\\S)-(\\s+)/g` requires whitespace immediately before the opening `-` and immediately after the closing `-`. Inside `[-text-|url]` the opening `-` is preceded by `[` and the closing `-` is followed by `|` — neither is whitespace — so the rule never fires. The untouched `-text-` then falls through unmodified to jira2md's Named Links rule (`/\\[(.+?)\\|(.+?)\\]/g` → `[$1]($2)`), which treats the dashes as literal display-text characters."
  confirming_evidence:
    - "Direct node repro against node_modules/jira2md: `j2m.to_markdown('[-text-|www.example.com]')` → `\"[-text-](www.example.com)\"` (dashes preserved literally, no `~~`)."
    - "Contrast repro: `j2m.to_markdown('this -text- is struck')` → `\"this ~~text~~ is struck\"` (whitespace-bounded case works fine), confirming the whitespace-boundary requirement is the differentiator."
  falsification_test: "If jira2md's strikethrough rule did NOT require whitespace boundaries, `[-text-|url]` would have produced `[~~text~~|url]` (or similar) directly from to_markdown() — it did not."
  fix_rationale: "Pre-convert the display-text strikethrough to `<del>text</del>` HTML directly inside preprocessJiraMarkup, BEFORE jira2md ever sees the string, so jira2md's Named Links rule extracts `[<del>text</del>](url)` unmodified. HTML (not markdown `~~text~~`) is used deliberately — jira2md's Subscript rule (`/~([^~]*)~/g`) runs on the same string and would corrupt `~~text~~` into `<sub></sub>text<sub></sub>` (verified: `j2m.to_markdown('[~~text~~|www.example.com]')` → `\"[<sub></sub>text<sub></sub>](www.example.com)\"`). `<del>` is in rehype-sanitize's defaultSchema so it survives sanitisation. This mirrors the existing `{*}bold{*}` → `<strong>` and `{_}italic{_}` → `<em>` technique already used elsewhere in preprocessJiraMarkup for the same reason (dodging jira2md's own buggy/narrow regexes)."
  blind_spots: "Only the named-link display-text case `[-text-|url]` is handled (the reported/expected shape). Strikethrough wrapping an entire link `-[text|url]-`, or strikethrough inside the URL portion, or unnamed-link brackets `[-text-]`, are NOT handled — not reported as broken and out of scope for this fix."

## Evidence

- timestamp: 2026-09-22
  checked: node_modules/jira2md/index.js `to_markdown()` — Strikethrough rule vs Named Links rule ordering
  found: Strikethrough rule is `/(\s+)-(\S+.*?\S)-(\s+)/g` (requires whitespace boundaries) and runs BEFORE the Named Links rule `/\[(.+?)\|(.+?)\]/g`. Direct repro confirmed `[-text-|www.example.com]` → `[-text-](www.example.com)` (dashes literal) while `this -text- is struck` → `this ~~text~~ is struck` (works).
  implication: Root cause confirmed — whitespace-boundary requirement in jira2md's strikethrough regex is defeated by the immediately-adjacent `[` / `|` bracket characters.

- timestamp: 2026-09-22
  checked: Attempted fix using markdown `~~text~~` syntax instead of HTML
  found: `j2m.to_markdown('[~~text~~|www.example.com]')` → `"[<sub></sub>text<sub></sub>](www.example.com)"` — jira2md's Subscript rule (`/~([^~]*)~/g`) greedily pairs adjacent tildes in `~~text~~`, corrupting it.
  implication: Markdown `~~...~~` is unsafe to emit before jira2md runs; must use `<del>...</del>` HTML directly (same technique already used for `{*}`/`{_}` bold/italic elsewhere in the file) to bypass jira2md's regex entirely.

- timestamp: 2026-09-22
  checked: `<del>` tag against rehype-sanitize defaultSchema.tagNames
  found: `defaultSchema.tagNames.includes('del')` → `true`.
  implication: No sanitize-schema changes needed; `<del>` passes through unmodified.

- timestamp: 2026-09-22
  checked: Full WikiRenderer.test.tsx suite after fix (`npx vitest run src/routes/dashboard/WikiRenderer.test.tsx`)
  found: 173/173 tests passed (170 pre-existing + 3 new regression tests added for this fix).
  implication: Fix resolves the reported bug with no regressions to existing wiki-rendering behavior (mentions, panels, tables, other link-underscore/italic fixes, horizontal-divider strikethrough handling, etc.).

## Eliminated

(none — root cause found on first hypothesis, confirmed directly against jira2md source and a minimal repro before any fix was attempted)

## Resolution

- root_cause: jira2md's `to_markdown()` strikethrough regex (`/(\s+)-(\S+.*?\S)-(\s+)/g`) requires whitespace immediately before the opening `-` and immediately after the closing `-`. In Jira wiki markup `[-text-|url]`, the opening `-` is immediately preceded by `[` and the closing `-` is immediately followed by `|` — neither is whitespace — so the strikethrough rule never matches. The unconverted `-text-` then falls through unchanged to jira2md's Named Links rule (`/\[(.+?)\|(.+?)\]/g`), which treats the dash characters as literal display-text content, producing a plain (non-strikethrough) link labelled "-text-".
- fix: In `preprocessJiraMarkup` (taskflow/src/routes/dashboard/WikiRenderer.tsx), added a regex pass that detects `[-text-|url]` (strikethrough wrapping the full display-text label of a named link) and rewrites it to `[<del>text</del>|url]` BEFORE jira2md runs. HTML `<del>` is used (not markdown `~~text~~`) because jira2md's own Subscript rule would otherwise corrupt adjacent tildes. `<del>` is already allowlisted by rehype-sanitize's defaultSchema, so no schema change was needed.
- verification: Added 3 new tests to WikiRenderer.test.tsx (strikethrough named-link display text renders as `<a><del>text</del></a>` with correct href and no literal dashes; hyphenated-but-non-strikethrough link labels are unaffected; ordinary mid-sentence whitespace-bounded strikethrough is unaffected). Full suite: 173/173 passed, no regressions.
- files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
