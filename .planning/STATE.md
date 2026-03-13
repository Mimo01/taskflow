---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Jira Parity
status: ready_to_plan
stopped_at: ""
last_updated: "2026-03-13T00:00:00.000Z"
last_activity: "2026-03-13 - Roadmap created for v1.2 Jira Parity (phases 9-13)"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Phase 9 — Custom Field Discovery + Issue Detail Foundation

## Current Position

Phase: 9 of 13 (Custom Field Discovery + Issue Detail Foundation)
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-13 — Roadmap created for v1.2 Jira Parity (phases 9-13)

Progress: [░░░░░░░░░░] 0% (v1.2)

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

### Pending Todos

None.

### Blockers/Concerns

- [Phase 9]: Wiki markup renderer library selection (jira2md vs. custom extension of adfToPlainText) — verify jira2md maintenance status before adopting
- [Phase 11]: Account custom field type on Orange instance is unknown — call createmeta against live instance before designing Account field component
- [Phase 12]: Validate compound backlog JQL against Orange instance with a known closed-sprint issue before building UI
- [Phase 12]: Confirm futureSprints() JQL function availability on Orange instance

## Session Continuity

Last session: 2026-03-13
Stopped at: Roadmap created for v1.2 Jira Parity — 5 phases (9-13), 27 requirements mapped
Resume file: None
