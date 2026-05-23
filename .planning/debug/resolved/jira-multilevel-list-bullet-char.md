---
status: resolved
trigger: "Jira markup not rendering properly on issue detail view — nested numbered lists collapsed into single li, bullet char not converted to list items"
created: 2026-05-19T00:00:00Z
updated: 2026-05-19T00:00:00Z
---

## Current Focus

hypothesis: "Two independent gaps in preprocessJiraMarkup: (1) numeric/alpha/roman list prefixes are not converted to jira2md's # syntax before j2m.to_markdown(); (2) U+2022 bullet character is not converted to '* item' before j2m.to_markdown()."
test: "Read jira2md source, trace both failing inputs through the full pipeline: preprocessJiraMarkup → j2m.to_markdown → react-markdown"
expecting: "Both confirmed — jira2md only handles '#+' prefix for ordered lists; '•' passes through to markdown as plain text"
next_action: "Apply fix in preprocessJiraMarkup — add two transforms before existing hN.X normalization"

## Symptoms

expected: "Nested ordered lists (1. / a. / i. prefixes) render as proper nested <ol><li> tree; • lines render as <ul><li> items"
actual: "All sub-levels of the numbered list are crammed into a single <li> as plain text; • lines render as plain text inside a <p> tag"
errors: "No JS errors — purely a rendering logic gap"
reproduction: "Pass Jira wiki with '1.\\na.\\ni.' list format or '• item' lines to WikiRenderer"
started: "Always broken — these list formats were never handled"

## Eliminated

- hypothesis: "jira2md handles 1./a./i. prefixes but react-markdown misparses the output"
  evidence: "jira2md source confirms its ordered list regex is /^[ \\t]*(#+)\\s+/gm — only # prefix; 1./a./i. pass through unchanged. In markdown, '1. text' starts an ordered list and 'a. text' following without blank line becomes a lazy continuation paragraph inside the single <li>."
  timestamp: 2026-05-19T00:00:00Z

## Evidence

- timestamp: 2026-05-19T00:00:00Z
  checked: "WikiRenderer.tsx — full file"
  found: "Conversion pipeline: preprocessJiraMarkup() → j2m.to_markdown() → fixMarkdownLinkUnderscores() → react-markdown with rehype-raw + rehype-sanitize + remark-gfm. preprocessJiraMarkup handles: emoticons, brace-bold/italic, tables, panels, images, mentions, color macros. No handling of 1./a./i. list prefixes or • bullet char."
  implication: "Both gaps are in preprocessJiraMarkup — add transforms before j2m is called"

- timestamp: 2026-05-19T00:00:00Z
  checked: "taskflow/node_modules/jira2md/index.js to_markdown()"
  found: "Ordered list regex: /^[ \\t]*(#+)\\s+/gm — ONLY matches Jira's hash prefix syntax (# item, ## nested). Unordered list regex: /^[ \\t]*(\\*+)\\s+/gm — ONLY matches asterisk prefix. Neither • nor 1./a./i. are recognized."
  implication: "These two patterns must be pre-normalized in preprocessJiraMarkup BEFORE j2m.to_markdown() is called"

- timestamp: 2026-05-19T00:00:00Z
  checked: "Node.js trace of '1.\\na.\\ni.' input through j2m.to_markdown()"
  found: "j2m passes all three lines through unchanged. react-markdown then parses '1. text' as start of an ordered list; 'a. text' and 'i. text' (with no blank line separation) become lazy paragraph continuations of the first <li>, per CommonMark spec — producing a single <li> containing all sub-items as plain text."
  implication: "Root cause 1 confirmed"

- timestamp: 2026-05-19T00:00:00Z
  checked: "Node.js trace of '•  FiberTel' input through j2m.to_markdown()"
  found: "j2m passes the line through unchanged. react-markdown sees it as plain inline text (• is not a markdown list marker). Since consecutive • lines have no blank line between them and are preceded by plain text, they get merged into a single <p> block."
  implication: "Root cause 2 confirmed"

- timestamp: 2026-05-19T00:00:00Z
  checked: "Fix validation in Node.js"
  found: "Transform numeric/alpha/roman → jira # syntax, then through j2m produces correct nested markdown '1. / 1. / 1.' with proper indentation. Transform • → '* ' passes through j2m and react-markdown renders as <ul><li>. Edge cases verified: 'i.e.' (abbreviation), 'not a. list' (mid-sentence), and leading-space variants all handled correctly."
  implication: "Fix is ready"

## Resolution

root_cause: "Two independent gaps in preprocessJiraMarkup in WikiRenderer.tsx: (1) Jira wiki numeric list prefix format (1./a./i.) is not recognized by jira2md, which only handles #/##/### prefix syntax. When passed through unchanged, markdown parser sees '1. text' as an ordered list but treats 'a. text' and 'i. text' (no blank line) as lazy paragraph continuations inside the single top-level <li>. (2) U+2022 bullet character (•) is not a markdown list marker and is not recognized by jira2md; it passes through as plain inline text and gets wrapped in a <p> tag instead of <ul><li>."
fix: "In preprocessJiraMarkup, before the h[1-6] normalization step, add two transforms: (1) Convert roman-numeral prefix lines (^[ \\t]*(roman)\\.\\s+) to '### ', alpha prefix lines (^[ \\t]*[a-z]\\.\\s+) to '## ', numeric prefix lines (^[ \\t]*\\d+\\.\\s+) to '# '. (2) Convert U+2022 bullet lines (^[ \\t]*•[ \\t]*) to '* '. This maps both formats to jira2md's recognized # and * list prefixes before j2m.to_markdown() processes them."
verification: ""
files_changed: [taskflow/src/routes/dashboard/WikiRenderer.tsx]
