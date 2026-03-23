---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Dashboard Redesign & Feature Parity
status: Ready to plan
last_updated: "2026-03-23T09:00:20.314Z"
last_activity: 2026-03-23
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 15
  completed_plans: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Phase 33 — board-sprint-filters

## Current Position

Phase: 34
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.5) / 131+ (all milestones)
- Average duration: — (no v1.5 data yet)
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 31 P01 | 4min | 2 tasks | 5 files |
| Phase 31 P02 | 6min | 2 tasks | 10 files |
| Phase 31 P03 | 6min | 2 tasks | 8 files |
| Phase 32 P01 | 5min | 2 tasks | 11 files |
| Phase 32 P04 | 3min | 1 tasks | 2 files |
| Phase 32 P03 | 4min | 2 tasks | 7 files |
| Phase 32 P02 | 5min | 2 tasks | 9 files |
| Phase 32 P05 | 2min | 1 tasks | 1 files |
| Phase 33-board-sprint-filters P00 | 2min | 2 tasks | 6 files |
| Phase 33 P01 | 3min | 2 tasks | 6 files |
| Phase 33 P02 | 3min | 2 tasks | 3 files |
| Phase 33 P04 | 3min | 2 tasks | 4 files |
| Phase 33 P03 | 4min | 2 tasks | 4 files |
| Phase 33 P05 | 8min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.5 Roadmap]: 4 phases (coarse) — Issue Detail, Time/Attachments/Mentions, Board/Sprint/Filters, Layout
- [v1.5 Roadmap]: Activity timeline before time tracking (worklogs render in timeline)
- [v1.5 Roadmap]: Layout customization last (sidebar items and widgets depend on finalized feature set)
- [Phase 31]: Created sibling service modules (jira-changelog.ts, jira-watchers.ts) re-exported from jira.ts instead of jira/ subdirectory — preserves 20+ existing imports
- [Phase 31]: OverdueBadge placed in issue-detail/ subdirectory; plan FieldsSection.tsx mapped to actual IssueDetailSidebar.tsx
- [Phase 31]: Clone uses separate handleOpenClone (mode:create + initialValues) avoiding Pitfall 3
- [Phase 31]: CommentCard injected into ActivityTimeline via props to preserve memoization
- [Phase 32]: Created jira/ subdirectory for new service modules (worklogs, attachments, users, duration) rather than adding to monolithic jira.ts
- [Phase 32]: forwardRef + useImperativeHandle for keyboard delegation from textarea to mention popover
- [Phase 32]: AttachmentLightbox built from scratch for prev/next navigation instead of extending ImageLightbox
- [Phase 32]: Used base-ui PopoverTrigger directly (no asChild) matching project component API
- [Phase 32]: Import worklog/duration from jira/ submodule paths since main jira.ts barrel does not re-export them
- [Phase 32]: Restored types.ts verbatim from Phase 31 commit 82d7d13 to ensure exact field-level compatibility
- [Phase 33-board-sprint-filters]: Test stubs use it.todo() with no source imports to avoid coupling to unwritten code
- [Phase 33]: No new dependencies for Phase 33 Plan 01 -- all service modules use existing apiFetch and zustand patterns
- [Phase 33]: Client-side JQL evaluation with pass-through for unparseable patterns (conservative: show more, not less)
- [Phase 33]: Save Filter and local quickfilter Save coexist as separate buttons per D-13
- [Phase 33]: parallelBatch helper with concurrency=5 for bulk API calls instead of Promise.all
- [Phase 33]: Non-sticky content (banners, filters) placed above sticky column headers to fix scroll positioning
- [Phase 33]: Bulk edit UI disconnected per user preference; component files preserved on disk

### Pending Todos

None yet.

### Blockers/Concerns

- Attachment PAT auth negotiation needs prototyping against live Jira DC instance (Phase 32)
- react-grid-layout CSP/Tailwind v4 integration needs research validation (Phase 34)
- Settings store at v8 with 60+ fields — new features should use dedicated stores

## Session Continuity

Last session: 2026-03-23T12:25:07Z
Last activity: 2026-03-23 - Completed quick task 260323-j73: Unify Jira status badges across the app for consistent styling and colors
Resume: Roadmap created for v1.5. Next: `/gsd:plan-phase 31`

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260319-qkn | Add global gitignore with .claude and remove .claude from git | 2026-03-19 | a7e1702 | | [260319-qkn-add-global-gitignore-with-claude-and-rem](./quick/260319-qkn-add-global-gitignore-with-claude-and-rem/) |
| 260320-nz1 | Improve dev tools waterfall with more detailed data and cleaner presentation | 2026-03-20 | 42b500a | Verified | [260320-nz1-improve-dev-tools-waterfall-with-more-de](./quick/260320-nz1-improve-dev-tools-waterfall-with-more-de/) |
| 260323-fsy | Release detail page with inline editing | 2026-03-23 | 54c1406 | Verified | [260323-fsy-i-want-to-have-detail-page-for-releases-](./quick/260323-fsy-i-want-to-have-detail-page-for-releases-/) |
| 260323-gog | Release detail page match Jira tasks with MRs | 2026-03-23 | 214ac82 | Verified | [260323-gog-release-detail-page-match-jira-tasks-wit](./quick/260323-gog-release-detail-page-match-jira-tasks-wit/) |
| 260323-hn2 | Make jira-gitlab MR mapping case-insensitive and space-tolerant | 2026-03-23 | 76608a9 | Verified | [260323-hn2-make-the-jira-task-to-gitlab-merge-reque](./quick/260323-hn2-make-the-jira-task-to-gitlab-merge-reque/) |
| 260323-hwn | Add label summary to release detail page | 2026-03-23 | 1026cd0 | Verified | [260323-hwn-on-the-release-detail-page-i-want-to-see](./quick/260323-hwn-on-the-release-detail-page-i-want-to-see/) |
| 260323-i4a | In release detail I want to have an info if all merge requests have at least one label or not | 2026-03-23 | 646d330 | | [260323-i4a-in-release-detail-i-want-to-have-an-info](./quick/260323-i4a-in-release-detail-i-want-to-have-an-info/) |
| 260323-iiu | Change issue status from detail sidebar via Jira transitions | 2026-03-23 | f6661f8 | | [260323-iiu-i-want-to-be-able-to-change-issue-status](./quick/260323-iiu-i-want-to-be-able-to-change-issue-status/) |
| 260323-iwp | Add assignee avatars to subtask and epic story rows in issue detail | 2026-03-23 | e5c5734 | | [260323-iwp-in-issue-detail-i-want-to-see-assignee-o](./quick/260323-iwp-in-issue-detail-i-want-to-see-assignee-o/) |
| 260323-j73 | Unify Jira status badges across the app for consistent styling and colors | 2026-03-23 | fab847a | | [260323-j73-unify-jira-status-badges-across-the-app-](./quick/260323-j73-unify-jira-status-badges-across-the-app-/) |
