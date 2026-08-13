# Phase 87: Release Detail Decomposition - Research

**Researched:** 2026-08-10
**Domain:** Internal React/TypeScript structural refactor (codebase-internal only, no external libraries)
**Confidence:** HIGH — all findings verified by direct file reads of the actual codebase, not training knowledge

## Summary

This phase splits `ReleaseDetailPage.tsx` (1518 LOC, verified) into a `release-detail/` folder mirroring the `issue-detail/` convention, with zero user-visible behavior change. All research below is derived directly from reading the target file, the `issue-detail/` precedent folder, the shared service layer (`jira.ts`, `apiFetch.ts`), and the three consumer test files that share query-cache state with this page.

Two findings materially affect planning and are **not** captured in CONTEXT.md's line-range guidance:

1. **The "Issues" and "Unmatched MRs" JSX blocks are NOT sibling sections** — they share one `<section>...</section>` wrapper (L778–1064). If `UnmatchedMRsSection` is extracted as its own file (per D-01), it must be rendered as a **child inside** `IssuesSection`'s returned JSX, not as a sibling in the page shell, or the wrapping `<section>` tag's semantics/DOM structure will change.
2. **The two inline Jira fetchers use raw `fetch` from `@tauri-apps/plugin-http`, but every function already in `jira.ts` uses the instrumented `apiFetch()` wrapper instead** (33/33 existing functions, 0 raw-fetch calls). Moving the fetchers to `jira.ts` per D-12 while switching them to `apiFetch()` is a **real behavior change** (adds a 15s timeout + 401→disconnect detection + optional devtools instrumentation) — this needs an explicit planner decision, not a silent "keep it byte identical" assumption.

**Primary recommendation:** Follow `issue-detail/` conventions exactly (named exports, `interface XProps` colocated above the component, thin `index.ts`, co-located hooks). Extract `release-detail/releaseSummaries.ts` as pure functions per D-09, write `useReleaseDetail.ts` as a single hook returning one destructured object per D-07, and treat the `apiFetch` vs raw-`fetch` question as an explicit open decision for the plan (recommend using `apiFetch`, documented as an intentional, low-risk behavior improvement — see Pitfall 2 below).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Release/issue/MR data fetching (6 useQuery calls) | Frontend (React Query hook) | — | Already client-side; no backend in this Tauri app — `useReleaseDetail.ts` owns all fetching |
| Derived aggregation (label summary, counts, story points, milestone window) | Frontend (pure module) | — | Currently inline in component body; moves to `releaseSummaries.ts`, a React-free pure module |
| Jira REST fetch plumbing (`fetchVersionIssueCounts`, `fetchFixVersionIssues`) | Service layer (`services/jira.ts`) | — | Matches existing pattern — every other Jira call already lives in the service layer, not in route files |
| Presentational rendering (sections/sidebar/modal) | Frontend (React components) | — | Props-driven per D-08; no fetching inside sections |
| Route shell / navigation / breadcrumb / pin state | Frontend (page component) | — | Stays in `ReleaseDetailPage.tsx` per D-04, mirrors `IssueDetailContent.tsx` |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Per-section split, ~8 files in `release-detail/`, one file per JSX section, matching `issue-detail/` convention. Target files (guidance, not contract — see corrected line ranges below): `ReleaseHeader.tsx`, `DescriptionsSection.tsx`, `LabelSummarySection.tsx`, `IssuesSection.tsx`, `UnmatchedMRsSection.tsx`, `ReleaseDetailSidebar.tsx`, `EditReleaseModal.tsx`, `MetaRow.tsx`, `ReleaseDetailSkeleton.tsx`.
- **D-02:** Do not split `IssuesSection` further in this phase.
- **D-03:** Action buttons block (L1066–1103) stays in the page shell unless it reads more naturally inside `ReleaseHeader` — planner's call.
- **D-04:** Page shell `ReleaseDetailPage.tsx` stays at `routes/dashboard/`, not inside `release-detail/`. No router change.
- **D-05:** Sections imported by direct path; `release-detail/index.ts` stays thin (or omitted) — no full re-export barrel.
- **D-06:** Target: page shell lands in ~150–250 LOC range after split. Health indicator, not a hard gate.
- **D-07:** All 6 `useQuery` calls move into a single co-located hook `release-detail/useReleaseDetail.ts`, returning one destructured object.
- **D-08:** Sections are presentational — props-driven, no data fetching of their own.
- **D-09:** The ~7 derived computations extract into a pure, React-free module `release-detail/releaseSummaries.ts`, called from `useReleaseDetail`.
- **D-10:** Hooks co-located in `release-detail/`, not `src/hooks/`.
- **D-11:** Query keys, `staleTime`, `enabled` guards, and fetch behavior must be carried over verbatim — cache is shared with `ReleasesTab`/`UpcomingReleasesTimeline`.
- **D-12:** `fetchVersionIssueCounts` and `fetchFixVersionIssues` move into `services/jira.ts` (legacy file, NOT `services/jira/`). Behavior, auth handling, error shape must be identical.
- **D-13:** Local `MetaRow` becomes a private `release-detail/MetaRow.tsx`, NOT shared with `issue-detail/MetaRow.tsx`. Planner should diff the two and record the delta; if byte-identical, executor may share, but a divergence is a reason to keep the copy.
- **D-14:** Safety net = unit tests on extracted pure functions + typecheck + manual UAT. No full-page characterization test.
- **D-15:** Existing suites must pass with zero regressions, specifically `ReleasesTab.test.tsx` and `UpcomingReleasesTimeline.test.tsx`.
- **D-16:** Mirror today's structure only. Zero speculative files/seams for Phases 88–91.

### Claude's Discretion

The user delegated every implementation choice ("you decide" on 9 of 10 questions). The decisions above are locked for downstream agents, not open questions to re-ask. Where the planner finds evidence a specific call is wrong (e.g., a query key that cannot move without breaking a consumer, or a section boundary that reads badly in the actual JSX), it may adjust file-level detail and record the deviation — but D-16 and zero-user-visible-change are hard constraints.

### Deferred Ideas (OUT OF SCOPE)

- Dedupe `MetaRow` across `issue-detail/` and `release-detail/` (D-13) — deliberately deferred; sharing risks a visual delta.
- Full characterization test for `ReleaseDetailPage` (D-14) — declined for this phase.
- Further splitting `IssuesSection` (IssuesTable/IssueRow/ProgressBar/MilestoneWarning) — deferred to Phase 89/90.
- `priority-stripe-rest-rank.md` todo — unrelated, matched only on generic keyword "phase".

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | `ReleaseDetailPage.tsx` (1518 LOC) decomposed into `release-detail/` folder mirroring `issue-detail/` precedent, zero user-visible behavior change | Verified line map (§1), props contract (§2), query verbatim inventory (§3), derived computation inventory (§4), `issue-detail/` convention audit (§5), MetaRow diff (§6), fetcher migration detail (§7), test surface (§8), refactor hazards (§9) all below directly enable a mechanical, safe split |
</phase_requirements>

---

## 1. Verified Line-Range Map

Source: `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`, 1518 LOC total (matches CONTEXT.md's stated LOC exactly).

| Region | CONTEXT.md D-01 claim | Actual (verified) | Delta / note |
|---|---|---|---|
| Imports + module-level fetchers | — | L1–138 | `fetchVersionIssueCounts` L68–96, `fetchFixVersionIssues` L100–138 |
| Component start / hooks / state | — | L142–648 | All state, queries, derived values, handlers (see §2–4) |
| Return / breadcrumb header | L653–700 (combined with name heading) | **Breadcrumb block is L653–682**, rendered **outside** the `isLoading`/`!version` ternary (unconditional once `trail.length > 0`) | D-01 merges two structurally different blocks — see hazard note below |
| Skeleton branch | — | L685–686 (`<ReleaseDetailSkeleton />`) | Renders when `isLoading \|\| !version` |
| "Header" (Rocket icon, version id, name) | (folded into 653–700 above) | **L692–699**, inside the ternary's else-branch, inside `<div className="p-6 space-y-6">` | Structurally separate from breadcrumb block — see Pitfall 1 |
| DescriptionsSection | L701–751 | **L701–750** (`</>` closes L750, section wrapper effectively ends before L751 blank) | Accurate within 1 line |
| LabelSummarySection | L752–776 | **L752–775** | Accurate within 1 line |
| IssuesSection (incl. table + Unmatched MRs) | Issues: L777–972, UnmatchedMRs: L973–1065 (implies siblings) | **Single `<section>` L778 to `</section>` L1064** — Unmatched MRs (comment at L973) is a **nested child**, not a sibling JSX element | **Structural correction — see Summary and Pitfall 1** |
| Action buttons | L1066–1103 | **L1066–1100** | Accurate |
| Right sidebar (Details + distributions) | L1104–1304 | **L1104–1303** (closing `</div>` at L1303) | Accurate |
| Edit modal | L1305–1480 | **L1306 (`Dialog.Root`) – L1479 (`</Dialog.Root>`)** | Accurate |
| Page-level closing tags | — | L1480–1484 | — |
| `MetaRow` local | — | **L1488–1495** | 8 lines, see §6 |
| `ReleaseDetailSkeleton` local | — | **L1499–1518** (file end) | 20 lines |

**Verdict:** CONTEXT.md's D-01 line ranges are directionally correct (off by at most a handful of lines) with one structural error worth flagging to the planner: **IssuesSection and UnmatchedMRsSection are not siblings in the JSX tree** — Unmatched MRs is rendered inside the same `<section>` as the Issues table (see hazard in §9 and Pitfall 1).

## 2. Props Contract Per Extracted Section

All values below are read directly from the component body (state, `useAuthStore`/`useSettingsStore`/`usePinnedTabsStore` selectors, query results, derived `const`s, and handler closures). This is the primary artifact for the planner — each row is a candidate prop.

### `ReleaseHeader.tsx` (breadcrumb L653–682 + heading L692–699)
Closes over: `trail` (from `useBreadcrumbStore`), `navigate`, `handleBack`, `version.name`/`version.id`.
**Hazard:** the breadcrumb block renders unconditionally (`trail.length > 0`), independent of `isLoading`/`version` — it must stay mounted through the skeleton state too, or breadcrumb navigation vanishes during loading. If extracted as one component, `ReleaseHeader` needs `version: FixVersion | null` (optional) so it degrades gracefully when `version` is not yet loaded, matching current behavior (`version?.name ?? 'Release'`).

Props needed: `trail`, `version` (nullable), `versionId`, `onBack: () => void`, `onBreadcrumbClick: (index: number) => void` (wraps `useBreadcrumbStore.setState` + `navigate`).

### `DescriptionsSection.tsx` (L701–750)
Reads: `gitlabMatch.type`, `matchedMilestone` (nullable), `version.description`, `matchedMilestone.description`.
No handlers, no local state. Pure presentational.

Props: `gitlabMatchType: ReleaseMatch['type']`, `matchedMilestone: GitLabMilestone | null`, `versionDescription: string | null`.

### `LabelSummarySection.tsx` (L752–775)
Reads: `milestoneMRs` (query result, used only for its truthiness/loaded gate), `labelSummary` (derived array).

Props: `milestoneMRsLoaded: boolean` (i.e., `milestoneMRs !== undefined`), `labelSummary: Array<{ label: {name, color, text_color}, count: number }>`.

### `IssuesSection.tsx` (L778–1064, includes nested Unmatched MRs — see §9)
Reads: `issueCounts`, `gitlabMatch`, `version.releaseDate`, `isLoadingIssues`, `matchedRows`, `wrongMilestoneByKey`, `unmatchedMRs`, `version.name`, `versionId`.
Handlers/closures: `seedReleaseBreadcrumb`, `onOpenIssue` (from `useOutletContext`), `openIssueFull`, `breadcrumbPush`, `navigate`, `extractTicketKeys` (imported util, not a closure).

Props: `issueCounts: {issuesFixed, issuesTotal} | undefined`, `gitlabMatchType`, `hasReleaseDate: boolean`, `isLoadingIssues: boolean`, `matchedRows: Array<{issue, mr}>`, `wrongMilestoneByKey: Map<string, GitLabMR>`, `unmatchedMRs: GitLabMR[]`, `versionId: string`, `versionName: string`, `onOpenIssue: (key: string) => void` (already-resolved callback: `onOpenIssue ?? openIssueFull`), `onSeedBreadcrumb: () => void`, `onNavigateToIssueFromMR: (key: string) => void` (the breadcrumbPush+navigate closure used inside the Unmatched MRs ticket-key buttons at L1017–1027).

**If `UnmatchedMRsSection` is split out per D-01/D-02's guidance** it must be a child called from within `IssuesSection`'s JSX (inside the same `<section>` element) — see Pitfall 1. Its own props subset: `unmatchedMRs`, `versionId`, `versionName`, `onNavigateToIssueFromMR`.

### `ReleaseDetailSidebar.tsx` (L1104–1303)
Reads: `width`, `isDragging`, `handleMouseDown`, `handleHovered`/`setHandleHovered`, `startEditing`, `version` (released, releaseDate), `gitlabMatch`, `milestoneMRs`, `labelCoverage`, `mrStateCounts`, `releaseMrs.length`, `releaseIssues.length`, `issueStatusCounts`, `hasStoryPoints`, `storyPoints`.

Props: `width: number`, `isDragging: boolean`, `onResizeMouseDown: (e) => void`, `handleHovered: boolean`, `setHandleHovered: (b: boolean) => void`, `onStartEditing: () => void`, `version: FixVersion`, `gitlabMatch: ReleaseMatch`, `milestoneMRsLoaded: boolean`, `labelCoverage: LabelCoverage | null`, `mrStateCounts: {merged, opened, closed}`, `hasMrs: boolean` (`releaseMrs.length > 0`), `hasIssues: boolean` (`releaseIssues.length > 0`), `issueStatusCounts: {new, indeterminate, done}`, `hasStoryPoints: boolean`, `storyPoints: {total, completed}`.

**Note:** this component also owns the drag-handle `<div>` (L1109–1116) which uses `useResizable`'s `handleMouseDown` — the hook itself (`useResizable`) should stay called in the page shell (it needs `containerRef` which wraps both columns, L170 `containerRef.current?.offsetWidth`), only its outputs (`width`, `isDragging`, `handleMouseDown`) pass down as props.

### `EditReleaseModal.tsx` (L1306–1479)
Reads/writes: `editing`, `editName`, `editDate`, `editDescription`, `editReleased`, `editMilestoneTitle`, `editMilestoneDescription`, `jiraError`, `gitlabError`, `isSaving`, `matchedMilestone`, `gitlabMatch.type`, `isEditDirty`, `isMilestoneTitleInvalid`.
Handlers: `cancelEditing`, `handleSave`.
Setters used directly in JSX: `setEditName`, `setEditDate`, `setEditDescription`, `setEditReleased`, `setEditMilestoneTitle`, `setEditMilestoneDescription`.

Props (heaviest section — 6 controlled fields + 2 setters-worth-of-callbacks + 2 error strings + 3 booleans + save/cancel handlers): `open: boolean`, `onOpenChange: (o: boolean) => void`, `editName`, `setEditName`, `editDate`, `setEditDate`, `editDescription`, `setEditDescription`, `editReleased`, `setEditReleased`, `editMilestoneTitle`, `setEditMilestoneTitle`, `editMilestoneDescription`, `setEditMilestoneDescription`, `isSaving`, `jiraError`, `gitlabError`, `showMilestoneSection: boolean` (`gitlabMatch.type !== 'none' && !!matchedMilestone`), `isSaveDisabled: boolean` (precomputed from `isSaving || !editName.trim() || !isEditDirty || isMilestoneTitleInvalid`), `onCancel`, `onSave`.

Given the field count, the planner may reasonably choose to keep all `edit*`/`setEdit*` state + `startEditing`/`cancelEditing`/`buildJiraDiff`/`buildGitlabDiff`/`isEditDirty`/`isMilestoneTitleInvalid`/`handleSave` **together as a co-located `useEditRelease` hook** (D-07 only mandates the 6 `useQuery` calls move into `useReleaseDetail`; it does not forbid a second hook for edit-modal state). This is Claude's discretion territory (D-01's file list is "guidance, not contract").

### `MetaRow.tsx` / `ReleaseDetailSkeleton.tsx`
No props contract issue — trivial, self-contained (see §6 for the MetaRow diff).

## 3. The 6 `useQuery` Calls, Verbatim

All six, in file order, with exact key/staleTime/enabled/queryFn as written today:

**1. `fixVersions` (L201–210)**
```ts
queryKey: ['jira-fix-versions', activeJiraProject]
staleTime: 5 * 60_000
enabled: !!jiraBaseUrl && !!activeJiraProject
queryFn: async () => { token = await readSecret('jira-pat').catch(()=>null); if(!token||!jiraBaseUrl||!activeJiraProject) throw new Error('No credentials'); return fetchFixVersions(jiraBaseUrl, token, activeJiraProject); }
```
**Cross-check:** `ReleasesTab.tsx:139` uses identical key `['jira-fix-versions', activeJiraProject]` and `UpcomingReleasesTimeline.tsx:72` also uses `['jira-fix-versions', activeJiraProject]`. **Must move verbatim** — confirmed shared cache contract (D-11).

**2. `issueCounts` (L216–225)**
```ts
queryKey: ['jira-version-counts', versionId]
staleTime: 5 * 60_000
enabled: !!jiraBaseUrl && !!versionId
queryFn: async () => { token = await readSecret('jira-pat').catch(()=>null); if(!token||!jiraBaseUrl||!versionId) throw new Error('No credentials'); return fetchVersionIssueCounts(jiraBaseUrl, token, versionId); }
```
**Cross-check:** `ReleasesTab.tsx:185` (inside a `useQueries` map) uses `['jira-version-counts', v.id]` — same prefix, `v.id` === `versionId` on this page. **Shared — verbatim required.**

**3. `milestones` (L242–259)**
```ts
queryKey: ['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]
queryFn: () => fetchProjectMilestonesInRange(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0, milestoneWindow?.from ?? '', milestoneWindow?.to ?? '')
enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && milestoneWindow !== null
staleTime: 5 * 60_000
```
**Cross-check:** `UpcomingReleasesTimeline.tsx:164–169` uses the identical key shape `['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]` (its own locally-computed `milestoneWindow`, spanning ALL fix versions rather than one). **Key prefix/shape shared — verbatim required**; the `milestoneWindow` computation itself is page-local (see §4) and differs in scope between the two components (this page computes it for one version; the timeline computes it across all versions) — that divergence is intentional and pre-existing, not something this phase should touch.

**4. `fixVersionIssues` (L311–320)**
```ts
queryKey: ['jira-fixversion-issues', versionId, storyPointsFieldKey]
staleTime: 5 * 60_000
enabled: !!jiraBaseUrl && !!versionId
queryFn: async () => { token = await readSecret('jira-pat').catch(()=>null); if(!token||!jiraBaseUrl||!versionId) throw new Error('No credentials'); return fetchFixVersionIssues(jiraBaseUrl, token, versionId, storyPointsFieldKey); }
```
**Cross-check:** Neither `ReleasesTab.tsx` nor `UpcomingReleasesTimeline.tsx` uses this key. `UpcomingReleasesTimeline.tsx:89` uses a **different** key, `['jira-release-issues', activeJiraProject, v.name]`, for a different purpose. **Not shared** — no cross-component constraint, but still move verbatim per D-11's general instruction (no reason to change it).

**5. `milestoneMRs` (L323–335)**
```ts
queryKey: ['gitlab-milestone-mrs', activeGitlabProject, gitlabMatch.candidateName]
queryFn: () => fetchMilestoneMRs(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0, gitlabMatch.candidateName)
staleTime: 5 * 60_000
enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && gitlabMatch.type !== 'none'
```
**Cross-check:** Not found in `ReleasesTab.tsx` or `UpcomingReleasesTimeline.tsx` (grep confirms neither file references `gitlab-milestone-mrs`). **Not shared**, but the page's own `handleSave` (L599) does `queryClient.invalidateQueries({ queryKey: ['gitlab-milestone-mrs', activeGitlabProject] })` — this invalidation call must also move with the hook and keep the same partial-key match.

**6. `recentProjectMRs` (L364–375)**
```ts
queryKey: ['gitlab-recent-project-mrs', activeGitlabProject]
queryFn: () => fetchRecentProjectMRs(gitlabBaseUrl ?? '', gitlabToken ?? '', activeGitlabProject ?? 0, 100)
enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && gitlabMatch.type !== 'none' && missingRows.length > 0
staleTime: 5 * 60_000
```
**Cross-check:** Not shared with the two other consumer files. Note the `enabled` guard depends on `missingRows`, itself derived from `matchedRows` (query 4's data) — this is a genuine intra-hook dependency chain that must be preserved when queries move into `useReleaseDetail.ts` (query 6 depends on the *output* of query 4 plus query 5's matching logic, not just static auth state).

**Additional invalidations tied to these queries (from `handleSave`, L590–600):** on Jira save success — invalidate `['jira-fix-versions', activeJiraProject]` and `['jira-version-counts', versionId]`; on GitLab save success — invalidate `['gitlab-milestones', activeGitlabProject]` and `['gitlab-milestone-mrs', activeGitlabProject]`. These four invalidation calls must move together with `handleSave` (or `useReleaseDetail`, wherever the save logic lands).

## 4. The ~7 Derived Computations

All read via direct source inspection. Confirmed: **all are genuinely React-free** (no hooks, no refs, no `useMemo`/`useEffect` — they are plain function-scope closures over query data and are recomputed every render, which is how they behave today; moving them into a pure module changes nothing about invalidation/memoization behavior since none exists today).

| Computation | Source lines | Inputs | Output | React-free? |
|---|---|---|---|---|
| `milestoneWindow` | L229–240 | `version?.releaseDate`, constant `MILESTONE_LEEWAY_DAYS=7` | `{from, to} \| null` | Yes — pure date arithmetic |
| `gitlabMatch` / `matchedMilestone` (IIFE) | L265–308 | `version?.releaseDate`, `milestones` (query data), `matchGitLabToFixVersion` (imported pure fn) | `{gitlabMatch: ReleaseMatch, matchedMilestone: GitLabMilestone \| null}` | Yes |
| `matchedRows` / `unmatchedMRs` (issue↔MR matching) | L338–355 | `fixVersionIssues`, `milestoneMRs`, `linkMRToTask` (imported) | `matchedRows: {issue, mr}[]`, `unmatchedMRs: GitLabMR[]` | Yes |
| `wrongMilestoneByKey` | L377–392 | `matchedMilestone`, `recentProjectMRs`, `missingRows` (derived from `matchedRows`), `linkMRToTask` | `Map<string, GitLabMR>` | Yes |
| `labelSummary` | L394–412 | `releaseMrs` (= `milestoneMRs ?? []`) | sorted `{label, count}[]` | Yes |
| `labelCoverage` | L415–424 | `releaseMrs` | `{total, labeled, unlabeled, allLabeled} \| null` | Yes |
| `mrStateCounts` | L427–438 | `releaseMrs` | `{merged, opened, closed}` | Yes |
| `issueStatusCounts` | L441–451 | `releaseIssues` (= `fixVersionIssues ?? []`) | `{new, indeterminate, done}` | Yes |
| `issueStoryPoints` (fn) + `storyPoints` + `hasStoryPoints` | L453–475 | `releaseIssues`, `storyPointsFieldKey` (settings value, passed as arg — not a hook read inside the function) | `issueStoryPoints: (issue) => number\|null`, `storyPoints: {total, completed}`, `hasStoryPoints: boolean` | Yes |

That's 9 named derived values in total (CONTEXT.md's "~7" undercounts slightly — `gitlabMatch`/`matchedMilestone` and `matchedRows`/`unmatchedMRs`/`wrongMilestoneByKey` are compound outputs of two additional IIFEs not explicitly named in D-09's list). **Recommendation:** include all of these — plus `milestoneWindow`, `labelSummary`, `labelCoverage`, `mrStateCounts`, `issueStatusCounts`, `issueStoryPoints`, `storyPoints`, `hasStoryPoints` — as exported pure functions from `releaseSummaries.ts`, taking their current closure inputs as explicit function parameters. Note `releaseMrs`/`releaseIssues`/`releaseIssueKeySet`/`releaseMrByIssue` (L338–342) are simple `??[]` normalizations and intermediate matching state, not independently meaningful "computations" — they can stay as local `const`s inside `useReleaseDetail` or become the first lines of the `matchedRows`/`unmatchedMRs` pure function.

## 5. `issue-detail/` Convention Audit

Verified against `taskflow/src/routes/dashboard/issue-detail/` (43 files) and `IssueDetailContent.tsx` (535 LOC, the page-shell precedent):

- **File naming:** PascalCase per component (`FieldsSection.tsx`, `MergeRequestsSection.tsx`), camelCase for pure-util/hook files (`useAuthBlob.ts`, `useFieldMutation.ts`, `utils.ts`, `aggregateTimeTracking.ts`).
- **Export style:** **Named exports throughout**, never `export default`. Confirmed via grep across the whole folder — every component is `export function ComponentName(...)`.
- **Prop typing style:** **`interface XxxProps { ... }` declared immediately above the component**, not inline destructured types, not `type` aliases. 20+ files confirmed with this pattern (`ActivityTimelineProps`, `FieldsSectionProps`, `MergeRequestsSectionProps`, `IssueDetailSidebarProps`, etc.). One exception: `SubtasksSection`/`DescriptionSection` take zero props (empty parens), consistent with the interface-when-needed rule.
- **How `IssueDetailContent.tsx` delegates:** imports section components directly by relative path (`import { AttachmentsSection } from './issue-detail/AttachmentsSection'`, `import { LogWorkPopover } from './issue-detail/LogWorkPopover'`, `import { SubtasksSkeleton } from './issue-detail/SubtasksSkeleton'`) — **not** via the barrel `index.ts` (confirms D-05's direct-path guidance is exactly what the precedent does).
- **`issue-detail/index.ts` actual exports (2, verified):**
  ```ts
  export { IssueDetailSidebar } from './IssueDetailSidebar';
  export { extractSprintName } from './utils';
  ```
  Despite 43 files in the folder, only these two are barrel-exported — everything else (including `MetaRow`, `FieldsSection`, `MergeRequestsSection`) is imported by other files via direct relative path, confirming the "thin barrel" convention applies even to files used by multiple siblings.
- **Placeholder pattern (relevant if a similarly-empty component is ever needed):** `issue-detail/DescriptionSection.tsx` (13 lines) is a documented no-op placeholder returning `null`, with a comment explaining why — this is NOT a pattern to imitate here per D-16 (no speculative files); noted only for completeness since it exists in the precedent folder.
- **Sub-component composition:** `IssueDetailSidebar.tsx` (122 LOC) imports and composes `FieldsSection`, `LinkedIssuesSection`, `MergeRequestsSection`, plus hooks `useFieldMutation`, `useLinkedMRs` — directly mirrors what `ReleaseDetailSidebar.tsx` should do for its own sub-blocks (MR-state/issue-status/story-point `MetaRow` blocks can stay inline in `ReleaseDetailSidebar.tsx` rather than each becoming its own file, matching `IssueDetailSidebar`'s granularity).

## 6. `MetaRow` Diff

**Not byte-identical — confirmed delta:**

Local (`ReleaseDetailPage.tsx` L1488–1495):
```tsx
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}
```

`issue-detail/MetaRow.tsx`:
```tsx
export function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
```

**Delta:** the release page's local version has `className="flex-1 min-w-0"` on the value `<span>`; `issue-detail`'s has `className="flex-1"` (no `min-w-0`). Everything else — element structure, label span classes, prop signature, inline-typed props (not an `interface`, unlike the rest of `issue-detail/`) — is identical. This single class difference changes overflow/truncation behavior for long content in the value slot, which is exactly the kind of visual delta D-13 anticipated. **Verdict: keep `release-detail/MetaRow.tsx` as its own file with `min-w-0` preserved — do not share with `issue-detail/MetaRow.tsx`.** (Also note: `issue-detail/MetaRow.tsx` uses `export function` directly, no separate `interface` — the release-detail copy should follow the same inline-prop-type style since it's the smaller, near-trivial component, consistent with treating it as a private copy rather than importing the `issue-detail` version's convention wholesale.)

## 7. The Two Inline Jira Fetchers

**`fetchVersionIssueCounts`** (L68–96): `(baseUrl: string, token: string, versionId: string) => Promise<VersionIssueCounts>`. Validates `versionId` is numeric via regex, builds two JQL queries (total + done-only) using `Promise.allSettled` with raw `fetch()` from `@tauri-apps/plugin-http`, silently defaults to `{total: 0}` on any per-request failure (no thrown error unless the URL itself is malformed) — **no auth-failure detection**, no `ApiError`, no timeout.

**`fetchFixVersionIssues`** (L100–138): `(baseUrl, token, versionId, storyPointsFieldKey) => Promise<JiraIssue[]>`. Paginates via `while(true)` loop with `startAt`/`maxResults=200`, requests both known story-point field keys plus the instance-resolved key (dedup'd via `Set`), throws a generic `Error` on non-OK response (`Failed to fetch issues: status ${status}`) — again using raw `fetch()`, no `apiFetch`, no `ApiError`, no timeout, no 401 detection.

**`services/jira.ts` convention they must conform to (verified):** 2561 LOC, **33 functions use `apiFetch('jira', url, init, operationLabel)`, zero use raw `fetch` directly** (`grep -c "apiFetch(" = 33`, `grep -c "  fetch(" = 0`). `apiFetch` (`src/lib/apiFetch.ts`) wraps the raw Tauri `fetch` with: (1) a hard 15-second `AbortController` timeout merged with any caller-supplied signal, (2) automatic `markDisconnected(source)` on any `401` response, (3) optional dev-tools instrumentation (request/response capture, redacting `Authorization`/`PRIVATE-TOKEN` headers) gated behind `useSettingsStore.getState().devToolsEnabled` — when devtools are off, `apiFetch` is a near-transparent pass-through except for the timeout and 401-marking, both of which are new behavior relative to the current inline fetchers.

Existing `fetchFixVersions` (the neighboring, already-correct function in `jira.ts`, L1099–1134) demonstrates the target pattern: `try { response = await apiFetch('jira', url, {headers...}, 'Load Releases') } catch { throw new Error(...) }`, then checks `response.ok`, extracts `errorMessages` from the Jira error body, and throws `ApiError` specifically on 401/403, plain `Error` otherwise.

**This is a genuine tension for the planner, not a mechanical no-op:** D-12 says "behavior, auth handling, and error shape must be identical" but every sibling function in the destination file uses `apiFetch`. Recommendation (see Pitfall 2): use `apiFetch` for consistency and treat the added timeout/401-detection as a net-positive, low-risk behavior change explicitly called out in the plan (not silently introduced) — or, if strict byte-for-byte behavior preservation is required, keep raw `fetch()` inside the moved functions and accept the (cosmetic-only) convention inconsistency. Either choice is defensible; it must be a stated decision, not an accident.

## 8. Test Surface

**Runner:** Vitest (`"test": "vitest run"`, `"test:watch": "vitest"` in `package.json`), config at `taskflow/vitest.config.ts`. Standard `describe`/`it`/`expect`/`vi` from `'vitest'`, `@testing-library/react`'s `render`/`screen`, wrapped in `QueryClientProvider` + `MemoryRouter`.

**`ReleasesTab.test.tsx`** (408 LOC): mocks `@/services/stronghold` (`readSecret`), `@/services/jira` (`fetchFixVersions`), `@/services/gitlab` (`fetchProjectMilestonesInRange`, `fetchProjectTags`), `@/services/releaseLinker` (`matchGitLabToFixVersion`), `@/stores/auth.store`, and **`@tauri-apps/plugin-http`'s `fetch`** directly (mocked to return `{ok: true, json: async () => []}`) — this last mock is what `fetchVersionIssueCounts` calls internally today via `useQueries`; **if this fetcher moves to `apiFetch()`, this raw-fetch mock in `ReleasesTab.test.tsx` still works** because `apiFetch` itself calls the underlying `@tauri-apps/plugin-http` `fetch` — no test-mock rewrite needed either way. Covers: empty state, row rendering, exact/fuzzy/no GitLab match indicators, task count/completion badges, sort order (newest-to-oldest), status badges, timing labels (overdue/due-today/in-X-days).

**`UpcomingReleasesTimeline.test.tsx`** (383 LOC): covers dot-count capping (2/3/>3 → sliced to 3), empty states, "Tomorrow"/"Today"/"in N days" labels, `role="region" aria-label="Upcoming releases"` accessibility, `{donePct}% ready` rendering.

**No test currently covers `ReleaseDetailPage` itself** — confirmed by grep (no `ReleaseDetailPage.test.tsx` exists, and D-15 states this explicitly).

**Pure-module test precedent:** `src/services/releaseLinker.test.ts` — plain `describe`/`it` blocks, no React/render/mocking needed since `matchGitLabToFixVersion` is pure. This is the exact style `release-detail/releaseSummaries.test.ts` should follow: no `render()`, no `QueryClientProvider`, just direct function calls and `expect(...)`.

**Concrete edge cases for `releaseSummaries.test.ts`** (per D-14, cross-checked against actual function bodies):
- `labelSummary`: empty MR list → `[]`; MRs with no labels → labels absent from map; tie-break sort (equal counts → alphabetical by `label.name`, confirmed by `.sort((a,b) => b.count-a.count || a.label.name.localeCompare(b.label.name))`).
- `labelCoverage`: zero MRs → `null` (not `{total:0,...}` — confirmed by `if (releaseMrs.length === 0) return null` guard at L416); zero MRs carry labels → `allLabeled: false`, `unlabeled` = all MRs.
- `mrStateCounts`: exhaustive fold — `merged`/`opened`/everything else (including `closed` and `locked`) → `closed` bucket; verify a `locked`-state MR lands in `closed`.
- `storyPoints`/`hasStoryPoints`: SP field `null`/`undefined`/non-number on some issues → excluded from `total` (guarded by `typeof sp === 'number'`); `hasStoryPoints` requires `sp > 0` (a `0` value does not count as "has story points" — confirmed at L472–475, worth an explicit test since it's a subtle `>0` not `!== null` check).
- `issueStatusCounts`: unknown/out-of-union `statusCategory.key` → falls back to `new` bucket (confirmed by the `else` branch at L448).
- `milestoneWindow`: month-boundary date arithmetic (e.g., `releaseDate` near end-of-month, `addDays(-7)` crossing into the previous month) — uses native `Date.setDate()`/`toISOString().slice(0,10)`, so standard JS date rollover applies; also test `null` when `version.releaseDate` is absent.

## 9. Refactor Hazards

1. **IssuesSection / UnmatchedMRsSection are not siblings (verified structural error in D-01's guidance)** — see §1. Extracting `UnmatchedMRsSection.tsx` as a file is fine; rendering it as a **sibling of `IssuesSection`** in the page shell (rather than a child called from inside `IssuesSection`'s JSX) will move it outside the `<section>` wrapper and change the DOM structure (and CSS descendant-selector behavior, e.g. `border-t border-border/50` spacing that currently relies on `mt-4 pt-4` inside the same flow). **This is the single highest-risk mechanical-extraction trap in the phase.**

2. **`apiFetch` vs raw `fetch` for the two moved fetchers** — see §7. Not mechanical; requires an explicit plan decision.

3. **`useOutletContext<{onOpenIssue, ...}>()`** (L147–148) — only called once, in the page shell. `onOpenIssue` is destructured with a fallback (`?? {}`) and passed down to `IssuesSection` as a resolved callback; the section itself should receive `(onOpenIssue ?? openIssueFull)` pre-computed, not the raw context, to avoid re-deriving `useOutletContext` inside child components (which changes nothing functionally but would be non-mechanical/inconsistent with D-08's "presentational, no data fetching" — reading route context counts as the same category of concern).

4. **`useParams`/`useNavigate`** — used both in the shell (routing) and inside handler closures passed to `IssuesSection`/`UnmatchedMRsSection` (`openIssueFull`, the ticket-key click handler at L1017–1027 that does `breadcrumbPush` + `navigate`). These closures should be constructed once in the shell (or in `useReleaseDetail`) and passed down as already-bound callbacks — do not re-import `useNavigate` into presentational sections, since D-08 mandates presentational-only sections and mixing routing hooks into leaf components breaks that discipline even though it would still "work."

5. **`useBreadcrumbStore` seeding (`seedReleaseBreadcrumb`, L620–634)** — reads `useBreadcrumbStore.getState()` directly (not the reactive hook) specifically to avoid a stale-closure trail read; this function is called from inside `IssuesSection`'s row-click handler AND from inside the Unmatched-MR ticket-key handler. Keep it as a single shared closure passed down, not duplicated per section.

6. **`usePinnedTabsStore` pin toggle** (L161–165, used at L1072–1090 in the Action Buttons block) — five separate selector reads (`pinnedKeys.includes`, `togglePin`, `removePin`, `setPinnedReleaseMeta`, `clearReleaseMeta`). If Action Buttons moves into `ReleaseHeader` per D-03's "planner's call," all five must move together — don't split the toggle-read from the toggle-actions.

7. **`useResizable` ref** (L170–177) — `containerRef` is attached to the **outer flex container that wraps BOTH the left column and the sidebar** (L688 `<div ref={containerRef} className="flex flex-1 overflow-hidden">`), not to the sidebar alone. It must stay declared in the page shell (or `useReleaseDetail`, if hooks are willing to return a ref — refs from hooks are fine, this isn't a query). Only `width`/`isDragging`/`handleMouseDown` need to reach `ReleaseDetailSidebar`; `containerRef` itself must stay attached to the shell's wrapping div, which the sidebar does not own.

8. **`readSecret('gitlab-pat')` in a `useEffect`** (L180–186) — depends only on `[gitlabBaseUrl]`, sets local `gitlabToken` state used by 4 of the 6 queries. This is a genuine `useEffect` (not a query) and must be preserved as-is inside `useReleaseDetail` — do not convert it to a `useQuery` (would change caching/loading semantics) or move it into a section (violates D-08).

9. **Hook-order / early-return risk:** `if (!versionId) return null;` at L649, placed **after** all hooks (queries, `useEffect`, `useResizable`) but **before** the JSX return. This ordering is already correct (all hooks run unconditionally before the guard) — the hazard is purely for the *executor*: when reorganizing code into `useReleaseDetail.ts`, do not move any hook call below a conditional, and do not turn this early-return into something that could execute before a hook in the new file structure.

10. **`readSecret` calls duplicated across all 3 Jira queries + 1 in the `useEffect` (GitLab) + 2 more inside `handleSave`** — each `queryFn` independently does `await readSecret('jira-pat').catch(() => null)`. This repetition is pre-existing and out of scope to consolidate (D-16 forbids speculative restructuring); just move each occurrence with its owning query/handler, don't invent a shared token-fetch abstraction in this phase.

11. **`storyPointsFieldKey` is a Zustand selector value** (`useSettingsStore((s) => s.storyPointsFieldKey)`, L157), used both as a query-key member (query 4) and as a parameter to the pure `issueStoryPoints` function (§4). It must be read once in `useReleaseDetail` and threaded through to both the query and the pure-function calls — don't re-select it inside `releaseSummaries.ts` (that module must stay React-free per D-09, so it cannot call `useSettingsStore` itself; it must receive `storyPointsFieldKey` as a function argument, which the current code already does correctly at L456–458).

## Pre-existing Baseline Note

`npm run check` (biome check + tsc) was run against the current `main` HEAD **before any Phase 87 changes**: `tsc --noEmit` is fully clean (zero output). `biome check ./src` reports **2 pre-existing formatting errors**, both in files **unrelated to this phase**:
- `src/routes/dashboard/BacklogPage.tsx`
- `src/routes/dashboard/BacklogRow.tsx`

Both are biome-format diffs (not lint/type errors), pre-dating this phase and outside `ReleaseDetailPage.tsx`/`release-detail/`/`jira.ts`. **The planner and executor should treat these 2 errors as a known baseline deviation, NOT as regressions introduced by Phase 87.** The phase's own quality gate should verify `npm run check` introduces **zero new** errors/warnings relative to this 2-error baseline, rather than expecting a fully clean 0-error run. (Prior project memory recorded the baseline as "GREEN" as of 2026-05-31 — that has since drifted; this research reflects the current, verified state as of 2026-08-10.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jira REST fetch plumbing with auth/timeout/error handling | A new bespoke fetch wrapper for the two moved fetchers | `apiFetch()` from `@/lib/apiFetch` (already used by all 33 other `jira.ts` functions) | Consistency, timeout safety, 401 detection, devtools instrumentation — all already solved |
| Cross-component query cache key stability | Renaming/restructuring query keys "for clarity" while moving them | Copy keys verbatim (D-11) | A changed key silently breaks cache sharing with `ReleasesTab`/`UpcomingReleasesTimeline` — no compile-time or test-time signal would catch this except the two consumer test suites, which don't exercise this page directly |
| Pure function extraction | Wrapping derived computations in `useMemo` "for performance" during the move | Plain exported functions, called directly | None of the 7–9 computations are currently memoized; adding memoization now is scope creep beyond "zero behavior change" and D-16's mirror-only mandate |

**Key insight:** This phase's biggest risk is not missing behavior — it's *accidentally changing* DOM/JSX nesting (Pitfall 1) or fetch semantics (Pitfall 2) while doing what looks like a pure copy-paste move.

## Runtime State Inventory

Not applicable — this is a structural code refactor with no renamed identifiers referenced by external state (no database keys, service configs, OS registrations, or secrets reference `ReleaseDetailPage` or its internal function/variable names). Query cache keys are the one piece of "state" that must not change, and that is covered exhaustively in §3 (not a rename/migration concern — the keys are staying the same strings, only the code location that declares them moves).

## Environment Availability

Skipped — this phase has no external tool/service dependencies beyond what's already installed and verified working in the existing codebase (Node/npm toolchain, Vitest, Biome, TypeScript — all already in active use, confirmed by successfully running `npm run check` and `npx tsc --noEmit` during this research session).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest run`), confirmed in `taskflow/package.json` |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm test -- ReleasesTab.test.tsx UpcomingReleasesTimeline.test.tsx releaseSummaries.test.ts` (run from `taskflow/`) |
| Full suite command | `npm test` (from `taskflow/`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 (SC1: identical render/data/interactions) | No visible regression | manual UAT + existing suite pass | `npm test` (from `taskflow/`) then manual click-through | ✅ existing suites exist; manual step is unavoidable per D-14 |
| FOUND-01 (SC2: folder structure matches `issue-detail/`) | Structural convention compliance | typecheck + code review | `npx tsc --noEmit` + `npx biome check ./src` (from `taskflow/`) | ✅ tooling exists |
| FOUND-01 (SC3: full suite passes, incl. `ReleasesTab`/`UpcomingReleasesTimeline`) | Zero regressions in shared-cache consumers | unit/integration | `npm test -- ReleasesTab.test.tsx UpcomingReleasesTimeline.test.tsx` (from `taskflow/`) | ✅ both files exist and pass today |
| D-09 (pure derived logic) | Extracted computations behave identically | unit | `npm test -- releaseSummaries.test.ts` (from `taskflow/`) | ❌ Wave 0 — new file, see gaps below |

### Sampling Rate
- **Per task commit:** run the touched test file(s) directly, e.g. `npm test -- releaseSummaries.test.ts` (from `taskflow/`)
- **Per wave merge:** `npm run check` (biome + tsc) from `taskflow/`, plus `npm test -- ReleasesTab.test.tsx UpcomingReleasesTimeline.test.tsx`
- **Phase gate:** Full suite (`npm test`) green, `npm run check` shows **zero new** errors/warnings beyond the pre-existing 2-error `BacklogPage`/`BacklogRow` baseline (see Pre-existing Baseline Note above), plus a manual click-through of `/release/:versionId` covering: loading skeleton → loaded state, description rendering (both Jira-only and Jira+GitLab-matched cases), label summary, issues table with all 4 MR-match states (matched/none/wrong-milestone/missing), unmatched MRs list, sidebar metadata (all `MetaRow` variants), edit modal open/edit/save (both partial-failure paths), pin/unpin, resizable sidebar drag.

### Wave 0 Gaps
- [ ] `taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts` — new file, covers all edge cases listed in §8 (this is the phase's primary test-value artifact per D-14's rationale)
- [ ] No new test-framework install needed — Vitest, `@testing-library/react`, `MemoryRouter`/`QueryClientProvider` mocking patterns all already present and demonstrated in `ReleasesTab.test.tsx`/`UpcomingReleasesTimeline.test.tsx`/`releaseLinker.test.ts`

## Security Domain

Not applicable in the ASVS sense — this phase touches no new authentication, session, or input-validation surface. The two moved fetchers already use PAT-based Bearer auth (unchanged) and existing `versionId` regex validation (`/^\d+$/`, preserved verbatim per D-12). No new attack surface is introduced by a pure structural move. If `apiFetch` is adopted (see Pitfall 2), the resulting behavior is a **security improvement** (automatic disconnect-on-401 detection), not a regression.

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — full 1518-line read, line-range map, props contract, query inventory, derived computations, hazards
- `taskflow/src/routes/dashboard/issue-detail/` (43 files) — convention audit (export style, prop typing, index.ts barrel contents)
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — page-shell delegation pattern
- `taskflow/src/routes/dashboard/issue-detail/MetaRow.tsx` — MetaRow diff
- `taskflow/src/services/jira.ts` (2561 LOC) — `apiFetch` usage count (33/33), `fetchFixVersions` as target-pattern example
- `taskflow/src/lib/apiFetch.ts` — instrumented fetch wrapper behavior (timeout, 401 handling, devtools instrumentation)
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — query key cross-check, test mock conventions
- `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx` — query key cross-check
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx`, `UpcomingReleasesTimeline.test.tsx` — test surface, assertions, mocking conventions
- `taskflow/src/services/releaseLinker.test.ts` — pure-module test style precedent
- `taskflow/package.json`, `taskflow/vitest.config.ts` — test runner / quality-gate commands
- Live execution: `npm run check`, `npx tsc --noEmit`, `npx biome check ./src` (this session, 2026-08-10) — pre-existing baseline confirmation

### Secondary / Tertiary
None — this phase required zero external/web research per its scope (pure internal structural refactor, no new libraries or APIs).

## Metadata

**Confidence breakdown:**
- Line-range map: HIGH — directly read and cross-verified against CONTEXT.md's claims
- Props contracts: HIGH — every closure variable traced to its declaration
- Query verbatim inventory + cross-checks: HIGH — grepped all 3 consumer files directly
- Derived computations: HIGH — read every computation's full body
- `issue-detail/` conventions: HIGH — read multiple representative files across the folder
- MetaRow diff: HIGH — byte-level comparison performed
- Fetcher migration: HIGH (facts) / the recommendation itself is a judgment call flagged as an open decision, not asserted as fact
- Test surface: HIGH — read actual test files and executed the test/check commands
- Refactor hazards: HIGH — each hazard traced to specific line numbers in the source

**Research date:** 2026-08-10
**Valid until:** Effectively indefinite for a structural-refactor research doc tied to a specific commit — re-verify line numbers if `ReleaseDetailPage.tsx` changes before this phase is planned/executed (check `git log -1 --format=%H -- taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` against this research's basis).
