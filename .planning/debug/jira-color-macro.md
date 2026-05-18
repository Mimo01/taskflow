---
slug: jira-color-macro
status: resolved
trigger: "In the Jira defect detail view, the {color:#d04437}*FAILED:*{color} syntax is not being rendered with color. The color parsing seems to be missing globally — it is also not working in comments, etc."
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- **Expected:** `{color:#d04437}*FAILED:*{color}` renders "FAILED:" in bold red (#d04437)
- **Actual:** "FAILED:" renders without any color styling — color is silently stripped
- **Scope:** All `{color}` macros globally (issue descriptions, comments, table cells)
- **Errors:** No console errors — silent discard

## Current Focus

hypothesis: resolved
next_action: none

## Evidence

- timestamp: 2026-05-18T12:50Z
  file: taskflow/node_modules/jira2md/index.js:82
  finding: "jira2md explicitly strips color macros: `.replace(/\{color:[^}]+\}([^]*?)\{color\}/gm, '$1')` — it removes color tags and keeps only the inner text. This runs before any markdown conversion."

- timestamp: 2026-05-18T12:50Z
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx (preprocessJiraMarkup)
  finding: "No {color} handling existed in preprocessJiraMarkup. The macro reached jira2md intact, was stripped there, and reached react-markdown with no color information."

- timestamp: 2026-05-18T12:50Z
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx (wikiSanitizeSchema)
  finding: "Even if a <span style> had been emitted, rehype-sanitize's default schema does not allow the `style` attribute — it would have been stripped. The fix uses data-color attribute (allowlisted as dataColor) with the React span component applying style={{ color }} at render time, keeping the sanitize boundary clean."

## Eliminated

- jira2md version gap: irrelevant — the strip is intentional in jira2md (it documents color as "unsupported in md")
- rehype-sanitize stripping style: not applicable — the fix avoids inline style in HTML entirely

## Resolution

root_cause: "jira2md explicitly strips `{color:...}` macros (index.js line 82) — it documents color as unsupported in markdown. Because preprocessJiraMarkup had no prior handler for `{color}`, the macro passed through to jira2md unchanged and was silently discarded there."

fix: |
  Three changes in WikiRenderer.tsx:
  1. preprocessJiraMarkup: added a regex pass that converts `{color:#hex}...{color}` to
     `<span data-color="#hex">...</span>` BEFORE jira2md runs. Uses data-color rather than
     inline style to avoid permitting arbitrary CSS through rehype-sanitize.
  2. wikiSanitizeSchema: added 'dataColor' to the span attribute allowlist so rehype-sanitize
     passes the data-color attribute through to the React component layer.
  3. span markdownComponent: added a branch that reads `data-color` and applies
     `style={{ color: colorValue }}` at React render time — keeping the sanitize
     boundary clean while rendering the correct color.
  Five new tests added covering: basic color span, bold-inside-color, multiple colors,
  color in table cell, and no-color prose unaffected.

verification: "78/78 tests pass in WikiRenderer.test.tsx including 5 new color-macro-specific tests."

files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx (preprocessJiraMarkup color step + wikiSanitizeSchema + span component)
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx (5 new tests in 'Jira {color} macro rendering' describe block)
