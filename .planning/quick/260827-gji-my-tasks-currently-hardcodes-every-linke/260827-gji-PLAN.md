---
phase: quick-260827-gji
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/my-tasks-mr-health.ts
  - taskflow/src/lib/my-tasks-mr-health.test.ts
  - taskflow/src/routes/my-tasks/MyTasksPage.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
  - taskflow/src/routes/dashboard/TaskRow.tsx
  - taskflow/src/routes/dashboard/MrRow.tsx
autonomous: true
requirements: [MYTASK-MRHEALTH-01]

must_haves:
  truths:
    - "A My Tasks row whose authored MR has an approver shows the 'approved' badge, not 'Awaiting review'"
    - "A My Tasks row whose authored MR has unresolved resolvable discussion notes shows 'changes requested'"
    - "A My Tasks row whose authored MR has neither still shows 'Awaiting review' (unchanged behavior)"
    - "Per-MR enrichment fires only for authored MRs that match a currently-visible issue key, capped at 20 MRs"
    - "Discussions are fetched only for MRs that came back with zero approvers"
    - "No dead dashboard/TaskRow.tsx or dashboard/MrRow.tsx remain in the tree"
  artifacts:
    - path: "taskflow/src/lib/my-tasks-mr-health.ts"
      provides: "Pure selection + health-map helpers used by MyTasksPage"
      exports: ["selectMrsForHealth", "resolveMrHealth", "buildMrHealthByKey", "MR_HEALTH_ENRICHMENT_CAP"]
    - path: "taskflow/src/lib/my-tasks-mr-health.test.ts"
      provides: "Unit tests for cap, key-intersection filter, precedence, fallback"
  key_links:
    - from: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      to: "deriveReviewHealth"
      via: "import from @/services/linkEngine, called per enriched MR"
      pattern: "deriveReviewHealth\\("
    - from: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      to: "fetchMRApprovals / fetchMRDiscussions"
      via: "two useQueries batches keyed ['gitlab-mr-approvals', String(project_id), String(iid)] / ['gitlab-mr-discussions', ...]"
      pattern: "useQueries\\("
---

<objective>
My Tasks currently hardcodes every linked MR badge to `'waiting_for_review'`
(MyTasksPage.tsx:346-361) even though `deriveReviewHealth()` in
`src/services/linkEngine.ts:119` already implements the correct rule and is
fully unit-tested (`linkEngine.test.ts:184`). Its only would-be consumers,
`src/routes/dashboard/TaskRow.tsx` and `src/routes/dashboard/MrRow.tsx`, are
dead code — nothing imports either file (verified: `UnifiedTaskTable.tsx` has
its own local `TaskRow`, `StandaloneMrGroup.tsx` / `TodayUpNextSection.tsx` /
`TodayInProgressSection.tsx` have their own local `MrRow`/`NestedMrRow`).

Purpose: make the My Tasks MR badge tell the truth (approved /
changes requested / awaiting review) with a bounded number of GitLab requests,
and collapse to one source of truth by deleting the dead row components.

Output: new pure helper module + tests, rewired MyTasksPage, two deleted files.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/services/linkEngine.ts
@taskflow/src/routes/my-tasks/MyTasksPage.tsx
@taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
@taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
</context>

<verified_interfaces>
Confirmed by reading the source (do NOT re-derive):

- `deriveReviewHealth(approvals: MRApprovals, discussions: Discussion[]): ReviewHealth`
  — `src/services/linkEngine.ts:119`. Priority: any `approvals.approved_by.length > 0`
  → `'approved'`; else any discussion note with `resolvable && !resolved`
  → `'changes_requested'`; else `'waiting_for_review'`.
- `ReviewHealth = 'approved' | 'changes_requested' | 'waiting_for_review'`.
- `fetchMRApprovals(baseUrl, token, projectId: number, mrIid: number): Promise<MRApprovals>`
  — `src/services/gitlab.ts:785`. `MRApprovals = { approved_by: Array<{user:{id,name}}>; approved: boolean }`.
- `fetchMRDiscussions(baseUrl, token, projectId: number, mrIid: number): Promise<Discussion[]>`
  — `src/services/gitlab.ts:830`. Internally paginates (per_page=100 loop) — this is why
  discussions must be gated, not fired for every MR.
- `fetchAuthoredMRs(baseUrl, token, userId): Promise<GitLabMR[]>` — already called in
  MyTasksPage under key `['gitlab-authored-mrs', gitlabBaseUrl, gitlabUserId]`;
  server-side filtered to `state=opened`, `per_page=100`. `GitLabMR` carries
  `project_id: number`, `iid: number`, `title`, `source_branch`, `updated_at` (ISO).
- Existing cache keys used by `MergeRequestDetailPage.tsx:110/124`:
  `['gitlab-mr-approvals', projectId, iid]` and `['gitlab-mr-discussions', projectId, iid]`
  where both segments are **route-param strings**. Reuse the same shape with
  `String(mr.project_id)` / `String(mr.iid)` so both screens share one cache entry.
- `MyTaskRow` consumes `mrHealth?: ReviewHealth` (`MyTaskRow.tsx:129`) and renders
  the chip at `MyTaskRow.tsx:378-392`. No prop change needed.
- `groupByMyDay(..., new Set(mrHealthByKey.keys()))` drives the "In Review with my MR"
  band — the key set must keep containing every matched key regardless of health.
</verified_interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure MR-health selection + aggregation helpers</name>
  <files>taskflow/src/lib/my-tasks-mr-health.ts, taskflow/src/lib/my-tasks-mr-health.test.ts</files>
  <behavior>
    - `MR_HEALTH_ENRICHMENT_CAP` is `20`.
    - `selectMrsForHealth(mrs, visibleIssueKeys)` returns `Array<{ mr: GitLabMR; keys: string[] }>`:
      keys come from `extractTicketKeys(mr.title)` then `extractTicketKeys(mr.source_branch)`
      (deduped, order preserved); an MR is kept only if at least one key is in
      `visibleIssueKeys`; kept MRs sort by `updated_at` descending; result is sliced to
      `MR_HEALTH_ENRICHMENT_CAP`.
      Test: MR with no matching key is dropped. Test: 25 matching MRs → 20 returned, the
      20 most recently updated. Test: empty `visibleIssueKeys` → `[]` (no requests at all).
    - `resolveMrHealth(approvals, discussions)` returns `deriveReviewHealth(approvals, discussions)`
      when `approvals` is defined, and `'waiting_for_review'` when `approvals` is `undefined`
      (still loading or errored — graceful degradation preserves today's badge).
      `discussions` may be `undefined` → treated as `[]`.
      Test: undefined approvals → `'waiting_for_review'`. Test: approver present +
      undefined discussions → `'approved'`.
    - `buildMrHealthByKey(entries: Array<{ keys: string[]; health: ReviewHealth }>)` returns
      `Map<string, ReviewHealth>`. When several MRs map to the same issue key, the most
      actionable state wins: `changes_requested` > `waiting_for_review` > `approved`.
      Test: key seen as `approved` then `changes_requested` → `changes_requested`.
      Test: key seen as `changes_requested` then `approved` → `changes_requested` (order-independent).
      Test: key seen only as `approved` → `approved`.
  </behavior>
  <action>
    Create `taskflow/src/lib/my-tasks-mr-health.ts` exporting `MR_HEALTH_ENRICHMENT_CAP`,
    `selectMrsForHealth`, `resolveMrHealth`, `buildMrHealthByKey` with the behavior above.
    Import `extractTicketKeys` and `deriveReviewHealth` plus the `ReviewHealth` type from
    `@/services/linkEngine`, and `Discussion`/`GitLabMR`/`MRApprovals` types from
    `@/services/gitlab`. Keep the module pure — no fetch, no React, no store access.
    Implement precedence with a numeric rank map (changes_requested=0, waiting_for_review=1,
    approved=2) so aggregation is order-independent, not first-write-wins.
    Write `my-tasks-mr-health.test.ts` alongside it covering every case listed in
    `<behavior>`. Per the repo pre-commit hook (full vitest suite runs on commit),
    commit tests and implementation together in one commit.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/lib/my-tasks-mr-health.test.ts</automated>
  </verify>
  <done>All helper unit tests pass; module has zero React/fetch imports.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire real per-MR approvals + gated discussions into MyTasksPage</name>
  <files>taskflow/src/routes/my-tasks/MyTasksPage.tsx, taskflow/src/routes/my-tasks/MyTasksPage.test.tsx</files>
  <behavior>
    - With an authored MR titled `PROJ-1 fix` whose approvals return one approver, the
      row for `PROJ-1` renders the approved chip label, not "Awaiting review".
    - With an MR whose approvals return `approved_by: []` and whose discussions contain a
      note with `resolvable: true, resolved: false`, the row renders the
      changes-requested chip label.
    - With no GitLab config (`gitlabBaseUrl`/`gitlabUserId` null), no enrichment queries are
      constructed and the page renders exactly as today.
  </behavior>
  <action>
    In `MyTasksPage.tsx`:
    1. Import `useQueries` alongside `useQuery` from `@tanstack/react-query`; import
       `fetchMRApprovals`, `fetchMRDiscussions` from `@/services/gitlab`; import
       `buildMrHealthByKey`, `resolveMrHealth`, `selectMrsForHealth` from
       `@/lib/my-tasks-mr-health`. Drop the now-unused direct `extractTicketKeys` import if
       nothing else in the file uses it.
    2. Compute `visibleIssueKeys` as a `Set<string>` of `activeData.issues.map(i => i.key)`
       for the *active scope* — this is the gate that keeps request volume bounded. Move the
       existing `activeData` derivation above the enrichment block so it is available.
       (`activeData` is currently derived at line ~364, below the MR block — reorder, do not
       duplicate.)
    3. `const enrichTargets = gitlabEnabled ? selectMrsForHealth(authoredMRs ?? [], visibleIssueKeys) : []`.
    4. Approvals batch:
       `const approvalResults = useQueries({ queries: enrichTargets.map(({ mr }) => ({
         queryKey: ['gitlab-mr-approvals', String(mr.project_id), String(mr.iid)],
         queryFn: () => fetchMRApprovals(gitlabBaseUrl!, gitlabToken!, mr.project_id, mr.iid),
         staleTime: 60_000, retry: 1, enabled: gitlabEnabled })) })`.
       Note the key segments are `String(...)` deliberately, to hit the same cache entries
       `MergeRequestDetailPage.tsx` already populates.
    5. Discussions batch, gated to avoid the paginating fetcher running for every MR:
       build a second `useQueries` over the same `enrichTargets` array (same index order), with
       `enabled: gitlabEnabled && approvalResults[i]?.data !== undefined && approvalResults[i].data.approved_by.length === 0`
       and key `['gitlab-mr-discussions', String(mr.project_id), String(mr.iid)]`, same
       staleTime/retry. Because `deriveReviewHealth` short-circuits on any approver,
       discussions are only needed for unapproved MRs.
    6. Replace the hardcoded block at lines ~345-361 with
       `const mrHealthByKey = buildMrHealthByKey(enrichTargets.map(({ keys }, i) => ({ keys, health: resolveMrHealth(approvalResults[i]?.data, discussionResults[i]?.data) })))`.
       Update the file's header comment (line 15 and the stale line-354 comment is deleted
       with the block) to describe the real derivation.
    7. Leave `mrsAwaitingCount`, the `groupByMyDay(...)` key-set argument, and the
       `MyTaskRow mrHealth={mrHealthByKey.get(parent.key)}` prop untouched.
    Hook-order safety: both `useQueries` calls must be at the component top level and always
    invoked (an empty `queries` array when disabled) — never inside a conditional.
    In `MyTasksPage.test.tsx`, extend the existing top-of-file mocks: add
    `useQueries: vi.fn().mockReturnValue([])` to the `@tanstack/react-query` mock and add
    `fetchMRApprovals` / `fetchMRDiscussions` vi.fn stubs to the `@/services/gitlab` mock so
    existing smoke tests keep passing. Then add a `describe('MyTasksPage — real MR review
    health (260827-gji)')` block that drives the two behaviors above by making the
    `useQuery`/`useQueries` mocks return the authored MRs and the approval/discussion payloads
    for a `PROJ-1` issue, asserting on the chip label text rendered by `MyTaskRow`
    (read the exact labels from `MR_HEALTH_LABEL` in `MyTaskRow.tsx`).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/my-tasks</automated>
  </verify>
  <done>New behavior tests pass, all pre-existing MyTasksPage/MyTaskRow tests still pass, and no `'waiting_for_review'` literal remains as an unconditional assignment in MyTasksPage.tsx.</done>
</task>

<task type="auto">
  <name>Task 3: Delete dead dashboard/TaskRow.tsx and dashboard/MrRow.tsx</name>
  <files>taskflow/src/routes/dashboard/TaskRow.tsx, taskflow/src/routes/dashboard/MrRow.tsx</files>
  <action>
    Both files are unreferenced default-export components (no test files exist for either;
    the only textual matches elsewhere are unrelated *local* `TaskRow`/`MrRow`/`NestedMrRow`
    functions defined inside `release-detail/UnifiedTaskTable.tsx`,
    `standup-notes/StandaloneMrGroup.tsx`, `standup-notes/TodayUpNextSection.tsx`, and
    `standup-notes/TodayInProgressSection.tsx`).
    Re-confirm with `grep -rn "from './TaskRow'\|from './MrRow'\|dashboard/TaskRow\|dashboard/MrRow" taskflow/src`
    returning nothing, then `git rm` both files. Decision: delete, not repurpose — the live
    badge logic now lives in `my-tasks-mr-health.ts` + `MyTaskRow.tsx`, so keeping a second
    dot-color/health renderer would recreate the duplicate source of truth this task removes.
    Do not touch `MrHealthPanel.tsx` or its test.
  </action>
  <verify>
    <automated>cd taskflow && test ! -e src/routes/dashboard/TaskRow.tsx && test ! -e src/routes/dashboard/MrRow.tsx && [ "$(grep -rn "from './TaskRow'\|from './MrRow'\|dashboard/TaskRow\|dashboard/MrRow" src | grep -v '^\s*//' | wc -l | tr -d ' ')" = "0" ] && npm run check && npx vitest run</automated>
  </verify>
  <done>Both files gone, `npm run check` (biome + tsc --noEmit) clean with no NEW files flagged versus the pre-change baseline, and the full vitest suite passes.</done>
</task>

</tasks>

<verification>
1. `cd taskflow && npx vitest run` — full suite green.
2. `cd taskflow && npm run check` — biome + `tsc --noEmit`; compare flagged files against the
   pre-change baseline (per project convention, gate on "no NEW files flagged", never an
   absolute diagnostic count).
3. Request-volume sanity: with 100 authored open MRs but 12 visible issues, at most 12
   approvals requests fire (cap 20), and discussions fire only for the subset with zero
   approvers.
</verification>

<success_criteria>
- My Tasks MR badges reflect real GitLab state via `deriveReviewHealth()`, which is now
  reachable from a live page.
- Enrichment is bounded: matched-key filter + 20-MR cap + approvals-first discussion gate.
- Approvals/discussions cache entries are shared with `MergeRequestDetailPage`.
- `dashboard/TaskRow.tsx` and `dashboard/MrRow.tsx` no longer exist.
- No regression in the "In Review with my MR" band or the "N MRs awaiting you" header stat.
</success_criteria>

<output>
Create `.planning/quick/260827-gji-my-tasks-currently-hardcodes-every-linke/260827-gji-SUMMARY.md` when done
</output>
