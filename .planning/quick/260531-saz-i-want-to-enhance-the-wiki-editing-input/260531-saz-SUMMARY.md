---
phase: quick-260531-saz
plan: "01"
subsystem: wiki-editor
tags: [tiptap, prosemirror, wysiwyg, jira-wiki, serializer, round-trip, tdd]
dependency_graph:
  requires: [WikiRenderer.tsx (preprocessJiraMarkup + jira2md pipeline)]
  provides: [WikiEditor component, jiraWikiSerializer, jiraToTiptap, RawJiraNode, buildExtensions]
  affects: [DescriptionEditor, CommentComposer, InlineComment, IssueDetailPage.CommentCard]
tech_stack:
  added:
    - "@tiptap/react@3.24.0"
    - "@tiptap/core@3.24.0"
    - "@tiptap/pm@3.24.0"
    - "@tiptap/starter-kit@3.24.0"
    - "@tiptap/html@3.24.0"
    - "@tiptap/extension-table@3.24.0"
    - "@tiptap/extension-table-row@3.24.0"
    - "@tiptap/extension-table-cell@3.24.0"
    - "@tiptap/extension-table-header@3.24.0"
    - "@tiptap/extension-task-list@3.24.0"
    - "@tiptap/extension-task-item@3.24.0"
    - "@tiptap/extension-mention@3.24.0"
  patterns:
    - ProseMirror atom-node passthrough (RawJiraNode) for lossless unknown-macro preservation
    - TipTap controlled-value pattern with dirty refs (no setContent on every keystroke)
    - Single schema source (buildExtensions) shared by load path and edit path
    - accountId-prefix encoding in mention data-id for round-trip fidelity
key_files:
  created:
    - taskflow/src/components/wiki-editor/jiraWikiSerializer.ts
    - taskflow/src/components/wiki-editor/jiraToTiptap.ts
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/components/wiki-editor/SourceView.tsx
    - taskflow/src/components/wiki-editor/wikiEditorExtensions.ts
    - taskflow/src/components/wiki-editor/extensions/RawJiraNode.ts
    - taskflow/src/components/wiki-editor/extensions/JiraColorMark.ts
    - taskflow/src/components/wiki-editor/extensions/JiraCalloutNode.ts
    - taskflow/src/components/wiki-editor/extensions/mentionConfig.tsx
    - taskflow/src/components/wiki-editor/jiraWikiSerializer.test.ts
    - taskflow/src/components/wiki-editor/WikiEditor.test.tsx
    - taskflow/src/components/wiki-editor/index.ts
  modified:
    - taskflow/src/routes/dashboard/DescriptionEditor.tsx
    - taskflow/src/routes/dashboard/CommentComposer.tsx
    - taskflow/src/routes/dashboard/InlineComment.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx (CommentCard edit mode)
    - taskflow/package.json (11 @tiptap deps added)
    - taskflow/src/routes/dashboard/CommentComposer.test.tsx (WikiEditor stub added)
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx (WikiEditor stub added)
    - taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx (WikiEditor stub added)
decisions:
  - D-OQ1: task-list serializes to (/) / (x) emoticon-prefix convention (WikiRenderer already maps these)
  - D-OQ2: color as JiraColorMark (inline mark), panels as JiraCalloutNode (editable body); unknowns → RawJiraNode
  - D-OQ3: DescriptionEditor drops Edit/Preview tabs — WYSIWYG IS the preview
  - D-source-authority: dirty refs guard no-op open+save from rewriting markup
  - D-accountId-prefix: jiraToTiptap pre-marks accountId:XXX in data-id attr so serializer can emit [~accountId:XXX] without length-guessing
  - D-LoadPathMention: separate parse-only Mention extension for generateJSON (no suggestion UI) vs createMentionExtension for WikiEditor
metrics:
  duration: "~3h"
  completed: "2026-05-31"
  tasks_completed: 7
  files_created: 12
  files_modified: 8
---

# Phase quick-260531-saz Plan 01: WYSIWYG Wiki Editor Summary

**One-liner:** TipTap v3 WYSIWYG editor with Source toggle replacing four duplicated textarea editors, backed by a purpose-built ProseMirror→Jira-wiki serializer with 32-case round-trip test matrix and lossless unknown-macro passthrough via RawJiraNode.

## What Was Built

A shared `<WikiEditor>` component replacing all four duplicated `<textarea>` + toolbar wiki editors (DescriptionEditor, CommentComposer, InlineComment composer + edit mode, IssueDetailPage CommentCard edit mode). The canonical value format remains Jira wiki markup — the editor converts Jira→TipTap on load and TipTap→Jira on save.

### Core Pipeline

**Load path (Jira → WYSIWYG):**
```
Jira wiki markup
  → preprocessJiraMarkup()   [reused from WikiRenderer — no second parser]
  → jira2md.to_markdown()
  → markAccountIdMentions()  [pre-marks accountId:XXX in data-id for round-trip]
  → j2m.md_to_html()
  → generateJSON(html, buildExtensions())   [@tiptap/html]
  → TipTap JSONContent doc
```

**Save path (WYSIWYG → Jira):**
```
TipTap JSONContent doc
  → serializeToJiraWiki()    [bespoke ProseMirror doc-walker]
  → Jira wiki markup string
  → onChange(value) → existing postComment / updateComment / issue update (UNCHANGED)
```

### Key Components

| File | Purpose |
|------|---------|
| `jiraWikiSerializer.ts` | ProseMirror JSONContent → Jira wiki. Handles all node/mark types. RawJiraNode emits verbatim. |
| `jiraToTiptap.ts` | Load path. Reuses preprocessJiraMarkup + jira2md. Pre-marks accountId mentions. |
| `wikiEditorExtensions.ts` | Single `buildExtensions()` shared by load path + editor (no schema drift). |
| `WikiEditor.tsx` | Controlled WYSIWYG + Source toggle. Dirty refs guard no-op rewrites. |
| `SourceView.tsx` | Font-mono styled `<textarea>` for raw Jira wiki editing. |
| `extensions/RawJiraNode.ts` | Atom passthrough node. Unknown macros preserved verbatim. |
| `extensions/JiraColorMark.ts` | Inline mark for `{color:#hex}...{color}`. |
| `extensions/JiraCalloutNode.ts` | Block node for `{panel}/{info}/{warning}/{note}` callouts. |
| `extensions/mentionConfig.tsx` | `createMentionExtension` factory wiring `fetchAssignableUsers` to TipTap suggestion. |

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| jiraWikiSerializer.test.ts (round-trip matrix) | 32 | PASS |
| WikiEditor.test.tsx (behaviour) | 6 | PASS |
| WikiRenderer.test.tsx (XSS guard T-54-07-01) | 137 | PASS |
| Full suite (npm test) | 1701 | PASS |
| biome check + tsc | — | PASS (0 errors) |
| npm run build | — | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] accountId mention round-trip required a pre-pass**
- **Found during:** Task 3 GREEN phase (mention tests)
- **Issue:** `preprocessJiraMarkup` converts `[~accountId:XXX]` → `<mention data-id="XXX">`, stripping the `accountId:` prefix. After `generateJSON`, TipTap stores just `XXX` as the id. Short accountIds (< 24 hex chars) can't be distinguished from usernames by length alone.
- **Fix:** `jiraToTiptap` runs a `markAccountIdMentions()` pre-pass that scans the original wiki source for `[~accountId:...]` patterns and rewrites `data-id="XXX"` to `data-id="accountId:XXX"` in the HTML before `generateJSON`. Serializer checks `id.startsWith('accountId:')` and emits `[~accountId:XXX]`.
- **Files modified:** `jiraToTiptap.ts`, `jiraWikiSerializer.ts`
- **Commit:** 2b9179dd

**2. [Rule 1 - Bug] Multi-line {quote} serialized as bq. (single-line form)**
- **Found during:** Task 3 GREEN phase
- **Issue:** `preprocessJiraMarkup` converts `{quote}\nL1\nL2\n{quote}` → `> L1\n> L2` (markdown blockquote). `j2m.md_to_html()` + `generateJSON` produce a single blockquote paragraph with `hardBreak` nodes between lines. Serializer saw `children.length === 1` and emitted `bq. L1\\L2` instead of `{quote}\nL1\nL2\n{quote}`.
- **Fix:** `serializeBlockquote` detects `hardBreak` nodes inside the single paragraph and splits at them to emit the `{quote}` form.
- **Files modified:** `jiraWikiSerializer.ts`
- **Commit:** 2b9179dd

**3. [Rule 1 - Bug] Code block trailing newline in output**
- **Found during:** Task 3 GREEN phase
- **Issue:** `extractPlainText(codeBlock)` included a trailing `\n` from TipTap's codeBlock text model, producing `{code}\nsome code\n\n{code}` (extra blank line).
- **Fix:** `extractPlainText(node).replace(/\n$/, '')` in the codeBlock case.
- **Files modified:** `jiraWikiSerializer.ts`
- **Commit:** 2b9179dd

**4. [Rule 2 - Missing] Test files needed WikiEditor mock for pre-existing test patterns**
- **Found during:** Task 6/7 — existing tests use `getByPlaceholderText` / `getAllByRole('textbox')` patterns that relied on the old `<Textarea>`.
- **Fix:** Added `@/components/wiki-editor` stub (controlled textarea forwarding placeholder) to `CommentComposer.test.tsx`, `IssueDetailSheet.test.tsx`, and `IssueDetailPage.progressive.test.tsx`.
- **Commit:** 4d732419, 781537dc

**5. [Rule 3 - Blocking] tippy.js not installed — mention popup reimplemented**
- **Found during:** Task 4 when writing `mentionConfig.tsx`
- **Issue:** TipTap mention examples use `tippy.js` for the suggestion popup, but it's not in the project's dependencies.
- **Fix:** Implemented the suggestion renderer using a plain `document.createElement('div')` + `ReactRenderer` positioned absolutely, without any external popup library. Zero new dependencies added.
- **Files modified:** `extensions/mentionConfig.tsx`
- **Commit:** cff532f2

## Known Stubs

None. All wiki editor functionality is fully wired:
- `jiraToTiptap` calls the real `preprocessJiraMarkup` + `jira2md` pipeline
- `serializeToJiraWiki` walks the real ProseMirror JSON
- `fetchAssignableUsers` is wired to the real mention suggestion items
- All four call sites use the real `WikiEditor` component

## Threat Flags

No new network endpoints, auth paths, or trust boundary changes introduced.

T-saz-01 (paste XSS): TipTap schema only keeps registered nodes/marks on paste — `<script>` cannot survive. Saved output is Jira wiki text, re-rendered through WikiRenderer's existing `rehype-sanitize` allowlist.

T-saz-02 (stored XSS): `wikiSanitizeSchema` in WikiRenderer is UNCHANGED — byte-for-byte identical. XSS guard test (T-54-07-01) passes with 137/137 assertions.

## Task 8 — Manual Verification (PENDING)

Task 8 is a `checkpoint:human-verify` gate. See below for what the user should verify.

## Self-Check: PASSED

All created files found on disk. All 8 commits present in git log. 1701 tests pass. Build succeeds.
