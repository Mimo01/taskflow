---
type: todo
status: done
resolved: "98-01 (table-cell code, WR-02, IN-01) and 98-02 (WR-01, renderer side: preprocess.ts keeps the escaped underscore literal inside bare URLs, per 97-HUMAN-UAT test 1: Jira drops the backslashes)"
created: 2026-11-16
origin: phase-97 (gap-closure review + re-verification)
priority: high
resolves_phase: 98
---

# Wiki round-trip: Phase 97 follow-ups to close before the editor ships

**WR-01: escaped bare URLs render broken.** Typing `http://a.com/_a_ and _b_` saves as
`http://a.com/\_a\_ and \_b\_`, and WikiRenderer turns it into a broken href
(`...&amp;#x26;#95;a...`). The cause is the escape pass in preprocess.ts, which runs before autolinking. The fix is either
to restore the entities inside autolinks in the renderer, or to stop the emitter escaping inside bare URLs.
Check the 97-HUMAN-UAT test 1 result first: if Jira itself keeps the backslashes in the link, the emitter
should not escape there at all.

**Table-cell `{code}`/`{noformat}`.** Typed `{code}…{code}` or `{noformat}…{noformat}` in a table cell
can't be saved. `parseCell` treats any cell containing `{code`/`{noformat` as a raw table, escaped or not,
so `saveWiki` fails closed. Make `parseCell` escape-aware, and check how the renderer treats `\{code}` in a cell.
SAFE-06 was marked Complete on the basis that this fails closed.

**WR-02.** The cell-panel regex in `editor/parse/tables.ts` skips an opener after any backslash. preprocess.ts
treats an even backslash run as a real opener. Align the two. No data is lost, because raw atoms replay verbatim.

**IN-01.** The new regexes use lookbehind, which needs Safari 16.4+ in the WKWebView. Confirm the minimum macOS target.
