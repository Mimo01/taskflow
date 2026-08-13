---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Release Management
status: Awaiting next milestone
last_updated: "2026-08-13T08:42:18.923Z"
last_activity: 2026-08-13 — Milestone v1.14 completed and archived
progress:
  total_phases: 23
  completed_phases: 7
  total_plans: 49
  completed_plans: 49
  percent: 30
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-13)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.
**Current focus:** Planning next milestone (run /gsd-new-milestone)

## Current Position

Phase: Milestone v1.14 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-08-13 — Milestone v1.14 completed and archived

## Performance Metrics

**Velocity (v1.14 reference):**

- Plans completed: 49 (7 phases, 551 commits)
- Average phase size: ~7 plans
- LOC delta (src): +21,865 / −4,131

**Velocity (v1.13 reference):**

- Plans completed: 23 (6 phases, 9 days, 411 commits)
- Average phase size: ~3.8 plans
- LOC delta: +41,255 / −21,884

**By Phase (v1.14 planned):**

| Phase | Requirements | Description |
|-------|-------------|-------------|
| 87 | FOUND-01 | Decompose ReleaseDetailPage.tsx (1518 LOC) into release-detail/ folder — zero behavior change |
| 88 | RELBR-01..05, RELMS-01..04 | Release branch existence/create + GitLab milestone existence/create, both confirm-dialog gated |
| 89 | DRIFT-01..09 | Three-channel MR discovery (Jira-key, milestone, branch-target) + drift flagging, read-only |
| 90 | MRFIX-01..04 | Per-MR retarget + assign-milestone, optimistic, independently retryable, no confirm/warning |
| 91 | MERGE-01..03 | Post-release merge-back check, advisory verdict with manual override |
| Phase 87 P01 | 25min | 3 tasks | 3 files |
| Phase 87 P02 | 20min | 2 tasks | 2 files |
| Phase 87 P03 | 35min | 3 tasks | 7 files |
| Phase 87 P04 | 25min | 2 tasks | 3 files |
| Phase 87 P05 | 20min | 2 tasks | 3 files |
| Phase 87 P06 | 20min | 3 tasks | 2 files |
| Phase 90 P01 | 9min | 3 tasks | 4 files |
| Phase 90 P02 | 24min | 2 tasks | 3 files |
| Phase 90 P03 | 55min | 3 tasks | 3 files |
| Phase 90 P04 | 22min | 2 tasks | 4 files |
| Phase 91 P09 | 25min | 3 tasks | 5 files |
| Phase 91.2 P04 | 55min | 3 tasks | 10 files |

## Accumulated Context

### Roadmap Evolution

- v1.14 roadmap created 2026-08-10: 5 phases (87-91), continuing numbering from v1.13's Phase 86. Coarse granularity — reconciled the research's 6-slice build order into 5 phases by combining release-branch-create + milestone-create into one phase (88), since both share the "first write" cross-cutting concerns (permission gating, idempotent-mutation contract).
- Phase 91.1 inserted after Phase 91: Unified Release Detail Task Table — one Jira-task table with inline MRs, secondary table for uncovered MRs (URGENT)
- Phase 91.2 inserted after Phase 91: Epics Page Redesign — creation-order sort, quick-search, progress/points/priority/labels/child-status per row (URGENT)

### Decisions

Key decisions for v1.14 (from CONTEXT.md/research, do not re-litigate):

- NO permission/role gating on write buttons (team is all Developer+); NO fork-MR handling (team doesn't use forks); NO bulk "fix all" — per-MR actions only
- Retarget applies directly with NO confirm dialog and NO inline warning — user reviewed GitLab's documented approval-reset behavior and declined the warning research recommended
- Confirm dialogs on CREATE actions only (branch, milestone); retarget/assign apply directly
- `release/` prefix hardcoded; `develop` is the GitLab project default branch read from the API, not configurable
- Two independent mutations (retarget, assign-milestone) per MR row, not one combined PUT — needed for independent per-action retry
- Merge-back detection is layered and advisory: tracking-MR state first, `repository/compare` content-diff fallback, `merged:true` as positive-only fast path — never trust `merged:false` alone (GitLab #36963 squash/rebase false-negative)
- Channel C (branch-target MR discovery) must use a fully-paginated fetch, never `fetchRecentProjectMRs`'s 100-cap — this bug class has already recurred twice in this codebase
- [Phase 87]: fetchVersionIssueCounts/fetchFixVersionIssues moved to services/jira.ts behind apiFetch (D-12a) — Adopts the file's existing 15s AbortController timeout and 401 markDisconnected convention; user-approved deliberate behavior delta, no other change to fetch contracts
- [Phase ?]: Phase 87-02: hook return object destructured explicitly in page shell to preserve byte-identical JSX variable names
- [Phase 87]: [Phase 87-03]: ReleaseHeader.tsx exports two components (ReleaseBreadcrumbHeader, ReleaseTitleHeading) rather than one — breadcrumb and title occupy structurally separate JSX positions
- [Phase ?]: Added onOpenIssueFull prop to IssuesSection to preserve PEEK-05 key/body click split (Rule 1 bug prevention)
- [Phase ?]: Phase 87-05: useResizable/containerRef stayed in the page shell; only width/isDragging/onResizeMouseDown crossed into ReleaseDetailSidebar (hazard 7)
- [Phase ?]: Phase 87-05: useEditRelease's 21-field return object recorded for Plan 06's EditReleaseModal wiring; page drops setEditing from its destructure since startEditing/cancelEditing/handleSave already own all editing-flag transitions
- [Phase 87]: Task 3 manual UAT approved: 11-step click-through passed with no visual/behavioral differences, including step-6 DOM nesting (Unmatched MRs inside Issues section) and step-11 query-cache sharing
- [Phase 90]: Probe not run — no live GitLab PAT available; 90-PROBE-RESULTS.md recorded as status: not-run, not fabricated
- [Phase 90]: A1 (RESEARCH Open Question) left UNRESOLVED (probe D skipped) — non-blocking since flattenGitLabError handles all three GitLab error-body shapes defensively
- [Phase 90]: updateMilestone/createBranch/createMilestone left byte-unchanged — back-porting flattenGitLabError into them is out of scope for this plan
- [Phase ?]: [Phase 90]: useMrFixMutation onMutate guards only projectId for the optimistic patch; missing targetBranch/milestone falls back to the MR's own current value (no-op write) since mutationFn's guards throw before any updateMergeRequest call regardless
- [Phase ?]: [Phase 90]: D-12 header-badge decrement proven via patchMrInChannelCaches against the real three-element windowed cache key; driftFlaggedCount is non-memoized so it drops immediately, before any refetch
- [Phase 90]: [Phase 90-03]: applyHeldOrder/orderRef live in MrDriftSection.tsx, not useReleaseDetail.ts — the freeze is a view-layer concern of the mounted list itself; 90-VALIDATION.md places the held sort order test in MrDriftSection.test.tsx
- [Phase 90]: [Phase 90-03]: group-focus-visible/fix: chosen over the data-revealed JS fallback for the focus reveal — matches existing group-focus/<name>: usage in dropdown-menu.tsx/context-menu.tsx under the same Tailwind v4 pipeline; Plan 04's keyboard-Tab UAT should confirm visually
- [Phase 90]: Biome baseline drift (chart.tsx, MyTasksPage.tsx/.test.tsx flagged beyond the documented 2-file BacklogPage/BacklogRow baseline) logged to deferred-items.md and not fixed — pre-existing Phase 81/82 drift, zero new diagnostics from Phase 90's own code
- [Phase 90]: Live UAT recorded as a blanket developer approval ('approved') covering all ten checkpoint steps including step 3 keyboard focus-reveal, which jsdom could not prove — no per-step detail fabricated
- [Phase 90]: Step 10 D-16 approval-reset observation recorded as 'not reported' — the D-16 probe.sh remains unrun and RESEARCH A1 stays UNRESOLVED (probe D skipped); the UAT approval resolves neither
- [Phase ?]: TagChannelHealth required on the released BranchState variant, optional-with-default on resolveBranchState params, mirroring mergeBackVerification.ts's asymmetric-required pattern (91-REVIEW WR-04)
- [quick-260812-mry]: Text Size = root rem scaling via html[data-font-scale], mirroring the data-density pattern (baseline tier removes the attribute). Density and Text Size stay two independent controls, never a combined UI Scale
- [quick-260812-mry]: loadAppearance() in services/theme.ts fixes a pre-existing bug — main.tsx hardcoded applyDensity('default'), so persisted density never applied unless the user opened Settings
- [quick-260812-mry]: px→rem sweep deliberately bounded to 5 high-traffic chrome files (30 occurrences); ~44 text-[Npx] remain app-wide as a documented deferral, not an oversight
- [Phase 91.2-04]: Deleted dead services/jira/epics.ts duplicate module and its orphaned types.ts EpicEnriched interface; services/jira.ts is now the sole epic-fetcher home
- [Phase 91.2-04]: PROJECT.md Key Decisions row corrected to record EpicsPage progressive enrichment (fetchEpicEnrichmentMap) as current, superseding the old too-slow-for-list-view decision
- [Phase 91.2-04]: UAT during the human-verification checkpoint found and fixed 3 issues on the main tree: priority column reordered to match Backlog convention, priority cell pl-2 spacing, and fetchAllSearchPagesConcurrent added for bounded-concurrency (6 in flight) enrichment pagination, fail-closed per D-15

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 88 needs a live probe: confirm the team's actual GitLab PAT role distribution (any sub-Developer/Reporter users?) and scan existing milestone titles for near-duplicates before finalizing write-gating and Channel B matching
- Phase 89 needs a live probe: confirm whether any release branch has ever carried >100 targeting MRs, or build a synthetic fixture, to prove Channel C pagination-completeness
- Phase 90 needs a live probe: verify via a real MR with approvals whether approval/protected-branch rules are actually configured on the team's project
- Phase 91 is probe-gated: the team's actual GitLab merge-strategy setting (squash vs merge-commit vs rebase) is unknown and determines whether the `merged` field can ever be trusted, even as a positive-only fast path — must be confirmed before finalizing detection method
- Apple Developer ID + Windows code signing still deferred (carried from v1.7)
- Phase 90 D-16 roadmap probe still not run (no live GitLab PAT in execution environment); re-run .planning/phases/90-per-mr-corrective-actions/probe.sh and replace 90-PROBE-RESULTS.md when access is available. Non-blocking for code — flattenGitLabError handles all three error-body shapes defensively.
- Biome baseline drift discovered at Phase 90 close: npx biome check ./src now flags 16 total diagnostics across 5 files (BacklogPage.tsx, BacklogRow.tsx, components/ui/chart.tsx, MyTasksPage.tsx, MyTasksPage.test.tsx), up from the documented 2-file baseline. None touched by Phase 90's own files (confirmed via git status) — pre-existing Phase 81/82 drift. See 90-per-mr-corrective-actions/deferred-items.md. Recommend a tech-debt cleanup pass.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260812-l6f | On release detail, move the descrition/descriptions from the main content into the sidebar. All other functionality should stay the same | 2026-08-12 | 507a83b1 | | [260812-l6f-on-release-detail-move-the-descrition-de](./quick/260812-l6f-on-release-detail-move-the-descrition-de/) |
| 260812-mry | Add compactness and font size settings to Appearance section | 2026-08-12 | 5566e8ff | Verified | [260812-mry-add-compactness-and-font-size-settings-t](./quick/260812-mry-add-compactness-and-font-size-settings-t/) |
| 260812-rx9 | Enhance compactness settings coverage — full density sweep (wiki prose, standup notes, epics, AIO pages, +45 more surfaces) | 2026-08-12 | cdec90cb | Verified | [260812-rx9-enhance-compactness-settings-coverage](./quick/260812-rx9-enhance-compactness-settings-coverage/) |
| 260813-fst | On release detail, order Jira tickets by created date/key ascending | 2026-08-13 | e82a947e | | — |
| 260813-1k3 | In Recently Visited, also show the issue type icon | 2026-08-13 | 5b9c4184 | | [260813-1k3-in-the-recently-visited-also-put-the-typ](./quick/260813-1k3-in-the-recently-visited-also-put-the-typ/) |
| 260813-1vr | In the search modal results, also show the issue type icon | 2026-08-13 | 0a29595d | | [260813-1vr-in-the-search-modal-results-also-put-the](./quick/260813-1vr-in-the-search-modal-results-also-put-the/) |
| 260813-dbf | Fix gitlab.ts WR-01: flatten object-keyed GitLab error message bodies | 2026-08-13 | 6a68948d | | [260813-dbf-fix-gitlab-ts-wr-01-flatten-object-keyed](./quick/260813-dbf-fix-gitlab-ts-wr-01-flatten-object-keyed/) |
| 260813-dzc | Flatten Jira field-validation error bodies (errors object) across jira service error paths — WR-01 sibling | 2026-08-13 | 2b4cd504 | | [260813-dzc-flatten-jira-field-validation-error-bodi](./quick/260813-dzc-flatten-jira-field-validation-error-bodi/) |
| 260813-epk | Make all tests and linters pass — reformat 4 biome-drifted files | 2026-08-13 | 494ff60b | | [260813-epk-make-all-tests-and-linters-pass](./quick/260813-epk-make-all-tests-and-linters-pass/) |
| 260813-rel | Release v1.14.0 via release.sh — changelog written from git log analysis | 2026-08-13 | 88b3763c | Released | — |

## Deferred Items

Acknowledged and deferred at v1.14 milestone close (2026-08-13) — 111 open artifacts from the pre-close audit. None block v1.15 planning:

| Category | Item | Status |
|----------|------|--------|
| quick_task | 95 stale quick-task dirs (no completion file; dates back to 260521) | deferred — cleanup via /gsd-cleanup |
| debug | 7 pre-v1.14 debug sessions (backlog-drag-autoscroll x2, bulk-button-style-mismatch, knowledge-base, phase73-no-transitions, subtask-row-layout-overflow, subtask-type-shows-id) | diagnosed/archived, non-blocking |
| todo | priority-stripe-rest-rank (color stripe by Jira REST priority rank) | deferred since P78 (rank.ts known-broken) |
| uat | Phase 88 88-HUMAN-UAT.md — 3 pending scenarios (live-GitLab create-branch, create-milestone, restricted-PAT error surfacing) | waived by user; mocked-fetch unit coverage only |
| uat | Phase 90 90-HUMAN-UAT.md — 2 pending scenarios (D-16 approvals/protected-branch probe; CR-01 rollback fix vs live data) | no reachable GitLab PAT; per D-16 changes no UI |
| verification | Phase 88 / 90 / 91.1 VERIFICATION.md all `human_needed` | accepted at close; unit coverage exists for every claim |
| tech_debt | Phase 87: page shell 322 LOC vs D-06's 150-250 target; WR-04 undertested branching exports; WR-06 duplicate-breadcrumb-key carried over | accepted |
| tech_debt | Phase 89 WR-04: a failed Channel A/B/C query still renders as "no drift" at the channel level (partially superseded by 91.1's drift-partial banner) | accepted |
| tech_debt | Phase 89 WR-06: list page and detail page tie-break "matched milestone" differently within the ±7d window | accepted |
| tech_debt | Biome baseline: 4 lint errors (chart.tsx noArrayIndexKey x2, BacklogRow.tsx noStaticElementInteractions/useKeyWithClickEvents x4) — pre-existing from Phases 81/82, need human judgment | accepted |
| tech_debt | Phase 91 WR-01: releaseBranch.ts:120-123 doc comment overstates that `tagChannel` is type-enforced required | doc-accuracy only |
| tech_debt | Phase 91.2 WR-06/07/08, IN-04/05: progress cell `w-32` tight at 3 digits, assignee `w-10` narrower than avatar, duplicated count types, duplicate retry controls, sub-pixel segment slivers | cosmetic |

## Session Continuity

Last session: 2026-08-12T22:28:23.494Z
Stopped at: Completed 91.2-04-PLAN.md (phase 91.2 complete, ready for verification)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
