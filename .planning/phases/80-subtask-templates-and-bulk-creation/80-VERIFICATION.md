---
phase: 80-subtask-templates-and-bulk-creation
verified: 2026-06-05T12:22:00Z
status: human_needed
score: 5/5
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "CR-01: progressFailures now maps (s, i) before .filter(), preserving original rows index — partial-failure detail names the correct subtask"
    - "CR-02: applyTemplate no longer resolves rows synchronously; a useEffect keyed on selectedTemplateId|effectiveTypeId resolves from template.rows once creatmetaFields is defined, guarded by lastResolvedKeyRef — custom fields survive first template application"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open Settings > Subtask Templates; create 2 templates with different names and rows; quit the app completely and reopen; navigate back to Settings > Subtask Templates"
    expected: "Both templates appear with their original names, row counts, and field values unchanged"
    why_human: "Tauri Store file I/O requires a running app; cannot be verified by test runner"
  - test: "Open a parent issue with an assignee and priority set; click 'Bulk Create Subtasks'; select a template that has @inherit, @current, and @unassigned assignee rows"
    expected: "@inherit row shows blue chip '@inherit -> {Parent Assignee Name}'; @current row shows violet chip '@current -> {Your Display Name}'; @unassigned shows muted chip '@unassigned'"
    why_human: "Visual chip colors and live auth-store context require a running app; no rendering test exists for this component"
  - test: "Apply a template on a parent issue; reorder the rows; click 'Create Subtasks'; observe progress"
    expected: "Progress indicator shows 'Creating N subtasks...' per row; rows complete in the displayed (reordered) order; on full success modal closes; parent subtask list in issue detail refreshes showing the new subtasks"
    why_human: "Live Jira DC API; cache invalidation requires live React Query; creation order observable only in Jira"
  - test: "Force a failure on one middle row (e.g. configure a required custom field that is missing); create; observe failure state; click 'Retry Failed'"
    expected: "Modal stays open; the failed row shows a red icon and error message naming THAT row's title specifically; already-created rows show green icons; retry re-attempts only the failed row and does not duplicate the succeeded ones"
    why_human: "Requires live Jira DC to produce an actual create error; verifies CR-01 fix in a real partial-failure scenario"
---

# Phase 80: Subtask Templates and Bulk Creation — Verification Report

**Phase Goal:** Users can create and manage named subtask templates in Settings; from a parent issue they can apply a template, preview and edit the resolved subtask list, then create all subtasks at once with per-row progress and partial-failure recovery.
**Verified:** 2026-06-05T12:22:00Z
**Status:** HUMAN_NEEDED
**Re-verification:** Yes — after gap closure (commit 768699bd)

---

## Step 0: Previous Verification

Previous VERIFICATION.md found. Re-verification mode.

- Previous status: `gaps_found` (3/5)
- Gaps closed: CR-01, CR-02 (see frontmatter)
- Gaps remaining: none

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Settings has a "Subtask Templates" section where users can create/rename/reorder/delete named templates; templates persist across app restarts | VERIFIED | SubtaskTemplatesSection and store fully implemented. CR-02 resolved: custom fields now survive first template application via `useEffect` keyed on `${selectedTemplateId}\|${effectiveTypeId}`, guarded by `lastResolvedKeyRef`. `template.rows` (not already-resolved rows) is the resolution source. |
| 2 | From a parent issue, user can apply a template or build ad-hoc; placeholders (@inherit/@current/@unassigned) resolve at creation time | VERIFIED | BulkCreateSubtasksModal wired in IssueDetailContent.tsx. CR-02 fix ensures `effectiveTypeId` is set and `creatmetaFields` is available before resolution fires. `resolveRowForCreate` handles all three placeholders. |
| 3 | Preview resolved list, inline-edit any field per row, reorder before creating | VERIFIED | SubtaskTemplateRow mode="preview" with full inline field editing. dnd-kit SortableContext + DragOverlay for reorder. Rows editable until `creating=true`. |
| 4 | "Create All" submits sequentially in order; per-row progress pending->creating->created/failed; on full success modal closes and parent subtask list refreshes | VERIFIED | `createAllRows` sequential for-loop (no Promise.all) confirmed in code + 10 passing tests. Three cache invalidations wired: `invalidateGhAllData` + `jira-issue-detail` + `jira-subtask-enrichment`. |
| 5 | On partial failure modal stays open with per-row errors; "Retry failed" re-runs only failed items; already-created subtasks never duplicated on retry | VERIFIED | CR-01 resolved: `progressFailures` at lines 472-478 now maps `(s, i)` before `.filter()`, then maps `({ s, i })` after — original index preserved. `rows[i]` names the correct row. Retry-no-duplicate guard (`status === 'created' continue`) unchanged and tested. |

**Score: 5/5 truths verified**

---

### CR-01 Fix Confirmation

Previous finding: `.filter(failed).map((s, i) => rows[i])` — post-filter index `i` pointed at wrong row.

Fixed code (lines 472-478):
```typescript
const progressFailures = rowStates
  .map((s, i) => ({ s, i }))           // capture original index first
  .filter(({ s }) => s.status === 'failed')
  .map(({ s, i }) => ({
    key: rows[i]?.title ?? `Row ${i + 1}`,
    error: s.error ?? 'Unknown error',
  }));
```

Original index `i` is captured before `.filter()`. For a run where rows 0 and 1 succeed and row 2 fails, the single failure entry has `i = 2` (original), so `rows[2]` (the actual failed row) is reported. Fix confirmed in code.

---

### CR-02 Fix Confirmation

Previous finding: `applyTemplate` called `resolveTemplateFields(template.rows, creatmetaFields ?? [])` synchronously at user interaction; `creatmetaFields` undefined on first selection; no re-resolution useEffect.

Fixed code structure:

`applyTemplate` (lines 283-305) now only sets the subtask type — it no longer calls `resolveTemplateFields` at all.

`useEffect` (lines 314-337) keyed on `[selectedTemplateId, effectiveTypeId, creatmetaFields, templates, storyPointsFieldKey]`:
- Guards on `creatmetaFields !== undefined` (waits for query)
- Guards on `lastResolvedKeyRef.current !== resolveKey` (runs once per `${selectedTemplateId}|${effectiveTypeId}`)
- Reads from `template.rows` (stored template, not already-resolved rows — preserves user edits)

On first template selection: `applyTemplate` sets `effectiveTypeId`, the createmeta query fires, when it resolves `creatmetaFields` is defined, the effect fires once and resolves fields correctly. Fix confirmed in code.

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| SUBTPL-01 | 03 | Create/edit/delete named templates in Settings | VERIFIED | SubtaskTemplatesSection fully implemented; CR-02 resolved — custom fields no longer dropped on first apply |
| SUBTPL-02 | 01 | Templates persist across sessions (Tauri Store) | VERIFIED | `createTauriStorage('subtask-templates.json')` with version/migrate guard. Store tests pass. |
| SUBTPL-03 | 01,02,03 | Template line: required title + createmeta-derived optional fields | VERIFIED | `resolveTemplateFields` drops unsupported fields. CR-02 fix ensures resolution runs against loaded creatmeta, not empty array. |
| SUBTPL-04 | 04 | From parent issue, apply template or ad-hoc to bulk-create | VERIFIED | BulkCreateSubtasksModal wired into IssueDetailContent. Template selector + ad-hoc mode both present. |
| SUBTPL-05 | 02,04 | Preview and inline-edit the resolved list before creating | VERIFIED | SubtaskTemplateRow mode="preview" editable until creating=true. Placeholder chips show resolved hints. |
| SUBTPL-06 | 04 | Creating spawns subtasks under parent in listed order | VERIFIED | Sequential for-loop confirmed. Tests assert call order 0,1,2. |
| SUBTPL-07 | 04 | Partial failure surfaced per-subtask; retry skips already-created | VERIFIED | CR-01 resolved: per-subtask failure labels now identify the correct row title. Retry guard (`status === 'created' continue`) correct and tested. |
| SUBTPL-08 | 01,04 | Placeholders @inherit/@current/@unassigned resolve at creation time | VERIFIED | `resolveRowForCreate` handles all three. 14 passing unit tests. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/stores/subtask-templates.store.ts` | Persistent store | VERIFIED | `createTauriStorage('subtask-templates.json')`. version/migrate with corruption guard. All 5 actions present. |
| `taskflow/src/routes/dashboard/resolveTemplateFields.ts` | Pure field-drop computation | VERIFIED | 67 lines. No React/Zustand imports. ALWAYS_ALLOWED set correct. |
| `taskflow/src/routes/dashboard/resolveRowPlaceholders.ts` | Pure placeholder resolver | VERIFIED | 99 lines. All three sentinels handled. |
| `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx` | Shared row component | VERIFIED | mode='settings'\|'preview'. Three chip color classes. Advanced expand with creatmetaFields iteration. |
| `taskflow/src/routes/settings/SubtaskTemplatesSection.tsx` | Settings UI for template CRUD | VERIFIED | data-testid="section-subtask-templates". All store actions wired. |
| `taskflow/src/routes/settings/Settings.tsx` | Section registration | VERIFIED | 'subtask-templates' in type union, SECTIONS array, import, and render block. |
| `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx` | Bulk create modal | VERIFIED | 666 lines. CR-01 and CR-02 fixed. Sequential for-loop, no Promise.all. Three invalidations present. |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` | Bulk Create entry point | VERIFIED | BulkCreateSubtasksModal imported and mounted with `parentKey={issueKey} parentIssue={issue}`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| subtask-templates.store.ts | tauri-storage.ts | `createTauriStorage('subtask-templates.json')` | WIRED | Pattern present |
| resolveRowPlaceholders.ts | JiraIssueDetail.fields | parentIssue.fields reads | WIRED | Lines 42, 77, 85, 93 |
| SubtaskTemplateRow.tsx | resolveAssignee | chip display hint | WIRED | Import and usage confirmed |
| SubtaskTemplatesSection.tsx | useSubtaskTemplatesStore | add/remove/rename/move/update | WIRED | All 5 actions wired |
| Settings.tsx | SubtaskTemplatesSection | conditional render on activeSection | WIRED | Confirmed |
| BulkCreateSubtasksModal.tsx | createIssue | sequential for-loop per row | WIRED | `createAllRows` loop confirmed |
| BulkCreateSubtasksModal.tsx | invalidateGhAllData + jira-issue-detail + jira-subtask-enrichment | after any creation success | WIRED | Lines 453-456 |
| IssueDetailContent.tsx | BulkCreateSubtasksModal | modal mount | WIRED | Confirmed |
| BulkCreateSubtasksModal.tsx | useEffect resolution | `[selectedTemplateId, effectiveTypeId, creatmetaFields, ...]` | WIRED | CR-02 fix — lines 314-337 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SubtaskTemplatesSection.tsx | templates | useSubtaskTemplatesStore (Tauri persisted JSON) | Yes — Zustand store backed by real file | FLOWING |
| BulkCreateSubtasksModal.tsx | creatmetaFields | useQuery(['createmeta', ...]) → fetchCreatemeta | Yes — live Jira API call | FLOWING |
| BulkCreateSubtasksModal.tsx | resolvedRows at create time | resolveRowForCreate(row, {jiraUsername, parentIssue}) | Yes — reads live auth store + parentIssue prop | FLOWING |
| BulkCreateSubtasksModal.tsx | progressFailures | .map((s,i) => ({s,i})).filter(failed).map(({s,i}) => rows[i]) | Yes — original index preserved before filter | FLOWING |
| BulkCreateSubtasksModal.tsx | rows after template apply | useEffect on creatmetaFields → resolveTemplateFields(template.rows, creatmetaFields) | Yes — deferred until creatmetaFields defined | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| createAllRows sequential ordering | `npx vitest run BulkCreateSubtasksModal.test.ts` | 10 passed, 0 failed | PASS |
| retry-no-duplicate guard | Same test run | 3 retry tests passing | PASS |
| Store persistence (in-memory) | `npx vitest run subtask-templates.store.test.ts` | 13 passing | PASS (from initial verification) |
| Placeholder resolution | `npx vitest run resolveRowPlaceholders.test.ts` | 14 passing | PASS (from initial verification) |
| resolveTemplateFields field-drop | `npx vitest run resolveTemplateFields.test.ts` | 9 passing | PASS (from initial verification) |
| Type-check + biome | `npm run check` | 0 errors, 0 warnings | PASS |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| BulkProgressIndicator.tsx | 102 | `key={f.key}` uses subtask title as React key | WARNING | Duplicate titles cause React to merge/drop list items in failure panel. WR-02. Not a blocker. |
| resolveRowPlaceholders.ts | 34-39 | @current silently degrades to unassigned when jiraUsername is null | WARNING | User requested "current user" gets unassigned with no warning. WR-03. Not a blocker. |

Previous blockers CR-01 and CR-02 are resolved. No `TBD`, `FIXME`, or `XXX` debt markers found in phase files.

---

### Human Verification Required

#### 1. Template Persistence Across Restart

**Test:** Open Settings > Subtask Templates; create 2 templates with different names and rows; quit the app completely and reopen; navigate back to Settings > Subtask Templates.
**Expected:** Both templates appear with their original names, row counts, and field values unchanged.
**Why human:** Tauri Store file I/O requires a running app; cannot be verified by test runner.

#### 2. Placeholder Chip Rendering in Modal

**Test:** Open a parent issue with an assignee and priority set; click "Bulk Create Subtasks"; select a template that has @inherit, @current, and @unassigned assignee rows.
**Expected:** @inherit row shows blue chip "@inherit -> {Parent Assignee Name}"; @current row shows violet chip "@current -> {Your Display Name}"; @unassigned shows muted chip "@unassigned".
**Why human:** Visual chip colors and live auth-store context require a running app; no rendering test exists for this component.

#### 3. End-to-End Bulk Creation (Full Success Path)

**Test:** Apply a template on a parent issue; reorder the rows; click "Create Subtasks"; observe progress.
**Expected:** Progress indicator shows "Creating N subtasks..." per row; rows complete in the displayed (reordered) order; on full success modal closes; parent subtask list in issue detail refreshes showing the new subtasks.
**Why human:** Live Jira DC API; cache invalidation requires live React Query; creation order observable only in Jira.

#### 4. Partial Failure and Retry

**Test:** Force a failure on one middle row (e.g., configure a required custom field that is missing on rows 0 and 1 passing, row 2 failing); create; observe failure state; click "Retry Failed".
**Expected:** Modal stays open; the failed row shows a red icon and error message naming THAT row's title specifically (not row 0); already-created rows show green icons; retry re-attempts only the failed row and does not duplicate the succeeded ones.
**Why human:** Requires live Jira DC to produce an actual create error; CR-01 fix cannot be fully validated without a live partial-failure scenario.

---

## Gaps Summary

No automated gaps remain. Both blockers identified in the initial verification have been resolved in commit 768699bd.

The two non-critical warnings carried forward (WR-02: React key collision in failure list; WR-03: silent @current degradation) do not block the phase goal. Four items require live-app human verification before the phase can be fully signed off.

---

_Verified: 2026-06-05T12:22:00Z_
_Verifier: Claude (gsd-verifier)_
