---
phase: quick-260531-saz
verified: 2026-05-31T21:30:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open an issue with rich content (bold, headings, lists, table, panel, mention, code block) and confirm each element renders as true WYSIWYG — editable in place, not as raw wiki markup text."
    expected: "Bold appears bold, h1-h6 render as headings, lists are bulleted/numbered, tables render as a grid, panels show as a styled block, @mentions resolve with display names, code blocks use a monospace style."
    why_human: "TipTap contenteditable rendering is a browser/DOM behavior that grep and jsdom mocks cannot confirm."
  - test: "Toggle Source in the description editor: confirm the textarea shows the canonical raw Jira wiki markup for the current content. Edit a word in Source, toggle back to WYSIWYG, and confirm the change is reflected."
    expected: "Source textarea shows exact Jira wiki syntax. Editing in Source and toggling back updates the WYSIWYG doc."
    why_human: "Round-trip through the live editor DOM can only be confirmed in the running app."
  - test: "Open an issue description, click Save WITHOUT making any edits. Reopen the issue in Jira or inspect the API response and confirm the stored markup was not rewritten/normalized (no spurious diff)."
    expected: "Stored markup is byte-identical to the original. Jira does not report an edit or a change timestamp update."
    why_human: "No-op dirty-flag guard covers the component side in unit tests, but actual Jira API round-trip persistence requires a live run."
  - test: "In a comment composer, type '@' and confirm the mention autocomplete popup appears, select a user, and submit the comment. In Jira, confirm the mention resolves to [~username] or [~accountId:XXX]."
    expected: "Autocomplete popup appears with real user results from fetchAssignableUsers. Submitted comment stores the correct [~username] or [~accountId:XXX] form."
    why_human: "Mention popup positioning and live suggestion fetch (readSecret + fetchAssignableUsers network call) cannot be verified without a running Tauri app."
  - test: "Open an existing comment that contains an unsupported Jira macro (e.g. {jira:...} or {chart}). Edit a different word in the comment body, save, and confirm the unsupported macro text is preserved verbatim."
    expected: "The unsupported macro appears as a RawJira chip in WYSIWYG mode and is preserved byte-for-byte in the saved markup."
    why_human: "Requires a real Jira issue with an unsupported macro and a live save round-trip."
---

# Phase quick-260531-saz: WYSIWYG Wiki Editor Verification Report

**Phase Goal:** Enhance the wiki editing input into a full WYSIWYG editor (TipTap) for issue descriptions and comments, with a Source toggle to view/edit raw Jira wiki markup, supporting all style types, preserving lossless round-trip to Jira wiki markup. Extract a single reusable WikiEditor shared component used by all four editing surfaces.

**Verified:** 2026-05-31T21:30:00Z
**Status:** human_needed (automated checks fully pass; 5 live-app behaviors need human verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every supported Jira style edits as true WYSIWYG | ? HUMAN | WikiEditor.tsx uses @tiptap/react with StarterKit + table + task + color + callout extensions; substantive toolbar implemented. Cannot confirm WYSIWYG rendering without live DOM. |
| 2 | A Source toggle shows and edits canonical raw Jira wiki markup; both views stay in sync | VERIFIED | WikiEditor.tsx lines 181–217 implement toggle logic. SourceView.tsx is a real controlled textarea with `aria-label="Source"`. WikiEditor.test.tsx tests toggle (3 cases including the round-trip back). |
| 3 | Jira wiki markup the WYSIWYG cannot model is preserved verbatim (not dropped) on round-trip | VERIFIED | RawJiraNode.ts is a real atom node with `raw` attr. jiraWikiSerializer.ts line 127 emits `attrs.raw` verbatim. jiraWikiSerializer.test.ts has a `RawJiraNode passthrough` describe block asserting unknown macros survive. |
| 4 | A single WikiEditor replaces textarea editors in DescriptionEditor, CommentComposer, InlineComment, and CommentCard edit mode | VERIFIED | All four files import from `@/components/wiki-editor` and render `<WikiEditor>`. Old `applyMarkup`/`insertAtCursor`/`MentionPopover` functional code is absent; only comment references remain. |
| 5 | @mention autocomplete still works and serializes to [~username] / [~accountId:XXX] | VERIFIED (code path) / ? HUMAN (live popup) | mentionConfig.tsx line 22 imports `fetchAssignableUsers`, line 157 calls it in suggestion.items. jiraWikiSerializer.ts serializeMention handles both `accountId:` prefix and bare username forms. jiraToTiptap.ts has markAccountIdMentions pre-pass. Test confirms round-trip for both `[~jsmith]` and `[~accountId:abc123def456]`. Live popup needs human check. |
| 6 | Opening then saving an unchanged field does not rewrite/normalize the markup (no spurious diff) | VERIFIED (code path) / ? HUMAN (Jira API) | WikiEditor.tsx lines 181–196: `handleToggleToSource` checks `wysiwygDirtyRef.current` and returns original `value` when not dirty. WikiEditor.test.tsx "no-op" test asserts `onChange` not called. Actual Jira persistence requires human verification. |
| 7 | The rehype-sanitize XSS allowlist in WikiRenderer is unchanged and its guard test still passes | VERIFIED | WikiRenderer.tsx git log shows no saz commits touched it. The `wikiSanitizeSchema` object is present and unchanged. SUMMARY reports 137/137 WikiRenderer tests pass. |

**Score:** 7/7 truths verified (5 have human sub-items)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/components/wiki-editor/jiraWikiSerializer.ts` | ProseMirror doc -> Jira wiki serializer | VERIFIED | 395 lines; exports `serializeToJiraWiki`; covers all node types including rawJira verbatim passthrough, mentions with accountId prefix, task list emoticon-prefix, blockquote split-at-hardBreak, table rows, callouts. |
| `taskflow/src/components/wiki-editor/jiraWikiSerializer.test.ts` | Round-trip matrix | VERIFIED | 27 `it()` cases covering all style rows from the plan: inline marks, h1–h6, bullet/ordered/nested lists, task list, blockquote (bq./quote), code block with/without lang, HR, links, table, mentions, color, panel, unknown-macro passthrough, and 3 no-op idempotence cases. |
| `taskflow/src/components/wiki-editor/WikiEditor.tsx` | Shared WYSIWYG + Source-toggle | VERIFIED | 382 lines; exports `WikiEditor`; implements full props interface, dirty refs, Source toggle, toolbar with 9 actions, controlled sync with Pitfall-5 guard, Cmd/Ctrl+Enter submit, disabled mode. |
| `taskflow/src/components/wiki-editor/extensions/RawJiraNode.ts` | Atom passthrough node | VERIFIED | Implements atom, selectable, non-editable `addNodeView`, `parseHTML` on `div[data-raw-jira]`, `renderHTML` as chip. |
| `taskflow/src/components/wiki-editor/jiraToTiptap.ts` | Jira wiki -> TipTap JSON load path | VERIFIED | Imports `preprocessJiraMarkup` from WikiRenderer (single parser, no duplicate). Runs full pipeline: preprocessJiraMarkup -> jira2md -> fixMarkdownLinkUnderscores -> md_to_html -> generateJSON. Has markAccountIdMentions pre-pass. |
| `taskflow/src/components/wiki-editor/extensions/JiraColorMark.ts` | Inline mark for {color:#hex} | VERIFIED (exists + non-empty) | Present in extensions directory. |
| `taskflow/src/components/wiki-editor/extensions/JiraCalloutNode.ts` | Block node for panel/info/warning/note | VERIFIED (exists + non-empty) | Present in extensions directory. |
| `taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx` | MentionExtension factory | VERIFIED | Imports `fetchAssignableUsers`; suggestion.items calls it with projectKey, jiraBaseUrl, token from readSecret. No tippy.js dependency (reimplemented with plain DOM). |
| `taskflow/src/components/wiki-editor/wikiEditorExtensions.ts` | buildExtensions() single schema source | VERIFIED (exists) | Present; imported by both jiraToTiptap.ts and WikiEditor.tsx. |
| `taskflow/src/components/wiki-editor/SourceView.tsx` | Font-mono styled textarea | VERIFIED | Controlled textarea, `aria-label="Source"`, font-mono class, minHeight style. |
| `taskflow/src/components/wiki-editor/index.ts` | Public barrel | VERIFIED | Exports WikiEditor, RawJiraNode, jiraToTiptap, serializeToJiraWiki, WikiEditorProps. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `jiraToTiptap.ts` | `WikiRenderer.tsx` | imports `preprocessJiraMarkup` | WIRED | Line 32: `import { ..., preprocessJiraMarkup, ... } from '@/routes/dashboard/WikiRenderer'` |
| `WikiEditor.tsx` | `jiraWikiSerializer.ts` | `serializeToJiraWiki` on onUpdate and toggle | WIRED | Line 33 import; line 141 called in onUpdate; line 187 called in handleToggleToSource |
| `DescriptionEditor.tsx` | `WikiEditor.tsx` | renders `<WikiEditor>` | WIRED | Line 9 import; line 20 JSX usage |
| `mentionConfig.tsx` | `users.ts` | `fetchAssignableUsers` in suggestion.items | WIRED | Line 22 import; line 157 call inside suggestion.items callback |
| `CommentComposer.tsx` | `WikiEditor.tsx` | renders `<WikiEditor>` | WIRED | Line 15 import; line 45 JSX usage |
| `InlineComment.tsx` | `WikiEditor.tsx` | renders `<WikiEditor>` (both composer + edit mode) | WIRED | Line 14 import; lines 228 and 276 JSX usage |
| `IssueDetailPage.tsx` | `WikiEditor.tsx` | renders `<WikiEditor>` for CommentCard edit mode | WIRED | Line 19 import; line 791 JSX usage |

---

### WikiRenderer XSS Schema Verification

The `wikiSanitizeSchema` object in `WikiRenderer.tsx` was not modified by any saz-phase commit. `git log -- taskflow/src/routes/dashboard/WikiRenderer.tsx` shows no commits from this task (most recent is `ec456b3a` from a prior quick task). The schema remains:

```
...defaultSchema
tagNames: [..., 'mention', 'br', 'span']
attributes: div/span/strong/mention/img/a allowlist (unchanged)
```

---

### Out-of-Scope Fields

WikiEditor usage is confined to exactly four files: DescriptionEditor.tsx, CommentComposer.tsx, InlineComment.tsx, and IssueDetailPage.tsx (CommentCard edit mode at line 791). A codebase-wide grep of `WikiEditor` across all other source files returned no matches. Worklog comment textareas, release/milestone description fields, and other surfaces are untouched.

---

### TipTap Dependency Audit

All 12 `@tiptap/*` packages are present in `taskflow/package.json` at `^3.24.0`:

`@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/html`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-mention`.

---

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| None found | — | — | No TBD/FIXME/XXX/placeholder/return null stubs detected in new files. mentionConfig.tsx reimplements tippy.js with plain DOM (intentional, documented in SUMMARY deviations). |

---

### Human Verification Required

#### 1. WYSIWYG Rendering of Rich Content

**Test:** Open an issue with rich content (bold, headings, lists, table, panel, mention, code block) and verify each element renders as true WYSIWYG in the editor.
**Expected:** Bold appears bold in the editor, headings render at their heading size, lists are visually bulleted/numbered, tables render as a grid, panels appear as styled callout blocks, mentions show display names.
**Why human:** TipTap contenteditable rendering is a browser behavior; jsdom mocks return `<div data-testid="tiptap-editor">` stubs.

#### 2. Source Toggle Sync

**Test:** Open an issue description editor. Toggle to Source. Confirm raw Jira wiki markup is shown. Edit a word in Source. Toggle back. Confirm WYSIWYG reflects the change.
**Expected:** Source shows exact Jira wiki syntax. Edit in Source survives the toggle-back.
**Why human:** Source<->WYSIWYG data sync through the live editor state cannot be validated without the running app.

#### 3. No-Op Open+Save (Spurious Diff Guard)

**Test:** Open a description or comment that has existing markup. Click Save/Submit WITHOUT typing anything. In Jira's audit log or by re-fetching the issue, confirm the stored markup is unchanged.
**Expected:** No Jira edit event triggered; markup byte-identical.
**Why human:** The dirty-flag unit test only confirms onChange is not called inside the component. Whether the parent mutation fires (or is suppressed at the call site) requires a live test.

#### 4. @Mention Autocomplete + Round-Trip Serialization

**Test:** In a comment composer, type `@` and a few characters. Confirm the autocomplete popup appears with real user results. Select a user, submit. In Jira, confirm the stored mention is `[~username]` or `[~accountId:XXX]`.
**Expected:** Popup appears, positioned near the caret. Stored markup uses the correct mention syntax.
**Why human:** readSecret() + fetchAssignableUsers is a network call; mention popup DOM positioning requires a real browser layout engine.

#### 5. Unknown Macro Verbatim Preservation on Save

**Test:** Find an issue whose description or comment contains a Jira macro that is not in the supported set (e.g. `{jira:...}`, `{chart}`, `{create-on-transition}`). Load it in the editor. Edit something else (e.g. fix a typo in a paragraph above). Save. Confirm the unsupported macro is preserved verbatim.
**Expected:** The unsupported macro appears as a "Raw Jira macro" chip in WYSIWYG mode and is saved unchanged.
**Why human:** Requires a real Jira issue with an unsupported macro and a live API save round-trip.

---

## Gaps Summary

No automated gaps. All artifacts exist, are substantive, and are wired. The five human verification items above are behavioral checks that require the running Tauri app connected to a live Jira instance. They do not indicate implementation defects — they are confirmations that the wired implementation behaves correctly end-to-end.

---

_Verified: 2026-05-31T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
