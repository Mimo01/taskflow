# Phase 87: Release Detail Decomposition - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 13 (11 new, 2 modified)
**Analogs found:** 13 / 13

This phase is a literal structural mirror of `taskflow/src/routes/dashboard/issue-detail/`. Every new file below has a directly-analogous file in that folder (or, for the two service fetchers, in `services/jira.ts` itself). Do not invent new conventions — copy the shapes below verbatim and substitute release-domain names.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `release-detail/ReleaseHeader.tsx` | component (page-header section) | request-response (presentational) | `issue-detail/MergeRequestsSection.tsx` (structure) + `IssueDetailContent.tsx`'s title block (JSX shape) | role-match |
| `release-detail/DescriptionsSection.tsx` | component (section) | request-response (presentational) | `IssueDetailContent.tsx`'s inline Description `<section>` (L285-293) | role-match |
| `release-detail/LabelSummarySection.tsx` | component (section) | request-response (presentational) | `issue-detail/MergeRequestsSection.tsx` | exact (leaf, loading-gated list) |
| `release-detail/IssuesSection.tsx` | component (section, composes a child section) | request-response (presentational) | `issue-detail/IssueDetailSidebar.tsx` (composition pattern: parent renders a child section inline) | exact |
| `release-detail/UnmatchedMRsSection.tsx` | component (leaf section, called as child not sibling) | request-response (presentational) | `issue-detail/MergeRequestsSection.tsx` | exact |
| `release-detail/ReleaseDetailSidebar.tsx` | component (sidebar) | request-response (presentational, composes MetaRow) | `issue-detail/IssueDetailSidebar.tsx` | exact |
| `release-detail/EditReleaseModal.tsx` | component (modal) | request-response (controlled form) | `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx` (uses same `Dialog` from `@base-ui/react/dialog`) | role-match |
| `release-detail/MetaRow.tsx` | component (leaf, private copy) | request-response (presentational) | `issue-detail/MetaRow.tsx` | exact (near-duplicate, 1-class delta — see below) |
| `release-detail/ReleaseDetailSkeleton.tsx` | component (skeleton) | request-response (presentational) | `taskflow/src/routes/dashboard/ReleasesSkeleton.tsx` (sibling skeleton in same dir) — layout content mirrors the current local `ReleaseDetailSkeleton` function, not `ReleasesSkeleton`'s | role-match |
| `release-detail/useReleaseDetail.ts` | hook (multi-query composition) | CRUD (6 useQuery + 1 useEffect + derived state) | `issue-detail/useLinkedMRs.ts` (query + derive pattern, feature-co-located hook) | role-match |
| `release-detail/releaseSummaries.ts` | utility (pure, React-free module) | transform | `src/services/releaseLinker.ts` | exact |
| `release-detail/releaseSummaries.test.ts` | test | transform | `src/services/releaseLinker.test.ts` | exact |
| `src/services/jira.ts` (MODIFIED — add `fetchVersionIssueCounts`, `fetchFixVersionIssues`) | service | request-response (REST fetch) | `fetchFixVersions` in the same file (L1099-1137) | exact |

## Pattern Assignments

### `release-detail/ReleaseHeader.tsx` (component, request-response)

**Analog:** `issue-detail/` convention generally + the current inline breadcrumb/heading block in `ReleaseDetailPage.tsx` (L653-682 breadcrumb, L692-699 heading) — there is no single-file breadcrumb-header analog in `issue-detail/` (issue detail's breadcrumb lives in a different shell, `IssueDetailPage.tsx`, out of this phase's read scope), so follow the generic `issue-detail/` component shape below.

**Export/prop-typing convention (from `issue-detail/MergeRequestsSection.tsx`, lines 1-20):**
```tsx
import { GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import type { GitLabMR } from '@/services/gitlab';
import { mrDot, mrStateClasses } from './utils';

interface MergeRequestsSectionProps {
  linkedMRs: GitLabMR[];
  mrsLoading: boolean;
  gitlabConnected: boolean;
  gitlabBaseUrl: string;
}

export function MergeRequestsSection({
  linkedMRs,
  mrsLoading,
  gitlabConnected,
  gitlabBaseUrl,
}: MergeRequestsSectionProps) {
  const navigate = useNavigate();
  if (!gitlabConnected || !gitlabBaseUrl) return null;
  return ( /* ... */ );
}
```
**Copy exactly:** named export (`export function ReleaseHeader(...)`), `interface ReleaseHeaderProps` declared immediately above the component, props destructured in the function signature (not accessed via a `props` object), early-return guard pattern for "nothing to render" states.

**Hazard reminder (RESEARCH.md §2):** the breadcrumb portion must render even while `isLoading`/`!version` — do not gate the whole component behind a `version` null-check; make `version` an optional/nullable prop and null-guard only the parts that need it (`version?.name ?? 'Release'`), matching current behavior.

### `release-detail/DescriptionsSection.tsx` (component, request-response)

**Analog:** `IssueDetailContent.tsx`'s inline Description block, lines 285-293:
```tsx
<section>
  <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
  {description ? (
    <WikiRenderer wikiText={description} attachments={attachmentMap} users={userMap} />
  ) : (
    <p className="text-sm text-muted-foreground italic">No description</p>
  )}
</section>
```
This shows the project's ternary-with-italic-fallback convention for "no content" states — reuse this exact `<p className="text-sm text-muted-foreground italic">` fallback pattern for the "neither has a description" branch called out in CONTEXT.md D-01 (L701-751).

**Structure to copy from `MergeRequestsSection.tsx`:** named export, `interface DescriptionsSectionProps` above the component, no local state (purely props → JSX), no data fetching (D-08).

### `release-detail/LabelSummarySection.tsx` (component, request-response)

**Analog:** `issue-detail/MergeRequestsSection.tsx` (full file, 68 lines, reproduced above) — same shape: a `loaded`/`loading` boolean prop gates a "loading" placeholder vs. an empty-state message vs. a populated list, exactly as `mrsLoading` → `linkedMRs.length === 0` → mapped list branches there. Map `milestoneMRsLoaded`/`labelSummary` onto that same three-branch structure.

### `release-detail/IssuesSection.tsx` (component, composes a child section)

**Analog:** `issue-detail/IssueDetailSidebar.tsx` (full file, 122 lines, reproduced above) — this is the concrete precedent for "a section component that imports and renders a sibling section file as a JSX child," which is exactly D-12b's requirement: `UnmatchedMRsSection` renders **inside** `IssuesSection`'s returned JSX, not as a page-shell sibling.

**Composition pattern to copy (lines 91-121):**
```tsx
return (
  <div className="space-y-4 text-sm">
    <FieldsSection ... />
    {!omitLinkedIssues && (
      <LinkedIssuesSection issuelinks={f.issuelinks} onOpenIssue={onOpenIssue} />
    )}
    {!omitMergeRequests && (
      <MergeRequestsSection
        linkedMRs={mr.linkedMRs}
        mrsLoading={mr.mrsLoading}
        gitlabConnected={mr.gitlabConnected}
        gitlabBaseUrl={mr.gitlabBaseUrl}
      />
    )}
  </div>
);
```
Apply directly: `IssuesSection` imports `{ UnmatchedMRsSection } from './UnmatchedMRsSection'` and renders it as the last child inside the **same** `<section>...</section>` wrapper that currently spans L778-1064 in `ReleaseDetailPage.tsx` — do NOT close the `<section>` tag before rendering it (see RESEARCH.md §9 Hazard 1, the phase's highest-risk trap).

**Import convention:** relative same-folder import (`./UnmatchedMRsSection`), not `@/` alias — matches `IssueDetailSidebar.tsx`'s imports of `FieldsSection`, `LinkedIssuesSection`, `MergeRequestsSection` all via `./`.

### `release-detail/UnmatchedMRsSection.tsx` (leaf component)

**Analog:** `issue-detail/MergeRequestsSection.tsx` (same file as above) — near-identical leaf shape: iterate `unmatchedMRs: GitLabMR[]`, one clickable row per MR with `CachedAvatar`, ticket-key/state badges, `onClick` navigation callback passed in as a prop (`onNavigateToIssueFromMR`) rather than importing `useNavigate` directly (RESEARCH.md §9 Hazard 4 — presentational sections must not import routing hooks themselves; the page shell/hook constructs the closure and passes it down).

### `release-detail/ReleaseDetailSidebar.tsx` (component, sidebar)

**Analog:** `issue-detail/IssueDetailSidebar.tsx` (full file above) is the direct structural precedent named in CONTEXT.md's canonical refs.

**Copy:**
- `interface ReleaseDetailSidebarProps { ... }` immediately above the component (mirrors `IssueDetailSidebarProps`, lines 14-27).
- Sub-blocks (MR-state / issue-status / story-point `MetaRow` groups) stay **inline** inside this one file rather than each becoming its own file — RESEARCH.md §5 explicitly notes `IssueDetailSidebar`'s granularity (composes 3 imported section files + keeps smaller groupings inline) as the model for how fine-grained `ReleaseDetailSidebar` should split internally: only truly reusable/independent blocks (like `UnmatchedMRsSection`) get their own file; metadata rows stay inline using `MetaRow`.
- Drag-handle prop-passing: the `useResizable()` hook itself stays in the page shell (owns `containerRef`, RESEARCH.md §9 Hazard 7); only `width`, `isDragging`, `handleMouseDown` cross the prop boundary — no analog file demonstrates this exact resizable-handle pattern in `issue-detail/`, but the general "hook stays where its ref lives, only derived values become props" rule is the same one `IssueDetailSidebar` follows for `useBoardId`/`useFieldMutation` (called inside the sidebar itself, since those don't need a shell-level ref).

### `release-detail/EditReleaseModal.tsx` (component, modal)

**Analog:** `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx` — uses the same `Dialog` primitive (`import { Dialog } from '@base-ui/react/dialog'`, line 1) that `ReleaseDetailPage.tsx`'s current inline edit modal already uses (L1306 `Dialog.Root`). This confirms the `@base-ui/react/dialog` import path/component API to preserve verbatim when the modal becomes its own file — do not swap to a different dialog primitive.

**Prop shape:** per RESEARCH.md §2's exhaustive prop list (heaviest section: `open`, `onOpenChange`, 6 controlled `edit*`/`setEdit*` pairs, `isSaving`, 2 error strings, 2 computed booleans, `onCancel`/`onSave`) — follow the same `interface EditReleaseModalProps { ... }` + destructured-props convention as every other `issue-detail/` component. Given the field count, RESEARCH.md explicitly permits (Claude's discretion) co-locating the edit-state itself in a sibling `useEditRelease` hook rather than threading 15+ individual props from the page shell — if taken, that hook should follow the same co-located-hook convention as `useFieldMutation.ts` below (named export, feature-scoped, no `src/hooks/` placement).

### `release-detail/MetaRow.tsx` (leaf component, private copy — NOT shared)

**Analog:** `issue-detail/MetaRow.tsx`, byte-diffed against the current local `MetaRow` in `ReleaseDetailPage.tsx` (L1488-1495). Confirmed one-class delta:

`issue-detail/MetaRow.tsx` (verbatim):
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

`release-detail/MetaRow.tsx` MUST be (preserve `min-w-0`, everything else identical):
```tsx
export function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}
```
**Convention note:** unlike most `issue-detail/` files, `MetaRow` uses an **inline destructured prop type** (`{ label, children }: { label: string; children: React.ReactNode }`), not a named `interface`. This is the one exception to the "always `interface XProps`" rule — copy the inline-type style here specifically, since it's what both the analog and the source already do. Do not "upgrade" it to `interface MetaRowProps` — that would be an unrequested convention change on a component D-13 says must stay a frozen, private copy.

### `release-detail/ReleaseDetailSkeleton.tsx` (component, skeleton)

**Analog:** the content structure to preserve is the *current local* `ReleaseDetailSkeleton` function (`ReleaseDetailPage.tsx` L1499-1518, reproduced below) — this is a page-detail skeleton (two-column layout matching the real page), structurally different from `ReleasesSkeleton.tsx` (a list-row skeleton for the releases table). Use `ReleasesSkeleton.tsx` only for the **file-placement/export convention** (co-located `.tsx` file in `routes/dashboard/`, single named export, imports only `Skeleton` from `@/components/ui/skeleton`), not for its row-list content:

```tsx
// ReleasesSkeleton.tsx — convention reference (export style, import style)
import { Skeleton } from '@/components/ui/skeleton';

export function ReleasesSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10 w-full" data-testid="skeleton-row" />
      ))}
    </div>
  );
}
```

```tsx
// Current local ReleaseDetailSkeleton — content to preserve verbatim, just add `export`
function ReleaseDetailSkeleton() {
  return (
    <div data-testid="release-detail-skeleton" className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="shrink-0 space-y-3" style={{ width: 288 }}>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
    </div>
  );
}
```
Change only: `function` → `export function` (matches `ReleasesSkeleton`'s named-export convention).

### `release-detail/useReleaseDetail.ts` (hook, multi-query composition)

**Analog:** `issue-detail/useLinkedMRs.ts` (full file, 61 lines, reproduced above) — the precedent for "a co-located feature hook that runs `useQuery`, reads from `useAuthStore`, and returns a plain destructured object of derived + raw values":

```ts
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import type { GitLabMR } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

export function useLinkedMRs(issueKey: string) {
  const { gitlabBaseUrl, gitlabConnected, activeGitlabProject } = useAuthStore();
  const { data: projectMRs, isLoading: mrsLoading } = useQuery({
    queryKey: [...],
    queryFn: async () => { /* readSecret, apiFetch, try/catch → [] fallback */ },
    staleTime: 60_000,
    enabled: !!gitlabBaseUrl && !!gitlabConnected && !!activeGitlabProject,
  });
  // derived filtering here (client-side)
  return { linkedMRs, mrsLoading, gitlabConnected: !!gitlabConnected, gitlabBaseUrl: gitlabBaseUrl || '' };
}
```
**Apply to `useReleaseDetail`:** same "destructure store, run N `useQuery` calls with the exact same `queryKey`/`staleTime`/`enabled` shapes as documented in RESEARCH.md §3, call the pure functions from `releaseSummaries.ts` on the query results, return one flat object" pattern. Named export, no default export, hook file lives beside its section files (not `src/hooks/`) per D-10.

**Also relevant — `issue-detail/useFieldMutation.ts`** (reproduced above) for the invalidation-call convention if `useReleaseDetail` also owns `handleSave`: `queryClient.invalidateQueries({ queryKey: [...] })` calls grouped in a mutation's `onSettled`, each with an inline comment explaining *why* that key is invalidated — match this commenting style for the 4 invalidations named in RESEARCH.md §3 (`jira-fix-versions`, `jira-version-counts`, `gitlab-milestones`, `gitlab-milestone-mrs`).

**Do NOT copy `useAuthBlob.ts`'s raw-`fetch` pattern** — it predates `apiFetch` and is domain-specific (attachment blob fetching with manual redirect handling); it is not a query-composition analog and must not be used as a precedent for `fetchVersionIssueCounts`/`fetchFixVersionIssues` (those go through `apiFetch` in `services/jira.ts`, see below).

### `release-detail/releaseSummaries.ts` (pure, React-free module)

**Analog:** `src/services/releaseLinker.ts` (full file, 81 lines, reproduced above) — the exact target shape: a file with **zero imports from React/hooks/stores**, a module-level doc comment explaining matching/normalization rules, exported pure functions with full JSDoc (`@param`/`@returns`), explicit input types as function parameters (never closures over module state).

**Copy:**
- File-top doc comment block explaining the module's purpose and any non-obvious rules (mirrors `releaseLinker.ts` lines 1-16 on date-normalization rules) — `releaseSummaries.ts` should similarly document the `hasStoryPoints` `sp > 0` rule and the `issueStatusCounts` unknown-category → `new` fallback, both flagged as non-obvious in RESEARCH.md §4/§8.
- Named exports only, one function per derived computation (`milestoneWindow`, `labelSummary`, `labelCoverage`, `mrStateCounts`, `issueStatusCounts`, `issueStoryPoints`, `storyPoints`/`hasStoryPoints`, plus the `matchedRows`/`unmatchedMRs`/`wrongMilestoneByKey` matching functions per RESEARCH.md §4's full inventory of 9 named computations).
- No `useMemo` — RESEARCH.md's "Don't Hand-Roll" table explicitly warns against adding memoization during this move (none exists today; adding it now is scope creep).

### `release-detail/releaseSummaries.test.ts` (test)

**Analog:** `src/services/releaseLinker.test.ts` (reproduced above, first 50 lines) — plain `describe`/`it`/`expect` from `'vitest'`, **no `render()`, no `QueryClientProvider`, no mocking** — because the module under test is pure:
```ts
import { describe, expect, it } from 'vitest';
import { matchGitLabToFixVersion } from './releaseLinker';

describe('matchGitLabToFixVersion — date matching', () => {
  it('returns exact for same date strings', () => {
    const result = matchGitLabToFixVersion('2026-03-15', { date: '2026-03-15', name: 'sprint-15', url: '...' });
    expect(result.type).toBe('exact');
  });
  // ...
});
```
Apply identically: one top-level `describe` block per exported function, `it()` cases named as plain-English behavior statements. See RESEARCH.md §8 for the exact edge cases to cover per function (empty MR list, `locked`-state MR bucketing, `sp > 0` vs `sp !== null`, month-boundary date arithmetic, etc.) — this file is the phase's primary test-value artifact per D-14.

### `src/services/jira.ts` (MODIFIED — add 2 fetchers)

**Analog:** `fetchFixVersions`, same file, lines 1099-1137 (reproduced above) — this is the exact `apiFetch` call/response-check/error-throw shape both moved functions must adopt per D-12a:

```ts
export async function fetchFixVersions(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraFixVersion[]> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/api/2/project/${projectKey}/versions`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      'Load Releases',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg = (data as { errorMessages?: string[] }).errorMessages?.[0] ?? 'Failed to fetch fix versions';
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(msg, response.status, 'jira');
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return (Array.isArray(data) ? data : []) as JiraFixVersion[];
}
```

**Apply per D-12a's constraints (do NOT copy the try/catch/`ApiError` shape wholesale — preserve each fetcher's existing fallback semantics):**
- `fetchVersionIssueCounts`: replace the two raw `fetch(totalUrl, {headers})`/`fetch(doneUrl, {headers})` calls (currently imported from `@tauri-apps/plugin-http`, `ReleaseDetailPage.tsx` L84-89) with `apiFetch('jira', totalUrl, {headers}, 'Load Release Issue Counts')` / equivalent for `doneUrl`. **Keep** the existing `Promise.allSettled` + silent `{total: 0}`-per-request fallback on non-OK responses — do NOT add the `ApiError`-throwing branch from `fetchFixVersions`; that would change the current "never throws, always returns a counts object" contract.
- `fetchFixVersionIssues`: replace the single raw `fetch(url, {headers})` (L126) with `apiFetch('jira', url, {headers}, 'Load Release Issues')`. **Keep** the existing `throw new Error('Failed to fetch issues: status ${resp.status}')` string on non-OK — do NOT convert to `ApiError`/401-branch handling; D-12a says only add the `apiFetch` wrapper itself (timeout + disconnect-marking), not change the error-shape contract.
- The `/^\d+$/.test(versionId)` guard in both functions is preserved verbatim (unchanged control flow, just relocated).
- Both functions move to `services/jira.ts` (the legacy single file — NOT `services/jira/`), placed near `fetchFixVersions` for discoverability, following that function's JSDoc style (`@param`/`@returns` block above the signature).
- Callers in `useReleaseDetail.ts` import them via `import { fetchVersionIssueCounts, fetchFixVersionIssues } from '@/services/jira'` (alias import, matching how `ReleaseDetailPage.tsx` currently imports `fetchFixVersions, updateFixVersion` from the same module, L51).

## Shared Patterns

### Import ordering / path-alias convention
**Source:** `ReleaseDetailPage.tsx` L9-59 and `IssueDetailContent.tsx` L1-37 (both files, current state)
**Apply to:** every new file in `release-detail/`

Order observed consistently across both source files (biome-sorted): (1) third-party UI/dialog libs (`@base-ui/react/dialog`, `@dnd-kit/*`), (2) `@tanstack/react-query`, (3) `@tauri-apps/*`, (4) `lucide-react` icon block, (5) `react`/`react-dom` core, (6) `react-markdown`/`remark-gfm` etc., (7) `react-router-dom`, (8) `@/components/ui/*` (alphabetical), (9) `@/hooks/*`, (10) `@/lib/*`, (11) `@/services/*` (types via `import type` interleaved alphabetically with value imports from the same module — e.g. `import type { GitLabMilestone, GitLabMR } from '@/services/gitlab'` immediately followed by `import { fetchMilestoneMRs, ... } from '@/services/gitlab'`), (12) `@/stores/*`, then (13) same-folder relative imports (`./ComponentName`) last. Use `@/` alias for cross-tree imports, relative `./` only for same-directory siblings (confirmed by `IssueDetailSidebar.tsx` importing `./FieldsSection`, `./useFieldMutation` etc. by relative path while everything else uses `@/`).

### Named exports only, `interface XxxProps` above the component
**Source:** confirmed across 20+ files in `issue-detail/` (RESEARCH.md §5) — `ActivityTimelineProps`, `FieldsSectionProps`, `MergeRequestsSectionProps`, `IssueDetailSidebarProps`
**Apply to:** every new `release-detail/*.tsx` file except `MetaRow.tsx` (inline type, see above)
```tsx
interface MergeRequestsSectionProps {
  linkedMRs: GitLabMR[];
  mrsLoading: boolean;
  gitlabConnected: boolean;
  gitlabBaseUrl: string;
}

export function MergeRequestsSection({ linkedMRs, mrsLoading, gitlabConnected, gitlabBaseUrl }: MergeRequestsSectionProps) {
```
Never `export default`, never inline-destructured object types (except the one documented `MetaRow` exception), never a separate `type` alias.

### Thin barrel — direct-path imports, not `index.ts`
**Source:** `issue-detail/index.ts` (verbatim, 2 lines):
```ts
export { IssueDetailSidebar } from './IssueDetailSidebar';
export { extractSprintName } from './utils';
```
**Apply to:** if `release-detail/index.ts` is created at all (D-05 says it "stays thin or is omitted"), export at most the 1-2 symbols the page shell needs (likely just `ReleaseDetailSidebar` if it mirrors `IssueDetailSidebar`'s barrel treatment) — every other file (sections, `MetaRow`, hooks, `releaseSummaries`) is imported directly by relative path from `ReleaseDetailPage.tsx` or from sibling section files, exactly as `IssueDetailContent.tsx` does (`import { AttachmentsSection } from './issue-detail/AttachmentsSection'`) rather than via the barrel.

### Page shell → sections delegation shape
**Source:** `IssueDetailContent.tsx` L33-37 (imports) — the page-shell-to-section wiring pattern `ReleaseDetailPage.tsx` must adopt:
```tsx
import { AttachmentsSection } from './issue-detail/AttachmentsSection';
import { LogWorkPopover } from './issue-detail/LogWorkPopover';
import { SubtasksSkeleton } from './issue-detail/SubtasksSkeleton';
```
Then rendered directly in JSX with resolved props (not raw query/store objects):
```tsx
<AttachmentsSection
  attachments={issue.fields.attachment ?? []}
  issueKey={issueKey}
  jiraBaseUrl={jiraBaseUrl}
  onDelete={handleDeleteAttachment}
/>
```
**Apply to `ReleaseDetailPage.tsx`:** import each `release-detail/*` section by path prefixed `./release-detail/` (e.g. `import { ReleaseHeader } from './release-detail/ReleaseHeader'`), and render each with fully-resolved primitive/callback props computed from `useReleaseDetail()`'s returned object — never pass the raw query result or a store hook's return value straight through; resolve it in the shell first (mirrors `handleDeleteAttachment` being a shell-level closure passed as `onDelete`, not `AttachmentsSection` calling `useMutation` itself).

### `apiFetch` wrapper for all Jira REST calls
**Source:** `src/lib/apiFetch.ts` (behavior documented in RESEARCH.md §7) + `fetchFixVersions` (excerpt above)
**Apply to:** `fetchVersionIssueCounts`, `fetchFixVersionIssues` once moved into `services/jira.ts` — every one of the other 33 functions in that file uses `apiFetch('jira', url, init, operationLabel)`; zero use raw `fetch`. Adopt the same call shape; do not import `fetch` from `@tauri-apps/plugin-http` inside `services/jira.ts`.

## No Analog Found

None — every file in this phase has at least a role-match analog in `issue-detail/`, `services/jira.ts`, or an existing sibling skeleton/modal. This is expected: the phase is explicitly defined as mirroring an existing precedent (D-01, D-16), not introducing new patterns.

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/issue-detail/` (43 files), `taskflow/src/routes/dashboard/` (page-shell + modal + skeleton siblings), `taskflow/src/services/jira.ts`, `taskflow/src/services/releaseLinker.ts` + test
**Files scanned:** `IssueDetailContent.tsx`, `issue-detail/IssueDetailSidebar.tsx`, `issue-detail/MergeRequestsSection.tsx`, `issue-detail/useAuthBlob.ts`, `issue-detail/useFieldMutation.ts`, `issue-detail/useLinkedMRs.ts`, `issue-detail/MetaRow.tsx`, `issue-detail/index.ts`, `BulkCreateSubtasksModal.tsx` (partial), `ReleasesSkeleton.tsx`, `ReleaseDetailPage.tsx` (imports L1-140, tail L1480-1518), `services/jira.ts` (L1090-1140), `services/releaseLinker.ts`, `services/releaseLinker.test.ts` (partial)
**Pattern extraction date:** 2026-08-10
