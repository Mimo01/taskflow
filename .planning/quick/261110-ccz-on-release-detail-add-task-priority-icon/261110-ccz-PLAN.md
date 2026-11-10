---
phase: quick-261110-ccz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.fixVersionIssues.test.ts
  - taskflow/src/services/jira-rm.test.ts
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
  - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
  - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.test.tsx
autonomous: true
requirements: [QUICK-261110-ccz]

must_haves:
  truths:
    - "Each task row in the release detail task table shows the Jira priority icon right after the issue key, the same way Backlog, My Tasks and Epics do"
    - "Each row in the Deployment package mismatches table shows the priority icon right after the issue key"
    - "A task with no priority shows nothing in the priority slot, and the columns stay aligned"
    - "The column header strips keep one header cell per row cell, so headings still line up"
    - "Rows stay one line at every density, and clicking a task row still opens the peek"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "'priority' added to the fields requested by fetchFixVersionIssues and fetchStoriesWithPackage"
      contains: "'priority'"
    - path: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx"
      provides: "Priority cell in TaskRow plus a matching header spacer in ColumnHeaderStrip"
      contains: "PriorityIcon"
    - path: "taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx"
      provides: "Priority cell in package rows plus a matching header spacer"
      contains: "PriorityIcon"
  key_links:
    - from: "taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx"
      to: "taskflow/src/components/ui/priority-icon.tsx"
      via: "import { PriorityIcon } from '@/components/ui/priority-icon'"
      pattern: "PriorityIcon"
    - from: "taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts"
      to: "fetchFixVersionIssues fields list"
      via: "issue.fields.priority populated from the Jira search"
      pattern: "'priority'"
---

<objective>
Show the Jira priority icon in the release detail page's task tables, placed and sized the same way as the app's other task tables.

Purpose: the release detail tables are the only issue tables in the app that leave priority out. Backlog (`BacklogRow.tsx`), My Tasks (`MyTaskRow.tsx`), Epics (`EpicsPage.tsx`) and Story headers all render the shared `PriorityIcon` right after the issue key.
Output: the priority field is fetched for release issues and package-mismatch stories, there is a priority cell in both task tables with matching header spacers, and tests cover it.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/components/ui/priority-icon.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx (priority cell, lines ~124-137: the reference pattern)
@taskflow/src/routes/my-tasks/MyTaskRow.tsx (priority after key, lines ~309-321)

Repo layout: .planning/ and git are at the outer /Users/mimo/Documents/Projects/taskflow. The app source, npm, vitest and biome are in the inner taskflow/taskflow/ directory, so run every npm/npx command from /Users/mimo/Documents/Projects/taskflow/taskflow.

## The reference pattern (copy it, do not restyle)
`PriorityIcon({ priority, className = 'w-3.5 h-3.5 shrink-0' })` renders `<img alt="Priority: {name}" title={name}>` and returns null when `iconUrl` is missing. Backlog, Epics and My Tasks all wrap it in a fixed-size centring span placed immediately AFTER the key:
- `<span className="flex items-center justify-center" style={{ width: 18, height: 18 }} aria-hidden={!issue.fields.priority}>`
- Inside: `<PriorityIcon priority={issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined} />` with the default className. The cast is needed because `JiraIssue.fields` reaches `priority` through its `[key: string]: unknown` index signature. Do NOT add a typed `priority` field to the shared `JiraIssue` interface; other consumers already cast.

## Release detail tables in scope
1. `UnifiedTaskTable.tsx` → `TaskRow` (line ~1606). Its cells run: overlay button, `COL_ICON` type icon, `COL_KEY` key button, `COL_SUMMARY`, … . Header `ColumnHeaderStrip` (line ~693) has `COL_ICON` spacer, Key, Summary, … . Data comes from `fetchFixVersionIssues` (services/jira.ts ~1406). Its only consumer is useReleaseDetail, query key `['jira-fixversion-issues', versionId, storyPointsFieldKey]`, so adding a field changes nothing for any other view.
2. `DeploymentPackageSection.tsx` package rows (line ~376). Cells: `IssueTypeIcon` (COL_ICON), key button (COL_KEY), state, assignee, reporter, summary, fix, action. Header at line ~353. The rows come from the `stories` prop (= fixVersion issues above) plus `fetchStoriesWithPackage` orphans (services/jira.ts ~2860, fields string `'summary,issuetype,project,status,fixVersions,customfield_15725,assignee,reporter'`). Its only consumer is this section.

Out of scope, with reasons:
- "Not covered by tasks above" secondary rows. These are MR rows: they carry only a lead task type from `fetchIssuesByKeys`, which is a shared fetcher used by other consumers, and they are not issue rows.
- The NotCoveredFixActions "Link task" picker. It is a command popover, not a table.
- A priority sort or filter. Not requested.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Request the priority field for release issues and package-mismatch stories</name>
  <files>taskflow/src/services/jira.ts, taskflow/src/services/jira.fixVersionIssues.test.ts, taskflow/src/services/jira-rm.test.ts</files>
  <behavior>
    - fetchFixVersionIssues's request URL `fields` param contains 'priority', and all the previous fields are still present (extend the existing list in the 'requests previous fields plus created, resolutiondate and reporter' test, or add a sibling assertion).
    - fetchFixVersionIssues's JQL and ordering stay byte-identical (the existing test must keep passing unchanged).
    - fetchStoriesWithPackage's `fields` param contains 'priority' (extend the existing 'fetchStoriesWithPackage: queries stories carrying the given tasks…' test, which already asserts it contains 'assignee,reporter').
  </behavior>
  <action>Change only legacy `services/jira.ts`, which is the file the app imports, not the `services/jira/` modules. In `fetchFixVersionIssues`, append `'priority'` to the `fields` array after `'reporter'`, with a one-line comment in the existing style: "Release detail task tables show the priority icon: additive." In `fetchStoriesWithPackage`, append `,priority` to the end of the `fields` string. Do not change either JQL, the pagination, the maxResults or any query key. Both fetchers have exactly one consumer each, so there is no shared-cache-key ripple. Update the two tests as described in behavior. Make the test change and the implementation change in ONE commit, because the pre-commit hook runs the full vitest suite.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira.fixVersionIssues.test.ts src/services/jira-rm.test.ts</automated>
  </verify>
  <done>Both fetchers request 'priority'; the JQL is unchanged; both test files pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Priority cell in the release task table (UnifiedTaskTable)</name>
  <files>taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</files>
  <behavior>
    - The makeIssue fixture gains an optional `priority?: { name: string; iconUrl: string } | null` override, written to `fields.priority`.
    - A task row whose issue has priority `{ name: 'High', iconUrl: 'https://jira.example.test/high.svg' }` renders `getByRole('img', { name: 'Priority: High' })` inside `task-row`, and that img comes AFTER the key button in document order and BEFORE the summary text.
    - A task row with no priority renders no 'Priority' img, but the priority slot span is still present, so cell counts stay stable.
    - The existing 'has one header cell per task-row cell, ending at Assignee' test still passes. This proves the header spacer was added.
    - The existing 'orders task columns Key / Summary / MRs / BR / MS / Status / Assignee' test still passes. The spacer has no text, so the label order is unaffected.
  </behavior>
  <action>Import `PriorityIcon` from '@/components/ui/priority-icon'. Add a column constant `COL_PRIORITY = 'flex-none w-[1.125rem]'` next to `COL_ICON` (line ~134). It has the same width as the type-icon column but no `@max-[640px]:hidden`: Backlog and My Tasks never drop priority, and the cell is only 18px. In `TaskRow`, insert a priority cell right after the key `<button>` and before the summary span. It is a `<span>` with className `pointer-events-none relative ${COL_PRIORITY} flex items-center justify-center`, inline `style={{ width: 18, height: 18 }}` and `aria-hidden={!issue.fields.priority}`, wrapping `<PriorityIcon priority={issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined} />` with the default className. The explicit px size follows the Backlog pattern and guards against the zero-width narrow-cell collapse.

Keep `pointer-events-none`. It matches the sibling type-icon cell and the overlay-button convention: the absolute inset-0 overlay must get clicks across the whole row. The img's alt still gives it an accessible name. The trade-off is that the native title tooltip does not fire on hover here. Record that in the SUMMARY.

In `ColumnHeaderStrip`, insert `<span className={COL_PRIORITY} aria-hidden="true" />` between the Key `SortableHeader` and the Summary `SortableHeader`, so header and row cells keep a 1:1 match. Do not add a second line, a badge or new styling. Do not touch the secondary MR rows or `SecondaryHeaderStrip`. Add the tests from behavior in the existing describe block near the header-cell-count test. Make one commit containing both tests and implementation.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</automated>
  </verify>
  <done>Task rows show the priority icon between the key and the summary; the header has a matching spacer; the cell-count, column-order and new priority tests all pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Priority cell in the Deployment package mismatches table</name>
  <files>taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx, taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.test.tsx</files>
  <behavior>
    - The `issue(...)` fixture helper accepts an optional 5th arg `priority`, written to `fields.priority`.
    - A package row for an issue with priority `{ name: 'Blocker', iconUrl: 'https://jira.example.test/blocker.svg' }` renders `getByRole('img', { name: 'Priority: Blocker' })` within `package-row-<key>`, placed after the key button and before the state pill in document order.
    - A row without priority renders no 'Priority' img.
    - The `package-column-header` gets one extra empty spacer, so the header and the row (`CALLOUT_ROW_CLASS` children) have the same number of cells. Assert this with a new test: the header's children count equals the row's cell count.
    - The existing header and Fix-column tests still pass.
  </behavior>
  <action>Import `PriorityIcon` from '@/components/ui/priority-icon'. Add `COL_PRIORITY = 'w-[1.125rem] flex-none'` next to the other COL_ constants (line ~117). It has no narrow hide, for the same reason as Task 2. In the row (line ~376), insert directly after the key `<button>` a `<span className={`${COL_PRIORITY} flex items-center justify-center`} style={{ width: 18, height: 18 }} aria-hidden={!issue.fields.priority}>` wrapping `<PriorityIcon priority={issue.fields.priority as { name?: string; iconUrl?: string } | null | undefined} />`. There is no row overlay here, so do NOT add pointer-events-none; the img's title tooltip works, as it does in Backlog. In the header (line ~354), insert `<span className={COL_PRIORITY} aria-hidden="true" />` right after the Key span. The row stays one line; do not change any other column's width. The row is in an overflow-safe callout list, and the 18px fixed cell takes its space from the flexible Summary/Fix columns. Add the tests from behavior. Make one commit.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/DeploymentPackageSection.test.tsx && npx biome check src/services/jira.ts src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/DeploymentPackageSection.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx src/routes/dashboard/release-detail/DeploymentPackageSection.test.tsx src/services/jira.fixVersionIssues.test.ts src/services/jira-rm.test.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>Package-mismatch rows show the priority icon after the key; header and row cell counts match; the section tests pass; biome reports nothing new in the touched files; tsc is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API → renderer | `priority.iconUrl` and `priority.name` come from the Jira search response |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261110-01 | Tampering | PriorityIcon `<img src={iconUrl}>` in release rows | accept | Same existing component and data source as Backlog, My Tasks and Epics. The URL goes only to an img src (no script context). React escapes the name in alt/title. |
| T-261110-02 | Information disclosure | Extra `priority` field in two release Jira searches | accept | Data the user can already see in Jira and in other app views; no new endpoint or credential handling. |
</threat_model>

<verification>
- `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/services/jira.fixVersionIssues.test.ts src/services/jira-rm.test.ts` passes.
- `grep -n "PriorityIcon" src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/DeploymentPackageSection.tsx` shows the import and one usage in each file.
- No new bespoke priority styling: each usage relies on PriorityIcon's default className inside the 18x18 centring span used by Backlog.
- Biome gate: no NEW files flagged. Do not compare against an absolute diagnostic count.
</verification>

<success_criteria>
- The release detail task table and the Deployment package mismatches table show each issue's Jira priority icon right after the key, matching the Backlog, My Tasks and Epics placement.
- Issues without a priority leave an empty, aligned slot.
- Header strips keep 1:1 cell alignment; rows stay single-line; the row-click peek still works.
- Each task is one commit (tests and implementation together), and every commit passes the pre-commit full suite.
</success_criteria>

<output>
Create `.planning/quick/261110-ccz-on-release-detail-add-task-priority-icon/261110-ccz-SUMMARY.md` when done. Note the pointer-events-none tooltip trade-off on primary task rows.
</output>
