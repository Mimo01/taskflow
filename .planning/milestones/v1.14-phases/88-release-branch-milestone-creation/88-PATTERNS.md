# Phase 88: Release Branch & Milestone Creation - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 9 (2 new pure/dialog pairs + 1 new dialog + 4 extended files + 2 read-only reference)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `taskflow/src/services/gitlab.ts` (extend: `fetchProject`) | service | request-response (GET, throw-on-!ok) | `listGitLabProjects` (`gitlab.ts:188`) | exact |
| `taskflow/src/services/gitlab.ts` (extend: `fetchBranch`) | service | request-response (GET, tri-state 404-as-missing) | `fetchProjectMilestones`/`fetchGroupMilestones` shape, **special-cased** per Pattern 1 below | role-match (needs a deliberate deviation from the universal throw pattern) |
| `taskflow/src/services/gitlab.ts` (extend: `createMilestone`) | service | CRUD (POST write) | `updateMilestone` (`gitlab.ts:786`) | exact |
| `taskflow/src/services/gitlab.ts` (extend: `createBranch`) | service | CRUD (POST write) | `updateMilestone` (`gitlab.ts:786`) | exact |
| `taskflow/src/services/gitlab.ts` (extend: `fetchProjectBranches` for D-18 list-row fetch) | service | request-response (GET, fully paginated) | `fetchProjectMilestones`'s `while(true)` pagination loop (`gitlab.ts:696-742`) | exact |
| `release-detail/releaseBranch.ts` (NEW) | utility (pure module) | transform | `release-detail/releaseSummaries.ts` | exact |
| `release-detail/releaseBranch.test.ts` (NEW) | test | transform | `release-detail/releaseSummaries.test.ts` | exact |
| `release-detail/CreateBranchDialog.tsx` (NEW) | component (confirm dialog) | request-response (fires one mutation, no fields) | `components/ui/confirm-sprint-move-dialog.tsx` | exact |
| `release-detail/CreateMilestoneDialog.tsx` (NEW) | component (dialog with input + list + validation) | request-response (validated form -> mutation) | `routes/dashboard/BoardResolutionDialog.tsx` | exact |
| `release-detail/useReleaseDetail.ts` (extend: 2-3 new queries + 2 mutations) | hook | CRUD + request-response | itself (existing query blocks) + `useFieldMutation.ts` for mutation/invalidate shape | exact |
| `release-detail/ReleaseDetailSidebar.tsx` (extend: 2 new `MetaRow` rows) | component (presentational) | request-response (props-driven) | itself — existing "GitLab Milestone" `MetaRow` block | exact |
| `routes/dashboard/ReleasesTab.tsx` (extend: D-18 one-shot branch fetch + D-19 row icon) | component + data fetch | request-response + batch | itself — existing `milestones` query + "GitLab match indicator" row block | exact |

## Pattern Assignments

### `taskflow/src/services/gitlab.ts` — new reads/writes

**Analog:** `updateMilestone` (`gitlab.ts:786-825`) is the locked write-op template (D-22). `listGitLabProjects` (`gitlab.ts:188-222`) and `fetchProjectMilestones`'s pagination loop (`gitlab.ts:696-742`) are the read templates.

**Imports already in file** (`gitlab.ts:16-17`):
```typescript
import { ApiError } from '../lib/api-error';
import { apiFetch } from '../lib/apiFetch';
```

**`GitLabProject` interface to extend** (`gitlab.ts:33-38`, D-14):
```typescript
export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  // ADD:
  // default_branch: string;
}
```

**`GitLabMilestone` interface to extend** (`gitlab.ts:226-235`, D-07):
```typescript
export interface GitLabMilestone {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  state: 'active' | 'closed';
  web_url: string;
  // ADD (D-07): project_id?: number | null; group_id?: number | null;
}
```

**Write-op template — copy verbatim shape for `createMilestone`/`createBranch`** (`gitlab.ts:786-825`, `updateMilestone`):
```typescript
export async function updateMilestone(
  baseUrl: string,
  token: string,
  projectId: number,
  milestoneId: number,
  fields: { title?: string; description?: string },
): Promise<GitLabMilestone> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/milestones/${milestoneId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'PUT',
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      },
      'Update Milestone',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to update milestone', response.status, 'gitlab');
    }
    // Surface GitLab's error body (e.g. {"message":"title is missing"}) instead
    // of an opaque status code; fall back to the status when no message exists.
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Failed to update milestone: ${body?.message ?? `status ${response.status}`}`);
  }

  return (await response.json()) as GitLabMilestone;
}
```
**Required deviation for the two new writes (per RESEARCH.md Pitfall 3):** widen `body?.message` typing to `string | string[]` and join arrays — GitLab validation errors (e.g. duplicate title) commonly return an array. Do not copy `updateMilestone`'s narrower `{ message?: string }` typing verbatim for `createMilestone`/`createBranch`.

**Read-op (GET, throw-on-!ok) template for `fetchProject`** (`gitlab.ts:188-222`, `listGitLabProjects`):
```typescript
export async function listGitLabProjects(baseUrl: string, token: string): Promise<GitLabProject[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load Projects',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (response.ok) {
    const data = await response.json();
    return data as GitLabProject[];
  }
  if (response.status === 401) throw new ApiError('Invalid token or token has expired', 401, 'gitlab');
  if (response.status === 403) throw new ApiError('Token valid but lacks required permissions', 403, 'gitlab');
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
```
For `fetchProject(projectId)`: same shape, URL becomes `${base}/api/v4/projects/${projectId}` (single object return, not an array) — mirror the `401`/`403` -> `ApiError`, generic status -> `Error` split used by every other read in the file (e.g. `fetchRecentProjectMRs`, `gitlab.ts:1197-1202`).

**Fully-paginated GET template for D-18's branch-set fetch** (`gitlab.ts:696-742`, `fetchProjectMilestones`'s `while(true)` loop — reuse this loop shape for `GET /repository/branches?search=release/`, never a single capped page per D-18/the fetch-once page-cap gotcha):
```typescript
export async function fetchProjectMilestones(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabMilestone[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMilestones: GitLabMilestone[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/milestones?per_page=${perPage}&page=${page}&include_ancestors=true`;
    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
        'Load Releases',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch milestones', response.status, 'gitlab');
      }
      throw new Error('Failed to fetch milestones');
    }
    const data = (await response.json()) as GitLabMilestone[];
    allMilestones.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return allMilestones;
}
```

**Path-segment interpolation convention (encodeURIComponent), for `fetchBranch`/`createBranch`'s branch-name segment** (`gitlab.ts:658`, `fetchGroupMilestones`):
```typescript
const url = `${base}/api/v4/groups/${encodeURIComponent(groupPath)}/milestones?per_page=100&include_subgroups=true`;
```
Apply identically: `.../repository/branches/${encodeURIComponent(branchName)}` for `fetchBranch`.

**404-as-missing pattern (D-13) — NOT present anywhere else in `gitlab.ts`, must be hand-written as a deliberate exception to the file's universal `if (!response.ok) throw` convention:**
```typescript
export async function fetchBranch(
  baseUrl: string,
  token: string,
  projectId: number,
  branchName: string,
): Promise<{ exists: true } | { exists: false }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Load Release Branch',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (response.status === 404) return { exists: false }; // must come BEFORE the generic !response.ok check
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to check release branch', response.status, 'gitlab');
    }
    throw new Error(`Failed to check release branch: status ${response.status}`);
  }
  return { exists: true };
}
```

---

### `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` (NEW — pure module)

**Analog:** `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` — React-free, explicit-parameter, no closures over component state, JSDoc per exported function.

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
Mirror this for `releaseBranch.ts`'s header: explain the D-09 version-only derivation, D-11 unresolvable-title gate, and D-12's git-ref rule enumeration in the same doc-comment style (each exported function gets a `@param`/`@returns` JSDoc block, e.g. `computeMilestoneWindow`, `releaseSummaries.ts:29-36`).

**Function-per-concern shape to copy** (`releaseSummaries.ts:37-50`, `computeMilestoneWindow`):
```typescript
export function computeMilestoneWindow(
  releaseDate: string | null | undefined,
): { from: string; to: string } | null {
  if (!releaseDate) return null;
  const addDays = (d: string, n: number) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  return {
    from: addDays(releaseDate, -MILESTONE_LEEWAY_DAYS),
    to: addDays(releaseDate, MILESTONE_LEEWAY_DAYS),
  };
}
```
Same shape for `extractVersionFromMilestoneTitle` / `deriveReleaseBranchName` / `isValidGitRefName` (see RESEARCH.md Pattern 3 for the exact bodies — reuse verbatim, it was already written against this analog's conventions).

---

### `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts` (NEW)

**Analog:** `taskflow/src/routes/dashboard/release-detail/releaseSummaries.test.ts` — `describe`/`it` per exported function, small inline fixture builders, edge-case-first test naming (e.g. "returns false when every issue SP is 0 (proves > 0, not !== null)").

**Test file header + import shape** (`releaseSummaries.test.ts:1-12`):
```typescript
import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import {
  computeHasStoryPoints,
  computeIssueStatusCounts,
  computeLabelCoverage,
  computeLabelSummary,
  computeMilestoneWindow,
  computeMrStateCounts,
  computeStoryPoints,
} from './releaseSummaries';
```
For `releaseBranch.test.ts`: `import { deriveReleaseBranchName, extractVersionFromMilestoneTitle, isValidGitRefName } from './releaseBranch';`. Copy the `describe('computeMilestoneWindow', ...)` block's edge-case pattern (`releaseSummaries.test.ts:170-180`) for `isValidGitRefName` — one `describe` block per exported function, each `it` naming the specific rule under test (`..`, `.lock`, leading `/`, control chars — per RESEARCH.md Pitfall 1's warning-signs list).

---

### `taskflow/src/routes/dashboard/release-detail/CreateBranchDialog.tsx` (NEW)

**Analog:** `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` (full file, 55 lines — copy structure near-verbatim, this is a pure confirm-only dialog with no fields, exactly matching this phase's D-16/D-15 requirements).

**Full analog** (`confirm-sprint-move-dialog.tsx:1-55`):
```typescript
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmSprintMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKey: string;
  fromSprintName: string | null;
  toSprintName: string;
  onConfirm: () => void;
  isPending?: boolean;
  cancelLabel?: string;
}

export function ConfirmSprintMoveDialog({
  open,
  onOpenChange,
  issueKey,
  fromSprintName,
  toSprintName,
  onConfirm,
  isPending,
  cancelLabel = 'Cancel',
}: ConfirmSprintMoveDialogProps) {
  const from = fromSprintName ?? 'Backlog';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Move Issue</DialogTitle>
          <DialogDescription>
            Move <span className="font-mono font-medium text-foreground">{issueKey}</span> from{' '}
            <span className="font-medium text-foreground">{from}</span> to{' '}
            <span className="font-medium text-foreground">{toSprintName}</span>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{cancelLabel}</DialogClose>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Moving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
**Adaptations per UI-SPEC:** title -> "Create release branch"; description -> `Create <code className="font-mono font-medium text-foreground">release/{version}</code> off <span className="font-medium text-foreground">{default_branch}</span>?` (same inline-emphasis sentence pattern); primary button label -> `isPending ? 'Creating…' : 'Create branch'`; cancel stays `'Cancel'` (UI-SPEC's explicit dismiss-label decision — do not invent an action-specific label). **In-dialog error state (D-16, not present in this analog) must be added:** render the mutation's error message (GitLab's `body.message`) as a small text block between `DialogDescription` and `DialogFooter`, styled like other inline error text in the codebase (e.g. `text-xs text-destructive` or `text-orange-600 dark:text-orange-400` — match `BoardResolutionDialog`'s absence-of-error precedent is not useful here; instead follow the general inline-error convention used in form validation, see `CreateMilestoneDialog` below for the closer analog of in-dialog error rendering).

---

### `taskflow/src/routes/dashboard/release-detail/CreateMilestoneDialog.tsx` (NEW)

**Analog:** `taskflow/src/routes/dashboard/BoardResolutionDialog.tsx` (full file, 129 lines) — dialog with local input/selection state, `useEffect` reset keyed to identity props, disabled-until-valid primary button, a scrollable list block for reference data (maps directly to D-03's "Recent milestones" reference list).

**Full analog** (`BoardResolutionDialog.tsx:1-129`):
```typescript
import { CheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BoardResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKey: string;
  toStatusName: string;
  allowedValues: Array<{ id: string; name: string }>;
  onConfirm: (resolution: { id: string } | null) => void;
  isPending?: boolean;
}

const UNRESOLVED = '__unresolved__';

export function BoardResolutionDialog({
  open, onOpenChange, issueKey, toStatusName, allowedValues, onConfirm, isPending,
}: BoardResolutionDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is intentionally keyed to issue/allowed-values identity, not selectedId.
  useEffect(() => {
    setSelectedId(null);
  }, [issueKey, allowedValues]);

  function handleConfirm() {
    if (selectedId === null) return;
    onConfirm(selectedId === UNRESOLVED ? null : { id: selectedId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[85vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set a resolution</DialogTitle>
          <DialogDescription>...</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto px-1">
          {/* reference/selectable list rendered here */}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleConfirm} disabled={isPending || selectedId === null}>
            {isPending ? 'Setting…' : 'Confirm move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
**Adaptations per UI-SPEC/CONTEXT:**
- Title -> "Create GitLab milestone"; description -> the short explanatory line from UI-SPEC.
- Replace the selectable-button list (`allowedValues.map(...)`) with a **read-only** "Recent milestones" list (D-03) — same `-mx-1 flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto px-1` scroll container, but rows are plain `<div>`/`<span>` (not clickable buttons), each just showing the milestone title, muted-foreground.
- Add the title input field (controlled state) with persistent helper text below it (UI-SPEC: "Format: X.Y.Z (DD.MM.YYYY)") and inline format-error / duplicate-error text, both driving `disabled` on the primary button — same `disabled={isPending || <invalid>}` composition style as `disabled={isPending || selectedId === null}` above.
- The `useEffect` reset-on-identity-change pattern (`BoardResolutionDialog.tsx:57-60`) should reset the title input + selection state whenever `open` transitions or the version/matched-milestone identity changes.
- Primary button label -> `isPending ? 'Creating…' : 'Create milestone'`; cancel stays `'Cancel'`.
- Server-side failure (D-08/D-16): render GitLab's `message` body beneath the input field, dialog stays open — this is genuinely new (no existing dialog in the codebase renders a server-error string inline); place it as a small block directly under the input's helper/error text, e.g. `<p className="text-xs text-destructive">{...}</p>` (match the existing `text-xs text-muted-foreground`/`text-orange-600 dark:text-orange-400` sizing convention used throughout `ReleaseDetailSidebar.tsx`, not a new Alert component — UI-SPEC does not call for `alert.tsx` here).

---

### `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` (extend)

**Analog:** itself — the existing `milestones` query block (D-05's byte-identical key) is the shape for the new `fetchProject`/`fetchBranch` queries; `useFieldMutation.ts` is the shape for the two new mutations (minus optimistic update per D-15).

**Existing query shape to copy for `fetchProject`/`fetchBranch`** (`useReleaseDetail.ts:79-96`, the milestones query — **DO NOT change this block's key**, D-05):
```typescript
const { data: milestones } = useQuery({
  queryKey: ['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to],
  queryFn: () =>
    fetchProjectMilestonesInRange(
      gitlabBaseUrl ?? '',
      gitlabToken ?? '',
      activeGitlabProject ?? 0,
      milestoneWindow?.from ?? '',
      milestoneWindow?.to ?? '',
    ),
  enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && milestoneWindow !== null,
  staleTime: 5 * 60_000,
});
```
New queries follow the exact same `enabled` guard composition (`!!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && <feature-specific gate>`); the branch query's feature-specific gate is `deriveReleaseBranchName(matchedMilestone?.title) !== null` (D-10/D-11).

**Mutation + invalidate-on-success shape (D-15: no optimistic update, unlike this analog's `onMutate`)** — copy only the `useMutation` + `onSettled`/`invalidateQueries` skeleton from `useFieldMutation.ts:20-25,47-48`, dropping `onMutate`/`onError` rollback entirely:
```typescript
export function useFieldMutation(issueKey: string, jiraBaseUrl: string, boardId?: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fieldName, value }: { fieldName: string; value: unknown }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return updateIssueField(jiraBaseUrl, token, issueKey, fieldName, value);
    },
    // D-15: new mutations skip onMutate/onError rollback entirely (no optimism)
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      // ...
    },
  });
}
```
For `createBranch`: `mutationFn` calls `createBranch(gitlabBaseUrl, gitlabToken, activeGitlabProject, branchName, defaultBranch)`; `onSuccess`/`onSettled` calls `queryClient.invalidateQueries({ queryKey: ['gitlab-branch', activeGitlabProject, branchName] })` (new key, define alongside the query). For `createMilestone`: `onSuccess` invalidates the **exact existing** `['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]` key (D-05 cache contract — reuse the same key array shape, do not introduce a parallel key).

---

### `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` (extend)

**Analog:** itself — the existing "GitLab Milestone" `MetaRow` block is the exact shape for the two new status rows (D-20), including the warning-tint convention.

**`MetaRow` primitive** (`release-detail/MetaRow.tsx`, full file):
```typescript
export function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}
```

**Missing-state warning pattern to copy verbatim for "No release branch" / blocked / unresolvable states** (`ReleaseDetailSidebar.tsx:133-141`):
```tsx
<span
  className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
  data-testid="gitlab-link-none"
>
  <AlertTriangle className="size-3" />
  No milestone matched
</span>
```

**Success/exists-state pattern to copy for "branch exists"** (`ReleaseDetailSidebar.tsx:148-152`):
```tsx
<span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
  <Check className="size-3" />
  All {labelCoverage.total} MRs labeled
</span>
```

**Inline create-button + disabled/title convention** (`ReleaseDetailSidebar.tsx:67-75`, the existing "Edit" button — reuse `variant="ghost" size="sm"` per UI-SPEC):
```tsx
<Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={onStartEditing}>
  <Pencil className="size-3" />
  Edit
</Button>
```
For the disabled/blocked states (D-10/D-11), UI-SPEC specifies `disabled` + native `title` attribute (no new tooltip component) — the codebase's existing lightweight-tooltip precedent is the fuzzy-match `title={...}` at `ReleaseDetailSidebar.tsx:118`:
```tsx
title={`Fuzzy match: ${gitlabMatch.candidateName}`}
```

**Icons already imported** (`ReleaseDetailSidebar.tsx:2`): `import { AlertTriangle, Calendar, Check, ExternalLink, GitMerge, Pencil } from 'lucide-react';` — add no new icons beyond what's already imported (`AlertTriangle`/`Check` cover both new rows' states).

Props threading: `ReleaseDetailSidebarProps` (`ReleaseDetailSidebar.tsx:11-29`) is a flat, fully-typed, presentational props interface — extend it the same way (e.g. add `branchStatus`, `defaultBranch`, `onCreateBranch`, `isBranchCreating`, `onCreateMilestone`, `isMilestoneCreating` as plain props), never reach into a store/hook from inside this component (D-08 inherited constraint: presentational, props-driven).

---

### `taskflow/src/routes/dashboard/ReleasesTab.tsx` (extend — D-17/D-18/D-19)

**Analog:** itself — the existing `milestones` query (`ReleasesTab.tsx:163-180`, the exact same windowed-query shape as `useReleaseDetail.ts`) is the model for the new D-18 one-shot branch-search query; the "GitLab match indicator" row block (`ReleasesTab.tsx:408-460`) is the model for the new missing-branch/missing-milestone icon placement.

**Row-level indicator block to extend** (`ReleasesTab.tsx:408-460`, add the new orange `AlertTriangle` + `title` icon into this same `shrink-0` flex group, matching D-19's "icon with tooltip, not a text badge"):
```tsx
<div className="flex items-center gap-3 shrink-0">
  {match.type === 'exact' ? (
    /* ...existing link/span... */
  ) : (
    <span className="text-xs text-muted-foreground" data-testid="gitlab-link-none">
      No GitLab link
    </span>
  )}
  {/* Task count */}
  <span className="text-xs text-muted-foreground tabular-nums">
    {issuesFixed} / {issuesTotal} done
  </span>
</div>
```
Add the D-19 icon(s) as additional children of this flex group, using native `title` for the tooltip (same convention as the sidebar's fuzzy-match `title`), `size-3` icon, orange text color — never a `Badge`.

**One-shot fully-paginated fetch (D-18)** — reuse the `fetchProjectMilestones` pagination-loop shape (see gitlab.ts section above) for the new `fetchProjectBranches(baseUrl, token, projectId, search)` call, wired into `ReleasesTab.tsx` the same way the existing `milestones` query is wired (`ReleasesTab.tsx:163-180`) — one `useQuery` at the top of the component, matched locally per row inside the existing `toMatched`/row-render closures. **Do not** add a `useQueries` per-row call (the existing `versionCountQueries` `useQueries` block at `ReleasesTab.tsx:183-190` is a per-row pattern that exists for a different reason — Jira issue counts have no batch endpoint — and must NOT be copied for the branch-set fetch, which does have a single batch endpoint via `search=release/`).

---

## Shared Patterns

### GitLab write-op error handling (D-22)
**Source:** `taskflow/src/services/gitlab.ts:786-825` (`updateMilestone`)
**Apply to:** `createMilestone`, `createBranch`
- `apiFetch('gitlab', url, { method, headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }, body }, '<Action Label>')`
- 401/403 -> `throw new ApiError('Failed to <verb>', response.status, 'gitlab')`
- Other non-ok -> parse `response.json().catch(() => null)`, surface `body.message` verbatim (widened to `string | string[]`, joined), fallback to `status ${response.status}`
- Network failure (`catch` around `apiFetch` itself) -> `throw new Error(\`Cannot reach ${baseUrl} — check the base URL\`)`

### 404-as-missing (D-13) — the one deliberate exception
**Source:** RESEARCH.md Pattern 1 (no existing `gitlab.ts` function does this; must be hand-written)
**Apply to:** `fetchBranch` only
- Check `response.status === 404` and return `{ exists: false }` **before** the generic `if (!response.ok)` block.

### Query key cache contract (D-05)
**Source:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts:80-85` and `taskflow/src/routes/dashboard/ReleasesTab.tsx:164-169` (byte-identical `['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]`)
**Apply to:** Any new code that reads or invalidates the milestone list — must reuse this exact key array, never introduce a second milestone-list query.

### Presentational sidebar rows (D-08, D-20)
**Source:** `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` (whole file) + `MetaRow.tsx`
**Apply to:** `CreateBranchDialog`/`CreateMilestoneDialog` trigger rows in `ReleaseDetailSidebar.tsx` — component stays props-driven, no store/query reads inside it; the parent (`ReleaseDetailPage.tsx`) owns the hook calls and passes derived data + callbacks down.

### Confirm-dialog shell (D-16)
**Source:** `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` + `taskflow/src/routes/dashboard/BoardResolutionDialog.tsx`
**Apply to:** `CreateBranchDialog`, `CreateMilestoneDialog`
- `Dialog`/`DialogContent showCloseButton={false}`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`/`DialogClose render={<Button variant="outline" />}`
- Controlled `open`/`onOpenChange` from the parent
- Primary button: `disabled={isPending || <domain-invalid>}`, label toggles idle/pending text with an ellipsis + present participle (`'Creating…'`)
- On failure (D-16): error stays **inside** the dialog (render the mutation error message), dialog does not close; only a successful mutation calls `onOpenChange(false)`

## No Analog Found

None — every file in scope has a direct, exact-match analog already shipping in this codebase. The only genuinely new UI element (in-dialog server-error rendering, D-16) has no prior component to copy verbatim but is a small addition layered onto the `BoardResolutionDialog`/`ConfirmSprintMoveDialog` analogs, not a new pattern family.

## Metadata

**Analog search scope:** `taskflow/src/services/gitlab.ts`, `taskflow/src/routes/dashboard/release-detail/`, `taskflow/src/routes/dashboard/ReleasesTab.tsx`, `taskflow/src/routes/dashboard/BoardResolutionDialog.tsx`, `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx`, `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts`, `taskflow/src/lib/api-error.ts`
**Files scanned:** 9 read in full/targeted sections
**Pattern extraction date:** 2026-08-10
