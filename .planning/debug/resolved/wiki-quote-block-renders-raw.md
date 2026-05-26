---
status: resolved
trigger: "In wiki renderer on jira issue detail {quote} parsing doesn't work"
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- expected: "{quote}...{quote} blocks should render as a styled blockquote element in the UI"
- actual: "The {quote} tags appear literally as raw text in the output without any formatting"
- errors: "No console errors visible — silent failure"
- timeline: "Unknown — not sure if it ever worked"
- reproduction: "Open any Jira issue that has {quote} in description or comments"

## Current Focus

- hypothesis: "resolved"
- test: ""
- expecting: ""
- next_action: "none"
- reasoning_checkpoint: ""

## Evidence

- timestamp: 2026-05-26T12:10:00Z
  type: code_inspection
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx
  finding: "preprocessJiraMarkup handles {panel}, {info}, {warning}, {note}, {color} but has no {quote} handler"

- timestamp: 2026-05-26T12:10:30Z
  type: code_inspection
  file: taskflow/node_modules/jira2md/index.js
  finding: "jira2md only handles 'bq. text' single-paragraph form (line 79). No {quote}...{quote} block macro support."

## Eliminated Hypotheses

- jira2md handles {quote}: ELIMINATED — confirmed jira2md only knows `bq.` prefix, not block macro form
- rehype-sanitize strips blockquote: ELIMINATED — blockquote is in defaultSchema.tagNames already

## Resolution

- root_cause: "{quote}...{quote} was never added to preprocessJiraMarkup — jira2md has no awareness of the block macro form and passes {quote} tags through as literal text unchanged"
- fix: "Added regex replace for {quote}([\s\S]*?){quote} → <blockquote>...</blockquote> in preprocessJiraMarkup (after note panels block). Added blockquote renderer in markdownComponents with left-border italic styling. blockquote was already in rehype-sanitize defaultSchema so no schema change needed."
- verification: "124 vitest tests pass (5 new quote-specific tests added)"
- files_changed: "taskflow/src/routes/dashboard/WikiRenderer.tsx, taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
