---
phase: quick-260517-pjv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/statusStyles.ts
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/StatusPopover.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/EpicsPage.tsx
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx
autonomous: false
requirements:
  - QUICK-260517-PJV-01
must_haves:
  truths:
    - "Every status pill in the app renders with the sprint board reference style: rounded (not rounded-full), shrink-0 min-w-[5.5rem] text-center, px-1.5 py-0.5, text-xs font-medium, and bg-{color}-500/15 + text-{color}-{600|400 dark} color tokens"
    - "A single shared helper produces the full pill className (layout + color), so future status renderers cannot drift to inconsistent styles"
    - "Existing color semantics remain: indeterminate/Active/PASS-in-progress = blue, done/PASS = green, FAIL = red, BLOCKED = orange, new/NOT_EXECUTED/Closed = muted"
    - "Status popover trigger (StatusPopover) and transition menu items in StatusPopover, TaskCard context menu, and StoryHeaderRow context menu also use the unified style"
    - "User can visually scan any view (sprint board, backlog, issue detail sidebar, linked issues, AIO cycle/run/executions, epics, releases) and see identical pill geometry and color palette"
  artifacts:
    - path: "taskflow/src/lib/statusStyles.ts"
      provides: "Unified pill class helper(s) returning the full layout+color className; existing color-only helpers retained or refactored"
      contains: "statusPillClass"
  key_links:
    - from: "all consumers listed in files_modified"
      to: "taskflow/src/lib/statusStyles.ts"
      via: "statusPillClass(...) import + usage on the pill <span>"
      pattern: "statusPillClass\\("
---

<objective>
Unify every status pill/badge across the app to match the sprint board reference style:
`shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium bg-{color}-500/15 text-{color}-600 dark:text-{color}-400`.

Purpose: Today the app has at least three distinct status-pill shapes:
1. Sprint board (StoryHeaderRow): `rounded` + `min-w-[5.5rem] text-center` + `px-1.5 py-0.5` (the reference style the user likes).
2. Most other surfaces (IssueDetailContent linked stories/subtasks, EpicsPage, ReleaseDetailPage, AIO cycle/run pages, AioTestRunsSection chips, StatusPopover trigger): `inline-flex items-center rounded-full [border border-transparent] px-2 py-0.5 text-xs font-medium` — `rounded-full` (pill) instead of `rounded` (chip), no fixed min-width.
3. TaskCard bottom-row status: same as #1 but without `shrink-0 min-w-[5.5rem] text-center` (so widths vary card-to-card).
Color tokens are already consistent (`bg-{color}-500/15` + `text-{color}-600 dark:text-{color}-400`) via `statusStyles.ts` helpers, but layout is fragmented. Adding a single helper that returns the full layout+color className and routing every renderer through it eliminates the geometric drift and prevents regression.

Output:
- Updated `taskflow/src/lib/statusStyles.ts` exporting `statusPillClass(...)` (and equivalent helpers for AIO cycle + AIO run statuses) that return the FULL className (layout + color).
- 10 consumer files updated to call the new helper instead of hand-rolling the layout classes.
- Existing color-only helpers (`statusCategoryBadgeClass`, `aioCycleStatusBadgeClass`, `aioRunStatusBadgeClass`) kept available for the few non-pill renderings that need the color tokens but not the pill geometry (e.g., `LinkedIssuesSection` uses the color class on a `<Badge>` component with different geometry, `NotificationRow` uses color tokens on notification-type chips — those are NOT status pills and stay out of scope).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/lib/statusStyles.ts
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/StoryHeaderRow.tsx

<interfaces>
<!-- Existing helpers in taskflow/src/lib/statusStyles.ts (color-only, to be kept): -->
- `statusCategoryBadgeClass(categoryKey: string | undefined): string` — returns e.g. `'bg-blue-500/15 text-blue-600 dark:text-blue-400'` for Jira statusCategory.key (`new` / `indeterminate` / `done`).
- `statusCategoryDotClass(categoryKey: string | undefined): string` — small dot color (used by NotificationRow + LinkedIssuesSection dot).
- `aioCycleStatusBadgeClass(status: string): string` — color tokens for AIO cycle status (`Active` / `Closed`).
- `aioRunStatusBadgeClass(status: string): string` — color tokens for AIO run status (`PASS` / `FAIL` / `BLOCKED` / `NOT_EXECUTED`).

<!-- Reference style from StoryHeaderRow.tsx line 142-148 (the target geometry): -->
```
<span className={cn(
  'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium',
  statusStyle,
)}>
```

<!-- All current pill renderers (geometry to be replaced): -->

1. `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` line 142-148 — REFERENCE (already correct). The context-menu transition pill at line 187-191 uses `rounded-full px-2 py-0.5` — must also be unified.
2. `taskflow/src/routes/dashboard/TaskCard.tsx` line 141-150 — `rounded px-1.5 py-0.5 text-xs font-medium` (missing `shrink-0 min-w-[5.5rem] text-center`). Context-menu transition pill at line 205-212 uses `rounded-full px-2 py-0.5` — also unify.
3. `taskflow/src/routes/dashboard/StatusPopover.tsx` lines 79-83 (PopoverTrigger) and 101-108 (transition list items) — both `rounded-full px-2 py-0.5 text-xs font-medium`. Trigger has extra `border` + `hover:opacity-80 transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60` — those interaction styles must be preserved when unifying the visual geometry.
4. `taskflow/src/routes/dashboard/IssueDetailContent.tsx` lines 158-165 (linked stories) and 209-216 (linked subtasks) — both `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0`.
5. `taskflow/src/routes/dashboard/EpicsPage.tsx` lines 66-70 — `inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium`.
6. `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` lines 603-609 — `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium` (in linked issues table).
7. `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` lines 279 (cycle status header) and 517 (per-run status in list) — `inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium`.
8. `taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` lines 125 (run header) and 222 (step status) — `inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium`.
9. `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` lines 306 (step), 387 (run header — has extra `shrink-0`), 829 (impacted execution chip — has `data-testid="impacted-execution-status-chip"`) — all `inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium`.

<!-- Out of scope (NOT status pills — keep current style): -->
- `LinkedIssuesSection.tsx` line 52-56: uses `<Badge>` component with `text-[10px] h-4 px-1.5 border-0 font-normal` + status color — this is a tiny inline badge alongside a status dot, not a standalone status pill. KEEP color-only helper usage.
- `NotificationRow.tsx`: notification TYPE badges (assignment / due-soon / etc.) and entityState badges — these are not Jira/AIO status pills, KEEP as-is.
- `NotificationPopover.tsx`: source-tab count badges (orange/purple/etc.) — counts, not statuses.
- `BacklogPage.tsx` line 712-722, `MergeRequestDetailPage.tsx`, `MrRow.tsx`, etc.: sprint/MR/state badges with different semantics — out of scope per task description (status pills only).
- `BacklogRow.tsx` lines 113-119: priority/storypoints chips — not statuses.
- The existing color-only helpers (`statusCategoryBadgeClass`, `aioCycleStatusBadgeClass`, `aioRunStatusBadgeClass`) must remain exported so `LinkedIssuesSection.tsx` and any future non-pill usage still works without re-implementing the color logic.

<!-- Test impact: -->
`AioTestRunsSection.test.tsx` lines 698 and 1135 assert chip className contains `'green'` or `'red'`. Since the unified helper still emits `bg-green-500/15 text-green-600 dark:text-green-400` etc., these substring matches continue to pass. No test changes required.

<!-- Tailwind safelist: -->
The unified helper concatenates static color class strings (no dynamic template literals containing variable colors), so Tailwind JIT picks them up via normal scanning. No `tailwind.config` safelist change needed.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add unified statusPillClass helpers in statusStyles.ts</name>
  <files>taskflow/src/lib/statusStyles.ts</files>
  <behavior>
    - `statusPillClass(categoryKey: string | undefined)` returns the full className string: `'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium ' + statusCategoryBadgeClass(categoryKey)`.
    - `aioCycleStatusPillClass(status: string)` returns the same layout prefix concatenated with `aioCycleStatusBadgeClass(status)`.
    - `aioRunStatusPillClass(status: string)` returns the same layout prefix concatenated with `aioRunStatusBadgeClass(status)`.
    - Layout prefix is exported as a shared constant `STATUS_PILL_LAYOUT_CLASS = 'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium'` so the three helpers share one source of truth.
    - Existing exports (`statusCategoryBadgeClass`, `statusCategoryDotClass`, `aioCycleStatusBadgeClass`, `aioRunStatusBadgeClass`) remain unchanged and continue to work for color-only consumers (LinkedIssuesSection, NotificationRow dot/badge color usage).
  </behavior>
  <action>
    Edit `taskflow/src/lib/statusStyles.ts`. Keep all existing exports. Add a new exported `STATUS_PILL_LAYOUT_CLASS` constant equal to the literal `'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium'`. Add three new exported functions: `statusPillClass(categoryKey: string | undefined): string`, `aioCycleStatusPillClass(status: string): string`, `aioRunStatusPillClass(status: string): string`. Each returns `${STATUS_PILL_LAYOUT_CLASS} ${existingColorHelper(arg)}` (single space between layout and color). Add JSDoc above each new helper noting that the className already includes layout — callers must not add additional `rounded*`, `px-*`, `py-*`, `text-xs`, `font-*`, `inline-flex`, `min-w-*`, or `text-center` classes. Do NOT remove the color-only helpers — they remain for non-pill consumers.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>statusStyles.ts exports STATUS_PILL_LAYOUT_CLASS, statusPillClass, aioCycleStatusPillClass, aioRunStatusPillClass. All existing exports still present. `tsc --noEmit` passes (no new errors).</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Migrate all status-pill consumers to the unified helper</name>
  <files>taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/TaskCard.tsx, taskflow/src/routes/dashboard/StatusPopover.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/EpicsPage.tsx, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx, taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx, taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx</files>
  <behavior>
    - Every status pill renders with exactly the reference geometry (`shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium`) plus its color tokens.
    - No consumer re-adds geometry classes already in the helper (no duplicate `rounded-full`, `inline-flex`, `px-2`, `min-w-*`, etc. wrapping the pill `<span>`).
    - StatusPopover's PopoverTrigger keeps its interaction-only classes: `cursor-pointer`, `hover:opacity-80`, `transition-colors`, `whitespace-nowrap`, `disabled:cursor-not-allowed`, `disabled:opacity-60`. These are appended to the pill class via `cn(...)`. The visible border (line 80 `border`) is removed — the unified style relies on the colored background, not a border.
    - StatusPopover transition list items (line 101-108), TaskCard context-menu items (line 205-212), and StoryHeaderRow context-menu items (line 187-191) — all transition pills inside dropdown/context menus — also use `statusPillClass(...)`. (They are visually status pills, just embedded in menu items.)
    - AioTestRunsSection line 387 currently has an extra `shrink-0` class — keep it (or rely on the helper which already includes `shrink-0`).
    - Data-testid attributes (e.g., `data-testid="impacted-execution-status-chip"` on AioTestRunsSection line 828) are preserved verbatim.
    - LinkedIssuesSection is NOT modified (out of scope — uses `<Badge>` with different geometry, color-only helper stays).
  </behavior>
  <action>
    For each file in the list below, replace the geometry portion of the status pill className with a call to the appropriate unified helper. Import the new helper alongside (or in place of) the existing color-only import. Use `cn(...)` from `@/lib/utils` when additional non-geometry classes need to be composed (e.g., StatusPopover trigger interaction classes).

    `StoryHeaderRow.tsx`:
    - Line ~21: change import from `import { statusCategoryBadgeClass } from '@/lib/statusStyles'` to `import { statusPillClass } from '@/lib/statusStyles'`.
    - Line ~69 (`const statusStyle = statusCategoryBadgeClass(statusCategoryKey)`): delete this line (no longer needed) OR replace with `const statusStyle = statusPillClass(statusCategoryKey)`.
    - Line ~141-148 (main status badge): replace the `<span className={cn('shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium', statusStyle)}>` with `<span className={statusPillClass(statusCategoryKey)}>` (no `cn` wrap needed when only one class string is used).
    - Line ~187-191 (context-menu transition pill): replace `'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'` + `statusCategoryBadgeClass(...)` with `statusPillClass(transition.to.statusCategory?.key)`.

    `TaskCard.tsx`:
    - Line ~32: change import to `import { statusPillClass } from '@/lib/statusStyles'`.
    - Line ~141-150 (status badge): replace `'rounded px-1.5 py-0.5 text-xs font-medium'` + `statusCategoryBadgeClass(...)` with `statusPillClass(issue.fields.status.statusCategory?.key)` via the `<span>` className. Remove the surrounding `cn(...)` if only the helper string remains.
    - Line ~205-212 (context-menu transition pill): same migration as StoryHeaderRow's context-menu pill.

    `StatusPopover.tsx`:
    - Line ~15: change import to `import { statusPillClass } from '@/lib/statusStyles'`.
    - Lines ~70-83 (PopoverTrigger): rewrite `categoryStyle` to compose the pill class with interaction-only classes. Use `cn(statusPillClass(statusCategoryKey), 'cursor-pointer hover:opacity-80 transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60')`. Drop the previous `border-transparent` / `border-border text-foreground` fork — the unified pill always carries a colored background and needs no border. The `aria-label={currentStatus}` attribute stays.
    - Line ~101-108 (transition list items): replace `'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'` + `statusCategoryBadgeClass(...)` with `statusPillClass(transition.to.statusCategory?.key)`.

    `IssueDetailContent.tsx`:
    - Line ~6: change import to `import { statusPillClass } from '@/lib/statusStyles'`.
    - Line ~158-165 (linked story pill): replace `cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0', statusCategoryBadgeClass(...))` with `statusPillClass(story.fields.status.statusCategory?.key)`.
    - Line ~209-216 (linked subtask pill): same migration.

    `EpicsPage.tsx`:
    - Line ~19: change import to `import { statusPillClass } from '@/lib/statusStyles'`.
    - Line ~66-70: replace the template literal `inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${statusCategoryBadgeClass(...)}` with `statusPillClass(epic.status.statusCategory?.key)`.

    `ReleaseDetailPage.tsx`:
    - Line ~37: change import to `import { statusPillClass } from '@/lib/statusStyles'`.
    - Line ~603-609: replace template literal with `statusPillClass(row.issue.fields.status.statusCategory?.key)`.

    `AioCycleDetailPage.tsx`:
    - Line ~14: change import to `import { aioCycleStatusPillClass, aioRunStatusPillClass } from '@/lib/statusStyles'`.
    - Line ~70: this is the "muted" placeholder pill (no status helper, hard-coded `bg-muted text-muted-foreground`). Replace its geometry with the same `STATUS_PILL_LAYOUT_CLASS` literal OR import it and use `cn(STATUS_PILL_LAYOUT_CLASS, 'bg-muted text-muted-foreground')`. Prefer the latter — import `STATUS_PILL_LAYOUT_CLASS` alongside.
    - Line ~279 (cycle status header): replace the template literal with `aioCycleStatusPillClass(cycleQuery.data.status)`.
    - Line ~517 (per-run status): replace the template literal with `aioRunStatusPillClass(run.status)`.

    `AioTestRunDetailPage.tsx`:
    - Line ~9: change import to `import { aioRunStatusPillClass } from '@/lib/statusStyles'`.
    - Line ~125: replace template literal with `aioRunStatusPillClass(detailQuery.data.run.status)`.
    - Line ~222: replace template literal with `aioRunStatusPillClass(step.status ?? 'NOT_EXECUTED')`.

    `AioTestRunsSection.tsx`:
    - Line ~7: change import to `import { aioRunStatusPillClass } from '@/lib/statusStyles'`.
    - Line ~306 (step status): replace template literal with `aioRunStatusPillClass(step.status ?? 'NOT_EXECUTED')`.
    - Line ~387 (run header): replace template literal with `aioRunStatusPillClass(run.status)`. The `shrink-0` is already inside the helper — drop the extra if present.
    - Line ~829 (impacted-execution chip): replace template literal with `aioRunStatusPillClass(row.status)`. Keep the `data-testid="impacted-execution-status-chip"` attribute unchanged.

    After all edits, run a sanity grep to make sure no consumer still hand-rolls `rounded-full ... text-xs font-medium ${...BadgeClass(...)}` for status pills.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit -p tsconfig.json 2>&1 | tail -20 && grep -rn "rounded-full[^\"']*px-2 py-0.5 text-xs font-medium[^\"']*statusCategoryBadgeClass\|rounded-full[^\"']*px-2 py-0.5 text-xs font-medium[^\"']*aioCycleStatusBadgeClass\|rounded-full[^\"']*px-2 py-0.5 text-xs font-medium[^\"']*aioRunStatusBadgeClass" src/routes/dashboard 2>&1 | grep -v -E "^$" | wc -l</automated>
  </verify>
  <done>tsc --noEmit passes with no new errors. The grep gate returns `0` (no remaining hand-rolled status-pill geometry chained to a status color helper). Unit tests still pass: `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx 2>&1 | tail -10` shows green.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Visual UAT — confirm status pills look unified across the app</name>
  <what-built>
    A unified `statusPillClass` (and AIO variants) in `statusStyles.ts` plus 9 consumer files migrated to use the helper. All status pills now share the sprint board reference geometry: `shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium` with the existing color palette (`bg-{color}-500/15` + `text-{color}-600 dark:text-{color}-400`).
  </what-built>
  <how-to-verify>
    Start the app: `cd /Users/mimo/Documents/Projects/taskflow/taskflow && pnpm tauri dev` (or `npm run tauri dev`).

    Then visually confirm pill uniformity on each surface — same rounded-rectangle shape, same minimum width, same height, same color treatment:

    1. **Sprint Board** (reference baseline — should look identical to before):
       - Story header pills (TODO / In Progress / Done).
       - Task card status pills (when not in a column context).
       - Right-click a story → context menu transition pills.
       - Right-click a task → context menu transition pills.

    2. **Issue Detail sidebar (open any Jira issue)**:
       - Top-right `StatusPopover` trigger pill — should now be a chip (rounded, not rounded-full) with fixed min width, no border, colored background.
       - Click it → transition list pills should match.
       - Linked stories section — pills next to each linked story.
       - Linked subtasks section — pills next to each subtask.
       - Linked issues section (`LinkedIssuesSection`) — small status badges next to dot. (NOTE: This one was intentionally left out of scope — it's a smaller badge alongside a dot, not a standalone status pill. Confirm it still renders correctly even though it didn't get the new style.)

    3. **Epics page** — status column in the epics list. Should now be chip-shaped with fixed min width.

    4. **Release detail page** — linked issues table → status column.

    5. **AIO Cycle detail page**:
       - Cycle status header (Active / Closed).
       - Per-run status column in the runs list (PASS / FAIL / BLOCKED / NOT_EXECUTED).
       - The "muted" placeholder pill near the top should also match the unified geometry.

    6. **AIO Test Run detail page**:
       - Run header status pill.
       - Per-step status pills.

    7. **AIO Test Runs Section on issue detail**:
       - Step status pills.
       - Collapsible run-block header pills.
       - Impacted Executions table status chips.

    For each surface, visually confirm:
    - Same width across all pills in a row (the `min-w-[5.5rem]` is doing its job).
    - Same height + padding.
    - Slightly rounded corners (not fully pill-shaped — `rounded` not `rounded-full`).
    - Color palette matches the sprint board reference (blue for in-progress/active/etc.).

    Also confirm:
    - Sprint board hasn't visually regressed (reference baseline should look identical to commit `5dda387`).
    - Notification badges (type chips like "Assigned to you", entity-state chips) and tab-count badges are unchanged — they were intentionally out of scope.
  </how-to-verify>
  <resume-signal>Type "approved" if all status pills look unified and no regression on out-of-scope chips. If anything looks off, describe which surface + which pill and we'll iterate.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes (no new errors).
- Unit test `src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` passes (color substring assertions still hold).
- Grep gate: no consumer still concatenates `rounded-full ... px-2 py-0.5 text-xs font-medium` with a status color helper.
- Visual UAT (Task 3) confirms uniform pill geometry across the 7 surfaces listed.
</verification>

<success_criteria>
- A single helper (`statusPillClass` / `aioCycleStatusPillClass` / `aioRunStatusPillClass`) is the source of truth for status pill geometry + color.
- All 9 consumer files import and use the unified helper for their status pill renderings.
- The reference sprint-board style (`shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium` + the existing color tokens) is applied identically to every status pill in: sprint board (story headers, task cards, transition context menus), issue detail (StatusPopover trigger + list, linked stories, linked subtasks), epics page, release detail, AIO cycle/run/test-runs pages, and AIO Test Runs Section on issue detail.
- No visual regression on the sprint board baseline.
- Out-of-scope surfaces (LinkedIssuesSection inline badge, NotificationRow, NotificationPopover, BacklogPage / MR pages / BacklogRow non-status chips) are unchanged.
- Existing color-only helpers (`statusCategoryBadgeClass`, `statusCategoryDotClass`, `aioCycleStatusBadgeClass`, `aioRunStatusBadgeClass`) remain exported and functional for color-only consumers.
</success_criteria>

<output>
Create `.planning/quick/260517-pjv-unify-status-pills-across-app-using-spri/260517-pjv-SUMMARY.md` when done.
</output>
