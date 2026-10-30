---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: MVP
status: executing
last_updated: "2026-10-30T11:17:40.769Z"
last_activity: 2026-10-30 -- Phase 94 planning complete
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 11
  completed_plans: 11
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-13)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.
**Current focus:** Phase 94 — Release detail redesign

## Current Position

Phase: 94
Plan: Not started
Status: Ready to execute
Last activity: 2026-10-30 -- Phase 94 planning complete

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
- Phase 92 added: Advanced Global Search — ranked, cache-backed, grouped results with highlighting
- Phase 93 added: Releases list and detail redesign (fix-version-driven list, drop milestones/branch, app-consistent styling, fast; detail keeps full info, restyled to match)
- Phase 94 added: Release detail redesign — nicer professional page with more release graphs, keeps all current info, easy access to existing actions

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
| 261007-hmj | Time-led epic forecast (time weighted 4x, confidence from time) | 2026-10-07 | d604dd6e | Verified (inline) | [261007-hmj-epic-forecast-time-led](./quick/261007-hmj-epic-forecast-time-led/) |
| 261029-k8g | Bulk subtask modal: remove-row button | 2026-10-29 | b54b61bd | Verified (inline) | [261029-k8g-bulk-subtask-modal-add-remove-row-option](./quick/261029-k8g-bulk-subtask-modal-add-remove-row-option/) |
| 261014-jes | AIO cycle priority/severity chart colours (one colour per level) | 2026-10-14 | ca1db2b0 | Verified (inline) | [261014-jes-aio-cycle-priority-severity-chart-colors](./quick/261014-jes-aio-cycle-priority-severity-chart-colors/) |
| 261014-jzn | AIO cycle detail burndown chart (compact, ideal line) | 2026-10-14 | 844b70d7 | Unverified visually | [261014-jzn-aio-testcase-detail-burndown-chart](./quick/261014-jzn-aio-testcase-detail-burndown-chart/) |
| 261014-kdp | AIO burndown: working-day calendar, polish, moved into top row | 2026-10-14 | a1884da0 | Verified (screenshots) | [261014-kdp-aio-burndown-working-day-calendar-polish](./quick/261014-kdp-aio-burndown-working-day-calendar-polish/) |
| 261014-m1x | AIO stats row: keep donuts on first row | 2026-10-14 | 8746ca58 | Verified (inline) | direct commits, no plan dir |
| 261014-n4q | AIO stats block: tiles over burndown in left column | 2026-10-14 | 5acb1575 | Verified (inline) | direct commits, no plan dir |
| 261014-p5z | AIO burndown: flat polish, no card | 2026-10-14 | 70021fca | Verified (inline) | direct commits, no plan dir |
| 261014-r8w | AIO burndown: nice y scale, local-time x labels | 2026-10-14 | 8aec4341 | Verified (inline) | direct commits, no plan dir |
| 261014-s2e | AIO burndown: evenly spaced x labels (+ headroom c63b665b) | 2026-10-14 | 938a49c5 | Verified (inline) | direct commits, no plan dir |
| 261014-lgn | Issue detail: unassign via sidebar assignee popover 'Unassign' row (+ Edit modal 'Unassigned' option); assignee changes via PUT /issue/{key}/assignee | 2026-10-14 | 251cba8e | Verified (UAT by user: option visible/styled; live unassign persistence not confirmed) | [261014-lgn-issue-detail-unassign-assignee](./quick/261014-lgn-issue-detail-unassign-assignee/) |
| 261007-hv0 | Duplicate a subtask template in Settings | 2026-10-07 | 46bbdd18 | Verified (UAT by user) | [261007-hv0-in-settings-subtask-templates-i-want-to-](./quick/261007-hv0-in-settings-subtask-templates-i-want-to-/) |
| 261013-jl3 | Redesign AIO Cycles page: polished folder selector (All cycles, filter, aggregated counts), Open\|All filter, status/dates/pass %/effort columns, paginated cycle fetch | 2026-10-13 | fbd942b3 | Verified (UAT by user) | [261013-jl3-redesign-aio-tests-tab-cycle-selector](./quick/261013-jl3-redesign-aio-tests-tab-cycle-selector/) |
| 261013-l97 | AIO Cycles page dashboard: KPI tiles + Execution mix / By owner / Schedule cards (read-only), per-subfolder fetch and badge for parent folders, single page scroll | 2026-10-13 | e0217e13 | Verified (UAT by user) | [261013-l97-aio-cycles-dashboard](./quick/261013-l97-aio-cycles-dashboard/) |
| 261013-mnc | AIO cycle detail + run detail UX rework: header metadata (owner/dates/custom fields), KPI tiles + bar, Executions search/count chips/flex rows, Defects summary strip + trigger chips, run detail key+title, Prev/Next, step cards + sidebar w/ test case meta | 2026-10-13 | cdb553d4 | Verified (UAT by user) | [261013-mnc-enhance-aio-cycle-detail-page-and-testca](./quick/261013-mnc-enhance-aio-cycle-detail-page-and-testca/) |
| 261014-crk | AIO cycle detail polish: Execution Distribution donut beside de-duplicated 2x2 tiles (Pass rate / Ready to retest / Unlinked failures / Re-runs), Defect Summary status + priority + severity donuts | 2026-10-14 | f25174ab | Verified (UAT by user) | [261014-crk-polish-aio-cycle-detail-page-cycle-stati](./quick/261014-crk-polish-aio-cycle-detail-page-cycle-stati/) |
| 260812-l6f | On release detail, move the descrition/descriptions from the main content into the sidebar. All other functionality should stay the same | 2026-08-12 | 9564e39f | | [260812-l6f-on-release-detail-move-the-descrition-de](./quick/260812-l6f-on-release-detail-move-the-descrition-de/) |
| 260812-mry | Add compactness and font size settings to Appearance section | 2026-08-12 | 5658e924 | Verified | [260812-mry-add-compactness-and-font-size-settings-t](./quick/260812-mry-add-compactness-and-font-size-settings-t/) |
| 260827-eaj | Add a settings option to open links in a user-selectable browser (covers 'open in browser' links and links inside descriptions/comments) | 2026-08-27 | 4169adbc | Verified | [260827-eaj-add-a-settings-option-to-open-links-in-a](./quick/260827-eaj-add-a-settings-option-to-open-links-in-a/) |
| 260812-rx9 | Enhance compactness settings coverage — full density sweep (wiki prose, standup notes, epics, AIO pages, +45 more surfaces) | 2026-08-12 | 51df2e32 | Verified | [260812-rx9-enhance-compactness-settings-coverage](./quick/260812-rx9-enhance-compactness-settings-coverage/) |
| 260813-fst | On release detail, order Jira tickets by created date/key ascending | 2026-08-13 | 0df4b3e2 | | — |
| 260813-1k3 | In Recently Visited, also show the issue type icon | 2026-08-13 | 838a44a0 | | [260813-1k3-in-the-recently-visited-also-put-the-typ](./quick/260813-1k3-in-the-recently-visited-also-put-the-typ/) |
| 260813-1vr | In the search modal results, also show the issue type icon | 2026-08-13 | 997d4c8c | | [260813-1vr-in-the-search-modal-results-also-put-the](./quick/260813-1vr-in-the-search-modal-results-also-put-the/) |
| 260813-dbf | Fix gitlab.ts WR-01: flatten object-keyed GitLab error message bodies | 2026-08-13 | ceb3f0d6 | | [260813-dbf-fix-gitlab-ts-wr-01-flatten-object-keyed](./quick/260813-dbf-fix-gitlab-ts-wr-01-flatten-object-keyed/) |
| 260813-dzc | Flatten Jira field-validation error bodies (errors object) across jira service error paths — WR-01 sibling | 2026-08-13 | 4e0ab3a8 | | [260813-dzc-flatten-jira-field-validation-error-bodi](./quick/260813-dzc-flatten-jira-field-validation-error-bodi/) |
| 260813-epk | Make all tests and linters pass — reformat 4 biome-drifted files | 2026-08-13 | e33de3b9 | | [260813-epk-make-all-tests-and-linters-pass](./quick/260813-epk-make-all-tests-and-linters-pass/) |
| 260813-rel | Release v1.14.0 via release.sh — changelog written from git log analysis | 2026-08-13 | cd9b9949 | Released | — |
| 260827-f6e | Expand link-open feature with a right-click context menu — open in any detected browser or copy link to clipboard, wired across all 12 existing openExternal call sites | 2026-08-27 | 31010f5f | Verified | [260827-f6e-we-have-recently-added-an-option-to-open](./quick/260827-f6e-we-have-recently-added-an-option-to-open/) |
| 260827-gji | Fix My Tasks MR review badges — wire real per-MR approvals/discussions into deriveReviewHealth() instead of hardcoded "Awaiting review"; delete dead dashboard/TaskRow.tsx and MrRow.tsx; added GitPullRequest icon to the badge (ba28e86d) for MR context | 2026-08-27 | fac28025 | Verified | [260827-gji-my-tasks-currently-hardcodes-every-linke](./quick/260827-gji-my-tasks-currently-hardcodes-every-linke/) |
| 260916-rk1 | On releases page, add task type icon (pattern already used in other task lists) | 2026-09-16 | b085db3f | | [260916-rk1-on-releases-page-add-task-type-icon-patt](./quick/260916-rk1-on-releases-page-add-task-type-icon-patt/) |
| 260916-sak | I can currently attach files to jira issues but I cant add them to description/comments. Add a nice dynamic way to include attachments in the descriptions/comments | 2026-09-16 | eb508038 | Verified | [260916-sak-i-can-currently-attach-files-to-jira-iss](./quick/260916-sak-i-can-currently-attach-files-to-jira-iss/) |
| 260916-ta1 | I want to enhance story creation and editing. Make the whole process more polished. Add option to add attachments to description and more | 2026-09-17 | ce310c04 | Verified | [260916-ta1-i-want-to-enhance-story-creation-and-edi](./quick/260916-ta1-i-want-to-enhance-story-creation-and-edi/) |
| 260922-bca | I want to have a nicer datepicker across the app. The current one works but I dont like the style | 2026-09-22 | 4b618758 | Verified | [260922-bca-i-want-to-have-a-nicer-datepicker-across](./quick/260922-bca-i-want-to-have-a-nicer-datepicker-across/) |
| 260922-cif | On sprint board, the text, cards and everything is too large even on compact view. Make it more compact and fit better onto the screen | 2026-09-22 | ede052ab | Verified | [260922-cif-on-sprint-board-the-text-cards-and-every](./quick/260922-cif-on-sprint-board-the-text-cards-and-every/) |
| 260922-e07 | on sprint board remove the 'entered status' timestamp from the cards | 2026-09-22 | 089c1768 | | [260922-e07-on-sprint-board-remove-the-entered-statu](./quick/260922-e07-on-sprint-board-remove-the-entered-statu/) |
| 260922-irb | On sprint board, make the goal and filters sticky, restyle the goal, surface the current sprint's name, and polish the header/row visual boundaries | 2026-09-22 | 3433d8ca | Verified | [260922-irb-on-sprint-board-page-the-goal-and-filter](./quick/260922-irb-on-sprint-board-page-the-goal-and-filter/) |
| 260922-jtc | On sprint board, the header style doesn't match the other page headers. Make the sprint title match (there can be additional info, but the section size and text size should match between pages, mainly backlog page) | 2026-09-22 | 624a8123 | Verified | [260922-jtc-sprint-board-header-style-should-match-o](./quick/260922-jtc-sprint-board-header-style-should-match-o/) |
| 260929-fnq | On My Tasks, add an "In Review — my subtasks" band for in-review stories owned by someone else where I have a subtask | 2026-09-29 | f195accf | Verified | [260929-fnq-add-my-tasks-section-for-in-review-stori](./quick/260929-fnq-add-my-tasks-section-for-in-review-stori/) |
| 260929-fz1 | My Tasks: add "Testing" band (status contains "test") and render bands in workflow order (In Progress → In Review → Testing → To Do), precedence unchanged | 2026-09-29 | 599ae662 | Verified | [260929-fz1-add-testing-section-to-my-task-list](./quick/260929-fz1-add-testing-section-to-my-task-list/) |
| 260929-h2q | Order subtasks by parent Jira subtask order (fields.subtasks) everywhere; numeric-key fallback (Sprint Board numeric only); stories keep rank | 2026-09-29 | 416cb220 | Verified | [260929-h2q-order-subtasks-by-id-wherever-subtasks-a](./quick/260929-h2q-order-subtasks-by-id-wherever-subtasks-a/) |
| 260929-iwm | Datepicker week starts on Monday (shared Calendar weekStartsOn=1) | 2026-09-29 | 0ca4c4bc | Verified | [260929-iwm-datepicker-week-starts-on-monday](./quick/260929-iwm-datepicker-week-starts-on-monday/) |
| 260929-j4e | Worklogs date presets: drop Last Week/Last Month/Last Working Day, add Last 7 Days + rolling Last Month (to date); legacy saved filters → This Week | 2026-09-29 | 620410f3 | Verified | [260929-j4e-worklogs-date-range-presets-remove-last-](./quick/260929-j4e-worklogs-date-range-presets-remove-last-/) |
| 261001-fmk | Epic detail progress section: burnup, status breakdown, per-assignee bars, forecast/risk tiles, Count/SP toggle (above Stories list) | 2026-10-01 | 3530ec9c | Verified | [261001-fmk-epic-detail-progress-chart](./quick/261001-fmk-epic-detail-progress-chart/) |
| 261001-g5q | Epic progress follow-up: Time metric (estimate/logged/remaining incl. subtasks), Card container, tooltips on tiles/segments/legend/assignees | 2026-10-01 | 254302cf | Iterated → 261001-hsz | [261001-g5q-epic-progress-time-metric-card-container](./quick/261001-g5q-epic-progress-time-metric-card-container/) |
| 261001-hsz | Epic progress iteration 3: worklog-based Time burnup (estimate collapse), estimate = subtasks if any else story, tooltips on all progress bars (burnup, quick peek, status/assignee, story mini bars), full-width divider layout | 2026-10-01 | af26f5ff | Iterated → 261001-ilq | [261001-hsz-epic-progress-time-burnup-from-worklogs-](./quick/261001-hsz-epic-progress-time-burnup-from-worklogs-/) |
| 261001-ilq | Epic progress iteration 4: cumulative flow diagram + remaining + forecast band, adaptive forecast (young/fast/steady/stalled/scope-growth), hero + stat strip, Jira-like assignee rows with status chips, unified tooltips and status colours | 2026-10-01 | e578d1db | Verified (iterated → 261001-qvu) | [261001-ilq-epic-progress-cfd-adaptive-forecast-hero](./quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/) |
| 261001-qvu | Epic progress iteration 5: Finish = average of Count/SP/Time forecasts, Tempo holiday-aware calendar, per-day forecast hover points, fully hoverable assignee rows, tooltip row markers, risks redesign | 2026-10-01 | 1f853226 | Iterated → 261001-rtw | [261001-qvu-epic-progress-forecast-averaging-holiday](./quick/261001-qvu-epic-progress-forecast-averaging-holiday/) |
| 261001-rtw | Epic progress iteration 6: one shared forecast in every chart, colour reserved for statuses (neutral markers/series), legend spacing root-cause fix, unified Count/SP/Time bands (Time person bars match chips) | 2026-10-01 | 292ec5bc | Iterated → 261001-sqm | [261001-rtw-epic-progress-one-forecast-neutral-marke](./quick/261001-rtw-epic-progress-one-forecast-neutral-marke/) |
| 261001-sqm | Epic progress iteration 7: Risks popover with clickable issue keys, data sources in hero tooltip, one shared chart date range, brush + preset zoom shared across tabs, confidence meter + reason, Time chart coloured by status meaning | 2026-10-02 | 9200af18 | Iterated → 261002-0et | [261001-sqm-epic-progress-risks-notes-shared-axis-zo](./quick/261001-sqm-epic-progress-risks-notes-shared-axis-zo/) |
| 261002-0et | Epic progress iteration 8: confidence as meter + word (reason once, Finish tooltip), zoom only for ranges > 6 weeks, simplified Risks (one-line risks → popover of clickable issues) | 2026-10-02 | e2a85340 | Iterated → 261002-0xf | [261002-0et-epic-progress-simpler-confidence-conditi](./quick/261002-0et-epic-progress-simpler-confidence-conditi/) |
| 261002-0xf | Epic progress polish: date navigator replaces the zoom brush (daily data, calendar ticks, adaptive presets, from 4 weeks), fixed identical top cards, concise tooltips, decluttered tab-independent risks | 2026-10-02 | 9ffa7478 | Iterated → 261002-enj | [261002-0xf-epic-progress-polish-zoom-slider-consist](./quick/261002-0xf-epic-progress-polish-zoom-slider-consist/) |
| 261002-enj | Epic progress: confidence only in hover, readable + hoverable risks, narrower Completed bar, card→chart spacing, chart legends removed (toolbar above chart) | 2026-10-02 | a2115b7f | Iterated → 261002-fp7 | [261002-enj-epic-progress-confidence-in-hover-readab](./quick/261002-enj-epic-progress-confidence-in-hover-readab/) |
| 261002-fp7 | Epic progress: risks as an icon tally (one pill per risk, no +N), per-person breakdown separated (divider + heading) | 2026-10-02 | 0a11c203 | Verified | [261002-fp7-epic-progress-risk-tally-pills-and-per-p](./quick/261002-fp7-epic-progress-risk-tally-pills-and-per-p/) |
| 261002-h9e | Changes tab: side-by-side word diff for long text (full-height, no preview), plain old→new rows for short + multi-value fields (status keeps pills), burst grouping, field icon column, review fixes + UAT polish | 2026-10-02 | 262ba357 | Verified | [261002-h9e-enhance-changes-tab-on-issue-detail-with](./quick/261002-h9e-enhance-changes-tab-on-issue-detail-with/) |
| 261014-m6e | Prompt to move story to Done when last open subtask is closed (board + sidebar) | 2026-10-14 | 97141a9f | Verified (UAT by user) | [261014-m6e-when-i-close-the-last-opened-subtask-in-](./quick/261014-m6e-when-i-close-the-last-opened-subtask-in-/) |
| 261014-myz | Merge AIO cycle burndown executions within one hour into one point | 2026-10-14 | 4d5bc2a2 | Verified (UAT by user) | [261014-myz-merge-close-burndown-datapoints-aio-cycl](./quick/261014-myz-merge-close-burndown-datapoints-aio-cycl/) |
| 261022-h1q | Cmd+Shift+F opens global search; Cmd+F searches current page content only (custom find bar, accent/case-insensitive, live) | 2026-10-22 | 80214321 | Verified (UAT) | [261022-h1q-cmd-shift-f-opens-global-search-cmd-f-se](./quick/261022-h1q-cmd-shift-f-opens-global-search-cmd-f-se/) |
| 261022-jzt | AIO cycle Defect Summary: friendly no-defects empty state (green BugOff badge + text) instead of empty grey ring | 2026-10-22 | 04f86c31 | Verified (UAT) | [261022-jzt-aio-tc-detail-defect-summary-empty-state](./quick/261022-jzt-aio-tc-detail-defect-summary-empty-state/) |
| 261022-k5j | AIO cycle Burndown: compact empty state (Hourglass "Testing not started" / ClipboardList "No test cases") instead of empty space before first execution | 2026-10-22 | 2dabcab2 | Verified (UAT) | [261022-k5j-aio-tc-detail-empty-state-when-no-burndo](./quick/261022-k5j-aio-tc-detail-empty-state-when-no-burndo/) |
| 261022-kd8 | AIO cycle KPI tiles: keep Pass rate, replace Ready to retest / Unlinked failures / Re-runs with step tiles (Step pass rate, Steps executed, Steps per case) from one AIO report request | 2026-10-22 | eeda7384 | Verified (UAT) | [261022-kd8-aio-tc-detail-metric-cards](./quick/261022-kd8-aio-tc-detail-metric-cards/) |
| 261027-iz9 | AIO cycle Executions + Defects tabs: split into stacked Open / Done sections (Done = Pass only / Jira status category done), shared toolbar, compact per-section empty states (empty vs no-match + Clear filters) | 2026-10-27 | d5912868 | Verified (UAT) | [261027-iz9-aio-test-case-page-split-executions-and-](./quick/261027-iz9-aio-test-case-page-split-executions-and-/) |
| 261028-lal | Highlight the task open in the peek sidebar on the main page (My Tasks, Sprint Board, Backlog, Release detail): peek store + useIsPeeked, tint + inset bar / card ring | 2026-10-28 | 8d50136a | Verified (UAT) | [261028-lal-when-i-open-a-task-sidebar-the-task-that](./quick/261028-lal-when-i-open-a-task-sidebar-the-task-that/) |
| 261028-m3b | AIO cycle Defects list: priority icon + assignee avatar at narrowest, columns reordered, Triggered By removed, tighter column widths | 2026-10-28 | e00861ee | Verified (UAT) | [261028-m3b-aio-tc-defects-responsive-columns-assign](./quick/261028-m3b-aio-tc-defects-responsive-columns-assign/) |
| 261028-mgp | Story Points filter on Backlog + Sprint Board (shared filter store; stories only, subtasks follow their story) | 2026-10-28 | 90bb5286 | Verified (UAT approved) | [261028-mgp-sprint-board-and-backlog-shared-filter-b](./quick/261028-mgp-sprint-board-and-backlog-shared-filter-b/) |
| 261028-n6b | My Tasks rows: container-query responsive tiers (hide SP+labels <1024, icon-only chips <860, shrink/hide time bar <720/<580) | 2026-10-28 | 76c67851 | Verified (UAT approved) | [261028-n6b-my-tasks-view-fix-overlapping-row-column](./quick/261028-n6b-my-tasks-view-fix-overlapping-row-column/) |
| 261029-oyw | Release detail responsive: task table container-query tiers (compact <860, drop type icon <640 (assignee avatar kept at all widths), MR <520, status <400), peek bar clear of key (pl-2), sidebar side-by-side + compact (80px labels, 256 default, 40% cap) + matching drag bounds, narrow-safe sidebar/breadcrumb | 2026-10-29 | 12664124 | Verified (UAT approved) | [261029-oyw-optimize-release-detail-page-for-smaller](./quick/261029-oyw-optimize-release-detail-page-for-smaller/) |
| 261029-q7k | Releases list: removed per-row Sync packages button + dead bulk-sync code (executeDeploymentPackageSync, resolveShapesForCandidates, planBulkSync); package chip + release-detail per-row fixes kept | 2026-10-29 | 309770cd | Verified (UAT approved) | [261029-q7k-in-releases-list-remove-the-button-to-sy](./quick/261029-q7k-in-releases-list-remove-the-button-to-sy/) |
| 261029-qez | AIO Test cycles + cycle detail: Backlog-style Refresh control ("Refreshed: HH:MM:SS" + RefreshCw icon button); upstream-first staged invalidation in lib/aio-refresh.ts (list → summaries; cycle/runs/status-map → summaries/step-summary/defects by numeric id) | 2026-10-29 | d500ca2c | Verified (UAT approved) | [261029-qez-add-refresh-button-to-aio-cycles-and-cyc](./quick/261029-qez-add-refresh-button-to-aio-cycles-and-cyc/) |
| 261030-eic | Releases list skeleton mirrors loaded page (Today row, month labels, Next-release card, rail rows, Released panel + show-older; shares ROW_GRID/RAIL_LINE/LABEL_CLASS with ReleaseAgenda) + ReleasesHero summary-line placeholder while loading | 2026-10-30 | 45842716 | Verified (UAT approved) | [261030-eic-make-releases-page-skeleton-match-actual](./quick/261030-eic-make-releases-page-skeleton-match-actual/) |

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
| 261014-eym | Deployment package ↔ fix version sync (RM week child, sidebar + release detail warnings/fixes, Releases tab sync, RM project setting) | 2026-10-14 | a29ad1db | Verified (live UAT approved; review warnings fixed) | [261014-eym-enhance-deployment-package-for-jira-stor](./quick/261014-eym-enhance-deployment-package-for-jira-stor/) |
| 261014-j3s | AIO cycle defect summary: larger Status donut + legend, Priority\|Severity side by side below, wider block | 2026-10-14 | e1863f8a | Verified (UAT by user) | [261014-j3s-aio-cycle-defect-summary-layout](./quick/261014-j3s-aio-cycle-defect-summary-layout/) |
| 261014-n5a | Optimize AIO cycle detail for smaller screens (4 tiles in a row, Execution beside Defects, no h-dividers, captioned donuts) | 2026-10-14 | e3e74dd7 | Verified (user UAT) | [261014-n5a-optimize-aio-cycle-detail-for-smaller-sc](./quick/261014-n5a-optimize-aio-cycle-detail-for-smaller-sc/) |
| 261014-nkt | Hide Fix Versions + Deployment package rows on epic/subtask detail (story-only) | 2026-10-14 | 6830f704 | Verified (inline, test fails pre-fix) | [261014-nkt-hide-fix-version-and-deployment-version-](./quick/261014-nkt-hide-fix-version-and-deployment-version-/) |

## Session Continuity

Last session: 2026-10-30T10:51:20.053Z
Stopped at: Phase 94 UI-SPEC approved
Resume file: .planning/phases/94-release-detail-redesign-nicer-professional-page-with-more-re/94-UI-SPEC.md

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
