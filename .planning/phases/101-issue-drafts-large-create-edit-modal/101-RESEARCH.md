# Phase 101: Issue Drafts & Large Create/Edit Modal - Research

**Researched:** 2026-11-17
**Domain:** React/Tauri desktop app. Large two-column modal, persisted multi-draft store, app-storage file staging, TopBar chip and popover.
**Confidence:** HIGH on codebase facts (read directly). MEDIUM on Tauri fs capability details (docs only, not exercised in this repo).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dialog is large and fixed-size, about `min(1080px, 94vw)` x `88vh`. Main column scrolls on its own; fields sidebar about 300px; footer sticky. (User: "large and well usable, you decide"; exact sizes and narrow behaviour are Claude's call.)
- **D-02:** Main column: issue-type selector and title in the header, then Summary, the editor (`full` toolbar, 100 D-02), the staged-files strip, and Links (existing `LinkRowsSection`).
- **D-03:** No subtasks in the modal, in Create or Edit mode. Update REQUIREMENTS.md UI-01 (remove "subtasks" from the main column) and ROADMAP.md Phase 101 success criterion 1 the same way. A docs change in the first plan, like Phase 100 D-01, not a code task.
- **D-04:** Sidebar: all metadata fields, label above a full-width control. Field order is Claude's call.
- **D-05:** Sticky footer. Left: "Create another" checkbox (Create mode only) and the status line (D-08 / D-15). Right: Cancel, then the primary button with the ⌘↵ tooltip (100 D-14/D-15). Edit footer has no "Create another".
- **D-06:** "Create another" resets to unticked every time the modal opens. Not persisted.
- **D-07:** Which fields carry over after a create is Claude's call.
- **D-08:** Success feedback is Claude's call; no toast library, so inline in the modal.
- **D-09:** Each create in a "Create another" run is its own draft lifecycle. The submitted draft is removed on success (DRAFT-07). The next form is a fresh draft.
- **D-10:** Continuous autosave: debounced writes while typing; flush on close or blur; a crash or force-quit mid-typing loses nothing. Matches Phase 100 drafts behaviour.
- **D-11:** Every close keeps the draft, with no prompt (X, backdrop, Cancel, Esc, navigating away). Create modal never shows "Discard changes?" (FLOW-02 exception). Discarding is only explicit (D-14, D-18). Esc still defers to open popovers first (100 D-11).
- **D-12:** A draft is created only when there is user-entered content: summary text, description text, a staged attachment, or a filled link row. Changing only type, assignee, priority or other prefilled defaults does not create a draft. Once a draft exists, every field is saved with it.
- **D-13:** Opening Create while drafts exist opens a blank form that starts a new independent draft (DRAFT-02). A "You have N drafts · Resume" hint is Claude's call; keep it cheap to add or remove; expect revisit at UAT.
- **D-14:** A resumed draft reopens with every field restored: type, project, summary, description, assignee, priority, labels, custom fields, parent/epic, links and staged files. Footer shows muted "Draft saved · Discard" (same style as 100 D-04). Discard removes the draft and closes the modal.
- **D-15:** Stale draft on resume: restore everything still valid; clear each invalid piece and show a muted inline note next to its field ("Epic ABC-12 no longer exists", "photo.png is missing", custom field no longer on the screen). Never block the user. Mirrors 100 D-05.
- **D-16:** Drafts persist across restarts until a successful create or explicit discard (DRAFT-06/07). No expiry; cleared on credential change (100 D-21).
- **D-17:** Create Epic is included. `CreateEpicDialog` (`EpicsPage.tsx:334`) must auto-save into the same drafts list (type icon Epic); resuming reopens `CreateEpicDialog`. Subtask drafts keep their parent key.
- **Staged attachments (DRAFT-05):** staged files are copied into app storage (under `appDataDir`) when staged. The draft stores references to the copies, not `File` objects. On create they upload as today (99 D-09). On discard or after a successful create the copies are deleted. Previews follow the WKWebView blob gotcha (data: URIs, not blob: in iframes).
- **D-18:** Chip is in the TopBar, left of Search. Labelled pill "✎ Drafts 2", visible on every page, shown only when drafts exist. Reads as a control, not a tab; visually distinct from `PinnedTabStrip`.
- **D-19:** Chip opens a popover, newest first. Row: type icon, summary or "Untitled", parent/epic key, "edited 5m ago". Click resumes. Discard is a hover/trailing action. Row styling follows `RecentItemsPopover` / `RecentItemRow`.
- **D-20:** How discard works from the list is Claude's call.

### Claude's Discretion
- Exact dialog size and narrow-window behaviour (sidebar stays side-by-side and shrinks; collapse only when really too narrow).
- Sidebar field order (suggested: Assignee, Priority, Epic/Parent, Labels, Fix version if offered by createmeta, Story points, Estimate, Custom fields). A dedicated labels input is allowed if labels aren't already covered by `CustomFieldsSection`. Check createmeta first.
- Create another, kept fields (suggested keep: type, project, epic/parent, assignee, priority, labels, fix version, other "context" custom fields; clear: summary, description, estimate, story points, links, staged files; then focus Summary).
- Create another, feedback (suggested: muted footer line "✓ Created ABC-123 · Open", Open opens the issue in the peek; replaced on each create).
- Resume hint on a blank form (D-13).
- Discard from the list (suggested: inline "Draft discarded · Undo" for a few seconds; staged copies deleted only once the undo expires).
- Draft store shape: extend `drafts.store.ts` with an `issue-create` kind, or add a sibling persisted store keyed by draft id (uuid). Issue drafts are structured, not one text string. Debounce writes. Never log draft content.

### Deferred Ideas (OUT OF SCOPE)
- Subtasks in the Create/Edit modal were dropped by user decision (D-03), not deferred.
- Reviewed todos not folded: `notifications-due-date-overdue`, `notifications-highlight-you-mention`, `notifications-status-category-colours`.
- Phase 102 owns the other editor hosts (comment hosts, Create Epic / Bulk Subtasks / Edit Release restyle). Comment and Edit-description drafts from Phase 100 are not reworked.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Large two-column Create/Edit modal (D-03 drops subtasks) | Shell restructure of `CreateEditIssueModal.tsx`; fixed-size Dialog.Popup; container-query narrow behaviour; sidebar fields incl. new optional labels / fix version |
| UI-02 | "Create another" keeps modal open with common fields kept | `createMutation.onSuccess` must expose the new key; partial-reset reducer action; footer status line |
| DRAFT-01 | Closing Create with content auto-saves (any type incl. Epic) | New persisted issue-drafts store + `useIssueDraft` autosave hook; Epic via CreateEpicDialog (D-17) |
| DRAFT-02 | Several independent drafts | Store keyed by uuid; Create opens blank (new id lazily allocated on first content) |
| DRAFT-03 | TopBar Drafts chip + list | `DraftsChip` before the Search button in `TopBar.tsx`; popover modelled on `RecentItemsPopover` |
| DRAFT-04 | Resume from anywhere restores every field | Global open entry (store) + `HYDRATE` reducer action + stale validation vs createmeta |
| DRAFT-05 | Staged attachments kept in app storage, uploaded on create | `@tauri-apps/plugin-fs` + Rust plugin + capability; bytes written via `writeFile` (source is `File`, not a path) |
| DRAFT-06 | Persist across restarts | `createTauriStorage('issue-drafts.json')` + hydration gate |
| DRAFT-07 | Discard from list; create removes draft | `removeDraft(id)` deletes staged copies; called from create `onSuccess`; undo window |
</phase_requirements>

## Summary

The modal and the draft system are mostly integration work on existing, well-understood pieces. `CreateEditIssueModal.tsx` (774 LOC) already has the Base UI `Dialog`, a reducer-based form (`useCreateEditForm`), staged files as `File[]`, the Cmd+Enter/Esc handling and the Phase 100 `DraftNote`. Phase 100's `drafts.store.ts` is a flat `Record<string, {kind, issueKey, text, base?}>` keyed by strings and holds text only; it should NOT be extended for structured issue drafts. Add a sibling persisted store (`issue-drafts.store.ts`) keyed by uuid, with the same owner-reconcile semantics.

Three findings change the plan scope versus what CONTEXT assumes:

1. **Labels and Fix version do not exist in the modal today.** `CustomFieldsSection` renders only *required* createmeta fields (`customRequiredFields` filter in `useCreateEditQueries.ts:99`), and `labels`/`fixVersions` are not in `CORE_FIELD_IDS`, so they only appear if required, and a required `labels` would be sent as a raw string by `wrapCustomFieldValue` (wrong shape: Jira wants an array). DRAFT-04 and D-04 need a real Labels control and a Fix-version control, plus `createIssue` body support (`labels: string[]`, `fixVersions: [{id}]`). This is new form state, new reducer fields, and new submit wiring.
2. **No filesystem plugin is installed.** Only store/stronghold/http/notification/updater/opener/process plugins exist. DRAFT-05 requires adding `tauri-plugin-fs` (Rust crate, `lib.rs` registration, capability permissions) and `@tauri-apps/plugin-fs` (npm). This is the only native-side change and cannot be validated by vitest.
3. **`CreateEpicDialog` is mounted only inside `EpicsPage`** (`EpicsPage.tsx:334`) and holds its own local state. "Resume from anywhere" for Epic drafts requires either hoisting the dialog to `AppLayout` or driving it from the same global open-store. It must also gain autosave.

**Primary recommendation:** Build in this order: (1) docs edit per D-03; (2) `issue-drafts.store` + staged-file storage service (pure, unit-testable); (3) form snapshot/hydrate + stale validation (pure functions); (4) modal re-layout with labels / fix version; (5) autosave wiring + "Create another"; (6) global open-store, TopBar chip/popover, Epic draft integration; (7) fs plugin native wiring and a manual restart check.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form state, layout, Create another | Browser / Client (React) | — | Pure UI state; no server involvement until submit |
| Draft persistence (structured fields) | Browser / Client (Tauri store `issue-drafts.json`) | — | Same mechanism as drafts/pinned/recent stores |
| Staged file bytes | OS filesystem via Tauri fs plugin (`$APPDATA`) | Browser (File reconstruction for upload) | Files exceed what a JSON store should hold; must survive restart |
| Stale-field validation on resume | Client, against Jira createmeta/issue lookups | API (Jira) | Needs live Jira data (epic exists, field still on screen) |
| Create / link / attachment upload | API (Jira REST via existing `services/jira`) | — | Unchanged |
| Cross-page "open create with draft" | Client global store (zustand) | `AppLayout` host | Create is opened from many places; needs one entry point |

## Standard Stack

### Core (all already in the repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand + `persist` | ^5.0.11 [VERIFIED: package.json] | Draft store | Used by `drafts`, `pinned-tabs`, `recent-items` |
| `createTauriStorage` (`src/lib/tauri-storage.ts`) | repo | `LazyStore` persistence adapter | Existing pattern; tests get an in-memory mock from `src/test/setup.ts` |
| `@base-ui/react` Dialog/Popover | ^1.2.0 [VERIFIED: package.json] | Modal and chip popover | Existing modal and `popover.tsx` wrapper |
| `@tanstack/react-query` | ^5.90.21 [VERIFIED: package.json] | createmeta / issue lookups for stale checks | Existing queries |
| lucide-react `PenLine` | existing icon lib | Chip icon | UI-SPEC |

### Supporting (new)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-fs` | 2.7.1 (npm, modified 2026-10-14) [VERIFIED: npm view] | Copy staged files into `$APPDATA`, read back, delete | DRAFT-05 only |
| `tauri-plugin-fs` (Rust crate) | 2.x; already a transitive dep in `src-tauri/Cargo.lock` [VERIFIED: Cargo.lock]; docs require Rust >= 1.90, local rustc is 1.95 [VERIFIED: rustc --version] | Backing plugin | DRAFT-05 only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fs plugin | A custom Rust `#[tauri::command]` for write/read/delete | No new plugin surface, but more Rust to own and test. The official plugin with an `$APPDATA/**` scope is smaller |
| Sibling store | Extend `drafts.store.ts` with kind `issue-create` | Its `setDraft` deletes entries whose `text` is empty and its shape is text-only; forcing structured data in is a hack. Sibling store wins |
| Storing file bytes in `issue-drafts.json` (base64) | — | Rejected by the user (D-DRAFT-05: copy to app storage); also bloats the JSON rewritten on every keystroke flush |

**Installation:**
```bash
cd taskflow && npm install @tauri-apps/plugin-fs
cd src-tauri && cargo add tauri-plugin-fs
# lib.rs: .plugin(tauri_plugin_fs::init())
```

**Version verification:** `npm view @tauri-apps/plugin-fs version` returned 2.7.1; repository `tauri-apps/plugins-workspace`, maintained by the Tauri org (same maintainers as the already-installed `@tauri-apps/plugin-store`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tauri-apps/plugin-fs` | npm | multi-year (official Tauri v2 plugin) | not checked | github.com/tauri-apps/plugins-workspace | not run (`pip` unavailable in this environment) | [ASSUMED] pending checkpoint; named in official Tauri docs [CITED: v2.tauri.app/plugin/file-system] and `npm view` shows Tauri org maintainers and no postinstall output |
| `tauri-plugin-fs` | crates.io | official | not checked | github.com/tauri-apps/plugins-workspace | not run | Already resolved in `Cargo.lock` as a transitive dep; same workspace as installed plugins |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck could not run).
**Packages flagged [SUS]:** none. Because slopcheck was unavailable, the planner should add one `checkpoint:human-verify` before the install task.

## Architecture Patterns

### System Architecture Diagram

```
 Entry points (main.tsx AppLayout, CommandPalette, IssueDetail, PeekPanel, Chip)
        |  openCreate(...)                    |  resume(draftId)
        v                                      v
  create-modal store  ------------------>  CreateEditIssueModal  (portal to body)
  {open, mode, defaults, resumeId}           |
                                             |-- reducer (FormState) --snapshot--> useIssueDraft
                                             |        ^                            |  debounce 500ms + flush on blur/close
                                             |        | HYDRATE(validated)         v
                                             |        |                      issue-drafts.store (zustand persist -> issue-drafts.json)
                                             |        |                            |
                                             |   stale-check (createmeta, epic/parent lookup, file exists)
                                             |
                                             |-- stageFile(File) --> staged-files service --> $APPDATA/issue-drafts/<draftId>/<name>  (plugin-fs)
                                             |
                                             +-- submit --> createIssue -> links -> uploadStagedFiles(File[] rebuilt from copies)
                                                              | success
                                                              v
                                          removeDraft(id) + delete copies  (+ Create another reset / close)

 TopBar: DraftsChip (reads issue-drafts.store, hidden if 0) -> Popover list -> resume(id) / discard(id) with undo window
 Epic drafts: CreateEpicDialog (hoisted to AppLayout or opened via same store) autosaves into the same store, kind='epic'
 Credential/owner change: reconcileOwner -> clear drafts AND delete $APPDATA/issue-drafts
```

### Recommended Project Structure
```
src/stores/issue-drafts.store.ts            # persisted store, uuid keys, owner reconcile, selectors (sorted newest first)
src/lib/issue-draft-files.ts                # stage/read/remove/purge copies via plugin-fs (mockable seam)
src/lib/issue-draft-snapshot.ts             # pure: formState -> snapshot, hasUserContent(), keptFieldsAfterCreate(), validateSnapshot()
src/stores/create-modal.store.ts            # global open-create entry (replaces the 6 useState in AppLayout)
src/hooks/useIssueDraft.ts                  # debounce/flush/discard; mirrors useEditorDraft
src/components/app/DraftsChip.tsx           # chip + popover + rows
src/routes/dashboard/create-edit-issue/
  CreateEditIssueModal.tsx                  # two-column shell
  ModalSidebar.tsx / LabelsField.tsx / FixVersionField.tsx   # new sidebar pieces
```

### Pattern 1: Sibling persisted store with owner reconcile
**What:** Copy the `drafts.store.ts` shape (persist + `createTauriStorage` + `owner` + `reconcileOwner` + `useXHydrated`).
**When:** Issue drafts. `reconcileOwner` on a changed account must also purge staged files (call the file service; keep the store itself free of Tauri imports so it tests easily by injecting or by calling the purge from the guard hook).
```typescript
// Source: repo pattern, src/stores/drafts.store.ts
export interface IssueDraft {
  id: string;                         // crypto.randomUUID()
  kind: 'issue' | 'epic';
  updatedAt: number;
  snapshot: IssueDraftSnapshot;       // serialisable FormState subset + projectKey + defaultParentKey
  files: { name: string; size: number; type: string; path: string }[]; // path relative to $APPDATA
}
```

### Pattern 2: Allocate the draft id lazily
`hasUserContent(state, files)` (D-12) gates the first write. Hold `draftIdRef` in the modal. Create it on first content, reuse it for every later flush, null it on create-success / discard / new open. A resumed draft sets the ref to its id. Prefilled defaults (type, assignee, parent, epic from `defaultEpicLinkKey`) never create a draft by themselves.

### Pattern 3: Snapshot only serialisable state
Persist: type, summary, description, selectedAssignee, selectedAssigneeName, priority, storyPoints, timeEstimate, epicLinkKey, parentKey, labels, fixVersion, `customFieldValues`, `customFieldInputValues`, linkRows, projectKey. Do NOT persist `apiError`, `customFieldAutoResults`, `customFieldShowResults`. Add a `HYDRATE` reducer action (the existing `RESET` rebuilds from `EditInitialValues` and cannot carry this).

### Pattern 4: Close always flushes, never prompts (Create)
`requestCancel` today only prompts when `dirty` (edit mode only, `dirty = mode==='edit' && ...`), so Create already closes silently. Keep that: Create `Cancel`/Esc/X/backdrop all call `flush(); onClose()`. Edit keeps the Phase 100 `DiscardChangesDialog` flow.

### Pattern 5: Global open entry
The six `useState`s and the `handleOpen*` family in `main.tsx:132-640` are the only way to open Create. Introduce a small zustand store and let `AppLayout` read it; keep the existing `handleOpen*` call sites working by having them call the store. Add `resumeDraftId` to it. TopBar receives `onResumeDraft` or reads the store directly (TopBar is "pure UI", so prefer a prop from AppLayout).

### Anti-Patterns to Avoid
- **Re-RESET on every draft write:** the open effect in `useCreateEditForm` has `initialValues` in its deps and RESETs the form. Draft writes must never flow back into props; hydrate once per open via `HYDRATE`.
- **Persisting `File` objects or blob URLs:** not serialisable and dead after restart.
- **Letting `Create another` reuse the draft id:** each create is its own lifecycle (D-09). Reset `draftIdRef` to null when the form resets.
- **Branching a stateful cell on a value its own optimistic patch flips** (project memory): irrelevant to autosave note visibility; derive "draft exists" from `draftIdRef`/store, not from the field.
- **Logging draft content** (summary/description may contain customer data).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persisted store + hydration gate | custom file IO | `persist` + `createTauriStorage` + `useDraftsHydrated`-style hook | Already solved including "never write before hydration" |
| Debounce/flush/discard | new timers logic | Mirror `useEditorDraft` (500ms `DRAFT_DEBOUNCE_MS`, flush guarded by `hasHydrated()`) | Same race conditions already handled |
| Draft note | new component | `DraftNote` (`state="draft"`; the "stale" branch unused here) | UI-SPEC says reuse |
| Person/epic/select pickers | new inputs | `PersonPicker`, `EpicPicker`, `Select`/`SearchableSelect` | Project convention |
| Relative time | formatter | `relativeTime()` in `src/lib/relative-time.ts` (returns "5 minutes ago"; UI-SPEC wants "edited 5m ago", so check whether a short variant exists; otherwise add one small helper next to it) | Existing |
| Row hover/active styling | new row style | Copy `RecentItemsPopover` / `RecentItemRow` classes | UI-SPEC |
| Native file copy | Rust commands | `@tauri-apps/plugin-fs` | Scoped, audited |
| Fix-version/labels option fetch | hand-written REST | createmeta `allowedValues` already fetched by `fetchCreatemeta` | No extra call |

**Key insight:** every piece of draft behaviour already exists once (Phase 100 text drafts). The new risk is not the mechanism but the shape: structured state, files on disk, and a global open path.

## Runtime State Inventory

Not a rename/refactor phase, but it introduces new persisted state with a lifecycle that must be cleaned on several paths:

| Category | Items | Action Required |
|----------|-------|------------------|
| Stored data | New `issue-drafts.json` (Tauri store) | Create store; clear on account change; bump `version` only if shape changes later |
| Files on disk | `$APPDATA/issue-drafts/<draftId>/*` | Delete on discard, on create success, on owner change, and purge orphans (dirs with no matching draft) at hydration |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | `src-tauri/Cargo.lock`, `gen/schemas` regenerate after adding the plugin | Commit lockfile change |

## Common Pitfalls

### Pitfall 1: Labels / Fix version are not actually in the modal
**What goes wrong:** Planning assumes `CustomFieldsSection` covers labels. It renders only required non-core fields.
**How to avoid:** Plan explicit tasks: `labels: string[]` and `fixVersion` in `FormState`, controls, `createIssue` options (`labels`, `fixVersions: [{id}]`), `keptFieldsAfterCreate`, snapshot. Source options for fix version from createmeta `fixVersions.allowedValues` (note: Jira version objects use `name`, while the typed `CreatemetaField.schema.allowedValues` says `{id, value}`; widen the type or read defensively) [ASSUMED: Jira DC createmeta shape for fixVersions].
**Edit mode:** `EditInitialValues` has no labels or fixVersions, so sending them from Edit would clobber existing values. Recommend: show the two controls in Create mode only, or hide them in Edit until initial values are plumbed. See Open Question 1.
**Warning signs:** A required `labels` createmeta field renders as a text input and submits a string.

### Pitfall 2: Restored staged images have no preview
**What goes wrong:** Image previews in the editor are registered by filename via `editor.storage.wikiHost.setPreview(name, url)` at stage time (`upload-plugin.ts:162`). After resume the description contains the `!name!` embed but no preview is registered, so the embed shows broken or empty.
**How to avoid:** `WikiEditorHandle` has no preview setter. Add one (`setLocalPreview(name, url)` on the handle, delegating to `setLocalPreview` in `host.ts`) and call it for each restored image. For images, `URL.createObjectURL` is acceptable in `<img>`; the data:-URI rule from project memory is for PDF `iframe/embed`. Use data: URIs for any non-image preview path.
**Warning signs:** Restored draft shows file chip but embed placeholder.

### Pitfall 3: Staged-file names must stay stable
The editor renames staged files to unique names (`stagedFileName`) and embeds that name in the description. The stored copy name and the `File.name` rebuilt on resume must equal that name exactly, or upload will not match the description reference. Store files as `<draftId>/<renamedName>` with the name sanitised for path only if needed (reject `..`; the fs scope blocks parent traversal).

### Pitfall 4: Source is a `File`, not a path
Staged items come from paste/drop/file-input as in-memory `File` objects, so `copyFile` is not applicable. Use `writeFile(path, new Uint8Array(await file.arrayBuffer()), {baseDir: AppData})`. Large files double memory briefly; acceptable. Also `dragDropEnabled: false` in `tauri.conf.json` means HTML5 drop reaches the editor (already working).

### Pitfall 5: Fs permission scope
`fs:default` alone does not allow writes into `$APPDATA`. Add `fs:allow-appdata-write-recursive` and `fs:allow-appdata-read-recursive` (or scoped `fs:allow-write-file`/`fs:allow-read-file`/`fs:allow-remove`/`fs:allow-exists`/`fs:allow-mkdir` with `$APPDATA/issue-drafts/**`). `/*` is not recursive; use `/**`. `..` is rejected [CITED: v2.tauri.app/plugin/file-system]. Prefer scoping to the `issue-drafts` subtree. Cannot be unit tested; needs a `tauri dev` smoke check.

### Pitfall 6: Autosave writes the whole JSON on every flush
`createTauriStorage.setItem` does `store.set` + `store.save()` of the entire persisted blob. Debounce at 500ms (already the repo constant) and only write when the snapshot changed (compare serialised snapshot). Epic and issue autosave share the store so a single draft's writes rewrite all drafts; fine at expected counts.

### Pitfall 7: Hydration race on resume and on first write
Never write before `persist.hasHydrated()` (copy the guard). A resume triggered before hydration must wait; the chip must not flash empty then populated (render nothing until hydrated).

### Pitfall 8: Create-another needs the new issue key
`useIssueMutations` `createMutation.onSuccess` calls `onSuccess()` with no argument and `mutationFn` returns `newIssue` (has `key`). Change the callback to `onSuccess(result?: {key: string})` (or read from mutation data). The existing partial-failure path (`hasCreatedWithError`, staged upload failed) keeps the modal open with a disabled submit; with Create another ticked, treat it the same way (do not reset), and still remove the draft (the issue exists) but keep copies only until the error is dismissed is unnecessary: the failed files are already reported by name and `setStagedFiles([])` is existing behaviour. Decide: on upload failure remove the draft (issue was created) and clear files.

### Pitfall 9: Draft must survive a failed create
Create error keeps the form and the draft (UI-SPEC copy: "Your draft is kept"). Only `onSuccess` removes the draft. Flush the draft in `onError` (the Phase 100 code already calls `draft.flush()` there for edit).

### Pitfall 10: Stale checks must not block or be ordered after the user types
Run validation once at resume, against createmeta for the draft's issue type (may differ from default type; the modal's `useCreateEditQueries` derives createmeta from `state.selectedIssueType`, so hydrate type first, then validate when createmeta resolves). Epic/parent existence needs a lookup (`['parent-fields', key]` already fetches parent fields; a 404 is the signal). Notes persist until the field is edited or the modal closes (UI-SPEC). Prior memory: invalidating or reading a stale upstream is a no-op, so do the check against the server result, not cached parent state.

### Pitfall 11: Custom overlays and focus
Dialog is Base UI and already portals; the chip popover is a normal Base UI popover. No custom fixed overlay is needed, so the `isolate`/`z-20` gotcha does not apply. Dialog `z-50`; popover `z-50`; opening resume from the popover must close the popover first (focus return goes to `body`).

### Pitfall 12: Tests that will change
`CreateEditIssueModal.drafts.test.tsx`, `.attachments.test.tsx`, `.epic-story.test.tsx` assert the Phase 100 labels (`Create`/`Save`, tooltips). UI-SPEC renames them to `Create Issue` / `Save Changes` and the title to `Create issue` / `Edit {KEY}` (currently "Create Issue" / "Edit Issue"), so update those tests. The drafts test header says "Create mode must never read or write a description draft (Phase 101 owns create drafts)": keep that invariant for `drafts.store`; create drafts go to the new store.

### Pitfall 13: React Compiler vs vitest (project memory)
The app uses React Compiler, vitest does not. Avoid hidden module-level reads in render for draft/chip state; read through hooks/selectors. Use `useIssueDraftsStore((s) => s.drafts)` and derive sorted arrays in `useMemo`/selectors with stable output (a selector returning a fresh sorted array each call causes infinite re-render in zustand v5; use `useShallow` or select the record and sort in render).

### Pitfall 14: Epic draft path
`CreateEpicDialog` holds name/description/staged files in local state and resets on close success only; closing today discards. It needs: autosave (name, description, staged files), a draft id ref, hydrate on resume, and hoisting so a chip click on a non-Epics page can open it. Phase 102 restyles it, so keep changes minimal and behind the shared hook/store. Its Dialog uses `z-40/z-50` and `max-w-md`; do not restyle here.

## Code Examples

### Content gate (D-12)
```typescript
// Pure; unit-test exhaustively
export function hasUserContent(s: FormState, stagedCount: number): boolean {
  return (
    s.summary.trim() !== '' ||
    s.description.trim() !== '' ||
    stagedCount > 0 ||
    s.linkRows.some((r) => r.linkTypeId && r.issueKey)  // "filled link row"
  );
}
```

### Staging a copy (DRAFT-05)
```typescript
// Source: https://v2.tauri.app/plugin/file-system/
import { BaseDirectory, mkdir, remove, writeFile, readFile, exists } from '@tauri-apps/plugin-fs';

export async function stageCopy(draftId: string, file: File): Promise<string> {
  const dir = `issue-drafts/${draftId}`;
  await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
  const path = `${dir}/${file.name}`;
  await writeFile(path, new Uint8Array(await file.arrayBuffer()), { baseDir: BaseDirectory.AppData });
  return path;
}
export const removeDraftFiles = (draftId: string) =>
  remove(`issue-drafts/${draftId}`, { baseDir: BaseDirectory.AppData, recursive: true }).catch(() => {});
```

### Capability additions
```json
"fs:allow-appdata-read-recursive",
"fs:allow-appdata-write-recursive"
```
(Verify at implementation whether `remove` and `mkdir` also need explicit `fs:allow-remove` / `fs:allow-mkdir` entries with `{"path":"$APPDATA/issue-drafts/**"}`; docs do not state the mapping.)

### Debounced autosave (mirror of `useEditorDraft`)
```typescript
// schedule(snapshot) -> 500ms timer -> flush(); flush guarded by persist.hasHydrated();
// skip write when JSON.stringify(snapshot) equals the stored one; never console.log content.
```

### Create-another reset (kept fields)
```typescript
export function keptFieldsAfterCreate(s: FormState): Partial<FormState> {
  return {
    selectedIssueType: s.selectedIssueType, epicLinkKey: s.epicLinkKey, parentKey: s.parentKey,
    selectedAssignee: s.selectedAssignee, selectedAssigneeName: s.selectedAssigneeName,
    priority: s.priority, labels: s.labels, fixVersion: s.fixVersion,
    // context custom fields; summary/description/estimate/storyPoints/linkRows cleared
  };
}
```
Which custom fields are "context" is not defined; recommend keeping all `customFieldValues`/`customFieldInputValues` (they are required-field values like Account, which users repeat). Flag in Open Questions.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Phase 100 text-only drafts keyed by string | Structured uuid drafts | New store; do not reuse `setDraft` |
| Single 680px column, `max-h-[85vh]` scroll | Fixed `min(1080px,94vw) x 88vh`, two columns | Inner scrollers; `min-h-0` on flex children; container query on an inner wrapper, not the container itself (project memory) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tauri-apps/plugin-fs` is legitimate (slopcheck could not run) | Package Legitimacy | Low; official Tauri plugin; gate with human-verify checkpoint |
| A2 | Jira DC createmeta returns `fixVersions` with `allowedValues` of `{id, name}`, labels as `schema.type: array, items: string` with no allowedValues (autocomplete) | Pitfall 1 | Fix-version control may need a project versions endpoint instead; check against PROBE or a live response |
| A3 | `fs:allow-appdata-write-recursive` covers `mkdir`/`remove` | Pitfall 5 | Missing explicit permissions cause runtime "forbidden path"; verify by smoke test |
| A4 | Keeping all custom field values after "Create another" is the right "context fields" interpretation | Code Examples | UX; user may want only some |
| A5 | Labels/Fix version Create-mode only | Pitfall 1 | If user expects Edit support, more plumbing (initial values + editmeta + PUT) |
| A6 | Blob URLs for restored image previews inside `<img>` are fine on WKWebView (existing stage code already does this) | Pitfall 2 | Low |

## Open Questions

1. **Labels / Fix version in Edit mode.**
   - Known: `EditInitialValues` lacks both; Edit sends only changed fields for some, unconditional for story points.
   - Unclear: whether the user wants them editable in the Edit modal now.
   - Recommendation: Create-only now; hide in Edit. Ask the user at plan check if not already settled.
2. **Which custom fields are kept by Create another.** Recommend keep all required custom field values; clear none.
3. **Draft for Subtask type.** Draft stores `parentKey`; stale check clears parent if lookup 404s, and the type remains Subtask with an empty parent (submit blocked only by existing validation). Confirm acceptable.
4. **Orphaned file purge** at hydration: delete `$APPDATA/issue-drafts/<id>` dirs with no matching draft. Recommended; needs `readDir` permission (`fs:allow-appdata-read-recursive` covers it).
5. **Relative time format** "edited 5m ago" vs existing `relativeTime()` output ("5 minutes ago"). Add a compact helper or accept the long form.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm + vitest | tests | yes (repo) | vitest ^4.0.18 | — |
| Rust toolchain | fs plugin registration | yes | rustc 1.95.0 (>= 1.90 required) | — |
| `@tauri-apps/plugin-fs` | DRAFT-05 | not installed | 2.7.1 on npm | custom Rust command |
| `tauri-plugin-fs` crate | DRAFT-05 | in Cargo.lock transitively, not a direct dep | 2.x | — |
| slopcheck | package audit | no (`pip` not found) | — | human-verify checkpoint |
| Live Jira | stale-check and create verification | n/a for unit tests | — | mock `@/services/jira` as existing tests do |

**Missing dependencies with no fallback:** none blocking.
**Missing with fallback:** slopcheck (checkpoint), fs plugin (install task).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 + @testing-library/react, jsdom |
| Config file | `taskflow/vitest.config.ts` (setup `src/test/setup.ts`, in-memory `@tauri-apps/plugin-store` mock) |
| Quick run command | `cd taskflow && npx vitest run src/stores/issue-drafts.store.test.ts` (or the specific file) |
| Full suite command | `cd taskflow && npm test` (pre-commit hook also runs the full suite; combine RED+GREEN per commit) |
| Static checks | `cd taskflow && npm run check` (biome + tsc) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Dialog renders summary, editor, links, sidebar fields, sticky footer; no subtasks section | component | `npx vitest run src/routes/dashboard/create-edit-issue/CreateEditIssueModal.layout.test.tsx` | Wave 0 |
| UI-01 | Button/title copy `Create Issue` / `Save Changes` / `Create issue` / `Edit KEY` | component (update existing) | `npx vitest run src/routes/dashboard/create-edit-issue/` | existing, must update |
| UI-02 | Create another unticked on each open; ticked keeps modal open, resets per kept-field list, shows `✓ Created KEY · Open`, refocuses Summary | component | `npx vitest run ...CreateEditIssueModal.createAnother.test.tsx` | Wave 0 |
| UI-02 | `keptFieldsAfterCreate` pure | unit | `npx vitest run src/lib/issue-draft-snapshot.test.ts` | Wave 0 |
| DRAFT-01 | Close (X/backdrop/Cancel/Esc) with content stores a draft, no prompt; no content stores none (type/assignee/priority only) | component + unit (`hasUserContent`) | `npx vitest run ...CreateEditIssueModal.issueDrafts.test.tsx` | Wave 0 |
| DRAFT-01 | Epic dialog autosaves with kind epic | component | `npx vitest run src/routes/dashboard/CreateEpicDialog.test.tsx` | existing, extend |
| DRAFT-02 | Two opens produce two independent drafts; opening with drafts gives blank form | store/component | `npx vitest run src/stores/issue-drafts.store.test.ts` | Wave 0 |
| DRAFT-03 | Chip hidden at 0, shows count, popover newest-first, row content, Untitled italic | component | `npx vitest run src/components/app/DraftsChip.test.tsx` | Wave 0 |
| DRAFT-04 | Resume restores every field; stale epic/file/custom field cleared with note; never blocks | component + pure `validateSnapshot` | `npx vitest run src/lib/issue-draft-snapshot.test.ts` | Wave 0 |
| DRAFT-05 | Stage writes via file service (mocked), resume reads copies back as `File`, create uploads them, missing copy shows note | unit with `vi.mock('@/lib/issue-draft-files')` | `npx vitest run src/lib/issue-draft-files.test.ts` | Wave 0 |
| DRAFT-06 | Persisted draft rehydrates (re-import store with same in-memory backing) | store | `npx vitest run src/stores/issue-drafts.store.test.ts` | Wave 0 |
| DRAFT-07 | Discard removes draft and copies; Undo within 5s restores; create success removes draft; owner change clears | store + component | `npx vitest run src/components/app/DraftsChip.test.tsx` | Wave 0 |

Native fs scope, real restart persistence and file bytes round-trip are manual-only (cannot run in jsdom): one `tauri dev` smoke checklist (stage a file, quit, relaunch, resume, create, confirm upload and that `$APPDATA/issue-drafts/<id>` is gone).

### Sampling Rate
- **Per task commit:** the touched test file(s) via `npx vitest run <file>`
- **Per wave merge:** `npm test` and `npm run check`
- **Phase gate:** full suite green plus the manual restart smoke before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/stores/issue-drafts.store.test.ts`
- [ ] `src/lib/issue-draft-snapshot.test.ts` (content gate, kept fields, validate)
- [ ] `src/lib/issue-draft-files.test.ts` (mock `@tauri-apps/plugin-fs`; add a global mock to `src/test/setup.ts` or per-file)
- [ ] `src/components/app/DraftsChip.test.tsx`
- [ ] Modal layout / createAnother / issueDrafts component tests
- [ ] Update existing three modal test files for renamed copy
- [ ] Framework install: none (vitest present)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3 Authentication, Session | no | unchanged (PAT via stronghold) |
| V4 Access Control | yes (local) | Drafts bound to account `owner`; cleared on account change (100 D-21) |
| V5 Input Validation | yes | Sanitise staged file names used as path segments (no `..`, no separators); the fs plugin also rejects parent traversal; keep fs scope to `$APPDATA/issue-drafts/**` |
| V6 Cryptography | no | Draft content and files are stored unencrypted in app data, same as Phase 100 drafts; note as accepted |
| V8 Data Protection | yes | Never log draft content; purge copies on discard/create/account change; no customer data in fixtures |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via filename | Tampering | Use only the draft uuid + sanitised basename; plugin scope with `/**` under one subtree |
| Draft from account A uploaded under account B | Information disclosure | `reconcileOwner` clears drafts and files on owner change; reconcile before showing the chip |
| Leaked staged files after crash | Information disclosure | Orphan purge at hydration |
| Content in logs | Information disclosure | No `console.*` of snapshot; existing `console.error` calls in `useIssueMutations` log errors only |

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists at the repo root or in `taskflow/`. Constraints come from project memory and are treated as locked conventions:
- Repo root `taskflow/` holds `.planning` and git; `src`, npm, vitest, biome are in `taskflow/taskflow/`.
- Custom fixed overlays inside `isolate` `<main>` portal to body (not needed here; Dialog/Popover already portal).
- No toast library; inline muted feedback.
- Pre-commit runs the full vitest suite and biome; combine RED/GREEN per commit; do not run `biome --write` across all of `src`; no bulk find-replace of identifiers that appear in labels.
- Credential save calls `queryClient.clear()` plus `credentialsRevision`; drafts reconcile via `reconcileOwner` (`ConnectionsSection.tsx:535`, `useDraftsAccountGuard`).
- Shared components: `PersonPicker`, `SearchableSelect`, `EpicPicker`, `PageHeader`; Base UI `Select` needs Root `items` for labels; italic text under `truncate` needs `pr-0.5`; Tailwind `@container` variants never style the container itself (inner wrapper); one row = one line.
- Wizard version bump rule applies only to onboarding changes (not this phase).
- Never write customer data in fixtures or `.planning`.
- Release notes are not part of this phase.

## Sources

### Primary (HIGH confidence)
- Codebase reads: `CreateEditIssueModal.tsx`, `useCreateEditForm.ts`, `useIssueMutations.ts`, `useCreateEditQueries.ts`, `CustomFieldsSection.tsx`, `CreateEpicDialog.tsx`, `StagedFilesStrip.tsx`, `drafts.store.ts`, `useEditorDraft.ts`, `useDraftsAccountGuard.ts`, `tauri-storage.ts`, `TopBar.tsx`, `RecentItemsPopover.tsx`, `main.tsx` (create-modal state), `services/jira.ts` (`createIssue`, `wrapCustomFieldValue`), `wiki-editor/host.ts`, `upload-plugin.ts`, `capabilities/default.json`, `Cargo.toml`, `tauri.conf.json`, `package.json`
- https://v2.tauri.app/plugin/file-system/ (setup, permissions, scopes, JS API)

### Secondary (MEDIUM)
- `npm view @tauri-apps/plugin-fs` (version 2.7.1, repository, maintainers)

### Tertiary (LOW)
- Jira DC createmeta shape for `fixVersions`/`labels` (training knowledge; A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (all reuse, one official plugin)
- Architecture: HIGH (derived from existing code and Phase 100 patterns)
- Pitfalls: MEDIUM-HIGH (labels/fix version gap and preview gap are verified by code reading; fs permission mapping unverified)

**Research date:** 2026-11-17
**Valid until:** 2026-12-17
