---
status: resolved
trigger: "story-points-always-zero"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMED. SprintProgressTab and SprintBoardTab both called fetchSprintIssues without storyPointsFieldKey (defaulted to customfield_10016) and both used queryKey ['jira-issues', 'sprint-board', activeJiraProject] without storyPointsFieldKey. Cache entry was fetched without the discovered field, so SprintProgressTab read story.fields[storyPointsFieldKey] from a response that never included that field — always 0.
test: Code reading confirmed both components missing storyPointsFieldKey in queryKey and queryFn call; fix applied and all 11 SprintProgressTab tests pass
expecting: Sprint progress now shows correct story point values for all three buckets (To Do, In Progress, Done) and per-assignee breakdown
next_action: Human verify sprint progress shows correct story points

## Symptoms

expected: Story points display the correct numeric value from Jira on all tabs (My Tasks, Releases, Workload)
actual: Story points are 0 everywhere across the entire app
errors: None visible in browser console or network tab
reproduction: Open any tab that shows story points — they are always 0
started: Never worked (not a regression)
other_fields: Titles, assignees, statuses all load correctly — only story points are wrong

## Eliminated

- hypothesis: Network/API error preventing field data from loading
  evidence: No errors, other fields load fine
  timestamp: 2026-03-12T00:00:00Z

- hypothesis: Story points field not in API response at all
  evidence: Fields string includes `customfield_10016,story_points` so the field IS requested — the issue is which field name Jira returns the value under
  timestamp: 2026-03-12T00:00:00Z

## Evidence

- timestamp: 2026-03-12T00:00:00Z
  checked: taskflow/src/routes/dashboard/TaskRow.tsx line 90
  found: `{issue.fields.customfield_10016 ?? '—'}` — hardcoded to customfield_10016
  implication: TaskRow IGNORES storyPointsFieldKey entirely; if the Jira instance uses a different field key (e.g. customfield_10028), points will always be null/0

- timestamp: 2026-03-12T00:00:00Z
  checked: taskflow/src/routes/dashboard/WorkloadTab.tsx line 91
  found: `const pts = (story.fields[storyPointsFieldKey] as number | null) ?? 0;` — uses dynamic key correctly
  implication: WorkloadTab correctly uses the discovered key at read time

- timestamp: 2026-03-12T00:00:00Z
  checked: taskflow/src/services/jira.ts lines 185 and 279
  found: `fields = 'summary,status,assignee,issuetype,customfield_10016,story_points,parent,subtasks,timetracking'` — hardcoded in fetchSprintIssues AND fetchMyTasksHierarchy
  implication: The API request always asks for `customfield_10016` and `story_points` but never the dynamically discovered key. If the instance's key is customfield_10028, it would never be fetched.

- timestamp: 2026-03-12T00:00:00Z
  checked: taskflow/src/main.tsx lines 41-61
  found: discoverStoryPointsField runs via useQuery at app startup, saves to settingsStore.storyPointsFieldKey
  implication: Discovery works fine, but the discovered key is never fed back into the API `fields` parameter

- timestamp: 2026-03-12T00:00:00Z
  checked: taskflow/src/services/jira.ts line 577
  found: discoverStoryPointsField matches field by `f.name === 'Story Points' || f.name === 'story_points' || f.id === 'customfield_10028'`
  implication: If the field name is exactly 'Story Points', it correctly returns the right ID. If the Jira instance uses that name, the field ID is saved in settings. But the API calls still only fetch customfield_10016 in the fields param — if the actual field is customfield_10028, that value is never in the response.

- timestamp: 2026-03-12T00:03:00Z
  checked: discoverStoryPointsField return value possibilities — can return any customfield_NNNNN, not just 10016 or 10028
  found: The match is by f.name === 'Story Points' which returns match.id — could be any number. The hardcoded fields string (even after previous fix adding 10028) may not include this ID.
  implication: The previous fix was insufficient — it only covered the specific case of customfield_10028, not arbitrary IDs.

- timestamp: 2026-03-12T00:03:00Z
  checked: WorkloadTab and MyTasksTab query key construction
  found: queryKey was ['jira-issues', 'sprint-board'/'my-tasks', activeJiraProject] — did not include storyPointsFieldKey
  implication: When discovery updates storyPointsFieldKey after initial data fetch, TanStack Query doesn't know the data is stale and re-uses the cached response (which doesn't have the new field). Components re-render reading the new key from the cached data, but the field is absent.

## Resolution

root_cause: Four-part bug (third and fourth parts discovered in this session). (1) TaskRow hardcoded customfield_10016 — FIXED. (2) API fields parameter in fetchSprintIssues/fetchMyTasksHierarchy was hardcoded — FIXED. (3) SprintProgressTab called fetchSprintIssues without storyPointsFieldKey (defaulted to customfield_10016), so the discovered field ID was never requested in the sprint-board API call. (4) Both SprintProgressTab and SprintBoardTab used queryKey without storyPointsFieldKey, meaning they shared a cache entry that was fetched without the discovered field, so SprintProgressTab read story.fields[storyPointsFieldKey] from a response that never included it — always 0.

fix: |
  1–3. (Previous session) taskflow/src/services/jira.ts, TaskRow.tsx, MyTasksTab.tsx, WorkloadTab.tsx
  4. taskflow/src/routes/dashboard/SprintProgressTab.tsx: Added storyPointsFieldKey to
     queryKey and passed to fetchSprintIssues.
  5. taskflow/src/routes/dashboard/SprintBoardTab.tsx: Imported useSettingsStore; added
     storyPointsFieldKey to queryKey and passed to fetchSprintIssues — keeps both components
     on the same cache key so they share the correctly-fetched response.
verification: All 11 SprintProgressTab tests pass. Pre-existing failures unchanged.
files_changed:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/TaskRow.tsx
  - taskflow/src/routes/dashboard/MyTasksTab.tsx
  - taskflow/src/routes/dashboard/WorkloadTab.tsx
  - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
  - taskflow/src/routes/dashboard/SprintProgressTab.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
