# Pitfalls Research

**Domain:** Git-flow release-coordination write features (GitLab branch/milestone/MR mutations) added to an existing read-mostly Tauri desktop app
**Researched:** 2026-08-10
**Confidence:** HIGH for GitLab platform behavior (official docs + GitLab issue tracker); HIGH for codebase-specific recurring bug classes (verified against `gitlab.ts` and project memory); MEDIUM for exact UX/detection thresholds (no live GitLab instance probed this session)

## Critical Pitfalls

### Pitfall 1: Retargeting an MR silently strips approvals, invalidates the diff base, and orphans discussions — with no confirm dialog

**What goes wrong:**
The milestone spec says "retarget MR's target branch" is optimistic + rollback with **no confirm dialog** (unlike branch/milestone creation). But `PUT .../merge_requests/:iid` with a new `target_branch` is not a benign metadata edit:
- **Approvals reset.** GitLab's documented behavior: "approvals aren't removed when a merge request is rebased from the UI. However, approvals are reset if the target branch is changed." A fully-approved, ready-to-merge MR silently loses every approval the moment the app retargets it — the author/reviewers get no explicit "approvals cleared" toast unless they reload GitLab's MR page. A related GitLab bug thread confirms this is intended/working-as-designed, not a fluke.
- **Diff recomputes against a new base.** The diff shown to reviewers is source vs. new-target's merge-base — this can surface a completely different (often much larger) diff if the old and new target branches have diverged, e.g. retargeting from `develop` to `release/1.4.0` when `release/1.4.0` was cut from an older `develop` commit.
- **Pipeline goes stale.** Merge request pipelines compare source against target; a pipeline that ran (and possibly passed) against the old target is no longer meaningful against the new one and needs to re-run. GitLab does not always auto-trigger this — the MR can show a green pipeline badge that reflects the *wrong* comparison until someone re-runs it. Merge request pipelines can only access protected resources when both source and target are protected and the triggering user has push/merge access to the target — a target-branch change can also change which protections apply.
- **Diff discussions can go outdated/orphaned.** Existing diff-note positions were anchored to the old base; when the base shifts, GitLab may mark threads outdated or lose the inline anchor, especially on lines that no longer differ under the new base.
- Known GitLab bug (#415496): code-owner approvals sometimes are *not* cleared on target-branch change even though regular approvals are — an inconsistency the app cannot rely on either way when deciding what to warn about.

**Why it happens:**
The requirement models this as a low-risk metadata correction ("the MR is targeting the wrong branch, just fix it") because from the release-manager's perspective it *is* just fixing a pointer. But GitLab treats target branch as load-bearing for diff/approval/pipeline state, not metadata.

**How to avoid:**
- Before firing the PUT, use (or fetch) MR detail to check approval count and pipeline status; if the MR has non-zero approvals or a passed pipeline, show an inline warning in the row ("Retargeting will clear N approval(s) and require a new pipeline run") even though there's no confirm-dialog gate per spec — a warning badge is not the same as a blocking dialog and satisfies both the "no confirm dialog" requirement and user safety.
- After a successful retarget, invalidate/refetch that MR's approval and pipeline state in the UI (don't just optimistically flip `target_branch` and leave stale approval badges showing).
- Do not offer retarget on **merged** or **closed** MRs — GitLab will reject it or the semantics are meaningless; filter these out of "correctable" rows before rendering the action (see Pitfall 4).
- Consider excluding or distinctly flagging draft MRs, since a draft's purpose (and eventual target) is still in flux.

**Warning signs:**
- UAT reports of "my approvals disappeared" after using a release-view action.
- Pipeline badge staying green after a retarget when the diff clearly changed.
- Support requests asking "why did my MR diff suddenly balloon."

**Phase to address:**
Per-MR retarget action phase (the optimistic+rollback mutation) — build the approval/pipeline-loss inline warning and post-mutation cache invalidation into the same phase, not as a follow-up.

---

### Pitfall 2: "Has release branch been merged?" check gives false negatives on squash or rebase merges

**What goes wrong:**
The post-release check needs to answer "was `release/[tag]` merged into the default branch?" GitLab's `GET /projects/:id/repository/branches/:branch` `merged` field (and any client-side merge-base/ancestry walk) is computed via git ancestry. **Squash merges create a brand-new commit SHA on the target branch — the original branch's commits are never literal ancestors of the target** — so ancestry-based "merged" detection reports `false` even though the content landed. This is a long-standing, still-open GitLab behavior: squash-merged branches show as not-merged, with incorrect ahead/behind counts, in both the API and the UI branch graph (documented in multiple GitLab issues, e.g. #36963). Rebase-then-merge has a related but different failure mode: the source branch's commits get new SHAs replayed onto the target, so an ancestry check against a *cached* pre-rebase SHA also reads as unmerged.

**Why it happens:**
Ancestry/merge-base checks assume history is preserved verbatim across the merge, which is only true for a plain merge commit. Squash and rebase both intentionally rewrite history.

**How to avoid:**
- Do **not** rely solely on the Branches API `merged: true/false` field, and do not implement a client-side merge-base walk — both are ancestry-based and share the same false-negative class.
- Primary signal: if the git-flow process opens a tracking MR for `release/<tag>` → `<default branch>`, check its `state === 'merged'` via the Merge Requests API — GitLab's own `state`/`merged_at` reflects the actual recorded merge event regardless of merge method (squash/rebase/ff all set `state: merged`), unlike raw branch ancestry.
- If no such MR is guaranteed to exist (e.g. someone merged via CLI or a direct fast-forward push), fall back to a **content-diff check**: `GET /projects/:id/repository/compare?from=release/<tag>&to=<default>` and treat "no diff" (empty `diffs`) as evidence of merge — content comparison survives squash/rebase even when ancestry doesn't. This is the documented workaround for the squash false-negative class.
- Treat the result as **advisory, not authoritative** — surface "likely merged" / "not detected as merged" with a manual override ("I confirmed this myself"), since even the compare-based check can be wrong if the release branch diverged and was reconciled differently than its own history suggests.
- Cache this check's result short-lived (not `gcTime: Infinity` like most of the app) — it's checked once at "fix version released" time and matters for cross-session staleness.

**Warning signs:**
- Release marked "unfinished" (merge-back not detected) indefinitely even after the team confirms the release branch was merged and deleted.
- False-negative rate concentrated on projects using squash-merge-only settings.

**Phase to address:**
Post-release merge-back check phase — must be built against MR `state`/compare-diff from the first implementation, not "fixed later." The naive ancestry implementation looks correct in manual testing with plain merges and only fails against the team's actual merge strategy (unknown without checking the project's merge-method setting).

---

### Pitfall 3: Fetch-once page-cap pitfall recurs in three-channel MR discovery

**What goes wrong:**
This codebase has a **documented, twice-recurring bug class**: code fetches one capped page from a list endpoint and filters client-side instead of paging to completion (mr-discussions-cap-20, assignee-missing-users). `fetchRecentProjectMRs` in `taskflow/src/services/gitlab.ts` is an *existing, intentional* instance of exactly this pattern (`per_page` capped at 100, single page — explicitly documented as a deliberate performance/accuracy trade-off: "a task whose MR is older than the cap will fall back to Missing MR rather than Wrong milestone"). The v1.14 three-channel union is at high risk of reintroducing this pattern *unintentionally* in:
- **Channel C (release-branch-targeting MRs):** if built via `fetchProjectMRs(...)` with a `target_branch` filter and no pagination loop, a release with >100 MRs targeting the branch silently drops entries.
- **Channel A (Jira-key linkage):** if reused from `fetchRecentProjectMRs`'s existing pattern instead of a properly paginated fetcher, it inherits the same 100-MR-age cap — for release-view drift detection, a silently missing MR means a real drift goes unflagged, which is worse than the original use case's "fall back to a less-specific warning" tolerance.
- **Channel B (milestone-carrying MRs):** `fetchMilestoneMRs` already pages correctly (loops `while (data.length < perPage)`) — this is the pattern to copy, not `fetchRecentProjectMRs`'s.

**Why it happens:**
`fetchRecentProjectMRs` exists in the codebase as a copy-pasteable "fast" pattern; under time pressure it's tempting to reuse it for a new list-then-match feature without re-checking whether the cap is safe for the new use case (drift detection needs completeness; the original use case tolerated staleness/fallback).

**How to avoid:**
- Each of the three discovery channels must page to completion the same way `fetchMilestoneMRs` and the paginated calls in `gitlab.ts` already do — do not build any new channel on `fetchRecentProjectMRs`.
- If a capped/fast path is ever reused for a genuinely optional fallback, it must be clearly labeled load-bearing-vs-not (like the existing GGX-WARN-01 comment), never used for the drift-flagging computation itself.
- Add a test asserting >100 MRs across pages are all captured for the release-branch-targeting and Jira-linkage channels (mirroring the `fetchAllSearchPages` server-side-pagination test coverage established in My Tasks v1.13).

**Warning signs:**
- Release view "drift" count differs from a manual GitLab UI filter count on a release with a long MR history.
- Any new GitLab list call in this milestone missing the `while (data.length < perPage) break; page++` loop already present in `fetchMilestoneMRs`/`fetchProjectMilestones`.

**Phase to address:**
Three-channel MR discovery phase — pagination correctness is a build-time code-review gate; reference `fetchMilestoneMRs` as the canonical pattern in the phase's acceptance criteria.

---

### Pitfall 4: Set-union / drift-classification logic mishandles state, drafts, forks, and branch-name case

**What goes wrong:**
Unioning three channels (Jira-linked, milestone-carrying, branch-targeting) and diffing for "disagreement" has several concrete failure modes:
- **Closed/merged MRs pollute the union.** A merged MR that targeted the release branch and carries the milestone is *correct history*, not something needing a corrective action — but if the union doesn't filter by state, a "wrong target branch" flag could fire on an already-merged MR (nonsensical: you cannot retarget a merged MR) or a closed-abandoned MR (pure noise).
- **Draft MRs get flagged with the same urgency as ready MRs.** A draft correctly targeting the release branch is fine; the same draft flagged for "missing milestone" is lower urgency than a non-draft. Undifferentiated, users get action fatigue fixing WIP work.
- **MRs from forks** have a `source_project_id` different from the target project. Retarget/milestone-assign semantics and permissions can differ (the acting PAT may lack rights on the fork, or milestone-assignment on a cross-fork MR may behave unexpectedly). If discovery doesn't record `source_project_id`, a fork MR gets treated identically to a same-project MR and the write action fails with a confusing error.
- **Branch-name case sensitivity.** Git branch names are case-sensitive; comparing `target_branch === releaseBranchName` with any implicit case-folding will over-match (`Release/1.4.0` treated as `release/1.4.0`) or under-match (a real match missed due to a stray case difference from manual branch creation). Compare exactly, byte-for-byte — do not `.toLowerCase()` branch names for comparison — but *do* normalize the milestone-name → branch-name derivation consistently (Pitfall 5) so ambiguity never arises in the first place.
- **An MR matching multiple channels** must dedupe to one row, not render three times, and "found by ≥2 channels" is not the same as "the channels agree" — an MR could be found by both the branch-targeting and Jira-linkage channels yet still carry the WRONG milestone, which is itself the drift signal.

**Why it happens:**
Set-union code is usually written channel-by-channel and merged with a naive `Map` keyed loosely (e.g. by title), without an upfront state filter and without carrying enough metadata (state, draft, source_project_id) through to the union for downstream classification.

**How to avoid:**
- Filter to `state: 'opened'` (or explicitly bucket a separate "merged/closed — informational only" group) as the first step after each channel fetch, before unioning.
- Carry `draft`, `state`, `source_project_id`, and `target_branch` through into the unioned MR record (not just iid+title) so classification downstream has what it needs without re-fetching.
- Dedupe by `project_id:iid` (numeric composite key, never title-matching) into a `Map`, with a `foundByChannels: Set<'jira'|'milestone'|'branch'>` field so "which channels found this" and "does its data match expectations" stay separate checks — union membership ≠ drift-free.
- Exact-match branch-name comparison (no case folding); a case-only mismatch is genuine drift, not a false positive to special-case away.
- For fork MRs, either exclude them from corrective actions entirely (flag "external — not actionable") or explicitly test retarget/milestone-assign against a fork MR before shipping — this codebase's only existing GitLab write (`updateMilestone`) has never touched a cross-fork object.

**Warning signs:**
- Drift count includes merged MRs from months ago.
- Retarget button rendered on a closed MR.
- Duplicate rows for what is visibly the same MR — dedup key is wrong.

**Phase to address:**
Three-channel union + drift-flagging phase — write unit tests with fixtures covering: merged MR, closed MR, draft MR, fork MR, case-differing branch name, MR found by 1/2/3 channels, before wiring up the UI.

---

### Pitfall 5: Deriving `release/<milestone name>` breaks on spaces, slashes, and non-ASCII milestone names; branch creation collides with pre-existing branches

**What goes wrong:**
The milestone format is `1.1.0`/`2.0.0` (mostly safe), but:
- Git branch names **cannot contain spaces**, and have restrictions on `..`, `~`, `^`, `:`, `?`, `*`, `[`, trailing `/`, trailing `.lock`, leading `-`, and consecutive/leading/trailing dots. If a milestone is ever named anything other than the strict `X.Y.Z` pattern (a typo, a hotfix milestone like `1.1.0 hotfix`, or trailing whitespace pasted from Jira), naive string interpolation (`` `release/${milestone.title}` ``) produces an invalid ref and the create-branch call fails opaquely, or a half-applied sanitization silently creates a branch with a different name than what's displayed.
- Milestone titles are freeform GitLab text — nothing stops `1.1.0` and `1.1.0 ` (trailing space) existing as two distinct milestones. If both branch-name derivation and channel-B milestone-title matching (`fetchMilestoneMRs` takes a raw title string) don't trim consistently, a stray space silently returns zero milestone-carrying MRs, which reads as "no drift" rather than the true cause.
- **Branch already exists.** Creating `release/1.4.0` when it already exists (created via CLI, or a retry of a previously-successful-but-timed-out call) returns a 400 from `POST /repository/branches`. If the app doesn't treat "already exists" as idempotent success, the confirm-dialog action surfaces a scary error for a state that's actually fine.

**Why it happens:**
The milestone name is treated as an already-clean identifier because the *documented* format is simple, but the field is free text at the GitLab API level with no format enforcement, and "user types the final name" in the milestone-creation flow means the app cannot assume the string it later interpolates into a branch name has been validated.

**How to avoid:**
- Validate/sanitize at milestone-creation time: reject or trim milestone names that would produce an invalid git ref when prefixed with `release/` (whitespace, control characters, leading `-`, trailing `.`/`/`). Since the app controls milestone creation UX in this milestone, this is enforceable at the source.
- Trim milestone title before EVERY use — both branch-name derivation and channel-B milestone-title matching.
- Before calling create-branch, re-check existence via `GET /repository/branches/:branch` inside the action itself (not relying on state read at page-load, since concurrent creation is possible — Pitfall 6), and treat "already exists with the correct name" as success.
- Encode branch names correctly when used as an API path segment — this codebase already does `encodeURIComponent(milestoneTitle)` for query params elsewhere; branch names in path position need the same care (GitLab requires full encoding of slashes/special characters in path-segment refs).

**Warning signs:**
- "Create branch" confirm dialog fails with a raw GitLab 400 body shown to the user instead of a friendly message.
- Milestone-carrying channel returns unexpectedly empty for a milestone visibly carrying MRs in GitLab's UI.
- Two visually-identical milestones (whitespace-only difference) confusing the release view.

**Phase to address:**
Both the milestone-creation phase (sanitize at creation time) and the branch-creation phase (existence re-check + idempotent-exists handling) — cross-reference each other's validation so a name accepted by one flow is guaranteed safe for the other.

---

### Pitfall 6: Concurrency — cached MR/milestone/branch state driving a write action, with no server-side compare-and-swap

**What goes wrong:**
GitLab REST offers no ETag/If-Match compare-and-swap for these mutations. The release view reads from TanStack Query cache (populated by three-channel discovery) and fires writes based on that snapshot. Between fetch and click — or between two team members viewing the same release simultaneously:
- Someone else already retargeted the MR → the app's rollback-on-failure path might restore the UI to "my locally cached previous value" rather than current server truth, un-fixing a teammate's legitimate concurrent change.
- Someone else already assigned/removed the milestone → last-write-wins on the PUT itself is usually fine, but a *failed* mutation's rollback restoring a stale local snapshot can still visually revert a third person's change even though the server state is untouched.
- **The release branch gets created by two people near-simultaneously** (both viewing "branch missing" state) → first request succeeds, second gets a 400 (exists); per Pitfall 5 this must be idempotent-success, not a failure requiring dialog re-trigger.
- Milestone state changes elsewhere (someone closes it directly in GitLab) while cached as active — subsequent assigns still nominally succeed, but "is release ready" status computed from the stale cached milestone is wrong until refetched.

**Why it happens:**
This is the same shape as the codebase's already-logged "Enrichment invalidation no-op" and "Reactive cache-read badge" bug classes: derived UI state computed from a query that goes stale, with mutation success/rollback logic that doesn't force a refetch of the *upstream* source of truth. The v1.12 drag-to-rank fix (`cancelQueries` + drag-gated local order) solves a different flavor of this — protecting against a background refetch snapping optimistic state back mid-interaction — but doesn't cover "another user acted between my fetch and my click," which needs refetch-after-mutation, not just protect-during-mutation.

**How to avoid:**
- On every per-MR mutation (retarget, milestone-assign), on both success AND failure, refetch that specific MR's detail (not just optimistically patch local cache) so drift flags recompute from truth — mirrors the "invalidate the upstream source, not just the derived query" lesson.
- Rollback-on-failure should restore to "last known server state" (refetch), not "the value cached before I clicked."
- Treat branch-create 400 "already exists" and milestone-assign-already-assigned as **success**, not failure — this also directly reduces Pitfall 7's failure surface across N independent writes.
- Use the existing `useIsActiveRoute` route-aware polling pattern (or manual refresh) on the release view specifically, since — unlike most of this app's per-user views — this is multi-person-editing; staleness tolerance is lower here.
- Surface a "last refreshed" timestamp + manual refresh affordance on the release detail view (extends the existing app-wide pattern from v1.0) so users have a visual cue their drift computation might be stale before acting.

**Warning signs:**
- Two people report "I fixed that MR but it still shows as drifted."
- Rollback occasionally "un-fixes" something a teammate just fixed.
- Retry-after-failure on branch/milestone creation throws a confusing duplicate error instead of succeeding silently.

**Phase to address:**
Every phase that adds a write must include: (1) idempotent-success handling for "already exists/already assigned" 400s, (2) refetch-not-optimistic-restore on rollback. Establish this in the shared mutation pattern in the first write-adding phase so later phases reuse it rather than re-deriving it.

---

### Pitfall 7: Partial failure across N independent per-MR writes has no batch semantics, and the UI must not imply atomicity

**What goes wrong:**
"Per-MR corrective actions... applied directly... per-row inline status and retry" explicitly rules out a bulk "fix all" (v1.12 bulk-subtask precedent: sequential + per-row retry, not `Promise.all`). Risks specific to this milestone:
- If a future convenience ("select several, retarget") uses `Promise.all`, one 403 rejects the whole batch's promise, hiding which of the N actually succeeded — the v1.12 lesson (sequential loop, per-row status, retry-failed-only) must be explicitly re-applied, not assumed to transfer since this is updates to existing resources rather than creates.
- **Two different write types per MR** (retarget AND milestone-assign) may both be needed on the same row for the same drift. Each must be an independent mutation with its own row-level status/retry — coupling them into one "fix this row" black box makes a milestone-assign-success-but-retarget-failure state impossible to represent or retry correctly.
- **Retry after partial failure must re-check current state**, not resend the original payload — if the first attempt actually succeeded server-side but the response was lost (network blip, plausible on this team's VPN-gated on-premise setup), a naive retry could resend a redundant-but-harmless write (fine — treat as idempotent per Pitfall 6) or could retry against a stale closure value that no longer matches reality.

**Why it happens:**
This app has more experience with N-independent-*creates* (bulk subtask creation) than N-independent-*updates*-to-existing-resources; the retry mental model looks similar but idempotency guarantees differ (creates can duplicate on retry; these updates generally can't — but only if treated that way explicitly).

**How to avoid:**
- Model retarget and milestone-assign as two separate mutations per row with independent status/retry UI, matching the v1.12 subtask per-row pattern.
- Retry always re-fetches/re-derives the target payload from current server state before resending — never trust the stale closure value from the original click.
- No `Promise.all` across rows for any future "select several" convenience — reuse the sequential-with-per-row-status executor pattern already proven in bulk subtask creation (v1.12 Phase 80).

**Warning signs:**
- A retry button that just resends the exact same request object captured at first-click time.
- Any code path using `Promise.all` across multiple MR row mutations.

**Phase to address:**
Per-MR corrective-actions phase — establish the row-mutation pattern (two independent mutations per row, retry re-derives payload) as the phase's core deliverable, tested against a simulated partial-failure fixture (N MRs, 1 fails).

---

### Pitfall 8: Buttons that always 403 for Reporter-level tokens — no capability detection or graceful degradation

**What goes wrong:**
This app is used by both developers and PMs; the app-internal Developer/PM role concept was removed in v1.10, but that says nothing about each person's actual GitLab project role. A PM's GitLab PAT is plausibly Reporter-level (read-only) on the project. If the release view renders "Create branch"/"Retarget"/"Assign milestone"/"Create milestone" buttons unconditionally:
- Every write 403s for Reporter-role users, and this codebase's existing GitLab error handling largely collapses 401/403 into flat generic strings — a PM clicking "Create branch" gets an opaque error with no indication their *role*, not their *token validity*, is the blocker.
- Milestone creation and branch creation typically require at least Developer; even Developer-role users can be blocked by protected-branch push/merge allowlists — a second, distinct 403 cause that role-level alone cannot predict without an extra per-branch check.

**Why it happens:**
GitLab exposes no single "can I write here" boolean for arbitrary future actions — capability is a function of (project member access_level) × (protected branch rules) × (approval settings) — and the naive approach is to just attempt the write and catch the 403, which reads as "the app is broken" rather than "you lack permission."

**How to avoid:**
- On project selection / release-view load, fetch the current user's project access level (`GET /projects/:id` includes `permissions.project_access.access_level` for the authenticated token, or `GET /projects/:id/members/all/:user_id`) — GitLab levels: 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner. Cache per project/session (changes rarely).
- Gate write-action buttons on `access_level >= 30` (Developer) as a baseline; still attempt the call and surface the real error for the protected-branch-rules edge case role-level alone can't catch.
- Below Developer, replace action buttons with a disabled state + tooltip explaining why, rather than hiding entirely — hiding would make PMs think the feature doesn't exist; a disabled-with-reason state matches this app's existing "illustrated empty states and actionable error recovery" design language (v1.3).
- If a 403 still happens despite the role gate (protected-branch edge case), surface GitLab's actual error body — this codebase already does this for `updateMilestone` (`body?.message ?? status code`); extend that pattern to every new write endpoint by default rather than the flatter `ApiError('Failed to X', status, 'gitlab')` used elsewhere.

**Warning signs:**
- Support/UAT report: "the retarget button just spins and fails for me but works for my teammate."
- New write endpoints reusing the generic flat `ApiError` pattern instead of surfacing GitLab's response body message.

**Phase to address:**
Should land early — ideally the first release-management-write phase, since every subsequent write phase's buttons need this gate. If sequencing makes that impractical, at minimum each write phase must surface GitLab's real 403 error-body message (cheap, already proven in `updateMilestone`), with the proactive access-level gate landing no later than the phase that ships the first always-rendered, end-user-visible write button.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Reusing `fetchRecentProjectMRs`'s single-page-cap pattern for a new discovery channel | Fast to write, matches an existing function signature | Silent drift under-detection on releases with >100 recent MRs — a false "all clear" is worse than a slower UI | Never for drift-detection channels; acceptable only for genuinely optional/fallback UX like the original GGX-WARN-01 use case |
| Treating branch `merged: true/false` API field as authoritative for merge-back check | Zero extra API calls, one field read | False negatives on squash/rebase-merged release branches — likely this team's actual merge strategy | Never — always pair with MR-state or compare-diff cross-check |
| Skipping the GitLab access-level fetch and just catching 403 on click | Saves one API call per session | Buttons that "look broken" for Reporter-role PMs; erodes trust in the release view | Acceptable only as an interim Phase-1 shim if role-gating is explicitly deferred, with a tracked follow-up |
| Optimistic-update-then-local-cache-rollback (no refetch) on retarget/milestone-assign failure | Simpler mutation code, matches existing StatusPopover pattern | Rollback can stomp a concurrent teammate's legitimate change (Pitfall 6) | Acceptable for single-user-editing surfaces (issue transitions); not acceptable for this multi-editor release view |
| Naive `${prefix}${milestone.title}` branch-name interpolation | One-line derivation | Invalid-ref API errors or silent name mismatches on any milestone title with whitespace/special chars | Never — sanitize/validate at milestone-creation time instead |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|------------------|-------------------|
| GitLab MR retarget (`PUT .../merge_requests/:iid` with `target_branch`) | Treating it as a metadata-only write | Recognize it resets approvals, invalidates pipeline relevance, and can outdate diff discussions — surface this explicitly, refetch approval/pipeline state after |
| GitLab branch "merged" detection | Using `GET /repository/branches/:branch` → `merged` field or a merge-base walk | Use the release MR's `state`/`merged_at` when available, or `repository/compare` content-diff as fallback; treat as advisory |
| GitLab branch creation (`POST /repository/branches`) | Surfacing "already exists" 400 as a hard error | Re-check existence first; treat "exists with expected name" as idempotent success |
| GitLab milestone creation (`POST /projects/:id/milestones`) | Allowing free-text title through to branch-name derivation unsanitized | Validate/trim milestone title against git ref rules at creation time |
| GitLab MR list endpoints (three discovery channels) | Single capped page (per_page=100, no loop) | Always page to completion — mirror `fetchMilestoneMRs`'s existing while-loop, not `fetchRecentProjectMRs`'s cap |
| GitLab role/permission checking | Only discovering insufficient permission via a failed write's 403 | Proactively fetch project access_level on load and gate/disable buttons with an explanatory state |
| TanStack Query cache driving a write's payload | Reading `target_branch`/`milestone` from a query that may be minutes stale in a multi-editor view | Refetch the specific MR/milestone/branch record immediately before or after the mutation; don't trust list-query cache for write payloads on a shared-editing surface |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|-------------|-----------------|
| Enriching every unioned MR with full detail + approvals + discussions (mirroring `fetchParticipatedMRs`'s N-detail-fetch pattern) for every MR in a release | Slow release-detail page load, N+1 fan-out | Only fetch approval/pipeline/discussion detail for MRs actually flagged as drifted or targeted for a write action, not the whole union eagerly | Releases with 50+ MRs across all three channels |
| Re-deriving "is release merged back" on every render/poll via a fresh compare-diff call | Repeated heavy `repository/compare` calls (potentially large diffs) on a polling interval | Compute once when fix-version is marked released, cache with an explicit manual-refresh affordance, not route-level polling | Any release with a large branch diff history |
| Fetching project access_level on every release-view mount | Redundant identical API calls per navigation | Cache per project/session (access level changes rarely); reuse existing project-scoped query key convention | Frequent navigation in/out of the release view |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|-------------|
| Assuming app-level Developer/PM UI role (removed in v1.10) implies GitLab-level project permission | A PM whose app shows no role gating clicks a write button that always 403s, or worse, a Reporter-role token is allowed to attempt writes with confusing failures | Fetch and gate on actual GitLab `access_level`, independent of any app-internal role concept |
| Logging full GitLab error response bodies via the dev-tools request logger without redaction for these new write endpoints | Minor local info exposure (low severity — local desktop app), but still worth noting | Follow existing dev-tools logging conventions already applied to `updateMilestone`; no new exposure surface if the pattern is reused as-is |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| No confirm dialog on retarget/milestone-assign (per spec) but also no post-action visibility into approval/pipeline loss | User discovers lost approvals only when they later check GitLab directly, feels the app "broke" something silently | Inline warning/toast at action time surfacing "approvals will be/were cleared" — informational, not blocking, consistent with the "no confirm dialog" requirement |
| Drift flags computed once at page load, never distinguished from "already being fixed by someone else right now" | Two team members simultaneously "fix" the same row, one's action looks like a no-op or a confusing revert | Refetch the specific row after every mutation (Pitfall 6); consider a lightweight "recently updated by X" indicator using the MR's own `updated_at` |
| Fork MRs and draft MRs rendered identically to normal targetable MRs in the drift list | Wasted clicks on actions that will fail or don't make sense yet | Visually distinguish (badge) draft and fork-origin MRs in the union; consider excluding forks from one-click corrective actions |
| Branch-name/milestone-name mismatches from whitespace shown as "no drift" or "unrelated" rather than "probable near-miss" | User has to manually spot a trailing-space milestone name is why matching failed | Trim consistently everywhere (Pitfall 5) so this class of near-miss cannot occur, rather than surfacing it as a UX hint after the fact |

## "Looks Done But Isn't" Checklist

- [ ] **MR retarget action:** Often missing approval/pipeline-loss awareness — verify the row shows a warning and post-mutation state reflects cleared approvals, not stale "approved" badges.
- [ ] **Post-release merge-back check:** Often missing squash/rebase handling — verify it's tested against a squash-merged release branch fixture, not just a plain merge-commit fixture, before considering it correct.
- [ ] **Three-channel MR discovery:** Often missing pagination completeness — verify with a fixture/test asserting >100 MRs across channels are all captured, not just the happy-path <100 case.
- [ ] **Branch/milestone creation confirm dialogs:** Often missing idempotent "already exists" handling — verify clicking Create twice (or two users clicking near-simultaneously) doesn't surface a scary raw error.
- [ ] **Permission gating:** Often missing entirely (buttons always rendered) — verify a Reporter-role token sees disabled buttons with an explanatory tooltip, not a live button that 403s.
- [ ] **Milestone name → branch name derivation:** Often missing sanitization — verify a milestone with a space, trailing whitespace, or non-ASCII character either gets rejected at creation or produces a valid, correctly-matching branch name end to end.
- [ ] **Drift-flagging union:** Often missing state/draft/fork filtering — verify merged, closed, draft, and fork MRs are each handled per their intended (not default/generic) treatment, with test fixtures for each.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| Retarget silently cleared approvals with no warning shipped | LOW | Ship the inline warning as a follow-up patch; historical MRs already retargeted cannot have approvals restored — communicate to the team this was GitLab's own behavior, not app-caused corruption |
| Merge-back check gives false negative on squash-merged branch | MEDIUM | Add MR-state/compare-diff fallback; for releases already stuck "unfinished," a manual override/dismiss action lets a PM mark it resolved by hand while the detection logic is fixed |
| Pagination cap silently dropped MRs from drift detection | LOW–MEDIUM | Fix the pagination loop; re-run discovery for affected releases — no data was mutated incorrectly, only under-reported, so recovery is a re-fetch, not a data-repair task |
| Branch created with an invalid/mismatched name due to unsanitized milestone title | MEDIUM | Requires a manual GitLab-side branch rename or delete-and-recreate; add validation retroactively and document the affected release needs manual branch cleanup |
| Concurrent-write rollback stomped a teammate's legitimate change | LOW | Rollback only reverts local UI cache, not server state, so a simple refetch/page-reload restores correct state for the affected user — no server-side data was actually lost |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Retarget side-effects (approvals/diff/pipeline/discussions) not surfaced | Per-MR corrective-actions phase (retarget mutation) | Row shows approval-loss warning pre/post action; approval/pipeline query refetched and reflects cleared state after a real retarget against a test MR with existing approvals |
| 2. Merge-back check false negatives on squash/rebase | Post-release merge-back check phase | Test fixture with a squash-merged release branch passes detection; ancestry-only implementation is rejected in code review |
| 3. Fetch-once page-cap in discovery channels | Three-channel MR discovery phase | Test asserting >100-MR fixture returns complete results for all three channels; code review checks no new channel calls `fetchRecentProjectMRs` |
| 4. Set-union/classification errors (state, draft, fork, case) | Three-channel discovery + drift-flagging phase | Fixture-based unit tests for merged/closed/draft/fork/case-mismatch MRs each produce the intended classification |
| 5. Branch-name derivation and idempotent branch creation | Milestone-creation phase + branch-creation phase | Milestone title with space/whitespace/unicode rejected or sanitized at creation; double-create-branch test returns success not error |
| 6. Concurrency/staleness driving writes off cache | First write-adding phase (establishes shared mutation pattern) | Mutation success/failure both trigger a refetch of the specific record, not just local optimistic patch; simulated concurrent-edit test (two mutations racing) doesn't leave stale UI |
| 7. Partial failure across N independent per-MR writes | Per-MR corrective-actions phase | Partial-failure fixture (N MRs, 1 fails) leaves correct per-row status; retry re-derives payload from fresh state, not stale closure |
| 8. Missing permission detection/degradation | Ideally the first write-adding phase; at minimum, every write phase surfaces real GitLab error-body messages | Reporter-role token fixture shows disabled buttons with tooltip; Developer-role-but-protected-branch 403 shows GitLab's actual message, not a generic string |

## Sources

- [GitLab Merge requests API](https://docs.gitlab.com/api/merge_requests/) — HIGH confidence, official docs
- [GitLab Merge request approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/) — HIGH confidence, official docs; confirms approvals reset on target branch change
- [GitLab issue: code owner approvals not reset on target branch change (#415496)](https://gitlab.com/gitlab-org/gitlab/-/work_items/415496) — MEDIUM confidence, GitLab issue tracker; confirms approval-reset is intended design, flags an inconsistency
- [GitLab issue: squash merge doesn't add 'merged' label, incorrect ahead/behind (#36963)](https://gitlab.com/gitlab-org/gitlab/-/issues/36963) — HIGH confidence, GitLab issue tracker; core evidence for Pitfall 2
- [GitLab Squash and merge docs](https://docs.gitlab.com/user/project/merge_requests/squash_and_merge/) — HIGH confidence, official docs
- [GitLab Merge request pipelines](https://docs.gitlab.com/ci/pipelines/merge_request_pipelines/) — HIGH confidence, official docs; protected-branch pipeline access depends on both source and target protection
- [GitLab Roles and permissions](https://docs.gitlab.com/user/permissions/) — HIGH confidence, official docs; Reporter vs Developer capability baseline
- [GitLab Protected branches](https://docs.gitlab.com/user/project/repository/branches/protected/) — HIGH confidence, official docs; protected-branch push/merge allowlists as a second permission layer beyond role
- Project codebase: `taskflow/src/services/gitlab.ts` — HIGH confidence, direct inspection; source of pagination-pattern comparison (`fetchMilestoneMRs` vs `fetchRecentProjectMRs`), existing error-handling gaps, and the only pre-existing write (`updateMilestone`)
- Project memory (`.claude` MEMORY.md): fetch-once page-cap pitfall, enrichment invalidation no-op, reactive cache-read badge, optimistic-override-must-outlive-refetch — HIGH confidence, verified recurring codebase bug classes, cross-checked against this milestone's features above

---
*Pitfalls research for: git-flow release-coordination write features on GitLab, added to Taskflow (Tauri 2 desktop app) — v1.14 Release Management*
*Researched: 2026-08-10*
