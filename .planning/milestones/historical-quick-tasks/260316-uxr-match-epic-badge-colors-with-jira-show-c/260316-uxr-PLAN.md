---
phase: quick
plan: 260316-uxr
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/EpicsPage.tsx
  - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Epic badges in backlog show the same color the epic has in Jira"
    - "Epic detail page shows the epic's Jira color"
    - "Sprint board cards show epic key in a colored badge"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "Epic color field discovery and fetching"
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Epic badge using real Jira color"
  key_links:
    - from: "taskflow/src/services/jira.ts"
      to: "BacklogRow.tsx, EpicsPage.tsx, IssueDetailSidebar.tsx"
      via: "epicColors map passed through data layer"
      pattern: "epicColors"
---

<objective>
Match epic badge colors with actual Jira epic colors instead of random hash-based assignment. Show epic color on epic detail view. Add epic key+color badges to sprint board TaskCards.

Purpose: Epic colors in Jira carry meaning (teams, streams, themes). Random colors break that signal. Matching them makes the app feel integrated with Jira rather than disconnected.

Output: Epic badges everywhere use real Jira colors; epic detail shows its color; TaskCards show epic badges.
</objective>

<context>
@taskflow/src/services/jira.ts (fetchBacklogView, fetchEpicsBasic, discoverCustomFields, EpicEnriched)
@taskflow/src/routes/dashboard/BacklogRow.tsx (current hash-based EPIC_COLORS)
@taskflow/src/routes/dashboard/EpicsPage.tsx (epic list — no color shown)
@taskflow/src/routes/dashboard/IssueDetailSidebar.tsx (epic link in sidebar — no color)
@taskflow/src/routes/dashboard/TaskCard.tsx (sprint board card — no epic badge)
@taskflow/src/routes/dashboard/SprintBoardTab.tsx (passes issues to TaskCard)
@taskflow/src/stores/settings.store.ts (custom field key storage pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Discover epic color field and fetch colors from Jira API</name>
  <files>
    taskflow/src/services/jira.ts
    taskflow/src/stores/settings.store.ts
  </files>
  <action>
1. In `discoverCustomFields()`, add detection for the epic color field: look for `com.pyxis.greenhopper.jira:gh-epic-color` in `f.schema?.custom`. Store result as `epicColorFieldKey` (default: `'customfield_10013'`).

2. In `settings.store.ts`, add `epicColorFieldKey: string` field (default `'customfield_10013'`), a setter `setEpicColorFieldKey`, and bump store version to 4 with migration that sets default if undefined.

3. In `EpicEnriched` interface, add optional field: `color?: string | null`.

4. In `fetchEpicsBasic()`: add the epic color field key to the `epicFields` list. In the `.map()`, extract the color value: `color: (epic.fields[epicColorFieldKey] as string | null) ?? null`. The color field key should be accepted as a new parameter with default `'customfield_10013'`.

5. In `fetchBacklogView()`: when batch-fetching epic issues (Step 4, the `epicJql` query around line 1548), also request the epic color field. Return a new `epicColors: Map<string, string>` alongside `epicNames` in the return object — mapping epicKey to the raw Jira color string (e.g. `"ghx-label-5"` or a hex like `"#00875a"`). Update the `BacklogViewResult` type at line ~1401 to include `epicColors`.

6. Create a shared utility function `epicColorToTailwind(jiraColor: string): string` exported from jira.ts (or a new small util file `taskflow/src/lib/epicColors.ts` if preferred). This maps Jira's `ghx-label-N` values and known hex colors to Tailwind classes:
   - `ghx-label-1` / `#815b3a` → `bg-amber-100 text-amber-800 border-amber-300` (brown)
   - `ghx-label-2` / `#f79232` → `bg-orange-100 text-orange-800 border-orange-300` (orange)
   - `ghx-label-3` / `#d39c3f` → `bg-yellow-100 text-yellow-800 border-yellow-300` (yellow)
   - `ghx-label-4` / `#3b7fc4` → `bg-blue-100 text-blue-800 border-blue-300` (blue)
   - `ghx-label-5` / `#4a6785` → `bg-slate-100 text-slate-800 border-slate-300` (slate)
   - `ghx-label-6` / `#8eb021` → `bg-lime-100 text-lime-800 border-lime-300` (green)
   - `ghx-label-7` / `#ac707a` → `bg-pink-100 text-pink-800 border-pink-300` (pink)
   - `ghx-label-8` / `#654982` → `bg-purple-100 text-purple-800 border-purple-300` (purple)
   - `ghx-label-9` / `#0052cc` → `bg-indigo-100 text-indigo-800 border-indigo-300` (indigo)
   - `ghx-label-10` through `ghx-label-14`: map to teal, cyan, emerald, rose, violet respectively.
   - If color is a raw hex not in the known map, generate an inline style fallback: return `{ style: { backgroundColor, color, borderColor } }` using the hex with lightened bg. Use a discriminated return type or always return className + optional style override.
   - Fallback for unknown/null: use the existing hash-based approach from BacklogRow as the default (keep it as fallback so epics without Jira color still get deterministic colors).

Also update the connection validation flow: when `discoverCustomFields` runs during Jira connection setup, persist the `epicColorFieldKey` to the settings store.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - epicColorFieldKey discovered and persisted in settings store
    - EpicEnriched has color field
    - fetchEpicsBasic returns color data
    - fetchBacklogView returns epicColors map
    - epicColorToTailwind mapping function exists and handles all ghx-label-N values + hex fallback
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply real epic colors to all badge locations + add epic badges to TaskCard and epic detail</name>
  <files>
    taskflow/src/routes/dashboard/BacklogRow.tsx
    taskflow/src/routes/dashboard/BacklogPage.tsx
    taskflow/src/routes/dashboard/EpicsPage.tsx
    taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
    taskflow/src/routes/dashboard/IssueDetailContent.tsx
    taskflow/src/routes/dashboard/TaskCard.tsx
    taskflow/src/routes/dashboard/SprintBoardTab.tsx
  </files>
  <action>
**BacklogRow.tsx:**
- Remove the local `EPIC_COLORS` array and `epicColorClass()` hash function.
- Accept new optional prop `epicColors?: Map<string, string>` (Jira color strings by epic key).
- Import `epicColorToTailwind` from the utility created in Task 1.
- When rendering the epic badge, look up `epicColors?.get(epicKey)` and pass to `epicColorToTailwind()`. If no color found, `epicColorToTailwind` already falls back to hash-based coloring.
- Also show the epic KEY inside the badge alongside the name, formatted as: `{epicKey}: {epicName}` (or `{epicKey}` prefix in slightly muted text before the name). Keep it truncatable. This addresses the user's request to "add the epic key into color badge".

**BacklogPage.tsx:**
- Pass `backlogView?.epicColors` to each `BacklogRow` as the `epicColors` prop.

**EpicsPage.tsx:**
- In `EpicRow`, add a colored dot or small color swatch next to the epic name (or as a left border on the row). Use `epicColorToTailwind(epic.color)` if the color is available.
- Pass `epicColorFieldKey` to `fetchEpicsBasic` so the query includes the color field.

**IssueDetailSidebar.tsx:**
- When `isEpic` is true, show a "Color" MetaRow displaying a small colored swatch/pill using the epic's own color field value. The epic's detail data is in `issue.fields` — read `issue.fields[epicColorFieldKey]` (get epicColorFieldKey from settings store). Render a small rounded div with the mapped color as background, plus the Jira label name as text.
- When `isStory` and showing the Epic MetaRow (line ~340), apply the epic's color to the epic link text/badge. The `epicIssue` fetch already returns fields — add the color field to the fetched fields list in the queryFn URL (line ~113), then use `epicColorToTailwind` on the color value.

**IssueDetailContent.tsx:**
- When `isEpic`, show a subtle colored banner/accent at the top of the content area. Use a thin colored bar (4px height) or a colored pill next to the epic name in the header area. Read color from `issue.fields[epicColorFieldKey]`.

**TaskCard.tsx:**
- Add optional props: `epicKey?: string | null`, `epicColor?: string | null`.
- When `epicKey` is provided, render a small colored badge below the summary (before the bottom row). Use `epicColorToTailwind(epicColor)` for styling. Show just the epic key text (e.g. "PROJ-42") in a compact rounded-full pill, similar to the BacklogRow epic badge but smaller to fit the card.

**SprintBoardTab.tsx:**
- When rendering TaskCards, extract `epicKey` from `story.fields[epicLinkFieldKey]` and look up the color. The sprint board already has `epicLinkFieldKey` from settings.
- Need to fetch epic colors for the sprint: either reuse data from a query or add a lightweight epic color lookup. Simplest approach: build an `epicColors` map by collecting unique epic keys from all swimlane stories, then batch-fetching those epics' color fields (similar to how `fetchBacklogView` does it for epic names). Use a separate `useQuery` with key `['jira-epic-colors', projectKey]` that calls `fetchEpicsBasic` (which now returns color). Build a Map from the result.
- Pass `epicKey` and `epicColor` to each TaskCard.

**Suggestion locations for epic key in badge (document in code comments for future reference):**
- BacklogRow: already has epic badge (now with key prefix) -- DONE
- TaskCard (sprint board): adding epic badge -- DONE
- MyTasks tab: if it uses BacklogRow, inherits the change automatically
- MR rows: could show linked epic (via linked task's epic) -- future enhancement
- PinnedTabStrip: could color the tab accent by epic color -- future enhancement
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - BacklogRow epic badges use real Jira colors (not random hash)
    - BacklogRow epic badges show epic key prefix
    - EpicsPage rows show epic color indicator
    - IssueDetailSidebar shows color swatch for epic issues
    - IssueDetailContent shows colored accent for epic detail
    - TaskCard shows epic key badge with real color on sprint board
    - All unknown/missing colors fall back gracefully to hash-based coloring
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Epic color integration across the app:
    1. Backlog epic badges now use real Jira colors (not random)
    2. Epic badges in backlog show the epic key alongside name
    3. EpicsPage shows color indicators per epic row
    4. Epic detail view shows the epic's Jira color
    5. Sprint board TaskCards show epic key in colored badge
  </what-built>
  <how-to-verify>
    1. Open the Backlog view — verify epic badges match Jira's epic colors (compare with Jira board)
    2. Confirm epic badges show the epic key (e.g. "PROJ-42: Epic Name")
    3. Open the Epics page — verify each row has a color indicator matching Jira
    4. Click into an epic — verify the detail view shows the epic color prominently
    5. Open Sprint Board — verify TaskCards show small epic badges with correct colors
    6. Check that epics without a Jira color still show a deterministic fallback color
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` passes with no errors
- Epic colors in backlog match what Jira shows
- Epic detail pages display their color
- Sprint board cards show epic badges
</verification>

<success_criteria>
- Epic badge colors throughout the app match Jira's epic colors
- Epic detail view clearly displays the epic's color
- Sprint board TaskCards display epic key in colored badge
- Fallback coloring works for epics without a Jira color value
</success_criteria>

<output>
After completion, create `.planning/quick/260316-uxr-match-epic-badge-colors-with-jira-show-c/260316-uxr-SUMMARY.md`
</output>
