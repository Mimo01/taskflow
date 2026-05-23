---
status: resolved
trigger: "In jira comments (maybe also description?) the icons \"(/)\", \"(x)\" are not rendered as icons. Maybe there are more such icons?"
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- expected: Icon codes like "(/)", "(x)" and others should render as emoji equivalents (e.g. ✅, ❌)
- actual: Raw text like "(/)" and "(x)" is displayed instead of visual icons
- errors: No browser console errors observed
- timeline: Unknown — may have never worked
- reproduction: Open any Jira issue comment or description containing Jira emoticon codes like "(/)" or "(x)"
- scope: Both Jira comments and descriptions affected; other icon codes also suspected broken

## Current Focus

hypothesis: "The Jira ADF/wiki markup renderer does not handle Jira emoticon syntax (e.g. \"(/)\", \"(x)\") and passes them through as plain text"
test: "Search for emoticon/icon rendering logic in the wiki or ADF renderer"
expecting: "No handling of Jira emoticon codes found in the renderer"
next_action: "resolved"
reasoning_checkpoint: "jira2md.to_markdown() has no emoticon handling — confirmed by reading node_modules/jira2md/index.js in full. Fix applied in preprocessJiraMarkup."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-18T12:09Z
  file: taskflow/node_modules/jira2md/index.js
  finding: "jira2md's to_markdown() contains zero emoticon handling. Shortcodes like (/) and (x) are not in its regex set and pass through unchanged to react-markdown, which renders them as plain text."

- timestamp: 2026-05-18T12:09Z
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx
  finding: "preprocessJiraMarkup() had no emoticon step. The shortcodes survive all preprocessing, enter jira2md, exit still as literal text, and reach react-markdown as plain characters."

## Eliminated

- Browser rendering issue: no — the text is present in the DOM as raw characters, not an invisible element
- jira2md version gap: irrelevant — library has never included emoticon handling

## Resolution

root_cause: "jira2md.to_markdown() has no Jira emoticon handling. Shortcodes like (/) and (x) pass through the entire preprocessJiraMarkup → jira2md → react-markdown pipeline unchanged and appear as raw text."
fix: "Added JIRA_EMOTICON_MAP (exported array of [RegExp, string] pairs) and replaceJiraEmoticons() helper to WikiRenderer.tsx. Called as the first step in preprocessJiraMarkup, before jira2md, so shortcodes like (/) → ✅, (x) → ❌, (!) → ⚠️, (+) → ➕, (-) → ➖, (?) → ❓, (i) → ℹ️, (*) → ⭐, (on) → 💡, (off) → 🔕, (flag) → 🚩, (flagoff) → 🏳️ are substituted before jira2md can corrupt patterns like (*) via its bold regex."
verification: "70/70 tests pass including 16 new emoticon-specific tests covering: per-shortcode rendering, multiple emoticons in one block, emoticons inside table cells, map ordering invariants (flagoff before flag, (*) after starred variants), and no over-substitution of unrecognised tokens."
files_changed: "taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
