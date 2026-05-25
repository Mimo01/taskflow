---
phase: quick-260525-ltf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/main.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/mrMatching.ts
  - taskflow/src/routes/standup-notes/TodayColumn.tsx
  - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
  - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
  - taskflow/src/routes/standup-notes/TodayMrsSection.tsx
  - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Clicking any task or subtask row in the Standup Today column navigates to that issue's detail page (already true — must remain true)"
    - "Clicking any issue activity group in the Yesterday column navigates to the issue detail page (already true — must remain true)"
    - "Clicking a merge request row anywhere on the Standup page navigates to that MR's internal detail page at /mr/:projectId/:iid"
    - "Merge request rows look clickable (hover affordance + cursor) and are keyboard-operable"
  artifacts:
    - path: "taskflow/src/main.tsx"
      provides: "onMRClick added to the Outlet context so standup pages can navigate to MR detail"
      contains: "onMRClick"
    - path: "taskflow/src/routes/standup-notes/mrMatching.ts"
      provides: "NestedMr carries projectId so nested MR rows can navigate"
      contains: "projectId"
  key_links:
    - from: "taskflow/src/routes/standup-notes/TodayInProgressSection.tsx"
      to: "onMRClick"
      via: "row onClick handler"
      pattern: "onMRClick"
    - from: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      to: "StandaloneMrGroup onMRClick"
      via: "prop threading"
      pattern: "onMRClick"
---

<objective>
On the Standup Notes page, make every merge request row clickable so it navigates to the
app's internal MR detail page (`/mr/:projectId/:iid`), matching the existing behavior of
task/issue rows. Tasks and subtasks are already clickable today — this plan preserves that
and closes the remaining gap: MR rows across all standup sections (Today: nested-under-story
MRs, "MRs Awaiting You", "Participating"; Yesterday: standalone MR groups) are currently
non-interactive display-only divs.

Purpose: A developer reading their standup recap can jump straight from any referenced MR or
task into its detail page without manually searching for it.

Output: `onMRClick` wired into the Outlet context and threaded through every standup MR row,
with `projectId` carried through the MR matching layer so nested rows have the data they need
to build the `/mr/:projectId/:iid` path.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- MR detail route (taskflow/src/routes/routes.tsx:52) -->
Route: `/mr/:projectId/:iid` → MergeRequestDetailPage

<!-- Existing MR navigation handler (taskflow/src/main.tsx:421) -->
const handleMRClick = (projectIdAndIid: string) => {
  breadcrumbReset();
  navigate(`/mr/${projectIdAndIid}`);
};
<!-- Called elsewhere as handleMRClick(`${mr.project_id}/${mr.iid}`) -->
<!-- handleMRClick is currently passed to <TopBar onMRClick={handleMRClick} /> ONLY.
     It is NOT in the <Outlet context={{ ... }}> object (main.tsx:546-554), so standup
     pages cannot reach it. This plan adds onMRClick to that context object. -->

<!-- How StandupNotesPage reads navigation from the shell (StandupNotesPage.tsx:110) -->
const { onIssueClick } = useOutletContext<{ onIssueClick: (key: string) => void }>();

<!-- MR data shapes — all carry a project id -->
GitLabMR        { iid: number; project_id: number; title: string; ... }   // reviewer MRs (Today: MRs Awaiting You + nested review)
ParticipatedMR  { projectId: number; mrIid: number; title: string; openThreadCount: number; ... } // Today: Participating + nested participating
GitLabUserMREvent { project_id: number; target_iid: number; note?: { noteable_iid?: number }; ... } // Yesterday: standalone MR groups

<!-- NestedMr (mrMatching.ts:25) — CURRENTLY MISSING projectId; must add it -->
export interface NestedMr {
  iid: number;
  title: string;
  kind: 'review' | 'participating';
  openThreadCount?: number;
}

<!-- StandaloneMrGroupData (YesterdayColumn.tsx:64) — CURRENTLY MISSING project id; add it
     and thread it from the GitLabUserMREvent.project_id in buildGroups() -->
</interfaces>

<patterns>
<!-- Clickable row pattern already used for issue rows (TodayInProgressSection.tsx IssueRow):
     a div with role="button" tabIndex={0}, onClick + onKeyDown (Enter/Space),
     className includes hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer.
     Reuse this exact treatment for MR rows so they look and behave identically. -->
<!-- IssueActivityGroup (Yesterday) is already clickable via onClick={() => onIssueClick(group.issueKey)} -->
</patterns>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expose onMRClick through the Outlet context and carry projectId through MR matching</name>
  <files>taskflow/src/main.tsx, taskflow/src/routes/standup-notes/mrMatching.ts</files>
  <action>
    In `taskflow/src/main.tsx`, add `onMRClick: handleMRClick` to the object passed to
    `<Outlet context={{ ... }}>` (the context object around line 546-554, alongside
    `onIssueClick: handleIssueClick`). `handleMRClick` already exists (line 421) and takes a
    `projectIdAndIid` string of the form `"${projectId}/${iid}"`; do not change its signature.
    Do NOT remove the existing `onMRClick={handleMRClick}` prop on `<TopBar>` — both consumers
    use the same handler.

    In `taskflow/src/routes/standup-notes/mrMatching.ts`, add `projectId: number` to the
    `NestedMr` interface. Populate it when constructing each nested MR object:
    - For reviewer MRs use `mr.project_id` (GitLabMR).
    - For participating MRs use `mr.projectId` (ParticipatedMR).
    Both `nested` object literals already set `iid`, `title`, `kind` (and `openThreadCount` for
    participating); add `projectId` to each. No other matching logic changes.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | grep -E "main.tsx|mrMatching.ts" | head; npx vitest run src/routes/standup-notes/mrMatching.test.ts</automated>
  </verify>
  <done>onMRClick is present in the Outlet context object in main.tsx; NestedMr has a projectId field populated from project_id (reviewer) / projectId (participating); mrMatching tests pass; no new type errors in the two edited files.</done>
</task>

<task type="auto">
  <name>Task 2: Make all Today-column MR rows clickable</name>
  <files>taskflow/src/routes/standup-notes/StandupNotesPage.tsx, taskflow/src/routes/standup-notes/TodayColumn.tsx, taskflow/src/routes/standup-notes/TodayInProgressSection.tsx, taskflow/src/routes/standup-notes/TodayUpNextSection.tsx, taskflow/src/routes/standup-notes/TodayMrsSection.tsx, taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx</files>
  <action>
    In `StandupNotesPage.tsx`, read `onMRClick` from `useOutletContext` alongside the existing
    `onIssueClick` (update the generic type to include
    `onMRClick: (projectIdAndIid: string) => void`). Pass `onMRClick` down to `<TodayColumn>`.

    In `TodayColumn.tsx`, accept an `onMRClick` prop and thread it to `TodayInProgressSection`,
    `TodayUpNextSection`, `TodayMrsSection`, and `TodayParticipatingSection`.

    In `TodayInProgressSection.tsx` and `TodayUpNextSection.tsx`: the `NestedMrRow` component
    renders nested MRs. Convert its outer interactive element to the clickable-row pattern used
    by `IssueRow` (role="button", tabIndex={0}, onClick, onKeyDown for Enter/Space, and the
    classes `hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer`).
    On activation call `onMRClick(`${mr.projectId}/${mr.iid}`)`. Thread `onMRClick` from the
    section component props into each `NestedMrRow`.

    In `TodayMrsSection.tsx`: accept an `onMRClick` prop; make each reviewer-MR row clickable
    with the same pattern, calling `onMRClick(`${mr.project_id}/${mr.iid}`)` (these items are
    `GitLabMR`). Keep the existing review-state label and icon.

    In `TodayParticipatingSection.tsx`: accept an `onMRClick` prop; make each participating-MR
    row clickable, calling `onMRClick(`${mr.projectId}/${mr.mrIid}`)` (these items are
    `ParticipatedMR`). Keep the existing open-threads label and icon.

    Do not place fenced code in production files via this action — write the JSX directly in
    the components following the existing IssueRow treatment.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | grep -E "standup-notes" | head; npx vitest run src/routes/standup-notes/TodayMrsSection.test.tsx src/routes/standup-notes/TodayParticipatingSection.test.tsx src/routes/standup-notes/TodayColumn.test.tsx</automated>
  </verify>
  <done>Every Today-column MR row (nested-under-story review + participating, "MRs Awaiting You", "Participating") is a keyboard-operable clickable row with hover/cursor affordance that calls onMRClick with the correct `${projectId}/${iid}` string; existing Today tests pass (update test props/expectations only if a test renders a section directly and now needs the onMRClick prop — keep assertions meaningful).</done>
</task>

<task type="auto">
  <name>Task 3: Make Yesterday-column standalone MR groups clickable</name>
  <files>taskflow/src/routes/standup-notes/YesterdayColumn.tsx, taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx</files>
  <action>
    In `YesterdayColumn.tsx`: add `projectId: number` to the internal `StandaloneMrGroupData`
    interface. In `buildGroups`, when creating/updating a standalone MR group from a
    `GitLabUserMREvent`, set `projectId` from `event.project_id` (set it on first creation in
    the `standaloneMrMap.set(...)` branch). The map is keyed by `mrIid` (note.noteable_iid ??
    target_iid) — projectId is a stable per-MR property, so capturing it at creation is
    sufficient. `generateMarkdown` does not need projectId (leave markdown output unchanged).

    `YesterdayColumn` already receives `onIssueClick` from props. The `onMRClick` handler must
    reach it: `YesterdayColumn` is rendered by `StandupNotesPage` (Task 2 reads `onMRClick`
    from context there) — add an `onMRClick: (projectIdAndIid: string) => void` prop to
    `YesterdayColumnProps` and pass it from `StandupNotesPage` (you already destructured
    `onMRClick` there in Task 2; add it to the `<YesterdayColumn ... />` props).

    Thread `onMRClick` into each `<StandaloneMrGroup>` render, passing `projectId`.

    In `StandaloneMrGroup.tsx`: accept `projectId: number` and `onMRClick: (projectIdAndIid:
    string) => void` props. Convert the group header row (the `!{iid} {title}` line) to the
    clickable-row pattern (role="button", tabIndex={0}, onClick, onKeyDown Enter/Space, classes
    `hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer`), calling
    `onMRClick(`${projectId}/${iid}`)`. The collapsed comment/approval sub-items below stay
    non-interactive.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | grep -E "YesterdayColumn|StandaloneMrGroup" | head; npx vitest run src/routes/standup-notes/YesterdayColumn.test.ts src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx</automated>
  </verify>
  <done>StandaloneMrGroupData carries projectId sourced from event.project_id; the Yesterday standalone MR group header is a keyboard-operable clickable row calling onMRClick with `${projectId}/${iid}`; YesterdayColumn threads onMRClick from StandupNotesPage; existing Yesterday tests pass.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` reports no new type errors.
- `cd taskflow && npx vitest run src/routes/standup-notes` — all standup-notes tests pass.
- `cd taskflow && npm run build` succeeds (catches CSS/import issues tsc misses — Phase 59 standing rule).
- Manual sanity (covered by human review, not blocking): on the Standup page, clicking a
  task/subtask still opens issue detail; clicking any MR row (nested, awaiting-review,
  participating, or yesterday standalone) opens `/mr/:projectId/:iid`.
</verification>

<success_criteria>
- All standup MR rows navigate to the internal MR detail page on click and on Enter/Space.
- Task and subtask rows remain clickable to issue detail (no regression).
- MR rows visually match the existing clickable-row affordance (hover background + pointer cursor + focus ring).
- onMRClick is sourced from the Outlet context (single shared handler), not re-implemented per page.
- Type check, standup test suite, and production build all pass.
</success_criteria>

<output>
Create `.planning/quick/260525-ltf-on-standup-notes-page-make-all-tasks-inc/260525-ltf-SUMMARY.md` when done.
</output>
