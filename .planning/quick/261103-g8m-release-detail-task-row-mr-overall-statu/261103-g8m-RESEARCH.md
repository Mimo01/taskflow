# Quick 261103-g8m: Release detail task row — MR overall status + details popover - Research

**Researched:** 2026-11-03
**Domain:** React 19 + Base UI 1.3 Popover inside a sibling-overlay flex row (Tauri/WebKit)
**Confidence:** HIGH (all findings from the codebase + installed node_modules; one Base UI docs check)

Paths are relative to `taskflow/` (the app dir). `UTT` = `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx`, `UTT.test` = its test file.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Row status display — Segmented state dots**
- One small coloured dot per MR (state colour: merged green / opened blue / closed grey — reuse the existing state colour mapping), followed by a short label.
- Label examples: all merged → `merged`; mixed → `1/2 merged`; single open → `open`; all open → `open` (or `2 open`) — the label summarises progress toward merged.
- No `!iid`, no MR title, no direct GitLab link on the row.
- With many MRs, dots must not blow the column width (cap visible dots, e.g. >4 → collapse into a count). One row = one line at every density.
- The existing empty/loading/failed/unavailable slot states (`mr-slot-pending`, `mr-slot-failed`, `mr-slot-none`, `mr-slot-unavailable`) stay as they are.

**BR/MS columns — aggregate on row, fixes in popover**
- The row keeps the BR and MS columns but shows the WORST state across all the task's MRs (flag if any MR is flagged; ok only if all evaluated are ok; na when none evaluable).
- The inline fix buttons move OUT of the row into the popover (one action per MR, per column).
- Clicking a flagged aggregate BR/MS cell opens the same popover (so the flag remains actionable from the row).

**Detail surface — popover anchored to the cell**
- Clicking the status chip opens a popover listing every MR on the task: `!iid`, title, author, state, BR/MS mark with its fix action (existing `DriftActionCell` behaviour/state incl. sticky failure), and an open-in-GitLab link (keep `LinkContextMenu` + `openExternal`).
- Must coexist with the row's full-row overlay button (sibling-overlay convention: the trigger needs `pointer-events-auto relative z-10`, stopPropagation so the row doesn't open the issue peek).

**Single MR — same chip + popover**
- A task with one MR uses the same dot chip + popover; no special-case direct link.

### Claude's Discretion
- Exact dot size/spacing, label wording, popover layout (follow existing popover styling, compact, overflow-safe — squarish label pills, overflow-safe action tables).
- Ordering of MRs in the popover (suggest flagged first, then open, then merged; iid desc).
- Whether the active category filter (UAT-91.1-B, `mrs` vs `allMrs`) restricts popover contents — row aggregate should describe the task (allMrs); highlighting filter matches optional; keep WR-08 rationale intact.
- Accessibility: chip is a real button with aria-label summarising states.

### Deferred Ideas (OUT OF SCOPE)
- Secondary (uncovered-MRs) table / `MrSubLine` — out of scope unless trivially shared.
</user_constraints>

## Project Constraints (from CLAUDE.md / memory)
No CLAUDE.md exists at repo root or app dir. Binding conventions from project memory + skill `sketch-findings-taskflow`:
- React Compiler is on: no `useMemo`/`useCallback`/`React.memo` (also stated in `useMrFixMutation.ts:33`). Derive aggregates inline with pure helpers.
- One row = one line at every density; drop or compact, never wrap.
- Sibling-overlay convention: interactive cells are SIBLINGS of the `absolute inset-0` overlay with `relative z-10` (+ `pointer-events-auto` when inside a `pointer-events-none` wrapper).
- Don't run `biome --write` across all of src; gate lint on "no NEW files flagged".
- Pre-commit runs the full vitest suite: RED and GREEN go in one commit per TDD task.
- Edit with scoped edits; verify scripted replacements actually changed something.

## Summary

The change stays inside `UTT` (`TaskMrCell` L931–1152) plus one small additive change to `src/components/ui/popover.tsx`. The app's popover is a thin wrapper over `@base-ui/react/popover` (installed 1.3.0). It always portals to body and exposes **no Portal or Positioner props**, so `keepMounted`, `side` and `align` can't be passed today. Base UI 1.3 supports `Portal keepMounted` (`node_modules/@base-ui/react/popover/portal/PopoverPortal.d.ts:17`; the Positioner then renders `hidden` while closed, `PopoverPositioner.js:93`). It also supports **multiple `Popover.Trigger`s in one Root**, which the docs confirm. That is how a flagged aggregate BR/MS cell can open the same popover as the chip.

The main risk is **sticky-failure state loss**. `DriftActionCell` keeps `status`/`errorMessage` in component `useState` inside `useMrFixMutation` (`useMrFixMutation.ts:80-81`, D-08). With a default Popover, closing it unmounts the cells and throws away a red "click to retry" state. A pending write survives in practice: the cache patch is optimistic, so on remount the mark already reads `ok`. Fix: a **lazy keepMounted**. Track `everOpened` per row and pass `keepMounted={everOpened}`. Rows that were never opened mount nothing (no per-row cost across a long table). Rows that were opened keep their cell state while closed.

**Primary recommendation:** Build a `TaskMrSummary` popover in `UTT`. Its pieces are a chip trigger (dots + label), aggregate BR/MS cells (the flagged ones are additional `PopoverTrigger`s), and a `PopoverContent keepMounted={everOpened}` that lists `allMrs` as compact `group/row` lines, each reusing `DriftActionCell` unchanged and keyed by `mr.id`. Delete `selectDisplayMr` (it is used only in `UTT` and `UTT.test`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregate state / BR / MS / label | Browser (pure helpers in UTT) | — | Derived from `DriftRow[]` already in props; table stays presentational (P87 D-08) |
| Popover + per-MR fixes | Browser (Base UI Popover portal) | API via existing `useMrFixMutation` | No new data fetching; reuse existing mutation hook per cell |
| Open in GitLab | Browser (`openExternal`, `LinkContextMenu`) | — | Unchanged |

## Standard Stack
No new packages. Use what's installed:
| Library | Version | Use |
|---------|---------|-----|
| `@base-ui/react` | 1.3.0 installed (`^1.2.0` in package.json) [VERIFIED: node_modules] | Popover Root/Trigger/Portal(keepMounted) |
| `@/components/ui/popover` | local | `Popover`, `PopoverTrigger`, `PopoverContent` (extend, see below) |
| `@/components/ui/link-context-menu` | local | right-click open-with on `!iid` |
| `lucide-react` | installed | `GitMerge`, `AlertTriangle`, `Check` |

## Package Legitimacy Audit
Not applicable: this phase installs no external packages.

## Findings (answers to the focus questions)

### 1. Popover primitive and in-row precedents
- `src/components/ui/popover.tsx` (whole file, about 35 lines): `PopoverContent` = `Portal > Positioner(z-50) > Popup` with `rounded-lg border bg-background p-4 shadow-lg`. It takes only Popup props. **Required change (additive, back-compatible):** add optional `keepMounted?: boolean` (forwarded to `PopoverPrimitive.Portal`) and optionally `side`/`align`/`sideOffset` (forwarded to `Positioner`). Existing callers are unaffected.
- **Style to copy:** `MoreRowsPopover` at `src/routes/dashboard/release-detail/graphs/rowToggle.tsx:62-131` (the 261102-vuw "+N more" popover).
  - Trigger: `render={<button type="button" />}` with `relative z-10 … focus-visible:ring-2 focus-visible:ring-ring` (L82-92).
  - Content: `className={cn('w-72 p-1', TOOLTIP_SURFACE, 'border-0 p-1')}` (L93). `TOOLTIP_SURFACE` = `rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-foreground/10` (`src/components/ui/tooltip-body.tsx:7`).
  - List: `<ul className="max-h-60 overflow-auto">` with `h-7` grid rows and `rounded px-2 text-xs hover:bg-muted/50` (L94-128).
- Second precedent, a fix action in a popover on the same page: `LinkTaskAction` at `NotCoveredFixActions.tsx:101-155`. It uses controlled `open`/`onOpenChange` and keeps its pending state LIFTED in the parent (`useNotCoveredFixes`). That is the alternative pattern if keepMounted is rejected.
- **Overlay interplay:** the popup portals to `<body>`, so the row's `z-10` stacking and the `pointer-events-none` wrapper don't affect it. The trigger itself lives inside the `pointer-events-none relative ${COL_MR}` wrapper (UTT L1060), so it **must** carry `pointer-events-auto relative z-10`. `pointer-events` inherits; see the CR-05 comment at UTT L1063-1065 and the existing `mr-cell-link` at L1079.
- React synthetic events from inside a portal bubble through the React tree to `TaskRow`'s root `<div>` (L1180), but that div has no `onClick`. The overlay button (L1189-1198) is a sibling, not an ancestor, so popover clicks can't open the peek. Still add `e.stopPropagation()` on the trigger click, as the locked decision says (harmless, and it future-proofs).

### 2. DriftActionCell / DriftMarkCell / isMrFixActionable / MrFixContext
- `MrFixContext` interface: UTT L64-71. It has six fields: projectId, baseUrl, token, releaseBranchName, releaseBranchExists, matchedMilestone.
- `DriftMarkCell`: UTT L330-353. Inert 28px glyph; `mark` is `'ok'|'flag'|'na'`.
- `mrFixReadiness` / `isMrFixActionable` (exported): UTT L368-387. Actionable = `mark==='flag' && configComplete && prereqReady`.
- `DriftActionCell`: UTT L399-578.
  - Owns `useMrFixMutation` (state in `useState`, `useMrFixMutation.ts:80-81`, documented at L28-31 as D-08 "sticky failure in COMPONENT STATE").
  - Has render-phase reset guards keyed on `mr.id` and `mark` (CR-07 / WR-08, L438-448).
  - Renders an `sr-only` `role=status` live region in every button state (L462-466).
  - Hover-reveals its action icon via **`group-hover/row`** (L575-576).
- **Unmount on close:**
  - Base UI unmounts the Portal when closed unless `keepMounted` is set (`PopoverPortal.js`: `shouldRender = mounted || keepMounted`).
  - Error state is lost on close, and so is its retry affordance. After rollback the mark is `flag` again, so it would just show a plain orange actionable flag.
  - Pending is lost too, but the optimistic patch means the remounted mark is already `ok`/`flag` from cache. Only the spinner is lost; no duplicate-write risk, because `fire()` re-locks per instance.
- **Recommendation: lazy keepMounted.**
  - `const [open, setOpen] = useState(false); const [everOpened, setEverOpened] = useState(false);`
  - `onOpenChange={(o) => { setOpen(o); if (o) setEverOpened(true); }}`
  - `<PopoverContent keepMounted={everOpened}>`
  - While closed, the Positioner gets `hidden` (`PopoverPositioner.js:93`), so the content can't be hit or seen.
  - Alternative: lift `useMrFixMutation` per MR into the row. This is harder because the MR count per row is variable. Not recommended.
- **Hover-reveal pitfall:** inside the portal there is no `group/row` ancestor, so the Retarget/Milestone icon would only show on focus-visible. Give each popover MR line `className="group/row …"` (scoped name collision is fine: the nearest ancestor wins).
- **sr-only in a scroller:** the live regions are `sr-only` (abspos). If the popover list is `max-h-60 overflow-auto`, add **`relative`** to that scroller (memory: sr-only escapes a non-positioned scroller, 4fb10333).
- Keep `key={`br-${mr.id}`}` / `key={`ms-${mr.id}`}` on the popover cells (CR-07). With the list keyed by `mr.id`, state now follows MR identity naturally; there is no selection to swap anymore.

### 3. Aggregate BR/MS and gating (261103-fqd)
- `DriftMark = 'ok' | 'flag' | 'na'` (`driftDetection.ts:50`). `DriftRow.evaluated` is true only for `opened` (`classifyMrState`, L211-213).
- Per-state marks by construction (`driftDetection.ts`):
  - opened: br/ms evaluated (L328-339; `na` if no release branch / no milestone matched).
  - merged: `br:'na'`, `ms` evaluated via `isMilestoneEvaluated` (L290-309).
  - closed/locked: everything `'na'` (L313-325).
- So `br` is already `'na'` for non-opened MRs. The `selected.evaluated ? DriftActionCell : DriftMarkCell na` gate at UTT L1124-1139 is belt and braces. Keep that same gate per MR in the popover.
- Helper (pure, export for unit tests):
  ```ts
  export function aggregateMark(marks: DriftMark[]): DriftMark {
    if (marks.includes('flag')) return 'flag';
    if (marks.includes('ok')) return 'ok';
    return 'na';
  }
  // BR: aggregateMark(allMrs.filter(r => r.evaluated).map(r => r.br))
  // MS: aggregateMark(allMrs.map(r => r.ms))
  ```
- Compute from **`allMrs`** (the task) per CONTEXT and WR-08 (the prop docstring is at UTT L940-947; the rationale is at UTT L1363-1370). Under a BR filter every surviving task has at least one BR flag, so the aggregate is consistent either way.
- Row aggregate cell: flag → render as a `PopoverTrigger` button (`pointer-events-auto relative z-10`, aria-label such as "1 merge request on the wrong branch — show details"). ok/na → inert `DriftMarkCell` inside `DriftCellSlot interactive={false}` (L893-906).
- Recommend that ANY flag opens the popover, even a non-actionable one, so the user can see why it isn't fixable. CR-05's rule "interactive is derived" becomes `interactive = agg === 'flag'`.

### 4. State colour helpers
- `mrStateBadgeClass(state)` at UTT L147-153 returns outline classes (`border-green-500 text-green-600` / `border-blue-500 text-blue-600` / `border-gray-400 text-gray-500`).
- `stateLinkClass` is an inline local at UTT L1043-1048 (text + dark variants). It will be deleted together with the old cell.
- `mrStateLabel(mr)` at UTT L155-160 gives Draft/Open/Merged/Closed/Locked. Reuse it for the popover state pill and the aria-label.
- Add a sibling helper `mrStateDotClass(state)` with the same palette: `bg-green-500` / `bg-blue-500` / `bg-gray-400`. Draft could use `bg-transparent ring-1 ring-blue-500` (discretion). Dot: `size-1.5 rounded-full flex-none` with `gap-0.5`.
- Popover state pill: reuse `<Badge variant="outline" className={`text-[10px] ${mrStateBadgeClass(state)}`}>`, as `MrStatePill` (L255-268) and the old cell (L1086) do. Badge is already squarish-ish; per prefs, prefer `rounded` over `rounded-full`.

### 5. Tests that rely on the old primary-row shape (`UTT.test`)
`selectDisplayMr` is referenced **only** in `UTT` and `UTT.test` (grep of `src`). No other test file references `mr-cell-link`, `mr-extra-count`, `drift-br` or `drift-ms`. Because `renderWithRows` (`UTT.test:183-197`) puts rows in the PRIMARY table, almost every drift test goes through `TaskMrCell`.

**Delete / replace (selection + `+N` are gone):**
- L377-399: "three MRs … +2 marker"; "single MR carries no +N marker"
- L401-483: the whole `describe('MR selection when a task has 2+ MRs')`, including the `selectDisplayMr` unit tests (L426-478) and the import at L38
- L1234-1273: `describe('CR-08: the +N marker …')`. Replace with "popover lists every MR (!iid, state)".
- L1807-1831: "WR-08: +N counts the task's MRs". Rewrite as "chip/aggregate describe allMrs under a filter".
- L1379-1464: `describe('CR-07 …selection…')`. Rewrite as "a failure stays on its MR when a filter toggles" (popover lists allMrs keyed by id).

**Rewrite: `mr-cell-link` assertions** (the row has no link now; use the chip testid, e.g. `mr-status-chip`, or popover content):
- L243 (row order via links → use chip/key), L276, L335-368 (consolidated describe: inline link/badge, no author avatar, title attr), L999-1008, L1139-1160 (sibling-overlay + click doesn't open row → assert the chip), L1167-1186 (CR-05 wrapper/link classes → chip), L1406/1415/1454, L1735, L1825, L1939, L2006-2026 (responsive: `getByText('opened')` badge + `mr-cell-link.closest('div')` tier classes → chip wrapper).

**Rewrite: `drift-br` / `drift-ms`.** Recommended testid scheme:
- Row aggregate cells: new testids `task-drift-br` / `task-drift-ms`.
- Popover cells: keep `drift-br` / `drift-ms`. This means `DriftActionCell` is unchanged and the secondary-table tests (L1473-1506, L2596-2622, which use `within(row)`) are untouched.
- Then:
  - Row-mark tests (L248-315, L370-375, L909-937, L1188-1212, L1313-1324): switch to `task-drift-*`, or open the popover and assert per-MR cells.
  - Action tests (L657-963 `per-MR corrective actions`, L1327-1377 `D-09 duplication`): add a helper `openMrPopover(row?)` that clicks the chip (or the flagged aggregate), then the existing `getByTestId('drift-br')` lookups resolve to the portalled cell. Popovers portal to `document.body`, so use `screen`, not `within(taskRow)`.
  - L1313-1324 ("exactly one drift-br"): becomes "no drift-br in the row before open; one per MR in the popover".
  - L1214-1232 (no button in a pointer-events-none subtree without opt-in): still valid. The chip and flagged aggregate buttons must carry `pointer-events-auto`.
  - L1280-1288 (group/row on task row): keep; add "each popover line carries group/row".
  - Sticky-failure-across-close (new test): fire, fail, close the popover (Escape or toggle chip), reopen; the cell is still red. This proves keepMounted.
- jsdom popover precedent: `UTT.test:2546-2575` clicks the trigger, then `findBy…` the portalled content. Use `await screen.findByTestId(...)` after opening.
- Note: with keepMounted, the closed popover content stays in the DOM (hidden). `getBy*` (not ByRole) will still match it, so tests asserting "absent after close" must check visibility or the `hidden` ancestor.

### 6. Column widths and narrow behaviour
- `COL_MR = 'flex-none w-[11.875rem] min-w-0 @max-[860px]:w-[5.5rem] @max-[520px]:hidden'` (UTT L132): 190px, then 88px, then hidden.
- BR/MS slots: `w-[1.75rem]` each (`DriftCellSlot` L900, header L627-635). The header is `<span className={COL_MR}>MR</span>` (L626) and needs no change.
- The `@container` is the `<section>` at UTT L1390.
- **Wide (190px):** up to 4 dots, then a label. More than 4 MRs: 3 dots + `+N` (muted, tabular-nums), keeping the dot row at 4 slots or fewer. The label is `truncate min-w-0`.
- **Narrow (≤860, 88px):** keep the dots and a short label. Use the established pair: the long label gets `@max-[860px]:sr-only` and an `aria-hidden` short variant gets `hidden @max-[860px]:inline`, as the slot states do (L987-990). Example: `1/2 merged` becomes `1/2`; `merged` / `open` stay as is (they're short).
- **≤520:** the column is hidden. The aggregate BR/MS cells remain, so the flagged aggregate is still a trigger. Anchor the popover to the trigger that opened it (Base UI default).
- Whole chip: `inline-flex items-center gap-1 whitespace-nowrap`. Never wrap (one row = one line).

### 7. Relevant pitfalls from memory
- **React Compiler:** compute `aggregateMark`, the dot list and the label inline in render via pure module-level functions. No `useMemo`. No module-level mutable reads.
- **Sibling overlay button:** the chip and the flagged aggregate cells are siblings of `task-row-overlay` with `pointer-events-auto relative z-10`; never nest a button in a `div[role=button]`.
- **sr-only in a scroller needs `relative`:** applies to the popover `ul.max-h-60.overflow-auto` (DriftActionCell live regions) and to any sr-only label text.
- **Container queries don't style the container itself:** the `@container` is the `<section>`, so `@max-[860px]:` on cells is fine. Don't make the chip a container.
- **`statusPillClass` needs a flex parent / italic truncate clip:** if the popover shows Jira-like pills or italic text, wrap them in a flex div and add `pr-0.5`.
- **Hover affordance without layout shift:** no opacity-0 caret that takes width in the 88px column.
- **Base UI popover default width:** use an explicit `w-[22rem] max-w-[calc(100vw-2rem)]`, which keeps it overflow-safe.

## Architecture Patterns

```
TaskRow (group/row, relative flex)
 ├─ overlay button (absolute inset-0)             ← row click → peek
 ├─ … key / summary / assignee / status cells
 └─ TaskMrCell
     ├─ [slot states unchanged: pending/failed/none/unavailable + naDriftCells]
     └─ <Popover open onOpenChange>  (one Root per row)
         ├─ COL_MR wrapper (pointer-events-none relative)
         │    └─ PopoverTrigger "mr-status-chip" (pointer-events-auto relative z-10)
         │         dots(≤4 | 3 + +N) + label (+ short narrow variant)
         ├─ DriftCellSlot  BR: agg==='flag' ? PopoverTrigger(task-drift-br) : DriftMarkCell
         ├─ DriftCellSlot  MS: same
         └─ PopoverContent keepMounted={everOpened} (portal → body)
              ul.relative.max-h-60.overflow-auto
                li.group/row (key=mr.id), sorted flagged→open→merged→closed, iid desc:
                  [LinkContextMenu !iid → openExternal] [state Badge] [title truncate]
                  [author] [BR: evaluated ? DriftActionCell(retarget) : DriftMarkCell na]
                  [MS: DriftActionCell(assign-milestone)]
```

**Popover line layout:** use flex with `flex-none` fixed cells and `flex-1 min-w-0 truncate` on the title. Memory says flex rows are better than a table for per-row sizing, and all text truncates on one line. The BR/MS cells are the existing 28px `DriftActionCell`s; a tiny "BR"/"MS" column header at the top of the list keeps it legible.

**Chip aria-label:** `${n} merge request${s}: ${k} merged, ${m} open — show details`.

**Label rules (discretion; recommended):**
- Count over MRs excluding `closed`/`locked`, unless all are closed (then `closed`).
- All merged → `merged`; none merged and n=1 → `open` (`draft` if draft); none merged and n>1 → `${n} open`; mixed → `${merged}/${total} merged`.
- Order dots merged → opened → closed so the row reads as progress.

## Don't Hand-Roll
| Problem | Don't build | Use instead |
|---|---|---|
| Popover positioning, outside-click, focus return | custom absolute div | Base UI Popover via `@/components/ui/popover` |
| Per-MR fix write state | new mutation logic | existing `DriftActionCell` + `useMrFixMutation` unchanged |
| Open-in-GitLab with browser choice | new menu | `LinkContextMenu` + `openExternal` (see `MrSubLine` L717-726) |
| Open from two places | controlled-open hacks or anchor refs | multiple `PopoverTrigger`s in one Root |

## Common Pitfalls
1. **Sticky failure lost on close.** Use lazy `keepMounted` (above). Prove it with a close/reopen test.
2. **Action icon never appears on hover in the popover.** There is no `group/row` ancestor in the portal; add `group/row` to each line.
3. **Inert aggregate cell eats the row click.** Only a flagged aggregate gets `z-10`/`pointer-events-auto`; ok/na stay `pointer-events-none` (CR-05).
4. **Trigger inherits `pointer-events: none`** from the COL_MR wrapper. It needs `pointer-events-auto`.
5. **sr-only live regions stretch the page.** Add `relative` on the popover scroller.
6. **Stale docstrings.** Remove the comments referencing `selectDisplayMr`/`+N`/`mr-extra-count` (UTT L860-883, L921-930, L1471 WR-10 banner comment, L1363 WR-08 comment, L435 CR-07 comment in DriftActionCell). Leave the WR-10 banner logic itself alone.
7. **Popover over-width.** Cap the width and truncate titles; no inner horizontal scroll.
8. **Tests with keepMounted:** hidden content still matches `getByTestId`, so scope assertions accordingly.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Base UI uncontrolled mode anchors to the trigger that opened it (docs: "by default positioned against the trigger that opened it") | Low: if it misanchors, pass controlled `triggerId` + trigger `id`s |
| A2 | Base UI ContextMenu (`LinkContextMenu`) inside a Popover doesn't close the popover on right-click | Medium: verify in UAT; if it does, accept the close (state is keepMounted anyway) |
| A3 | Label wording/closed-MR handling above is acceptable | Low: discretion area |

## Open Questions
1. Should the row surface a popover cell's sticky error (red) while the popover is closed? It currently can't without lifting state. Recommendation: no. The aggregate falls back to the orange flag after rollback, which still opens the popover where the red retry is waiting.

## Environment Availability
SKIPPED: code-only change, no external dependencies.

## Validation Architecture
| Property | Value |
|---|---|
| Framework | vitest (jsdom) + @testing-library/react |
| Quick run | `cd taskflow && npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx` |
| Full suite | `cd taskflow && npm test` (also runs on pre-commit) |
| Lint/types | `cd taskflow && npx biome check src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/components/ui/popover.tsx && npx tsc --noEmit` |

New tests (in `UTT.test`):
- `aggregateMark` unit tests
- label/dot helper unit tests (1 merged / mixed / open / >4 cap)
- chip renders dots + label and is a sibling-overlay trigger with `pointer-events-auto relative z-10`
- clicking the chip opens the popover listing every MR (!iid, title, state) and does not call `onOpenIssue`
- a flagged aggregate BR opens the same popover
- ok/na aggregate is inert
- popover BR action fires the retarget write
- sticky failure survives close/reopen
- popover line carries `group/row`
- narrow tier classes on the label

Wave 0: none (the infrastructure exists).

## Security Domain
No new attack surface. Writes go through the existing `useMrFixMutation` (token from `MrFixContext`). URLs are opened via existing `openExternal(mr.web_url)`. React escapes the MR titles; don't use `dangerouslySetInnerHTML`.

## Sources
- Codebase: `UTT` L56-160, L320-590, L860-1256, L1340-1372, L1626-1652; `driftDetection.ts:50-69, 205-339`; `useMrFixMutation.ts:1-120`; `components/ui/popover.tsx`; `graphs/rowToggle.tsx:55-131`; `NotCoveredFixActions.tsx:95-155`; `tooltip-body.tsx:7`; `UTT.test` (lines cited above)
- `node_modules/@base-ui/react` 1.3.0: `popover/portal/PopoverPortal.{d.ts,js}`, `positioner/PopoverPositioner.js:87-96`, `trigger/PopoverTrigger.d.ts`, `root/PopoverRoot.d.ts`
- [CITED: https://base-ui.com/react/components/popover]: multiple triggers within one Root; Portal `keepMounted`

## Metadata
Confidence: stack HIGH, architecture HIGH, pitfalls HIGH (A2 MEDIUM). Valid until about 2026-12-03.
