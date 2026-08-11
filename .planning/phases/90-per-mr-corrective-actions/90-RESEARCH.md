# Phase 90: Per-MR Corrective Actions - Research

**Researched:** 2026-08-11
**Domain:** GitLab REST write API (MR update), TanStack Query v5 optimistic-cache patching for multi-row concurrent mutations, React per-row interaction state
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

See `.planning/phases/90-per-mr-corrective-actions/90-CONTEXT.md` for full text (D-01…D-16). Key hard/user decisions copied verbatim below; all sixteen are locked and must not be re-litigated:

- **D-01 (user):** The control is hover-revealed inside the existing 28px drift cell. No trailing button column, no permanent extra row width.
- **D-02 (user):** Row hover reveals, cell hover emphasizes. Hovering anywhere on the row swaps every actionable cell on that row from `⚠` to its action icon at once; the specific cell under the pointer additionally gets a background/ring.
- **D-03 (Claude's discretion):** Distinct icon per action — `GitBranch` in the BR cell, `Milestone` in the MS cell. Tooltip naming the exact change.
- **D-04 (Claude's discretion):** The control is focus-reachable — a real `<button>`, `:focus-visible` shares the row-hover reveal rule.
- **D-05:** Only a flagged (`⚠`) cell is actionable. `ok`/`na` cells are inert. TASK column is never actionable.
- **D-06 (user, hard):** In flight, the cell shows a `Loader2` spinner, resolving to `✓` when the server settles — the cache write is optimistic, but the cell glyph is pessimistic. Do not "correct" this to an immediate optimistic `✓`.
- **D-07 (Claude's discretion):** On failure the cell renders `⚠` in red; tooltip carries the GitLab error message; clicking again retries. Nothing rendered outside the row.
- **D-08 (Claude's discretion):** Failure state is sticky and local — component state keyed by `(mr.id, action)`, not the query cache. Clears only on successful retry. No auto-expiry timer.
- **D-09 (Claude's discretion):** Per-cell locking, not per-row. The two PUTs send disjoint fields. No per-row queue.
- **D-10 (hard, carried from 88-REVIEW.md WR-01):** GitLab's validation-error body is object-keyed; this phase must ship a real message extractor that flattens the object-keyed form.
- **D-11 (Claude's discretion):** The sort freezes on load for the life of the mounted list; a fixed row turns `✓` in place. Held-order ref, the P78 drag-gate pattern.
- **D-12 (Claude's discretion):** The `MR Drift` header badge decrements immediately on success.
- **D-13 (Claude's discretion):** On success, invalidate all three channel queries at project granularity, never by the windowed key. No cross-page invalidation.
- **D-14 (Claude's discretion, satisfies MRFIX-04):** When the release branch does not exist, the BR cell stays flagged `⚠` and becomes inert — no icon swap, tooltip explains the blocker.
- **D-15 (locked upstream by P89 D-18):** With no matched milestone, BR and MS both already render `—` under the degraded banner. No actions there.
- **D-16 (user, hard):** The probe's outcome does not change the UI either way. No confirm dialog, no warning, no tooltip line — regardless of probe outcome.

### Claude's Discretion

D-03, D-04, D-07, D-08, D-09, D-11, D-12, D-13, D-14 were delegated ("you decide") and are recorded, locked calls — not open questions to re-ask. The planner may adjust implementation detail where evidence contradicts a call, but must record the deviation.

### Deferred Ideas (OUT OF SCOPE)

- A corrective action for keyless MRs ("link an issue") — carried over from P89 D-11. Not to be invented by the planner.
- A bulk / "fix all flagged" action — excluded by the milestone goal.
- Restoring a Releases-list aggregate drift count (DRIFT-09, removed at P89 UAT).
- Keyboard-complete rows beyond the two new focus-reachable controls (D-04).
- An undo affordance after a successful fix.
- Closing WR-01 in the P88 create dialogs (`CreateBranchDialog`/`CreateMilestoneDialog`) — natural follow-on, not required by MRFIX-01…04.

**Also out of scope (from the Phase Boundary):** any third corrective action; merge-back verification (Phase 91); branch/milestone creation (Phase 88, done); a "fix all" affordance; permission gating (team is all Developer+, a 403 surfaces as a normal `ApiError`); any change to drift predicates, the union, row anatomy, or the Issues table.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MRFIX-01 | User can retarget an MR to the release branch from its row — applies directly with optimistic update and rollback, no confirm dialog and no warning | Pattern 2 (`updateMergeRequest` service function), Pattern 3 (optimistic mutation + rollback), Pitfall 1 (error flattening), Pitfall 4 (project-granular invalidation) |
| MRFIX-02 | User can assign the release milestone to an MR from its row — applies directly with optimistic update and rollback | Pattern 2/3 (same mutation shape, `milestone_id` field), GitLab field reference confirming `milestone_id` is the global `id` (matches `GitLabMR.milestone.id`) |
| MRFIX-03 | Each corrective action shows per-row status and can be retried independently of the other | Pattern 3 (per-row `useMutation` instance), Pitfall 2 (single shared mutation instance anti-pattern), Anti-Patterns section (sticky local error state) |
| MRFIX-04 | Retarget is unavailable while the release branch does not exist | D-14 (from CONTEXT.md, copied above); Architectural Responsibility Map row "Disabled-action gating" — `releaseBranchName` already resolved by Phase 88's hook, read at render time |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` exists in this repository — no project-wide directives to layer on top of the CONTEXT.md/UI-SPEC constraints above.

## Summary

This phase adds exactly one new GitLab write endpoint (`PUT /projects/:id/merge_requests/:iid`) and two new mutations that call it with disjoint field sets (`target_branch` for retarget, `milestone_id` for assign-milestone). The codebase already has three precedents this phase must extend, not invent: (1) `createBranchMutation`/`createMilestoneMutation` in `useReleaseDetail.ts` for the mutation+invalidation shape, (2) `updateMilestone`/`createBranch`/`createMilestone` in `gitlab.ts` for the PUT+error-body-extraction shape, and (3) `useFieldMutation.ts` for the canonical `onMutate`/`setQueryData`/`onError`-rollback/`onSettled`-invalidate optimistic pattern already used for Jira issue field edits.

The one genuinely new architectural problem this phase must solve — and that no existing pattern in the repo covers — is **per-row, per-action concurrent mutation state**. Every existing `useMutation` instance in this codebase is a single shared instance whose `.isPending`/`.error`/`.variables` describe only the most recent call — adequate for a single dialog (create branch, create milestone) but wrong for a scrolling list where multiple rows' BR and MS cells must be independently, simultaneously pending (D-09). The correct fix, confirmed against TanStack Query v5.90 (already the pinned version) semantics, is to give each row-cell its own `useMutation` instance by extracting the interactive cell into a row-scoped subcomponent (calling hooks inside `.map()` directly is a Rules-of-Hooks violation; a subcomponent per row is the standard fix) — plus local component state for the D-08 sticky-failure requirement, which must survive query-cache background refetches and therefore cannot live in the mutation's own `.error`.

The optimistic cache write itself is more subtle than `createBranchMutation`'s precedent because it must patch a specific `GitLabMR` by `id` across up to three separately-keyed query caches whose exact keys the mutation site does not fully know (they carry variable suffixes: `channelAUpdatedAfter`, `gitlabMatch.candidateName`, `releaseBranchName`). TanStack Query v5's `queryClient.setQueriesData({ queryKey: [prefix, projectId] }, updater)` (plural, predicate/prefix-matching — distinct from the singular `setQueryData` used everywhere else in this codebase) is the correct primitive: it patches every cache entry whose key starts with the given prefix, mirroring the same prefix semantics D-13's `invalidateQueries` already relies on. This pattern is not yet used anywhere in the codebase and must be introduced fresh.

**Primary recommendation:** Add `updateMergeRequest()` to `gitlab.ts` modeled on `createBranch`'s already-widened `string | string[]` error handling, but widen it further to also flatten GitLab's field-keyed validation-error object (`{"message":{"target_branch":["can't be blank"]}}`) — this is the one place D-10 is genuinely a new requirement, not just a copy of existing code. Add two `useMutation`s to `useReleaseDetail.ts` using `onMutate`/`setQueriesData`(plural, prefix-scoped)/`onError`-rollback/`onSettled`-invalidate (project-granular, all three channel keys). Extract `DriftMarkCell` into a stateful `DriftActionCell` row-subcomponent owning its own mutation instances and a local `{status, errorMessage}` ref that D-08 requires to be immune to background refetches.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GitLab MR PUT (retarget/assign) | API / Backend (external GitLab REST) | — | Write of record lives on GitLab's server; app is a thin REST client |
| Error message flattening | Frontend Server (service layer, `gitlab.ts`) | — | Must normalize GitLab's inconsistent error shapes before any UI layer sees them (D-10) |
| Optimistic cache patch | Frontend Server (React Query cache, `useReleaseDetail.ts`) | — | TanStack Query cache is the single source `driftRows` re-derives from every render; patching it is equivalent to patching "the model" |
| Per-cell pending/error state | Browser / Client (component state) | — | D-08 requires state that survives cache refetches — must live outside the query cache, in component state/ref |
| Drift row derivation (`buildDriftRows`) | Frontend Server (pure function over query data) | — | Unchanged this phase; consumes the patched caches automatically since it's recomputed every render, not memoized |
| Disabled-action gating (no release branch) | Browser / Client (render-time prop check) | Frontend Server (branch-existence query) | `branchState`/`releaseBranchName` already resolved by Phase 88's hook; this phase only reads it |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `^5.90.21` (already pinned — [VERIFIED: package.json]) | Mutation lifecycle, optimistic cache patch/rollback | Already the app's sole data-fetching/mutation layer; no alternative needed |
| `lucide-react` | `^0.577.0` (per 90-UI-SPEC.md) | `GitBranch`, `Milestone`, `Loader2`, `AlertTriangle` icons | Already the app's icon vocabulary; UI-SPEC already locked these exact icons |

No new packages are required for this phase. **Package Legitimacy Audit is not applicable** — zero new dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-row `useMutation` instance (subcomponent) | A single shared `useMutation` + a `Map<mrId, status>` reducer in the parent | The Map approach avoids extracting a subcomponent but requires hand-rolling exactly what `useMutation` already gives you (isPending, error, retry) — more code, same result. Per-row instance is simpler and is the idiomatic TanStack Query answer for "many independent mutable list items." |
| `setQueriesData` (plural, prefix match) | Read the exact query key from `useReleaseDetail`'s already-known key material (`channelAUpdatedAfter`, `gitlabMatch.candidateName`, `releaseBranchName`) and call `setQueryData` (singular) three times | Singular works and avoids learning a less-common API, but requires exposing three additional pieces of key state out of the hook into wherever the optimistic patch runs. `setQueriesData` needs only the stable prefix (`[name, projectId]`), which the mutation site already has via `activeGitlabProject`. Prefix form is less coupled to key-shape changes elsewhere in the file. |

## Package Legitimacy Audit

Not applicable — this phase installs no new packages (confirmed: `lucide-react` and `@tanstack/react-query` are pre-existing dependencies already at the pinned versions above).

## Architecture Patterns

### System Architecture Diagram

```
User click (GitBranch icon in BR cell / Milestone icon in MS cell)
        |
        v
DriftActionCell (new row-scoped subcomponent)
  - checks per-cell local status ref: idle -> allow click
  - calls its own useMutation.mutate()
        |
        v
useReleaseDetail.ts: retargetMrMutation / assignMilestoneMutation
  onMutate:
    - cancelQueries (three channel prefixes)
    - snapshot previous cache slices (rollback context)
    - setQueriesData([prefix, projectId], patch mr.id's target_branch|milestone) x3
        |
        v  (cache write triggers re-render)
useReleaseDetail.ts recomputes driftRows synchronously from the now-patched
query data (buildDriftRows is NOT memoized — runs every render)
        |
        v
MrDriftSection re-renders: row's BR/MS cell shows Loader2 (D-06 — glyph stays
pessimistic even though the cache write above was optimistic)
        |
        v
gitlab.ts: updateMergeRequest() -> PUT /projects/:id/merge_requests/:iid
        |
   +----+----+
   |         |
 2xx       4xx/5xx
   |         |
   v         v
onSuccess  onError -> rollback setQueriesData to snapshot
  - header badge (countFlaggedMRs) reflects patched cache -> decrements (D-12)
  - row sort stays frozen (held-order ref, D-11) -- row does NOT jump
  - DriftActionCell local status -> 'success' -> renders green check (D-06)
    invalidateQueries at project granularity (3 channel keys, D-13)
                                              |
                                    DriftActionCell local status -> 'error'
                                    (sticky, in component state, NOT cache —
                                    survives the 5-min staleTime refetch, D-08)
                                    tooltip = flattened GitLab error (D-10)
                                    click again -> retry (re-fires mutate())
```

### Recommended Project Structure
No new files. Modify in place:
```
taskflow/src/services/gitlab.ts                                  # + updateMergeRequest(), + error flattener
taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts # + 2 mutations, + held-sort-order ref
taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx  # DriftMarkCell -> DriftActionCell (conditionally interactive)
```

### Pattern 1: Widened GitLab error-message flattener (D-10)
**What:** GitLab's validation errors on `PUT merge_requests/:iid` can arrive in at least three shapes the app must not choke on:
- `{"message": "some string"}` (already handled by `updateMilestone`)
- `{"message": ["array", "of strings"]}` (already handled by `createBranch`/`createMilestone`'s `Array.isArray` widening)
- `{"message": {"target_branch": ["can't be blank"]}}` — **field-keyed object, the shape D-10 calls out as unhandled** and the one this phase's tooltip will actually hit for `target_branch`/`milestone_id` validation failures (this is Rails' standard `ActiveModel::Errors#messages` JSON shape, which GitLab's MR-update controller uses for field-level validation)

**When to use:** Every non-2xx response from `updateMergeRequest`.

**Example:**
```typescript
// Extends the createBranch/createMilestone pattern (gitlab.ts:1139-1142) with a
// third shape: Record<string, string[]> (field-keyed object, D-10's blocking gap).
function flattenGitLabError(body: unknown): string | undefined {
  if (body == null || typeof body !== 'object') return undefined;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  if (message && typeof message === 'object') {
    // {"target_branch": ["can't be blank"]} -> "target_branch can't be blank"
    return Object.entries(message as Record<string, unknown>)
      .map(([field, errs]) => `${field} ${Array.isArray(errs) ? errs.join(', ') : String(errs)}`)
      .join('; ');
  }
  return undefined;
}
```

### Pattern 2: `updateMergeRequest` service function (models `createBranch`/`updateMilestone`)
```typescript
// Source: gitlab.ts:997 (updateMilestone) + gitlab.ts:1106 (createBranch), extended per Pattern 1
export async function updateMergeRequest(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
  fields: { target_branch?: string; milestone_id?: number },
): Promise<GitLabMR> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/merge_requests/${mrIid}`;

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
      'Update Merge Request',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = flattenGitLabError(body);
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(msg ?? 'Failed to update merge request', response.status, 'gitlab');
    }
    throw new Error(`Failed to update merge request: ${msg ?? `status ${response.status}`}`);
  }
  return (await response.json()) as GitLabMR;
}
```
GitLab REST field reference (confirmed against `docs.gitlab.com/api/merge_requests/` "Update a merge request", GitLab 17.8+ doc snapshot):
- `target_branch` (string) — "The target branch." No dedicated validation-error text is documented beyond generic `can't be blank` / branch-not-found style Rails errors.
- `milestone_id` (integer) — "The global ID of a milestone to assign the merge request to. Set to `0` or provide an empty value to unassign a milestone." **This is the `id` field (matches this app's `GitLabMR.milestone.id`), not `iid`** — consistent with the existing `updateMilestone` function's own doc comment about `id` vs `iid`.
- "Must include at least one non-required attribute." — both mutations in this phase send exactly one field each, satisfying this trivially.
`[CITED: docs.gitlab.com/api/merge_requests/ "Update a merge request"]`

### Pattern 3: Optimistic mutation with per-row instance + sticky local error (D-08/D-09)
```typescript
// Row-scoped subcomponent — NOT a shared instance across rows. Each mounted
// DriftActionCell owns its own useMutation, so N rows can have N independent
// in-flight PUTs without one row's isPending/error clobbering another's
// (the gap in every existing useMutation call in this codebase, which is
// single-instance and adequate only for one dialog at a time).
function DriftActionCell({ mr, action, releaseBranchName, matchedMilestone, projectId, queryClient, gitlabBaseUrl, gitlabToken, mark }: Props) {
  // D-08: sticky failure state, NOT in the query cache — a background
  // refetch (5min staleTime / window refocus) must not silently clear it.
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateMergeRequest(gitlabBaseUrl, gitlabToken, projectId, mr.iid,
        action === 'br' ? { target_branch: releaseBranchName! } : { milestone_id: matchedMilestone!.id }),
    onMutate: async () => {
      setStatus('pending');
      setErrorMessage(null);
      await queryClient.cancelQueries({ queryKey: ['gitlab-all-project-mrs', projectId] });
      await queryClient.cancelQueries({ queryKey: ['gitlab-milestone-mrs', projectId] });
      await queryClient.cancelQueries({ queryKey: ['gitlab-branch-mrs', projectId] });
      const patch = (list: GitLabMR[] | undefined) =>
        list?.map((m) => m.id === mr.id
          ? action === 'br'
            ? { ...m, target_branch: releaseBranchName! }
            : { ...m, milestone: matchedMilestone }
          : m);
      // setQueriesData (PLURAL) — matches every cache entry whose key starts
      // with the given prefix, mirroring D-13's invalidateQueries prefix
      // semantics. The exact suffix (channelAUpdatedAfter / candidateName /
      // releaseBranchName) is unknown here by design; prefix match finds it.
      const snapshots = {
        a: queryClient.getQueriesData<GitLabMR[]>({ queryKey: ['gitlab-all-project-mrs', projectId] }),
        b: queryClient.getQueriesData<GitLabMR[]>({ queryKey: ['gitlab-milestone-mrs', projectId] }),
        c: queryClient.getQueriesData<GitLabMR[]>({ queryKey: ['gitlab-branch-mrs', projectId] }),
      };
      queryClient.setQueriesData<GitLabMR[]>({ queryKey: ['gitlab-all-project-mrs', projectId] }, patch);
      queryClient.setQueriesData<GitLabMR[]>({ queryKey: ['gitlab-milestone-mrs', projectId] }, patch);
      queryClient.setQueriesData<GitLabMR[]>({ queryKey: ['gitlab-branch-mrs', projectId] }, patch);
      return { snapshots };
    },
    onError: (err, _vars, context) => {
      // Rollback: restore each snapshot entry by its own exact key.
      for (const group of Object.values(context?.snapshots ?? {})) {
        for (const [key, data] of group) queryClient.setQueryData(key, data);
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update merge request');
    },
    onSuccess: () => setStatus('idle'), // D-06: glyph resolves to check via `mark` prop derived from cache, not from mutation state
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gitlab-all-project-mrs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['gitlab-milestone-mrs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['gitlab-branch-mrs', projectId] });
    },
  });

  const clickable = mark === 'flag' && status !== 'pending' && (action !== 'br' || releaseBranchName != null);
  // ...render glyph by status/mark per 90-UI-SPEC.md Interaction Contract...
}
```
`[VERIFIED: TanStack Query docs — setQueriesData/getQueriesData accept a partial QueryKey and match by prefix, same as invalidateQueries]`

### Anti-Patterns to Avoid
- **Reading `mutation.isPending` or `mutation.error` off a single shared `useMutation` instance to drive per-row UI** — this is exactly the shape of every existing mutation in this codebase (`createBranchMutation`, `createMilestoneMutation`, `useFieldMutation`), which is correct for a single dialog but silently shows the wrong row's spinner/error the moment two rows fire concurrently. This phase's per-cell instance requirement (D-09) is a deliberate departure from precedent, not a "just copy the file" job — flag this explicitly in the plan.
- **Deriving the sticky-error tooltip from `mutation.error` directly** — a `useMutation`'s `error` resets to `null` on the next `mutate()` call automatically (fine for retry) but is not durable against nothing else; the actual risk D-08 calls out is a *different* mechanism (a background refetch invalidating/replacing cached data) which does not touch `mutation.error` at all. Read D-08 literally: it wants failure state in **component state**, decoupled from the mutation object's own lifecycle, so a deliberate "clear on retry" (not "clear on random refetch") is guaranteed. Model: local `status`/`errorMessage` state set inside the mutation's own callbacks (as in Pattern 3), not read reactively from `mutation.error`.
- **Using `setQueryData` (singular) with a guessed exact key** — the three channel query keys carry variable suffixes (`channelAUpdatedAfter`, `gitlabMatch.candidateName`, `releaseBranchName`) that the row-cell component does not natively know; guessing them (e.g., reconstructing `channelAUpdatedAfter` locally) risks silently missing the actual cache entry if the hook's derivation logic ever changes. `setQueriesData` (plural) with the stable `[name, projectId]` prefix removes this coupling entirely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic update + rollback | A manual "save previous state in a ref, write new state, revert on catch" system | `useMutation`'s `onMutate`/`onError`/`onSettled` (already the app's own `useFieldMutation.ts` pattern) | Reinventing this loses the automatic `cancelQueries` race-condition guard TanStack Query gives for free, and diverges from the one optimistic-mutation convention already established in this codebase |
| Multi-key cache patching by prefix | Manually enumerating every possible suffix combination for the three channel keys | `queryClient.setQueriesData({queryKey: [prefix, projectId]}, updater)` | TanStack Query already implements prefix matching correctly (same code path `invalidateQueries` uses) — a hand-rolled enumeration will drift out of sync the next time a key's suffix shape changes |
| GitLab error-body normalization | A fresh ad-hoc parser per phase (as happened three times already: `updateMilestone`, `createBranch`, `createMilestone`, each independently reinventing a slightly wider `message` type) | One shared `flattenGitLabError()` helper covering all three known shapes (string / string[] / Record<string,string[]>) | D-10 is explicit that the object-keyed shape is the one gap that has recurred across every prior write function in this file; centralizing it here (and optionally back-porting to the other three call sites, per the Deferred Ideas note) stops a fourth reinvention |

**Key insight:** every "gap this phase must fill" the CONTEXT.md identifies (MR-update function, error extractor, per-cell state model, held-sort-order) already has a partial or full analog elsewhere in this exact file/directory — the risk is not missing functionality, it's an executor copying the *wrong* analog (e.g. `updateMilestone`'s narrower error typing instead of `createBranch`'s wider one, or a single shared mutation instead of a per-row instance).

## Common Pitfalls

### Pitfall 1: `[object Object]` tooltip (D-10, the one hard-blocking pitfall)
**What goes wrong:** GitLab returns `{"message":{"target_branch":["can't be blank"]}}` for a validation failure on this exact endpoint; `updateMilestone`'s existing `body?.message ?? status` pattern renders the object via template-literal coercion as `[object Object]`.
**Why it happens:** `updateMilestone`'s type annotation (`{ message?: string }`) doesn't even model the array or object cases, so TypeScript doesn't catch the runtime mismatch, and `${obj}` always "succeeds" (badly).
**How to avoid:** Use the three-shape flattener (Pattern 1) for every branch of `updateMergeRequest`'s error handling — string, string[], and Record<string,string[]>.
**Warning signs:** Any tooltip literally containing the text `[object Object]` in manual QA.

### Pitfall 2: Single shared mutation instance masking concurrent per-row state (D-09)
**What goes wrong:** If the mutation is created once in `useReleaseDetail.ts` (like `createBranchMutation`) and its `.mutate({mrId, action})` variables are used to key UI state, two concurrent calls (row 5's retarget, row 8's assign-milestone) will have their `isPending`/`error`/`variables` overwritten by whichever call's callback fires last — a classic "last-write-wins on shared hook state" bug.
**Why it happens:** Copy-pasting the existing single-instance mutation pattern without noticing this phase's list context is structurally different from every prior single-target write (branch/milestone creation happens once per release, not once per row).
**How to avoid:** One `useMutation` instance per row-cell (component-scoped inside a `DriftActionCell` subcomponent), never a single hoisted instance shared by the whole list.
**Warning signs:** In manual QA, firing two different rows' actions in quick succession causes one row's spinner to disappear/wrong-resolve while the other is still in flight.

### Pitfall 3: Held-sort-order under React Compiler (D-11)
**What goes wrong:** A naive `useMemo(() => rows, [])` "freeze" is not a stability guarantee under React Compiler (already enabled in this codebase per CONTEXT.md code_context) — the compiler can still re-evaluate/re-memoize when it decides dependencies changed, defeating the intended freeze.
**Why it happens:** `useMemo` was never a hard guarantee even without the compiler; treating it as one is a common but incorrect mental model, and the compiler makes manual memoization redundant/misleading anyway.
**How to avoid:** Use a `useRef`/`useState` snapshot captured once on mount (e.g., `const orderRef = useRef<number[] | null>(null); if (orderRef.current === null) orderRef.current = rows.map(r => r.mr.id);`), then re-sort the live `rows` array according to that captured id order on every render — never a memo.
**Warning signs:** A row visibly reorders immediately after its BR/MS cell turns green.

### Pitfall 4: Invalidating the windowed key instead of the project-granular prefix (CR-02 lesson, D-13)
**What goes wrong:** Invalidating `['gitlab-all-project-mrs', projectId, channelAUpdatedAfter]` (the exact key a `useQuery` call is holding) works for *that* query instance but silently misses any other cached entry under a different window — already documented as a real regression class at `useReleaseDetail.ts:237-246`.
**Why it happens:** It's tempting to invalidate "the key I have in scope," but TanStack Query's own prefix-matching invalidation is more forgiving and correct.
**How to avoid:** Always invalidate (and patch, per Pitfall 2's `setQueriesData`) using the two-element prefix `[queryName, projectId]`, never the full multi-element key.
**Warning signs:** MR Drift row still shows stale channel provenance after a successful write, until the 5-minute `staleTime` naturally lapses.

## Code Examples

### Verified GitLab "Update a merge request" parameter table (excerpt)
```
PUT /projects/:id/merge_requests/:merge_request_iid

| milestone_id  | integer | No | The global ID of a milestone to assign the merge request
|               |         |    | to. Set to 0 or provide an empty value to unassign a
|               |         |    | milestone. Mutually exclusive with `milestone`.
| target_branch | string  | No | The target branch.

Must include at least one non-required attribute.
```
`[CITED: docs.gitlab.com/api/merge_requests/ — "Update a merge request", mirrored verbatim from gitlabhq/gitlabhq doc/api/merge_requests.md, GitLab 17.8+ snapshot]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single shared `useMutation` per write type (this codebase's convention through Phase 88) | Per-row-instance `useMutation` for list contexts needing independent concurrent state | This phase (90), first time the codebase has a "many concurrent independent writes to the same page" requirement | Establishes a new precedent other future per-row-write phases can copy directly |
| `setQueryData` (singular, exact key) | `setQueriesData`/`getQueriesData` (plural, prefix/predicate match) for optimistic patches | Available since TanStack Query v4/v5 (already the pinned version here); not yet used anywhere in this codebase | Removes the "must reconstruct the exact windowed key" coupling that CR-02 already flagged as a recurring invalidation bug class |

**Deprecated/outdated:** None specific to this phase's stack — `@tanstack/react-query` v5.90.21 is current; `lucide-react` v0.577.0 is current per the locked UI-SPEC.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitLab's validation-error body for `target_branch`/`milestone_id` failures on this endpoint specifically takes the `Record<string, string[]>` shape (Rails' standard `ActiveModel::Errors` JSON format) rather than a flat string | Pattern 1, Pitfall 1 | If GitLab instead returns a flat string or array for this endpoint's failures, the flattener's object branch is simply unused dead code — no functional harm, but the "which shape actually occurs" fact is unverified against a live call (only against GitLab's documented Rails error convention, which the codebase's own `createBranch`/`createMilestone` comments already independently corroborate for sibling endpoints) |
| A2 | The team's GitLab project has `reset_approvals_on_push` and/or protected-branch rules configured (the fact D-16's probe is meant to establish) | Probe section below, D-16 | None to the UI (D-16 is explicit the answer changes no behavior) — risk is only that the phase docs record an unverified assumption about this team's specific config if the probe is skipped |

**If this table is empty:** N/A — see above.

## Open Questions (RESOLVED)

1. **Does this GitLab instance's actual error response for a duplicate/invalid `target_branch` match the field-keyed shape, or the flat-string shape `updateMilestone` already assumes?**
   - What we know: GitLab's Rails-standard validation-error convention is field-keyed (`{"message": {"field": ["error"]}}`) for model-validation failures; the codebase's own `createBranch`/`createMilestone` comments (Pitfall 3 note) already independently observed this same class of shape drift on sibling endpoints.
   - What's unclear: Whether a live failing PUT to `merge_requests/:iid` on this project actually returns this exact shape, versus e.g. a flat 404 `{"message":"404 Branch Not Found"}` for a nonexistent target branch (also GitLab-documented behavior elsewhere in the API).
   - Recommendation: The flattener (Pattern 1) already handles all three shapes defensively, so this is not blocking — but the phase's probe task (below) is a natural place to also capture one real failing-PUT response body as ground truth, if convenient during the approval-rules probe.
   - **A1 resolution (from `90-PROBE-RESULTS.md`'s `## A1 resolution` section): `A1: UNRESOLVED (probe D skipped)`.** No live GitLab PAT was available in the execution environment to run Probe D (Plan 01 Task 2); no `http_status`/`response_body` was captured. Per the plan this does not block the phase: `flattenGitLabError` handles all three known GitLab error-body shapes (string, string[], field-keyed object) defensively regardless of which one this instance actually emits. The live probe remains owed — re-run `probe.sh` with a real `GITLAB_PAT` when vault access is available.

## Probe: MR-approval / protected-branch rules (roadmap-mandated, D-16)

**Purpose:** Establish, as a documentation fact only (D-16: never a UI change), whether retargeting an MR on this team's project has an observable approval-reset side effect.

**Concrete steps (read-only — do NOT issue a live write call):**
1. `GET /api/v4/projects/:id/approvals` — returns `reset_approvals_on_push` (boolean). If `true`, a target-branch or source-branch push resets approvals; this app's retarget action changes `target_branch`, which GitLab's own issue tracker (gitlab.org/gitlab/-/work_items/7834, found during this research) confirms is treated as a reset-triggering event on some GitLab versions specifically because "merging the target branch into the source branch counts as a push."
2. `GET /api/v4/projects/:id/merge_requests/:iid/approvals` on a real MR that currently has at least one approval — inspect `approved_by` (non-empty array confirms approvals exist to lose) and `approvals_required`/`approvals_left`.
3. `GET /api/v4/projects/:id/protected_branches` — check whether the release branch name (or a wildcard pattern matching it, e.g. `release/*`) appears; a protected branch with restrictive `push_access_levels`/`merge_access_levels` is the other side effect class the roadmap probe references (a retarget could move an MR out of a protected-branch's merge-allowed set).
4. Record findings verbatim in a `90-PROBE-RESULTS.md` (pattern from Phase 88/89) — **the result changes no code path in this phase** per D-16; it is provenance for the phase's documentation only.

`[CITED: docs.gitlab.com/api/merge_request_approvals.md — "Retrieve approval configuration for a project" (GET /projects/:id/approvals, returns reset_approvals_on_push) and "Retrieve approval state for a merge request" (GET /projects/:id/merge_requests/:iid/approvals)]`
`[CITED: docs.gitlab.com/api/protected_branches.md — "List protected branches" (GET /projects/:id/protected_branches)]`

## Environment Availability

Skipped — this phase has no new external tool/runtime dependency. It calls the same GitLab REST API (already reachable per Phases 88/89) through the same `apiFetch` wrapper; no new CLI, service, or package is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` (existing) |
| Config file | `taskflow/vitest.config.ts` (existing — not modified this phase) |
| Quick run command | `npx vitest run src/routes/dashboard/release-detail/MrDriftSection.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` |
| Full suite command | `npm run test` (repo root `taskflow/`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MRFIX-01 | Retarget applies optimistically to cache, rolls back on failure, no confirm dialog | unit (mutation) | `vitest run useReleaseDetail.test.tsx -t "retarget"` | ❌ Wave 0 — new test cases needed in existing file |
| MRFIX-01 | BR cell shows `Loader2` while pending, `✓` green on settle (D-06's pessimistic glyph) | unit (component) | `vitest run MrDriftSection.test.tsx -t "pending"` | ❌ Wave 0 |
| MRFIX-02 | Assign-milestone applies optimistically, rolls back on failure | unit (mutation) | `vitest run useReleaseDetail.test.tsx -t "assign milestone"` | ❌ Wave 0 |
| MRFIX-03 | BR and MS cells on the same row can be pending concurrently without shared state (D-09) | unit (component) | `vitest run MrDriftSection.test.tsx -t "independent"` | ❌ Wave 0 |
| MRFIX-03 | Failure is sticky/local and survives a simulated background refetch; retry re-fires and clears it (D-08) | unit (component) | `vitest run MrDriftSection.test.tsx -t "sticky failure"` | ❌ Wave 0 |
| MRFIX-04 | BR cell is inert (no click handler, no hover-swap) when `releaseBranchName` is null | unit (component) | `vitest run MrDriftSection.test.tsx -t "unavailable"` | ❌ Wave 0 |
| D-10 | `updateMergeRequest` flattens all three GitLab error-body shapes (string / string[] / Record<string,string[]>) into a non-`[object Object]` message | unit (service) | `vitest run gitlab.test.ts -t "flattenGitLabError"` or a new `gitlab.test.ts` case | ❌ Wave 0 — check whether `gitlab.test.ts` exists first |
| D-11 | Sort order freezes on mount and does not re-sort a row that transitions to `✓` mid-session | unit (component) | `vitest run MrDriftSection.test.tsx -t "held sort order"` | ❌ Wave 0 (extends the existing "renders rows in the given order without re-sorting" test) |
| D-12 | Header badge count decrements immediately after an optimistic success, before the PUT settles | unit (component/hook) | `vitest run useReleaseDetail.test.tsx -t "flagged count"` | ❌ Wave 0 |
| D-13 | On success, all three channel query keys are invalidated at project granularity (not the windowed key) | unit (mutation) — mirrors existing Test A/B pattern in `useReleaseDetail.test.tsx` | `vitest run useReleaseDetail.test.tsx -t "invalidates the project-granular key"` | Pattern exists (Test A/B for milestone creation); new assertions needed for the two new mutations |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed test file>`
- **Per wave merge:** `npm run test` (full suite) + `npm run check` (biome/tsc — baseline is 2 pre-existing formatting errors in `BacklogPage.tsx`/`BacklogRow.tsx`, gate on zero *new* errors)
- **Phase gate:** Full suite green (excluding the known baseline) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `MrDriftSection.test.tsx` — needs new cases for pending/success/failure/unavailable states, independent per-cell concurrency, and held-sort-order under a success transition
- [ ] `useReleaseDetail.test.tsx` — needs new cases for the two new mutations' optimistic patch, rollback, and project-granular invalidation (mirrors existing Test A/B/E structure)
- [ ] `gitlab.ts` error-flattener — verify whether a dedicated `gitlab.test.ts` exists for unit-testing `flattenGitLabError` in isolation, or whether it should be tested indirectly through `updateMergeRequest`'s own error-path assertions
- [ ] No new test framework/config install needed — Vitest is already fully configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — PAT-based auth already established (Phase 88/89), no new auth surface |
| V3 Session Management | no | Not applicable — stateless PAT header per request |
| V4 Access Control | no | Explicitly out of scope per CONTEXT.md — "team is all Developer+; a 403 surfaces as a normal `ApiError`" — GitLab's own server-side role check is the authority, not this app |
| V5 Input Validation | yes | The two write payloads (`target_branch: string`, `milestone_id: number`) are sourced entirely from already-resolved, already-typed app state (`releaseBranchName`, `matchedMilestone.id`) — never raw user text input — so no new client-side validation surface is introduced. GitLab's own server-side validation is the actual gate (surfaced via the D-10 error flattener). |
| V6 Cryptography | no | No new secret/token handling — reuses existing `gitlabToken` from `readSecret`/stronghold, unchanged this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token leakage in devtools/error logs | Information Disclosure | Already mitigated app-wide by `apiFetch`'s header redaction (`PRIVATE-TOKEN` -> `[REDACTED]`); the new `updateMergeRequest` function must go through `apiFetch`, never raw `fetch`, to inherit this |
| Error body reflecting internal detail into UI | Information Disclosure (low severity) | D-10's flattener only surfaces GitLab's own validation-error text (already user-facing GitLab UI copy), never raw response bodies, stack traces, or the request URL/token — consistent with the `createBranch`/`createMilestone` precedent's explicit "message composed ONLY from body.message or the fixed fallback literal" comment |
| Unintended write to project `0` or an unresolved MR | Tampering (accidental) | WR-10 precedent (`useReleaseDetail.ts:196`) — never `?? 0` a project id or `?? -1` an iid into a write URL; throw instead if `activeGitlabProject`/`mr.iid` is falsy before calling `updateMergeRequest` |

## Sources

### Primary (HIGH confidence)
- `docs.gitlab.com/api/merge_requests/` "Update a merge request" — full parameter table retrieved via `raw.githubusercontent.com/gitlabhq/gitlabhq/master/doc/api/merge_requests.md` (GitLab's own doc source, GitLab 17.8+ snapshot) — confirms `target_branch`, `milestone_id` (global ID, mutually exclusive with `milestone`), and "must include at least one non-required attribute"
- `docs.gitlab.com/api/merge_request_approvals.md` — "Retrieve approval configuration for a project" (`GET /projects/:id/approvals` -> `reset_approvals_on_push`) and "Retrieve approval state for a merge request" (`GET /projects/:id/merge_requests/:iid/approvals` -> `approved_by`, `approvals_left`)
- `docs.gitlab.com/api/protected_branches.md` — "List protected branches" (`GET /projects/:id/protected_branches`)
- Codebase: `taskflow/src/services/gitlab.ts` (`updateMilestone` L997, `createBranch` L1106, `createMilestone` L1171, `GitLabMR` interface L425)
- Codebase: `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` (mutation shapes L215-290, channel query keys L351-396, drift-row derivation L401-428)
- Codebase: `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` (`DriftMarkCell` L54)
- Codebase: `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` (`DriftRow` L45, `countFlaggedMRs` L291)
- Codebase: `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` (canonical onMutate/setQueryData/onError-rollback/onSettled pattern)
- Codebase: `taskflow/src/lib/apiFetch.ts`, `taskflow/src/lib/api-error.ts` (`ApiError` class)
- Codebase: `.planning/phases/90-per-mr-corrective-actions/90-CONTEXT.md`, `90-UI-SPEC.md` (locked decisions, D-01…D-16)
- `package.json` — confirms `@tanstack/react-query ^5.90.21`, `vitest ^4.0.18`

### Secondary (MEDIUM confidence)
- WebSearch on approval-reset behavior corroborated by a live GitLab issue (`gitlab.com/gitlab-org/gitlab/-/work_items/7834`, "Do not reset approvals if the only change is merging with the target branch") — confirms retargeting is treated as a reset-triggering push event on some GitLab configurations, consistent with the `reset_approvals_on_push` setting's documented scope

### Tertiary (LOW confidence)
- None — every claim above was cross-checked against GitLab's own doc source or this codebase's existing, tested code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all reused at already-pinned versions
- Architecture: HIGH — every pattern is either a direct extension of existing tested code (`createBranch`/`updateMilestone`/`useFieldMutation`) or a documented TanStack Query v5 API (`setQueriesData`)
- Pitfalls: HIGH — all four pitfalls are either already-documented codebase lessons (WR-01/CR-02/React Compiler note) or a structural consequence of this phase's own D-09 requirement, not speculation

**Research date:** 2026-08-11
**Valid until:** 30 days (stable GitLab REST API + stable internal codebase pattern; re-verify if GitLab instance version changes or TanStack Query is upgraded)
