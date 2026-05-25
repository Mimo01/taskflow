---
name: wiki-render-exclamation-split
status: resolved
trigger: on issue detail the wiki renderer has a bug. It renders the following text incorrectly.
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- **Expected:** Plain text rendered as a single line with no formatting — exclamation marks and dash should not trigger any markup
- **Actual:** The text `pre XL extra a XXL nebude sa uplplatňovať geozónová ponuka!!! - iba zvýhodnená cena na 3 mesiace` is rendered as three separate elements:
  1. `pre XL extra a XXL nebude sa uplplatňovať geozónová ponuka` (text)
  2. An empty/broken image
  3. `- iba zvýhodnená cena na 3 mesiace` (list item)
- **Errors:** No console errors or failed network requests
- **Timeline:** Unknown — may have always been broken
- **Reproduction:** Any Jira issue detail that contains this text in its description field

## Current Focus

- hypothesis: CONFIRMED — jira2md's image regex `/!(.+)!/g` matches `!!!` (treating first and third `!` as delimiters, middle `!` as "filename"), producing `![](!)`
- test: All 119 WikiRenderer tests pass including 5 new regression tests
- expecting: n/a
- next_action: DONE

## Evidence

- timestamp: 2026-05-25T17:20:00Z
  finding: jira2md line 76 — `/!(.+)!/g` — greedy `.+` matches `!` character inside `!!!`
  source: node -e test in taskflow/node_modules/jira2md/index.js
  detail: Input `ponuka!!!` → regex matches `!!!` with ref=`!` → outputs `ponuka![](!)` → react-markdown renders as broken image element

- timestamp: 2026-05-25T17:20:00Z
  finding: preprocessJiraMarkup image regex `/!([^!\n]+?)(?:\|[^!\n]*)?!/g` correctly does NOT match `!!!` (requires at least one non-`!` char between delimiters), so `!!!` passes through to jira2md unchanged
  source: node -e test

- timestamp: 2026-05-25T17:20:00Z
  finding: Fix verified — inserting `result.replace(/!{2,}/g, (match) => '!' + '&#33;'.repeat(match.length - 1))` after the image step prevents jira2md from seeing consecutive `!` chars; `&#33;` renders as `!` in browser

## Eliminated

- Markdown `- ` list item from ` - iba` is a secondary effect of the broken image splitting the text into segments — not an independent parser bug

## Resolution

- root_cause: jira2md's image regex `/!(.+)!/g` (line 76 of jira2md/index.js) is greedy and matches any content between two `!` chars, including the middle `!` in `!!!`. This produces `![](!)` from `!!!`, which react-markdown renders as a broken image. The preprocessJiraMarkup image regex (which uses `[^!\n]+?`) correctly rejects `!!!` — but it runs before jira2md, which then still processes the remaining `!!!` with its own looser regex.
- fix: Added one line to `preprocessJiraMarkup` in `WikiRenderer.tsx` (after the image substitution step): `result = result.replace(/!{2,}/g, (match) => '!' + '&#33;'.repeat(match.length - 1));`. This converts any remaining runs of 2+ consecutive `!` into the first `!` plus HTML entities, so jira2md never sees two raw `!` that can form a false image pair. `&#33;` renders as `!` in the browser.
- verification: All 119 WikiRenderer tests pass including 5 new regression tests covering `!!!`, `!!`, single `!` (no regression), valid `!filename.png!` (no regression), and `!!!` inside a table cell.
- files_changed:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx (lines 740-748: added consecutive-! escape step)
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx (lines 1760-1825: added 5 new tests in `describe('consecutive exclamation marks')`)
