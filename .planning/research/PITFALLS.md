# Pitfalls Research

**Domain:** Adding subtask hierarchy, time tracking, workload accuracy, and dashboard enrichment to an existing Jira Data Center on-premise REST API integration
**Researched:** 2026-03-12
**Confidence:** HIGH (Jira Server API field behavior, TanStack Query cache sharing, double-counting) / MEDIUM (DC v10.3 specific edge cases, time tracking admin config variability)

---

## Critical Pitfalls

---

### Pitfall 1: Subtasks Do Not Inherit Sprint Membership in JQL

**What goes wrong:**
The existing `fetchSprintIssues` JQL uses `sprint in openSprints() AND resolution = Unresolved`. This query returns parent stories and tasks but silently omits subtasks in many configurations. Subtasks on Jira Data Center do not store their own sprint field value — they inherit it from their parent. The JQL sprint filter therefore cannot match them directly.

The result: after adding `parent` field to `JiraIssue`, the stories appear but their subtasks never arrive in the response. The hierarchy grouping logic has nothing to group.

**Why it happens:**
This is a documented Jira Data Center behavior, not a bug. Sub-tasks are considered child issues without their own sprint assignment. Community analysis and Atlassian support docs confirm that `sprint in openSprints()` reliably excludes subtasks in company-managed projects unless the instance has special board filter configuration.

**How to avoid:**
Use a two-part JQL union: fetch parent stories with sprint filter, then fetch subtasks via `issueType in subTaskIssueTypes() AND parent in (<parentKeyList>)`. Or, use a single broader fetch without sprint filter but with `issue in childIssuesOf("parentKey")` for known parents. The practical approach for this app:

1. Run the existing sprint JQL (returns only stories/tasks — the "parents").
2. Extract all returned issue keys.
3. Run a second JQL: `project = ${projectKey} AND issueType in subTaskIssueTypes() AND parent in (${parentKeys.join(',')}) AND resolution = Unresolved` to fetch their subtasks.
4. Merge both result sets in the client before grouping.

This requires two API calls instead of one, which must be coordinated correctly in the query function.

**Warning signs:**
- Sprint board renders but no subtask grouping ever appears under stories.
- `data.issues.filter(i => i.fields.issuetype.subtask)` is always empty despite subtasks visible in Jira UI.
- WorkloadTab shows fewer issues than the Jira sprint board shows.

**Phase to address:**
Phase that adds `parent`/subtask fields to `fetchSprintIssues` and `JiraIssue` type — before any hierarchy grouping UI work.

---

### Pitfall 2: Workload Story Points Double-Counting When Both Parent and Subtask Have Points

**What goes wrong:**
The current `WorkloadTab` iterates all sprint issues and sums `customfield_10016` per assignee. Once subtasks are returned in the same flat list as their parent stories, both the story's points and each subtask's points are counted. A story with 8 points that has three 2-point subtasks assigned to the same person becomes 8 + 6 = 14 points — nearly double.

This is the explicitly-named bug in the v1.1 milestone: "currently counts both parent stories AND subtasks, double-counting."

**Why it happens:**
The Jira community confirms that teams use story points inconsistently across hierarchy levels. Some teams put points only on stories (subtasks get 0). Some teams put points only on subtasks and leave the parent at 0. Some put points on both (especially after automation rules roll up subtask totals to the parent). Without hierarchy awareness, any summation that sees both levels double-counts in the last scenario.

**How to avoid:**
Apply a clear counting rule and document it:

- **Recommended rule:** Count story points only on parent-level issues (stories, tasks). Subtasks with `issuetype.subtask === true` contribute 0 to story point totals, regardless of whether they have a `customfield_10016` value set. Their time tracking fields (not story points) represent their effort.
- Implement this as a filter: `if (issue.fields.issuetype.subtask) continue;` in the points accumulation loop.
- For the "points per story" breakdown, sum subtask points separately (for display only, not for totals).

This rule is consistent with how Jira's native sprint reports handle the situation (they count only story-level points by default).

**Warning signs:**
- Workload totals are higher after the subtask query is added.
- A team member's points exactly equal (story points) + (sum of their subtask points).
- Story board shows 50 total sprint points; Workload shows 80+ total.

**Phase to address:**
Same phase as Pitfall 1 — the points aggregation logic must be fixed at the same time subtasks enter the data pipeline.

---

### Pitfall 3: Time Tracking Fields Are Not Returned Unless Explicitly Requested AND Admin-Enabled

**What goes wrong:**
Adding `timetracking` to the `fields` parameter in `fetchSprintIssues` is necessary but not sufficient. On Jira Data Center, time tracking fields (`timetracking.originalEstimate`, `timetracking.remainingEstimate`, `timetracking.timeSpent`) are:

1. **Only returned if time tracking is enabled** at the Jira admin level (Administration > Issues > Issue Features > Time Tracking). If disabled, the field is absent from every API response regardless of the `fields` parameter.
2. **Only returned if explicitly listed** in the `?fields=` parameter. The current query requests `summary,status,assignee,issuetype,customfield_10016,story_points` — `timetracking` is not in this list, so it is never returned even when enabled.
3. **Returned as strings, not seconds**, by default (`"2h 30m"` not `9000`). To get seconds (which are sortable and arithmetic-safe), request `timetracking` (which also returns `originalEstimateSeconds`, `remainingEstimateSeconds`, `timeSpentSeconds` alongside the string versions).

**Why it happens:**
Jira's API treats time tracking as a conditional navigable field. The Atlassian community confirms: "The timetracking element may not exist in API calls even when it's visible in other tools." The root cause is an admin toggle, not an API bug.

**How to avoid:**
- Add `timetracking` to the `fields` parameter in `fetchSprintIssues`.
- Use `timetracking.originalEstimateSeconds` (number) in all arithmetic — never parse the string `"1d 2h"` yourself.
- Make all time tracking display conditional on the field being present and non-null: `issue.fields.timetracking?.originalEstimateSeconds ?? null`.
- Add a `JiraIssue.fields.timetracking` optional field to the TypeScript interface:
  ```typescript
  timetracking?: {
    originalEstimate?: string;
    remainingEstimate?: string;
    timeSpent?: string;
    originalEstimateSeconds?: number;
    remainingEstimateSeconds?: number;
    timeSpentSeconds?: number;
  } | null;
  ```
- In the WorkloadTab and SprintProgressTab, show time tracking rows only when at least one issue in the sprint has non-null `timetracking`.
- Document in comments: "If all time tracking values are null, the admin has disabled time tracking on this Jira instance — hide the time tracking section entirely."

**Warning signs:**
- `issue.fields.timetracking` is always `undefined` for all issues.
- WorkloadTab shows 0h / 0h for all team members.
- No error is thrown — the field just silently absent.

**Phase to address:**
Phase that extends `JiraIssue` type and updates `fetchSprintIssues` field list.

---

### Pitfall 4: `parent` Field Is Not Returned for Subtasks in JQL Search Results Without Explicit Request

**What goes wrong:**
When fetching issues via `GET /rest/api/2/search`, the `parent` field is not included in the default navigable fields. If `parent` is not explicitly listed in `?fields=`, subtasks in the response have no `parent` object — there is no way to know which story they belong to. The hierarchy grouping logic silently breaks: subtasks appear as orphans.

Additionally, per a documented Jira community issue: "if the parent field of the Jira issue is not set, the parent schema won't be included" — meaning even when requested, the field may be absent on non-subtask issues (which have no parent). Code must handle `parent?: undefined` safely.

**Why it happens:**
`parent` is a navigable field that must be explicitly requested. The current `fetchSprintIssues` does not list it because subtask hierarchy was out of scope for v1.0.

**How to avoid:**
- Add `parent` to the `fields` parameter in `fetchSprintIssues`.
- Add `JiraIssue.fields.parent` optional field:
  ```typescript
  parent?: {
    id: string;
    key: string;
    fields: { summary: string; status: { name: string }; issuetype: { name: string } };
  };
  ```
- When building the hierarchy map in the UI, use `issue.fields.parent?.key` to group subtasks under their parent. A missing or undefined `parent` means the issue is a top-level story/task.
- Note: the `subtasks` field on a parent issue returns minimal objects (only `issuetype`, `priority`, `status`, `summary` by Atlassian's design). Do not attempt to read full subtask data from `parent.fields.subtasks` — you need the separately-fetched subtask issues.

**Warning signs:**
- `issue.fields.parent` is `undefined` on all issues even though some are clearly subtasks (their `issuetype.subtask === true`).
- Hierarchy grouping produces no groups — everything shows as top-level.
- The `fields` URL parameter does not contain `parent`.

**Phase to address:**
Same phase as Pitfall 1 and 3 — must be done in the `JiraIssue` type and `fetchSprintIssues` extension plan.

---

### Pitfall 5: Subtask Issuetype Detection Must Use `issuetype.subtask` Boolean, Not Name Matching

**What goes wrong:**
Code that detects subtasks by checking `issuetype.name === 'Sub-task'` will silently fail on instances where the admin has renamed the subtask type (common names: `"Sub-task"`, `"Subtask"`, `"Technical Task"`, `"Dev Task"`, custom names). This is especially likely on on-premise Data Center where the team has customized issue types for years.

**Why it happens:**
`issuetype.name` is admin-configurable on Data Center. There is no constraint that the subtask type be named "Sub-task." The reliable field is `issuetype.subtask: boolean` which is set by Jira's internal type system regardless of the display name.

**How to avoid:**
Always use `issue.fields.issuetype.subtask === true` to detect subtasks. Add this field to the `JiraIssue` TypeScript interface:
```typescript
issuetype: {
  name: string;
  subtask: boolean;  // Add this — true only for actual subtask issue types
};
```
Use this boolean in: double-counting prevention (Pitfall 2), hierarchy grouping (Pitfall 4), My Tasks filtering, MR Attention filtering.

**Warning signs:**
- Hierarchy grouping works in dev but breaks in the Orange Jira instance (their subtask type has a different name).
- `issues.filter(i => i.fields.issuetype.name === 'Sub-task')` returns empty array.
- Sprint board shows subtasks in their own column instead of grouped under parents.

**Phase to address:**
Phase that extends `JiraIssue` type — add `issuetype.subtask: boolean` at the same time as `parent` and `timetracking`.

---

### Pitfall 6: Optimistic Status Update Invalidates the Wrong Query Key for Shared Cache

**What goes wrong:**
The existing `MyTasksTab` optimistic update cancels and invalidates `['jira-issues', 'my-tasks', activeJiraProject]`. After adding subtask hierarchy, `SprintBoardTab` and `WorkloadTab` both use `['jira-issues', 'sprint-board', activeJiraProject]`. When a user transitions a subtask status in My Tasks, the sprint-board cache is not invalidated — WorkloadTab and SprintBoardTab continue to show the old status for that subtask.

A related issue: if the subtask query is a separate query key (e.g., `['jira-subtasks', activeJiraProject]`) and a status transition occurs, neither the parent query nor the subtask query gets invalidated from the My Tasks mutation handler.

**Why it happens:**
The current mutation handler was designed before subtask hierarchy existed. Cache invalidation scope was scoped narrowly to the my-tasks key only, which was correct for v1.0.

**How to avoid:**
- After a status transition mutation settles (in `onSettled`), invalidate both query keys:
  ```typescript
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks', activeJiraProject] });
    queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board', activeJiraProject] });
  }
  ```
- If subtasks are fetched with a separate query key, invalidate that key too.
- Verify the optimistic update correctly handles subtask issue objects (which now have a `parent` field that must not be lost during the spread operation).

**Warning signs:**
- After transitioning a subtask in My Tasks, the Sprint Board still shows the old status for that subtask card.
- WorkloadTab points count doesn't update after a task is marked done via My Tasks.
- Two tabs showing different statuses for the same issue simultaneously.

**Phase to address:**
Phase that adds subtask hierarchy to My Tasks — must update mutation handlers at the same time.

---

### Pitfall 7: Dashboard Enrichment Reading Stale Cache vs. Triggering Duplicate Fetches

**What goes wrong:**
The Dashboard overview page reads from caches using the same query keys as the tab components. If the Dashboard component tries to enrich itself with subtask-specific data (e.g., "my open subtasks count"), it either:

(a) Reads from an existing cache that was populated by a tab component — this is correct, but only if the tab has been visited and the cache is still fresh. On first app load, the Dashboard renders before tabs are visited, so the cache is empty.

(b) Adds a new `useQuery` call with the same key — TanStack deduplicates this correctly, but now both the Dashboard and the tab trigger the same query. If the Dashboard is `enabled` when a different role is active (it shouldn't be, but bugs creep in), it causes unnecessary fetches.

The current Dashboard already has a pattern of role-conditional `enabled` flags. With subtask data added, the risk of accidentally enabling a query for the wrong role increases.

**Why it happens:**
Dashboard enrichment inherently races against tab-level data population. The existing code documents this: "Data is fetched via React Query using the same query keys as the tab components so the cache is shared and no duplicate requests are made." This works only if both query definitions are identical (same key, same `queryFn`, same `enabled` conditions).

**How to avoid:**
- Use `queryClient.getQueryData(key)` (read-only, no fetch) in the Dashboard for data that the tab components are responsible for fetching. Only use `useQuery` if the Dashboard genuinely needs the data independently.
- For the "my open subtasks" dashboard card: derive from the existing `['jira-issues', 'my-tasks', activeJiraProject]` cache data client-side — filter by `issuetype.subtask === true` on the cached issues. No new query needed.
- Keep the `enabled` role guard tight: dashboard queries for developer-specific data must be `enabled: role !== 'pm'`, and vice versa.
- When adding new fields to existing query functions, ensure the query key changes if the field list changes — or TanStack will serve old cached responses that lack the new fields.

**Warning signs:**
- Dashboard shows "0 subtasks" on first load even when the user has subtasks, then corrects after a manual refresh.
- Network inspector shows duplicate requests for the same JQL endpoint from Dashboard and a tab simultaneously.
- A PM role user sees developer-specific queries firing (enabled flag bug).

**Phase to address:**
Phase that adds Dashboard enrichment (subtask counts, MR status, sprint health cards) — verify cache sharing logic before shipping.

---

### Pitfall 8: Fix Version API Returns Ascending Order (Oldest First); Sorting in Client Is Required

**What goes wrong:**
`GET /rest/api/2/version?projectKey=PROJ&maxResults=50` returns versions in internal Jira sequence order, which is typically oldest-first (the order they were created/ordered in the project administration panel). The Releases tab currently displays them in this API order, which puts old released versions at the top and upcoming unreleased versions at the bottom — the opposite of what is useful.

**Why it happens:**
The `/rest/api/2/version` endpoint on Data Center does not support an `orderBy=releaseDate DESC` parameter (unlike some Cloud endpoints). The `sequence` field exists but reflects the admin-defined drag-drop order, not necessarily release date order. The `released` boolean and `releaseDate` are returned but no server-side sort by date is available in REST v2 on DC.

**How to avoid:**
Sort in the client after fetching:
```typescript
versions.sort((a, b) => {
  // Unreleased versions with a future date come first
  // Released versions sorted newest-to-oldest next
  // Versions with no date go last
  const aDate = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
  const bDate = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
  return bDate - aDate; // newest first
});
```
Display a `released` badge (green chip "Released") and `unreleased` badge (grey chip "Upcoming") based on `version.released`.

**Warning signs:**
- Releases tab shows versions in random or creation order.
- Old releases appear above upcoming ones.
- No `released` status badge visible on release rows.

**Phase to address:**
Phase that fixes releases ordering and adds released/unreleased status display.

---

### Pitfall 9: MR Attention `open` Filter Must Be Applied at Query Time, Not Display Time

**What goes wrong:**
The current `MrAttentionTab` fetches assigned and reviewer MRs and filters reviewer MRs for unresolved discussions. It does not filter by MR state (`state: 'opened'`). Merged or closed MRs appear in the attention list because the GitLab API returns them unless `state=opened` is specified.

If the filter is applied only at render time (e.g., `data.filter(mr => mr.state === 'opened')`), the MRs are still fetched and cached. This wastes bandwidth and causes subtask-story linking logic to run against stale closed MRs.

**Why it happens:**
The `fetchAssignedMRs` and `fetchReviewerMRs` functions were built without a `state=opened` parameter in the initial implementation. The MR attention filtering requirement (open only) was not in the original spec — it is a v1.1 fix.

**How to avoid:**
Add `state=opened` to both `fetchAssignedMRs` and `fetchReviewerMRs` at the API call level, not as a client-side filter. This reduces the data volume and keeps the cache clean.

For the subtask-story linking MR filter: once a story's subtask keys are known, an MR should appear in Attention if it links to a story that has at least one subtask assigned to the current user. This logic must operate on the already-filtered (open MRs only) list.

**Warning signs:**
- Attention tab shows MRs that are already merged.
- After filtering to open-only, the MR count drops significantly (expected).
- Subtask-story link logic is slow because it processes hundreds of merged MRs.

**Phase to address:**
Phase that filters MR Attention to open MRs and adds subtask-story linking logic.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep a single `fetchSprintIssues` call and hope subtasks come back | No API change needed | Subtasks silently absent; hierarchy never works | Never — confirmed not to work on DC |
| Filter subtasks by `issuetype.name === 'Sub-task'` | Simple string check | Breaks on renamed subtask types (common on DC installs) | Never |
| Parse time string (`"2h 30m"`) instead of using `*Seconds` fields | Avoids seconds conversion | Locale-sensitive, breaks on non-English Jira instances (`"2h 30min"`) | Never |
| Read Dashboard enrichment from `queryClient.getQueryData` without fallback | No extra API call | Shows blank on first load before tab is visited | Acceptable if blank state is handled gracefully |
| Single `onSettled` invalidation of only `my-tasks` key | Less invalidation logic | Sprint board and workload show stale data after transitions | Never — must invalidate both keys |
| Sort fix versions client-side on every render | No server-side sort | Re-sort on every poll cycle (cheap for <50 versions) | Acceptable — use `useMemo` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira DC REST v2 — subtasks in sprint | Using `sprint in openSprints()` expecting subtasks to appear | Two-query approach: sprint JQL for parents, then `parent in (keys)` for subtasks |
| Jira DC REST v2 — time tracking | Assuming `timetracking` is returned by default | Must add `timetracking` to `?fields=` AND admin must have time tracking enabled |
| Jira DC REST v2 — parent field | Assuming `parent` is returned in JQL search results | Must add `parent` to `?fields=`; will be absent on non-subtask issues (handle with `?.`) |
| Jira DC REST v2 — issuetype detection | Matching on `issuetype.name === 'Sub-task'` | Use `issuetype.subtask === true` boolean field |
| Jira DC REST v2 — story points field ID | Hardcoding `customfield_10016` | Use `GET /rest/api/2/field` to discover the field with name "Story Points" dynamically; `customfield_10016` is the most common default but is not guaranteed |
| Jira DC REST v2 — version ordering | Relying on API response order | Client-side sort by `releaseDate` descending; use `released` boolean for status badge |
| TanStack Query — shared cache | Adding a new field to `fetchSprintIssues` without changing the query key | Old cached responses (without new fields) will be served until TTL expires; either change the query key or use a stale check |
| TanStack Query — mutation invalidation | Invalidating only the mutated query key | After hierarchy is added, transitions must invalidate both `my-tasks` and `sprint-board` keys |
| GitLab API — MR state | Not filtering by `state=opened` | Add `state=opened` to API calls; never filter on client only |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 subtask fetches (one API call per parent to get its subtasks) | API call count = number of sprint stories; 30 stories = 30 extra API calls | Batch all parent keys into a single JQL `parent in (KEY-1, KEY-2, ...)` call | At ~10 sprint stories with subtasks |
| Per-issue health queries for all MRs including closed | Hundreds of `mr-health` queries when closed MRs are in the cache | Filter to `state=opened` before building health query list | At ~50 total MRs in GitLab |
| Re-sorting fix versions on every render (outside useMemo) | Visible jank when other state updates | Wrap sort in `useMemo` | At ~20 fix versions |
| Reading from `queryClient.getQueryData` inside a non-memoized render | Excessive re-computations on every render | Wrap in `useMemo` with cache data as dependency | Immediate — causes UI lag |

---

## Security Mistakes

No new security-specific concerns introduced by v1.1 features. Time tracking, parent, and subtask fields are read-only fetches using the existing PAT. The existing token security patterns (Tauri Stronghold, no plaintext storage) remain correct.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging issue summaries or time tracking values to console in production | Leaks work content to system logs | Remove all `console.log(issue)` calls before shipping; log only error status codes |
| Constructing JQL from unsanitized parent key list | JQL injection if parent keys contain special chars | Jira issue keys are strictly alphanumeric with dash (`[A-Z]+-\d+`); validate before interpolating |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing time tracking section when time tracking is disabled in Jira admin | Confusing empty / zero values for everyone | Hide the time tracking section entirely when all `timetracking` fields are null across all sprint issues |
| Collapsing all subtask groups by default on Sprint Board | Hides work in progress; board looks emptier than it is | Default to expanded; save collapse state per story key in local state (not persisted) |
| Displaying subtask keys without parent context in My Tasks | User can't tell which story a subtask belongs to | Always show parent summary as subdued secondary text beneath each subtask row |
| Sorting workload rows by task count but not clearly indicating points are story-level only | PM doesn't know why points don't match their mental model | Add a tooltip or legend: "Points counted at story level only; subtask effort shown as time tracking" |
| Showing "0 pts" for developers who only have subtasks (no story-level points) | Workload appears empty for dev-heavy members | Show time tracking hours as the primary metric for those with subtasks only; fall back gracefully |

---

## "Looks Done But Isn't" Checklist

- [ ] **Subtask hierarchy:** Subtasks appear under parents in both My Tasks and Sprint Board — verify with a sprint that has stories WITH subtasks, not just top-level tasks.
- [ ] **Double-counting fix:** Open WorkloadTab and confirm total points do not increase after the subtask query is added (they should stay the same or decrease if some subtasks had points previously counted).
- [ ] **Time tracking display:** Open WorkloadTab on the Orange Jira instance and verify `timetracking` fields actually appear (admin may have time tracking disabled — show empty state instead of zeros).
- [ ] **Time tracking fallback:** With time tracking disabled, confirm WorkloadTab and SprintProgressTab do not crash or show broken UI — verify the section is simply hidden.
- [ ] **MR Attention open-only:** Navigate to a merged MR in GitLab, confirm it does not appear in the Attention tab.
- [ ] **Fix versions ordering:** Verify the newest version appears first; verify released/unreleased badge is shown for each.
- [ ] **Dashboard subtask count:** Visit Dashboard without visiting My Tasks first — confirm the subtask count card shows correctly (or a loading state, not a stale zero).
- [ ] **Mutation cache invalidation:** In My Tasks, transition a subtask to Done — then open WorkloadTab and verify that subtask's assignee's count decreased.
- [ ] **Issuetype detection:** If Orange's Jira instance uses a renamed subtask type, confirm it is still detected by `issuetype.subtask === true` not by name.
- [ ] **`fields` parameter coverage:** Confirm the network request URL for `fetchSprintIssues` includes `parent,timetracking` in the `fields` param — inspect in Tauri dev tools or add a temporary log.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Subtasks not returned from sprint JQL | LOW | Add second JQL query for subtasks by parent key in the same `queryFn` |
| Double-counting already shipped | LOW | Add `if (issue.fields.issuetype.subtask) continue;` to points loop in WorkloadTab |
| `timetracking` field absent from responses | LOW | Add `timetracking` to `fields` param in `fetchSprintIssues` |
| `parent` field absent from subtask responses | LOW | Add `parent` to `fields` param; update `JiraIssue` type |
| Issuetype detection by name breaks on DC instance | MEDIUM | Replace name check with `issuetype.subtask` boolean; requires retest with real data |
| Old cache served without new fields after deploy | LOW | Change the query key version segment (e.g., add `v2` suffix) to bust stale caches |
| Mutation invalidates wrong key | LOW | Add sprint-board invalidation to `onSettled` handlers |
| Closed MRs appearing in Attention list | LOW | Add `state=opened` to GitLab fetch functions |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Subtasks absent from sprint JQL (Pitfall 1) | Phase: Extend `JiraIssue` + `fetchSprintIssues` | Confirm subtask issues are present in query data before any UI work |
| Story points double-counting (Pitfall 2) | Phase: Fix WorkloadTab points aggregation | Total sprint points in Workload = same as before adding subtasks |
| Time tracking not returned (Pitfall 3) | Phase: Extend `JiraIssue` + `fetchSprintIssues` | `issue.fields.timetracking` is non-null for at least one issue on Orange instance |
| `parent` field absent (Pitfall 4) | Phase: Extend `JiraIssue` + `fetchSprintIssues` | Subtask issues have `parent.key` populated in query data |
| Issuetype detection by name (Pitfall 5) | Phase: Extend `JiraIssue` type | `issuetype.subtask` boolean present on all issue objects |
| Optimistic update cache invalidation scope (Pitfall 6) | Phase: Subtask hierarchy in My Tasks | After a transition in My Tasks, Sprint Board reflects new status without manual refresh |
| Dashboard reading stale cache (Pitfall 7) | Phase: Dashboard enrichment | Dashboard subtask card shows correct count on cold load (no tab visit first) |
| Fix versions ordering (Pitfall 8) | Phase: Releases fixes | Newest version at top; released/unreleased badge visible |
| Closed MRs in Attention list (Pitfall 9) | Phase: MR Attention filtering | No merged or closed MRs appear in the Attention tab |

---

## Sources

| Finding | Confidence | Source |
|---------|------------|--------|
| Subtasks do not store sprint field, omitted from `openSprints()` JQL | HIGH | Atlassian Support KB: "How to find out sprint value for sub-tasks in Jira"; Atlassian community confirmations; JSWCLOUD-18461 |
| `subtask` boolean field on `issuetype` for reliable detection | HIGH | Atlassian Developer Community: "How to detect subtask issue type" (community.developer.atlassian.com) |
| `timetracking` field conditional on admin enable, must be explicitly requested | HIGH | Atlassian community: "Why does timetracking not get returned in my api call"; Atlassian DC admin docs for Configuring time tracking |
| `parent` field absent from JQL search results by default | HIGH | Atlassian Developer Community: "Missing schema if parent field is not set"; "Issue REST API, parent fields" community thread |
| `subtasks` field in parent issue response returns minimal objects only | HIGH | Atlassian community: "Can you use the JIRA REST API to show more subtask fields?" — confirmed design constraint |
| Story points double-counting when both parent and subtask have values | HIGH | Atlassian community: "Advanced Roadmaps — Avoid double counting story points in issues AND subtasks"; confirmed industry-standard pattern |
| Fix version API returns ascending/sequence order, no server-side date sort | MEDIUM | Atlassian community: "How to efficiently retrieve released fix versions"; DC admin docs on Managing versions |
| Time tracking returns string estimates AND `*Seconds` integer variants | HIGH | Atlassian REST API v2 examples (developer.atlassian.com/server/jira/platform/jira-rest-api-examples) |
| `customfield_10016` not guaranteed as story points field ID | HIGH | Atlassian community: "Need for a dedicated key for Story points in JIRA Rest api"; Confluence KB on Get custom field IDs |
| TanStack Query shared query key cache invalidation scope | HIGH | TanStack Query docs: Query Invalidation; tkdodo.eu: Concurrent Optimistic Updates in React Query |

- Atlassian Server Jira REST API Examples: https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
- Atlassian DC Configuring time tracking: https://confluence.atlassian.com/adminjiraserver/configuring-time-tracking-938847808.html
- Atlassian Support: Sprint value for sub-tasks: https://support.atlassian.com/jira/kb/how-to-find-out-sprint-value-for-sub-tasks-in-jira/
- TanStack Query Invalidation: https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation
- tkdodo: Concurrent Optimistic Updates: https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query

---
*Pitfalls research for: Jira Data Center on-premise REST API — v1.1 subtask hierarchy, time tracking, workload accuracy, dashboard enrichment*
*Researched: 2026-03-12*
