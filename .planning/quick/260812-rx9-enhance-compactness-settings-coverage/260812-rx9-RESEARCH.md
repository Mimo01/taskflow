# Quick Task 260812-rx9: Enhance compactness settings coverage — Research

**Researched:** 2026-08-12
**Domain:** Tailwind v4 custom-variant density system, Taskflow UI surface audit
**Confidence:** HIGH (codebase audit + verified Tailwind compilation probe)

## Summary

Density is implemented as two Tailwind v4 custom variants in `taskflow/src/index.css` that key
off a `data-density` attribute on `<html>`. Only **11 files** currently opt in, and three of
them are floored by fixed `min-h-*` values so they visibly under-compact. The rest of the app —
including all four surfaces the user named — has zero density awareness.

Two structural findings dominate the plan:

1. **Fixed minimum heights silently defeat density.** `AioTestRunsSection` already has
   `density-compact:py-1` but also `min-h-11` (44px), so compact mode changes nothing visually.
   `EpicsPage` rows have `min-h-[3rem]` on the color bar. `SprintBoardTab` columns have
   `min-h-[80px]`. Any task that adds `py-*` variants without also making the `min-h` variant-
   aware will produce a no-op. This is almost certainly the root cause of "AIO pages / epics page
   don't compact enough."

2. **Wiki prose has exactly one attach point.** There is **no TipTap in this repo** — the
   CONTEXT note about a "shared TipTap WikiEditor" is stale. All wiki rendering flows through
   `WikiRenderer.tsx:1382`, a single `<article className="prose prose-sm dark:prose-invert …">`.
   Every consumer (description, comments, MR description, AIO test steps) renders through it.
   One className change covers all of them.

**Primary recommendation:** Add `density-compact:` / `density-comfortable:` pairs following the
existing `py-2 → py-1 / py-3` convention, and in the *same edit* neutralize any `min-h-*` on the
touched element. For prose, extend the `WikiRenderer` article className with `prose-p:` /
`prose-ul:` / `prose-headings:` stacked density variants (compilation verified below).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Mechanism — per-component classes.** Keep the opt-in pattern: add `density-compact:` /
  `density-comfortable:` Tailwind variant utilities to components that are missing them. Do NOT
  introduce a global CSS-variable / token-driven spacing system driven by `[data-density]` — that
  was explicitly rejected as regression-risky. The existing `@variant density-compact` /
  `density-comfortable` definitions in `taskflow/src/index.css` remain the single mechanism.
- **Wiki prose — spacing only.** In compact mode tighten paragraph / list / heading margins,
  line-height, table cell padding, code block padding. Do NOT change prose font size based on
  density (font size is owned exclusively by the Text Size setting). No image max-height or
  table-density changes.
- **Scope — full audit sweep.** Audit every route/component, not just the four named surfaces.
  Fix all identified gaps in this task; do not defer a "remaining gaps" list. Named surfaces are
  guaranteed-in-scope anchors: wiki-rendered content, standup notes task lists, epics page, AIO pages.
- **Variant parity — both variants.** Every surface touched gets both `density-compact:` and
  `density-comfortable:` treatment.

### Claude's Discretion
- Exact spacing step values per surface — follow magnitudes already used by covered components
  rather than inventing new scales.
- Whether a given surface genuinely needs a variant (some are legitimately density-neutral, e.g.
  modals with fixed geometry). Skipping is fine if noted in the summary.
- Ordering and grouping of the work into commits.

### Deferred Ideas (OUT OF SCOPE)
None recorded.

---

## Project Constraints

No `./CLAUDE.md` exists at the repo root. [VERIFIED: filesystem read]

Relevant repo conventions from `taskflow/package.json` [VERIFIED: file read]:
- Lint/format: Biome (`npm run check` = `biome check ./src && tsc --noEmit`)
- Tests: Vitest (`npm run test` = `vitest run`)
- Tailwind v4 via `@tailwindcss/vite` ^4.2.1; `@tailwindcss/typography` ^0.5.19
- Biome baseline drifts — gate on "no NEW files flagged", not an absolute diagnostic count.

---

## 1. The Mechanism, Precisely

### Variant definitions
`taskflow/src/index.css:10-11` [VERIFIED: file read]
```css
@variant density-compact (&:is([data-density="compact"] *));
@variant density-comfortable (&:is([data-density="comfortable"] *));
```

### Attribute host
`taskflow/src/services/theme.ts:24-30` [VERIFIED: file read]
```ts
export function applyDensity(density: Density): void {
  if (density === 'default') {
    document.documentElement.removeAttribute('data-density');
  } else {
    document.documentElement.setAttribute('data-density', density);
  }
}
```

### Three states
| Setting value | `data-density` attribute | Active variant | Meaning |
|---|---|---|---|
| `compact` | `data-density="compact"` on `<html>` | `density-compact:` | tighter than baseline |
| `default` | attribute **removed** | none | raw Tailwind classes = the baseline |
| `comfortable` | `data-density="comfortable"` on `<html>` | `density-comfortable:` | looser than baseline |

### Wiring
- Store: `taskflow/src/stores/settings.store.ts:42` default `'default'`; `:116` type;
  `:315` `setDensity`; `:366` migration backfill.
- Pre-paint apply: `theme.ts:80-93` `loadAppearance()` reads the persisted Zustand blob from the
  Tauri store and calls `applyDensity()` before first render.
- UI: `taskflow/src/routes/settings/AppearanceSection.tsx:18-22` (3-tier selector),
  `:36` `useEffect` re-applies on store hydration.

### Implication for authors
Because the attribute lives on `<html>`, **every element in the app except `<html>` itself
satisfies the `[data-density="…"] *` descendant condition** — including portalled popovers,
dialogs and sheets rendered into `document.body`. There is no scoping trap in production.
[VERIFIED: variant selector + attribute host read from source]

---

## 2. Spacing Magnitude Conventions (the canonical table)

Extracted verbatim from the 11 files that already opt in. [VERIFIED: grep over `taskflow/src`]

| Baseline class | `density-compact:` | `density-comfortable:` | Used by |
|---|---|---|---|
| `py-2` | `py-1` | `py-3` | `TaskRow.tsx:85`, `MrRow.tsx:41`, `StoryHeaderRow.tsx:102`, `TaskCard.tsx:349`, `BacklogRow.tsx` (7 cells), `Sidebar.tsx:65`, `AioTestRunsSection.tsx:365` |
| `py-1.5` | `py-1` | `py-2.5` | `MyTaskRow.tsx:253,310`, `UnifiedTaskTable.tsx:835` |
| `py-1` | `py-0.5` | `py-2` | `UnifiedTaskTable.tsx:376,403,487` |
| `py-2.5` | `py-2` | `py-3` | `NotificationRow.tsx:204` |
| `p-2` | `p-1` | `p-3` | `SprintBoardTab.tsx:533,708` |

### Derived rule (use this for new surfaces)
> **One Tailwind spacing step down for compact, one step up for comfortable**, on the *vertical*
> axis only. Horizontal padding (`px-*`), gaps (`gap-*`), and font sizes are **never** varied by
> density in the existing code — do not start now.

Concrete step ladder (Tailwind 4px scale): `0.5 → 1 → 1.5 → 2 → 2.5 → 3`.

| If baseline is | compact | comfortable |
|---|---|---|
| `py-0.5` | `py-0` | `py-1` |
| `py-1` | `py-0.5` | `py-2` |
| `py-1.5` | `py-1` | `py-2.5` |
| `py-2` | `py-1` | `py-3` |
| `py-2.5` | `py-2` | `py-3` |
| `py-3` | `py-2` | `py-4` |
| `p-2` | `p-1` | `p-3` |
| `space-y-2` / `gap-2` (vertical stacks of rows) | `space-y-1` / `gap-1` | `space-y-3` / `gap-3` |

### Things NOT varied by density anywhere in the existing code
`text-*` (font size), `px-*`, horizontal `gap-*` in a `flex items-center` row, border widths,
`rounded-*`, avatar `size` props. Keep it that way — see Pitfall P4.

---

## 3. Gap Inventory (complete sweep)

Legend: **COVERED** = has density variants and they actually take effect · **PARTIAL** = has
variants but a `min-h`/fixed geometry floors them, or only some rows in the surface are covered ·
**MISSING** = no density awareness · **N/A** = legitimately density-neutral.

### P0 — the four named surfaces

| Surface | File:line | Status | Detail / required action |
|---|---|---|---|
| **Wiki prose (descriptions, comments, MR bodies, AIO steps)** | `routes/dashboard/WikiRenderer.tsx:1382` | **MISSING** | Single `<article className="prose prose-sm dark:prose-invert max-w-none break-words">`. All 8 consumers inherit from here. Needs `prose-p:` / `prose-ul:` / `prose-ol:` / `prose-li:` / `prose-headings:` / `prose-pre:` / `prose-td:` / `prose-th:` density variants + `[&_p]:leading-*`. See §4. |
| **Standup notes — task lists** | `routes/standup-notes/IssueActivityGroup.tsx:135,146,163,217` | **MISSING** | Four row containers all `py-1.5 px-2`. |
| | `routes/standup-notes/TodayInProgressSection.tsx:115,177,219` | **MISSING** | Row buttons `py-1.5`; group wrapper `[&>*]:py-2` (arbitrary child selector — needs `density-compact:[&>*]:py-1`). |
| | `routes/standup-notes/TodayUpNextSection.tsx:119,181,224,229` | **MISSING** | Same shape as above. |
| | `routes/standup-notes/TodayMrsSection.tsx:92` | **MISSING** | Row `py-3` (looser than siblings — compact should drop to `py-2`). |
| | `routes/standup-notes/TodayParticipatingSection.tsx:74` | **MISSING** | Row `py-3`. |
| | `routes/standup-notes/YesterdayColumn.tsx:576,770,797` | **MISSING** | `[&>*]:py-2` group wrappers ×2 + section `gap-2 py-2`. |
| | `routes/standup-notes/StandaloneMrGroup.tsx:39` | **MISSING** | Has its own `dense` **prop** (`py-1.5` vs `py-3`) unrelated to the density setting. Keep the prop; layer density variants on top of both branches, or (cleaner) map the two branches to different baselines and add variants to each. |
| | `routes/standup-notes/OtherCommitsGroup.tsx:19,21` | **MISSING** | `[&>*]:py-1.5` wrapper. |
| | `routes/standup-notes/StandupSectionHeader.tsx:23` | **MISSING** | `mb-2` header gap. Low value; optional. |
| | `routes/standup-notes/TodayColumn.tsx:307`, `StandupNotesPage.tsx:572`, `StandupPageHeader.tsx:61` | **N/A** | Page-level `px-6 py-4` chrome — leave alone (matches how other page headers are treated). |
| **Epics page** | `routes/dashboard/EpicsPage.tsx:52,62,67,78` | **MISSING** | Four `<td>` at `py-3` — one step above the app row baseline already. Compact → `py-1.5`, comfortable → `py-4`. |
| | `routes/dashboard/EpicsPage.tsx:46` | **BLOCKER** | `min-h-[3rem]` on the color-bar div hard-floors every row at 48px. **Must** become `min-h-[3rem] density-compact:min-h-[2rem] density-comfortable:min-h-[3.5rem]` or the `py` changes are invisible. |
| **AIO — issue detail test runs** | `routes/dashboard/issue-detail/AioTestRunsSection.tsx:365` | **PARTIAL** | Already `py-2 density-compact:py-1 density-comfortable:py-3` **but** `min-h-11` (44px) floors it → the setting appears broken here. Add `density-compact:min-h-8`. |
| **AIO — project overview** | `routes/dashboard/AioProjectOverviewPage.tsx:572-585` (th ×5), `:598-625` (td ×5) | **MISSING** | All `py-3`. Also `:541` skeleton row `py-3`, `:135` / `:512` sidebar nav items `py-2`, `:471` `p-2 space-y-1`. |
| **AIO — cycle detail** | `routes/dashboard/AioCycleDetailPage.tsx:267,284,291,300,316,332,346,363` (td ×8) | **MISSING** | All `px-3 py-3`. |
| | `routes/dashboard/AioCycleDetailPage.tsx:136` (th), `:1040-1055` (th ×6), `:1033` | **MISSING** | `py-2` / `py-3` header cells. |
| | `routes/dashboard/AioCycleDetailPage.tsx:961` | **MISSING** | `px-3 py-1.5` toolbar row. |
| **AIO — test run detail** | `routes/dashboard/AioTestRunDetailPage.tsx:92-166` (td ×6), `:372-376` (th ×5), `:382-398` (td ×5), `:418-436` (th ×7) | **MISSING** | All `px-3 py-2`. Step cells at `:385,388,391` wrap `WikiRenderer` — they inherit the prose fix automatically once §4 lands. |
| **AIO — shared block** | `components/integrations/AioBlock.tsx` | **CHECK** | Not scanned in detail; sweep for row/list containers during implementation. |

### P1 — high-traffic list surfaces, currently MISSING

| Surface | File:line | Detail |
|---|---|---|
| Issue detail — changelog entries | `routes/dashboard/issue-detail/ChangelogEntry.tsx:37` | `py-1.5`. **Note: CONTEXT lists this as already covered — it is not.** No density class in the file. |
| Issue detail — activity timeline | `routes/dashboard/issue-detail/ActivityTimeline.tsx:168` | `<ol className="space-y-3">` — the inter-entry gap. Also `:117` skeleton `space-y-3`, `:143` `mt-6 pb-4`. |
| Issue detail — attachments | `routes/dashboard/issue-detail/AttachmentFileRow.tsx:50` | `py-1.5 px-2` row. Also `AttachmentsSection.tsx:184,196` `space-y-3` / `gap-2`. |
| Issue detail — linked issues | `routes/dashboard/issue-detail/LinkedIssuesSection.tsx:36,45` | `space-y-2` + `py-1` rows. |
| Issue detail — merge requests | `routes/dashboard/issue-detail/MergeRequestsSection.tsx:38` | `py-1` rows. |
| Issue detail — worklog entries | `routes/dashboard/issue-detail/WorklogEntry.tsx:66,128` | Card `p-3 space-y-2`. |
| Issue detail — sidebar | `routes/dashboard/issue-detail/IssueDetailSidebar.tsx:92` | `space-y-4` field stack. |
| Issue detail — content shell | `routes/dashboard/IssueDetailContent.tsx:111,119,278,314,320,410` | `space-y-6` section stack, `space-y-1` lists, `py-2`/`py-1.5` link rows. |
| Issue detail — comment cards | `routes/dashboard/IssueDetailView.tsx` (comment card wrapper around `:846`) | Card padding + inter-card gap. |
| Subtasks panel | `routes/dashboard/SubtasksPanel.tsx:106` | `py-1.5` rows; `:77` card `p-4 gap-3 min-h-[160px]` (min-h floors it — see P4). |
| My Tasks page | `routes/my-tasks/MyTasksPage.tsx:146,565,585,657,674,945` | Filter bar `py-2`, section wrappers `px-4 py-3 space-y-4`, group stacks `space-y-0.5`. (`MyTaskRow.tsx` itself is COVERED.) |
| Notifications popover | `routes/notifications/NotificationPopover.tsx:174,197` | Sticky group headers `px-3 py-1.5`. (`NotificationRow.tsx` is COVERED.) |
| Merge request list | `routes/dashboard/MergeRequestListPage.tsx:196,278,283` | Rows `px-6 py-3`, grouped `divide-y` + `space-y-2`. |
| Merge request detail | `routes/dashboard/MergeRequestDetailPage.tsx:209,256,294,542,557,564` | `p-6 space-y-5`, `space-y-1` lists, commit `<li> py-1.5`. |
| Discussion threads (MR) | `routes/dashboard/DiscussionThreads.tsx:240,276,333,374,405,411,493` | Note headers `py-1.5`, thread cards `p-4 space-y-3`, reply stacks `space-y-3`. `:314` and `:335` are **prose** blocks with their own `[&_p]:my-0.5` overrides — see §4 note. |
| Releases tab | `routes/dashboard/ReleasesTab.tsx:426,604` | Release rows `px-3 py-2`. |
| Worklogs grid | `routes/worklogs/WorklogEntryRow.tsx:81` | Entry row `py-0.5` (already very tight — compact → `py-0`). |
| | `routes/worklogs/WorklogsPage.tsx:981-994` | Sticky table headers `py-2.5`; data cells live in `WorklogCellPopover` / grid cells — sweep during implementation. |
| Backlog page group headers | `routes/dashboard/BacklogPage.tsx` (header rows above the virtualizer) | `BacklogRow.tsx` is COVERED; the sprint/group header rows around it are not. |
| Sprint board swimlane headers | `routes/dashboard/SprintBoardTab.tsx:183` | Empty-column dropzone `min-h-[80px]` and swimlane header rows. Columns at `:533,708` are COVERED but floored by `min-h-[80px]`. |

### P2 — lower traffic, MISSING (fix for consistency)

| Surface | File:line |
|---|---|
| Unified filter bar | `components/UnifiedFilterBar.tsx:92,114,130,162,315,316` |
| Quick filter chips | `routes/dashboard/QuickFilterChipRow.tsx:44` |
| Status popover options | `routes/dashboard/StatusPopover.tsx:189` |
| Issue link picker | `routes/dashboard/IssueLinkRow.tsx:127` |
| Recent items popover | `components/app/RecentItemsPopover.tsx:141` |
| Watched-person picker | `routes/standup-notes/WatchedPersonPicker.tsx:105,114,117,133` |
| Settings — sidebar items list | `routes/settings/SidebarItemsList.tsx:33` |
| Settings — subtask templates | `routes/settings/SubtaskTemplatesSection.tsx:320,200` |
| Dev tools — operations | `routes/dev-tools/OperationsTab.tsx:46,49,51` |
| Dev tools — logs | `routes/dev-tools/LogsTab.tsx:20,44` |
| Release detail — label summary / meta rows | `routes/dashboard/release-detail/LabelSummarySection.tsx`, `MetaRow.tsx`, `ReleaseDetailSidebar.tsx` |
| Release detail — descriptions | `routes/dashboard/release-detail/DescriptionsSection.tsx:52` (prose block with local overrides — see §4) |
| Update / whatsnew changelogs | `components/update/UpdateDialog.tsx:105`, `WhatsNewDialog.tsx:41`, `routes/settings/UpdatesSection.tsx:164` (prose blocks with local overrides) |

### N/A — legitimately density-neutral (skip, note in summary)

| Surface | Why |
|---|---|
| `components/ui/*` shadcn primitives (`button`, `input`, `select`, `dialog`, `badge`, `switch`, `tabs`, `popover`, `sheet`, `dropdown-menu`, `context-menu`, `command`) | Changing primitives changes every consumer at once — exactly the "global regression" risk the LOCKED decision rejects. Density belongs on the *consumer* container. |
| `components/ui/card.tsx` (`--card-spacing` var) | Tempting single lever (`density-compact:[--card-spacing:--spacing(2)]`) but that IS the rejected token-driven approach and would restyle every card. **Do not touch.** |
| All `*Skeleton.tsx` files | Placeholder geometry; mismatch with real rows is cosmetic-only. *Optional* follow-through: if a row's height changes, its skeleton should match (memory: "match skeleton geometry"). Low priority. |
| `routes/onboarding/*`, `components/app/OnboardingWizard.tsx`, `StepIndicator.tsx` | One-time fixed-geometry wizard. |
| Modals with fixed geometry: `CreateEditIssueModal`, `CreateEpicDialog`, `BulkCreateSubtasksModal`, `BoardResolutionDialog`, `AttachmentPreviewModal`, `ImageLightbox`, `AboutDialog`, `confirm-sprint-move-dialog`, `HardMinimumOverlay` | Form/dialog layout; density adds risk without payoff. |
| `components/app/TopBar.tsx`, `PinnedTabStrip.tsx`, `PeekPanel.tsx`, `CommandPalette.tsx` | Fixed-height chrome; no `py-*` on repeating rows (verified: no `py-` matches in TopBar/PinnedTabStrip/PeekPanel). |
| Charts: `HoursCommitsChart`, `UpcomingReleasesTimeline`, `components/ui/chart.tsx`, `WaterfallBar/Tab` | Pixel-driven SVG geometry. |
| `routes/error/ErrorPage.tsx`, `components/ui/empty-state.tsx`, `error-state.tsx`, `route-spinner.tsx` | Single centered blocks. |
| Textareas / composers (`CommentComposer:226`, `DescriptionEditor:98,105,107`, `InlineComment:250`, `IssueDetailView:830`, `LogWorkPopover:148`) | `min-h-[80px]`-style editing affordances; shrinking hurts usability. |

---

## 4. Wiki Prose Specifics

### The single attach point
`taskflow/src/routes/dashboard/WikiRenderer.tsx:1382` [VERIFIED: file read]
```tsx
<article className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}>
```
Rendering stack: `react-markdown@10` + `remark-gfm` + `remark-breaks` + `rehype-raw` +
`rehype-sanitize`, styled by `@tailwindcss/typography@0.5.19`. **There is no TipTap / ProseMirror
in this repo** — grep for `tiptap|ProseMirror` returns zero hits across `*.ts|*.tsx|*.css`.
[VERIFIED: grep] Correct the CONTEXT assumption in the plan.

Consumers (all inherit the fix): `IssueDetailContent.tsx:289` (description), `IssueDetailView.tsx:847`
(comments), `InlineComment.tsx:276`, `MergeRequestDetailPage.tsx:233`, `DescriptionEditor.tsx:105`
(preview tab), `AioTestRunDetailPage.tsx:386,389,395`, `AioTestRunsSection.tsx:279,282,289`.

### Which selectors control what
`@tailwindcss/typography` v0.5 emits element rules of the form
`.prose :where(<el>):not(:where([class~="not-prose"], [class~="not-prose"] *))`.
Because the element part is wrapped in `:where()` (specificity 0), the whole rule has the
specificity of a single class. Any density variant utility beats it. [VERIFIED: compiled output]

| Prose concern | Tailwind modifier to use | Emitted target |
|---|---|---|
| Paragraph margins | `prose-p:` | `p` |
| Unordered / ordered list margins | `prose-ul:` / `prose-ol:` | `ul`, `ol` |
| List item margins | `prose-li:` | `li` |
| All heading margins | `prose-headings:` | `h1–h4, th` |
| Code block padding | `prose-pre:` | `pre` |
| Table cell padding | `prose-td:` / `prose-th:` | `td` / `th` |
| Blockquote | `prose-blockquote:` | `blockquote` |
| Line-height (no size change) | `[&_p]:leading-*`, `[&_li]:leading-*` | raw descendant |

### Verified compilation of stacked variants
Probe run against the project's own `tailwindcss` + `@tailwindcss/typography` install:
[VERIFIED: local `compile()` probe, `tailwindcss` 4.x from `taskflow/node_modules`]

```css
.density-compact\:prose-p\:my-1 {
  &:is([data-density="compact"] *) {
    & :is(:where(p):not(:where([class~="not-prose"],[class~="not-prose"] *))) {
      margin-block: calc(var(--spacing) * 1);
    }
  }
}
.density-compact\:\[\&_p\]\:my-1 {
  &:is([data-density="compact"] *) {
    & p { margin-block: calc(var(--spacing) * 1); }
  }
}
```
Both forms compile correctly and nest in the expected order (density outer, element inner).
Effective specificity `(0,2,0)` vs typography's `(0,1,0)` → the density rule always wins.
**Prefer `prose-*:` modifiers over `[&_p]:`** — they carry the `not-prose` escape hatch.

### Recommended className shape (magnitudes are discretion; these match §2 conventions)
```tsx
<article
  className={cn(
    'prose prose-sm dark:prose-invert max-w-none break-words',
    // compact: tighten block rhythm, no font-size change
    'density-compact:prose-p:my-1 density-compact:prose-ul:my-1 density-compact:prose-ol:my-1',
    'density-compact:prose-li:my-0 density-compact:prose-headings:mt-3 density-compact:prose-headings:mb-1',
    'density-compact:prose-pre:p-2 density-compact:prose-td:py-1 density-compact:prose-th:py-1',
    'density-compact:[&_p]:leading-snug density-compact:[&_li]:leading-snug',
    // comfortable: loosen
    'density-comfortable:prose-p:my-4 density-comfortable:prose-ul:my-4 density-comfortable:prose-li:my-1',
    'density-comfortable:prose-headings:mt-6 density-comfortable:prose-headings:mb-3',
    'density-comfortable:prose-pre:p-4 density-comfortable:prose-td:py-3 density-comfortable:prose-th:py-3',
    className,
  )}
>
```

**Do NOT add** `density-compact:prose-xs` or any `text-*` — LOCKED: font size is owned solely by
the Text Size setting.

### Prose blocks that bypass WikiRenderer (need their own treatment)
These are separate `.prose` containers with hand-rolled `[&_p]:my-*` overrides. Because the
overrides are on the *same element*, they need matching density variants or compact mode will
have no effect there:
- `routes/dashboard/DiscussionThreads.tsx:314` (`prose prose-sm`, no overrides)
- `routes/dashboard/DiscussionThreads.tsx:335` (`prose prose-xs` + `[&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0` — already near-minimum; N/A for compact, add comfortable only)
- `routes/dashboard/release-detail/DescriptionsSection.tsx:52` (`[&_p]:my-1 [&_ul]:my-1 [&_li]:my-0`)
- `components/update/UpdateDialog.tsx:105`, `components/update/WhatsNewDialog.tsx:41`,
  `routes/settings/UpdatesSection.tsx:164` (identical changelog override string ×3 — arguably N/A,
  they are already tight and live in fixed-height scroll boxes)

Also note `taskflow/src/index.css:78-80` already contains hand-written `.prose blockquote`
pseudo-element overrides — precedent that raw `.prose …` CSS exists in the file, if a rule proves
easier there. Prefer the className route to honor the LOCKED per-component mechanism.

---

## 5. Pitfalls

### P1 — Fixed `min-h-*` silently no-ops density (the big one)
`min-height` wins over reduced padding. Every one of these will produce a "setting does nothing"
bug report if `py` is changed without the `min-h`:

| File:line | Value | Note |
|---|---|---|
| `issue-detail/AioTestRunsSection.tsx:365` | `min-h-11` (44px) | **Already has density classes that do nothing.** Root cause of "AIO doesn't compact." |
| `EpicsPage.tsx:46` | `min-h-[3rem]` | Floors every epic row at 48px. |
| `SprintBoardTab.tsx:533,708` | `min-h-[80px]` | Column bodies; already have `p-*` variants that are partially floored. |
| `SprintBoardTab.tsx:183` | `min-h-[80px]` | Empty-column dropzone. |
| `SubtasksPanel.tsx:77`, `MrHealthPanel.tsx:63` | `min-h-[160px]` | Dashboard cards. |

**Verification step for every task:** after editing, grep the touched file for `min-h` and confirm
either (a) none present, or (b) a matching `density-compact:min-h-*` was added.

### P2 — Virtualized lists cache row heights in JS
Three virtualizers use `@tanstack/react-virtual`: [VERIFIED: source read]
- `routes/dashboard/BacklogPage.tsx:145-150` — `estimateSize: () => 44`, **but `useVirtual = false`**
  at `:157` (virtualization deliberately disabled for `<tr>` position:absolute reasons). No JS-side
  density read needed; CSS classes work.
- `routes/dashboard/SprintBoardTab.tsx:277-290` — `estimateSize: () => 120`, `useVirtual = true`,
  keyed by `story.key`, **dynamically measured**. The estimate is only an initial guess; measured
  heights replace it. **Risk:** when the user flips density while the board is mounted, cached
  measurements are stale until a re-measure. Mitigation: the virtualizer re-measures on element
  mount; if rows misalign after a density switch, call `swimlaneVirtualizer.measure()` in an effect
  keyed on the density store value.
- `routes/notifications/NotificationPopover.tsx:128-143` — `estimateSize: () => 64`, dynamically
  measured, keyed by entry identity. Same stale-measurement consideration; the popover unmounts on
  close so the practical exposure is small.

**Rule:** do not change `estimateSize` constants. If a density-switch misalignment appears, fix it
with a `measure()` invalidation keyed on `useSettingsStore(s => s.density)`, not with JS row heights.

### P3 — The variant requires an ancestor with the attribute
`&:is([data-density="compact"] *)` matches only *descendants* of the attribute host. In production
the host is `<html>` so this is always satisfied — including portalled content. **But in Vitest/jsdom
component tests the attribute is not set**, so density styles are inert. That is fine (tests assert
class strings, not computed styles), but do not write a test that expects a computed compact height.

### P4 — Do not vary font size or horizontal spacing
Two independent scales already compound: `data-density` and `data-font-scale` (`theme.ts:39-45`,
which scales the root font size). Adding `text-*` to density variants multiplies the two and can
push text below legibility — this is exactly what the wiki-prose LOCKED decision guards against.
Existing covered components vary **only** vertical padding. Match that.

### P5 — `[&>*]:py-2` group wrappers need the variant on the wrapper
Standup notes use arbitrary child selectors (`OtherCommitsGroup.tsx:19`,
`TodayInProgressSection.tsx:219`, `TodayUpNextSection.tsx:229`, `YesterdayColumn.tsx:770,797`).
Correct form is `[&>*]:py-2 density-compact:[&>*]:py-1 density-comfortable:[&>*]:py-3` — verified to
compile as `.cls:is([data-density="compact"] *) > * { … }`. Do not move the padding onto the child
component instead; that would break the wrapper's `divide-y` rhythm.

### P6 — CONTEXT contains two stale claims
1. "shared TipTap `WikiEditor`" — no TipTap in the repo; the path is react-markdown + typography.
2. `issue-detail/ChangelogEntry.tsx` listed as already covered — it has **no** density classes.
Neither invalidates any locked decision, but the plan should not cite them as fact.

### P7 — `StandaloneMrGroup` has a conflicting `dense` prop
`routes/standup-notes/StandaloneMrGroup.tsx:27,34,39` uses a boolean `dense` prop that already
switches `py-1.5` vs `py-3`, set by callers at `:88,102`. This is *not* the density setting. Layer
density variants onto both branches (e.g. `dense ? 'py-1.5 density-compact:py-1 density-comfortable:py-2.5' : 'py-3 density-compact:py-2 density-comfortable:py-4'`).

### P8 — Biome / class-string churn
Long conditional className template literals are already the norm here; Biome does not sort classes.
Gate on "no NEW files flagged by `npm run check`", not an absolute diagnostic count (known baseline
drift, ~16 diagnostics across 5 files).

---

## 6. Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest (`vitest run`), React Testing Library, jsdom |
| Config | `taskflow/vite.config.ts` / `vitest` section (existing) |
| Quick run | `cd taskflow && npx vitest run <path>` |
| Full suite | `cd taskflow && npm run test` |
| Static gate | `cd taskflow && npm run check` (Biome + `tsc --noEmit`) |

### Requirement → verification map
| Behavior | Test type | Command / method |
|---|---|---|
| `applyDensity` sets/removes `data-density` | unit (exists) | `npx vitest run src/services/theme.test.ts` |
| Store persists density | unit (exists) | `npx vitest run src/stores/settings.store.test.ts` |
| Settings UI exposes 3 tiers | unit (exists) | `npx vitest run src/routes/settings/Settings.test.tsx` |
| Density classes present on newly-touched rows | manual-only | Class-string assertions are brittle and low-value; existing covered components have **no** such tests. Prefer visual UAT. |
| No visual regression at `default` density | manual UAT | Baseline classes are unchanged by design — every edit only *adds* variant classes. This is the key safety property to state in the plan. |
| Compact actually shrinks AIO / Epics rows | manual UAT | Toggle Settings → Appearance → Compact and confirm row height drops (this is the `min-h` fix). |

### Wave 0 gaps
None — no new test infrastructure needed. The change surface is className strings; existing unit
tests already cover the mechanism, and correctness is visual.

**Regression guard to include in the plan:** every edit must be *additive* (baseline utility class
retained verbatim, density variants appended). Any diff that *changes* an existing non-variant
spacing class is out of scope and should be rejected in review.

---

## 7. Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `components/integrations/AioBlock.tsx` contains density-relevant row/list markup | §3 P0 | Low — implementer sweeps the file; worst case it's N/A. |
| A2 | Comfortable-mode magnitudes ("one step up") are what the user wants for `py-3` baselines (→ `py-4`) | §2 | Low — cosmetic; the existing code has no `py-3` baseline precedent to copy. |
| A3 | Density-switch while a virtualized list is mounted may need `measure()` invalidation | §5 P2 | Medium — untested. Treat as a UAT check on the Sprint Board, not a pre-emptive code change. |
| A4 | Skeleton components can stay density-unaware | §3 N/A | Low — brief geometry mismatch during load only. |

## 8. Open Questions

1. **Should the Card primitive's `--card-spacing` respond to density?**
   - Known: `components/ui/card.tsx` sets `[--card-spacing:--spacing(4)]` inline; a single
     `density-compact:[--card-spacing:--spacing(2)]` would compact every card app-wide.
   - Unclear: whether that counts as the rejected "token-driven" approach.
   - Recommendation: **do not do it.** It is exactly the global-regression risk the LOCKED decision
     names. If dashboard cards feel too airy in compact mode, add variants to the specific card
     *consumers* instead.

2. **Changelog prose in update dialogs (`UpdateDialog`, `WhatsNewDialog`, `UpdatesSection`).**
   - Known: three identical hand-tuned prose override strings in fixed-height scroll boxes.
   - Recommendation: classify N/A and note it in the summary (allowed by the discretion clause),
     or apply the same variants for consistency if the implementer prefers uniformity.

---

## Sources

### Primary (HIGH confidence)
- Direct reads: `taskflow/src/index.css`, `services/theme.ts`, `stores/settings.store.ts`,
  `routes/settings/AppearanceSection.tsx`, `routes/dashboard/WikiRenderer.tsx`,
  `components/ui/card.tsx`, `taskflow/package.json`, plus ~45 route/component files.
- Repo-wide greps for `density-`, `prose`, `min-h`, `useVirtualizer`, `estimateSize`,
  `tiptap|ProseMirror`, `py-[0-9.]+`.
- Local Tailwind `compile()` probe using the project's own `tailwindcss` + `@tailwindcss/typography`
  installs — verified the emitted selectors for `density-compact:prose-p:my-1`,
  `density-compact:[&_p]:my-1`, `density-compact:py-1`.
- `.planning/config.json` (`workflow.nyquist_validation: true`), `.planning/STATE.md`.

### Not used
No external libraries or web sources were needed — this is a closed-world codebase audit against
an already-chosen mechanism.

## Metadata

**Confidence breakdown:**
- Mechanism (§1): HIGH — read from source, no inference.
- Spacing conventions (§2): HIGH — extracted verbatim from all 11 covered files.
- Gap inventory (§3): HIGH for enumerated files (grep-driven); MEDIUM for `AioBlock.tsx` (A1).
- Prose specifics (§4): HIGH — selector output verified by compiling with the project's own toolchain.
- Pitfalls (§5): HIGH for P1/P3/P4/P5/P6/P7; MEDIUM for P2 (virtualizer re-measure is reasoned, untested).

**Research date:** 2026-08-12
**Valid until:** stable — codebase-internal; re-verify only if `index.css` variants or Tailwind
major version change.
