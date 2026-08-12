# Quick Task 260812-mry: Compactness + Font Size Settings — Research

**Researched:** 2026-08-12
**Domain:** In-repo execution detail (Tailwind v4 root-rem scaling, Zustand/Tauri hydration, density variants)
**Confidence:** HIGH (all findings read directly from the working tree)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Font size mechanism — root rem scaling.** `data-font-scale` on `<html>`; `sm` 87.5% / baseline 100% (attribute removed) / `lg` 112.5% / `xl` 125%. Mirror the density pattern: default tier removes the attribute.
- **Two independent controls.** Existing Display Density selector untouched; a separate 4-tier Text Size selector (S/M/L/XL, M = baseline) beside it in the same Appearance section. No combined "UI Scale". No migration of `density`.
- **Density scope — bounded sweep.** Extend density variants to high-traffic surfaces (detail panels, tables, headers, board columns). Not an app-wide audit. Do not regress the existing 5 components.
- **Preview — live app-wide.** No preview pane / sample-row component.
- **Fixed px chrome that does not scale is acceptable; text clipping or overflow at `xl` is not.**

### Claude's Discretion
- Tier labels/descriptions for Text Size buttons.
- Which "key surfaces" get density variants within the bounded sweep.
- Whether font scale needs a `useEffect` hydration sync in `AppearanceSection`.
- Store field naming (`fontScale` suggested) and its `Density`-style exported type.

### Deferred Ideas (OUT OF SCOPE)
- None recorded.
</user_constraints>

## Summary

The mechanism works: Tailwind v4's default theme defines `--spacing: 0.25rem` and every `--text-*` token in rem (`node_modules/tailwindcss/theme.css:325,347,349`) [VERIFIED: read from installed package], and `--radius: 0.625rem` (`src/index.css:104`). Scaling `html { font-size }` therefore scales text, padding, gaps, icon boxes (`h-4 w-4`), and radii proportionally. Nothing in `index.css` currently declares a root `font-size` — the only `html` rule is `@apply font-sans` at `src/index.css:160-162` — so there is no conflict to resolve.

Three real risks, in priority order: (1) **the Sidebar clips nav labels at `xl`** because its width is a persisted px value (224) clamped to max 320 and its labels have no `truncate`; (2) **`UnifiedTaskTable`'s px column constants overflow** because they are `whitespace-nowrap` with no overflow guard; (3) **75 arbitrary-px text sizes** (`text-[10px]`, `text-[11px]`, …) stay frozen while everything around them grows. The virtualizers are safe — the only two live ones use `measureElement`.

There is also a pre-existing bug worth fixing in the same pass: **persisted density is never applied unless the user opens Settings.** `main.tsx:713` hardcodes `applyDensity('default')` and the only other caller is `AppearanceSection`'s `useEffect`. Font scale must not inherit this.

**Primary recommendation:** add `applyFontScale()` next to `applyDensity()` in `services/theme.ts`, plus a single `loadAppearance()` that reads the persisted `settings-store` blob directly from the `settings.json` LazyStore and applies **both** density and font scale inside the existing `Promise.all` at `main.tsx:714` — before `createRoot().render()`. Then convert the ~10 px constants listed below to rem.

## Existing Idiom (match exactly)

The density variant idiom is uniform across all 15 existing usages — **vertical padding only, on the row container**:

```
py-2 density-compact:py-1 density-comfortable:py-3
```

(`Sidebar.tsx:65`, `TaskRow.tsx:85`, `TaskCard.tsx:349`, `BacklogRow.tsx:93,104,121,136,148,191,204`, `MrRow.tsx:41`.) The one deviation is `NotificationRow.tsx:204` which starts from `py-2.5` and uses `density-compact:py-2 density-comfortable:py-3`. **Do not** add density variants to `gap-*`, `px-*`, or `text-*` — that is not the established pattern.

Variants are declared at `src/index.css:10-11`:
```css
@variant density-compact (&:is([data-density="compact"] *));
@variant density-comfortable (&:is([data-density="comfortable"] *));
```
Note the descendant form (`[data-density="x"] *`) — a variant on `<html>` itself would not match, but everything in the app is a descendant so this is fine.

---

## 1. Hardcoded px Audit

### BREAKS at `xl` (125%) — must be fixed

| # | Location | Problem | Mitigation |
|---|---|---|---|
| P1 | `components/app/Sidebar.tsx:85-91` + `stores/settings.store.ts:50` (`sidebarWidth: 224`, `min: 160`, `max: 320`) | Nav labels at `Sidebar.tsx:340,357` use `labelClass = 'hidden md:block'` (`Sidebar.tsx:238`) — **no `truncate`, no `min-w-0`**. `NAV_LINK_BASE` is `flex items-center gap-3 px-3` with a `shrink-0` icon. At `xl`, `text-sm` → 17.5px and gap/padding grow; "Merge Requests" / "Standup Notes" exceed 224px. Flex items default to `min-width:auto` so the span will not shrink → horizontal overflow inside `nav.overflow-y-auto` (`Sidebar.tsx:310`), which computes `overflow-x: auto` → clipped/scrolling labels. | Two-part: (a) add `truncate` to `labelClass` so it degrades gracefully instead of overflowing; (b) scale `min`/`max` by the live root factor so the user is not locked out of widening — `const f = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16` then `min: 160*f, max: 320*f`. Leave the persisted user width alone (it is an explicit choice). |
| P2 | `routes/dashboard/release-detail/UnifiedTaskTable.tsx:72-76` — `COL_KEY 'flex-none w-[88px] whitespace-nowrap'`, `COL_PERSON w-[140px]`, `COL_STATE w-[96px]`, `COL_MR w-[190px]`, plus `w-[28px]` at `:128,238,382,385,406` | `text-xs` at `xl` = 15px. `whitespace-nowrap` + `flex-none` + no `overflow-hidden` on `COL_KEY` → a `PROJ-1234` key spills into the summary column. The file's own header comment (`:60-71`) records a WebKit/Tauri zero-width-column collapse, so these must stay explicitly sized — convert, do not remove. | Convert all six constants to rem at the same visual value: `88px→5.5rem`, `140px→8.75rem`, `96px→6rem`, `190px→11.875rem`, `28px→1.75rem`. Byte-identical rendering at 100%, scales at every tier. |
| P3 | `components/app/PinnedTabStrip.tsx:224,251,330` — `w-[110px]`, `max-w-[180px]`, `h-9` | Tab labels truncate harder at `xl` while the strip row (`h-9`, rem) grows — the label box stays 110/180px. Visible mismatch, not overflow. | `110px→6.875rem`, `180px→11.25rem`. |
| P4 | 75 occurrences of `text-[Npx]` across the app (`grep -rEn "text-\[[0-9]+px\]" src` → 75). Densest: `UnifiedFilterBar.tsx:84,320,442,459,478,530,579,596`; `TaskCard.tsx:185,210,226,236`; `Sidebar.tsx:301,314`; `LinkedIssuesSection.tsx:39,53`. | These micro-labels stay frozen at 8–11px while adjacent `text-xs` grows to 15px. At `xl` the size relationship inverts visually and the app looks broken rather than scaled. | Mechanical conversion to rem: `text-[8px]→text-[0.5rem]`, `[9px]→[0.5625rem]`, `[10px]→[0.625rem]`, `[11px]→[0.6875rem]`. Zero visual change at 100%. This is the single highest-volume change — worth its own task; scope it to the ~20 in high-traffic chrome (`UnifiedFilterBar`, `TaskCard`, `Sidebar`, `PinnedTabStrip`) if the full 75 is too much. |

### ACCEPTABLE fixed chrome — no action

| Location | Why it's fine |
|---|---|
| `hooks/useResizable.ts` consumers: `IssueDetailView.tsx:346-349`, `ReleaseDetailPage.tsx:138-141`, `MergeRequestDetailPage.tsx:76-79` | All use `min: 240, max: () => container.offsetWidth * 0.5` — container-relative max, and the panel content is a `space-y-4` stack (`IssueDetailSidebar.tsx:92`) with a `w-28` (rem) label column (`issue-detail/MetaRow.tsx:4`). Reflows, does not clip. `mrDetailPanelWidth`/`releaseDetailPanelWidth` default 288 is a starting value the user can drag. |
| `components/app/PeekPanel.tsx:62-65` (`min: 360, max: 720`) | Wide enough headroom at `xl`. |
| Scroll containers: `CommandPalette.tsx:308 max-h-[300px]`, `RecentItemsPopover.tsx:171 max-h-[420px]`, `NotificationPopover.tsx:148 max-h-[520px]` | Fewer rows visible; no clipping. |
| Textarea floors: `min-h-[80px]` / `min-h-[120px]` / `min-h-[60px]` (`CommentComposer.tsx:226`, `DescriptionEditor.tsx:98`, `InlineComment.tsx:250`, `IssueDetailView.tsx:830`, `LogWorkPopover.tsx:148`, `CreateEpicDialog.tsx:76`) | `min-h` is a floor, content grows past it. |
| `KeyboardShortcutsPanel.tsx:25` kbd chip (`min-w-[24px] h-[22px] text-[11px]`) | Box and text are both fixed → internally consistent. Deliberate kbd-glyph sizing. |
| `SprintBoardTab.tsx:183,533,708` `min-h-[80px]` drop zones | Floors on flex columns. |
| `AioCycleDetailPage.tsx:1217,1228` (`min-w-[860px]` table) | Produces horizontal scroll, which the table already expects. |
| Dialogs `w-[860px]` (`BulkCreateSubtasksModal.tsx:603`), `w-[680px]` (`create-edit-issue/CreateEditIssueModal.tsx:190`) | Fixed-width modals get denser at `xl` but both are `max-h-[8Xvh] overflow-y-auto` form stacks that reflow vertically. Watch during UAT; not a code change up front. |
| `max-w-[120px]` / `max-w-[150px]` truncating chips (`UnifiedFilterBar`, `MyTaskRow.tsx:104`, `StoryHeaderRow.tsx:158`, `ReleasesTab.tsx:505-532`, `AttachmentFileRow.tsx:39`) | Already `truncate` — degrade gracefully by design. |

### Virtualizers — NO RISK [VERIFIED: read source]

- `routes/notifications/NotificationPopover.tsx:128-143` — `estimateSize: () => 64` but rows are attached to `rowVirtualizer.measureElement` (`:163`) with a stable `getItemKey`. Dynamic measurement → self-corrects at any font scale.
- `routes/dashboard/SprintBoardTab.tsx:277-290` — `estimateSize: () => 120`, `measureElement` passed into `renderSwimlane` at `:631`. Same — self-corrects.
- `routes/dashboard/BacklogPage.tsx:145-156` — **dead code.** `const useVirtual = false;` at `:156` with the comment "Disable virtualization for table rows — position: absolute on `<tr>` is undefined behavior". The virtualizer is instantiated but never drives layout. `BacklogRow` sizing uses `w-24 / w-14 / w-10 / max-w-[20rem]` — all rem. **No px column-sizing risk in the Backlog table**, contrary to the CONTEXT.md hypothesis.

### Tauri window — NO RISK

`src-tauri/tauri.conf.json:16-17` declares `width: 1100, height: 750` with **no `minWidth`/`minHeight`**. Nothing constrains the layout floor.

---

## 2. Flash-of-Wrong-Scale

### Actual ordering today

`src/main.tsx:713-722`:
```
applyDensity('default');                       // synchronous, hardcoded literal
Promise.all([loadTheme(), initAvatarCache()])  // loadTheme reads settings.json['theme']
  .then(() => createRoot(...).render(...));
```

Key mechanics [VERIFIED: read source]:
- `loadTheme()` (`services/theme.ts:55-58`) reads the **top-level `theme` key** of `settings.json` via its own `LazyStore` — *not* the Zustand blob. `ThemeSection.tsx:22-26` writes both (`setTheme` → store, `saveTheme` → top-level key). Theme is dual-written on purpose so it can be read pre-render.
- Zustand persist writes the whole state as a **JSON-encoded string** under the key `settings-store` (`stores/settings.store.ts:354`, `lib/tauri-storage.ts:6-19`). The gotcha is documented at `lib/tauri-storage.ts:41-50`: `createJSONStorage` stringifies before `setItem`, so the stored value is a string, not an object.
- Zustand rehydration is async and fire-and-forget; the store's initial render value is `initialSettings` (`density: 'default'`), so `AppearanceSection`'s `useEffect` (`AppearanceSection.tsx:26-28`) is what eventually reconciles the DOM attribute.

### The pre-existing bug

`applyDensity` has exactly two call sites: the hardcoded `'default'` in `main.tsx:713` and `AppearanceSection`'s effect. **If a user picks Compact and restarts without visiting Settings, the app renders at default density.** The comment at `main.tsx:710-712` asserts "After hydration, AppearanceSection's useEffect will apply the stored density" — that only holds if AppearanceSection is mounted, which it is not on any other route.

### Recommendation (concrete)

Add to `services/theme.ts`:

```ts
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';

export function applyFontScale(scale: FontScale): void {
  if (scale === 'md') document.documentElement.removeAttribute('data-font-scale');
  else document.documentElement.setAttribute('data-font-scale', scale);
}

/** Read the persisted Zustand blob and apply density + font scale before first paint. */
export async function loadAppearance(): Promise<void> {
  try {
    const raw = await settingsStore.get<string>('settings-store');
    const parsed = typeof raw === 'string'
      ? (JSON.parse(raw) as { state?: { density?: Density; fontScale?: FontScale } })
      : null;
    applyDensity(parsed?.state?.density ?? 'default');
    applyFontScale(parsed?.state?.fontScale ?? 'md');
  } catch {
    applyDensity('default');
    applyFontScale('md');
  }
}
```
(`settingsStore` is the module-level `LazyStore('settings.json')` already at `services/theme.ts:13` — same file, so no new import.)

Then in `main.tsx`, replace line 713 and fold into the existing gate:
```ts
Promise.all([loadTheme(), loadAppearance(), initAvatarCache().catch(() => {})]).then(() => { ... });
```

This is genuinely pre-paint (render is inside `.then`), fixes the density bug, and avoids adding a second dual-write path like theme's.

**Still add the `useEffect` sync in `AppearanceSection`** mirroring `:26-28` — it is cheap, keeps the two controls symmetric, and covers the case where rehydration completes after `loadAppearance()` has already read the file (both read the same source, so they agree; the effect is a belt-and-braces no-op).

---

## 3. Density Sweep — Ranked Shortlist (6 targets)

Each is a row/cell container currently using static `py-*`. Apply the exact idiom `py-N density-compact:py-{N-1} density-comfortable:py-{N+1}`.

| Rank | File:line | Current class | Change | Why |
|---|---|---|---|---|
| 1 | `routes/dashboard/release-detail/UnifiedTaskTable.tsx:835` | `... text-sm py-1.5 hover:bg-muted/40` (primary task row) | `py-1.5 density-compact:py-1 density-comfortable:py-2.5` | Highest-density table in the app; the release detail page is a daily surface. |
| 2 | `routes/dashboard/release-detail/UnifiedTaskTable.tsx:487` | `group/row pl-4 ... text-xs py-1` (secondary MR sub-row) | `py-1 density-compact:py-0.5 density-comfortable:py-2` | Same table; must move with the primary row or the two desync. Also `:376`, `:403` (group header strips) for consistency. |
| 3 | `routes/my-tasks/MyTaskRow.tsx:253` and `:310` | `flex items-center gap-2 px-2 py-1.5 rounded-md ...` (two variants of the same row) | `py-1.5 density-compact:py-1 density-comfortable:py-2.5` | My Tasks is a top-level nav destination and a pure list. **Both lines** — they are parallel branches of one row. |
| 4 | `routes/dashboard/StoryHeaderRow.tsx:102` | `flex items-center gap-2 px-3 py-2 transition-colors border-b` | `py-2 density-compact:py-1 density-comfortable:py-3` | Sits directly above `BacklogRow` (already density-aware) in Backlog/Sprint Board — currently visibly out of step with the rows it heads. Highest "looks broken today" payoff. |
| 5 | `routes/dashboard/issue-detail/AioTestRunsSection.tsx:365` | `flex items-center gap-2 min-h-[44px] px-4 py-2 hover:bg-muted/30` | `py-2 density-compact:py-1 density-comfortable:py-3` **and** `min-h-[44px]` → `min-h-11` | Two-for-one: fixes a px floor that would defeat compact mode *and* an px value that won't scale. `44px` == `min-h-11` exactly. |
| 6 | `routes/dashboard/SprintBoardTab.tsx:533` and `:708` | `flex-1 min-w-0 min-h-[80px] flex flex-col gap-1.5 p-2 border-l ...` (board columns) | `p-2 density-compact:p-1 density-comfortable:p-3` | The only sanctioned deviation from "vertical only" — board columns are 2D and `TaskCard` (already density-aware) sits inside. Both lines are the same column, rendered in two branches. Rank last: highest visual-regression risk of the six. |

**Explicitly out of the sweep** (avoid scope creep): `IssueDetailSidebar.tsx:92` (`space-y-4`) and `issue-detail/MetaRow.tsx:3` — these are field stacks, not rows; `space-y` variants are not in the established idiom.

**Do not touch:** `Sidebar.tsx:65`, `TaskCard.tsx:349`, `BacklogRow.tsx:93-204`, `TaskRow.tsx:85`, `MrRow.tsx:41`, `NotificationRow.tsx:204` (locked: do not regress).

---

## 4. Tailwind v4 Specifics

**Confirmed rem-based tokens** [VERIFIED: `node_modules/tailwindcss/theme.css`]:
- `--spacing: 0.25rem` (line 325) — every `p-*`/`m-*`/`gap-*`/`w-*`/`h-*` numeric utility is `calc(var(--spacing) * N)`.
- `--text-xs: 0.75rem` (347), `--text-sm: 0.875rem` (349), etc.
- App-local `--radius: 0.625rem` (`src/index.css:104`) and the derived `--radius-sm/md/lg/xl` (`:46-49`) use `calc(var(--radius) ± Npx)` — the px deltas are 2–4px border-radius adjustments, cosmetically irrelevant at any scale. No action.

**No existing root `font-size`** — `src/index.css:160-162` declares only `html { @apply font-sans; }`. No conflict.

**Where to put the CSS.** Do **not** use `@theme` (that block is for design tokens; a `font-size` on `html` is not a token) and do **not** add a `@variant` (font scale needs no variant — it works by changing the rem basis, not by matching selectors). Add a plain rule in the existing `@layer base` block, immediately after the `html { @apply font-sans }` rule at `src/index.css:162`:

```css
html[data-font-scale="sm"] { font-size: 87.5%; }
html[data-font-scale="lg"] { font-size: 112.5%; }
html[data-font-scale="xl"] { font-size: 125%; }
```

Baseline `md` needs no rule (attribute is removed → browser default 16px), matching the density pattern. Use `%` not `px` so an OS-level browser font preference is still respected.

**Caveat:** rules inside `@layer base` have lower precedence than utilities but there is no competing `font-size` utility on `<html>`, so this is safe. If it ever misbehaves, hoist the three rules above the `@layer base` block (unlayered rules beat layered ones in v4's cascade-layer model).

---

## 5. Testing

### What exists

- **`services/theme.test.ts`** — the real DOM-assertion suite. Mocks `@tauri-apps/plugin-store` with an in-memory `Map`-backed `LazyStore` (`:3-15`), uses `vi.resetModules()` + dynamic `await import('./theme')` per test (`:19-24`), and asserts directly on `document.documentElement` (`:26,33,52,72`). **`applyDensity` has zero tests here** — the file only covers `applyTheme`/`loadTheme`.
- **`routes/settings/Settings.test.tsx`** — mocks the whole theme service (`:84-89`: `applyTheme`, `applyDensity`, `saveTheme`) and the whole settings store (`:91-135`, a plain object exposed through a selector-aware `useSettingsStore` mock at `:132-135`). Its Appearance coverage is navigation-only (`:190-196`: click the nav button, assert `section-appearance` is visible). **There is no test that clicks a density button.**

### Pattern to extend

Two additions, in this order:

1. **`services/theme.test.ts`** — add an `applyFontScale` describe block mirroring the `applyTheme` one exactly:
   ```ts
   const { applyFontScale } = await import('./theme');
   applyFontScale('xl');
   expect(document.documentElement.getAttribute('data-font-scale')).toBe('xl');
   applyFontScale('md');
   expect(document.documentElement.hasAttribute('data-font-scale')).toBe(false);
   ```
   Reset in `beforeEach` with `document.documentElement.removeAttribute('data-font-scale')` (the existing block resets the `dark` class the same way at `:19`). **Add the equivalent `applyDensity` tests at the same time** — they are free and currently missing.
   `loadAppearance()` is testable here too: the mock `LazyStore` is a `Map`, so `map.set('settings-store', JSON.stringify({ state: { density: 'compact', fontScale: 'lg' } }))` before importing, then assert both attributes.

2. **`Settings.test.tsx`** — three mock edits, then one test:
   - `:86` mock block → add `applyFontScale: vi.fn()`.
   - `:93` mock store → add `fontScale: 'md' as 'sm' | 'md' | 'lg' | 'xl'`.
   - `:112` → add `setFontScale: vi.fn()`.
   - New test in the Appearance describe: render `<AppearanceSection />` directly (as `WorkflowSection` is rendered bare at `:233`), click the XL button by accessible name, assert `mockSettingsStore.setFontScale` was called with `'xl'` and the mocked `applyFontScale` with `'xl'`. Do **not** assert `document.documentElement` here — the applier is mocked in this file; DOM assertions belong in `theme.test.ts`.

Note `routes/settings/ConnectionsSection.test.tsx:60,73` carries its own copy of the settings-store mock including `density`/`setDensity` — **add `fontScale`/`setFontScale` there too** or the selector-based mock will return `undefined` and the component will throw.

## Pitfalls

1. **Don't dual-write font scale to a top-level `settings.json` key** the way `theme` is (`ThemeSection.tsx:22-26` + `loadTheme`). It works, but it creates a second source of truth that `resetSettings` (`settings.store.ts:334-351`) does not clear. Read the Zustand blob instead.
2. **Bump the persist `version`** past 27 and add a `if (version < 28) { if (s.fontScale === undefined) s.fontScale = 'md'; }` migration (`settings.store.ts:356,463-467`), and add `fontScale: 'md' as FontScale` to `initialSettings` (`:20-69`) so `resetSettings('preferences')` restores it.
3. **`FontScale` type placement.** `Density` is exported from `stores/settings.store.ts:16` and imported *into* `services/theme.ts:11`. Follow that direction exactly for `FontScale` — do not export it from `theme.ts`, or you create an import cycle (the store already imports `Theme` from `theme.ts`, so a reverse type import is fine, but a value import would not be).
4. **The `@variant` selectors are descendant-scoped** (`[data-density="x"] *`). If any sweep target is `<html>` or `<body>` itself, the variant will not fire. All six shortlist targets are deep descendants — safe.
5. **`getComputedStyle(document.documentElement).fontSize` in the Sidebar min/max fix** must be read at drag time, not at module load, or it will be stale after the user changes the setting. Compute it inside the `max: () => ...` callback (`useResizable.ts:9` already supports a function for `max`; **`min` is `number` only** — either widen the type to `number | (() => number)` mirroring `max`, or accept a static `min`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `min-h-11` is exactly `44px` in Tailwind v4 (`0.25rem × 11`) | §3 rank 5 | Cosmetic 0–1px shift in one row |
| A2 | `@layer base` precedence is sufficient for the `html[data-font-scale]` rules with no competing utility | §4 | Font scale silently ignored; fallback (hoist above the layer) documented inline |
| A3 | Fixed-width dialogs (`w-[860px]`, `w-[680px]`) reflow acceptably at `xl` | §1 acceptable table | Cramped modal forms — catch at UAT, not a blocker |

## Open Questions

1. **Scope of the `text-[Npx]` conversion (P4).** 75 occurrences is a large mechanical diff for a quick task. Recommendation: convert only the ~20 in high-traffic chrome (`UnifiedFilterBar`, `TaskCard`, `Sidebar`, `PinnedTabStrip`, `LinkedIssuesSection`) and leave the rest; the visual inversion is only noticeable where a `text-[10px]` sits adjacent to scaled text. The planner should make this an explicit bounded task, not "convert all px text sizes".

## Sources

**Primary (HIGH) — all read directly from the working tree at `/Users/mimo/Documents/Projects/taskflow/taskflow`:**
- `node_modules/tailwindcss/theme.css:325,347,349` — rem token confirmation
- `src/index.css`, `src/main.tsx`, `src/services/theme.ts`, `src/stores/settings.store.ts`, `src/lib/tauri-storage.ts`, `src/hooks/useResizable.ts`
- `src/routes/settings/{AppearanceSection,ThemeSection,Settings.test}.tsx`, `src/services/theme.test.ts`
- `src/components/app/{Sidebar,PinnedTabStrip,PeekPanel}.tsx`
- `src/routes/dashboard/{BacklogPage,SprintBoardTab,StoryHeaderRow,IssueDetailView,MergeRequestDetailPage,ReleaseDetailPage}.tsx`, `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx`, `src/routes/notifications/NotificationPopover.tsx`, `src/routes/my-tasks/MyTaskRow.tsx`
- `src-tauri/tauri.conf.json`
- `package.json` — tailwindcss ^4.2.1, vitest ^4.0.18, @tanstack/react-virtual ^3.13.23

**No external packages required.** No Package Legitimacy Audit needed — this task installs nothing.

## Metadata

**Confidence:** HIGH across all sections — every claim was read from source in this session, not recalled.
**Research date:** 2026-08-12
**Valid until:** 30 days (in-repo findings; invalidated by any refactor of `UnifiedTaskTable`, `Sidebar`, or the settings store)
