---
name: wiki-renderer-horizontal-divider
status: resolved
trigger: "In wiki renderer on jira issue detail has a problem with rendering horizontal dividers. ---- should be rendered as full horizontal divider, currently it renders as --"
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- **Expected:** `----` on its own line in Jira wiki markup should render as a full-width horizontal rule (`<hr>`)
- **Actual:** Renders as literal dashes `--` instead of a visual divider
- **Errors:** No console errors observed
- **Timeline:** Unknown — may never have worked (missing feature) or may have regressed
- **Reproduction:** Jira issue detail page with wiki content containing `----` on its own line

## Current Focus

hypothesis: "jira2md's strikethrough regex corrupts ---- to ~~--~~ when surrounded by newlines"
test: "horizontal divider rendering suite (6 tests)"
expecting: "<hr> element in DOM"
next_action: "resolved"
reasoning_checkpoint: "Confirmed via node REPL tracing. Fix applied and all 133 tests pass."

## Evidence

- timestamp: 2026-05-26T15:04:00Z
  finding: "jira2md output for standalone '----' is '----' (passes through), but for 'text\n\n----\n\ntext' the strikethrough regex /(\s+)-(\S+.*?\S)-(\s+)/g matches: \n\n is \s+, outer dashes are delimiters, inner '--' matches \S+.*?\S, producing '~~--~~'"
  source: node REPL tracing of jira2md source

- timestamp: 2026-05-26T15:04:00Z
  finding: "jira2md's strikethrough regex needs at least 2 inner chars (\S+.*?\S). '---' has inner '-' (1 char) so it does NOT match. react-markdown renders standalone '---' as <hr>."
  source: node REPL verification

- timestamp: 2026-05-26T15:04:00Z
  finding: "CommonMark setext heading conflict: 'text\n---\ntext' is parsed as an <h2>, not <hr>. Replacement must be '\n---\n' to guarantee blank lines on both sides."
  source: test failure analysis

## Eliminated

- jira2md handling `----` as a horizontal rule natively: jira2md has no HR rule; it passes `----` through unchanged when standalone
- React-markdown failing to render `<hr>`: it renders `---` on its own line correctly

## Resolution

root_cause: "jira2md's strikethrough regex `/(\s+)-(\S+.*?\S)-(\s+)/g` matches `----` when surrounded by newlines (the outer two dashes are delimiters, inner `--` is the content), producing `~~--~~` which react-markdown renders as struck-through dashes. Additionally, `---` immediately following text (no blank line) is parsed by CommonMark as a setext heading underline, not an `<hr>`."
fix: "In `preprocessJiraMarkup` in `WikiRenderer.tsx`, replace `/^-{4,}$/gm` with `'\\n---\\n'` before passing to jira2md. The `\\n` prefix/suffix ensures surrounding blank lines so CommonMark sees the `---` as a thematic break (not a setext heading underline). jira2md leaves `---` untouched (its strikethrough inner pattern requires ≥2 chars, so single-char inner `-` never matches)."
verification: "133 tests pass including 6 new horizontal divider tests"
files_changed: "taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
