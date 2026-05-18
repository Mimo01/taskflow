---
phase: 260518-wmy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/aio/client.ts
  - taskflow/src/services/aio/projects.ts
  - taskflow/src/services/aio/cycles.ts
  - taskflow/src/services/aio/issue-runs.ts
  - taskflow/src/services/aio/issue-steps.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/attachments.ts
  - taskflow/src/services/jira/users.ts
  - taskflow/src/services/jira/worklogs.ts
  - taskflow/src/routes/dashboard/widgets/CustomJqlWidget.tsx
autonomous: false
requirements:
  - WMY-01
  - WMY-02
  - WMY-03

must_haves:
  truths:
    - "Every apiFetch call site passes an operation label (4th argument) — zero ungrouped requests"
    - "aioFetch forwards an operation label to apiFetch so all AIO calls are grouped"
    - "Existing operation labels are reviewed; semantically wrong ones are corrected, near-duplicates are merged"
    - "When user triggers any action in the app, every resulting fetch appears under an Operation card in dev-tools — the 'Ungrouped Requests' section stays empty"
  artifacts:
    - path: "taskflow/src/services/aio/client.ts"
      provides: "aioFetch with required operation parameter"
      contains: "operation"
    - path: "taskflow/src/services/jira.ts"
      provides: "all jira.ts apiFetch calls labelled"
  key_links:
    - from: "aioFetch"
      to: "apiFetch"
      via: "operation parameter pass-through"
      pattern: "apiFetch\\('aio',.*,.*operation"
    - from: "src/services/jira.ts"
      to: "operation-profiler.store"
      via: "apiFetch 4th argument"
      pattern: "apiFetch\\('jira',[^)]+,[^)]+,\\s*'[A-Z][a-zA-Z /]+'"
---

<objective>
Audit every `apiFetch(...)` call site in `taskflow/src/` and ensure each one passes a meaningful operation label (the 4th argument). Currently some calls supply a label and end up grouped in the dev-tools Operations tab; others do not and fall into the "Ungrouped Requests" bucket. The user wants every backend request to belong to a named group, and existing groups verified — corrected if misnamed, merged if duplicates exist, kept if accurate.

Purpose: Operation profiling becomes complete and trustworthy — every fetch the app fires can be reasoned about as part of a named user-facing operation in the dev-tools waterfall.

Output: All call sites (Jira REST, GitLab, AIO TCMS, notifications, attachments, worklogs, users, custom JQL widget) labelled with a consistent set of operation names; `aioFetch` extended to require and forward an `operation` label so AIO domain modules stop bypassing grouping.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# apiFetch contract — operation is the 4th argument and feeds the operation-profiler store
@taskflow/src/lib/apiFetch.ts
@taskflow/src/stores/operation-profiler.store.ts

# AIO wrapper — currently does NOT accept or pass an operation label
@taskflow/src/services/aio/client.ts

# Jira service files with the highest density of unlabelled calls
@taskflow/src/services/jira.ts
@taskflow/src/services/jira/attachments.ts
@taskflow/src/services/jira/users.ts
@taskflow/src/services/jira/worklogs.ts

# One UI widget that calls apiFetch directly without a label
@taskflow/src/routes/dashboard/widgets/CustomJqlWidget.tsx

# Dev-tools UI that surfaces grouped vs ungrouped requests — used for verification
@taskflow/src/routes/dev-tools/OperationsTab.tsx

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From taskflow/src/lib/apiFetch.ts:
```
export async function apiFetch(
  source: 'jira' | 'gitlab' | 'aio' | 'updater',
  url: string,
  init?: RequestInit,
  operation?: string,
): Promise<Response>
```

From taskflow/src/services/aio/client.ts (CURRENT — to be changed):
```
export async function aioFetch(
  baseUrl: string,
  token: string,
  path: string,
  apiPath: string = AIO_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response>
```

From taskflow/src/stores/operation-profiler.store.ts:
```
// label === undefined  → record lands in `ungrouped: FetchRecord[]`
// label === string     → record is attached to an active operation (2s coalesce window)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add required operation parameter to aioFetch and label every AIO call site</name>
  <files>taskflow/src/services/aio/client.ts, taskflow/src/services/aio/projects.ts, taskflow/src/services/aio/cycles.ts, taskflow/src/services/aio/issue-runs.ts, taskflow/src/services/aio/issue-steps.ts</files>
  <action>
    Extend the `aioFetch` signature in `taskflow/src/services/aio/client.ts` to take a required `operation: string` parameter and forward it as the 4th argument to `apiFetch('aio', url, {...}, operation)`. Place `operation` AFTER `path` and BEFORE `apiPath` so call sites read naturally; updating the optional-arg ordering is acceptable since all callers are internal to `services/aio/`. Update the function's JSDoc to document the new parameter and that it must be a stable, user-action-shaped label.

    Then update every `aioFetch(...)` call site to pass a meaningful operation label. Use this mapping (derived from the calling function's semantic purpose, kept consistent with the existing Jira label vocabulary like 'Load Issue Detail', 'Search Issues'):
      - `aio/projects.ts` — both calls: `'Load AIO Projects'`
      - `aio/cycles.ts`:
        - `fetchAioCycles`, `fetchAioCycleDetail` → `'Load AIO Cycles'`
        - `fetchAioFolderTree`, `fetchAioFolderCycleCounts`, `fetchAioCyclesWithDetail`, `fetchAioCycleSummaries` → `'Load AIO Cycles'` (same user-facing operation: opening the cycles page)
        - cycle CRUD POST/PUT (create, update, archive, etc. — anything with `method: 'POST'` or `'PUT'`/`'DELETE'`) → `'Manage AIO Cycle'`
      - `aio/issue-runs.ts` — `'Load AIO Execution Detail'`
      - `aio/issue-steps.ts` — `'Load AIO Execution Detail'` (same screen as issue-runs; coalesces into one operation card)

    If a function in `aio/cycles.ts` clearly mutates (POST/PUT/DELETE) but isn't obviously cycle CRUD (e.g. a defects-related POST), pick the closest user-facing label from the existing vocabulary; do not invent a new label per function.

    Update the test file `taskflow/src/services/aio/client.test.ts` (and any aio test that asserts on `aioFetch` argument count or on `apiFetch` mock-call shape) to match the new signature.

    Do NOT change `apiFetch` itself — it already accepts `operation`. Do NOT make `operation` optional on `aioFetch` (the whole point is that no AIO call is silently ungrouped).
  </action>
  <verify>
    <automated>cd taskflow && grep -RnE "aioFetch\(" src/services/aio --include="*.ts" | grep -v "test\|client.ts" | grep -vE "[a-zA-Z]+\s*,\s*'[A-Z][a-zA-Z ]+'\s*[,)]" || echo "ALL_AIO_CALLS_LABELLED"</automated>
  </verify>
  <done>aioFetch signature requires `operation`. Every aioFetch call in `aio/projects.ts`, `aio/cycles.ts`, `aio/issue-runs.ts`, `aio/issue-steps.ts` passes a label from the agreed vocabulary. `cd taskflow && npx tsc --noEmit` passes. `cd taskflow && npm test -- --run src/services/aio` passes.</done>
</task>

<task type="auto">
  <name>Task 2: Label remaining unlabelled apiFetch calls in jira.ts, jira/* subfiles, and the CustomJqlWidget</name>
  <files>taskflow/src/services/jira.ts, taskflow/src/services/jira/attachments.ts, taskflow/src/services/jira/users.ts, taskflow/src/services/jira/worklogs.ts, taskflow/src/routes/dashboard/widgets/CustomJqlWidget.tsx</files>
  <action>
    Add an operation label (4th argument) to every `apiFetch(...)` call that currently has none. Reuse existing labels wherever the semantic match is clean — do NOT invent new labels when an existing one fits. Authoritative existing vocabulary (from the codebase audit): `'Load Issue Detail'`, `'Search Issues'`, `'Search Closed Issues'`, `'Create/Edit Issue'`, `'Load Fields'`, `'Load Sprint Board'`, `'Load Sprint List'`, `'Load Backlog'`, `'Move to Backlog'`, `'Discover Board'`, `'Load Releases'`, `'Update Release'`, `'Manage Comments'`, `'Manage Links'`, `'Issue Transition'`, `'Watch Issue'`, `'Unwatch Issue'`, `'Validate Connection'`, `'Fetch project'`, `'Fetch Notifications'`, `'Load Notifications'`, `'Load MR Detail'`, `'Load MR Changes'`, `'Load Merge Requests'`, `'Load Milestone MRs'`, `'Load Quick Filters'`, `'Save Filter'`, `'Fetch Favourite Filters'`, `'Update Filter'`, `'Delete Filter'`, `'Fetch Issue By Key'`.

    Specific mapping for the unlabelled calls (line numbers are starting points — confirm by reading the surrounding function):
      - `jira.ts:55, 97` — connection validation helpers → `'Validate Connection'`
      - `jira.ts:211, 267` — issue-fetching helpers used by issue detail flows → `'Load Issue Detail'`
      - `jira.ts:639` — get-transitions helper → `'Issue Transition'`
      - `jira.ts:678` — POST transition → `'Issue Transition'`
      - `jira.ts:716, 779, 809` — comment add/edit/delete → `'Manage Comments'`
      - `jira.ts:752` — get single comment → `'Load Issue Detail'`
      - `jira.ts:847` — generic issue field fetch → `'Load Issue Detail'`
      - `jira.ts:1051, 1062` — board+active sprint discovery → `'Discover Board'`
      - `jira.ts:1203` — fetch field metadata → `'Load Fields'`
      - `jira.ts:1444` — generic single-issue GET inside an edit/save flow → `'Create/Edit Issue'`
      - `jira.ts:1629, 1637` — new/legacy endpoint fallback pair used for fields discovery → `'Load Fields'` (both halves of the dual-endpoint fallback get the SAME label so they coalesce)
      - `jira.ts:1660` — Jira self/myself lookup (auth verification) → `'Validate Connection'`
      - `jira.ts:1689` — POST issue link → `'Manage Links'`
      - `jira.ts:1850` — board sprint list inside sprint screen → `'Load Sprint Board'`
      - `jira.ts:1966, 2020` — board+sprint discovery for backlog screen → `'Load Backlog'`
      - `jira.ts:2127, 2159` — POST move-issues-to-sprint/backlog → reuse `'Move to Backlog'` for the backlog target; for the sprint target use `'Load Sprint Board'` (matches the existing convention at jira/sprints.ts:197 where a sprint move is already labelled `'Load Sprint Board'`)
      - `jira/attachments.ts:36, 74` — POST/DELETE attachments on an issue → `'Load Issue Detail'` (attachments are part of the issue detail screen; coalesces into the same operation card)
      - `jira/users.ts:29, 57` — user lookup/search → `'Create/Edit Issue'` (only used by the assignee picker today; if a call clearly serves a different screen, use that screen's label instead — read the calling function's JSDoc/callers before deciding)
      - `jira/worklogs.ts:39, 78, 112, 145` — worklog list/POST/PUT/DELETE → introduce ONE new label `'Manage Worklogs'`. This is the only new label allowed in this task; document the addition in the task summary so the reviewer can see it was deliberate.
      - `routes/dashboard/widgets/CustomJqlWidget.tsx:23` — custom JQL widget on dashboard → reuse `'Search Issues'` (it is, by definition, a JQL search).

    Important rules for labels:
      - The label is the 4th positional argument to `apiFetch`. It comes AFTER the `init` object. For single-line calls (e.g. `apiFetch('jira', url, { headers })`), append `, 'Load Fields'` before the closing paren. For multi-line calls, place the label on its own line at the end and ensure a trailing comma if the file style uses them.
      - Do NOT change the URL, method, headers, or body of any call.
      - Do NOT rename existing labels in this task — `Task 3` handles the audit of existing labels separately.
      - If a call site clearly does not match any of the labels above (e.g. an undiscovered helper), pick the closest existing label and note the mismatch in the task summary; do NOT invent additional new labels beyond `'Manage Worklogs'`.
  </action>
  <verify>
    <automated>cd taskflow && node -e "const {execSync}=require('child_process');const out=execSync(\"grep -rEoh \\\"apiFetch\\\\([^)]*\\\\)\\\" src --include='*.ts' --include='*.tsx' | grep -v 'apiFetch(\\\\.\\\\.\\\\.)' | grep -v '^apiFetch\\$'\",{encoding:'utf8'});const lines=out.split('\\n').filter(Boolean);const bad=lines.filter(l=>!/,\\s*'[A-Z][a-zA-Z \\/]+'\\s*\\)$/.test(l) && !l.includes('apiFetch(...)'));console.log('Total single-line apiFetch calls:',lines.length);console.log('Without label:',bad.length);if(bad.length){console.log(bad.join('\\n'));process.exit(1)}"</automated>
    <automated>cd taskflow && npx tsc --noEmit</automated>
  </verify>
  <done>Every previously-unlabelled apiFetch call in the listed files now passes a label. `cd taskflow && npx tsc --noEmit` passes. `cd taskflow && npm run lint` passes. `cd taskflow && npm test -- --run` passes. The new label `'Manage Worklogs'` appears in worklogs.ts and is the only label introduced in this task.</done>
</task>

<task type="auto">
  <name>Task 3: Audit existing operation labels — correct or merge any that are wrong</name>
  <files>taskflow/src/services/jira.ts, taskflow/src/services/jira/comments.ts, taskflow/src/services/jira/transitions.ts, taskflow/src/services/jira/versions.ts, taskflow/src/services/jira/board-config.ts, taskflow/src/services/jira/filters.ts, taskflow/src/services/jira/fields.ts, taskflow/src/services/jira/sprints.ts, taskflow/src/services/jira/projects.ts, taskflow/src/services/jira/backlog.ts, taskflow/src/services/jira/links.ts, taskflow/src/services/jira/client.ts, taskflow/src/services/jira-watchers.ts, taskflow/src/services/notifications.ts, taskflow/src/services/gitlab.ts, taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts, taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx, taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx, taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</files>
  <action>
    For every file in the list, enumerate each `apiFetch(...)` call's existing operation label and verify it actually describes the user-facing operation that triggers the call. Use this audit procedure for each call:

    1. Find the exported function that contains the call.
    2. Find one or two call-sites of that function (use grep on the function name across `src/`).
    3. Identify the user action that triggers it (opening issue detail, clicking save, opening MR list, etc.).
    4. Compare to the existing label. Verdict is one of:
       - **KEEP** — label accurately names the user-facing operation.
       - **RENAME** — label is misleading. Replace with the correct existing label (do not invent new ones unless absolutely required; if a new label is required, document why in the summary).
       - **MERGE** — two labels describe the same user operation. Pick the more common one and rename the less-common one to match.

    Known suspicious labels to verify carefully (audit decisions, not predetermined fixes):
      - `'Fetch Notifications'` vs `'Load Notifications'` in `notifications.ts` — these appear in the same file and likely describe the same user-facing operation (the notifications poll/refresh). If both fire as part of one poll cycle, MERGE to a single label (recommend `'Load Notifications'` — verb-noun matches the rest of the vocabulary).
      - `'Fetch project'` in `jira/projects.ts:120` — lowercase 'project' breaks the Title Case convention used everywhere else. RENAME to `'Validate Connection'` if it's part of the connection-validation flow, or to `'Load Project'` otherwise (read the callers to decide).
      - `'Fetch Issue By Key'` in `jira.ts:1369` vs `'Load Issue Detail'` — if both are triggered by opening an issue, MERGE to `'Load Issue Detail'`. If `'Fetch Issue By Key'` is used by a different flow (e.g. command palette deep-link), KEEP and note the rationale.
      - `'Load Fields'` is used for both fields metadata and the create/edit fields section. Confirm both genuinely belong to the same user operation; if `CustomFieldsSection.tsx:62` is rendered inside the issue detail screen rather than create/edit, RENAME its call to `'Load Issue Detail'`.
      - In `useCreateEditQueries.ts` (lines 60, 108, 139) all three use `'Create/Edit Issue'` — verify they all fire on the same screen; if so KEEP.

    For each call site reviewed, write a one-line entry in the SUMMARY under `## Label Audit Decisions` of the form `path:line — '<old>' → KEEP / RENAME to '<new>' / MERGE into '<canonical>' — reason`. Do not skip entries; a complete table is part of the deliverable.

    Do NOT widen scope to GitLab files unless an obvious miscategorisation is found — gitlab labels (`'Load Merge Requests'`, `'Load MR Detail'`, etc.) were already audited during this plan's discovery and look consistent.
  </action>
  <verify>
    <automated>cd taskflow && node -e "const {execSync}=require('child_process');const out=execSync(\"grep -rEoh \\\"'[A-Z][a-zA-Z \\\\/]+'\\\" src/services src/routes/dashboard --include='*.ts' --include='*.tsx' | sort -u\",{encoding:'utf8'});console.log('Unique label-like strings (some are false positives, manual review):');console.log(out)"</automated>
    <automated>cd taskflow && grep -rn "'Fetch project'" src --include="*.ts" --include="*.tsx" | grep -v "test" && echo "FAIL: 'Fetch project' (lowercase) still present" && exit 1 || echo "PASS: lowercase label removed"</automated>
    <automated>cd taskflow && npx tsc --noEmit</automated>
  </verify>
  <done>Every reviewed call has an audit verdict recorded in the SUMMARY. Lowercase `'Fetch project'` is gone. Where MERGE was the verdict, the two old labels are reduced to one. No new label is introduced unless explicitly justified in the audit table. `cd taskflow && npm run lint` and `cd taskflow && npm test -- --run` both pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    `aioFetch` now requires an `operation` argument and forwards it. All previously-unlabelled `apiFetch` calls across the Jira, AIO, attachments, users, worklogs, and CustomJqlWidget code paths now pass a label. Existing labels have been audited and corrected/merged where wrong.
  </what-built>
  <how-to-verify>
    1. `cd taskflow && npm run dev` (or your normal dev startup).
    2. Open the running app, open Settings → Developer Tools, enable the master `devToolsEnabled` toggle AND `operationProfiling`.
    3. Open dev-tools, go to the Operations tab. The "Ungrouped Requests" section should be visible at the bottom but empty (or expand to zero rows) for every flow you test below.
    4. Exercise these flows and watch the Operations tab for one card per flow (not a swarm of ungrouped rows):
       - Open dashboard / sprint board → expect a card labelled `Load Sprint Board` or `Load Backlog`.
       - Open an issue detail → expect a single `Load Issue Detail` card containing many fetches (issue, comments, watchers, links, attachments).
       - Open AIO Cycles page → expect a `Load AIO Cycles` card containing all the folder-tree, summary, and paged fetches.
       - Open an AIO execution detail → expect `Load AIO Execution Detail` card with runs + steps fetches.
       - Trigger a Jira notifications refresh → expect a single `Load Notifications` (or `Fetch Notifications` — should be only ONE of these names, not both).
       - Use the dashboard Custom JQL widget → expect `Search Issues` card.
    5. Confirm: every fetch appears under a named card. No flow leaves rows in the Ungrouped section.
  </how-to-verify>
  <resume-signal>Type "approved" if every tested flow produces a named operation card and the Ungrouped Requests section stays empty, or describe any flow that still ends up ungrouped or has a misleading group name.</resume-signal>
</task>

</tasks>

<verification>
1. `cd taskflow && npx tsc --noEmit` — type-check passes.
2. `cd taskflow && npm run lint` — lint passes.
3. `cd taskflow && npm test -- --run` — full test suite passes (aio tests in particular, since `aioFetch` signature changed).
4. Static grep gate: no `apiFetch('jira', ...)`, `apiFetch('gitlab', ...)`, or `apiFetch('aio', ...)` call in `taskflow/src/` is missing its 4th-argument label (filter out comment lines via `grep -v '^\s*\*'`).
5. Human verification (checkpoint task above): the dev-tools Operations tab shows zero "Ungrouped Requests" across every exercised user flow.
</verification>

<success_criteria>
- Every `apiFetch(...)` call in `taskflow/src/` (excluding tests and the wrapper itself) passes a 4th-argument operation label.
- `aioFetch` requires an `operation` argument and forwards it; no AIO call is silently ungrouped.
- Existing labels have been reviewed; misleading or duplicate labels have been renamed or merged, with an audit trail in the SUMMARY.
- Type-check, lint, and tests all pass.
- Manually exercising the major flows (issue detail, sprint board, backlog, AIO cycles, AIO execution detail, notifications, custom JQL) produces one named operation card per flow with the Ungrouped Requests section empty.
</success_criteria>

<output>
Create `.planning/quick/260518-wmy-i-want-all-backend-requests-to-have-a-gr/260518-wmy-SUMMARY.md` when done. Include a `## Label Audit Decisions` table from Task 3 listing every reviewed call with its KEEP / RENAME / MERGE verdict.
</output>
