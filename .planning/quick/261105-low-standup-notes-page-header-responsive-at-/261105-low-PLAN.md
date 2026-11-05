---
phase: quick-261105-low
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/ui/page-header.tsx
  - taskflow/src/components/ui/page-header.test.tsx
  - taskflow/src/routes/standup-notes/StandupPageHeader.tsx
  - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
  - taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.tsx
  - taskflow/src/routes/dashboard/EpicsPage.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
autonomous: true
requirements: [QUICK-261105-low]

must_haves:
  truths:
    - "The Standup notes header stays on one line from wide down to about 460px: the title never wraps and the buttons are never squashed or cut off"
    - "As the Standup header gets narrower, it compacts in this order: 'synced Nm ago' hides, then Refresh and Copy markdown become icon-only, then the picker drops 'Showing:' and truncates the name. The actions wrap under the title only below that width"
    - "Icon-only buttons keep their accessible names and tooltips: Refresh, Copy markdown, and 'Copied!' while the copied state is showing"
    - "Standup, Releases, My Tasks, Epics, Worklogs, Test cycles and Backlog all render the same header bar (border-b border-border px-6 py-4) through one shared PageHeader, using the same container breakpoints"
    - "Every page keeps its current title text and size: text-3xl for My Tasks, Standup and Releases; text-2xl for Epics, Worklogs, Test cycles and Backlog"
  artifacts:
    - path: "taskflow/src/components/ui/page-header.tsx"
      provides: "PageHeader primitive plus the shared compaction class constants"
      exports: ["PageHeader", "headerSecondaryText", "headerActionLabel"]
    - path: "taskflow/src/components/ui/page-header.test.tsx"
      provides: "Unit tests for PageHeader structure"
  key_links:
    - from: "taskflow/src/routes/standup-notes/StandupPageHeader.tsx"
      to: "taskflow/src/components/ui/page-header.tsx"
      via: "import { PageHeader, headerSecondaryText, headerActionLabel }"
      pattern: "PageHeader"
    - from: "taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx"
      to: "PageHeader @container"
      via: "@[30rem]: variants on the trigger's inner spans"
      pattern: "@\\[30rem\\]"
---

<objective>
Fix the Standup notes header at narrow widths. Today the title wraps onto two lines and the right-hand cluster gets squashed. The fix is a shared `PageHeader` primitive that compacts its contents in stages as the container narrows. Move every simple main-page header onto it, so padding, border and narrow-width behaviour match everywhere.

Purpose: One row = one line at every width (user convention), and the same header bar on every page.
Output: `components/ui/page-header.tsx` plus its test, a rewritten StandupPageHeader, and six pages migrated.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Repo layout: `.planning/` and git are in /Users/mimo/Documents/Projects/taskflow. The app is in /Users/mimo/Documents/Projects/taskflow/taskflow. Run npm, vitest, biome and tsc from the inner `taskflow/`.

@taskflow/src/routes/standup-notes/StandupPageHeader.tsx
@taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
@taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx
@taskflow/src/components/ui/button.tsx

Header blocks to migrate (read only these ranges):
- MyTasksPage.tsx ~L722-836 ("Hero header" div: title, subtitle p, donut `hidden @[1000px]:flex`, Scope fieldset)
- EpicsPage.tsx ~L253-263
- WorklogsPage.tsx ~L700-702
- AioProjectOverviewPage.tsx ~L351-369 (title + mono projectKey span, baseline-aligned)
- BacklogPage.tsx ~L1319-1350

**Locked conventions (from the user; do not deviate):**
- Standard bar: `flex items-center justify-between border-b border-border px-6 py-4`. Title top-left, actions on the right. No title icons.
- Title size: text-3xl when the page has a subtitle line (My Tasks, Standup, Releases), otherwise text-2xl. Keep every page's current size and text.
- One row = one line. Compact first (hide secondary text, drop labels, tighten padding). Wrap only as a last resort.
- `@container` goes on the OUTER element. Variants work only on descendants, never on the container element itself.
- If you use `@[N]:not-sr-only`, it resets white-space and overflow. Prefer `hidden @[N]:inline` for labels.
- Format only the files you touch (`npx biome check --write <files>`), never all of src. Don't bulk find-replace identifiers that also appear in labels.
- The pre-commit hook runs the full vitest suite plus biome plus tsc, so every commit must be green. Commit with `git commit -- <paths>` from the repo root, then check `git log -1 --stat`. A failed hook leaves files staged, so don't sweep unrelated files into the next commit.

**Chosen container breakpoints.** They are measured on the PageHeader's own width, so a drawer that narrows the content area triggers them too.
- `@[52rem]` (832px): secondary status text appears ("synced Nm ago", "Updated …", Backlog/Test-cycles lastRefreshed). Constant `headerSecondaryText = 'hidden @[52rem]:inline'`.
- `@[44rem]` (704px): action button text labels appear. Below this width, labelled icon buttons are icon-only. Constant `headerActionLabel = 'hidden @[44rem]:inline'`.
- `@[30rem]` (480px): the WatchedPersonPicker shows its "Showing:" prefix and a wider name cap.
- Below roughly 460px (Standup's fully compacted content), the actions cluster wraps to a second line under the title through flex-wrap. That is the only stacking allowed.

Arithmetic check for Standup: the full content is about 770px, without "synced" about 680px, icon-only about 515px, and with the picker compacted about 455px. Each stage fits above its breakpoint.

Excluded from migration (structurally different headers; mention them in the SUMMARY):
- MergeRequestListPage: its header has the title and then a second row (state tabs and filters) stacked with space-y-3. It is not a title + actions bar.
- SprintBoardHeader: a bespoke flex-col header with `role="banner"`, a sprint name with `max-w-[60%]` truncate, a dates/stats line and px-4 py-3. Its tests depend on the banner role.
- Settings: has no header, by convention.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: PageHeader primitive + test, and the Standup header on top of it</name>
  <files>taskflow/src/components/ui/page-header.tsx, taskflow/src/components/ui/page-header.test.tsx, taskflow/src/routes/standup-notes/StandupPageHeader.tsx, taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx</files>
  <behavior>
    - Renders the title as an h1 (getByRole('heading', { level: 1, name })).
    - h1 is text-3xl when `subtitle` is given and text-2xl when it is not. An explicit `titleSize` prop overrides this.
    - Renders `subtitle` and `actions` content when provided. When omitted, it renders no subtitle wrapper and no actions wrapper.
    - Renders `titleAside` inline after the h1.
    - The outer element is a `<header>` with classes `@container`, `border-b`, `border-border` and `shrink-0`. The inner row wrapper has `px-6`, `py-4`, `flex-wrap` and `justify-between`. The actions wrapper has `flex-none`. The h1 has `truncate`.
    - Passes `data-testid` through to the outer header.
    - Exported constants: `headerSecondaryText === 'hidden @[52rem]:inline'` and `headerActionLabel === 'hidden @[44rem]:inline'`.
  </behavior>
  <action>
Create `components/ui/page-header.tsx` exporting `PageHeader`, a named export like the other ui primitives. Props:
- `title: string`
- `subtitle?: ReactNode`
- `titleAside?: ReactNode`, an inline adornment such as Test cycles' mono project key
- `actions?: ReactNode`
- `titleSize?: '2xl' | '3xl'`, defaulting to '3xl' when subtitle is present and '2xl' otherwise
- `className?: string`
- `'data-testid'?: string`

Structure: the outer `<header>` carries `@container shrink-0 border-b border-border`, plus `className` merged with `cn`. Inside it, a row div with `flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4`. Padding goes on the inner row, not the container, because container queries measure the content box (see the burndown-axis memory note).

Left block: `min-w-0`. Inside it, a title line `flex min-w-0 items-baseline gap-3` holding an h1 `truncate font-semibold` with text-2xl or text-3xl, followed by `titleAside`. Below the title line, when `subtitle` is set, add a div `mt-1 min-w-0 truncate text-xs text-muted-foreground` containing the subtitle. The subtitle must not wrap.

Actions: when `actions` is set, render a `flex flex-none items-center gap-2` div.

Explain in a doc comment why the wrap happens before the truncate. The flex-wrap line break uses each item's max-content size, so the actions drop to a second line before the title is forced to ellipsize. `truncate` only applies once the title alone is wider than the header.

Also export `headerSecondaryText` and `headerActionLabel` as plain string literals, so the Tailwind v4 source scan picks them up. Document the breakpoint stages from the context section.

Write `page-header.test.tsx` covering every case in the behavior list. Use the same Testing Library setup as `empty-state.test.tsx`. Commit the tests and the implementation together; the pre-commit hook blocks commits with failing tests.

Rewrite `StandupPageHeader.tsx` to render `<PageHeader title="Standup notes" subtitle={…} actions={…} />` and keep its props interface unchanged.
- Subtitle: the Calendar icon plus dateLabel in an inline-flex span with `items-center gap-1.5`. The PageHeader subtitle wrapper already applies the text-xs muted style.
- Actions, in their current order:
  - WatchedPersonPicker.
  - The synced span, with `headerSecondaryText` applied through `cn`. Also put the same "synced Nm ago" text in the Refresh button's `title` when it is non-null, so the information is still reachable when the span is hidden.
  - The Refresh Button: icon plus `<span className={headerActionLabel}>Refresh</span>`, with `aria-label="Refresh"`.
  - The Copy markdown Button: icon plus a span with `headerActionLabel` holding the label. Use `aria-label` and `title` set to `copied ? 'Copied!' : 'Copy markdown'`.
  - Keep variant `ghost` for Refresh and `default` for Copy, both `size="sm"`.

In `WatchedPersonPicker.tsx`, change only the PopoverTrigger content.
- The trigger gets `min-w-0`.
- Replace `<span>Showing: {triggerLabel}</span>` with:
  - a prefix span `hidden @[30rem]:inline` containing "Showing:" followed by a non-breaking space;
  - a name span `truncate max-w-28 @[30rem]:max-w-48` containing triggerLabel.
- Add `aria-label` set to `Showing: ${triggerLabel}`.
- Keep the ChevronDown, the group/watched hover and the popover content as they are.

Run `npx biome check --write` on these four files only.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/page-header.test.tsx src/routes/standup-notes && npx biome check src/components/ui/page-header.tsx src/components/ui/page-header.test.tsx src/routes/standup-notes/StandupPageHeader.tsx src/routes/standup-notes/WatchedPersonPicker.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>The PageHeader tests pass, the existing standup tests still pass, and biome and tsc are clean on the touched files. StandupPageHeader has no layout classes of its own on the header bar; PageHeader owns them. Committed as one green commit.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate the text-3xl subtitle headers (Releases, My Tasks)</name>
  <files>taskflow/src/routes/dashboard/releases-list/ReleasesHero.tsx, taskflow/src/routes/my-tasks/MyTasksPage.tsx</files>
  <action>
ReleasesHero: replace the `<header>` with `<PageHeader title="Releases" subtitle={…} actions={…} />`. The subtitle size resolves to 3xl.
- Pass the existing summary `<p data-testid="releases-summary">` and the skeleton `<p data-testid="releases-summary-skeleton" aria-hidden>` as the subtitle, wrapped in a fragment.
- On both p elements, drop `mt-1.5` (PageHeader supplies mt-1) and `flex-wrap`, and add `whitespace-nowrap` so the stats stay on one line and the wrapper truncates.
- Keep `gap-x-4`. Remove `gap-y-1` because the stats no longer wrap.
- Only pass a subtitle when summary or loading is truthy. With neither, pass `titleSize="3xl"` explicitly so the title size never changes.
- Actions: a fragment, not a wrapping div, because PageHeader already supplies the gap.
  - The "Updated …" span, with `headerSecondaryText` added and `text-xs text-muted-foreground` kept. The old wrapper div supplied those classes, so move them onto each child.
  - The Refresh button: keep `aria-label="Refresh releases"`, add `title="Refresh releases"`, and wrap the "Refresh" word in a span with `headerActionLabel`.
- The update replaces the comment that says the header copies the standard bar; the new comment should say it uses PageHeader.

MyTasksPage: replace the "Hero header" div, which is the inner `flex … px-6 pt-5 pb-5 border-b border-border/50` div and NOT the outer `@container` page div, with `<PageHeader title="My Tasks" subtitle={…} actions={…} />`.
- Subtitle: the existing span sequence, with the `<p>` wrapper and its `mt-1 truncate` removed (PageHeader provides them). Keep `tabular-nums` by wrapping the spans in `<span className="tabular-nums">`.
- Remove `text-foreground` from the h1. That class is redundant because it is the inherited default, so this is not a visual change.
- Actions: the existing donut block and the Scope fieldset, unchanged, in a fragment or a `flex items-center gap-4` div so their gap-4 is kept.
  - The donut's `hidden @[1000px]:flex` now resolves against the PageHeader container. That container is the same width as the page, so the behaviour is the same.
  - Compaction for the Scope buttons: change `px-3 py-1.5 … text-sm` to `px-2 py-1 text-xs @[44rem]:px-3 @[44rem]:py-1.5 @[44rem]:text-sm`. Labels stay visible because they are the control's only content.
- This intentionally switches My Tasks from pt-5/pb-5 and border-border/50 to the standard py-4 and border-border, per the consistency goal. Mention it in the SUMMARY.

Import `PageHeader`, `headerSecondaryText` and `headerActionLabel` from `@/components/ui/page-header`. Run `npx biome check --write` on the two files only.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/releases-list src/routes/dashboard/ReleasesTab.test.tsx src/routes/my-tasks && npx biome check src/routes/dashboard/releases-list/ReleasesHero.tsx src/routes/my-tasks/MyTasksPage.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Both pages render through PageHeader. The `releases-summary` and `releases-summary-skeleton` testids still behave as before. My Tasks keeps its title, subtitle, donut and scope. Tests, biome and tsc are green. Committed.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate the text-2xl headers (Epics, Worklogs, Test cycles, Backlog)</name>
  <files>taskflow/src/routes/dashboard/EpicsPage.tsx, taskflow/src/routes/worklogs/WorklogsPage.tsx, taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx, taskflow/src/routes/dashboard/BacklogPage.tsx</files>
  <action>
Replace each page's header div with `PageHeader`. None of these pages has a subtitle, so the title resolves to text-2xl. Keep every title string and every button, label, aria-label, title and handler byte-identical. Tests depend on them: '+ Create Epic', 'Refresh cycles', 'Reload backlog'.
- Epics: `<PageHeader title="Epics" actions={<the existing + Create Epic button>} />`.
- Worklogs: `<PageHeader title="Worklogs" />`.
- Test cycles: `<PageHeader title="Test cycles" titleAside={<the existing font-mono text-sm muted projectKey span>} actions={…} />`.
  - The old `ml-auto self-center` wrapper goes away; pass its children as a fragment.
  - On the lastRefreshed span, replace the viewport-based `hidden sm:inline` with `headerSecondaryText` and keep `text-xs text-muted-foreground`.
- Backlog: `<PageHeader title="Backlog" actions={…} />`, with the lastRefreshed span, the role=status aria-live span, the Reload button and '+ Create Story' as a fragment.
  - Replace `hidden sm:inline` with `headerSecondaryText` on both text spans.
  - The aria-live span must stay in the DOM. `hidden` keeps it mounted, the same as before.
  - This intentionally moves Backlog from px-4 py-3 to the standard px-6 py-4. Mention it in the SUMMARY.

Keep `data-testid="backlog-page"` on the outer page div, where it is now.

Run `npx biome check --write` on these four files only. Then grep each migrated file to confirm the old header div is gone (no `border-b border-border flex-shrink-0` or `px-4 py-3 border-b` header remains). Also confirm that MergeRequestListPage.tsx and SprintBoardHeader.tsx are unchanged (`git diff --quiet` on both).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/EpicsPage.test.tsx src/routes/dashboard/AioProjectOverviewPage.test.tsx src/routes/dashboard/__tests__/BacklogPage src/routes/worklogs && npx biome check src/routes/dashboard/EpicsPage.tsx src/routes/worklogs/WorklogsPage.tsx src/routes/dashboard/AioProjectOverviewPage.tsx src/routes/dashboard/BacklogPage.tsx && npx tsc --noEmit && git diff --quiet -- src/routes/dashboard/MergeRequestListPage.tsx src/routes/dashboard/SprintBoardHeader.tsx</automated>
  </verify>
  <done>All four pages render through PageHeader with unchanged titles and actions. Their existing tests pass, the full vitest suite passes through the pre-commit hook, and biome and tsc are clean. MR list and SprintBoardHeader are untouched. Committed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Presentational layout refactor. No new input, network, storage or dependency. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261105low-01 | Information disclosure | PageHeader subtitle/actions | accept | Renders only the same data each page already shows; no new data paths |
</threat_model>

<verification>
- `npx vitest run` passes in full (the pre-commit hook enforces this on each commit).
- `npx biome check` is clean on every touched file, and `npx tsc --noEmit` passes.
- Optional visual check: run `npm run tauri dev` (or a throwaway vite page plus the cached Chromium) and resize the Standup page through 900, 760, 650, 500 and 420px. Expected: synced hides, then labels go, then 'Showing:' goes, then the actions wrap. The title never wraps.
</verification>

<success_criteria>
- Standup header: one line down to about 460px, staged compaction at @[52rem], @[44rem] and @[30rem], and wrapping only below that.
- Seven main pages share one PageHeader with identical bar padding and border. Title sizes and texts are unchanged.
- MR list and Sprint Board headers are deliberately left as they are, with the reasons recorded in the SUMMARY.
</success_criteria>

<output>
Create `.planning/quick/261105-low-standup-notes-page-header-responsive-at-/261105-low-SUMMARY.md` when done
</output>
