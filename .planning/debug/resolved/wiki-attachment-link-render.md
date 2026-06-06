---
slug: wiki-attachment-link-render
status: resolved
trigger: wiki renderer renders attachment refs [^file.txt] as literal <file.txt> instead of attachment links
created: 2026-06-06
updated: 2026-06-06
---

# Debug Session: wiki-attachment-link-render

## Symptoms

DATA_START
- **Expected behavior:** Jira wiki attachment syntax like `[^rest-log-detail-85008276.txt]` should render as a clickable link to the corresponding attachment (the attachments exist correctly on the issue).
- **Actual behavior:** The renderer outputs literal angle-bracket text, e.g. `<rest-log-detail-85008276.txt>`, for the whole run:
  - input: `[^rest-log-detail-85008276.txt][^rest-log-detail-85053230.txt][^rest-log-detail-85051168.txt][^rest-log-detail-85041096.txt][^rest-log-detail-85040430.txt][^rest-log-detail-85026388.txt]`
  - output: `<rest-log-detail-85008276.txt><rest-log-detail-85053230.txt>...`
- **Error messages:** none reported
- **Timeline:** not specified
- **Reproduction:** view an issue whose description/comment contains `[^attachment-name]` Jira wiki attachment references in the wiki renderer.
DATA_END

## Current Focus

- hypothesis: CONFIRMED — `preprocessJiraMarkup` had no handler for the `[^attachment]` link form; jira2md treated `[^name]` as a superscript autolink and emitted `<^name>` angle-bracket text.
- next_action: DONE — fix applied and verified.

## Evidence

- timestamp: 2026-06-06T21:41
  finding: `node -e "j2m.to_markdown('[^file.txt]')"` → `<^file.txt>` — confirms jira2md does not handle this syntax.
- timestamp: 2026-06-06T21:41
  finding: jira2md also converts `[text](url)` markdown links by consuming `[text]` as a bracket link and emitting `<text>`, so standard markdown link syntax cannot be used in the preprocessor either.
- timestamp: 2026-06-06T21:41
  finding: Raw `<a href="url">text</a>` HTML passes through jira2md unchanged and is allowed by `wikiSanitizeSchema` (`a` with `href` is already whitelisted on line 51 of WikiRenderer.tsx).

## Eliminated

- Hypothesis that it was a rendering/React layer issue — eliminated by confirming jira2md itself produces `<^name>`.
- Hypothesis that standard markdown `[text](url)` would work after preprocessing — eliminated: jira2md eats `[text]` bracket syntax.

## Resolution

- **root_cause:** `preprocessJiraMarkup` in `WikiRenderer.tsx` had no handler for the Jira `[^filename]` attachment-reference syntax. When jira2md received `[^filename]`, it treated `^filename` as a superscript autolink and emitted `<^filename>` (literal angle-bracket text), which React rendered as plain text.
- **fix:** Added a regex handler in `preprocessJiraMarkup` (after the mention handlers, before the panel handlers) that converts `[^filename]` to `<a href="url">filename</a>` (raw HTML, which passes through jira2md unchanged) when the filename is present in the `attachments` map, and to `` `filename` `` (a markdown code span) when the attachment is unknown. 4 new tests added covering: known attachment renders as anchor, multiple references, unknown attachment renders as code span, and regression guard against angle-bracket output. All 141 tests pass; `npm run check` is clean.
