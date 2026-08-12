---
status: resolved
trigger: "In issue description (wiki markup/renderer) if there is html in the description, it is not escaped and displayed but rendered as real html"
created: 2026-08-12
updated: 2026-08-12T15:20:00Z
---

## Symptoms

- expected: Raw HTML typed/pasted into an issue description should be escaped and shown as literal text when rendered by the wiki markup renderer (matching Jira's own wiki behavior).
- actual: Raw HTML in the description is not escaped — it is interpreted and rendered as live HTML by the browser/webview instead of displayed as text.
- errors: none reported
- timeline: not specified by user; noticed during normal use
- reproduction: not isolated to a specific tag yet — user is not sure if it's any HTML tag or only specific ones; investigate broadly
- severity_note: user considers this a display/formatting bug, not flagging it explicitly as a security concern — but investigator should still assess XSS risk given description content may originate from synced/external sources (e.g. Jira/GitLab), per project's WikiRenderer/jiraToTiptap pipeline

## Current Focus

reasoning_checkpoint:
  hypothesis: "Literal HTML tags typed into a Jira description (e.g. <b>, <h1>, <table>) are rendered as live DOM elements because WikiRenderer's pipeline runs rehype-raw (parses ALL raw HTML in the markdown string into the hast tree) followed by rehype-sanitize with a schema based on defaultSchema — which allowlists a large set of ordinary tags (a, b, i, em, strong, h1-h6, table, div, span, p, ol, li, etc.). Only genuinely dangerous tags/attrs (script, iframe, on*) are stripped. Real Jira wiki markup has no `<`/`>` syntax at all — any literal HTML a user types is inert/escaped unless wrapped in the (permission-gated) {html} macro. WikiRenderer never escapes the raw wikiText before feeding it through jira2md → rehypeRaw, so user-typed HTML is indistinguishable from the app's own synthetically-generated trusted HTML (mentions, panels, images, issue links) and gets parsed as real elements."
  confirming_evidence:
    - "Reproduced directly: rendering wikiText 'Hello <b>world</b> and <marquee>test</marquee> and <h1>Header</h1>' produces DOM: <p>Hello <b>world</b> and test and </p><h1>Header</h1><p></p> — <b> and <h1> became real elements (bold text, real heading), only <marquee> (not in defaultSchema) was stripped."
    - "Existing test suite already documents the sanitize-not-escape behavior for <script>: T-54-07-01 tests confirm <script> content is stripped as an element (XSS-safe) but explicitly not converted to visible literal text — same underlying gap, just for a tag that happens to be dangerous rather than benign."
    - "preprocessJiraMarkup (WikiRenderer.tsx) never escapes '<'/'>'/'&' in the incoming wikiText at any point before jira2md/rehypeRaw run; all regex passes only ADD template-literal HTML (mentions, panels, <strong>/<em>, <img>, <tt>, <br/>), they never read or neutralize pre-existing angle brackets from the source text."
  falsification_test: "If the hypothesis were wrong, escaping '<'/'>'/'&' in the raw wikiText before any preprocessing would have no effect on rendered output (tags would still parse as elements). Confirmed: it does have exactly the predicted effect (see fix verification below)."
  fix_rationale: "Escape '&', '<', '>' in the raw wikiText to HTML entities as the very first step of preprocessJiraMarkup — before any of the app's own regex passes inject trusted HTML (mentions/panels/images/bold/italic/etc). Since Jira wiki markup itself never legitimately uses angle brackets, this is lossless for real wiki content and makes literal HTML typed by a user render as escaped text (matching Jira's own behavior), while all of WikiRenderer's own synthetic HTML — added AFTER the escape step, via string concatenation, not sourced from the escaped raw text — continues to parse and render normally through rehypeRaw + rehypeSanitize."
  blind_spots: "Have not yet verified interaction with attachment/image URLs or mention display names that could themselves contain '&' (e.g. users?.[id] display name with an ampersand) — need to confirm those interpolations happen AFTER the escape step and don't get double-escaped, and that URLs with '&' in query strings (very common) still work correctly in <a href> / <img src>. Also have not run the full existing test suite yet to check for regressions in tests that rely on literal '<'/'>' passing through unmodified."

## Evidence

- timestamp: 2026-08-12T00:00:00Z
  checked: Rendered WikiRenderer with wikiText containing literal <b>, <marquee>, <h1> tags (scratch test, not committed)
  found: "<b>world</b> rendered as a real bold element; <h1>Header</h1> rendered as a real heading element; only <marquee> (absent from rehype-sanitize defaultSchema) was stripped to plain text 'test'."
  implication: "Confirms rehypeRaw + rehypeSanitize (with defaultSchema-based allowlist) interprets any user-typed HTML using an allowlisted tag name as live markup rather than escaping it — this is the root cause, not a symptom confined to a specific tag."

- timestamp: 2026-08-12T00:00:01Z
  checked: preprocessJiraMarkup source (WikiRenderer.tsx) top-to-bottom for any escaping of '<'/'>'/'&' from the raw wikiText
  found: "No escaping step exists anywhere in the pipeline before jira2md/rehypeRaw run. All `<tag>` occurrences in the preprocessed output are ADDED by the app's own regex replacements (mentions, panels, bold/italic, images, tt, br) — none of them neutralize pre-existing angle brackets from the source."
  implication: "The fix must add an escape step at the very start of preprocessJiraMarkup, before any synthetic HTML is injected, so the escape only touches user-original characters and not the app's trusted output."

## Eliminated

## Resolution

- root_cause: "WikiRenderer's rendering pipeline (jira2md → react-markdown with rehype-raw + rehype-sanitize) never escapes literal '<', '>', '&' characters in the raw Jira wikiText before parsing. rehype-raw parses ALL embedded HTML — both the app's own trusted synthetic markup (mentions/panels/images/bold-italic) AND any HTML a user happens to type directly into the description — into the hast tree. rehype-sanitize's schema (based on defaultSchema) then allows a large set of ordinary tags (b, i, h1-h6, table, div, span, p, ol, li, a, strong, em, etc.) through untouched, only stripping genuinely dangerous ones (script, iframe, on* attributes). Since real Jira wiki markup has no legitimate use of angle brackets, any literal HTML typed by a user is indistinguishable from the app's own generated HTML and renders live instead of being escaped as text — unlike real Jira, which treats raw HTML in wiki markup as inert unless wrapped in the permission-gated {html} macro."
  fix: "Added an HTML-entity escape step ('&'→'&amp;', '<'→'&lt;', '>'→'&gt;') as the very first transformation in preprocessJiraMarkup, immediately after CRLF normalization and before any of the function's other regex passes run. Because Jira wiki markup itself never legitimately uses angle brackets, and because every synthetic HTML tag the app generates (mentions, panels, <strong>/<em>, <img>, <tt>, <br/>, issue-key links) is injected via template-literal string concatenation AFTER this escape step (not sourced from the escaped raw text), the fix is lossless for genuine wiki content: literal user-typed HTML now renders as visible escaped text (matching Jira's own behavior) while all app-generated markup continues to render normally through rehype-raw + rehype-sanitize."
  verification: "Reproduced the bug pre-fix (rendered <b>, <h1>, <marquee> as live DOM elements), applied the fix, and confirmed the same input now renders as literal escaped text (&lt;b&gt;world&lt;/b&gt; etc.) while unrelated wiki features (bold/italic/mentions) still render correctly. Ran the full existing WikiRenderer.test.tsx suite (150 tests) — 1 pre-existing test relied on the old (buggy) behavior of raw <a> HTML parsing as a way to construct a hrefless-anchor edge case; updated it to use an equivalent Jira named-link-with-blank-URL construct ([bare anchor| ]) that exercises the same falsy-href code path without depending on literal HTML being parsed as live markup. All 150 WikiRenderer tests pass, all 6 dependent test files (MyTaskRow, AioTestRunDetailPage, IssueDetailSheet, IssueDetailContent, EpicDetailSheet, AioTestRunsSection) pass, and the full project test suite passes (2567 passed, 0 failed, 2 skipped, 13 todo — no regressions)."
  files_changed:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
