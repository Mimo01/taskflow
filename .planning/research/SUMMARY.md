# Project Research Summary

**Project:** Taskflow — v1.14 Release Management
**Domain:** Git-flow release-coordination write features (GitLab branch/milestone/MR mutations) bolted onto an existing read-mostly Tauri 2 + React 18 + TanStack Query desktop app
**Researched:** 2026-08-10
**Confidence:** HIGH (stack, architecture, pitfalls all grounded in direct codebase inspection + verified GitLab docs; features MEDIUM — no hands-on access to competitor UIs)

## Executive Summary

v1.14 turns the Releases view from a read-only Jira↔GitLab date-match into a working release-coordination surface: detect whether `release/<milestone>` exists, create it if not, union three independent signals (Jira fix-version linkage, GitLab milestone, branch target) to surface drift, let the user fix drift per-MR with no bulk "fix all," and verify merge-back once a release ships. Every capability maps to plain `fetch` calls through the existing `apiFetch('gitlab', ...)` wrapper — no new dependency, no GitLab SDK. The five new writes (`createBranch`, `createMilestone`, `updateMRTargetBranch`, `assignMRMilestone`, plus the read-heavy `fetchBranch`/`fetchBranchTargetingMRs`) all extend `services/gitlab.ts` in the exact shape of the app's one existing write, `updateMilestone`.

The recommended approach is architecture-led: decompose the 1518-line `ReleaseDetailPage.tsx` into a `release-detail/` sibling folder (mirroring the existing `issue-detail/` 25-file precedent) as a pure, zero-behavior-change refactor *before* adding any new UI, then build branch-lifecycle and drift-detection as largely independent, parallelizable vertical slices. This keeps every new section testable in isolation and avoids compounding an already-overloaded monolith.

The dominant risk is that this milestone introduces the app's *first* multi-writer, high-consequence GitLab mutations (retargeting resets MR approvals, invalidates pipelines, and orphans diff discussions) into a codebase whose only precedent write (`updateMilestone`) is low-stakes and single-purpose. A second, sharper risk is a bug class this codebase has already hit twice (fetch-once page-cap silently truncating results) recurring a third time in the three-channel discovery, and a third is that the two most "obviously simple" reads in this milestone — branch-exists and branch-merged — are the two places GitLab's own API is documented to lie (squash/rebase merges break ancestry-based "merged" detection). All three are addressed explicitly below with concrete phase-level mitigations, not deferred as follow-up polish.

## Key Findings

### Recommended Stack

No new dependencies. All 5-7 new GitLab capabilities (default-branch read, branch existence+merge check, branch create, milestone create, MR target-branch update, MR milestone-assign) are single REST v4 calls through the app's existing `apiFetch('gitlab', ...)` + `PRIVATE-TOKEN` pattern. Every endpoint is core GitLab Free/CE surface with no version-gating risk across gitlab.com or self-hosted. New functions land in `taskflow/src/services/gitlab.ts` (not a new module — the file is still a flat, cohesive service, unlike the already-split `jira.ts`), following `updateMilestone`'s exact try/catch → 401/403 `ApiError` → body-message-fallback shape.

**Core technologies:**
- `fetch` via `apiFetch('gitlab', ...)` — same transport as 20+ existing GitLab calls, no CORS/Tauri-webview unknowns
- `GET /projects/:id/repository/branches/:branch` — branch existence check (also returns `merged`, see Conflict 1 below)
- `POST /projects/:id/repository/branches`, `POST /projects/:id/milestones`, `PUT /projects/:id/merge_requests/:iid` — the four new writes

### Expected Features

Table stakes for any git-flow release-coordination surface: branch existence detection + guarded create, an MR-to-release membership list (already ~60% built), wrong-target-branch and missing-milestone flags (extends the existing `wrongMilestoneByKey` badge pattern verbatim), a per-item fix action co-located with the flag (no navigate-away), and post-release merge-back verification. All seven are already committed in PROJECT.md's Active requirements — feature research confirms none of them are over-scoped or under-scoped relative to how git-flow tooling and release dashboards are conventionally built elsewhere.

**Must have (table stakes, all P1 in FEATURES.md's matrix):** release branch resolve/detect, guarded branch create, three-channel MR union, drift flagging, per-MR retarget+assign, guarded milestone create, merge-back check.

**Differentiator:** the three-channel union with per-channel provenance itself — no competitor product researched (GitLab's own dashboard, Jira Release Hub, LinearB/Swarmia) does true three-way reconciliation; most trust one channel (usually the milestone) as ground truth. This is this milestone's actual competitive edge, not a side effect.

**Explicitly out of scope / anti-features (already decided, do not re-litigate):** historical analytics/DORA dashboards, "fix all" bulk action, silent auto-retarget or auto-merge-back, customizable widget dashboards, Slack/email notifications, GitLab review actions (approve/request-changes) — all directly ruled out by PROJECT.md precedent (v1.9/v1.13 widget and analytics rejections) or by the milestone brief itself.

### Architecture Approach

Extend, don't redesign. `ReleaseDetailPage.tsx` decomposes into a `release-detail/` sibling folder mirroring the `issue-detail/` convention (one file per section, hooks-as-`.ts`-files, props-only communication — no `createContext`). A new pure module `services/releaseFlow.ts` (sibling to `releaseLinker.ts`, zero I/O, fully unit-testable) owns three-channel union and drift classification over already-fetched arrays. All new GitLab writes append to `gitlab.ts`. Branch-existence and merge-back status are plain `useQuery` (server-derived facts), never Zustand (reserved for client-owned persisted state).

**Major components:**
1. `release-detail/ReleaseBranchSection.tsx` + `useReleaseBranchState.ts` — branch existence, create-branch dialog, merge-back check
2. `release-detail/ReleaseDriftSection.tsx` + `useReleaseGitlabWrites.ts` — three-channel drift table, per-row optimistic retarget/assign mutations
3. `services/releaseFlow.ts` — pure union/drift-classification logic, no fetch, fixture-testable
4. `services/gitlab.ts` (extended) — 5-6 new functions in `updateMilestone`'s exact shape

### Critical Pitfalls

1. **Retargeting is not a metadata edit** — it resets MR approvals, invalidates the diff base/pipeline, and can orphan diff discussions. No confirm dialog is spec'd, so an inline per-row warning ("Retargeting will clear N approval(s)") is required at the same time the mutation ships, plus a post-mutation refetch of approval/pipeline state — never leave stale "approved" badges showing.
2. **Fetch-once page-cap recurs a third time** — `fetchRecentProjectMRs` is deliberately capped at 100 for a *secondary* heuristic; reusing it for any of the three drift-discovery channels reintroduces a bug class already hit twice in this codebase (My Tasks, MR-discussion/assignee pickers). Every new discovery channel must copy `fetchMilestoneMRs`'s full-pagination `while` loop, never `fetchRecentProjectMRs`'s cap.
3. **Merge-back "merged" field lies on squash/rebase merges** — see Conflict 1 resolution below; must not be treated as authoritative.
4. **Set-union/drift classification must filter state, draft, fork, and use exact (non-lowercased) branch-name comparison** — unfiltered, merged/closed MRs pollute drift counts, drafts get flagged with false urgency, and fork MRs can fail corrective-action writes with confusing errors.
5. **No GitLab role/permission detection exists anywhere in this app** — write buttons rendered unconditionally will 403 for Reporter-level tokens (plausible for PM users) with no explanation; this must be addressed in the first write-adding phase, not per-button later.

## Implications for Roadmap

### Reconciled Build Order

ARCHITECTURE.md and PITFALLS.md agree on the overall shape; PITFALLS.md's contribution is that two concerns (permission gating, shared write-mutation contract) must be established **in the first phase that ships a real write**, not deferred. Reconciled order (numbers are dependency-ordered, not final phase numbers — the roadmapper should size/group these):

1. **Decompose `ReleaseDetailPage.tsx` → `release-detail/`** — pure mechanical extraction (header, description, issues table, unmatched-MRs, sidebar, edit dialog), zero new behavior, zero new tests needed beyond "still passes." Ships first so every subsequent addition lands in the new structure, not the monolith.
2. **Branch existence (read-only) + release-level warning** — `fetchProjectDefaultBranch`, `fetchBranch`; `ReleaseBranchSection.tsx`; small `ReleasesTab.tsx` row addition. No writes yet.
3. **First write phase — establishes the shared contract, ships alongside `createBranch`:**
   - `createBranch` (confirm-dialog gated) + `CreateBranchDialog.tsx`.
   - **Cross-cutting, must land here, reused by every later write phase:** (a) GitLab project access-level fetch + button gating/disabling for sub-Developer roles (Pitfall 8) — no app-internal role concept exists post-v1.10, so this is a wholly new capability; (b) the shared mutation contract — idempotent-success handling for "already exists"/"already assigned" 400s, and rollback-on-failure that refetches the upstream record rather than restoring a locally-cached pre-mutation snapshot (Pitfall 6, directly extending this codebase's already-logged "enrichment invalidation no-op" / "reactive cache-read badge" lessons).
   - `createMilestone` (confirm-dialog gated) + `CreateMilestoneDialog.tsx`, with milestone-title sanitization against git-ref rules enforced at creation time (Pitfall 5) — can ship in parallel with `createBranch` since it shares the contract but not the branch-name derivation.
4. **Three-channel MR discovery + drift flagging (read-only)** — new fully-paginated `fetchBranchTargetingMRs` (copy `fetchMilestoneMRs`'s loop, never `fetchRecentProjectMRs`); `services/releaseFlow.ts` pure union/classification module with fixture-based unit tests covering merged/closed/draft/fork/case-mismatch MRs; `ReleaseDriftSection.tsx` rendering the read-only drift table. Depends on (2) for the resolved branch name; independent of (3).
5. **Per-MR corrective actions (write, optimistic, no confirm dialog)** — `updateMRTargetBranch`, `assignMRMilestone` as two independently-retryable mutations per row (see Conflict 2 resolution below); inline approval/pipeline-loss warning at action time; retry re-derives payload from fresh server state rather than a stale closure. Hard dependency on (4).
6. **Post-release merge-back check** — `fetchBranchMergeStatus`/MR-state lookup (see Conflict 1 resolution), advisory framing with manual override. Depends on (2) only; can ship any time after it, but naturally closes the milestone narrative.

### Phase Ordering Rationale

- Phase 1 exists purely to make every later phase land in a reviewable, section-scoped file rather than growing an already-6-concern monolith further — this is a near-zero-risk prerequisite, not busywork.
- The first *write* phase (3) is deliberately overloaded with two cross-cutting concerns (permission gating, mutation contract) because every subsequent write phase (5, and `createMilestone`/`createBranch` themselves) depends on both existing — retrofitting them after multiple write surfaces already shipped would mean re-deriving the pattern N times instead of once.
- Discovery/drift (4) and per-MR actions (5) are kept as two phases, not one, because (4) is read-only and independently shippable/reviewable as "does the drift report look right" before any write risk is introduced — this also isolates Pitfall 3 (pagination) and Pitfall 4 (set-union correctness) verification from Pitfall 1/6/7 (write-side correctness).
- Merge-back (6) is architecturally independent of discovery/drift entirely (it only needs the branch name + Jira `released` flag) — it can slot in anywhere after phase 2, but is sequenced last here because it's the natural "closes the loop" milestone capstone and its correct implementation (Conflict 1) benefits from the mutation-contract lessons already established by phase 3.

### Research Flags

Phases likely needing deeper research or a live probe during planning:
- **Merge-back check phase (6):** the exact GitLab merge-strategy setting in use on this team's actual project (squash-merge-only vs merge-commit) is unknown and materially changes which detection method is trustworthy — probe the team's project settings and/or test against a real squash-merged branch before finalizing the implementation, per Conflict 1 below.
- **First write phase (3), permission gating sub-task:** the exact PAT role(s) in active use by this team's PMs vs developers is unverified — confirm at least one Reporter-level and one Developer-level token exist to test the gating UI against, or the "disabled with tooltip" path ships untested.
- **Three-channel discovery phase (4):** whether the team's GitLab instance has any project with >100 MRs targeting a single release branch is unknown; if not reproducible organically, build a synthetic >100-MR fixture for the pagination-completeness test rather than skipping it.

Phases with standard, well-documented patterns (safe to skip `--research-phase`):
- **Decompose phase (1):** pure refactor, `issue-detail/` is a proven in-codebase precedent.
- **Branch existence / create-branch / create-milestone phases (2, part of 3):** GitLab REST v4 core surface, HIGH-confidence verified endpoint shapes (see Conflict 3 below), `updateMilestone` is a direct in-file precedent for every new write's error handling.

## Conflicts Resolved

### 1. Merge-back detection method — PITFALLS wins, treat as advisory

**Resolution:** Do **not** use `GET /repository/branches/:branch` → `merged: boolean` as the authoritative "has release/x been merged back" signal. PITFALLS.md's citation (GitLab issue #36963, squash-merge ahead/behind and "merged" reporting incorrectly, still open) is specific, corroborated by GitLab's own squash-and-merge docs, and describes a failure mode (ancestry-based detection breaking under squash/rebase) that is mechanically certain, not a corner case — squash-created commits are genuinely never ancestors of the target, so any ancestry check (the `merged` field or a client-side merge-base walk) will false-negative whenever the team's actual merge strategy is squash or rebase, which is unknown but plausible for this team.

**Final recommendation:** Layer the check —
1. If a tracking MR for `release/<tag>` → `<default branch>` exists, treat its `state === 'merged'` (and `merged_at`) as the primary, trustworthy signal — GitLab records this regardless of merge method.
2. If no such MR is guaranteed (direct CLI merge, fast-forward push), fall back to `GET /repository/compare?from=<default>&to=<release-branch>` and treat an empty `diffs` array as evidence of merge — content-diff survives squash/rebase where ancestry doesn't.
3. The cheap `merged: true` field from the single-branch GET may still be read as a **positive-only, zero-cost fast path** (if it says `true`, trust it — false positives on this field are not a documented failure mode) but a `merged: false` result must never be surfaced as "not merged" on its own; it must fall through to steps 1-2 before any negative verdict is shown.
4. Render the final verdict as **advisory** ("likely not yet merged") with a manual "I confirmed this myself" override, never as a hard blocking state — even the compare-diff fallback can be wrong if the release branch diverged and was reconciled non-standardly.

STACK.md's claim that the single-branch GET alone "serves both branch-existence AND the post-release merge-back check" is accurate for branch-existence only; it is not sufficient, standalone, for the merge-back verdict. Both research files are right about different halves of the same call.

### 2. One combined PUT vs two separate mutations — two mutations wins

**Resolution:** Two independently-callable functions, `retargetMR` (aka `updateMRTargetBranch`) and `assignMRMilestone`, each wrapping its own `PUT /merge_requests/:iid` call with a single field in the body — not one combined call setting both `target_branch` and `milestone_id` together. This is explicitly what the user chose (PER-MR actions, not bulk, with per-row retry) and PITFALLS.md's Pitfall 7 makes the failure mode concrete: a single combined PUT that fails cannot represent "milestone-assign succeeded but retarget failed" as two independently retryable states — it collapses to one opaque row-level failure. FEATURES.md's observation that the API *can* combine both fields in one call remains true and useful only as an optional internal detail (e.g., if a future "apply both fixes at once" convenience is ever added, it could still fire one PUT) — but the primary, spec'd UX (independent retry per corrective action) requires two mutations. Both new functions may share one small private `updateMR()` PUT helper for DRYness, matching STACK.md's own suggested shape.

### 3. GitLab endpoint confidence — STACK.md wins on paths/params/shapes

**Resolution:** Where ARCHITECTURE.md and STACK.md's proposed endpoint signatures conflict, STACK.md's shapes are authoritative — it was independently verified against live docs.gitlab.com in this research pass (HIGH confidence), while ARCHITECTURE.md self-rated its endpoint knowledge MEDIUM (training-data recall, not re-verified). Concretely: use STACK.md's confirmed `POST /projects/:id/repository/branches` body params (`branch`, `ref`), `POST /projects/:id/milestones` params (`title`, `description`, `due_date`, `start_date`), and the Developer-role-not-Maintainer-role permission requirement for milestone/branch/MR-edit writes (STACK.md corroborated this against multiple independent GitLab permissions-doc mirrors; an earlier single-source Maintainer-only claim was not corroborated). ARCHITECTURE.md's proposed `fetchBranchMergeStatus` via `repository/compare` remains directionally correct as a *fallback* per Conflict 1 above, but should not be the sole/first-choice implementation STACK.md initially suggested (single-branch `merged` field) nor treated as sufficient alone per PITFALLS.md.

## Cross-Cutting Concerns for the First Write Phase

Two concerns must be established once, in whichever phase ships the first real GitLab write (branch or milestone creation), and reused — not re-derived — by every subsequent write phase:

1. **Permission gating.** No GitLab role/access-level detection exists anywhere in this app today (the app-internal Developer/PM role concept was removed entirely in v1.10 and never mapped to actual GitLab project permissions). Fetch the current user's `access_level` via `GET /projects/:id` (`permissions.project_access.access_level`) on project selection or release-view load, cache it per project/session, and gate every write-action button at `access_level >= 30` (Developer). Below that threshold, render a disabled button with an explanatory tooltip — never hide the button outright (breaks discoverability) and never rely on catching a live 403 as the only signal (reads as "the app is broken" to a PM).
2. **Shared write-mutation contract.** Every new mutation (`createBranch`, `createMilestone`, `updateMRTargetBranch`, `assignMRMilestone`) must: (a) treat "already exists"/"already assigned" 400 responses as idempotent success, not failure — GitLab's own creation-endpoint status codes are documented-inconsistent (400 vs the docs' claimed 409) and concurrent double-clicks/two-user races are a real scenario on this multi-editor surface; (b) on both success AND failure, roll back/refresh by **refetching the specific record from the server**, never by restoring a locally-cached pre-mutation snapshot — this directly extends the codebase's already-logged "enrichment invalidation no-op" and "reactive cache-read badge" lessons, and specifically prevents a rollback from stomping a teammate's concurrent legitimate change on this release view (which, unlike most of this app's per-user surfaces, is genuinely multi-person-edited).

## The Page-Cap Trap (explicit callout)

`fetchRecentProjectMRs` is intentionally capped at `per_page=100`, single page, no continuation — a deliberate, documented (`GGX-WARN-01`) trade-off for one *secondary, fallback* heuristic ("wrong milestone" hinting when a task's MR is too old to appear). It must **never** be reused for any of v1.14's three drift-discovery channels, all of which are load-bearing for the drift computation itself — a silently dropped MR here is a real drift going unflagged, which is strictly worse than the original use case's graceful degradation. `fetchMilestoneMRs`'s existing `while (data.length < perPage) { page++ }` full-pagination loop is the pattern to copy verbatim for the new Channel C fetcher (`fetchBranchTargetingMRs`) and for any reused/rebuilt Channel A path. This bug class (fetch-once + client-side filter/cap) has already recurred twice in this codebase (My Tasks pre-v1.13 fix, MR-discussion/assignee pickers) — a third occurrence here should be treated as a code-review gate, not a follow-up bug: no new GitLab list call in this milestone should merge without an explicit pagination-completeness test asserting >100 results are fully captured.

## MR-Retarget Side Effects — Decision to Surface Back to the User

The milestone brief specifies retarget applies "directly, optimistic + rollback, no confirm dialog" — but retargeting an MR is not metadata-only: GitLab resets all regular approvals (code-owner approvals inconsistently, per GitLab bug #415496), invalidates the diff base (potentially surfacing a much larger diff than before), and can leave the merge-request pipeline showing a stale/misleading green badge until re-run, plus orphaning diff-anchored discussion threads. Given "no confirm dialog" is an explicit, already-made decision, the reconciled recommendation is an **inline warning at the point of action** (e.g., "Retargeting will clear 2 approval(s) and invalidate the current pipeline") rather than a blocking dialog — this satisfies the letter of "no confirm dialog" while preventing users from being surprised by side effects discovered only later inside GitLab itself. **This specific point — informational inline warning vs. the originally-specified silent optimistic action — should be explicitly re-confirmed with the user during roadmap/phase planning**, since it's a UX addition beyond what CONTEXT.md literally asked for, even though all three research files independently converge on it being necessary.

## What Is Genuinely Unknown — Needs a Live Probe

- **The team's actual GitLab merge strategy** (merge commit vs. squash vs. rebase) on the project(s) this milestone targets — this single fact determines whether the simple `merged` field is ever safe to trust even as a "positive-only" fast path, and whether the MR-state/compare-diff fallback needs to be the default path from day one rather than a rarely-hit fallback. Check the project's Merge Options setting (Settings → Merge requests → Squash commits when merging) before finalizing Phase 6.
- **Whether MR approvals/protected-branch rules are actually configured** on this team's project — if approvals aren't used at all, Pitfall 1's approval-reset warning is dead code; if they are, the inline warning is load-bearing. Verify via a live MR with approvals before shipping Phase 5.
- **Actual GitLab role distribution across the team's PATs** (how many users are sub-Developer) — determines whether the permission-gating work in Phase 3 is addressing a real, common case or a rare edge case; affects how prominently to surface the disabled-button UX.
- **Whether any release branch in this team's history has ever carried >100 MRs** — informs whether the pagination-completeness risk in Phase 4 is theoretical or has already silently bitten a past release (worth a one-off manual audit).
- **Milestone title data quality in the existing GitLab project** — whether any pre-existing milestones already have whitespace/near-duplicate titles that would confuse Channel B matching once v1.14 starts relying on exact-title comparison (Pitfall 5); a quick manual scan of `GET /projects/:id/milestones` before Phase 3 ships would surface this cheaply.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Endpoint paths/params re-verified against official docs.gitlab.com in this pass; role-permission wording MEDIUM-HIGH (GitLab's own docs split across pages but multiple independent sources converge) |
| Features | MEDIUM | Grounded in GitLab's own API/docs, git-flow literature, and engineering-analytics tool positioning; triangulated from public docs/marketing for competitor UIs (Jira Release Hub, Shortcut, Sleuth), not direct hands-on inspection |
| Architecture | HIGH (structure) / MEDIUM (raw endpoint shapes) | Component/file-structure recommendations verified by reading actual codebase files in full; endpoint knowledge self-rated MEDIUM by the researcher (training-data recall) — superseded by STACK.md per Conflict 3 |
| Pitfalls | HIGH | GitLab platform-behavior pitfalls sourced from official docs + GitLab issue tracker (specific, dated issue numbers); codebase-specific recurring bug classes verified against `gitlab.ts` and project memory; UX/detection thresholds MEDIUM (no live GitLab instance probed this session) |

**Overall confidence:** HIGH for what to build and roughly how; MEDIUM on a small number of team-specific facts (merge strategy, approval usage, role distribution) that should be probed early in implementation rather than assumed.

### Gaps to Address

- Team's GitLab merge-strategy setting — probe before finalizing the merge-back check phase (see "What Is Genuinely Unknown" above).
- MR approval/protected-branch configuration reality — probe before finalizing the retarget-warning phase.
- Whether the "inline warning, no confirm dialog" resolution for retarget side effects (see above) matches the user's actual intent, or whether they'd prefer a lightweight confirm after all now that the side effects are concretely enumerated — flag explicitly during roadmap/phase-0 discussion, don't assume.
- Fork-MR handling (exclude from corrective actions vs. test explicitly) is under-specified in CONTEXT.md — PITFALLS.md recommends excluding or flagging as "external — not actionable"; this should be an explicit roadmap decision point, not left implicit in the drift-classification code.

## Sources

### Primary (HIGH confidence)
- https://docs.gitlab.com/api/branches/ — branch create/get, `merged` field
- https://docs.gitlab.com/api/milestones/ — milestone create params
- https://docs.gitlab.com/api/merge_requests/ — MR update params (`target_branch`, `milestone_id`)
- https://docs.gitlab.com/api/projects/ — `default_branch` field
- https://docs.gitlab.com/user/project/merge_requests/approvals/ — approval reset on target-branch change
- https://docs.gitlab.com/user/project/merge_requests/squash_and_merge/ — squash-merge ancestry behavior
- https://docs.gitlab.com/user/permissions/, https://docs.gitlab.com/user/project/repository/branches/protected/ — role/permission baselines
- GitLab issue tracker: #36963 (squash-merge ahead/behind/merged inconsistency), #378526 (wrong-target-branch pain point), #415496 (code-owner approval reset inconsistency), #356008/#47819/#591660/#48780 (400-vs-409 creation-error inconsistency, target-branch existence validation gap)
- `taskflow/src/services/gitlab.ts`, `releaseLinker.ts`, `linkEngine.ts`, `ReleaseDetailPage.tsx`, `ReleasesTab.tsx`, `issue-detail/`, `BulkCreateSubtasksModal.tsx`, `StatusPopover.tsx` — read in full or in large part, direct codebase inspection
- `.planning/PROJECT.md` — v1.14 committed scope, Out-of-Scope history, Key Decisions

### Secondary (MEDIUM confidence)
- GitLab: Allow MR author to change target branch (#378526) and Create merge requests docs — competitive/UX framing
- Runway blog (cherry-picks vs backmerges), git-flow 1.0 docs, trunkbaseddevelopment.com — git-flow lifecycle conventions
- LinearB vs Swarmia comparison pages — release-dashboard scannability positioning
- Project memory: fetch-once page-cap pitfall, enrichment invalidation no-op, reactive cache-read badge — recurring codebase bug classes, cross-checked against this milestone

---
*Research completed: 2026-08-10*
*Ready for roadmap: yes*
