---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Jira Parity
status: completed
stopped_at: Phase 11 context gathered
last_updated: "2026-03-14T12:40:18.135Z"
last_activity: 2026-03-14 — Completed 10-04 (human verification passed; all five BOARD requirements confirmed; sticky columns, swimlanes, drag-and-drop verified)
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Phase 10 — Sprint Board Redesign (COMPLETE)

## Current Position

Phase: 10 of 13 (Sprint Board Redesign)
Plan: 10-04 complete (4 of 4 plans done in phase 10) — Phase 10 COMPLETE
Status: Complete
Last activity: 2026-03-14 — Completed 10-04 (human verification passed; all five BOARD requirements confirmed; sticky columns, swimlanes, drag-and-drop verified)

Progress: [██████████] 100% (v1.2, 4/4 plans — Phase 10 complete, human verification passed)

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

### Pending Todos

None.

### Blockers/Concerns

- [Phase 9]: Wiki markup renderer library selection (jira2md vs. custom extension of adfToPlainText) — verify jira2md maintenance status before adopting
- [Phase 11]: Account custom field type on Orange instance is unknown — call createmeta against live instance before designing Account field component
- [Phase 12]: Validate compound backlog JQL against Orange instance with a known closed-sprint issue before building UI
- [Phase 12]: Confirm futureSprints() JQL function availability on Orange instance

## Session Continuity

Last session: 2026-03-14T12:40:18.131Z
Stopped at: Phase 11 context gathered
Resume file: .planning/phases/11-create-edit-issue-form/11-CONTEXT.md
