---
phase: quick-260608-dhp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
autonomous: true
requirements: [dhp-created-issues-yesterday]

must_haves:
  truths:
    - "Issues created yesterday by the logged-in user (or watched user) appear in the Yesterday column"
    - "Created issues with other activity that day are merged into the existing group for that issue key"
    - "Issues only created (no other activity) appear as their own group with a single Created sub-item"
    - "The Created sub-item appears first in the group, before worklogs/transitions/comments"
    - "The Created sub-item renders with a simple 'Created' label matching the compact transition row style"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchYesterdayCreatedIssues() + JiraCreatedIssue interface"
      contains: "fetchYesterdayCreatedIssues"
    - path: "taskflow/src/routes/standup-notes/IssueActivityGroup.tsx"
      provides: "issue-created SubItemKind and icon"
      contains: "issue-created"
    - path: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      provides: "5th data pass in buildGroups, MarkdownSources extension"
      contains: "createdData"
    - path: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      provides: "jiraCreatedQuery wired to YesterdayColumn"
      contains: "jiraCreatedQuery"
  key_links:
    - from: "StandupNotesPage.tsx"
      to: "YesterdayColumn.tsx"
      via: "jiraCreatedQuery prop (or createdData)"
      pattern: "jiraCreatedQuery"
    - from: "YesterdayColumn.tsx buildGroups()"
      to: "IssueActivityGroup SubItem"
      via: "kind: 'issue-created'"
      pattern: "issue-created"
    - from: "jira.ts fetchYesterdayCreatedIssues"
      to: "Jira search API"
      via: "reporter = jiraUsername AND created >= date AND created < nextDay"
      pattern: "fetchYesterdayCreatedIssues"
---

<objective>
Add "Created Issues" as a fifth data source in the standup notes Yesterday column.
Issues created yesterday by the active identity appear as a "Created" sub-item row within their
issue group — merged with other activity if any exists, or as a standalone group if not.

Purpose: Surface creation activity in the standup, so engineers can report on issues they opened
yesterday, not just issues they transitioned or commented on.

Output: New fetch function in jira.ts, new SubItemKind in IssueActivityGroup, new pass-0 in
buildGroups(), new useQuery in StandupNotesPage — all following the exact pattern of the four
existing data sources.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/260608-dhp-on-standup-notes-page-i-want-to-add-new-/260608-dhp-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add JiraCreatedIssue interface and fetchYesterdayCreatedIssues to jira.ts</name>
  <files>taskflow/src/services/jira.ts</files>
  <action>
Add the following directly after the existing `fetchYesterdayJiraActivity` function (locate it
by searching for `export async function fetchYesterdayJiraActivity`):

1. Add an exported interface `JiraCreatedIssue` with fields: `issueKey: string`, `summary: string`,
   `issueType?: string`.

2. Add an exported async function `fetchYesterdayCreatedIssues(baseUrl, token, projectKey, date, jiraUsername)`.

Implementation details:
- Compute `nextDay` using the exact same local-date arithmetic pattern as `fetchYesterdayJiraActivity`
  (split date on `-`, construct `new Date(y, m-1, d+1)`, format with padStart — do NOT use
  `toLocaleDateString()` per the Phase 62 rule already in the file).
- Build JQL: `project = ${projectKey} AND reporter = "${jiraUsername}" AND created >= "${date}" AND created < "${nextDay}" ORDER BY created ASC`
- Fetch `GET ${baseUrl}/rest/api/2/search` with query params `jql=<encoded>`, `maxResults=50`,
  `fields=summary,issuetype` — same endpoint and headers pattern as `fetchYesterdayJiraActivity`.
- Map the response `issues[]` to `JiraCreatedIssue[]`: `issueKey = issue.key`,
  `summary = issue.fields.summary`, `issueType = issue.fields.issuetype?.name`.
- Return the mapped array. No per-issue fan-out needed.

Use `reporter` (not `creator`) for the JQL field — this is the standard Jira DC field.
Use `jiraUsername` (the `name` field, e.g. `mmozolak`) — NOT accountId. Matches
how `fetchYesterdayJiraActivity` uses jiraUsername for `status CHANGED BY`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    jira.ts exports `JiraCreatedIssue` interface and `fetchYesterdayCreatedIssues` function; no
    TypeScript errors in jira.ts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add issue-created SubItemKind, icon, and wire up buildGroups + StandupNotesPage</name>
  <files>
    taskflow/src/routes/standup-notes/IssueActivityGroup.tsx,
    taskflow/src/routes/standup-notes/YesterdayColumn.tsx,
    taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  </files>
  <action>
### IssueActivityGroup.tsx

1. Extend the `SubItemKind` union type to add `'issue-created'` as the last member.
2. In `subItemIcon()` (or equivalent icon dispatch), add a case for `'issue-created'` that returns
   `PlusCircle` from lucide-react. Import `PlusCircle` at the top of the file alongside the other
   lucide imports.
3. No new render branch is needed — `'issue-created'` has no MR link and no clickable issueKey, so
   it falls into the existing plain `<div>` branch that renders: icon + label text. The label will
   be `"Created"`. Confirm the plain branch handles it correctly; do not add a dedicated branch.

### YesterdayColumn.tsx

1. Import `JiraCreatedIssue` from `../../services/jira`.
2. Import `fetchYesterdayCreatedIssues` from `../../services/jira` (if not already imported via
   a barrel — add to whichever import line covers jira.ts).
3. Extend the `MarkdownSources` interface: add `createdData?: JiraCreatedIssue[]`.
4. Extend the `YesterdayColumnProps` interface: add a `jiraCreatedQuery` prop typed as
   `UseQueryResult<JiraCreatedIssue[]>` (mirror how the other four query props are typed).
5. In `buildGroups()`, add `createdData?: JiraCreatedIssue[]` as the 5th parameter (insert before
   `issueMeta` which stays last). Add the new pass as **pass 0 — FIRST**, before all existing passes
   (before the Tempo worklog pass). The pass:
   ```
   for (const created of createdData ?? []) {
     const group = ensureGroup(created.issueKey, created.summary, created.issueType);
     group.subItems.push({ kind: 'issue-created', label: 'Created', originKey: created.issueKey });
   }
   ```
   This guarantees "Created" is the first sub-item in insertion order (per CONTEXT decision).
6. Update both callers of `buildGroups()` inside `YesterdayColumn.tsx` to pass `createdData`:
   - The `useMemo` call: pass `props.jiraCreatedQuery.data` (or destructured `createdData`) as 5th arg.
   - The `generateMarkdown` usage: pass `sources.createdData` as 5th arg.
7. Add a loading/error display block for the new query at the bottom of the column's query-status
   section, following the same pattern as the existing four sources.

### StandupNotesPage.tsx

1. Import `fetchYesterdayCreatedIssues` and `JiraCreatedIssue` from `../../services/jira`
   (add to existing jira imports).
2. Add a new `jiraCreatedQuery` using `useQuery` directly after `jiraActivityQuery`:
   - `queryKey`: `['standup', 'jira-created', jiraBaseUrl, activeJiraProject, yesterdayDate, id.jiraUsername ?? '']`
   - `queryFn`: read token via `readSecret('jira-pat')`, then call `fetchYesterdayCreatedIssues(jiraBaseUrl ?? '', token, activeJiraProject ?? '', yesterdayDate, id.jiraUsername ?? '')`
   - `enabled`: `!!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!id.jiraUsername && !!yesterdayDate`
   - `staleTime: 5 * 60 * 1000`
3. In the `referencedKeys` useMemo: add `for (const c of jiraCreatedQuery.data ?? []) keys.add(c.issueKey);`
   so that created-only issues get their type/parent resolved via `fetchIssueMeta`.
4. Add `jiraCreatedQuery.data` to the `issueMetaQuery` `enabled`/deps array as needed so it
   recalculates when created data arrives.
5. Pass `jiraCreatedQuery` to the `<YesterdayColumn>` JSX (as `jiraCreatedQuery={jiraCreatedQuery}`).
6. In the `generateMarkdown` call (inside `handleCopyMarkdown` or equivalent): add
   `createdData: jiraCreatedQuery.data` to the `MarkdownSources` object passed to `generateMarkdown`.
7. Add `jiraCreatedQuery.dataUpdatedAt` to the `syncedMinutesAgo` timestamps array so the "synced N
   min ago" indicator accounts for the new source.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
    TypeScript compiles clean. The Yesterday column renders a "Created" sub-item (with PlusCircle
    icon) for issues created yesterday, appearing first in the group. Issues created + worked on
    appear in a merged group. Issues only created appear as a standalone group.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| StandupNotesPage → Jira REST API | Outbound authenticated request using stored PAT |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dhp-01 | Information Disclosure | JQL reporter= query | accept | reporter scoped to activeJiraProject; token is user's own PAT; no new attack surface vs existing Jira calls |
| T-dhp-SC | Tampering | npm installs | accept | No new packages introduced; all changes are code additions to existing files |
</threat_model>

<verification>
1. `npx tsc --noEmit` passes with no new errors.
2. In the running app, navigate to the Standup Notes page for a date when you created at least one Jira issue. The Yesterday column should show a "Created" sub-item (PlusCircle icon, label "Created") as the first sub-item of that issue's group.
3. If that issue also had a transition or worklog on the same day, the "Created" sub-item appears first, followed by the other sub-items in the same group.
4. Issues you only created (no other activity) appear as their own group with the single "Created" sub-item.
5. Copy markdown (if the feature is active) includes the created issues.
</verification>

<success_criteria>
- `fetchYesterdayCreatedIssues` exported from jira.ts, typed, uses reporter= JQL with correct nextDay boundary
- `'issue-created'` in SubItemKind union; PlusCircle icon renders for it
- `buildGroups()` pass 0 seeds created issues first; both internal callers updated
- `jiraCreatedQuery` wired in StandupNotesPage; referencedKeys, syncedMinutesAgo, generateMarkdown all updated
- TypeScript: zero new errors
</success_criteria>

<output>
Create `.planning/quick/260608-dhp-on-standup-notes-page-i-want-to-add-new-/260608-dhp-SUMMARY.md` when done.
</output>
