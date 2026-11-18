# Phase 102: Polished Surfaces - Research

**Researched:** 2026-11-18
**Domain:** In-repo React/Tailwind UI consistency work (Base UI Dialog, TipTap WikiEditor host, Jira createmeta). No new libraries.
**Confidence:** HIGH (every claim comes from reading the code in this repo; nothing depends on external docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** One field surface across the app: `Input`, `Textarea` and the WikiEditor frame share border, radius, padding, background (light and dark), focus, placeholder, disabled and invalid. Labels above the control in the Issue modal style (`text-xs font-semibold text-muted-foreground`, red `*` when required). The wiki frame (`WikiEditor.tsx:447`) is the known mismatch.
- **D-02** Surfaces in scope use `Input`, `Textarea`, `Button`, `Switch` from `components/ui`. No raw inputs, hand-rolled buttons or switches. Sentence case ("Create epic", "Epic name", "Edit release", "Bulk create subtasks").
- **D-03** Composer collapsed while idle (single-line "Add a comment…", no toolbar, no action row); expands on focus or when it holds text/draft into the compact editor plus action row; blurred empty collapses; blurred with text stays expanded; notification Reply (`useComposerFocus`) expands and focuses.
- **D-04** Comment edit uses the same sizing as the composer, opened already expanded.
- **D-05** One shared action-row component for both hosts: left = muted "Draft saved · Discard" note; right = quiet paperclip Attach icon button, Cancel (edit only), primary ("Comment" / "Save"). Keycap tooltips stay. Align spacing/button sizes with modal footers.
- **D-06** Composer has no Cancel; Esc blurs and keeps text; Discard lives in the draft note.
- **D-07** Composer action row only visible while expanded.
- **D-08** Create Epic = two-column Issue modal shell with `ModalSidebar` driven by the Epic issue type's createmeta (same field set/order as Create Issue). Size `min(1080px,94vw)` x `88vh`, header bar, blurred backdrop, independently scrolling main column, sticky footer. Main: Epic name (required), `full` description editor with Attach, staged files. `epicNameFieldKey` is filled from the Epic name input and must not appear twice in the sidebar. Sidebar values go in the create payload.
- **D-09** Epic drafts store the sidebar fields too; resume restores them with 101 D-15 stale-field handling.
- **D-10** No "Create another" on Create Epic. Footer: status/draft line left, Cancel + "Create epic" (⌘↵ tooltip) right.
- **D-11** Copy/controls fully aligned with the Issue modal (D-01, D-02).
- **D-12** Bulk Create Subtasks = Issue modal shell in ONE column, same fixed size, header "Bulk create subtasks" with "Parent: KEY" under it, template/type toolbar pinned under header, only the row list scrolls, controls aligned per D-01/D-02 including `SubtaskTemplateRow` inputs.
- **D-13** Edit Release two-column in the shell. Main: Name, Jira version description (tall, fills height), GitLab milestone section (Title, Description) only when matched. Sidebar: Release date (`DatePicker`) and Released `Switch`. Footer: per-source errors/status left; Cancel, Save right.
- **D-14** Edit Release descriptions stay plain textareas: no wiki editor, no preview, no toolbar; auto-grow or fill height; styled per D-01.

### Claude's Discretion
- Expanded composer min height and max-height cap (suggested: relative to the pane, ~half the available height, internal scroll past cap; same for composer and edit); collapse/expand animation must not shift the activity list.
- Whether the comment edit opens fitted to content or at a fixed expanded minimum.
- How to share the modal shell. Preferred: extract a shared shell and reuse `ModalSidebar`. Alternative: Create Epic as an Epic mode of `CreateEditIssueModal` if it keeps epic drafts (101 D-17) and staging (100 D-20). Planner picks after research.
- Narrow-window behaviour follows the Issue modal (side-by-side, shrink, stack below ~720px).
- Whether Bulk Create keeps fixed height (default: fixed).

### Deferred Ideas (OUT OF SCOPE)
- Markdown Write | Preview toggle for the GitLab milestone description.
- UI-04 (inline description editing) stays dropped (Phase 100 D-01).
- Reviewed todos not folded: notifications-highlight-you-mention, notifications-status-category-colours, priority-stripe-rest-rank.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-03 | Comment hosts have an expanding editor and a consistent, clean action row | Sections "Comment hosts" patterns 3-4: `CommentComposer.tsx` + `IssueDetailView.tsx:1106-1170` are the only two hosts; a shared `CommentActionRow` plus a focus-within expand controller; `WikiEditorHandle.insertFiles` powers Attach |
| UI-05 | Create Epic, Bulk Create Subtasks, Edit Release modals bigger and consistent with the Issue modal; Edit Release keeps plain-text fields | `ModalShell` extraction (pattern 1), Epic reuse of `ModalSidebar` + createmeta (pattern 2), Bulk one-column and Edit Release two-column per-surface notes |
</phase_requirements>

## Summary

All four surfaces are plain in-repo restyles. The Phase 101 `CreateEditIssueModal` already contains the exact shell (`CreateEditIssueModal.tsx:633-892`), and `ModalSidebar` takes `FormState` + a reducer `dispatch`, so Create Epic can reuse it without a rewrite. No new package is needed, so the Package Legitimacy Audit does not apply. [VERIFIED: codebase read]

The riskiest parts are not visual: (1) Create Epic needs `ModalSidebar`/`useCreateEditQueries` to understand an "Epic" type, which is not in the `IssueType` union (`'Story'|'Subtask'|'Bug'|'Defect'`) and currently shows an Epic picker and Story points that make no sense on an epic; (2) epic drafts and their sanitizer must grow new optional fields without invalidating drafts already stored on disk; (3) the composer's collapse-on-blur logic must not collapse when focus moves to the action row buttons, and the lazy editor chunk means "focus" can arrive before the editor exists; (4) the global WikiEditor frame restyle touches every host and some tests/screenshots.

**Primary recommendation:** Extract `ModalShell` (header, body slots, footer) into `routes/dashboard/create-edit-issue/` and use it for Epic, Bulk, Edit Release (and, as the last low-risk step, the Issue modal); implement Create Epic as its own dialog on `ModalSidebar` (not an Epic mode of the 931-line Issue modal); build one `CommentActionRow` plus a small `useExpandOnFocus`-style controller used by both comment hosts.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Modal shell, field surface, action row | Browser / Client (React components) | — | Pure presentation in the Tauri webview |
| Epic createmeta fields | Jira REST via `fetchCreatemeta` (client service layer) | TanStack Query cache | Existing `useCreateEditQueries` path |
| Epic create payload | Client service (`createIssue`) | — | Same call as today plus sidebar fields |
| Epic draft persistence | Client store (`issue-drafts.store`, Tauri file storage) | Tauri fs (staged files) | Existing 101 mechanism |
| Comment draft | `useEditorDraft` (existing) | — | Unchanged |
| Edit Release save | `useEditRelease.ts` (Jira version + GitLab milestone) | — | Unchanged, only the view changes |

## Standard Stack

No new dependencies. Use what is installed. [VERIFIED: codebase]

| Library | Purpose | Notes |
|---------|---------|-------|
| `@base-ui/react/dialog` | Dialog root/portal/popup/title/close | Already used by all four modals |
| `components/ui` `Input`, `Textarea`, `Button`, `Switch`, `DatePicker`, `Tooltip`, `Keycap`, `DraftNote` | Field surface and controls | `Input`/`Textarea` already match the UI-SPEC "single field surface" (they are the reference) |
| `@dnd-kit` | Bulk row list | Unchanged |
| lucide-react | `Paperclip`, `X`, `Loader2` | |

Installation: none. Registry safety: none new. Package Legitimacy Audit: not applicable (no packages installed).

## Architecture Patterns

### Data flow (Create Epic, the only structural change)

```
EpicsPage / draft chip resume ──> CreateEpicDialog(open, resumeDraftId)
   |                                   |
   |                    useReducer(formReducer) [FormState reused]
   |                    + epicName, description, staged files
   |                                   |
   |      useCreateEditQueries(selectedIssueType:'Epic') --> createmeta fields
   |                                   |
   |        ModalShell ── main: Epic name Input, WikiEditor(full), StagedFilesStrip
   |                   └─ aside: ModalSidebar(variant epic, fields from createmeta)
   |                                   |
   | user edit ──> useIssueDraft({kind:'epic'}).schedule(snapshot incl. sidebar)
   | submit  ──> createIssue(summary, {issuetype:'Epic',[epicNameFieldKey]:name, description,
   |                                   assignee, priority, labels, fixVersions, custom...})
   |         ──> uploadStagedFiles ──> invalidate ['jira-epics-basic'] ──> finishDraft
```

### Recommended structure
```
create-edit-issue/ModalShell.tsx   # new: Backdrop+Popup+@container, header, body slots, footer
create-edit-issue/ModalFooter.tsx? # optional: Cancel/primary buttons with Keycap tooltips (or inside ModalShell)
dashboard/comment-editor/CommentActionRow.tsx   # new: shared by both comment hosts
dashboard/comment-editor/useExpandOnFocus.ts    # new: expanded state + focusout containment
```

### Pattern 1: `ModalShell` extraction (UI-05, D-08/D-12/D-13)
**What:** One component owning the classes from `CreateEditIssueModal.tsx:633-892`: backdrop `fixed inset-0 z-50 bg-black/40 backdrop-blur-sm`; popup `w-[min(1080px,94vw)] h-[88vh] min-h-[480px] max-h-[calc(100vh-2rem)] overflow-hidden ... flex flex-col` with inner `@container`; header (`Dialog.Title text-lg font-semibold leading-tight`, Close `ml-auto`), body, footer (`border-t px-6 py-4`, left slot `data-testid="modal-footer-status"`).
**API suggestion:** `<ModalShell open onOpenChange title subtitle? onSubmit onKeyDown? footerStatus footerActions columns="two|one" aside?>`; keep `<form>` ownership in the shell or let callers pass `as`. The Issue modal uses `<form ref onSubmit onKeyDown>` wrapping header+body+footer so the primary button is `type="submit"`; Epic should do the same. Bulk and Edit Release currently use `onClick` handlers, not forms; keep `onClick` there (no behavioural change) and let the shell render the form only when `onSubmit` is provided.
**Esc contract:** Issue modal intercepts `details.reason === 'escape-key'` with `details.cancel()` then `requestCancel()` unless `details.event?.defaultPrevented` (editor already consumed Esc). The shell must pass `onOpenChange(open, details)` through untouched; do not hide `details`. Epic must replicate this (it currently has none; ordinary close flushes the draft).
**Adopting in the Issue modal:** do last, behind the existing `CreateEditIssueModal.layout.test.tsx`; it is optional for the requirements, skip if the diff gets risky (copying classes is acceptable per CONTEXT, but extraction is preferred).

### Pattern 2: Create Epic on `ModalSidebar` (D-08, D-09)
Choose a separate `CreateEpicDialog` that reuses `useReducer(formReducer, buildInitialState(...))`, `useCreateEditQueries`, `ModalSidebar`, `useDraftStagedFiles`, `useIssueDraft({kind:'epic'})`. Reasons: Epic keeps its own draft kind (101 D-17), no "Create another", no links, no epic-link/story logic; the Issue modal is 931 lines with those baked in, so an Epic mode would add conditionals to every branch. [ASSUMED: judgement call, tradeoff only]

Required changes to shared code (these are the integration traps):
1. **`IssueType`** (`useCreateEditForm.ts:44`) is `'Story'|'Subtask'|'Bug'|'Defect'`. `useCreateEditQueries` resolves the createmeta type id with `t.name === selectedIssueType`. Widen the union with `'Epic'` (check `IssueTypeSelector`, `labelsFixVersionsCreateFields`, `SET_ISSUE_TYPE`, `snapshot` types compile; `tsc` will list them) rather than faking `'Story'`. The Epic dialog never shows the Issue type row.
2. **`ModalSidebar`** needs an epic variant (prop `mode` is `'create'|'edit'`; add `isEpic`/`variant`): hide "Issue type", hide the "Epic" picker (an epic has no epic link), and show "Story points" only when createmeta offers the story-points field (today it is shown unconditionally for non-subtasks). Keep order Assignee, Priority, Labels, Fix version, custom fields. [VERIFIED: ModalSidebar.tsx order]
3. **Epic Name field must not be duplicated:** Epic createmeta marks `epicNameFieldKey` required, so `customRequiredFields` (computed in `useCreateEditQueries`, which already excludes `epicLinkFieldKey` and `storyPointsFieldKey`) would render it in the sidebar. Add `epicNameFieldKey` to that exclusion (new option, from `useSettingsStore`). Also exclude it from the submit "required custom fields filled" check. Likewise Epic createmeta commonly lists an "Epic Colour" style required field; whatever is required renders through `CustomFieldsSection` like any issue, which is the intended behaviour.
4. **Payload:** do not route through `useIssueMutations.createMutation` unless extended (it sends `epicLinkFieldKey`, link rows, parent-inherit logic). Simplest parity: build options with the same helpers: `labelsFixVersionsCreateFields(state, 'Epic', offered)`, assignee `{name}`, priority `{name}`, `wrapCustomFieldValue(fieldMeta, v)` for each non-empty `customFieldValues` entry, the same `offered` (createmeta id set, null when unknown) filtering, plus `[epicNameFieldKey]: epicName`. Cover with a test mirroring `useIssueMutations` expectations.
5. **Drafts:** `EpicDraftSnapshot` is `{epicName, description}` and `sanitizePersistedDrafts` checks only those two strings. Add the new fields as OPTIONAL (assignee/priority/labels/fixVersions/customFieldValues/customFieldInputValues/customFieldNames) and sanitize each if present, so epic drafts already on disk still load. `hasEpicContent` keeps counting only name/description/staged (matches D-12; a sidebar-only change does not create a draft). Resume: reuse `validateSnapshot` by building a full `IssueDraftSnapshot` with defaults for absent fields (it only consults createmeta, fix version ids, epic/parent existence), then `snapshotToFormPatch`. `useDraftResume` is Issue-specific (Issue type, `selectedIssueType`), so epic resume stays in the dialog's open effect, adding the validate-once step and a `staleNotes` pass to `ModalSidebar`. Note the project "enrichment invalidation / fetch-once" lessons: validate once per resume, after createmeta settles (copy `settled()` logic from `useDraftResume`).
6. **Submit guard:** `canSubmit = name && requiredCustomFieldsFilled(excluding epicName) && labels/fixVersions required checks && !pending && !hasCreatedWithError`. Keep `hasCreatedWithError` (created-but-upload-failed) behaviour and the `stagedUploadError` alert.
7. **Keep:** `flushSync` in the editor `onSubmit`, `trySubmit`/`requestSubmit`, previews restore loop (`setLocalPreview` retry per frame), `finishDraft`, `invalidate ['jira-epics-basic']`. Both entry points (EpicsPage and draft resume via `main.tsx`) must still mount it with `{open, onClose, resumeDraftId}`; keep that props contract.

### Pattern 3: Single field surface (D-01)
`Input` and `Textarea` already carry the contract (`rounded-lg border border-input bg-transparent ... focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ... dark:bg-input/30`). Only two places deviate: `WikiEditor.tsx:447` frame (`bg-background focus-within:ring-1 focus-within:ring-ring`) and `WikiEditorLazy.tsx:10` `FRAME` (`bg-background`). Change both to `bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50`. The skeleton fallback should match so there is no flash. Global effect: every host (issue detail description, comments, Create/Edit issue) changes; screenshot light and dark. Beware: `bg-transparent` means the frame inherits the modal/card background; the comment card and modal are `bg-background` so it is visually the same in light mode, but check the toolbar row inside the frame (it may rely on the opaque frame). Per project memory: render before and after (throwaway vite page / screenshot) before judging.

### Pattern 4: Comment hosts (UI-03)
Two hosts only: `CommentComposer.tsx` and the comment edit in `IssueDetailView.tsx:1106-1170` (`isEditing` branch). Both currently duplicate Tooltip+Button markup for the row.

**Shared `CommentActionRow`** (props: `draftState`, `onDiscard`, `onUseJira`, `onAttach`, `attachDisabled`, `onCancel?`, `onPrimary`, `primaryLabel`, `pendingLabel`, `pending`, `primaryDisabled`): `flex items-center gap-2`; left `DraftNote className="mr-auto"` (it reserves `min-h-6`, keep); right: ghost `icon-sm` Paperclip button with `aria-label="Attach files"` + tooltip, optional outline Cancel with Esc keycap tooltip, primary `sm` with ⌘↵ keycap tooltip. Check `Button` has an `icon-sm` size before use (`components/ui/button.tsx`; UI-SPEC assumes it exists, verify, add the size variant if missing). Attach opens a hidden `<input type="file" multiple>` and calls `handleRef.current?.insertFiles(files)` (same path as paste/drop, uploads live because the comment host is not `staged`). The composer pending label today is "Saving…" while UI-SPEC says "Posting…": use "Posting…" for the composer, update the test string.

**Expand controller:** state `expanded = focusedWithin || text !== '' || draftHydratedWithText`. Use `onFocus`/`onBlur` on the wrapper div (React focus events bubble, matching the existing `onBlur={draft.flush}` wrapper) and on blur check `e.relatedTarget` is inside `e.currentTarget` (otherwise clicking Attach/Comment blurs the editor, collapses the row, and the click is lost; classic bug). Popovers rendered in portals (mention/link suggestion, tooltips) are outside the wrapper DOM: a blur toward them with empty text collapses; acceptable because with empty text nothing is lost, but with text it stays expanded. Collapse only when `text.trim()===''`.
**Collapsed idle element:** a real focusable `<input readOnly>`-style (or `button`) with `Input` classes, `h-8`, placeholder "Add a comment…". On focus/click set `expanded=true` and request editor focus once the lazy editor is ready; reuse the existing `editorReady` + one-shot effect used for `composerFocus` (`handleRef.current?.focus({toEnd:true})`). The editor chunk therefore loads only on first expansion; the Suspense skeleton covers loading. Do NOT swap with an animation (UI-SPEC: instant, anchored same top edge).
**Reply:** the existing effect (`composerFocus === issueKey && editorReady`) must first set `expanded=true`; because the editor mounts only when expanded, `editorReady` becomes true after expansion; keep the clear call in the same effect. Existing `CommentComposer.test.tsx` covers composerFocus; the wiki stub (`@/test/wiki-editor-stub`) will only render once expanded, so tests need to expand first.
**Height cap:** `WikiEditor` accepts `maxHeightClass` (it already overrides `HEIGHTS[preset].max`), so pass `max-h-[min(50vh,480px)]` from both hosts; no editor change needed. Min stays `min-h-[96px]`.
**Comment edit:** mount expanded; keep `onBlur={onEditBlur}` wrapper; replace the inline row with `CommentActionRow` (Cancel + "Save"). Keep `onSaveEdit(comment.id, t)` and `onCancelEdit` wiring and `editPending` "Saving…".
**Esc:** composer `onCancel={() => handleRef.current?.blur()}` keeps text and, with text present, stays expanded.

### Pattern 5: Bulk Create (D-12)
`BulkCreateSubtasksModal.tsx:596`: change popup to the shell (no `overflow-y-auto` on the popup); toolbar becomes `border-b px-6 py-3` pinned child; row list wrapper becomes `min-h-0 flex-1 overflow-y-auto px-6 py-4`; footer keeps `BulkProgressIndicator` left slot and the Close/Retry/Create buttons but with default `Button` sizes; title via `Dialog.Title` (currently `h2`), "Parent: KEY" `text-xs`. Header Close button is `disabled={creating}` and `onOpenChange` ignores close while `creating`: keep both (the shell must support a `closeDisabled` prop and must not force Esc cancel). The footer currently has `bg-muted/50 rounded-b-lg`; the shell footer has none, drop it for consistency. Empty state copy per UI-SPEC: "No subtasks yet" / "Add a row or pick a template to start." Keep dnd-kit untouched; `SubtaskTemplateRow` already lives in `create-edit-issue/`; check its raw `<input>`/`<select>` usage and swap to `Input`/`Select` primitives (D-02). Memory gotchas: one row = one line; keep the 0-width-column and truncate pitfalls in mind if touching row layouts (`flex-none`/`min-w-0`).
Dialog-in-dialog: the DragOverlay renders inside the popup; keep it unchanged.

### Pattern 6: Edit Release (D-13/D-14)
`EditReleaseModal.tsx` is a pure view driven by props from `useEditRelease.ts`; keep the props interface unchanged so `ReleaseDetailPage.tsx` and its hook need no edits. Changes: shell two-column; Name `Input` required label with `*`; Description `Textarea` with `flex-1 min-h-40 resize-none` (note `Textarea` has `field-sizing-content`, which auto-grows; with `flex-1` plus `resize-none` and a fixed container, override with `field-sizing-fixed` if it refuses to fill; verify in a screenshot); milestone section `border-t pt-4` with Title `Input` and Description `Textarea min-h-24`; sidebar: `DatePicker` (label "Release date") and the shared `Switch` (`role="switch"`; its checked colour is `bg-primary`, the old hand-rolled one was green; UI-SPEC says accent = primary, accept). The old label text swapped "Released"/"Unreleased" on state; UI-SPEC says label "Released" fixed with the switch on the right. Footer left slot: per-source errors (`Couldn't update the Jira version: {reason}. Try again.` / GitLab equivalent) as text-xs destructive, so the modal no longer grows when errors appear. Existing handlers use `onClick`, not a form: Cmd+Enter is not required by the decisions (add only if trivial). Replace `h2` with `Dialog.Title`. Save keeps the `Check` icon? UI-SPEC does not mention it; drop it for consistency with other primaries, keep `Loader2` pending.

### Anti-Patterns to Avoid
- **Copying shell classes into 4 dialogs** (drift). Extract.
- **Collapsing on any blur** (loses the Comment click). Use `relatedTarget` containment.
- **Branching a stateful cell on a value its own optimistic update flips** (project memory: optimistic mark unmount).
- **Hidden module-level reads in components**: the React Compiler runs in the app but not vitest (memory: React Compiler vs module reads). New hooks must use real state/`useSyncExternalStore`, not module variables, e.g. for the expand state or preview registrations.
- **Bulk `biome --write` on all of `src`** or global find-replace of strings that also appear in labels (memory). Rename copy per file.
- **Using `git stash` to compare lint/test baselines** (memory).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Field styling | Per-surface border/ring classes | `Input`/`Textarea`; the one WikiEditor frame fix |
| Switch | Custom button toggle (current Edit Release) | `components/ui/switch.tsx` |
| Sidebar fields for Epic | New field components | `ModalSidebar`, `CustomFieldsSection`, `LabelsField`, `FixVersionField`, `PersonPicker` |
| Createmeta | New fetcher | `useCreateEditQueries` / `fetchCreatemeta` |
| Draft persistence | New store | `useIssueDraft({kind:'epic'})`, `useDraftStagedFiles`, `issue-drafts.store` |
| Stale-field validation | New validator | `validateSnapshot` + `snapshotToFormPatch` |
| Attach in comments | New upload path | `WikiEditorHandle.insertFiles` |
| Keycap tooltips, discard note | New markup | `Keycap`, `TooltipBody`, `DraftNote`, `DiscardChangesDialog` |

## Runtime State Inventory

Not a rename/refactor phase; one data-shape change.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Persisted epic drafts (`issue-drafts.json`, Tauri store) have snapshot `{epicName, description}` | Code edit only: new snapshot fields OPTIONAL; sanitizer must accept old shape. No migration |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | `epicNameFieldKey` setting (settings store) is read, not renamed | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: Duplicate Epic Name field
**What goes wrong:** Epic createmeta marks the epic-name custom field required, so it renders again in the sidebar and in the payload twice.
**How to avoid:** exclude `epicNameFieldKey` in `useCreateEditQueries.customRequiredFields` and in the submit guard; set it only from the main-column input.
**Warning signs:** a required "Epic Name" row in the sidebar; test with createmeta fixture containing that field id.

### Pitfall 2: Sidebar shows irrelevant Epic/Story-points rows for an epic
**How to avoid:** the epic variant of `ModalSidebar` (see Pattern 2.2).

### Pitfall 3: Old epic drafts rejected after schema change
**How to avoid:** optional fields in `EpicDraftSnapshot`; sanitizer test with an old-shape draft.

### Pitfall 4: Composer collapses when clicking Attach/Comment
**How to avoid:** focusout containment check; test `fireEvent.blur` with `relatedTarget` inside vs outside.

### Pitfall 5: Reply focus lost because editor is not mounted while collapsed
**How to avoid:** the composerFocus effect expands first; focus when `editorReady`. Test through the existing composerFocus store.

### Pitfall 6: Global frame restyle regressions
**Why:** `bg-background` to `bg-transparent` changes the look wherever the frame sits on a non-background surface and in dark mode (`dark:bg-input/30` on top of the card). **How to avoid:** screenshot light/dark in issue detail, comment card, modal; update any class-asserting test.

### Pitfall 7: Nested Esc closing the parent
Esc inside popovers or the editor must not close the shell. Keep the `details.cancel()` + `defaultPrevented` pattern from the Issue modal; Bulk must keep ignoring close while `creating`.

### Pitfall 8: Sticky/overflow layout
Popup is `overflow-hidden` with `flex-col`; body `min-h-0 flex-1`, columns `overflow-y-auto`. Missing `min-h-0` makes the whole dialog grow past `88vh` (the current Bulk bug class). Sidebar width container query: `min-[721px]:@max-[900px]:w-[240px]` needs the `@container` ancestor, which the shell supplies (memory: container query not on self).

### Pitfall 9: Title Case strings spread across tests
Issue modal still has "Create Issue", "Save Changes", "Creating..." (UI-SPEC suggests normalising to sentence case). Many tests assert these (`CreateEditIssueModal.*.test.tsx`, `CreateEpicDialog.test.tsx`, `EpicsPage.test.tsx`). Do copy changes in dedicated tasks with test updates, per file, not by global replace. Decide explicitly whether to touch the Issue modal strings (UI-SPEC says normalise; low risk).

### Pitfall 10: Pre-commit runs full vitest and biome per command
Combine RED/GREEN into one commit per task (memory). Biome baseline is non-zero and drifts: gate on "no new files flagged".

## Code Examples

Focus containment (pattern, not library code):
```tsx
// Source: repo convention (CommentComposer wrapper already uses onBlur bubbling)
<div
  onFocus={() => setFocused(true)}
  onBlur={(e) => {
    draft.flush();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }}
>
```
Existing max-height override (no editor change needed): `<WikiEditorLazy preset="compact" maxHeightClass="max-h-[min(50vh,480px)]" ... />` [VERIFIED: `WikiEditor.tsx` reads `maxHeightClass ?? sizes.max`].

## State of the Art

| Old | Current (this phase) |
|-----|----------------------|
| Create Epic `max-w-md` card, raw input/buttons, `z-40` unblurred backdrop | Shell + `ModalSidebar` |
| Edit Release `w-[680px]`, popup scrolls, hand-rolled switch | Shell two-column, `Switch` |
| Fixed `max-h-[280px]` compact editor | `max-h-[min(50vh,480px)]` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Separate `CreateEpicDialog` over an Epic mode of the Issue modal is the cheaper, safer path | Pattern 2 | Planner may choose Epic mode; research supports either, but the cost is higher |
| A2 | `Button` has an `icon-sm` size | Pattern 4 | Add the variant (tiny) |
| A3 | The Jira Epic create screen offers Assignee/Priority/Labels/Fix version in the live instance (ESHOP priority was missing from the create screen for Story, see 101-12) | Pattern 2 | Sidebar rows must follow createmeta/`offered` rules; the Priority list may need the same reference-issue editmeta fallback used by the Issue modal (`priorityOptions`). Plan a UAT check against the live Epic type |
| A4 | The createmeta `Epic` type exists with `name === 'Epic'` | Pattern 2 | Create already sends `issuetype: 'Epic'`, so likely fine |
| A5 | `Textarea` `field-sizing-content` may fight `flex-1` height; needs visual verification | Pattern 6 | Use `field-sizing-fixed` override |

## Open Questions

1. **Priority options for Epic.** The Issue modal builds `priorityOptions` (101-12: from createmeta, else a reference issue's editmeta under its own query key). Reuse that same source for Epic in `CreateEpicDialog`; confirm where it lives in `CreateEditIssueModal.tsx` (search `priorityOptions`) and extract it into `useCreateEditQueries` or a small shared hook rather than copying.
2. **Issue modal string normalisation** ("Create Issue" to "Create issue"): UI-SPEC recommends; confirm in plan.
3. **Comment edit opening height:** UI-SPEC resolves it (content height, min 96px); no open question beyond screenshots.

## Environment Availability

Code-only phase (no new external tools). Existing: node/npm, vitest, biome, tsc (project toolchain). Live Jira for UAT is required only for manual verification of Epic createmeta; Jira-writing checks have been skipped by the user in prior phases (101-12), so expect the same.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4 + React Testing Library (jsdom); `@/test/wiki-editor-stub` stubs the lazy editor |
| Config file | existing vitest config in `taskflow/taskflow/` (no Wave 0 install) |
| Quick run | `cd taskflow/taskflow && npx vitest run <file>` |
| Full suite | `cd taskflow/taskflow && npm test && npm run check` (biome baseline is non-zero: gate on no NEW flagged files; also `tsc --noEmit` through `check`) |

### Phase Requirements to Test Map
| Req | Behavior | Test Type | Command | File |
|-----|----------|-----------|---------|------|
| UI-03 | Idle composer shows single-line field, no toolbar/action row | component | `npx vitest run src/routes/dashboard/CommentComposer.test.tsx` | exists, update |
| UI-03 | Focus expands; blur empty collapses; blur with text stays; blur to action-row button does not collapse | component | same | update |
| UI-03 | composerFocus (Reply) expands then focuses | component | same | exists, update |
| UI-03 | No Cancel on composer; Esc blurs and keeps text | component | same | update |
| UI-03 | `CommentActionRow` renders note left, Attach/Cancel/primary right, Attach calls `insertFiles` | unit | `npx vitest run src/routes/dashboard/comment-editor/CommentActionRow.test.tsx` | Wave 0 new |
| UI-03 | Comment edit opens expanded with the shared row (Cancel + Save) | component | `npx vitest run src/routes/dashboard/IssueDetailContent.test.tsx` (or `IssueDetailView` test) | exists, update |
| UI-03 | Attachments path still uploads | component | `npx vitest run src/routes/dashboard/CommentComposer.attachments.test.tsx` | exists |
| UI-05 | `ModalShell` renders title, columns, footer slots; Esc cancel passes `details` | component | `npx vitest run src/routes/dashboard/create-edit-issue/ModalShell.test.tsx` | Wave 0 new |
| UI-05 | Create Epic: sidebar fields from Epic createmeta; epic-name field excluded from sidebar; values in payload; no Create another; labels aligned | component | `npx vitest run src/routes/dashboard/CreateEpicDialog.test.tsx` | exists, rewrite |
| UI-05 | Epic drafts store/restore sidebar fields; old-shape draft still sanitizes | unit | `npx vitest run src/stores/issue-drafts.store.test.ts src/lib/issue-draft-snapshot.test.ts` | check existence; extend |
| UI-05 | Bulk: title/parent line, toolbar pinned, only list scrolls (class assertions), Close disabled while creating | component | `npx vitest run src/routes/dashboard/BulkCreateSubtasksModal.test.ts` | exists (non-DOM), add `.dom.test.tsx` if needed |
| UI-05 | Edit Release: shared `Switch`, two-column, textareas only (no wiki editor), per-source errors in footer, props unchanged | component | `npx vitest run src/routes/dashboard/release-detail/EditReleaseModal.test.tsx` | Wave 0 new |
| D-01 | Frame classes on WikiEditor/Lazy skeleton match Input surface | unit | `npx vitest run src/components/wiki-editor` | add assertion |
| Regression | Issue modal unchanged by shell adoption | component | `npx vitest run src/routes/dashboard/create-edit-issue` | exists |
| Regression | editor-removal guard still passes | guard | `npx vitest run src/routes/dashboard/editor-removal.guard.test.ts` | exists |

Manual-only (visual, per memory "screenshot before judging"): light/dark frame screenshots, narrow-window (720/900px) behaviour of the two new two-column modals, composer expand/collapse not shifting the activity list, Epic createmeta against the live Jira (user has skipped Jira-writing checks; read-only createmeta check is feasible).

### Sampling Rate
- Per task commit: the specific test file(s) for the touched surface (the pre-commit hook runs the full suite anyway).
- Per wave merge: `npm test` plus `tsc --noEmit`.
- Phase gate: full suite green, biome no new flagged files, screenshots reviewed.

### Wave 0 Gaps
- [ ] `ModalShell.test.tsx`, `CommentActionRow.test.tsx`, `EditReleaseModal.test.tsx` (new)
- [ ] Fixtures: Epic createmeta containing the epic-name field, labels, fixVersions, a required custom field
- [ ] Confirm test files for draft store/snapshot exist before extending
- [ ] No framework install needed

## Security Domain

Local desktop app calling Jira with a PAT from Stronghold; this phase adds no auth, storage of secrets or new network endpoints.

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V2/V3 Auth/Session | no | unchanged |
| V4 Access control | no | unchanged |
| V5 Input validation | yes | Persisted drafts are untrusted JSON: extend `sanitizePersistedDrafts` with type checks for each new epic field (no `as` casts); never log draft content (existing rule) |
| V6 Crypto | no | unchanged |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Malformed/tampered epic draft file | Tampering | Field-level validation in sanitizer; unknown shapes dropped |
| Staged file paths from drafts | Tampering | Existing `isFileRef` safe-ref filtering retained |
| XSS in description | Tampering | Description is text sent to Jira; rendering paths unchanged |

## Sources

### Primary (HIGH confidence, direct code reads)
- `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (shell 633-892), `ModalSidebar.tsx`, `useCreateEditForm.ts`, `useCreateEditQueries.ts`, `useIssueMutations.ts`, `issue-field-diff.ts`, `useDraftResume.ts`
- `taskflow/src/routes/dashboard/CreateEpicDialog.tsx`, `CommentComposer.tsx`, `IssueDetailView.tsx` (1106-1170), `BulkCreateSubtasksModal.tsx` (570-769), `release-detail/EditReleaseModal.tsx`
- `taskflow/src/components/wiki-editor/WikiEditor.tsx`, `WikiEditorLazy.tsx`, `types.ts`; `components/ui/input.tsx`, `textarea.tsx`, `switch.tsx`, `draft-note.tsx`
- `taskflow/src/stores/issue-drafts.store.ts`, `lib/issue-draft-snapshot.ts`, `stores/composer-focus.store.ts`
- `.planning/phases/101-.../101-12-SUMMARY.md`, `102-CONTEXT.md`, `102-UI-SPEC.md`

### Secondary/Tertiary
- None (no external sources needed; Context7 CLI not installed and not required).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new packages)
- Architecture: HIGH for shell/composer/Bulk/Edit Release; MEDIUM for Epic reuse details (Priority source, `IssueType` widening ripple: `tsc` will confirm)
- Pitfalls: HIGH (derived from code and project memory)

**Research date:** 2026-11-18
**Valid until:** 2026-12-18 (internal code; changes only if Phase 101 files are edited)
