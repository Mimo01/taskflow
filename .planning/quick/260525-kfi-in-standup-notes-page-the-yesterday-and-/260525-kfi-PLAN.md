---
phase: quick-260525-kfi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
  - taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Yesterday issue rows render with the same row treatment as Today's IssueRow (px-2 py-2 padding, monospace key, right-aligned time chip, no bold header)"
    - "Yesterday sub-items render as indented rows matching Today's nested rows (pl-6 border-l border-border ml-2, size-4 icons)"
    - "Standalone MR groups and Other commits groups visually match Today's MR row style (py-2 px-2, monospace iid, no font-semibold/italic)"
    - "The Yesterday stat line, compact empty notices, loading skeletons, and column shell remain unchanged"
    - "No data model, props, or markdown export behavior changes — restyle is className-only"
  artifacts:
    - path: "taskflow/src/routes/standup-notes/IssueActivityGroup.tsx"
      provides: "Restyled issue group header (Today IssueRow style) + indented sub-item rows"
      contains: "pl-6 border-l border-border ml-2"
    - path: "taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx"
      provides: "Restyled standalone MR header + indented sub-items"
      contains: "py-2 px-2"
    - path: "taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx"
      provides: "Restyled Other commits header + indented commit rows"
      contains: "py-2 px-2"
  key_links:
    - from: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      to: "IssueActivityGroup / StandaloneMrGroup / OtherCommitsGroup"
      via: "render in divide-y divide-border container (unchanged)"
      pattern: "divide-y divide-border"
---

<objective>
Unify the visual design of the Yesterday column's item rows so they match the preferred Today view. The Yesterday column currently uses a tighter, bolder, list-based (`<ul>`/`<li>` with `pl-8`) layout while Today uses padded interactive rows (`px-2 py-2`), monospace keys, time chips, and indented nested rows (`pl-6 border-l border-border ml-2`).

Purpose: Eliminate the jarring visual divergence between the two columns. The data, structure, and props stay identical — only Tailwind classNames and element layout change.

Output: Three restyled components (`IssueActivityGroup`, `StandaloneMrGroup`, `OtherCommitsGroup`) that render with Today's exact row/indent patterns. Zero changes to `YesterdayColumn.tsx` (its `divide-y divide-border` container already matches Today) or to any markdown export / data-join logic.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260525-kfi-in-standup-notes-page-the-yesterday-and-/260525-kfi-CONTEXT.md
@.planning/quick/260525-kfi-in-standup-notes-page-the-yesterday-and-/260525-kfi-RESEARCH.md

<interfaces>
<!-- Props are FROZEN — do not change. Restyle is className/layout only. -->

From IssueActivityGroup.tsx (existing — DO NOT change the prop signatures or SubItem types):
```typescript
export type SubItemKind =
  | 'worklog' | 'commit' | 'transition' | 'mr-comment'
  | 'approval' | 'jira-comment' | 'mr-open';
export interface SubItem { kind: SubItemKind; label: string; }
export interface IssueActivityGroupProps {
  issueKey: string;
  summary: string;
  issueType?: string;
  totalSeconds: number;
  subItems: SubItem[];
  onClick?: () => void;
}
// subItemIcon(kind) returns the correct Lucide icon per kind — KEEP this mapping.
```

From StandaloneMrGroup.tsx (existing — DO NOT change props):
```typescript
interface StandaloneMrGroupProps { iid: number; title: string; commentCount: number; approvals: number; }
```

From OtherCommitsGroup.tsx (existing — DO NOT change props):
```typescript
interface OtherCommitsGroupProps { commits: GitLabCommit[]; }  // commit.title, commit.short_id, commit.id
```

TARGET PATTERN — Today's IssueRow (from TodayInProgressSection.tsx, reference only, do not import):
```tsx
<div role="button" tabIndex={0}
  className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
  onClick={...} onKeyDown={...}>
  <IssueTypeIcon typeName={issueType} className="size-4 shrink-0" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
  {/* right-aligned chip */}
  <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{formatDuration(...)}</span>
</div>
```

TARGET PATTERN — Today's NestedMrRow (indented sub-item):
```tsx
<div className="pl-6 border-l border-border ml-2">
  <div className="flex items-center gap-2 py-2 px-2">
    <Icon className="size-4 shrink-0 text-muted-foreground" />
    <span className="flex-1 min-w-0 truncate text-sm">{label}</span>
  </div>
</div>
```

TARGET PATTERN — Today's MR row header (from TodayMrsSection / NestedMrRow):
```tsx
<div className="flex items-center gap-2 py-2 px-2">
  <GitMerge className="size-4 shrink-0 text-muted-foreground" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">!{iid}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{title}</span>
</div>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle the three Yesterday sub-components to match Today's row/indent patterns</name>
  <files>taskflow/src/routes/standup-notes/IssueActivityGroup.tsx, taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx, taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx</files>
  <action>
ClassName/layout-only changes across three files. DO NOT change props, the SubItem/SubItemKind types, the subItemIcon mapping, the onClick wiring, or any rendered text/label content. DO NOT touch YesterdayColumn.tsx (its divide-y divide-border container already matches Today per RESEARCH.md lines 142-153).

IssueActivityGroup.tsx (per CONTEXT decisions + RESEARCH section 1 & 2):
- Header button: change the className from "-mx-1 flex w-full cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-left text-sm font-semibold hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring" to "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring". Keep it as a `<button type="button">` (RESEARCH line 106: element type may stay).
- Key span: add `font-mono` so it becomes "shrink-0 text-xs text-muted-foreground font-mono". Drop `font-medium`.
- Summary span: add `text-sm` so it becomes "flex-1 min-w-0 truncate text-sm".
- Time chip: wrap the duration in Today's chip style — change "shrink-0 text-xs text-muted-foreground ml-auto" to "shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground". (The header is a flex row; the flex-1 summary already pushes the chip right, so ml-auto is no longer needed.)
- Sub-items: replace the `<ul className="mt-1 flex flex-col gap-1 pl-8">` + `<li>` list with Today's indented-row pattern. Wrap the sub-item list in a single `<div className="pl-6 border-l border-border ml-2 divide-y divide-border">` (the divide-y matches Today's nested container per RESEARCH line 120). Render each sub-item as `<div className="flex items-center gap-2 py-2 px-2">` containing `<SubIcon className="size-4 shrink-0 text-muted-foreground" />` (bump from size-3, drop mt-0.5) and `<span className="flex-1 min-w-0 truncate text-sm text-foreground">{item.label}</span>`. Keep the `// biome-ignore lint/suspicious/noArrayIndexKey` comment on the key.

StandaloneMrGroup.tsx (per RESEARCH section 3):
- Header div: change "flex items-center gap-2 text-sm font-semibold" to "flex items-center gap-2 py-2 px-2". Drop font-semibold.
- iid: split the inline `<span className="text-muted-foreground font-mono mr-1">!{iid}</span>` out as a separate Today-style chip-key. Restructure the header to: GitMerge icon (unchanged size-4 shrink-0 text-muted-foreground), then `<span className="text-xs text-muted-foreground font-mono shrink-0">!{iid}</span>`, then `<span className="flex-1 min-w-0 truncate text-sm">{title}</span>`.
- Sub-items: replace the `<ul ... pl-8>`/`<li>` block with the same indented-row pattern as IssueActivityGroup — `<div className="pl-6 border-l border-border ml-2 divide-y divide-border">` containing per-item `<div className="flex items-center gap-2 py-2 px-2">` with size-4 icon and `text-sm` truncating label span. Preserve the comment-count and approval conditional logic and their exact label text.

OtherCommitsGroup.tsx (per RESEARCH section 4 + CONTEXT discretion):
- Header div: change "flex items-center gap-2 text-sm font-semibold text-muted-foreground italic" to "flex items-center gap-2 py-2 px-2". Drop font-semibold and italic. Keep the GitBranch icon (size-4 shrink-0 text-muted-foreground) and the "Other commits" + "Commits without a linked Jira issue" sub-label structure, but adjust the sub-label className so it no longer references `not-italic` (just "text-xs text-muted-foreground").
- Commit sub-items: replace the `<ul ... pl-8>`/`<li>` list with the indented-row pattern — `<div className="pl-6 border-l border-border ml-2 divide-y divide-border">` containing per-commit `<div className="flex items-center gap-2 py-2 px-2">` with `<GitBranch className="size-4 shrink-0 text-muted-foreground" />` and a `text-sm` truncating span. Keep the existing label content: `{commit.title}` followed by the monospace `<span className="text-muted-foreground font-mono">{commit.short_id}</span>`. Keep `key={commit.id}`.
  </action>
  <verify>
    <automated>cd taskflow && npm run check && npx vitest run src/routes/standup-notes/</automated>
  </verify>
  <done>`npm run check` (biome lint + tsc --noEmit) passes with no errors; standup-notes vitest suite passes. All three files contain `pl-6 border-l border-border ml-2` for sub-items and `px-2 py-2` (or `py-2 px-2`) on headers; no remaining `pl-8`, `font-semibold`, or `italic` in the three files. Props, SubItem types, subItemIcon mapping, onClick wiring, and all label text are unchanged.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Restyled the Yesterday column's three item components (IssueActivityGroup, StandaloneMrGroup, OtherCommitsGroup) to match the Today column's visual treatment — padded interactive rows, monospace keys, right-aligned time chips, and indented sub-rows with the border-l accent.</what-built>
  <how-to-verify>
    1. Run the app (`cd taskflow && npm run dev` or the existing dev workflow) and open the Standup Notes page.
    2. Compare the Yesterday column (left) against the Today column (right) side by side.
    3. Confirm Yesterday issue rows now have the same padding, monospace key, truncated summary, and right-aligned time chip as Today's In Progress rows (no bold headers).
    4. Confirm sub-items under each Yesterday group are indented with the left border accent (`pl-6 border-l`), matching Today's nested subtasks/MRs.
    5. Confirm standalone MR groups and the "Other commits" group read like Today's rows (no italic / no bold).
    6. Confirm the stat line, compact empty notices, and loading skeletons still look correct and match Today's subtle styling.
  </how-to-verify>
  <resume-signal>Type "approved" if the two columns now look unified, or describe any remaining visual mismatches.</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` passes (biome lint + tsc --noEmit, no errors).
- `cd taskflow && npx vitest run src/routes/standup-notes/` passes (existing YesterdayColumn/Today tests still green — confirms no behavior regression).
- Grep confirms the unified patterns landed and the old patterns are gone:
  - `grep -rl "pl-6 border-l border-border ml-2" taskflow/src/routes/standup-notes/IssueActivityGroup.tsx taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx` lists all three files.
  - `grep -rn "pl-8\|font-semibold\|italic" taskflow/src/routes/standup-notes/IssueActivityGroup.tsx taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx` returns nothing.
</verification>

<success_criteria>
- Yesterday and Today columns share a unified row/indent visual language.
- All changes confined to the three named files; YesterdayColumn.tsx and markdown export untouched.
- Props, types, icon mapping, click wiring, and rendered text unchanged — purely cosmetic.
- Lint, typecheck, and the standup-notes test suite pass.
- Human confirms visual unification on the running app.
</success_criteria>

<output>
Create `.planning/quick/260525-kfi-in-standup-notes-page-the-yesterday-and-/260525-kfi-SUMMARY.md` when done.
</output>
