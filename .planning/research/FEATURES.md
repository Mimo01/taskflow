# Feature Research — v1.1 Polish

**Domain:** Developer/PM dashboard — Jira + GitLab integration (Tauri 2 desktop, on-premise)
**Researched:** 2026-03-12
**Confidence:** MEDIUM-HIGH (code inspection HIGH; industry pattern research MEDIUM via WebSearch)

> This file supersedes the v1.0 FEATURES.md. v1.0 features are shipped and stable.
> This file focuses exclusively on the six v1.1 feature areas.

---

## Context: What Already Exists

Before defining table stakes and differentiators, it is important to be precise about what v1.0 built, because "enrichment" implies a working foundation.

| Component | v1.0 State |
|-----------|-----------|
| `SprintBoardTab` | Status columns, all-sprint issues, TaskCard with MR health dot, no subtask grouping |
| `MyTasksTab` | Flat list of issues assigned to current user, TaskRow with MR chips, no grouping |
| `SprintProgressTab` | 3-bucket counts (To Do / In Progress / Done) + story points progress bar (points done / total) |
| `WorkloadTab` | Per-assignee row: open task count + story points. Bug: counts stories and subtasks as flat items |
| `ReleasesTab` | Fix versions list, Jira issue counts, GitLab milestone/tag date-match. No sort order; released field available but not displayed |
| `MrAttentionTab` | Assigned MRs + reviewer MRs (unresolved threads filter). Includes merged/closed MRs. No subtask-linked-story filter |
| `Dashboard` (index) | 3 metric cards per role. Dev: Active Sprint Tasks, Open MRs, MRs Needing Attention. PM: Sprint Completion %, Team Workload (in-progress count), Next Release |
| `JiraIssue` type | Has `summary`, `status`, `assignee`, `customfield_10016` (story points), `issuetype`. Missing: `parent`, `subtasks`, `timetracking` |

---

## Feature Area 1: Story/Subtask Hierarchy

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dependency | Notes |
|---------|--------------|------------|--------------------|----|
| Subtasks visible under parent story in My Tasks | PM tools (Jira native, Linear, Height) always group child items under parent — flat list makes subtasks unrecognizable as belonging to a story | MEDIUM | `fetchSprintIssues` must request `parent` field in JQL; `JiraIssue` type needs `parent` and `subtasks` fields | Jira REST API v2: `parent` field returns `{id, key, fields: {summary, status, issuetype}}`. Currently not in the fields request |
| Parent story name visible wherever a subtask appears | Subtask summaries are often short ("Write unit tests") and meaningless without parent context | LOW | Requires parent field on JiraIssue | Display pattern: subtask row is indented with "STORY-1 > subtask summary" or a smaller parent chip above the subtask title |
| Sprint Board groups subtasks under story card | Jira's own board groups subtasks under their story in swimlane mode; developers expect this | MEDIUM | `fetchSprintIssues` parent field + board rendering logic | Subtask cards should be collapsible under the story card in their status column. Collapsed by default is acceptable |
| Subtask count on story card (e.g., "3/5 subtasks done") | Immediate sprint health signal at the story level | LOW | Derived from grouping logic once parent field is available | No extra API call — computed from already-fetched subtask statuses |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Collapsible subtask group in Sprint Board | Keeps board scannable — a story with 8 subtasks doesn't dominate a column | LOW | Default collapsed; expand toggle. Lucide `ChevronDown`/`ChevronRight` works |
| Story-level progress bar on board card | Show "3/5 done" as a mini progress bar on the story card, not just the count | LOW | One-line implementation once subtask data is available |
| MR health roll-up on story card | If any subtask's MR needs attention, surface a warning on the parent story | MEDIUM | Requires linking across subtask MR → story context |

### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| Drag-and-drop subtask reordering | Requires Jira rank field API (not standard); complex optimistic state | Read-only hierarchy display; status transitions are sufficient write action |
| Fetching subtask detail separately via issue-by-issue API calls | N+1 requests — one per subtask. Sprint with 20 stories x 5 subtasks = 100 extra requests | Ensure all required fields (including parent) are in the initial `fetchSprintIssues` JQL fields param |

### Dependency Note

All hierarchy features depend on a single change: adding `parent,subtasks` to the `fields` param in `fetchSprintIssues`. The `JiraIssue` type needs `parent?: { key: string; fields: { summary: string } }` and optionally `subtasks?: JiraIssue[]`. Once the API returns this data, all UI grouping is pure client-side computation.

---

## Feature Area 2: Sprint Progress Enrichment

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dependency | Notes |
|---------|--------------|------------|--------------------|----|
| Points breakdown by status (not just done vs remaining) | "In Progress" points matter — they represent work started but not finished; collapsing to done/remaining hides sprint risk | LOW | SprintProgressTab already has 3-bucket counts; needs pts per bucket | Currently `ptsDone` and `ptsRemaining` lump "To Do" and "In Progress" together. Separate `ptsInProgress` from `ptsTodo` |
| Per-assignee breakdown | PM's primary question: "Who is overloaded? Who is done?" | MEDIUM | Shared cache with WorkloadTab — same data, different presentation | Show table: assignee / to-do pts / in-progress pts / done pts. Sort by total open pts descending |
| Time totals (original estimate vs spent vs remaining) | Teams that use Jira time tracking expect to see sprint-level time summation | MEDIUM | Requires `timetracking` field added to `fetchSprintIssues` | Jira `timetracking` field: `originalEstimate` (string), `originalEstimateSeconds` (int), `timeSpent`, `timeSpentSeconds`, `remainingEstimate`, `remainingEstimateSeconds`. Only shown if time tracking enabled on the Jira instance |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Story vs subtask points separation | Stories often have points; subtasks inherit or have their own. Knowing the split prevents double-counting confusion | MEDIUM | Requires `issuetype` check — already in JiraIssue. Filter: only sum story points for issues with `issuetype.name !== 'Sub-task'` (or check `parent` absence) to avoid double-counting |
| At-risk indicator | If a sprint has > X% of points still In Progress with < 2 days remaining, surface a warning | MEDIUM | Requires sprint end date from Jira API (not currently fetched). Flag as out of scope unless sprint date is available |
| Time tracking graceful degradation | When no issues have time tracking set, hide the time section entirely rather than showing all zeros | LOW | Already done for story points — same pattern for time fields |

### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| Burndown chart | Requires historical snapshots — the app is live-only, no data store | Sprint-level current state breakdown is the appropriate scope |
| Per-day velocity trend | Same — no historical data | Out of scope per PROJECT.md |

### Dependency Note

Time tracking requires adding `timetracking` to the JQL `fields` parameter. The `JiraIssue` type needs `timetracking?: { originalEstimateSeconds: number | null; timeSpentSeconds: number | null; remainingEstimateSeconds: number | null }`. The `WorkloadTab` and `SprintProgressTab` share the same TanStack query cache key (`['jira-issues', 'sprint-board', ...]`) — adding time fields to the fetch benefits both simultaneously.

---

## Feature Area 3: Workload with Time Tracking

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dependency | Notes |
|---------|--------------|------------|--------------------|----|
| Workload correctly counts story-level points only | Current bug: if a sprint has Story A (5 pts) with Subtask B (2 pts) and Subtask C (3 pts), WorkloadTab may count 10 pts for the assignee instead of 5 | LOW-MEDIUM | `JiraIssue.issuetype` already in type; needs `parent` field to distinguish subtasks reliably | Fix: skip issues where `issue.fields.issuetype.name === 'Sub-task'` OR where `issue.fields.parent` exists when summing story points. The issue is double-counting when stories own the points |
| Time tracking per assignee (original estimate, time spent, remaining) | Developers who log time in Jira expect to see per-person tracking in workload | MEDIUM | `timetracking` field addition to JQL (see Area 2 dependency) | Show three columns per person: Estimated / Spent / Remaining. Sum per-assignee across their open (non-done) issues |
| Per-story time totals | Managers check story-level time to identify estimation errors | MEDIUM | Same `timetracking` field | In the workload row or a drill-down, show per-story time sums |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Time tracking graceful hide | When no issues in the sprint have time tracking set, hide the time columns completely | LOW | `hasTimeTracking = issues.some(i => i.fields.timetracking?.originalEstimateSeconds)` — same pattern as `hasPoints` |
| Workload bar visualization | Replace raw numbers with a stacked bar (Estimated / Spent / Remaining) for each assignee | MEDIUM | Tailwind width + fixed-height div. Useful for PMs who scan visually |
| Overloaded indicator | Flag assignees where remaining estimate exceeds X hours | MEDIUM | Configurable threshold — probably deferred to v2 to avoid settings bloat |

### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| Worklog detail (individual time entries) | Each entry requires a separate API call per issue; expensive for large sprints | Show summed seconds from `timetracking` field — Jira calculates this server-side |
| Capacity planning (compare estimate vs team capacity) | Requires team schedule/availability data — not in Jira's sprint API | Keep to "what's logged" vs "what's estimated" per the sprint data at hand |

---

## Feature Area 4: Dashboard Enrichment

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dependency | Notes |
|---------|--------------|------------|--------------------|----|
| Developer dashboard shows open subtasks (grouped by parent story) | If My Tasks is being enriched with hierarchy, the Dashboard overview must reflect the same reality | MEDIUM | Same parent/subtasks field addition. Dashboard currently queries `['jira-issues', 'my-tasks', ...]` — same cache | Show "X subtasks across Y stories" or list them in a compact section below the 3 metric cards |
| Developer dashboard shows my open MR status summary | Current card shows count only — no health breakdown | LOW | GitLab MR data already fetched for Dashboard. Filter to `state === 'opened'` | Show mini breakdown: X waiting review, Y changes requested, Z approved |
| Sprint health summary (PM) | PM dashboard currently shows Sprint Completion % — should show per-status breakdown | LOW | `sprintIssues` already fetched in Dashboard | Add To Do / In Progress / Done counts inline below the % card |
| Recent notifications | Dashboard is the "home" screen — showing last 3–5 notifications creates instant context | MEDIUM | Notifications hub already built; notifications are in Zustand store | Read from notifications store, show truncated list with unread badges |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Next Release countdown (PM) | "Release in 3 days" is actionable; "v2.1.0 · 2026-03-15" is informational | LOW | Derived from existing `nextRelease.releaseDate` — just compute days delta |
| MR attention count filtered correctly | Dashboard currently shows reviewer MR count without the open-only filter that v1.1 adds to MrAttentionTab | LOW | After MrAttentionTab filtering is fixed, Dashboard should share or mirror that logic |
| Empty state messaging | When sprint has no tasks, MR list is empty, etc., Dashboard should explain rather than show "0" | LOW | Guidance: "No active sprint" vs "0 tasks" — meaningfully different |

### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| Clickable/navigable dashboard cards | Deep-linking from a card into the relevant tab is nice but adds routing complexity | Keep cards as read-only summary; tabs are one click away in the sidebar |
| Per-card refresh controls | Dashboard is an overview — it should inherit the refresh timing of the underlying data | Single refresh at the top or no refresh control; let TanStack Query manage it |
| Custom dashboard layout | This is a focused internal tool — opinionated layout is a feature, not a limitation | Keep role-based card sets; add depth to existing cards rather than adding flexibility |

---

## Feature Area 5: Releases Status Display

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dependency | Notes |
|---------|--------------|------------|--------------------|----|
| Versions ordered newest-to-oldest | Industry standard (GitHub releases, NPM, Jira itself on the release page) — upcoming releases first, then history | LOW | `fetchFixVersions` returns versions from `/rest/api/2/version` — sort client-side by `releaseDate` descending, nulls last | No new API call needed |
| Released vs Unreleased status badge | The `released` boolean is already in `JiraFixVersion`. It is the most important differentiator on a releases list — "is this out?" | LOW | `JiraFixVersion.released: boolean` already in type and returned by API | Badge: green "Released" / grey "Unreleased". If `released && archivedFlag` could show "Archived" but archiving is rare — skip for v1.1 |
| Unreleased versions at the top | Project managers work on what's coming, not what's shipped. Released versions are history | LOW | Client-side sort: `unreleased first, then by releaseDate desc within each group` | Common pattern: Linear, GitLab, GitHub all front-load unreleased items |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Overdue unreleased badge | If `releaseDate < today && !released`, the version is overdue — flag it distinctly | LOW | Compute `isOverdue = !v.released && v.releaseDate && new Date(v.releaseDate) < new Date()`. Show amber "Overdue" badge |
| Days until release | "In 5 days" is more actionable than "2026-03-17" for unreleased versions | LOW | `daysDelta = Math.ceil((new Date(v.releaseDate) - Date.now()) / 86_400_000)`. Show only for unreleased, non-overdue |
| Task completion mini-bar per release | Existing `issuesFixed / issuesTotal` shown as a progress bar rather than fraction text | LOW | Single CSS div, same pattern as SprintProgressTab progress bar |

### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| Manual sort / drag-and-drop reorder | Ordering versions is an admin action in Jira — don't replicate admin capabilities in the dashboard | Sort by release date, stable and deterministic |
| Archived version toggle | Archived versions are rarely relevant to daily use; the endpoint returns them mixed in | Filter: show only non-archived. `JiraFixVersion` has no `archived` field in current type — verify if API returns it before adding |

### Dependency Note

The `JiraFixVersion` type already has `released: boolean` and `releaseDate?: string`. No new API fields needed. The entire feature is a client-side sort and badge render change in `ReleasesTab.tsx`.

---

## Feature Area 6: MR Attention Filtering

### Table Stakes

| Feature | Why Expected | Complexity | Existing Dependency | Notes |
|---------|--------------|------------|--------------------|----|
| Open MRs only | A merged or closed MR that needed attention no longer needs attention. Showing them is noise | LOW | GitLab MR API returns `state` field. Add filter: `mr.state === 'opened'` | Current `fetchAssignedMRs` and `fetchReviewerMRs` may return merged MRs. Filter at the component or service level |
| Assigned to me OR linked to a story with my subtask | The current logic shows assigned + reviewer MRs, but misses the case where a developer owns a subtask on a story that has an MR | MEDIUM | Requires `parent` field on JiraIssue (from Area 1), plus JQL for "my subtasks" | Logic: MR is relevant if (a) assigned to current user, OR (b) MR links to a story key AND current user has a subtask under that story. This is the tightest, most correct filter for "MRs I need to care about" |
| No closed/merged MRs visible | Developers frequently check this tab during sprint review — showing old merged MRs creates confusion about sprint state | LOW | Same `state === 'opened'` filter | This is the simplest fix — single-line filter |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Clear reason why each MR appears | Show a small label: "Assigned to you" vs "You have a subtask on STORY-5" | MEDIUM | Requires knowing which filter matched. Compute `reason: 'assigned' | 'subtask-story'` per MR during the filtering step |
| MR count badge improvement | After filtering to open-only + correct logic, the count in Dashboard's "MRs Needing Attention" card will be more accurate | LOW | Dashboard uses `reviewerMrs.length` — this becomes correct once MrAttentionTab filtering logic is applied consistently |
| Subtask-story MR context | When an MR appears because of a subtask linkage, show the subtask name inline in MrRow | MEDIUM | Requires threading subtask info through to MrRow props |

### Anti-Features

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| Fully configurable MR filter rules | The right filter set is deterministic for this team's workflow — making it configurable adds UI complexity with no clear user need | Ship the correct filter; revisit in v2 if teams have divergent needs |
| Showing MRs where user is mentioned in a comment | Over-inclusive; generates too many false positives for "attention" framing | The current "unresolved threads where user is reviewer" filter is the correct precision level |

### Dependency Note

The "linked to story with my subtask" filter requires:
1. `parent` field on JiraIssue (Area 1 dependency).
2. The current user's Jira username/displayName for filtering — available via `useAuthStore` (jiraUser is stored after validation).
3. A set of story keys where current user has a subtask: `new Set(myTasks.filter(i => i.fields.parent).map(i => i.fields.parent!.key))`.
4. Then: an MR's linked task key must be in that set.

---

## Cross-Feature Dependencies

```
fetchSprintIssues (adds parent, subtasks, timetracking fields)
    ├── Area 1: Story/subtask hierarchy (parent field)
    │       ├── MyTasksTab grouping
    │       ├── SprintBoardTab grouping
    │       └── Area 6: MR Attention "subtask-story" filter
    ├── Area 2: Sprint Progress (timetracking field)
    │       └── Area 3: Workload time tracking (same field, same cache)
    └── Area 3: Workload bug fix (issuetype or parent field)

JiraFixVersion.released (already available)
    └── Area 5: Releases status display (sort + badge — no new API calls)

GitLabMR.state (already available in API response)
    └── Area 6: MR Attention open-only filter (single filter predicate)

Dashboard (reads from TanStack cache shared with all tabs)
    ├── Area 4: Developer subtask section (reads my-tasks cache after hierarchy fix)
    ├── Area 4: MR health summary (reads gitlab-mrs cache)
    └── Area 4: Sprint health summary (reads sprint-board cache)
```

### Dependency Order for Implementation

1. **First:** Add `parent,subtasks,timetracking` to `fetchSprintIssues` fields param and extend `JiraIssue` type — this unblocks Areas 1, 2, 3, and 6.
2. **Second:** Workload story-points bug fix (Area 3, LOW complexity) — independent once type is extended.
3. **Third:** Releases sort + status badge (Area 5) — fully independent, no type changes needed.
4. **Fourth:** MR Attention open-only filter (Area 6, LOW) — independent, single predicate.
5. **Fifth:** Sprint Progress enrichment (Area 2) — uses timetracking field added in step 1.
6. **Sixth:** Story/subtask hierarchy UI (Area 1) — uses parent field added in step 1; more rendering complexity.
7. **Seventh:** MR Attention subtask-story filter (Area 6, MEDIUM) — requires Area 1 parent field and MyTasks to have been updated.
8. **Eighth:** Dashboard enrichment (Area 4) — reads from caches enriched by earlier areas; relatively independent rendering work.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Releases: sort + released/unreleased badge | HIGH | LOW (client-side only) | P1 |
| MR Attention: open-only filter | HIGH | LOW (one-line filter) | P1 |
| Workload: story-points bug fix | HIGH | LOW-MEDIUM | P1 |
| Sprint Progress: points by status | HIGH | LOW | P1 |
| fetchSprintIssues: add parent + timetracking fields | HIGH | LOW (prerequisite) | P1 |
| Workload: time tracking columns | HIGH | MEDIUM | P1 |
| Sprint Progress: per-assignee breakdown | HIGH | MEDIUM | P1 |
| Story hierarchy: MyTasksTab grouping | HIGH | MEDIUM | P2 |
| Story hierarchy: SprintBoardTab grouping | HIGH | MEDIUM | P2 |
| MR Attention: subtask-story filter | MEDIUM | MEDIUM | P2 |
| Dashboard: subtask section + MR health summary | MEDIUM | MEDIUM | P2 |
| Dashboard: sprint health inline breakdown | MEDIUM | LOW | P2 |
| Dashboard: recent notifications | MEDIUM | LOW | P2 |
| Releases: overdue badge + days-until | MEDIUM | LOW | P2 |
| Sprint Progress: time totals | MEDIUM | LOW (once field added) | P2 |
| Story hierarchy: parent name chip on subtask | MEDIUM | LOW | P2 |
| MR Attention: reason label per MR | LOW | MEDIUM | P3 |
| Workload: stacked bar visualization | LOW | MEDIUM | P3 |

**Priority key:** P1 = must have for v1.1, P2 = should have, P3 = nice to have / v1.2 candidate

---

## Sources

- Codebase inspection (jira.ts, SprintBoardTab.tsx, WorkloadTab.tsx, SprintProgressTab.tsx, ReleasesTab.tsx, MrAttentionTab.tsx, Dashboard/index.tsx, TaskRow.tsx, MrRow.tsx) — HIGH confidence
- Jira REST API v2 community documentation on time tracking fields and parent/subtasks fields structure — MEDIUM confidence (verified pattern, not live-tested against this specific Jira Data Center v10.3.15 instance)
- Jira sprint board subtask grouping community discussions — MEDIUM confidence (confirms industry expectation for grouping under parent story)
- Sprint dashboard metrics industry patterns (Atlassian Analytics, Bold BI, Axify) — MEDIUM confidence
- GitLab MR state field and filtering documentation — MEDIUM confidence
- PROJECT.md v1.1 milestone definition — HIGH confidence (authoritative scope source)

---

*Feature research for: Taskflow v1.1 Polish milestone*
*Researched: 2026-03-12*
