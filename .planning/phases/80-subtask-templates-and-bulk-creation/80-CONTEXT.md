# Phase 80: Subtask Templates and Bulk Creation - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can define named subtask templates in Settings (create, rename, reorder, delete; each template carries a list of subtask rows with a required title plus optional createmeta-derived fields). From a parent issue's detail page, a "Bulk Create Subtasks" modal lets them apply a template or build an ad-hoc list, preview and inline-edit the resolved rows, reorder them, and create all subtasks sequentially with per-row progress and partial-failure retry.

Scope is fixed by ROADMAP.md Phase 80 (SUBTPL-01 … SUBTPL-08). This phase clarifies HOW to implement that — it does not add new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Template Scope & Portability
- **D-01:** Templates are **global** — a single shared list backed by one `createTauriStorage('subtask-templates.json')` store (mirrors `tempo-filters.store.ts` exactly). Not keyed per project.
- **D-02:** Field resolution happens **at apply time** against the *current active project's* subtask createmeta. Fields/values the target project doesn't support are **silently dropped**, with a small unobtrusive badge in the preview noting "N fields skipped" so the user is aware without being blocked.
- **D-03:** Dropping (not blocking) is the chosen behavior even for fields the project marks required — a missing-but-required field surfaces only through normal create-time validation/error handling, never as a hard block before preview.

### Subtask Issue Type Selection
- **D-04:** Each **template** stores its chosen subtask issue type. That type's createmeta determines which fields are editable for the template's rows.
- **D-05:** In the bulk modal, the subtask type defaults to the template's stored type; for an **ad-hoc** list (no template) it defaults to the project's first subtask type from `subtaskIssueTypes()`. Use the `issuetype.subtask === true` flag to identify subtask types — never name comparison (admins rename types; see `jira.ts:159`).
- **D-06:** Subtask type is chosen per-template, **not per-row** — all rows in a single bulk-create run share one subtask issue type (coherent field set, simpler preview table).

### Field Depth in Editors
- **D-07:** Both the Settings template editor and the bulk-modal preview use a **curated core inline + Advanced expand** layout per row.
  - **Inline core:** title (required), assignee, priority, labels, due date, original estimate, story points.
  - **Behind a per-row "Advanced" expand/collapse:** components and custom fields.
- **D-08:** The full optional field set from SUBTPL-03 must be reachable — the Advanced expand is how the long tail is supported without making rows unscannable.

### Placeholder & Inheritance Semantics
- **D-09:** Three placeholders, resolved **at creation time** (SUBTPL-08):
  - `@inherit` → copies **assignee, priority, labels, components, and due date** from the parent issue.
  - `@current` → the currently logged-in user (as assignee).
  - `@unassigned` → explicitly cleared assignee.
- **D-10:** New ad-hoc rows default their assignee to `@inherit`.
- **D-11:** Placeholders render as **colored chips** in the preview. To satisfy SUBTPL-05 (preview & edit the *resolved* list) without violating SUBTPL-08 (resolve at create), each chip shows a **resolved-value hint** computed from the parent (e.g. `@inherit → Alice`). The user can override a chip with a concrete value inline; if untouched, the authoritative resolution is recomputed against the parent at Create time.
- **D-12:** When `@inherit` references a field the parent has no value for (e.g. no due date), that field resolves to empty — no error.

### Claude's Discretion
- Exact chip colors/styling, the precise "N fields skipped" badge copy, and the ad-hoc empty-state (e.g. start with one blank row vs an explicit "Add row" affordance) are left to planning/UI within the patterns below.
- Whether the Settings editor reuses the same row component as the bulk-modal preview (recommended for consistency) is an implementation detail for the planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §"Phase 80: Subtask Templates and Bulk Creation" — goal, success criteria, and the locked implementation notes (store pattern, sequential loop, parentKey wiring, query invalidation).
- `.planning/REQUIREMENTS.md` — SUBTPL-01 … SUBTPL-08.

### Persistence pattern (MUST mirror)
- `taskflow/src/stores/tempo-filters.store.ts` — exact store shape/pattern to mirror (zustand + persist, add/remove/rename/move actions).
- `taskflow/src/lib/tauri-storage.ts` — `createTauriStorage(fileName)` adapter (LazyStore-backed). New store uses `createTauriStorage('subtask-templates.json')`.

### Settings integration
- `taskflow/src/routes/settings/Settings.tsx` — `SECTIONS` array + conditional render pattern for adding a new "Subtask Templates" section.
- `taskflow/src/routes/settings/WorkflowSection.tsx` (or any sibling `*Section.tsx`) — representative section component to mirror.

### Issue detail integration
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — subtask list rendering (`subtaskListContent()`, ~L75–132) and the existing "Add subtask" action button (~L323–330). The "Bulk Create Subtasks" entry point lives here; `parentKey` comes from this component's local state (per roadmap note), NOT AppLayout.

### Jira API + createmeta
- `taskflow/src/services/jira.ts` — `createIssue()` (~L1605, pass `{ parent: { key }, issueTypeId }`), `fetchCreatemeta()` (~L1706), `fetchEnrichedSubtasks()` (~L1308), and the `issuetype.subtask` flag note (L159).
- `taskflow/src/services/jira/fields.ts` — createmeta field typing/normalization.
- `taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts` — createmeta fetch hook + query key `['createmeta-issuetypes', projectKey]`.
- `taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx` — how createmeta fields are rendered (reuse for the Advanced expand and per-row field editors).

### Modal + bulk UI patterns
- `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` — `@base-ui/react/dialog` modal structure + `activeJiraProject` → `projectKey` sourcing (L50).
- `taskflow/src/components/ui/dialog.tsx` — Dialog primitive.
- `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx` — per-row progress / failure-list pattern to adapt for pending → creating → created/failed and "Retry failed".

### Cache invalidation (on any creation success)
- `['gh-all-data', boardId]` — `taskflow/src/services/jira/greenhopper/useGhAllData.ts`
- `['jira-issue-detail', parentKey, jiraBaseUrl]` — used in `IssueDetailView.tsx` / `IssueDetailContent.tsx`
- `['jira-subtask-enrichment', parentKey, jiraBaseUrl, subtaskSignature]` — `IssueDetailView.tsx` (~L153)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tempo-filters.store.ts` + `createTauriStorage`**: direct template for the persistent template store — copy the structure, swap the entity type and filename.
- **`BulkProgressIndicator.tsx`**: already tracks `{ total, completed, succeeded, failed, failures[] }` and auto-dismiss/expand-on-error — adapt for the per-row sequential creation status.
- **`CreateEditIssueModal` + `CustomFieldsSection` + `useCreateEditQueries`**: existing createmeta-driven field discovery/rendering pipeline — reuse for both the template editor rows and the bulk preview rows (curated core + Advanced custom fields).
- **`createIssue()`**: the subtask creation call (`parent` + `issueTypeId`).

### Established Patterns
- **Single active project**: `activeJiraProject` drives `projectKey` (CreateEditIssueModal L50). Templates are global but always resolve against the *current* active project's subtask createmeta.
- **Subtask type identification**: use `issuetype.subtask === true`, never name matching (jira.ts L159); a project may expose several via `subtaskIssueTypes()`.
- **Modals**: `@base-ui/react/dialog` (not Shadcn) — Root/Portal/Backdrop/Popup structure.
- **Sequential creation**: a `for` loop (not `Promise.all`) preserves order and makes per-item status trackable (roadmap note).

### Integration Points
- New Settings section registered in `Settings.tsx` `SECTIONS`.
- `BulkCreateSubtasksModal` mounted from `IssueDetailContent`, receiving `parentKey` from that component's local state.
- On creation success: invalidate the three query keys above so the parent's subtask list refreshes.

</code_context>

<specifics>
## Specific Ideas

- Placeholder chips with resolved-value hints (`@inherit → Alice`) in the preview — see D-11.
- "N fields skipped" badge when a global template's fields don't fit the current project's subtask createmeta — see D-02.
- "Retry failed" re-runs only failed rows; already-created subtasks are never re-created (SUBTPL-07) — track per-row created/failed state so retry skips `created`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Per-row subtask-type selection and project-scoped template storage were explicitly considered and rejected; see D-06 and D-01.)

</deferred>

---

*Phase: 80-Subtask Templates and Bulk Creation*
*Context gathered: 2026-06-05*
