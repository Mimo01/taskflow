---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Release Management
status: ready_to_plan
last_updated: 2026-08-11T14:06:40.163Z
last_activity: 2026-08-11
progress:
  total_phases: 21
  completed_phases: 4
  total_plans: 26
  completed_plans: 26
  percent: 19
stopped_at: Phase 90 complete (4/4) — ready to discuss Phase 91
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.
**Current focus:** Phase 91 — post release merge back verification

## Current Position

Phase: 91
Plan: Not started
Status: Ready to plan
Last activity: 2026-08-11

Progress: [██████████] 100%

## Performance Metrics

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

## Accumulated Context

### Roadmap Evolution

- v1.14 roadmap created 2026-08-10: 5 phases (87-91), continuing numbering from v1.13's Phase 86. Coarse granularity — reconciled the research's 6-slice build order into 5 phases by combining release-branch-create + milestone-create into one phase (88), since both share the "first write" cross-cutting concerns (permission gating, idempotent-mutation contract).

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

## Deferred Items

Carried forward from v1.13 close (2026-06-16) — none block v1.14 planning:

| Category | Item | Status |
|----------|------|--------|
| quick_tasks | 72 stale quick-task dirs (no completion file; dates back to 260521) | deferred — cleanup via /gsd-cleanup |
| debug | 6 pre-v1.13 debug sessions (backlog-drag-autoscroll x2, bulk-button-style-mismatch, phase73-no-transitions, subtask-row-layout-overflow, subtask-type-shows-id) | diagnosed, non-blocking |
| todo | priority-stripe-rest-rank (color stripe by Jira REST priority rank) | deferred since P78 (rank.ts known-broken) |
| uat | Phase 78/79 Windows/WebView2 drag UAT | deferred — needs Windows host |
| uat | Phase 80 live-Jira UAT (partial-failure/retry) | deferred — untestable without live DC |
| tech_debt | Phase 78 dnd-kit autoScroll disabled (upstream #1108) | accepted |
| tech_debt | Phase 79 D-07 screen/validator transitions not pre-filtered | accepted |
| code_review | WR-05 (70-REVIEW) unguarded SP cast in Today*Section.tsx | non-blocking |
| code_review | IN-01 (70-REVIEW) setCopied setTimeout not cleared | benign |

## Session Continuity

Last session: 2026-08-11T13:02:38.188Z
Stopped at: Completed 90-04-PLAN.md — Phase 90 complete, ready for verification
Resume file: None

## Operator Next Steps

- Plan Phase 87 with `/gsd-plan-phase 87` (Release Detail Decomposition — pure refactor, safe to skip `--research-phase`)
- Phases 88-91 each carry a flagged live-GitLab probe step (see Blockers/Concerns) — surface these during their respective planning passes
