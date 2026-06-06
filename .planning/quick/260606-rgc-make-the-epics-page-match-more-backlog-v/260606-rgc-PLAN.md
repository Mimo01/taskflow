---
phase: quick-260606-rgc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/EpicsPage.tsx
autonomous: true
requirements: [REQ-1, REQ-2, REQ-3]

must_haves:
  truths:
    - "The epics table renders no column-header row (no <thead>), matching the backlog table"
    - "Key, Status, and Assignee columns keep their current widths after the header is removed (no reflow)"
    - "Every epic row shows a CachedAvatar; unassigned epics show the distinct dashed-border Unassigned treatment instead of a blank cell"
    - "The status pill is visually identical to the canonical static pill used in StoryHeaderRow (same statusPillClass helper, no extra geometry classes)"
  artifacts:
    - path: "taskflow/src/routes/dashboard/EpicsPage.tsx"
      provides: "EpicsPage with headerless table, colgroup width preservation, and BacklogRow-parity assignee cell"
      contains: "<colgroup>"
  key_links:
    - from: "EpicRow assignee cell"
      to: "CachedAvatar"
      via: "always-render with Unassigned fallback"
      pattern: "name=\\{epic.assignee\\?\\.displayName \\|\\| 'Unassigned'\\}"
    - from: "EpicRow status cell"
      to: "@/lib/statusStyles"
      via: "statusPillClass helper"
      pattern: "statusPillClass\\(epic.status.statusCategory\\?\\.key\\)"
---

<objective>
Make the epics page (`EpicsPage.tsx`) match the backlog view more closely via three targeted changes:
1. Remove the table `<thead>` (REQ-1) — backlog renders no column-header row.
2. Make the assignee cell render exactly like `BacklogRow` (REQ-2) — always `CachedAvatar` with an `'Unassigned'` fallback so unassigned epics get the distinct dashed-avatar treatment.
3. Confirm the status pill is already visually identical to the canonical static pill (REQ-3) — verify-only, no edit unless drift is found.

Purpose: Visual parity between the /epics route and the backlog, so epics list rows read like backlog rows (no header, consistent assignee avatar, canonical status pill).

Output: Updated `EpicsPage.tsx` — `<thead>` deleted, `<colgroup>` added to preserve column widths, assignee cell replaced with the always-render CachedAvatar snippet. `npm run check` stays green.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260606-rgc-make-the-epics-page-match-more-backlog-v/260606-rgc-CONTEXT.md
@.planning/quick/260606-rgc-make-the-epics-page-match-more-backlog-v/260606-rgc-RESEARCH.md
@taskflow/src/routes/dashboard/EpicsPage.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove thead and preserve column widths with a colgroup</name>
  <files>taskflow/src/routes/dashboard/EpicsPage.tsx</files>
  <action>
Delete the entire `<thead className="border-b bg-muted/10">…</thead>` block (currently lines 186–202), keeping `<tbody>` and its `.map()` of `EpicRow` intact (REQ-1).

CRITICAL — preserve column sizing (per RESEARCH Finding 1 / Pitfall 1): the deleted `<th>`s carried the ONLY explicit width caps (`w-1` color bar, `w-28` Key, `w-32` Status, `w-12` Assignee). Under CSS table-auto layout these vanish with the header and the columns will reflow. Immediately after the opening `<table className="w-full text-sm">` tag and before `<tbody>`, add a `<colgroup>` with five `<col>` elements in column order: color bar `<col className="w-1" />`, Name `<col />` (flexes, no width), Key `<col className="w-28" />`, Status `<col className="w-32" />`, Assignee `<col className="w-12" />`. This is the preferred approach over per-`<td>` width classes per the research recommendation and Claude's-discretion allowance to keep the table/`<tbody>` structure.

Do NOT touch the EpicRow `<td>` cells in this task other than leaving them as-is. Do NOT add issue-type/priority/points cells. Do NOT change the color bar, epic-name badge, or key cells.
  </action>
  <verify>
    <automated>cd taskflow && grep -c '&lt;thead' src/routes/dashboard/EpicsPage.tsx | grep -qx 0 &amp;&amp; grep -q '&lt;colgroup&gt;' src/routes/dashboard/EpicsPage.tsx &amp;&amp; echo OK</automated>
  </verify>
  <done>No `<thead>` remains in EpicsPage.tsx; a `<colgroup>` with five `<col>` elements (widths w-1, none, w-28, w-32, w-12 in order) sits between `<table>` and `<tbody>`; `<tbody>` and EpicRow map unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Assignee parity (always-render CachedAvatar) and confirm status pill</name>
  <files>taskflow/src/routes/dashboard/EpicsPage.tsx</files>
  <action>
REQ-2 (real edit): In `EpicRow`, replace the conditional assignee cell content (currently lines 69–78, `{epic.assignee ? <CachedAvatar .../> : null}`) with an always-rendered avatar matching BacklogRow's semantics exactly. Keep the existing `<td className="px-3 py-3">` wrapper (per CONTEXT "keep epic-specific cells / targeted changes only"); change only the inner content to:
`<CachedAvatar url={epic.assignee?.avatarUrls?.['48x48'] || null} name={epic.assignee?.displayName || 'Unassigned'} size={24} />`.
Keep the optional chain on `avatarUrls?.['48x48']` (epic's safer access; identical output to BacklogRow's non-optional form). The `|| 'Unassigned'` name fallback is mandatory — it triggers CachedAvatar's dashed-border User-icon treatment for unassigned epics (RESEARCH Finding 2 / Pitfall 2). The `CachedAvatar` import already exists (line 13) — no import change.

REQ-3 (verify-only, NO code change unless drift found): Confirm the status cell (lines 65–67) is already `<span className={statusPillClass(epic.status.statusCategory?.key)}>{epic.status.name}</span>` with NO extra geometry classes (no rounded*/px-*/py-*/text-xs/font-*/inline-flex/min-w-*/text-center) — these are baked into statusPillClass per the statusStyles contract. RESEARCH Finding 3 confirms this is byte-identical to the canonical StoryHeaderRow usage. If and only if drift is found (extra classes or a different helper), align it to the canonical bare-span form. Otherwise make no edit to the status cell.
  </action>
  <verify>
    <automated>cd taskflow &amp;&amp; grep -q "name={epic.assignee?.displayName || 'Unassigned'}" src/routes/dashboard/EpicsPage.tsx &amp;&amp; grep -q 'statusPillClass(epic.status.statusCategory?.key)' src/routes/dashboard/EpicsPage.tsx &amp;&amp; ! grep -q 'epic.assignee ?' src/routes/dashboard/EpicsPage.tsx &amp;&amp; echo OK</automated>
  </verify>
  <done>Assignee cell always renders CachedAvatar with `name={epic.assignee?.displayName || 'Unassigned'}` and `url={epic.assignee?.avatarUrls?.['48x48'] || null}`; the conditional `epic.assignee ? … : null` is gone; the status span remains the canonical bare `statusPillClass(...)` span with no extra geometry classes.</done>
</task>

<task type="auto">
  <name>Task 3: Verify build/lint stays green</name>
  <files>taskflow/src/routes/dashboard/EpicsPage.tsx</files>
  <action>
Run the project quality gate to confirm both edits compile and lint cleanly. Per project memory the Biome baseline is GREEN and `npm run check` runs biome check + tsc together (note: `biome lint` alone is NOT the gate). Resolve any tsc/biome errors introduced by Tasks 1–2 (e.g., a malformed colgroup, stray closing tag from the thead deletion, or an unused import). Make no behavioral changes beyond what Tasks 1–2 specify.
  </action>
  <verify>
    <automated>cd taskflow &amp;&amp; npm run check</automated>
  </verify>
  <done>`npm run check` exits 0 (biome check + tsc both clean), confirming the headerless table, colgroup, and assignee parity changes introduce no type or lint regressions.</done>
</task>

</tasks>

<verification>
- `<thead>` removed from EpicsPage.tsx; `<colgroup>` present with 5 cols preserving w-1 / (flex) / w-28 / w-32 / w-12.
- Assignee cell always renders CachedAvatar with the `'Unassigned'` fallback; no conditional `epic.assignee ? … : null`.
- Status span unchanged (canonical `statusPillClass` bare span; no extra geometry classes).
- `npm run check` green (biome + tsc).
- No issue-type/priority/points cells added; color bar, epic-name badge, key cells untouched.
</verification>

<success_criteria>
- Epics table renders with no column-header row, columns hold their prior widths (no visible reflow of Key/Status/Assignee).
- Unassigned epics show the distinct dashed-border Unassigned avatar (matching backlog), not a blank cell.
- Status pill is visually identical to the rest of the app's static pills.
- `npm run check` passes; only `EpicsPage.tsx` modified.
</success_criteria>

<output>
Create `.planning/quick/260606-rgc-make-the-epics-page-match-more-backlog-v/260606-rgc-SUMMARY.md` when done.
</output>
