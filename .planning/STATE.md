---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Jira Parity
current_plan: 4 of 4 (complete)
status: complete
stopped_at: Completed 13-05-PLAN.md — Phase 13 and v1.2 milestone fully complete
last_updated: "2026-03-14T23:05:00.000Z"
last_activity: 2026-03-14 — Completed 13-05 (Human verification passed — EPIC-01..04 confirmed on Orange Jira instance; v1.2 milestone achieved)
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 26
  completed_plans: 26
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Phase 12 — Backlog View (next)

## Current Position

Phase: 13 of 13 (Epic Management) — COMPLETE
Current Plan: 4 of 4 (complete)
Next: All phases complete — v1.2 milestone achieved
Status: Phase 13 fully complete — all EPIC requirements (EPIC-01..04) human-verified on Orange Jira instance; v1.2 milestone achieved
Last activity: 2026-03-14 — Completed 13-05 (Human verification passed — EPIC-01..04 confirmed on Orange Jira instance; v1.2 milestone achieved)

Progress: [██████████] 100% (v1.2, 5/5 plans — Phase 13 fully complete)

## Performance Metrics

**Velocity (v1.1 baseline):**
- Total plans completed: 24 (v1.1) + 20 (v1.0)
- Average duration: ~9.4 min
- Total execution time: ~75 min (v1.0)

**Recent Trend:**
- Last 5 plans: 5min, 4min, 10min, 4min, 4min
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key v1.2 constraints from research:

- [v1.2 RESEARCH]: ADF is Cloud-only — Jira DC v2 description is always wiki markup string; never send ADF JSON to create/update endpoint
- [v1.2 RESEARCH]: Epic link field ID is instance-specific — discover via schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'; never hardcode customfield_10014
- [v1.2 RESEARCH]: discoverCustomFields() replaces discoverStoryPointsField() — single call resolves story points, epic link, epic name, and Account field IDs
- [v1.2 RESEARCH]: Issue detail must use independent query key ['jira-issue-detail', key, jiraBaseUrl] — never reuse sprint board cache
- [v1.2 RESEARCH]: Backlog JQL must use compound clause: sprint is EMPTY OR sprint not in (openSprints(), futureSprints())
- [v1.2 RESEARCH]: createmeta endpoint must be called before form build — only send fields confirmed present on screen to avoid "field not on screen" 400s
- [v1.2 RESEARCH]: Drag-drop flicker fix: maintain localOrder in component useState as drag source of truth; rollback on mutation error
- [v1.2 RESEARCH]: IssueDetailSheet renders as shadcn Sheet slide-over (not route navigation) — keeps board DndContext mounted
- [v1.2 RESEARCH]: Use @dnd-kit/core v6 (stable API) — @dnd-kit/react new API not production-ready as of Nov 2025
- [v1.2 RESEARCH]: Pin Zod to ^3.24 — zodResolver silently breaks with Zod v4 (formState.errors never populated)
- [v1.2 RESEARCH]: Issue link type names are admin-configurable — discover via GET /rest/api/2/issueLinkType; never hardcode
- [Phase 09]: Used @ts-expect-error on jira2md default import — no TypeScript default export type declarations
- [Phase 09]: WikiRenderer null guard produces empty string '' to avoid React children warning on undefined
- [09-01]: Plans 09-02/03 ran before 09-01 — WikiRenderer.test.tsx and jira.test.ts Phase 9 scaffolds already present as real tests; kept real tests (no regression to stubs)
- [09-01]: jira.test.ts import fix — discoverStoryPointsField removed (superseded by discoverCustomFields in 09-02)
- [09-02]: discoverStoryPointsField removed from jira.ts — discoverCustomFields supersedes it with all four field keys
- [09-02]: accountFieldKey added to settings store as string | null (null default) — reserved for Phase 11
- [09-02]: fetchIssueDetail explicit fields= param includes epicNameFieldKey (omitted from research code example; added per Pitfall 1)
- [09-04]: IssueDetailBody split as internal component — prevents useQuery being called unconditionally when issueKey is null (rules of hooks)
- [09-04]: skeleton.tsx created manually (standard shadcn animate-pulse pattern) — npx shadcn not available in execution environment
- [09-04]: data-testid added to skeleton div for reliable test assertions without relying on CSS class names
- [09-06]: textarea.tsx created manually — npx shadcn not available; native textarea wrapper consistent with input.tsx pattern
- [09-06]: relativeTime inlined in IssueDetailContent using Intl.RelativeTimeFormat — zero-dependency per RESEARCH.md guidance
- [09-06]: CommentComposer reads token via readSecret('jira-pat') directly — no prop drilling of auth token
- [09-06]: comment thread renders [...comments].reverse() — newest-first without mutating original array
- [09-05]: useFieldMutation hook extracted inside IssueDetailSidebar — co-locates mutation logic with editing UI; reusable template for future field edits
- [09-05]: PopoverTrigger used without asChild — @base-ui/react/popover does not support asChild/slot composition pattern
- [09-05]: Priority select opens immediately on click (not two-step) — reduces edit friction
- [09-07]: IssueDetailSheet is a named export — import { IssueDetailSheet }, not default import
- [09-07]: SprintBoardTab sheet placed as React fragment sibling outside DndContext DOM subtree — DndContext stays mounted while sheet is open
- [09-07]: onOpenIssue=setSelectedIssueKey implements single-sheet subtask navigation (key replacement, no nesting)
- [09-08]: IssueDetailSheet lifted to AppLayout (main.tsx) — search/notifications live in TopBar (global shell), not inside a route; only AppLayout level can serve all entry points
- [09-08]: onIssueClick prop threading used (not React context) — codebase has zero existing context usage; explicit props kept
- [09-08]: Jira issue key extracted from NotificationItem.entityTitle ("PROJ-123: ...") with /browse/ URL as fallback — entityTitle format is stable
- [09-08]: Dashboard/index.tsx gets its own selectedIssueKey for SubtasksPanel — route components can't access AppLayout state without prop drilling through router
- [09-08]: IssueDetailSheet sidebar widened to 85vw sheet / 42% column / w-28 label — 70vw/38%/w-24 too narrow for metadata labels like "Story Points" and "Fix Versions"
- [Phase 10-sprint-board-redesign]: @dnd-kit/react not installed — @dnd-kit/core v6 stable API only; @dnd-kit/react new API not production-ready
- [Phase 10-sprint-board-redesign]: [10-01]: fetchProjectStatuses deduplicates statuses by id Set with first-occurrence-wins semantics
- [Phase 10-sprint-board-redesign]: [10-01]: createIssue hardcodes issuetype name as Story — minimal body per plan spec
- [Phase 10-sprint-board-redesign]: Subtasks always visible under StoryHeaderRow — old expandedStories collapse state removed; old HIER-02 tests replaced to match new always-visible layout
- [Phase 10-sprint-board-redesign]: DraggableCard passes onClick to TaskCard (not wrapper div) to avoid dnd-kit pointer event conflict
- [Phase 10-sprint-board-redesign]: QuickCreateInput renders '+ Add' as text (not lucide icon) — accessible name required by pre-written test
- [10-04]: Human verification passed — all five BOARD requirements confirmed working in live app with real Jira data
- [Phase 11-create-edit-issue-form]: createIssue() extended with optional options param — backward-compatible; existing QuickCreateInput.tsx caller (4-arg form) unaffected
- [Phase 11-create-edit-issue-form]: fetchCreatemeta() dual-endpoint: try 8.4+ paginated endpoint first, fallback to legacy flat on 404; takes both issueTypeId and issueTypeName
- [Phase 11-create-edit-issue-form]: bulkUpdateIssue() treats HTTP 204 as success — Jira DC returns 204 on PUT updates
- [Phase 11-create-edit-issue-form]: Dialog.Root used directly from @base-ui/react/dialog for centered modal (not Sheet slide-over)
- [Phase 11-create-edit-issue-form]: Two-step createmeta: fetch issuetypes list for IDs first, then fetch fields per type — required by 8.4+ paginated endpoint
- [Phase 11-create-edit-issue-form]: IssueLinkRow uses internal debouncedQuery state rather than passing debounced value to useQuery enabled flag
- [Phase 11-create-edit-issue-form]: crypto.randomUUID?.() with Date.now() fallback — crypto.randomUUID not available in vitest jsdom environment
- [Phase 11-create-edit-issue-form]: Modal state lifted to AppLayout (same level as IssueDetailSheet) — consistent shell ownership pattern for all modal entry points
- [Phase 11-create-edit-issue-form]: Sidebar Create Issue is a <button> not <NavLink> — opens dialog (no route change); defaultIssueType/defaultParentKey added to CreateEditIssueModalProps for Add Subtask pre-set entry point
- [12-01]: fetchBacklogIssues 400 error handling mirrors fetchSprintIssues — duck-type thrown Response by checking .status property
- [12-01]: addIssuesToSprint accepts sprintId: number (not string) to match JiraActiveSprint.id type
- [12-01]: BacklogPage.test.tsx uses dynamic import('./BacklogPage') inside each test — RED state is import failure at test runtime; TS2307 errors expected Wave 0 artifacts
- [12-02]: BacklogFilterBar uses native <select> (combobox role) — tests use getByRole('combobox') + fireEvent.change, requiring valid select options not @base-ui popovers
- [12-02]: filterOptions epics Map uses epicKey → (epicName ?? epicKey) fallback — ensures select options exist even when epicName field is null
- [12-02]: BACK-05 test has pre-existing mock design issue (useOutletContext is plain function not vi.fn()) — BACK-05 remains RED; functionality implemented correctly
- [Phase 12-backlog-view]: Button text 'Move to sprint' required — plan template would not match test regex /move to sprint/i
- [Phase 12-backlog-view]: useOutletContext mock changed to vi.fn() enabling BACK-03/BACK-05 tests to call mockReturnValue
- [Phase 12-backlog-view]: wasStoryCreate ref in AppLayout tracks modal open source for conditional jira-backlog cache invalidation on close
- [Phase 12-backlog-view]: Optimistic cache updates must spread existing cache object (...old) to preserve all BacklogViewData required fields including epicNames
- [Phase 12-backlog-view]: Test fixtures for BacklogViewData must include epicNames: new Map() — field is required (not optional) in the type
- [Phase 13-epic-management]: _projectKey prefixed with underscore in fetchEpicStories — JQL uses epicKey directly, projectKey not needed in query
- [Phase 13-epic-management]: Wave 0 RED test stubs use dynamic import() pattern same as Phase 12 — RED state is import resolution failure confirming TDD discipline
- [Phase 13-epic-management]: EpicsPage reads jiraBaseUrl/activeJiraProject from useAuthStore (not useSettingsStore) — consistent with BacklogPage; Wave 0 test stubs updated with proper mocks
- [Phase 13-epic-management]: TanStack Query v5 empty state: use data !== undefined (not !isLoading) to distinguish disabled query from resolved empty array
- [Phase 13-epic-management]: CreateEpicDialog reads jiraBaseUrl/activeJiraProject/jiraToken from useSettingsStore to match test contract
- [Phase 13-epic-management]: Dialog.Portal required by @base-ui/react/dialog — same pattern as CreateEditIssueModal
- [13-04]: EpicDetailSheet returns null (not closed Sheet) when epicKey is null — required by container.firstChild === null test assertion
- [13-04]: Token sourced from useSettingsStore.jiraToken (not readSecret) in EpicDetailSheet — test mock provides token via store, same pattern as CreateEpicDialog
- [13-04]: EpicDetailBody split as internal component — hooks rules compliance (useQuery not called when epicKey is null)
- [Phase 13-epic-management]: 13-05: Full test suite gated at 367 passing (above 351 baseline) — all 4 EPIC test files GREEN before human verification checkpoint
- [Phase 13]: 13-05: Human verification on Orange Jira instance confirmed EPIC-01..04 all pass — integration with real Jira DC data confirmed

### Pending Todos

None.

### Blockers/Concerns

- [Phase 9]: Wiki markup renderer library selection (jira2md vs. custom extension of adfToPlainText) — verify jira2md maintenance status before adopting
- [Phase 11]: Account custom field type on Orange instance is unknown — call createmeta against live instance before designing Account field component
- [Phase 12]: Validate compound backlog JQL against Orange instance with a known closed-sprint issue before building UI
- [Phase 12]: Confirm futureSprints() JQL function availability on Orange instance

## Session Continuity

Last session: 2026-03-14T23:03:33.024Z
Stopped at: Completed 13-05-PLAN.md — Phase 13 and v1.2 milestone fully complete
Resume file: None
