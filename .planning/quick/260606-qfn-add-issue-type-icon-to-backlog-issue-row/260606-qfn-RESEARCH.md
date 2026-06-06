# Quick Task 260606-qfn: Add issue type icon to backlog row + swimlane header — Research

**Researched:** 2026-06-06
**Domain:** React/TSX UI — table cell & flex-header insertion (taskflow)
**Confidence:** HIGH (all findings from codebase reads with line numbers)

## Summary

Both target components already render a `PriorityIcon` in exactly the position-relationship the user wants the new `IssueTypeIcon` to mirror. The work is a copy-the-existing-pattern insertion: a new dedicated `<td>` BEFORE the key cell in `BacklogRow.tsx`, and a new `<IssueTypeIcon>` element BEFORE the key `<button>` in `StoryHeaderRow.tsx`. The `IssueTypeIcon` component already exists, takes `typeName: string` + optional `className`, and internally maps Story/Bug/Subtask/Epic/default. No header row or colgroup exists on the Backlog table, so adding a `<td>` carries no header-alignment risk.

**Primary recommendation:** Add a type `<td>` before the key cell using the same explicit-px `<span style={{width:18,height:18}}>` wrapper PriorityIcon uses (BacklogRow.tsx:111–123); add `<IssueTypeIcon>` before the key button in the StoryHeaderRow key/summary flex div (StoryHeaderRow.tsx:127–143). Guard with `issue.fields.issuetype?.name` and render nothing when absent.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Backlog row:** issue type icon gets its OWN dedicated column, positioned BEFORE the key column. Resulting order: type → key → priority → summary → epic → points → assignee. Use the explicit ~18px-width wrapper cell (the PriorityIcon pattern) to avoid 0-width collapse in the virtualized/absolute-row table (WebKit/Tauri).
- **Swimlane header:** icon placed BEFORE the key button. Resulting order: type → key → priority → summary.
- **Consistency (explicit requirement):** icon-first ordering (type before key) in BOTH places; same component, same size, same color treatment.

### Claude's Discretion
- Exact icon size/className — match existing usage (default `w-3.5 h-3.5 shrink-0`).
- Render nothing when `issue.fields.issuetype?.name` is absent.
- Access via `issue.fields.issuetype?.name` (do not break on legacy fixtures missing `issuetype`).

### Deferred Ideas (OUT OF SCOPE)
None.

## Key Findings (exact references)

### 1. IssueTypeIcon component signature — CONFIRMED
`taskflow/src/components/ui/issue-type-icon.tsx:8-11`
```tsx
export function IssueTypeIcon({ typeName, className = 'w-3.5 h-3.5 shrink-0' }: IssueTypeIconProps)
```
- Props: `typeName: string` (required), `className?: string` (default `'w-3.5 h-3.5 shrink-0'`).
- Internal switch (lines 12-24): `Bug`→red, `Story`→green, `Subtask`/`Sub-task`→blue, `Epic`→purple, default→blue `CheckSquare`. Color is baked into the component, so the only styling to pass is size if overriding the default.
- **The component does NOT guard against undefined `typeName`** — a missing type falls through to the default icon. Callers MUST guard: only render `<IssueTypeIcon>` when `issue.fields.issuetype?.name` is truthy (matches CONTEXT decision). `[VERIFIED: codebase read]`

### 2. PriorityIcon integration in BacklogRow — CONFIRMED (mirror this)
`taskflow/src/routes/dashboard/BacklogRow.tsx:104-123` — the priority cell is its own `<td>` placed immediately AFTER the key cell (lines 87-102). Structure to copy for the NEW type cell (which goes BEFORE the key cell):
```tsx
<td className="px-0 py-2 density-compact:py-1 density-comfortable:py-3">
  <span
    className="flex items-center justify-center"
    style={{ width: 18, height: 18 }}
    aria-hidden={!issue.fields.issuetype}
  >
    {issue.fields.issuetype?.name && (
      <IssueTypeIcon typeName={issue.fields.issuetype.name} />
    )}
  </span>
</td>
```
- The explicit `style={{ width: 18, height: 18 }}` (NOT a Tailwind class) is load-bearing: BacklogRow.tsx:104-110 comment explains class-sized content contributes 0 min-content in this position:absolute virtualized table, collapsing the column. Use inline px. `[VERIFIED: codebase read]`
- Cells live inside the shared `RowCells` component (lines 66-188). Insert the new `<td>` as the FIRST child of the fragment at line 86, before the key `<td>` at line 88. Both render paths (lines 292 and 315) call `<RowCells {...cellsProps} />`, so editing `RowCells` once covers both. `issue` is already in `cellsProps` (line 266) — no prop plumbing needed.

### 3. Backlog table has NO header row / NO colgroup — NO ALIGNMENT RISK
`taskflow/src/routes/dashboard/BacklogPage.tsx:186-194` — table is `<table className="w-full text-sm"><tbody>…` with NO `<thead>`, NO `<th>`, NO `<colgroup>` (grep confirmed: only matches were `<table>`/`<tbody>`/`BacklogRow`). Columns are auto-sized purely from `<td>` content. **Adding a new `<td>` requires NO matching header column** — this de-risks the primary pitfall flagged in focus item #5. The overlay (drag ghost) table at BacklogPage.tsx:1339-1341 also uses bare `<table><tbody><BacklogRow>` rendering the same `RowCells`, so it inherits the new column automatically. `[VERIFIED: codebase read]`

### 4. StoryHeaderRow layout & insertion point — CONFIRMED
`taskflow/src/routes/dashboard/StoryHeaderRow.tsx:127-147` — the key/summary section is a flex div: `<div className="flex items-center gap-2 flex-1 min-w-0">` containing (in order): optional flag icon (128), key `<button>` (129-143), `<PriorityIcon priority={priority} />` (145), summary span (146).
- Insert `<IssueTypeIcon>` BEFORE the key `<button>` at line 129. To match CONTEXT order (type → key → priority → summary), place it after the flag icon (128) and before the key button. The flex container handles alignment; default `shrink-0` className keeps it from compressing. `[VERIFIED: codebase read]`
- **StoryHeaderRow has no `issue` object** — it receives flat props (storyKey, summary, priority, etc.), NOT a `JiraIssue`. There is currently NO issue-type prop. You must add a prop (e.g. `issueTypeName?: string`) to `StoryHeaderRowProps` (lines 33-68) and thread it from the parent. `[VERIFIED: codebase read]`

### 5. issuetype field type & null-safety — CONFIRMED
`taskflow/src/services/jira.ts:153-160`:
```ts
issuetype: {
  id?: string;        // optional — legacy fixtures may lack it
  name: string;
  subtask: boolean;   // authoritative for subtask detection
};
```
- `issuetype` itself is a required field on `JiraIssue.fields` in the type, but legacy/test fixtures may omit it at runtime — hence CONTEXT mandates `issue.fields.issuetype?.name` optional access. `id` is optional and irrelevant here (IssueTypeIcon maps by `name`). `[VERIFIED: codebase read]`
- IssueTypeIcon already handles both `"Subtask"` and `"Sub-task"` name variants (issue-type-icon.tsx:17-18), so no subtask special-casing is needed at the call site.

## Parent wiring for StoryHeaderRow (the only non-trivial plumbing)

`SprintBoardTab.tsx` renders `StoryHeaderRow` (grep-confirmed reference). Because StoryHeaderRow takes flat props, the planner must:
1. Add `issueTypeName?: string` to `StoryHeaderRowProps`.
2. In `SprintBoardTab.tsx`, pass `issueTypeName={story.fields.issuetype?.name}` (or equivalent source object) where `<StoryHeaderRow .../>` is rendered. Verify the exact source variable name during planning by reading the SprintBoardTab call site. `[VERIFIED: codebase read for reference; exact prop wiring to confirm at plan time]`

BacklogRow needs NO prop changes — `issue` is already available in `RowCells`.

## Common Pitfalls

### Pitfall 1: Column collapse in the Backlog table (PRIMARY)
**What:** A Tailwind-class-sized icon in a `position:absolute` virtualized-row table contributes 0 min-content width → column collapses to 0 (documented in MEMORY: "Virtualized table 0-width column").
**Avoid:** Wrap the icon in `<span style={{ width: 18, height: 18 }}>` (inline px, not class), exactly as PriorityIcon does (BacklogRow.tsx:112-114).

### Pitfall 2: Undefined typeName falls through to default icon
**What:** IssueTypeIcon has no null guard — a missing type silently renders the default CheckSquare.
**Avoid:** Conditionally render `{issue.fields.issuetype?.name && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}`.

### Pitfall 3 (NON-issue, ruled out): header/colgroup misalignment
The focus flagged a risk that a new `<td>` without a matching header column misaligns the table. **Verified false for this table** — there is no `<thead>`/`<th>`/`<colgroup>` (BacklogPage.tsx:186-194). No header sync needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SprintBoardTab story object exposes `issuetype.name` at the StoryHeaderRow call site | Parent wiring | Low — planner reads exact call site; same JiraIssue shape used elsewhere |

## Sources

### Primary (HIGH confidence)
- `taskflow/src/components/ui/issue-type-icon.tsx` (lines 1-25) — component signature & color map
- `taskflow/src/routes/dashboard/BacklogRow.tsx` (lines 64-188) — RowCells, PriorityIcon cell pattern
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` (lines 109-147) — flex header layout, PriorityIcon placement, props
- `taskflow/src/routes/dashboard/BacklogPage.tsx` (lines 186-194, 1339-1341) — table structure (no thead/colgroup)
- `taskflow/src/services/jira.ts` (lines 153-160) — issuetype field type
- MEMORY: project_virtualized_table_zero_width_col.md — explicit-px column-width technique
