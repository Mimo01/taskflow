---
status: resolved
trigger: "wiki renderer on issue detail mis-renders underscores, {{tt}} inside -strike-, and drops a list item"
created: 2026-10-05
updated: 2026-10-05
---

# Debug: wiki-underscore-tt-strike

## Trigger (verbatim user data)

DATA_START
There is a problem in wiki renderer on issue detail. This raw text:
Vytvoriť novú TO (tarifnú opciu) pre službu VOYO v eshope.
 * Názov TO: VOYO_STD_VAS -{{VOYO_STD}}-
 * {{AS_ID}} = 3520

Gets rendered as this [screenshot]
DATA_END

## Symptoms

- **Expected:** Paragraph, then a 2-item bullet list:
  1. "Názov TO: VOYO_STD_VAS " followed by a strikethrough monospace `VOYO_STD`
  2. monospace `AS_ID` followed by " = 3520"
- **Actual (from screenshot):**
  1. `VOYO_STD_VAS` renders as "VOYO*STD*VAS": the underscores are removed and "STD" is italicised (intra-word `_..._` treated as emphasis).
  2. `-{{VOYO_STD}}-` renders as strikethrough monospace, but the literal backticks show: "`VOYO_STD`" (the markdown conversion of {{...}} leaks backticks, likely because the strike wrapper is converted after or around the code span and the code span isn't recognised).
  3. The second bullet `* {{AS_ID}} = 3520` is missing from the output entirely.
- **Errors:** none reported
- **Timeline:** unknown
- **Reproduction:** Open an issue whose description contains the raw text above, in the issue detail view (WikiRenderer).
- **Relevant memory:** WikiRenderer.tsx handles Jira tt macro `{{{}TEXT{}}}` with the regex around line 624 (project_jira_tt_macro_format); react-markdown 10 + rehype pipeline (project_react_markdown_text_override).

## Current Focus

hypothesis: (none yet)
next_action: gather initial evidence — reproduce with a WikiRenderer unit test using the exact input, then trace the Jira-wiki → markdown conversion for `_`, `-...-`, `{{...}}` and leading-space ` * ` list items
reasoning_checkpoint:
tdd_checkpoint:

## Evidence

- Pipeline repro (jsdom): only symptom 1 reproduces in DOM; <ul> has BOTH bullets; code renders <del><code>VOYO_STD</code></del>.
- Symptom 1: convertInlineBoldItalic italic regex had no word-boundary rule, so VOYO_STD_VAS -> <em>. jira2md has the same flaw.
- Symptom 2: @tailwindcss/typography adds ::before/::after backticks on <code>; not a markdown leak.
- Symptom 3: NOT reproducible from the pasted text; likely a rendering/whitespace difference in the real data.

## Eliminated

- Backticks leaking from markdown conversion (DOM has none).
- Missing bullet from list-parse bug (both li present).

## Resolution

root_cause: (1) italic regexes lacked word-boundary; (2) typography plugin default code backticks; (3) not reproduced
fix: boundary-aware italic regex + USCORE placeholder for intra-word _ + prose-code:before/after:content-none
verification: 4 new tests (2 fail pre-fix); user confirmed in app 2026-10-05; date-picker tests made locale-independent (abb5d689); fix c0379a01. Symptom 3 not reproduced — user did not report it persisting.
files_changed: taskflow/src/routes/dashboard/WikiRenderer.tsx, WikiRenderer.test.tsx
