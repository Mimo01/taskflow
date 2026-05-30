---
status: diagnosed
trigger: "there are no transitions available (bug), cant test this"
created: 2026-05-29
updated: 2026-05-29
---

## Current Focus

hypothesis: Adapted issues lack `fields.issuetype.id`, so `peekGhTransitions` returns `undefined` for every card.
test: Read `adapter.ts` + `transitions.ts:peekGhTransitions` + `SprintBoardTab.tsx:getTransitions`.
expecting: Adapter omits `id` on issuetype; peek bails on empty issueTypeId.
next_action: Report root cause + minimal fix.

## Symptoms

expected: Right-click on a sprint-board card shows the workflow transition menu (To Do / In Progress / Done options).
actual: No transitions render. Menu is empty / not actionable. User cannot move cards between columns.
errors: (none reported)
reproduction: Open `/sprint-board` after Phase 73 cutover; attempt to transition any card.
started: Phase 73 rewrite of `SprintBoardTab.tsx` onto `useGhAllData` + caller-side `createAdapter`.

## Eliminated

- hypothesis: `allData.issuesData.issues[0].projectId` is undefined (R-04 assumption wrong)
  evidence: `GhIssue.projectId` is declared in `types.ts:55` AND confirmed on the real fixture (`allData.real.json`): `issues[0].projectId === 10134`. Sentinel projectId is wired correctly.
  timestamp: 2026-05-29

- hypothesis: `useGhTransitions` cache key stale across board switches
  evidence: Not relevant — the keying is by projectId only, and the per-card path uses `peekGhTransitions` which reads directly from the envelope cache. The bug fires on first board load, not after a switch.
  timestamp: 2026-05-29

- hypothesis: TaskCard / StoryHeaderRow stopped consuming `transitions` prop
  evidence: SprintBoardTab.tsx:343 + :381 + :455 + :493 + :1235 all pass `transitions={getTransitions(...)}` to children. Prop wiring is intact. The problem is upstream — `getTransitions` returns `undefined` itself.
  timestamp: 2026-05-29

## Evidence

- timestamp: 2026-05-29
  checked: `src/services/jira/greenhopper/adapter.ts:120-127`
  found: |
    Adapter builds `fields.issuetype` as `{ name, subtask }` ONLY:
      const adaptedIssuetype: JiraIssue['fields']['issuetype'] = {
        name: issuetype.name,
        subtask: parent !== undefined,
      };
    The comment claims adding `id` would fail tsc excess-property check — but `id` is OPTIONAL in `JiraIssue.fields.issuetype` (jira.ts:155), so the comment's justification is incorrect; either way, runtime objects have NO `id`.
  implication: Every issue produced by `createAdapter` (= every card on the board) lacks `fields.issuetype.id`.

- timestamp: 2026-05-29
  checked: `src/routes/dashboard/SprintBoardTab.tsx:761-774` (`getTransitions`)
  found: |
    Line 768:
      const all = peekGhTransitions(queryClient, projectId, issue.fields.issuetype?.id ?? '');
    With adapter omitting `id`, the third argument is always `''`.

- timestamp: 2026-05-29
  checked: `src/services/jira/greenhopper/transitions.ts:259-282` (`peekGhTransitions`)
  found: |
    Line 268 guard:
      if (!Number.isFinite(projectId) || projectId <= 0 || !issueTypeId) return undefined;
    With `issueTypeId === ''`, peek returns `undefined` for every card.
    Therefore `getTransitions(issue)` returns `undefined` at SprintBoardTab.tsx:769.
  implication: Every card receives `transitions={undefined}` → the right-click popover has nothing to show.

- timestamp: 2026-05-29
  checked: real fixture `__fixtures__/allData.real.json`
  found: `issues[0].projectId = 10134` (number), `issues[0].typeId = "10001"` (string). Both fields are present on every issue.
  implication: The raw envelope IS sufficient — but the adapter drops `typeId` instead of routing it through to `fields.issuetype.id`.

- timestamp: 2026-05-29
  checked: `src/routes/dashboard/SprintBoardTab.tsx:747-759` (sentinel call)
  found: |
    The SENTINEL `useGhTransitions(sentinelProjectId, sentinelIssueTypeId)` call DOES work:
    - `sentinelProjectId` comes from `allData.issuesData.issues[0].projectId` ✓
    - `sentinelIssueTypeId` falls back to `allData.issuesData.issues[0].typeId` when adapter result lacks `id` ✓
    So the envelope IS warmed and `peekGhTransitions` could resolve any (projectId, issueTypeId) — but the per-card lookup at line 768 reads `issue.fields.issuetype?.id` which is undefined.

## Resolution

root_cause: |
  `src/services/jira/greenhopper/adapter.ts:124-127` builds `fields.issuetype` as `{ name, subtask }` and omits `id`. Then `src/routes/dashboard/SprintBoardTab.tsx:768` calls `peekGhTransitions(queryClient, projectId, issue.fields.issuetype?.id ?? '')`, which hits the empty-string guard at `transitions.ts:268` and returns `undefined` for every card. The transition envelope is fetched and cached correctly (sentinel call works), but the per-card peek never reaches it because the issuetype id is missing on adapted issues.

fix: |
  One-line fix in `adapter.ts` — add `id: gh.typeId` to the adapted issuetype object.
  Diff:
    const adaptedIssuetype: JiraIssue['fields']['issuetype'] = {
  +   id: gh.typeId,
      name: issuetype.name,
      subtask: parent !== undefined,
    };
  The legacy `JiraIssue.fields.issuetype.id` is already optional (`id?: string`, jira.ts:155) and the comment at adapter.ts:120-122 (claiming this would fail tsc excess-property check) is wrong — the field is declared on the type, so adding it is compatible. The comment was apparently carried over from an earlier draft of the JiraIssue type.

verification: |
  After the one-line fix:
    - `peekGhTransitions(qc, projectId, "10001")` resolves the warmed envelope and returns the workflow transitions list.
    - `filterTransitionsForStatus(...)` narrows to transitions valid from the card's current status.id (already set correctly by the adapter at line 140).
    - Right-click popover on every card shows the correct transitions.
    - Existing adapter tests should still pass (`id` is optional in the type so no test fixture is invalidated).
    - Update the misleading comment block at adapter.ts:120-122 and remove the "no id" warning.

files_changed:
  - taskflow/src/services/jira/greenhopper/adapter.ts

confidence: high
