# Quick Task 260606-oyy: Sprint board priority icon + issue-type border — Research

**Researched:** 2026-06-06
**Domain:** React/TSX UI (sprint board cards), Tailwind, Jira issue display utils
**Confidence:** HIGH (all findings from codebase grep + file reads)

> Paths below use the real on-disk root `taskflow/taskflow/...` (the focus block's `taskflow/src/...` was missing one level).

<user_constraints>
## User Constraints (from CONTEXT.md — LOCKED)

### Locked Decisions
- **Priority icon = actual Jira `iconUrl` image** (`issue.fields.priority.iconUrl`). Handle null/missing gracefully (no icon, no broken image).
- **Priority icon placement (card):** footer/metadata row, alongside assignee / story points / badges.
- **Card left border = issue type** (Bug/defect=red, Story=green, Subtask=blue, Epic=purple, default/Task=blue), reusing the `IssueTypeIcon` palette. Add `issueTypeStripeClass()` in `issueDisplayUtils.ts` returning a full Tailwind class string with light + dark variants.
- **Subtask treatment:** uniform with all types — drop the special `border-l-2 border-l-muted` subtask treatment; subtasks get blue type border like every other card.
- **Swimlane header:** add the story's own priority iconUrl image inline in the header flex (near key/summary). NO issue-type border on the header.

### Claude's Discretion
- Icon size ~14px (`w-3.5 h-3.5`), match existing small icons.
- Tooltip/alt text with priority name (recommended).
- Exact ordering within footer meta row.

### Deferred Ideas (OUT OF SCOPE)
- None stated.
</user_constraints>

## Summary

This is a self-contained UI change touching 3–4 files. All data is already present on the
card's `issue` object: the sprint board adapts each GreenHopper issue into a `JiraIssue` whose
`fields.priority = { name, iconUrl }` and `fields.issuetype = { id?, name, subtask }` are
fully synthesized (`adapter.ts:121-145`). **No data-fetching changes are needed for the card.**

Priority `iconUrl` is already rendered as a plain `<img src={...} alt="" className="w-3.5 h-3.5 shrink-0" />`
in three existing places (`FieldsSection.tsx:620`, `AioTestRunDetailPage.tsx:158`,
`AioCycleDetailPage.tsx:322`) — these are the canonical pattern to copy. Jira priority icon
URLs are absolute and need NO auth wrapper (unlike attachment images which use `AuthImage`).

The one wrinkle is the **swimlane header**: `StoryHeaderRow` takes *flattened* props, not the
`story` object. The `story` object IS a `JiraIssue` at the call site (`SprintBoardTab.tsx:484`)
and DOES carry `story.fields.priority` (same adapter), so the planner must add two new props
(`priorityIconUrl?`, `priorityName?`) to `StoryHeaderRow` and pass them from the call sites.

**Primary recommendation:** Create `src/components/ui/priority-icon.tsx` (`PriorityIcon`), add
`issueTypeStripeClass()` to `issueDisplayUtils.ts`, swap the card border logic in `TaskCard.tsx`,
add `PriorityIcon` to the card footer meta row and to the header, and add a unit test for
`issueTypeStripeClass()` mirroring the existing `priorityStripeClass` tests.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R1 | Remove priority left border on cards | `TaskCard.tsx:339-351` outerClassName — replace `priorityStripeClass(...)` branch |
| R2 | Show priority iconUrl image on card footer | New `PriorityIcon`; insert in `CardBody` bottom-right meta `div` (`TaskCard.tsx:213-239`) |
| R3 | Add priority icon to swimlane header | `StoryHeaderRow.tsx` — new props + render in header flex (`:122-141`) |
| R4 | Card left border = issue type color | New `issueTypeStripeClass()` in `issueDisplayUtils.ts`; consumed in `TaskCard.tsx:339-351` |
| R5 | Subtasks uniform (drop muted border) | Remove `isSubtask ? 'border-l-2 border-l-muted' : [...]` branch (`TaskCard.tsx:341-348`) |

## Exact Findings (file:line + idioms)

### 1. TaskCard footer/meta row — where the priority icon goes
- Footer is the bottom-row right cluster: `TaskCard.tsx:213-239`, a `<div className="flex items-center gap-1.5 shrink-0">` holding story-points chip, timeInColumn chip, status badge.
- **Recommended insertion:** prepend `<PriorityIcon ... />` as the first child of that right cluster (or just before story points). Sizing idiom in this file: `size-3.5` / `w-3.5 h-3.5`, gaps `gap-1.5`.
- `issueTypeName` is already computed (`TaskCard.tsx:288` → `issue.fields.issuetype?.name`) and threaded through `CardBodyProps`. To render the priority icon you need `issue.fields.priority` available inside `CardBody` — `CardBody` already receives the full `issue` prop (`CardBodyProps.issue`), so read `issue.fields.priority` directly there (no new prop required).

### 2. Shape of `issue.fields.priority` — reliable iconUrl?
- Type: `services/jira.ts:1221` → `priority: { name: string; iconUrl?: string } | null`.
- On the sprint board, priority is **synthesized by the GH adapter**: `adapter.ts:143` → `priority: { name: priority.name, iconUrl: priority.iconUrl }` via `resolvePriority` (`entityMaps.ts:76-85`).
- **Null-handling (critical):** on a resolver miss, `resolvePriority` returns `{ name: 'Unknown', iconUrl: '' }` (`entityMaps.ts:83`). So `iconUrl` may be an **empty string**, not just `undefined`/`null`. `PriorityIcon` must guard with a truthiness check (`if (!iconUrl) return null`) — empty string is falsy, so a simple `priority?.iconUrl &&` guard covers all three cases (null priority, missing iconUrl, empty iconUrl). This matches the existing pattern at `FieldsSection.tsx:620` (`f.priority?.iconUrl && ...`).
- `priorityStripeClass` already reads iconUrl via `prioritySeverityFromIcon` (`issueDisplayUtils.ts:110-116, 138`). That helper becomes **unused on the card** after R1/R4 but is still used elsewhere (`BacklogRow.tsx`, `DashboardInProgressCard.tsx`, standup sections) — **do NOT delete it.**

### 3. Reusable `PriorityIcon` in `src/components/ui/`
- Convention check: `src/components/ui/issue-type-icon.tsx` exports a named PascalCase component `IssueTypeIcon` with `{ typeName, className = 'w-3.5 h-3.5 shrink-0' }`. Mirror this for `PriorityIcon`.
- The exact `<img>` idiom is already established (copy verbatim):
  ```tsx
  // Source: FieldsSection.tsx:620-624 / AioTestRunDetailPage.tsx:157-158
  {priority?.iconUrl && (
    <img src={priority.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
  )}
  ```
- Jira priority iconUrls are **absolute URLs** rendered directly as `<img src>` everywhere — NO `AuthImage` wrapper needed (AuthImage is only for protected attachment images, see `AuthImage.tsx`).
- A11y recommendation: give the icon `alt=""` (decorative) and add `title={priorityName}` for a hover tooltip — or `alt={priorityName}` if treated as informative. Existing code uses `alt=""` (decorative). Recommend `title={name}` + `alt=""`.
- Proposed component:
  ```tsx
  // src/components/ui/priority-icon.tsx
  interface PriorityIconProps {
    priority: { name?: string | null; iconUrl?: string | null } | null | undefined;
    className?: string;
  }
  export function PriorityIcon({ priority, className = 'w-3.5 h-3.5 shrink-0' }: PriorityIconProps) {
    if (!priority?.iconUrl) return null; // handles null / undefined / '' (D: graceful)
    return <img src={priority.iconUrl} alt="" title={priority.name ?? undefined} className={className} />;
  }
  ```

### 4. Issue type field shape + `issueTypeStripeClass()`
- Name source: `issue.fields.issuetype?.name` (`TaskCard.tsx:288`, type at `jira.ts:153-167`).
- **Authoritative subtask flag:** `issue.fields.issuetype.subtask` (boolean) — the type comment explicitly says *"Use this — NOT name comparison. Admins can rename issue types."* (`jira.ts:165`). On the board, the adapter sets `subtask: parent !== undefined` (`adapter.ts:124`). The current `isSubtask` PROP on TaskCard is separate (passed by SprintBoardTab for nesting), but for the **border color** prefer `issuetype.subtask` over the name.
- **Issue-type name variants** (from `IssueTypeIcon` switch, `issue-type-icon.tsx:12-24`): `'Bug'`, `'Story'`, `'Subtask'`, `'Sub-task'`, `'Epic'`, default. Note: palette uses `'Bug'` (not `'Defect'`) and both `'Subtask'`/`'Sub-task'`. The user mentioned "defect" — Jira here uses `Bug`. The `issueTypeStripeClass` map should key on the same variants AND fall back via `issuetype.subtask === true → blue` so renamed subtask types still get blue.
- **Color mapping** (mirror `IssueTypeIcon` text colors as `border-l-*`, with dark variants — text-only colors in `IssueTypeIcon` have NO dark variant, so the planner must ADD dark variants for borders):

  | Type | IssueTypeIcon text color | Proposed border class (light + dark) |
  |------|--------------------------|--------------------------------------|
  | Bug | `text-red-500` | `border-l-red-500 dark:border-l-red-400` |
  | Story | `text-green-600` | `border-l-green-600 dark:border-l-green-400` |
  | Subtask / Sub-task | `text-blue-500` | `border-l-blue-500 dark:border-l-blue-400` |
  | Epic | `text-purple-500` | `border-l-purple-500 dark:border-l-purple-400` |
  | default / Task | `text-blue-500` | `border-l-blue-500 dark:border-l-blue-400` |

  (Dark shades chosen to clear WCAG ≥3:1 against the dark card per the `ICON_SEVERITY_STRIPE` note `issueDisplayUtils.ts:56-69` — planner may keep these or tighten; full static strings only.)
- Signature mirroring `priorityStripeClass`:
  ```tsx
  export function issueTypeStripeClass(
    issuetype: { name?: string | null; subtask?: boolean } | null | undefined,
  ): string {
    if (issuetype?.subtask) return 'border-l-blue-500 dark:border-l-blue-400';
    switch (issuetype?.name) {
      case 'Bug': return 'border-l-red-500 dark:border-l-red-400';
      case 'Story': return 'border-l-green-600 dark:border-l-green-400';
      case 'Subtask':
      case 'Sub-task': return 'border-l-blue-500 dark:border-l-blue-400';
      case 'Epic': return 'border-l-purple-500 dark:border-l-purple-400';
      default: return 'border-l-blue-500 dark:border-l-blue-400';
    }
  }
  ```

### 5. TaskCard border swap (R1 + R4 + R5)
- Current logic, `TaskCard.tsx:339-351`:
  ```tsx
  const outerClassName = cn(
    'group border rounded-lg ... flex flex-col gap-1 ...',
    isSubtask
      ? 'border-l-2 border-l-muted'
      : ['border-l-4', priorityStripeClass(issue.fields.priority as ...)],
    isFlagged && 'bg-yellow-100 ...',
  );
  ```
- Replace with (drops subtask special-case per R5, swaps priority→type per R4):
  ```tsx
  const outerClassName = cn(
    'group border rounded-lg ... flex flex-col gap-1 ...',
    'border-l-4',
    issueTypeStripeClass(issue.fields.issuetype),
    isFlagged && 'bg-yellow-100 ...',
  );
  ```
- Update the import line `TaskCard.tsx:42` to import `issueTypeStripeClass` (and drop `priorityStripeClass` if no longer used in this file — verify it isn't used elsewhere in the file; it currently is only at :345).
- **Indentation note:** the `isSubtask` PROP is still used for nesting elsewhere? Grep shows `isSubtask` only drives the border in TaskCard. Removing the border branch does NOT touch indentation — board indentation is handled by SprintBoard column layout, not TaskCard. The `isSubtask` prop becomes unused for styling but keep the prop (callers still pass it) to avoid churn, or remove if planner confirms no other use. **Verify:** `grep isSubtask` in TaskCard shows only :272 (destructure) and :341 (border).

### 6. StoryHeaderRow priority icon (R3)
- `StoryHeaderRow` takes flattened props (`StoryHeaderRow.tsx:32-65`) — it does NOT receive the `story` object, so `fields.priority` is not currently available inside the component.
- The `story` object at the call site IS a `JiraIssue` with `story.fields.priority` (same adapter path). Three call sites: `SprintBoardTab.tsx:484, 656, 1663`.
- **Plan:** add two optional props to `StoryHeaderRow`: `priorityIconUrl?: string | null; priorityName?: string | null;` and render `<PriorityIcon priority={{ iconUrl: priorityIconUrl, name: priorityName }} />` — OR add a single `priority?: { name; iconUrl } | null` prop (cleaner; matches `PriorityIcon` prop shape). Pass `priority={story.fields.priority}` at all three call sites.
- **Placement:** inside the key+summary flex block (`StoryHeaderRow.tsx:122-141`), e.g. right after the key `<button>` / before the summary `<span>`, or just before the summary. The block is `<div className="flex items-center gap-2 flex-1 min-w-0">`.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Rendering Jira priority icon | Copy the existing `<img src alt className>` idiom (`FieldsSection.tsx:620`) into a `PriorityIcon` component | Already proven, absolute URL, no auth |
| Issue-type → color map | Mirror `IssueTypeIcon` variants exactly | Single palette source of truth, includes both `Subtask`/`Sub-task` |
| Subtask detection | `issuetype.subtask` boolean | Admins rename types; name comparison is fragile (`jira.ts:165`) |

## Common Pitfalls

1. **Tailwind JIT purging** — `issueTypeStripeClass` MUST return full literal class strings (e.g. `'border-l-red-500 dark:border-l-red-400'`), never `` `border-l-${color}` ``. Same constraint documented at `issueDisplayUtils.ts:31-35`. The existing `PRIORITY_STRIPE`/`ICON_SEVERITY_STRIPE` maps are the model.
2. **Dark mode** — `IssueTypeIcon` colors are `text-*` with NO dark variant. Borders against the dark card need explicit `dark:border-l-*` variants (added in the table above). Don't copy the text colors verbatim.
3. **Empty-string iconUrl** — `resolvePriority` miss yields `iconUrl: ''` (not null). Guard with truthiness (`!priority?.iconUrl`), which catches `''`, `null`, `undefined` together.
4. **Removing the subtask border** — does not break board indentation (handled by column layout, not TaskCard border). Verify `isSubtask` has no other styling use before deciding to keep/remove the prop.
5. **Tests** — `issueDisplayUtils.test.ts` asserts exact `priorityStripeClass` strings (`:61-93`). The border swap on the card does NOT change `priorityStripeClass`, so those tests stay green. **Add** a new `describe('issueTypeStripeClass')` block asserting each variant + subtask flag + default + null. No existing test asserts on TaskCard border classes (no TaskCard.test that checks border — verify with `grep border-l src/routes/dashboard/*.test.tsx`).
6. **`priorityStripeClass` still used elsewhere** — `BacklogRow.tsx`, `DashboardInProgressCard.tsx`, `TodayUpNextSection.tsx`, `TodayInProgressSection.tsx` still import it. Do NOT delete the helper or its maps.

## Validation Architecture

- **Framework:** Vitest (`import { describe, expect, it } from 'vitest'`, `issueDisplayUtils.test.ts:1`).
- **Quick run:** `npm run test -- issueDisplayUtils` (or the project's vitest command).
- **Full gate:** `npm run check` (biome + tsc) — memory notes this must stay GREEN.
- **Wave 0 gap:** add `describe('issueTypeStripeClass')` to `src/lib/issueDisplayUtils.test.ts`. No new test file needed.

## Files To Touch (planner checklist)

| File | Change |
|------|--------|
| `taskflow/src/components/ui/priority-icon.tsx` | NEW — `PriorityIcon` component |
| `taskflow/src/lib/issueDisplayUtils.ts` | ADD `issueTypeStripeClass()` |
| `taskflow/src/lib/issueDisplayUtils.test.ts` | ADD `issueTypeStripeClass` tests |
| `taskflow/src/routes/dashboard/TaskCard.tsx` | Swap border (R1/R4/R5); add `PriorityIcon` to footer; update imports |
| `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` | ADD `priority` prop; render `PriorityIcon` in header flex |
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx` | Pass `priority={story.fields.priority}` at 3 call sites (`:484, :656, :1663`) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Board indentation is not driven by TaskCard's `isSubtask` border | §5/Pitfall 4 | Removing border could collapse nesting visual — planner should grep `isSubtask` uses to confirm |
| A2 | No existing test asserts TaskCard border classes | §Validation | A test could break — quick grep confirms before edit |
| A3 | Dark border shades clear WCAG ≥3:1 | §4 table | Low-contrast borders in dark mode; values are reasonable but not WCAG-measured this session |

## Sources

### Primary (HIGH — codebase)
- `taskflow/src/routes/dashboard/TaskCard.tsx` (footer `:213-239`, border `:339-351`, imports `:42`)
- `taskflow/src/lib/issueDisplayUtils.ts` (`priorityStripeClass` `:131-141`, JIT note `:31-35`)
- `taskflow/src/components/ui/issue-type-icon.tsx` (palette `:12-24`)
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` (props `:32-65`, header flex `:122-141`)
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` (call sites `:484, :656, :1663`)
- `taskflow/src/services/jira.ts` (priority type `:1221`, issuetype type `:153-167`)
- `taskflow/src/services/jira/greenhopper/adapter.ts` (`:121-145`), `entityMaps.ts` (`resolvePriority :76-85`)
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:620-624` (img idiom)
- `taskflow/src/lib/issueDisplayUtils.test.ts:61-93` (test pattern)

## Metadata
- **Confidence:** HIGH across stack, patterns, pitfalls — all verified by grep/read.
- **Research date:** 2026-06-06 · **Valid until:** stable (no external deps).
