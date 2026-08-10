# Phase 89: Three-Channel Drift Detection - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 9 (2 new, 5 modified, 1 deleted, 1 new test)
**Analogs found:** 9 / 9 (all files have a same-repo analog — this phase is entirely a "reshape existing patterns" phase per RESEARCH.md)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `taskflow/src/services/gitlab.ts` — `GitLabMR` interface widen (`target_branch`, `draft`) | model (interface) | — | `GitLabMRDetail` (`gitlab.ts:446-458`) — already declares both fields | exact (copy the two field declarations verbatim) |
| `taskflow/src/services/gitlab.ts` — new `fetchBranchTargetedMRs` | service (fetcher) | CRUD (read, paginated) | `fetchMilestoneMRs` (`gitlab.ts:1434-1530`) | exact — same loop, same enrichment pass, swap query param |
| `taskflow/src/services/gitlab.ts` — new `fetchAllProjectMRs` | service (fetcher) | CRUD (read, paginated) | `fetchMilestoneMRs` (`gitlab.ts:1434-1530`) | exact — same loop shape, no filter param, state=all |
| `taskflow/src/services/gitlab.ts` — new `fetchOpenProjectMRs` (D-14 list-page fetch, `state=opened`) | service (fetcher) | CRUD (read, paginated) | `fetchMilestoneMRs` (`gitlab.ts:1434-1530`) | exact — same loop, no filter param, `state=opened`, likely skip label enrichment (Pattern 5) |
| `taskflow/src/services/gitlab.ts` — delete `fetchRecentProjectMRs` | service (fetcher) | — | n/a (deletion) | n/a |
| `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` (NEW) | utility (pure logic) | transform | `releaseSummaries.ts` (`matchIssuesToMRs`, `buildWrongMilestoneMap`) | exact — same file granularity, same React-free contract, same JSDoc header style |
| `taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts` (NEW) | test | — | `releaseSummaries.test.ts` | exact — same `makeMR`/fixture-builder + `describe/it` harness |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` (MODIFY: +3 queries, -1 query, wire union) | hook (query orchestration) | request-response | itself (existing `milestoneMRs` / `recentProjectMRs` queries, `gitlab-branch` query for the `enabled` guard shape) | exact — extend the same hook, same query-key/staleTime/enabled conventions already in file |
| `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` (NEW, absorbs `UnmatchedMRsSection.tsx`) | component (presentational section) | request-response (props-driven) | `UnmatchedMRsSection.tsx` (full file, 102 LOC) | exact — this is the stated starting point (D-02) |
| `taskflow/src/routes/dashboard/release-detail/UnmatchedMRsSection.tsx` (DELETE) | component | — | n/a (deletion, absorbed into `MrDriftSection.tsx`) | n/a |
| `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx` (MODIFY: MR cell L136-216 re-sourced; L224 rewired) | component (presentational section) | request-response | itself — visual treatment unchanged, only prop source changes | exact (self-analog) |
| `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` (MODIFY: delete `buildWrongMilestoneMap`) | utility (pure logic) | transform | itself | exact (self-analog, deletion only) |
| `taskflow/src/routes/dashboard/ReleasesTab.tsx` (MODIFY: +1 project-wide open-MR query, +D-15 indicator) | component + inline derivation | request-response | itself — the existing `releaseBranches` query (L192-207) and `branchMissing`/`branchPresent`/`milestoneMissing` derivation (L246-280) and D-15 reserved slot (L558-585) | exact (self-analog) |

## Pattern Assignments

### `taskflow/src/services/gitlab.ts` — `GitLabMR` interface widen

**Analog:** `GitLabMRDetail` (`gitlab.ts:446-458`), current `GitLabMR` (`gitlab.ts:425-438`)

**Current shape to extend** (`gitlab.ts:425-438`):
```typescript
export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  source_branch: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  author: { id: number; name: string; username: string; avatar_url: string };
  reviewers: Array<{ id: number; name: string; username: string }>;
  updated_at: string; // ISO 8601 UTC
  web_url: string;
  labels: GitLabLabel[]; // label objects with colors
  milestone: { id: number; title: string } | null;
}
```

**Fields to add** (copy exact declarations from `GitLabMRDetail`, `gitlab.ts:448` and `:451`):
```typescript
target_branch: string;
draft: boolean;
```

**IMPORTANT cleanup once added:** `GitLabMRDetail extends Omit<GitLabMR, 'labels' | 'milestone'>` (`gitlab.ts:446`) currently re-declares `target_branch: string;` (line 448) and `draft: boolean;` (line 451) independently. Once `GitLabMR` itself declares both, these become duplicate property errors — **remove them from `GitLabMRDetail`'s own body**, do not leave both declarations.

**Verification gate (RESEARCH A2):** confirm via a live authenticated `curl` (or the probe script at `.planning/phases/89-three-channel-drift-detection/probe.sh`) that GitLab's *list* endpoint actually returns `target_branch`/`draft` before trusting this — `GitLabMRDetail` only proves the *detail* endpoint returns them.

---

### `taskflow/src/services/gitlab.ts` — `fetchBranchTargetedMRs` (Channel C) and `fetchAllProjectMRs` (Channel A) and `fetchOpenProjectMRs` (D-14)

**Analog:** `fetchMilestoneMRs` (`gitlab.ts:1434-1530`) — the exact fully-paginated loop plus label enrichment to model all three on.

**Imports** (top of `gitlab.ts`, already present, no new imports needed):
```typescript
// gitlab.ts:16-17
import { ApiError } from '../lib/api-error';
import { apiFetch } from '../lib/apiFetch';
```

**Full pagination loop pattern to copy** (`gitlab.ts:1434-1530`, verbatim structure):
```typescript
export async function fetchMilestoneMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  milestoneTitle: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?milestone=${encodeURIComponent(milestoneTitle)}&state=all&per_page=${perPage}&page=${page}`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
        'Load Milestone MRs',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch milestone MRs', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch milestone MRs: status ${response.status}`);
    }

    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  // ... label-color enrichment pass (lines 1476-1527) — copy verbatim for
  // fetchBranchTargetedMRs and fetchAllProjectMRs (both may render labels
  // via the union). fetchOpenProjectMRs (D-14, list-page only) can SKIP this
  // enrichment — same rationale documented at fetchRecentProjectMRs:1548-1549
  // ("this consumer renders only milestone/iid/state/web_url, never labels").

  return allMRs;
}
```

**Swap point per new fetcher:**
- `fetchBranchTargetedMRs`: replace `?milestone=${encodeURIComponent(milestoneTitle)}&state=all` with `?target_branch=${encodeURIComponent(targetBranch)}&state=all`
- `fetchAllProjectMRs`: replace with `?state=all` (no filter param) — this is Channel A's local-match universe
- `fetchOpenProjectMRs` (D-14 list-page fetch): replace with `?state=opened` (no filter param), skip label enrichment per above

**Error-handling pattern is identical across all GitLab fetchers in this file** — 401/403 → `ApiError`, other non-ok → generic `Error`, network failure in the `try/catch` → `Error('Cannot reach ...')`. Reuse this three-way branch verbatim; do not invent new error shapes.

**Anti-pattern — do NOT model on these:**
- `fetchProjectMRs` (`gitlab.ts:1338-1423`) — single capped page, no loop.
- `fetchRecentProjectMRs` (`gitlab.ts:1557-1589`) — single page, `page=1` only, being deleted this phase (D-05). Do not resurrect its shape even as a "starting point."

---

### `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` (NEW pure module)

**Analog:** `releaseSummaries.ts` (full file, 322 LOC) — specifically `matchIssuesToMRs` (L114-135, Channel A's matching nucleus) and the now-deleted `buildWrongMilestoneMap` (L150-168, structurally the closest precedent for "scan MRs, build a Map keyed by issue/MR identity").

**Module header convention to copy** (`releaseSummaries.ts:1-18`):
```typescript
/**
 * Release summaries — pure derived computations for the release detail page.
 *
 * React-free: every function here takes explicit parameters and returns plain
 * data — no closures over component state, no hooks, no store reads. This
 * module exists so `ReleaseDetailPage.tsx` (and its future `useReleaseDetail`
 * hook) can call these as ordinary functions and so they are unit-testable in
 * isolation (see `releaseSummaries.test.ts`).
 * ...
 */
```
`driftDetection.ts` should open with an equivalent header: React-free contract statement, pointer to `driftDetection.test.ts`, and an explicit callout of D-10/D-11/D-12 as load-bearing (mirrors `releaseBranch.ts:10-26`'s "do not fix back toward literal requirement text" callout style).

**Imports pattern** (matches `releaseSummaries.ts:20-24`):
```typescript
import type { GitLabMilestone, GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { extractTicketKeys, linkMRToTask } from '@/services/linkEngine';
```

**Union-with-provenance pattern** — modeled on `matchIssuesToMRs`'s Map-building shape (`releaseSummaries.ts:114-135`):
```typescript
export function matchIssuesToMRs(
  releaseIssues: JiraIssue[],
  releaseMrs: GitLabMR[],
): { matchedRows: Array<{ issue: JiraIssue; mr: GitLabMR | null }>; unmatchedMRs: GitLabMR[] } {
  const releaseIssueKeySet = new Set(releaseIssues.map((i) => i.key));
  const releaseMrByIssue = new Map<string, GitLabMR>();
  const releaseUnmatched: GitLabMR[] = [];
  for (const mr of releaseMrs) {
    const matchedKey = linkMRToTask(mr, releaseIssueKeySet);
    if (matchedKey) {
      releaseMrByIssue.set(matchedKey, mr);
    } else {
      releaseUnmatched.push(mr);
    }
  }
  // ...
}
```
`unionMRs` should follow this same "build a Set/Map by iterating each source array once" shape (see RESEARCH.md Pattern 3 for the target signature — `Map<number, { mr: GitLabMR; channels: Set<'A'|'B'|'C'> }>` keyed by `mr.id`, not `iid`).

**Predicate function shape** — model on `computeMrStateCounts` (`releaseSummaries.ts:231-245`, exhaustive-bucket style) and `buildWrongMilestoneMap`'s per-MR condition (`releaseSummaries.ts:159-163`):
```typescript
// releaseSummaries.ts:159-163 — the closest existing "is this MR wrong for this release" predicate
const offending = recentProjectMRs.find(
  (mr) =>
    linkMRToTask(mr, keySet) !== null &&
    (mr.milestone == null || mr.milestone.id !== matchedMilestone.id),
);
```
`evaluateMilestoneDrift` is structurally this exact null-or-mismatch check, extracted into its own named function. Follow RESEARCH.md Pattern 4 for the three predicate signatures verbatim (`evaluateBranchDrift`, `evaluateMilestoneDrift`, `evaluateTaskDrift`) — they are the phase's primary new deliverable and are pre-specified in RESEARCH.md with D-10/D-11/D-12-aware bodies. Do not deviate from the `evaluateTaskDrift` two-reason return type (`'no-linked-task' | 'not-in-fix-version' | null`) — D-12 requires the tooltip to distinguish the two cases.

**State-classification gate** (Pitfall 2 in RESEARCH.md, load-bearing): `const isEvaluated = mr.state === 'opened';` — covers open AND draft (GitLab has no separate `'draft'` state value; `draft` is an independent boolean field per D-10). Do **not** add `if (mr.draft) return muted`. `locked` state groups with merged/closed as muted (Pitfall 3, discretionary but documented).

**Delete, do not modify-in-place:** `buildWrongMilestoneMap` (`releaseSummaries.ts:150-168`) — remove entirely from `releaseSummaries.ts` per D-05. Its JSDoc and the GGX-WARN-01 references in `useReleaseDetail.ts` (L303-327) go with it.

---

### `taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts` (NEW)

**Analog:** `releaseSummaries.test.ts` (full file read — fixture-builder pattern at lines 1-59)

**Fixture-builder pattern to copy verbatim** (`releaseSummaries.test.ts:14-30`):
```typescript
import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { /* driftDetection exports */ } from './driftDetection';

function makeMR(overrides: Partial<GitLabMR> = {}): GitLabMR {
  return {
    id: 1,
    iid: 1,
    project_id: 1,
    title: 'Fix thing',
    source_branch: 'fix-thing',
    state: 'opened',
    author: { id: 1, name: 'A', username: 'a', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-01-01T00:00:00Z',
    web_url: 'https://gitlab.example.com/mr/1',
    labels: [],
    milestone: null,
    ...overrides,
  } as unknown as GitLabMR;
}
```
**Extend this fixture** with `target_branch` and `draft` defaults (both new fields on `GitLabMR` per this phase) so every test case doesn't have to override them. `makeIssue` (`releaseSummaries.test.ts:32-59`) can be reused as-is for TASK-predicate tests.

**Test-name convention:** `vitest run driftDetection -t "..."` names from RESEARCH.md's requirements table map directly to `describe` blocks: `"Channel A"`, `"unionMRs"`, `"evaluateBranchDrift"`, `"evaluateMilestoneDrift"`, `"evaluateTaskDrift"`, `"state classification"`, `"countFlaggedMRs"`. Use these exact strings as `describe`/`it` titles so the documented `npm run test -- driftDetection -t "..."` commands in RESEARCH.md's Validation Architecture section work unmodified.

**Critical test case (Pitfall 2's own warning):** include a draft-MR test asserting it is FULLY EVALUATED (not muted) — RESEARCH.md explicitly says "a test asserting a draft MR renders `—` in all three columns should FAIL if D-10 is correctly implemented."

---

### `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` (MODIFY)

**Analog:** itself — extend the existing hook's own query conventions.

**Query shape to copy** (`useReleaseDetail.ts:283-296`, the `milestoneMRs` query — closest existing analog for a new scoped GitLab-MR query):
```typescript
const { data: milestoneMRs } = useQuery({
  queryKey: ['gitlab-milestone-mrs', activeGitlabProject, gitlabMatch.candidateName],
  queryFn: () =>
    fetchMilestoneMRs(
      gitlabBaseUrl ?? '',
      gitlabToken ?? '',
      activeGitlabProject ?? 0,
      gitlabMatch.candidateName,
    ),
  staleTime: 5 * 60_000,
  enabled:
    !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && gitlabMatch.type !== 'none',
});
```
Three new queries (Channel A, C, and — per D-16 — each independently `enabled`, eager on mount, `staleTime: 5 * 60_000`) follow this exact shape. Channel B is `milestoneMRs` itself, unchanged.

**Query-key convention (Pitfall 4/5 in RESEARCH.md, binding):**
- Channel A (`fetchAllProjectMRs`): key `['gitlab-all-project-mrs', activeGitlabProject]` — **project-scoped only, no versionId** (mirrors the fix at `useReleaseDetail.ts:98-104`'s `allProjectMilestones` query, which the file's own comment (`:93-97`) explains was fixed from a per-window key to a shared project-scoped one for the identical reason).
- Do **NOT** reuse `['gitlab-recent-project-mrs', activeGitlabProject]` (the deleted query's key, `useReleaseDetail.ts:311`) — stale cache entries under the old key must not silently serve capped data (Pitfall 5).
- Channel C (`fetchBranchTargetedMRs`): key `['gitlab-branch-mrs', activeGitlabProject, releaseBranchName]` — version-scoped via `releaseBranchName`, same pattern as the existing `gitlab-branch` query (`useReleaseDetail.ts:136`).

**`enabled` guard shape to copy** (`useReleaseDetail.ts:144-146`, the null-releaseBranchName gate):
```typescript
enabled:
  !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && releaseBranchName !== null,
```
Channel C's query needs this exact `releaseBranchName !== null` gate (D-18's degraded state — no matched milestone means no derivable branch name).

**Deletion:** remove the `recentProjectMRs` query (`useReleaseDetail.ts:309-321`), `wrongMilestoneByKey` derivation (`:323-327`), the `fetchRecentProjectMRs`/`buildWrongMilestoneMap` imports (`:10`, `:26`), and their entries in the hook's returned object (`:360` `wrongMilestoneByKey`, `:359` `missingRows` — verify `missingRows` isn't consumed elsewhere before removing).

**Invalidation convention (CR-02 lesson, load-bearing):** invalidate GitLab query caches at **project granularity**, never a windowed/versioned key — see the documented rationale at `useReleaseDetail.ts:237-246` (`createMilestoneMutation`'s `onSuccess`). This phase adds no new mutations, but if any future write touches Channel A/B/C caches, invalidate `['gitlab-all-project-mrs', activeGitlabProject]` / `['gitlab-milestone-mrs', activeGitlabProject]` / `['gitlab-branch-mrs', activeGitlabProject]` prefixes, not a windowed variant.

**WR-10 lesson (never `?? 0` a project id):** every new `queryFn` must follow the existing pattern of passing `activeGitlabProject ?? 0` only inside the disabled-until-defined guard — see `useReleaseDetail.ts:196-199`'s `createBranchMutation` explicit throw for the mutation-side version of this rule.

---

### `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` (NEW, absorbs `UnmatchedMRsSection.tsx`)

**Analog:** `UnmatchedMRsSection.tsx` (full file, 102 LOC) — explicitly the stated starting point per D-02.

**Full row markup to copy and generalize** (`UnmatchedMRsSection.tsx:36-97`):
```tsx
<div key={mr.id} className="flex items-center gap-2 text-sm py-1">
  <GitMerge className={/* state-color ternary */} />
  <button type="button" onClick={() => openUrl(mr.web_url)} className="text-xs font-mono hover:underline shrink-0">
    !{mr.iid}
  </button>
  <span className="line-clamp-1 text-xs text-muted-foreground">
    {/* extractTicketKeys-based linkification — see IIFE below */}
  </span>
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto shrink-0">
    <CachedAvatar url={mr.author.avatar_url} name={mr.author.name} size={20} />
    {mr.author.name}
  </span>
  <Badge variant="outline" className={/* state-color ternary */}>{mr.state}</Badge>
</div>
```

**Jira-key linkification IIFE to reuse verbatim** (`UnmatchedMRsSection.tsx:53-79`) — splits title text around `extractTicketKeys` matches, rendering each key as a clickable `<button>`:
```tsx
{(() => {
  const keys = extractTicketKeys(mr.title);
  if (keys.length === 0) return mr.title;
  const parts: React.ReactNode[] = [];
  let remaining = mr.title;
  for (const key of keys) {
    const idx = remaining.indexOf(key);
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <button key={key} type="button" onClick={(e) => { e.stopPropagation(); onNavigateToIssueFromMR(key); }} className="text-primary hover:underline font-mono">
        {key}
      </button>,
    );
    remaining = remaining.slice(idx + key.length);
  }
  if (remaining) parts.push(remaining);
  return parts;
})()}
```

**Section header pattern** (`UnmatchedMRsSection.tsx:20-33`):
```tsx
<div className="mt-4 pt-4 border-t border-border/50">
  <div className="flex items-center gap-1.5 mb-1">
    <Info className="size-3.5 text-blue-500" />
    <h4 className="text-sm font-medium">
      Unmatched MRs
      <Badge variant="secondary" className="ml-1.5 text-xs">{unmatchedMRs.length}</Badge>
    </h4>
  </div>
  <p className="text-xs text-muted-foreground mb-2">MRs in milestone not linked to any Jira task</p>
```
`MrDriftSection.tsx`'s heading follows this shape with UI-SPEC copy: heading `MR Drift`, subtitle `Merge requests linked to this release, checked against branch, milestone, and task`, aggregate badge `{n}` via the same `Badge variant="secondary"` pattern.

**Imports** (`UnmatchedMRsSection.tsx:1-7`):
```tsx
import { openUrl } from '@tauri-apps/plugin-opener';
import { GitMerge, Info } from 'lucide-react';
import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import type { GitLabMR } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';
```
Add `AlertTriangle` (for the D-18 degraded-state banner and `⚠` glyphs) — see `IssuesSection.tsx:2` for the exact import style, and `IssuesSection.tsx:60-68` for the degraded-state banner markup to copy for D-18's "no matched milestone" one-liner.

**Layout deviation from the analog (D-20, binding):** the analog's row is already flex-based (no `<table>`), which is why it was chosen as the starting point — but D-20 requires **explicit px widths** on `flex-none` cells (not bare Tailwind `shrink-0` alone), per the UI-SPEC Layout Contract:
```
!iid — shrink-0, monospace, ~44px
Jira key — shrink-0, monospace, ~72px (render "—" in the slot when absent, keeps BR/MS/TASK aligned)
Author avatar — CachedAvatar size={20}
State badge — shrink-0, ~64px
BR / MS / TASK columns — shrink-0, ~28px each, flex items-center justify-center
Title cell — flex-1 min-w-0, truncate (the only variable-width cell)
```
This is a structural change from the analog's simpler `ml-auto`-pushed layout — the analog does not have fixed-width columns because it never needed cross-row alignment; `MrDriftSection.tsx`'s BR/MS/TASK columns must align vertically across every row, which is exactly the `feedback_table_vs_flex_rows` lesson (div+flex rows, `flex-none` on variable cells, explicit px — not Tailwind's `w-*` scale alone, per the documented WebKit/Tauri narrow-column-collapse defect).

**State-color palette deviation (UI-SPEC, binding):** do NOT reuse the analog's orange-for-`opened` state-badge color (`UnmatchedMRsSection.tsx:41-43,89-92`) — UI-SPEC reserves orange exclusively for the `⚠` drift glyph. Use `IssuesSection.tsx`'s blue-for-`opened` convention instead (see `IssuesSection.tsx:148-151,159-163`).

---

### `taskflow/src/routes/dashboard/release-detail/IssuesSection.tsx` (MODIFY: re-source MR cell)

**Analog:** itself — same visual treatment, new data source (D-06, locked).

**MR cell to preserve verbatim** (`IssuesSection.tsx:136-216`) — the `row.mr ? ... : gitlabMatchType === 'none' ? ... : wrongMilestoneByKey.has(...) ? ... : ...` ternary chain. Per D-05/D-06, only the **data feeding `row.mr` and the wrong-milestone branch** changes (sourced from the three-channel union instead of `matchIssuesToMRs` + `buildWrongMilestoneMap`) — the JSX/className/color-ternary structure at these exact lines does not change.

**Props interface to extend** (`IssuesSection.tsx:12-24`) — currently takes `wrongMilestoneByKey: Map<string, GitLabMR>` (`:18`) and `unmatchedMRs: GitLabMR[]` (`:19`, passed through to `UnmatchedMRsSection` at `:224-227`). Replace both with whatever shape `driftDetection.ts`'s union produces (a lookup the "Wrong milestone"/"Missing MR" ternary can query per issue key), and remove the `unmatchedMRs`/`onNavigateToIssueFromMR` pass-through to `UnmatchedMRsSection` (deleted) — `MrDriftSection` is now a sibling, not a child, per D-01 ("new section below the Issues table," not nested inside `IssuesSection`).

**Rewiring point:** `IssuesSection.tsx:224-227` currently renders `<UnmatchedMRsSection unmatchedMRs={...} onNavigateToIssueFromMR={...} />` inside `IssuesSection`'s own `<section>`. Per D-01, `MrDriftSection` becomes a **separate top-level section** rendered by `IssuesSection`'s parent page component (find and update wherever `IssuesSection` itself is rendered — not located in this pattern search; the parent route file is out of the explicitly-read set but should be grep'd for `<IssuesSection` before wiring).

---

### `taskflow/src/routes/dashboard/ReleasesTab.tsx` (MODIFY: +D-14 fetch, +D-15 indicator)

**Analog:** itself — the existing `releaseBranches` fetch-once query (`ReleasesTab.tsx:192-207`) and the `branchMissing`/`branchPresent`/`milestoneMissing` per-row derivation (`:246-280`) are the direct precedent for D-14's row drift count.

**Fetch-once query to copy** (`ReleasesTab.tsx:186-207`, comment included — directly documents the D-18/D-14 "one request regardless of row count" philosophy this phase's new query must follow):
```tsx
// D-18: the entire `release/`-prefixed branch set is fetched in exactly ONE
// fully-paginated request regardless of row count, then matched locally per
// row. Never a per-row batch-query-hook call...
const {
  data: releaseBranches,
  isSuccess: branchesLoaded,
  isError: branchesError,
} = useQuery({
  queryKey: ['gitlab-release-branches', activeGitlabProject],
  queryFn: () =>
    fetchProjectBranches(
      gitlabBaseUrl ?? '',
      gitlabToken ?? '',
      activeGitlabProject ?? 0,
      RELEASE_BRANCH_PREFIX,
    ),
  enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken,
  staleTime: 5 * 60_000,
});
```
D-14's new query (`fetchOpenProjectMRs`, `state=opened`, fully paginated, project-wide) follows this exact shape: `queryKey: ['gitlab-open-mrs', activeGitlabProject]`, same `enabled` guard, same `staleTime`.

**Per-row derivation pattern to copy** (`ReleasesTab.tsx:266-281`, the `branchMissing`/`branchPresent` computation inside `toMatched`):
```tsx
const branchMissing =
  branchesLoaded && derived !== null && !version.released && !releaseBranchNames.has(derived);
const branchPresent = branchesLoaded && derived !== null && releaseBranchNames.has(derived);
return {
  version, match: bestMatch,
  issuesFixed: counts?.issuesFixed ?? 0, issuesTotal: counts?.issuesTotal ?? 0,
  branchMissing, branchPresent, branchName: derived, milestoneMissing,
};
```
The D-14 drift count is a fourth field on this same returned object (`driftCount: number`), computed via `computeRowDriftCount(openMrs, releaseBranchName, matchedMilestone?.id)` — a new pure function, recommend placing it in `driftDetection.ts` (per RESEARCH.md Pattern 5) so `ReleasesTab.tsx` and the detail page's row-scale reasoning don't duplicate the BR/MS predicate logic.

**Reserved slot to fill (D-15, binding placement)** — `ReleasesTab.tsx:558-585`, the comment explicitly reserves this spot:
```tsx
{/* Drift indicators (D-17/D-18/D-19) — placed before the task-count
  span so a future Phase 89 aggregate drift count can append
  after them without a redesign. ... */}
{branchPresent && ( <span title={...} data-testid="row-branch-present"> ... </span> )}
{branchMissing && ( <span title="No release branch" data-testid="row-missing-branch"> ... </span> )}

{/* Task count */}
<span className="text-xs text-muted-foreground tabular-nums">
  {issuesFixed} / {issuesTotal} done
</span>
```
Insert the D-15 drift badge **between** the `branchMissing` block and the `{/* Task count */}` comment — i.e. append after the existing branch/milestone icons, before the task-count span, exactly as the comment specifies. Follow the existing `<span title={...} data-testid="...">` shape for the new indicator (a new `data-testid`, e.g. `row-drift-count`, is recommended so `ReleasesTab.test.tsx` can assert it the same way it asserts `row-missing-branch`/`row-branch-present`/`row-missing-milestone`).

**Do not disturb** the existing `row-missing-branch` / `row-branch-present` / `row-missing-milestone` `data-testid`s (CONTEXT.md "Consumers that must not regress" — `ReleasesTab.test.tsx` asserts these).

## Shared Patterns

### GitLab API call + error handling
**Source:** `taskflow/src/services/gitlab.ts` — every existing fetcher (`fetchMilestoneMRs`, `fetchProjectMRs`, `fetchProjectBranches`) uses the identical three-way error split.
**Apply to:** All three new fetchers (`fetchBranchTargetedMRs`, `fetchAllProjectMRs`, `fetchOpenProjectMRs`).
```typescript
let response: Response;
try {
  response = await apiFetch('gitlab', url, { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } }, 'Load <Label>');
} catch {
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
if (!response.ok) {
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Failed to fetch <thing>', response.status, 'gitlab');
  }
  throw new Error(`Failed to fetch <thing>: status ${response.status}`);
}
```

### Fully-paginated fetch loop
**Source:** `fetchMilestoneMRs` (`gitlab.ts:1434-1474`)
**Apply to:** `fetchBranchTargetedMRs`, `fetchAllProjectMRs`, `fetchOpenProjectMRs` — the `while(true)` + `if (data.length < perPage) break;` break condition is the single most safety-critical pattern in this phase (it is the fix for the exact bug class — GGX-WARN-01 — this phase exists to eliminate). Never substitute a `limit`/capped single-page call.

### Jira ticket-key extraction and matching
**Source:** `taskflow/src/services/linkEngine.ts` — `extractTicketKeys` (L41-59), `linkMRToTask` (L73-80)
**Apply to:** Channel A's discovery match, the TASK drift predicate, and `MrDriftSection.tsx`'s title linkification. Do not write a new regex or a new "does this MR reference this issue" check — every existing consumer in this codebase goes through these two functions. Note the discovery-match (`linkMRToTask`, first-match-only) and the drift-predicate (any-key-match, RESEARCH.md Pattern 4) are deliberately different questions over the same primitive — do not collapse them.

### React-free pure module + colocated test
**Source:** `releaseSummaries.ts` / `releaseSummaries.test.ts`, `releaseBranch.ts` / `releaseBranch.test.ts`
**Apply to:** `driftDetection.ts` / `driftDetection.test.ts`. No hooks, no store reads, no closures over component state — every function takes explicit parameters and returns plain data. JSDoc header must state the React-free contract and point to the test file, matching both existing precedents' header style.

### Single data-layer hook (P87 D-07)
**Source:** `useReleaseDetail.ts` — all six (soon eight-minus-one=eight net) queries for the release detail page live in exactly one hook.
**Apply to:** All three new Channel A/B/C queries — do not create a second hook or fetch inside `MrDriftSection.tsx` itself. Section components stay presentational/props-driven (P87 D-08).

### TanStack Query key convention: project-scoped vs version-scoped
**Source:** `useReleaseDetail.ts:93-104` (comment explaining the `allProjectMilestones` fix from windowed to project-scoped), `useReleaseDetail.ts:237-246` (CR-02 invalidation-granularity lesson)
**Apply to:** Channel A's query key (`['gitlab-all-project-mrs', activeGitlabProject]`, project-scoped — the fetch itself doesn't depend on which release is open) vs. Channel C's (`['gitlab-branch-mrs', activeGitlabProject, releaseBranchName]`, version-scoped via the derived branch name).

### Fetch-once, filter-locally-per-row (P88 D-18 precedent)
**Source:** `ReleasesTab.tsx:186-207` (`releaseBranches` query) + `:266-281` (per-row local filter/derivation)
**Apply to:** D-14's Releases-list drift count — one project-wide `state=opened` MR fetch, then `computeRowDriftCount` filters/evaluates per row locally. Never a per-row query hook (that pattern is reserved for Jira issue counts specifically, which have no batch endpoint — see the comment distinction at `ReleasesTab.tsx:187-191`).

### Hover-detail via native `title`, not a Tooltip primitive
**Source:** `ReleasesTab.tsx:526,546`, `IssuesSection.tsx:171,200,211` — confirmed by UI-SPEC as the established codebase convention (no Radix Tooltip exists).
**Apply to:** D-09's provenance tooltip, D-12's two-reason TASK tooltip, D-14's discrepancy tooltip, D-07's column-header explanation tooltips — all via a plain `title="..."` attribute on the relevant element, never a new Tooltip component.

## No Analog Found

None — every file in this phase's scope has a direct, same-repo, same-role analog. This is consistent with RESEARCH.md's framing: "This phase is almost entirely a data-layer problem, not a new-technology problem."

## Metadata

**Analog search scope:** `taskflow/src/services/gitlab.ts`, `taskflow/src/services/linkEngine.ts`, `taskflow/src/routes/dashboard/release-detail/*.ts(x)`, `taskflow/src/routes/dashboard/ReleasesTab.tsx`
**Files scanned:** 9 (all fully read except `gitlab.ts`, which was targeted via grep + offset/limit reads of the interface block and the `fetchProjectMRs`/`fetchMilestoneMRs`/`fetchRecentProjectMRs` range, non-overlapping)
**Pattern extraction date:** 2026-08-10
**Note on RESEARCH.md's Wave 0 gap claim:** `taskflow/src/services/gitlab.test.ts` **already exists** (confirmed via `ls`) — RESEARCH.md's "verify whether it exists" open item is resolved: it does, so the planner should extend it rather than create it as a "larger Wave 0 gap."
