---
slug: in-jira-description-text-is-no
status: resolved
trigger: "In jira description, {*}text{*} is not properly rendering"
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- **expected_behavior:** `{*}text{*}` Jira wiki markup should render as bold text
- **actual_behavior:** The `*text*` part renders bold correctly, but the surrounding `{` and `}` characters appear as literal text in the output
- **error_messages:** None
- **timeline:** Never worked
- **reproduction:** Any Jira issue description containing `{*}text{*}` markup

## Current Focus

- hypothesis: "jira2md does not handle the {*}..{*} brace-quoted bold syntax; its greedy bold regex matches the * inside {*} and produces {**}text{**} in output"
- test: "render <WikiRenderer wikiText='{*}bold text{*}' /> — expect <strong> element, no literal { } in output"
- expecting: "strong element present, textContent='bold text', no { or } in output"
- next_action: "resolved"
- reasoning_checkpoint: "direct-to-HTML conversion avoids jira2md greedy regex bleed"

## Evidence

- timestamp: 2026-05-18T21:49
  source: jira2md node evaluation
  content: |
    j2m.to_markdown('{*}text{*}') → "{**}text{**}"
    jira2md bold regex /\*(\S.*)\*/ matches the * inside {*} and wraps from first * to last *,
    producing {**}text{**}. The { } characters appear as literal text around the bold.
    jira2md also turns {_}text{_} → {*}text{*} (italic regex matches _ inside {_}).

- timestamp: 2026-05-18T21:49
  source: code analysis (WikiRenderer.tsx preprocessJiraMarkup)
  content: |
    No handling for {*}..{*} or {_}..{_} existed in preprocessJiraMarkup.
    The conversion to *text* is insufficient because jira2md's greedy bold regex
    /\*(\S.*)\*/ merges adjacent *a* *b* spans into **a* b**, requiring direct HTML output.

## Eliminated Hypotheses

- "rehype-sanitize strips the bold output" — eliminated; jira2md never produces valid bold markup for {*}text{*}

## Resolution

- root_cause: "jira2md does not handle Jira's brace-quoted formatting syntax {*}text{*} (bold) and {_}text{_} (italic). Its bold regex /\*(\S.*)\*/ incorrectly matches the * inside {*}, producing {**}text{**} — curly braces as literal text around the (now corrupted) bold markup."
- fix: "In preprocessJiraMarkup (WikiRenderer.tsx), added two regex replacements after replaceJiraEmoticons: {*}..{*} → <strong>..</strong> and {_}..{_} → <em>..</em>. Emit HTML directly (not *..* / _.._) because jira2md's greedy bold/italic regexes merge adjacent spans when multiple {*}..{*} appear on the same line."
- verification: "111/111 WikiRenderer tests pass including 8 new tests covering: single span, multi-word, multiple spans, prose context, inside {color} macro, inside table cell, and the verbatim bug fixture"
- files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
