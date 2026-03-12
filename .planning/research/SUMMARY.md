# Project Research Summary

**Project:** Taskflow v1.1 Polish
**Domain:** Jira + GitLab desktop integration dashboard (Tauri 2, on-premise Data Center)
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

Taskflow v1.1 is a polish milestone on an already-shipped Tauri 2 + React + TypeScript desktop dashboard. The existing stack is sound and requires no new dependencies. All six v1.1 feature areas — story/subtask hierarchy, sprint progress enrichment, workload time tracking, dashboard enrichment, releases status display, and MR attention filtering — can be delivered by extending a single Jira API fields parameter (`parent,subtasks,timetracking`) and making targeted, additive changes to existing tab components. The foundational architecture is well-designed: a shared TanStack Query cache means adding fields once to `fetchSprintIssues` propagates data improvements to every consumer simultaneously.

The recommended delivery order is strictly driven by the dependency graph. One prerequisite change — extending `JiraIssue` in `jira.ts` and adding `parent,subtasks,timetracking` to the `fields` query param — unlocks four of the six feature areas at zero risk because all new fields are optional and existing code compiles unchanged. From there, two features (Releases sort, MR open-only filter) are fully independent and can be shipped immediately as quick wins. The most UI-complex feature (story/subtask hierarchy grouping) is deliberately last among the Jira work because it depends on the type foundation and is the only phase requiring new components.

The critical risks are all Jira Data Center API behaviors, not architectural unknowns. Subtasks do not inherit sprint JQL scope, so a two-query strategy is mandatory. Story points double-counting will occur the moment subtasks enter the flat issue list unless the points accumulation loop filters by `issuetype.subtask === true`. Time tracking fields are absent silently when the Jira admin has disabled the feature — graceful hide (not zeros) is required. Every one of these pitfalls has a clear, low-cost fix documented in PITFALLS.md; none requires architectural rework.

---

## Key Findings

### Recommended Stack

The v1.0 stack is validated and ships today: Tauri 2 desktop shell, React 18 + TypeScript, Vite, TanStack Query v5, Zustand, shadcn/ui + Tailwind CSS v4, `@tauri-apps/plugin-stronghold` for PAT storage. No new npm packages are needed for v1.1. See `STACK.md` for the full technology table and rationale.

The only v1.1 stack-level addition is a story points field discovery function (`discoverStoryPointsField()` via `GET /rest/api/2/field`) because the `customfield_10016` ID is instance-specific on Data Center. The fallback to `customfield_10016` covers the majority of installs, but discovery prevents silent zero-point displays on non-standard instances. The existing invalid `story_points` field name in the `fetchSprintIssues` fields string must also be removed — it is silently ignored by the API.

**Core technologies:**
- **Tauri 2 + `plugin-http`**: Desktop shell with CORS bypass for on-premise Jira/GitLab — no new changes for v1.1
- **TanStack Query v5**: Shared cache across all tabs; extending one query function propagates new fields everywhere
- **`services/jira.ts`**: Single integration point for all Jira API calls; `JiraIssue` type extension is the gating change for v1.1
- **`services/gitlab.ts`**: GitLab API calls; add `&state=opened` to MR fetch functions
- **`src/lib/sprintUtils.ts` (new)**: Pure utility module sharing `groupByAssignee` and `formatHours` between WorkloadTab and SprintProgressTab

### Expected Features

**Must have (table stakes — P1):**
- `fetchSprintIssues` fields extension: add `parent,subtasks,timetracking` — prerequisite for all Jira hierarchy/time features
- Releases tab: sort newest-to-oldest + released/unreleased badge — client-side only, no API changes
- MR Attention: open MRs only (`state=opened` on GitLab fetch calls) — single-line fix per function
- Workload: story points bug fix (double-counting parent + subtask points) — filter by `issuetype.subtask`
- Sprint Progress: points breakdown by status bucket (To Do / In Progress / Done separately)
- Workload: time tracking columns (estimate / spent / remaining) per assignee
- Sprint Progress: per-assignee breakdown table

**Should have (differentiators — P2):**
- Story/subtask hierarchy in MyTasksTab (grouped under parent story, collapsible)
- Story/subtask hierarchy in SprintBoardTab (subtask cards under story card in columns)
- MR Attention: subtask-story filter (MR relevant if linked story has current user's subtask)
- Dashboard: developer subtask section + MR health summary + sprint health breakdown
- Dashboard: recent notifications section (last 3 from Zustand store)
- Releases: overdue badge + "days until release" countdown
- Sprint Progress: sprint-wide time totals
- Parent story context chip on orphan subtask rows

**Defer (v2+):**
- Drag-and-drop subtask reordering (requires Jira rank API)
- Burndown charts (no historical data store)
- Fully configurable MR filter rules
- Workload overloaded indicator with configurable threshold
- Virtualised list rendering for sprints exceeding 200 issues

### Architecture Approach

The app follows a clean layered architecture: React UI tabs read from a shared TanStack Query cache, populated by typed service functions in `services/jira.ts` and `services/gitlab.ts`, backed by Zustand stores for UI state and credentials. All data transformation (grouping, filtering, aggregation) lives in `useMemo` within the owning component, extracted to `src/lib/sprintUtils.ts` when shared across multiple components. The v1.1 build order flows from a single non-breaking type foundation change, through isolated quick wins, to the most complex UI work last.

**Major components and v1.1 changes:**
1. `services/jira.ts` — MODIFIED: extend `JiraIssue` type with `parent?`, `subtasks?[]`, `timetracking?`, `issuetype.subtask: boolean`; extend `fetchSprintIssues` fields param; add `discoverStoryPointsField()`
2. `services/gitlab.ts` — MODIFIED: add `&state=opened` to `fetchAssignedMRs` and `fetchReviewerMRs`
3. `SprintBoardTab.tsx` + `MyTasksTab.tsx` — MODIFIED: two-pass grouping algorithm using new `StoryGroup.tsx`
4. `WorkloadTab.tsx` + `SprintProgressTab.tsx` — MODIFIED: import from new `sprintUtils.ts`; add time tracking columns and per-assignee breakdown
5. `ReleasesTab.tsx` — MODIFIED: client-side sort + released/unreleased badge (no API changes)
6. `MrAttentionTab.tsx` — MODIFIED: open-only filter + subtask-story filter predicate
7. `Dashboard/index.tsx` — MODIFIED: new sections reading from existing caches
8. **`StoryGroup.tsx`, `SubtaskRow.tsx`, `SubtaskCard.tsx`** — NEW: collapsible hierarchy components
9. **`src/lib/sprintUtils.ts`** — NEW: `groupByAssignee()`, `formatHours()` pure functions

### Critical Pitfalls

1. **Subtasks absent from sprint JQL** — `sprint in openSprints()` silently excludes subtasks on Jira DC (subtasks have no sprint field of their own). Mandatory fix: two-query strategy — sprint JQL for parent stories, then `issuetype in subtaskIssueTypes() AND parent in (KEY-1,KEY-2,...)` for subtasks; merge results client-side before grouping.

2. **Story points double-counting** — once subtasks enter the flat issue list alongside parent stories, summing `customfield_10016` for all issues counts points at both hierarchy levels. Fix: `if (issue.fields.issuetype.subtask) continue;` in every points accumulation loop.

3. **Time tracking silently absent** — `timetracking` is not in Jira's default field set AND may be disabled at the admin level. Always request it explicitly in `fields=`, use `*Seconds` integer variants for all arithmetic, and hide the time tracking section entirely (not zeros) when all values are null.

4. **Issuetype detection by name breaks on custom DC installs** — `issuetype.name === 'Sub-task'` fails on instances where the admin has renamed the type. Always use `issuetype.subtask === true` (the boolean system field, not the display name). Add it to the `JiraIssue` TypeScript interface.

5. **Mutation cache invalidation scope too narrow** — the existing `MyTasksTab` optimistic update only invalidates `['jira-issues','my-tasks',...]`. After subtask hierarchy, `SprintBoardTab` and `WorkloadTab` share the `['jira-issues','sprint-board',...]` key. Both keys must be invalidated in `onSettled` after any status transition.

6. **Query key staleness after fields extension** — adding new fields to `fetchSprintIssues` without changing the TanStack query key causes stale cached responses (lacking new fields) to be served until TTL expires. Bump the query key or use a cache-bust strategy when deploying the fields extension.

---

## Implications for Roadmap

All six feature areas were researched with the existing codebase as direct context. The dependency graph is clear and the build order is unambiguous. Six phases are recommended.

### Phase 1: API Foundation

**Rationale:** Every other phase depends on this. All new fields are optional — zero risk to existing functionality. This is a pure enablement change that unblocks Areas 1, 2, 3, and 6 simultaneously.
**Delivers:** Extended `JiraIssue` type (`parent?`, `subtasks?[]`, `timetracking?`, `issuetype.subtask: boolean`); updated `fetchSprintIssues` fields param using two-query strategy for subtasks; `discoverStoryPointsField()` function in `jira.ts`; removal of invalid `story_points` field name
**Addresses:** FEATURES dependency for areas 1, 2, 3, 6
**Avoids:** Pitfall 1 (two-query subtask strategy), Pitfall 3 (timetracking added to fields), Pitfall 4 (parent field added), Pitfall 5 (issuetype.subtask boolean added to type), Pitfall 6 (query key version bump)

### Phase 2: Quick Wins — Releases + MR Open Filter

**Rationale:** Both features are fully independent of Phase 1 (no new type fields needed). Releases is client-side only. MR state filter is a one-line change per function. Ship these first for immediate visible improvement at minimum risk.
**Delivers:** Releases tab sorted newest-first with released/unreleased badge; `fetchAssignedMRs` and `fetchReviewerMRs` in `gitlab.ts` filtered to `state=opened`; overdue badge + days-until countdown on releases
**Addresses:** FEATURES area 5 (all P1 + P2), area 6 (P1 open-only table stake)
**Avoids:** Pitfall 8 (client-side sort wrapped in useMemo), Pitfall 9 (server-side state filter, not client-side)

### Phase 3: Workload + Sprint Progress Enrichment

**Rationale:** Both tabs read from the same TanStack cache key and share `groupByAssignee` logic. Extracting `sprintUtils.ts` here prevents duplication. The workload double-counting bug fix is critical correctness work that must ship before hierarchy UI is built on top of it.
**Delivers:** `src/lib/sprintUtils.ts` with `groupByAssignee` + `formatHours`; WorkloadTab with correct story-level-only points + time tracking columns; SprintProgressTab with per-status point breakdown + sprint-wide time totals + per-assignee breakdown table
**Addresses:** FEATURES areas 2 (sprint progress enrichment) and 3 (workload time tracking); fixes the explicitly-named workload double-counting bug
**Avoids:** Pitfall 2 (double-counting fixed here), Anti-Pattern 3 (no duplicate groupBy logic), graceful-hide pattern for time tracking when admin-disabled

### Phase 4: Story/Subtask Hierarchy UI

**Rationale:** Highest UI complexity of the milestone. Depends on Phase 1 (parent + subtasks fields) and Phase 3 (sprintUtils patterns established). New components follow patterns proven in earlier phases.
**Delivers:** `StoryGroup.tsx` (collapsible, variant prop for row/card), `SubtaskRow.tsx`, `SubtaskCard.tsx`; MyTasksTab grouping subtasks under parent story using sprint-board cache; SprintBoardTab grouping subtasks within columns; parent context chip on orphan subtask rows; mutation handlers updated to invalidate both query keys
**Addresses:** FEATURES area 1 (all P1 + P2 hierarchy features)
**Avoids:** Pitfall 6 (mutation `onSettled` invalidates both my-tasks and sprint-board keys), Anti-Pattern 4 (collapse state in StoryGroup's own useState, not parent tab), Anti-Pattern 1 (no per-story subtask fetch queries)

### Phase 5: MR Subtask-Story Filter + Dashboard Enrichment

**Rationale:** The MR subtask-story filter requires `subtasks[]` on sprint issues (Phase 1) and the grouping patterns from Phase 4. Dashboard enrichment reads from caches populated by all prior phases; adding it last ensures all data is already in place.
**Delivers:** MrAttentionTab subtask-story filter predicate with reason labels; Dashboard new sections (my subtasks, MR health summary, sprint health breakdown, recent notifications from Zustand store); corrected MR attention count in Dashboard cards
**Addresses:** FEATURES area 6 (P2 subtask-story filter + reason labels), area 4 (all dashboard enrichment)
**Avoids:** Pitfall 7 (Dashboard reads from existing caches via `queryClient.getQueryData` + tight enabled role guards; handles cold-load blank state gracefully)

### Phase 6: Verification + Polish

**Rationale:** After all features are integrated, validate the "looks done but isn't" checklist from PITFALLS.md against the real Orange Jira Data Center instance. Several pitfalls are only detectable against the live instance.
**Delivers:** Verified correct behavior across all 9 documented pitfalls; UX fixes from the 5-item UX pitfall list (time tracking graceful hide, expanded-by-default subtask groups, workload tooltip for points-vs-time); production-ready build
**Addresses:** All pitfall verification items from PITFALLS.md; confirms `issuetype.subtask` detection on Orange's custom issue types; confirms time tracking admin status; confirms story points field ID via `discoverStoryPointsField()`

### Phase Ordering Rationale

- Phase 1 must be first because four of six feature areas depend on its type changes, yet it is zero-risk (all fields optional, no existing code breaks). The two-query subtask strategy is embedded here before any hierarchy UI work begins.
- Phase 2 is independent and can deliver value while Phase 1 is being tested. Ordering it second (not parallel) keeps the plan linear and avoids merge conflicts.
- Phase 3 precedes Phase 4 because the workload double-counting bug fix and `sprintUtils.ts` extraction must be stable before the more complex hierarchy rendering is built on top of them.
- Phase 4 is fourth because it is the most complex rendering work and depends on Phase 1's field infrastructure being stable and verified.
- Phase 5 is fifth because the MR subtask-story filter depends on Phase 4's subtask data being in cache, and Dashboard enrichment logically follows all the data it summarises being available.
- Phase 6 exists explicitly because several pitfalls are detectable only against the real Jira DC instance (time tracking admin config, subtask type naming, story points field ID variability).

### Research Flags

Phases needing careful validation against the real instance before declaring done:

- **Phase 1:** The two-query subtask JQL strategy must be verified on the specific Jira Data Center v10.3.15 instance. Subtask sprint inclusion behaviour varies by board filter configuration — confirm subtasks actually appear in the `issuetype in subtaskIssueTypes() AND parent in (...)` query before building hierarchy UI.
- **Phase 3:** Time tracking fields may be absent if the Orange Jira admin has time tracking disabled. Verify on the real instance before building time tracking UI columns; the graceful-hide path may be the only visible result.
- **Phase 6:** `discoverStoryPointsField()` result on the real instance — confirm whether `customfield_10016` is the correct story points field ID for this specific installation.

Phases with well-documented patterns (standard, skip deep research):

- **Phase 2:** Client-side sort and badge render in ReleasesTab; `state=opened` parameter for GitLab MR API — both are fully documented, straightforward, and verifiable without API research.
- **Phase 4:** StoryGroup collapse state pattern is established React; `useMemo` two-pass grouping is pure array manipulation with no novel API interactions.
- **Phase 5:** Dashboard passive cache reads (`queryClient.getQueryData`) follow the pattern already established in SprintBoardTab.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | v1.0 stack is already validated in production; v1.1 requires no new dependencies; `discoverStoryPointsField()` uses a standard, documented Jira API pattern |
| Features | HIGH | Based on direct codebase inspection of all relevant source files; scope defined by PROJECT.md v1.1 milestone; P1/P2/P3 prioritization is grounded in code inspection, not speculation |
| Architecture | HIGH | Based on direct codebase inspection; all integration points reference concrete, existing code; build order follows a confirmed dependency graph with no ambiguity |
| Pitfalls | HIGH (API constraints) / MEDIUM (DC v10.3 edge cases) | Jira Server/DC API constraints confirmed by multiple Atlassian community + official sources; exact behavior on Orange Jira DC v10.3.15 needs live validation |

**Overall confidence:** HIGH

### Gaps to Address

- **Subtask JQL on this specific DC instance:** The two-query strategy is correct per Atlassian documentation, but whether `sprint in openSprints()` includes or excludes subtasks on this particular board filter configuration must be validated in Phase 1 before hierarchy UI work begins.
- **Story points field ID on Orange instance:** `customfield_10016` is the most common default but is not guaranteed. The `discoverStoryPointsField()` function resolves this; log the discovered ID during Phase 1 development for explicit confirmation.
- **Time tracking admin status on Orange Jira:** Research cannot confirm whether the Orange Jira DC instance has time tracking enabled. Phase 3 must ship graceful-hide as the primary path, not an edge case.
- **`startDate` on fix versions:** Confirmed unavailable in GET responses on DC (Atlassian staff-confirmed). Releases sort must use `releaseDate` only. No workaround exists — this is an API constraint.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all route, service, store files in `taskflow/src/` — architecture, component responsibilities, existing patterns
- Atlassian Jira DC REST API v2 reference (9.14.0) — version endpoint, field names, time tracking structure
- Atlassian community (staff-confirmed): `startDate` not in GET version response; `subtasks` array returns 4 fields only by design; `timetracking` requires explicit field request AND admin enable
- Atlassian Support KB: subtask sprint JQL exclusion behavior (`openSprints()` does not match subtasks on DC)
- Atlassian Developer Community: `issuetype.subtask` boolean for reliable subtask detection; `parent` field not in default navigable fields
- TanStack Query v5 docs: query invalidation, shared cache keys, `queryClient.getQueryData` passive reads; tkdodo.eu concurrent optimistic updates
- Jira Java API docs (TimeTracking class, v7.6.1–9.x): `*Seconds` field availability confirmed across DC versions
- GitLab MR list API `state` parameter: standard documented server-side filter

### Secondary (MEDIUM confidence)
- Atlassian community threads: story points double-counting in Advanced Roadmaps; fix version API ordering behavior; `customfield_10016` ID variability across instances
- Industry pattern research: releases newest-first ordering conventions (GitHub, GitLab, Linear); sprint board subtask grouping user expectations
- PROJECT.md v1.1 milestone definition — authoritative scope source for feature boundary decisions

### Tertiary (noted gaps)
- Exact subtask JQL behavior on Orange Jira DC v10.3.15 with its specific board filter configuration — needs live validation in Phase 1
- Time tracking admin enable status on Orange Jira instance — needs live validation in Phase 3
- Story points custom field ID on Orange instance — resolved by `discoverStoryPointsField()` in Phase 1

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
