# Quick 261029-oyw: Release detail page at narrow widths - Research

**Researched:** 2026-10-29
**Domain:** Tailwind v4 container-query tiers on a div+flex table, plus a responsive cap on a resizable sidebar
**Confidence:** HIGH (all numbers come from the code; the visual result still needs a Tauri sweep)

<user_constraints>
## User Constraints (from CONTEXT.md, copied verbatim)

### Locked Decisions
- Sidebar: Keep sidebar SIDE-BY-SIDE at all widths (do NOT stack it below, do NOT add a collapse toggle). At narrow widths it shrinks: clamp the sidebar's effective width narrower (e.g. cap as a fraction of the container / lower max) so the main column keeps usable room. Sidebar content must still fit/truncate sensibly at the narrower width.
- Table columns: User wants BOTH compaction AND dropping: tiered container-query degradation. Compact first (e.g. assignee → avatar only, MR column narrower / icon-only, state pill tighter). Then drop lower-priority columns at the narrowest tiers. Summary keeps priority; one row = one line at every width (no second line, no wrapping).

### Claude's Discretion
- Exact breakpoint thresholds and which column drops first (base on content; mirror My Tasks/DefectsList tier conventions).
- Treatment of the page header, label summary, deployment package section, and action buttons at narrow widths.
- Accessible names (title/aria-label) preserved when text becomes icon-only.

### Specifics
- Container queries go on an INNER wrapper. Rows stay div+flex. Keep flex-none on fixed cells and flex-1 min-w-0 on the summary. statusPillClass needs a flex parent. Italic + truncate needs pr-0.5. Use explicit sizing (WebKit 0-width columns). No layout shift from hover affordances. The secondary table follows the same tiers.

### Deferred Ideas
None listed.
</user_constraints>

## Project Constraints
There is no CLAUDE.md at the repo root or in `taskflow/`. Rules taken from project memory:
- Biome: check only the files you changed. Never run `--write` on all of `src`.
- The pre-commit hook runs the full vitest suite, so tests and code go in one commit.
- jsdom does not evaluate container queries. Tests check class strings, not visibility (same approach as n6b).

## 1. Current widths (default settings: nav 224, release sidebar 288, peek 480, 16px root)

**Primary task row** (`UnifiedTaskTable.tsx:77-82`, plus BR/MS slots at `:590`). Fixed cells: icon 18 + key 88 + person 140 + state 96 + MR 190 + BR 28 + MS 28 = 588px. Add 7 gaps of 8px (`gap-2`, 8 cells) = **644px fixed**. The overlay button is absolute, so it takes no space. Summary width = table width - 644.

**Secondary MR row** (`MrSubLine` `:502`): pl-4 16 + key 88 + BR/MS 56 + 3 gaps of 8px = 184px fixed. This only becomes a problem below about 300px.

**Table width** = window - nav 224 - [peek 480] - sidebar - 48 (the `p-6` at `ReleaseDetailPage.tsx:235`).

| Window | Peek | Sidebar now | Table | Summary now |
|---|---|---|---|---|
| 1440 | no | 288 | 880 | 236 |
| 1280 | no | 288 | 720 | **76** |
| 1100 (default Tauri window, `tauri.conf.json:16`) | no | 288 | 540 | **-104 (overflow)** |
| 1024 | no | 288 | 464 | -180 |
| 1440 | yes | 288 | 400 | -244 |
| 1280 | yes | 288 (=50%) | 240 | -404 |
| 1100 | yes | 240 (min beats 50%=198) | 108 | hopeless |

Only windows of 1440px and wider work today. Rows overflow and the left column (`flex-1 overflow-auto`, `:234`) scrolls sideways.

**Sidebar** (`ReleaseDetailPage.tsx:140-146`): the hook is called with `min: 240` and `max: 50% of containerRef`. The default of 288 comes from `settings.store.ts:56`. `useResizable` only clamps on init, when `initialWidth` changes, and during a drag (`useResizable.ts:54,69-75,95`). **It never re-clamps when the container resizes**, so opening the peek or resizing the window leaves the stored px width in place. The first clamp also runs before `containerRef` mounts, falling back to `800*0.5`. No other caller clamps responsively either: MergeRequestDetailPage `:77`, IssueDetailView `:363` and AioTestRunDetailPage `:149` all use the same 50% formula. There is no prior art to copy.

## 2. Container-query tier pattern (prior art)

- **My Tasks** (780aa6b7, 76c67851): `@container` sits on the page root (`MyTasksPage.tsx:750`). Rows use `@max-[Npx]:hidden`, `@max-[720px]:w-24` and `@max-[860px]:sr-only` text inside a chip, with `aria-label` and `title` on the chip. The LEFT region got `overflow-hidden` as a safety net. Inline `style={{width}}` had to become px classes, because inline style beats variant classes. Tests: `toHaveClass('@max-[1024px]:hidden')` and `not.toHaveAttribute('style')` (`MyTaskRow.test.tsx`, "responsive container tiers" describe).
- **DefectsList** (924e7027): `@container` sits on the list root (`DefectsList.tsx:596`). It uses a min-width style (`hidden @[640px]:flex`, `w-10 @[880px]:w-40`). Header and rows share one `COL` map, so they stay aligned. The avatar-only person cell is `hidden @[880px]:inline` on the name span with `title` on the wrapper. The compact header label is an aria-hidden short span plus the full span.
- **Use the My Tasks `@max-[...]` form here.** The current `COL_*` constants are the full-width classes, so adding `@max-` overrides is a small diff.

## 3. Recommended tiers for UnifiedTaskTable

Put `@container` on the `<section>` at `UnifiedTaskTable.tsx:980`. Every row, header strip and badge row is a descendant of it, and the section itself is not styled by any variant, so the memory gotcha does not apply. Bake the tiers into the shared `COL_*` constants (`:77-82`) so `ColumnHeaderStrip` (`:380`) and the rows stay aligned automatically.

| Tier (table width) | Change | Fixed px | Summary at tier floor |
|---|---|---|---|
| >= 860 | full | 644 | >= 216 |
| < 860 | **compact**: Assignee becomes avatar only (`COL_PERSON` `@max-[860px]:w-5`, name `@max-[860px]:sr-only`). MR becomes `@max-[860px]:w-[5.5rem]` with the state Badge `@max-[860px]:sr-only`; the `!iid` link colour (`stateLinkClass` `:722`) still shows the state | 422 | 218 at 640 |
| < 640 | **drop** the type icon (`COL_ICON` `@max-[640px]:hidden`) and the Assignee column (`COL_PERSON` `@max-[640px]:hidden`) | 368 | 152 at 520 |
| < 520 | **drop** the MR column (`COL_MR` `@max-[520px]:hidden`). The BR/MS fix buttons stay as the drift signal | 272 | 128 at 400 |
| < 400 | **drop** Status (`COL_STATE` `@max-[400px]:hidden`). Leaves key + summary + BR + MS | 168 | 72 at 240 |

Example constants:
```ts
const COL_ICON = 'flex-none w-[1.125rem] @max-[640px]:hidden';
const COL_PERSON = 'flex-none w-[8.75rem] min-w-0 @max-[860px]:w-5 @max-[640px]:hidden';
const COL_STATE = 'flex-none w-[6rem] @max-[400px]:hidden';
const COL_MR = 'flex-none w-[11.875rem] min-w-0 @max-[860px]:w-[5.5rem] @max-[520px]:hidden';
```
Variant utilities are emitted after base utilities, so `@max-[..]:hidden` beats `flex`/`inline-flex` on the same element. My Tasks already relies on this (`flex w-12 … @max-[1024px]:hidden`). The TaskRow icon cell's inline `style={{width:18,height:18}}` (`:879`) does not set display, so the hidden variant still works.

**MR cell (`TaskMrCell` `:619-831`):**
- The selected-MR state: wrap the Badge (`:769`) in `@max-[860px]:sr-only`. Do not add geometry to the Badge.
- The four slot states are `pointer-events-none`, so their `title` never renders (WR-07 comment `:660-666`). The compact form must therefore still carry the state in **visible** text. Put the long text in `<span className="@max-[860px]:sr-only">…</span>` and add a short `<span aria-hidden className="hidden @max-[860px]:inline">`. Suggested short texts: pending = spinner only; failed = "— unknown"; none = warning icon + "No MR"; unavailable = "— not checked". These keep the existing tests passing: `/unknown/i`, `/milestone/i` and `/not checked/i` on textContent (`UnifiedTaskTable.test.tsx:973-993`), `queryByText('No merge request')` (`:903`), and the `title` attributes.
- Add `truncate` / `min-w-0` to the slot text, as a guard for 88px.

**Header strip:** "Assignee" over a 20px column becomes `<span className="@max-[860px]:sr-only">Assignee</span>`. Do **not** render "Assignee" twice. `getByText('Assignee')` (`:516`) throws if it matches more than once, and the same applies to Key/Summary/BR/MS.

**Assignee cell (`:897-915`):** put the name (`line-clamp-1`) and "Unassigned" spans in `@max-[860px]:sr-only`. The cell is `pointer-events-none`, so a `title` would not show. `CachedAvatar` keeps its explicit `size={20}`, which avoids the WebKit 0-width collapse.

**Status:** the pill already sits in a flex div (`:916`). Do not touch `statusPillClass` geometry (min-w 88 is inside `STATUS_PILL_LAYOUT_CLASS`, `statusStyles.ts:85`). A "tighter pill" is not possible without breaking that contract, so drop the column at the last tier instead.

**Issues header row (`:981`):** "Issues" + the "x / y done" badge + "N wrong branch" + "N no milestone" needs about 370px. Wrap the badge words in `@max-[520px]:hidden` spans so only the icon and count remain. The buttons already have `aria-label` (`:998`, `:1015`), so their accessible name is unchanged. Add a `title` on each button, because these are interactive and the tooltip can show. Add `flex-wrap gap-y-1` as a safety net; this is a header, not a table row. The tests use `toHaveTextContent('2')` (`:274`), which still passes.

**Secondary table:** it has no person/state/MR columns, so the tiers do not change it. The key cell (`:1175`) holds icon + `PROJ-1234` + ` +1` in 88px with nowrap and spills over. This predates the task; optionally add `overflow-hidden`. `SecondaryHeaderStrip` must keep exactly Key / Merge request / BR / MS (WR-06 tests `:543-563` assert that "MR", "Assignee" and "Status" are absent).

**Safety net:** do not put `overflow-hidden` on `TaskRow`, because it would clip the overlay button's `focus-visible:ring-2` (outer box-shadow, `:869`). The peek highlight is inset (`peek-highlight.ts:7`), so it is safe. At the 400px tier the fixed width is 168px, so rows fit down to about 240px without clipping.

## 4. Sidebar clamp (stay side-by-side)

Recommended: **a CSS-only effective cap on the sidebar root, with the hook unchanged.** It reacts to peek open/close and window resize with no observer, and the persisted width is untouched.
```tsx
// ReleaseDetailSidebar.tsx:276
style={{ width, maxWidth: 'max(12.5rem, min(50%, 100% - 30rem))' }}
```
- The percentage resolves against the flex container (`containerRef` div). The rule reads: "leave the main column at least 480px, never take more than 50%, never go below 200px."
- New numbers: 1280 + peek gives container 576, sidebar 200, table 328 (Status tier). 1440 + peek gives 736, 256, 432 (MR dropped). 1100 gives 876, 288 uncapped, 540 (icon/assignee dropped). 1024 gives 800, 288 uncapped, 464. Wide screens behave as they do today.
- `transition-all duration-200` (`:275`) also animates `max-width`, so the sidebar eases in when the peek opens. That is acceptable.
- **Pitfall: drag dead-zone.** When capped, `startRef.width` is the stored width (`useResizable.ts:79`), not the rendered one, so the first px of a drag change nothing visibly. Optional fix, non-breaking for the other 5 callers: add `getStartWidth?: () => number` to `UseResizableOptions` and use it in `handleMouseDown`. ReleaseDetailPage would pass the sidebar root's `offsetWidth` through a ref. Do not shrink the hook's `max` to the CSS cap: every drag while the peek is open would then persist a narrow width for wide screens.

**Sidebar content at 200px** (content width 168 after `p-4`):
- `MetaRow` (`MetaRow.tsx:7-8`) has a fixed `w-28` (112px) label, which leaves about 48px for the value. Put `@container` on the inner wrapper at `ReleaseDetailSidebar.tsx:287`. Make MetaRow stack below a content width of 240: `@max-[240px]:flex-col @max-[240px]:gap-0.5` on the row and `@max-[240px]:w-auto` on the label. Stacking label over value is fine here; the one-line rule applies to list rows. Watch the `meta-row-*` testids; they must not change.
- The branch name (`:143-144`, mono, no break opportunity) overflows. Use `inline-flex max-w-full min-w-0` on the wrapper and `truncate` plus `title={branchName}` on the name. Do the same for the tag name (`:175`). Milestone link buttons (`:327`) wrap normally and are fine. Badge groups already use `flex-wrap`. The unlabeled-MR list uses `line-clamp-1` and is fine.

## 5. Other page sections

- `ReleaseBreadcrumbHeader` (`ReleaseHeader.tsx:19-41`): crumbs have no `min-w-0` or truncation. The parent clips (`overflow-hidden`), so a long trail silently cuts off the release name. Add `min-w-0` to the crumb container, `truncate` to the crumb labels and the trailing name, and `shrink-0` to the back button and the `/` separators.
- Left column padding `p-6` (`ReleaseDetailPage.tsx:235`): optional. Add `@container` to the `:234` div and `@max-[480px]:p-4` on `:235`, which gives 16px back to the table. Nested containers are fine; the table queries its own section.
- `ReleaseTitleHeading` h2 wraps, which is acceptable for a heading. LabelSummarySection uses `flex-wrap`. DeploymentPackageSection is already narrow-safe (`min-w-0`/`truncate`/`break-words`, `:225-241`). Banners wrap. The action buttons (2 small, about 200px) are fine.

## Pitfalls checklist
1. Container variants never style the `@container` element itself. Apply them to descendants only (section → rows).
2. Inline `style` width beats classes. Do not move any tiered width into `style`; the `DriftCellSlot` `w-[1.75rem]` classes stay as they are.
3. sr-only and `hidden` text still counts toward `textContent`, so existing `toHaveTextContent` tests keep passing. A duplicated label breaks `getByText`.
4. WebKit 0-width: every cell keeps an explicit width. Never use `%` or a bare `flex-1` other than the summary.
5. Italic text + truncate needs `pr-0.5`. The sidebar's italic tag states (`:177,181`) get it if truncate is added.
6. React Compiler: use CSS only, with no ResizeObserver or JS width state for the tiers. The n6b research made the same call.
7. Container query thresholds are px while the columns are rem. At larger text-size tiers the columns grow but the thresholds do not. Thresholds were chosen with slack (summary >= 128 at each floor) [ASSUMED acceptable; verify at the largest text tier].

## Validation
- Quick: `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx src/hooks/useResizable.test.ts`
- Add tests (class-string assertions, as in n6b):
  - The `COL_*` tier classes on the header strip and a task row (for example, the person cell has `@max-[860px]:w-5` and `@max-[640px]:hidden`).
  - The assignee name and the MR state badge are wrapped in `@max-[860px]:sr-only`.
  - The section has `@container`.
  - The sidebar root `style.maxWidth` contains `min(50%`.
  - MetaRow carries `@max-[240px]:flex-col`.
  - If `getStartWidth` is added, a `useResizable` test that a drag starts from it.
- The real proof is manual, because jsdom cannot evaluate container queries: a width sweep in Tauri with the window at 1440/1280/1100/1024, each with and without the peek. Check that rows stay one line, the summary is visible, and nothing scrolls sideways.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The nav sidebar is at its default 224px in the width math (range 160-320, collapsible) | The tier at a given window shifts by up to ±100px. Tiers are width-driven, so they still work |
| A2 | px container thresholds stay acceptable at larger text-size tiers | Summary gets tight just above a tier boundary. Fix by switching the thresholds to rem |
| A3 | Dropping Status at the narrowest tier, before MR/BR/MS, is acceptable (discretion area) | User may prefer keeping Status over BR/MS. Swapping the two `@max-` classes is trivial |
