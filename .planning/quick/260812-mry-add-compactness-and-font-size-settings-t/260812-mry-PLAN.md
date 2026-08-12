---
phase: quick-260812-mry
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/services/theme.ts
  - taskflow/src/services/theme.test.ts
  - taskflow/src/index.css
  - taskflow/src/main.tsx
  - taskflow/src/routes/settings/AppearanceSection.tsx
  - taskflow/src/routes/settings/Settings.test.tsx
  - taskflow/src/routes/settings/ConnectionsSection.test.tsx
  - taskflow/src/hooks/useResizable.ts
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/components/app/PinnedTabStrip.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/components/UnifiedFilterBar.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
  - taskflow/src/routes/my-tasks/MyTaskRow.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Settings > Appearance shows a Text Size selector with 4 tiers (S/M/L/XL) beside the existing Display Density selector"
    - "Clicking a Text Size tier instantly rescales text, padding, gaps and icons across the whole app"
    - "Text Size and Display Density persist across app restart and both apply before first paint (no flash, no need to open Settings)"
    - "At XL, sidebar nav labels, the release-detail unified task table and the pinned tab strip scale without clipping or column overflow"
    - "Display Density visibly changes row height on the release detail table, My Tasks rows, story header rows, AIO test run rows and sprint board columns"
    - "The 6 components that already honored density (Sidebar, TaskCard, BacklogRow, TaskRow, MrRow, NotificationRow) are unchanged in density behavior"
  artifacts:
    - path: "taskflow/src/services/theme.ts"
      provides: "applyFontScale() + loadAppearance() pre-paint appliers"
      contains: "export function applyFontScale"
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "FontScale type, fontScale field, setFontScale action, v28 migration"
      contains: "export type FontScale"
    - path: "taskflow/src/index.css"
      provides: "html[data-font-scale] root rem scaling rules"
      contains: "data-font-scale"
    - path: "taskflow/src/routes/settings/AppearanceSection.tsx"
      provides: "Text Size selector UI"
      contains: "setFontScale"
  key_links:
    - from: "taskflow/src/main.tsx"
      to: "loadAppearance"
      via: "Promise.all gate before createRoot().render()"
      pattern: "Promise\\.all\\(\\[[^\\]]*loadAppearance\\(\\)"
    - from: "taskflow/src/services/theme.ts"
      to: "settings.json 'settings-store' zustand blob"
      via: "settingsStore.get<string>('settings-store') + JSON.parse"
      pattern: "get<string>\\('settings-store'\\)"
    - from: "taskflow/src/routes/settings/AppearanceSection.tsx"
      to: "applyFontScale"
      via: "onClick handler + useEffect hydration sync"
      pattern: "applyFontScale\\("
---

<objective>
Add a user-facing Text Size (font scale) setting to Settings > Appearance, applied app-wide via root rem scaling, and extend Display Density coverage to high-traffic surfaces.

Purpose: users can make the whole UI larger or smaller independently of row density. Also fixes a pre-existing bug where persisted density is never applied unless the user visits Settings.
Output: `fontScale` store field + `applyFontScale`/`loadAppearance` in the theme service + CSS root scaling + a Text Size selector, plus a bounded px-to-rem and density-variant sweep across ranked high-traffic surfaces.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260812-mry-add-compactness-and-font-size-settings-t/260812-mry-CONTEXT.md
@.planning/quick/260812-mry-add-compactness-and-font-size-settings-t/260812-mry-RESEARCH.md

@taskflow/src/services/theme.ts
@taskflow/src/routes/settings/AppearanceSection.tsx
</context>

<interfaces>
Contracts introduced by Task 1 and consumed by Tasks 2-3:

- `taskflow/src/stores/settings.store.ts` exports `type FontScale = 'sm' | 'md' | 'lg' | 'xl'`, adds state field `fontScale: FontScale` (initial `'md'`) and action `setFontScale: (s: FontScale) => void`.
- `taskflow/src/services/theme.ts` exports `applyFontScale(scale: FontScale): void` (the `'md'` tier removes the `data-font-scale` attribute) and `loadAppearance(): Promise<void>` (applies density + font scale pre-paint).

Type direction (matches the existing `Density`): `FontScale` is declared and exported from `stores/settings.store.ts` and **type-imported** into `services/theme.ts`. Do NOT export it from `theme.ts` — the store already value-imports `Theme` from `theme.ts`, and reversing the direction would create a cycle.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Font scale foundation — store field, appliers, CSS, pre-paint bootstrap</name>
  <files>taskflow/src/stores/settings.store.ts, taskflow/src/services/theme.ts, taskflow/src/services/theme.test.ts, taskflow/src/index.css, taskflow/src/main.tsx</files>
  <behavior>
    Extend `taskflow/src/services/theme.test.ts` (do not create a new file — it already mocks
    `@tauri-apps/plugin-store` with a closure-scoped Map-backed LazyStore and uses
    `vi.resetModules()` plus a dynamic `await import('./theme')` per test):
    - applyFontScale('xl') sets data-font-scale="xl" on document.documentElement
    - applyFontScale('sm') sets data-font-scale="sm"
    - applyFontScale('md') removes the data-font-scale attribute entirely
    - applyDensity('compact') sets data-density="compact"; applyDensity('default') removes it
      (these density tests are currently missing — add them in the same pass)
    - loadAppearance() with the persisted blob seeded under key `settings-store` as
      JSON.stringify of an object with state.density 'compact' and state.fontScale 'lg'
      applies BOTH data-density="compact" and data-font-scale="lg"
    - loadAppearance() with no persisted blob applies the baseline: neither attribute present
    Seed the blob by importing the mocked `@tauri-apps/plugin-store` AFTER `vi.resetModules()`
    in the same test body and calling `set('settings-store', ...)` on a `new LazyStore('settings.json')`
    before the dynamic `await import('./theme')`, so both share the same factory Map instance.
    Reset in beforeEach by removing both `data-font-scale` and `data-density` from
    document.documentElement, mirroring how the existing block resets the `dark` class.
  </behavior>
  <action>
Implements the CONTEXT decisions "Font size mechanism — root rem scaling" and "Store field naming".

1. `stores/settings.store.ts`:
   - Next to `export type Density` (line ~16) add the `FontScale` union type export.
   - In `initialSettings`, next to `density: 'default' as Density,` (line ~41), add `fontScale: 'md' as FontScale,` so `resetSettings('preferences')` restores it.
   - In the state interface next to the `density: Density;` declaration (~line 114) add a documented `fontScale: FontScale;`, and declare the `setFontScale` action alongside `setDensity`.
   - Next to `setDensity: (d) => set({ density: d }),` (~line 310) add the `setFontScale` implementation.
   - Bump the persist `version` from 27 to 28 and append a `version < 28` branch to `migrate` that defaults `fontScale` to `'md'` when undefined.

2. `services/theme.ts`:
   - Widen the existing type-only import to bring in both `Density` and `FontScale` from `../stores/settings.store`.
   - Add `applyFontScale(scale)`: the `'md'` tier removes `data-font-scale` from `document.documentElement`; any other tier sets it. Mirror the existing `applyDensity` doc-comment style.
   - Add `export async function loadAppearance(): Promise<void>` that reads the persisted Zustand blob from the module-level `settingsStore` LazyStore (already declared at line 13 — no new import) via `get<string>('settings-store')`, `JSON.parse`s it when it is a string (zustand's `createJSONStorage` stores a JSON string, per the note in `lib/tauri-storage.ts:41-50`), then calls `applyDensity` with `state.density` defaulting to `'default'` and `applyFontScale` with `state.fontScale` defaulting to `'md'`. Wrap the whole body in try/catch that falls back to the two baseline values.
   - Do NOT dual-write font scale to a top-level `settings.json` key the way `theme` is — that path creates a second source of truth that `resetSettings` does not clear.

3. `index.css`: inside the existing `@layer base` block, immediately after the `html { @apply font-sans; }` rule (~lines 160-162), add three plain rules setting `font-size` for `html[data-font-scale="sm"]` (87.5%), `html[data-font-scale="lg"]` (112.5%) and `html[data-font-scale="xl"]` (125%). Use percentages, not px, so an OS-level font preference is still respected. The baseline `md` tier needs no rule. Do NOT add an `@theme` token and do NOT add an `@variant` — font scale works by changing the rem basis, not by selector matching. If the rules are ever overridden, hoisting them above the `@layer base` block fixes it (unlayered beats layered in Tailwind v4).

4. `main.tsx` (~lines 709-714): delete the synchronous `applyDensity('default');` call and fold `loadAppearance()` into the existing `Promise.all` gate alongside `loadTheme()` and `initAvatarCache()`. Update the `@/services/theme` import accordingly (drop `applyDensity` if it becomes unused). Rewrite the comment block above it: the current text claims "After hydration, AppearanceSection's useEffect will apply the stored density", which is false on every route where AppearanceSection is not mounted — that is the pre-existing bug being fixed here. The new comment must state that both density and font scale are read from the persisted store and applied before `createRoot().render()`.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/theme.test.ts && npx tsc --noEmit && grep -v '^ *[/*]' src/main.tsx | grep -c "loadAppearance()"</automated>
  </verify>
  <done>`applyFontScale` and `loadAppearance` exist and are covered by tests; `fontScale` is a persisted store field with a v28 migration; `main.tsx` applies both density and font scale inside the pre-render `Promise.all` and no longer hardcodes `applyDensity('default')`; `npx vitest run src/services/theme.test.ts` passes and `tsc --noEmit` is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Text Size selector in Appearance + test mock updates</name>
  <files>taskflow/src/routes/settings/AppearanceSection.tsx, taskflow/src/routes/settings/Settings.test.tsx, taskflow/src/routes/settings/ConnectionsSection.test.tsx</files>
  <behavior>
    In `Settings.test.tsx`, inside the existing Appearance describe block, render `<AppearanceSection />`
    directly (the file already renders `WorkflowSection` bare at ~line 233 — follow that pattern):
    - Clicking the Extra Large Text Size button calls `mockSettingsStore.setFontScale` with `'xl'`
      and the mocked `applyFontScale` with `'xl'`
    - Clicking the Compact density button still calls `setDensity` with `'compact'` (regression
      guard — density behavior is locked and must not change)
    Do NOT assert on `document.documentElement` in this file — the applier is mocked here; DOM
    assertions live in `services/theme.test.ts` from Task 1.
  </behavior>
  <action>
Implements the CONTEXT decision "Control shape — two independent controls".

1. `AppearanceSection.tsx`:
   - Add a `FONT_SCALE_OPTIONS` const mirroring the shape of `DENSITY_OPTIONS`: four tiers `sm`/`md`/`lg`/`xl` with labels "Small", "Default", "Large", "Extra Large" and one-line descriptions. `md` is the baseline tier.
   - Read `fontScale` and `setFontScale` from `useSettingsStore()` alongside the existing `density`/`setDensity` destructure.
   - Add a second `useEffect` keyed on `fontScale` calling `applyFontScale(fontScale)`, mirroring the existing density sync effect at lines 26-28. This is belt-and-braces: `loadAppearance()` already applied it pre-paint from the same source, so it is a no-op in the common case.
   - Render a second control block BELOW the Display Density block, structurally identical: a `text-sm font-medium` label reading "Text Size" plus a `flex gap-2` row of `flex-1` buttons using the exact same `cn(...)` class expression, including the `border-primary bg-accent text-accent-foreground font-semibold` active state and the same `biome-ignore lint/a11y/noLabelWithoutControl` comment on the label.
   - The button `onClick` calls `setFontScale(value)` then `applyFontScale(value)`, mirroring the density handler.
   - Leave the Display Density selector's markup and behavior completely untouched (locked decision: do not rewire or migrate `density`).
   - Update the file's top doc comment to mention the Text Size selector.

2. `Settings.test.tsx`: add `applyFontScale: vi.fn()` to the `@/services/theme` mock factory (~line 84); add a `fontScale` field typed as the 4-tier union with value `'md'` to `mockSettingsStore` next to `density` (~line 93); add `setFontScale: vi.fn()` next to `setDensity` (~line 112).

3. `ConnectionsSection.test.tsx`: this file carries its own duplicate copy of the settings-store mock (~lines 58-80) including `density`/`setDensity`. Add the same `fontScale` field and `setFontScale: vi.fn()` there too — the selector-based mock would otherwise return `undefined` and the component would throw.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/settings && npx tsc --noEmit</automated>
  </verify>
  <done>The Appearance section renders both a Display Density selector (unchanged) and a Text Size selector with 4 tiers; clicking a tier calls `setFontScale` plus `applyFontScale`; all tests under `src/routes/settings` pass.</done>
</task>

<task type="auto">
  <name>Task 3: Bounded px-to-rem scaling sweep + density variant sweep on ranked surfaces</name>
  <files>taskflow/src/hooks/useResizable.ts, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/components/app/PinnedTabStrip.tsx, taskflow/src/components/app/Sidebar.tsx, taskflow/src/components/UnifiedFilterBar.tsx, taskflow/src/routes/dashboard/TaskCard.tsx, taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx, taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx, taskflow/src/routes/my-tasks/MyTaskRow.tsx, taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
Mechanical class-string editing. Every conversion below renders byte-identically at 100% root font size; the only behavior change is that these values now scale with the new Text Size setting.

**Part A — px-to-rem conversions.** Required by the CONTEXT constraint "Fixed px chrome that does not scale is acceptable; text clipping or overflow at xl is not".

- `release-detail/UnifiedTaskTable.tsx` column constants at lines ~72-76: `w-[88px]` becomes `w-[5.5rem]` (COL_KEY), `w-[140px]` becomes `w-[8.75rem]` (COL_PERSON), `w-[96px]` becomes `w-[6rem]` (COL_STATE), `w-[190px]` becomes `w-[11.875rem]` (COL_MR). Also convert every `w-[28px]` in this file to `w-[1.75rem]` (occurrences near lines 128, 238, 382, 385, 406 — grep to find them all). Keep the constants explicitly sized: the file's own header comment records a WebKit/Tauri zero-width-column collapse, so do NOT remove the explicit widths.
- `PinnedTabStrip.tsx`: `w-[110px]` becomes `w-[6.875rem]` (lines ~224, 251, 330) and `max-w-[180px]` becomes `max-w-[11.25rem]` (line ~251).
- `Sidebar.tsx`: (a) add `truncate` to the non-collapsed branch of `labelClass` (line ~238, currently `'hidden md:block'`) so nav labels degrade gracefully instead of overflowing the fixed-width nav. (b) In the `useResizable` call (lines ~87-91) scale the bounds by the live root factor so the user is not locked out of widening at large scales. Compute the factor as `parseFloat(getComputedStyle(document.documentElement).fontSize) / 16` INSIDE the callback — never at module load, or it goes stale when the setting changes. Pass `max` as a function returning `320 * factor`. `min` is currently typed `number` only in `UseResizableOptions` (`hooks/useResizable.ts:6`); widen it to `number | (() => number)` mirroring `max` (line 9), resolve it in the hook body the same way `max` is resolved, and pass `min` as a function returning `160 * factor`. Leave the persisted user width value alone — it is an explicit user choice.
- `issue-detail/AioTestRunsSection.tsx:365`: `min-h-[44px]` becomes `min-h-11` (exactly equal at 100%).

**Part B — bounded `text-[Npx]` conversion, SCOPED to exactly 5 files.**

Convert in ONLY these files: `components/UnifiedFilterBar.tsx`, `routes/dashboard/TaskCard.tsx`, `components/app/Sidebar.tsx`, `components/app/PinnedTabStrip.tsx`, `routes/dashboard/issue-detail/LinkedIssuesSection.tsx` (30 occurrences total, all in high-traffic chrome). Mapping: `text-[9px]` to `text-[0.5625rem]`, `text-[10px]` to `text-[0.625rem]`, `text-[11px]` to `text-[0.6875rem]`.

DEFERRED — do not touch: the remaining ~45 `text-[Npx]` occurrences elsewhere in `src/`, and the deliberate kbd-glyph sizing at `KeyboardShortcutsPanel.tsx:25` (its box and text are both fixed and internally consistent). Do not expand this list.

**Part C — density variant sweep, the ranked 6 targets only.** Per the CONTEXT decision "Density scope — extend to key surfaces (bounded)": this is a bounded sweep, not an app-wide audit. Match the established idiom EXACTLY — vertical padding only, on the row container. Never add density variants to `gap-*`, `px-*`, or `text-*`.

1. `UnifiedTaskTable.tsx:835` (primary task row): `py-1.5` becomes `py-1.5 density-compact:py-1 density-comfortable:py-2.5`.
2. `UnifiedTaskTable.tsx:487` (MR sub-row): `py-1` becomes `py-1 density-compact:py-0.5 density-comfortable:py-2`. Apply the same treatment to the group header strips near lines 376 and 403 so they do not desync from the rows.
3. `my-tasks/MyTaskRow.tsx:253` AND `:310` (two parallel branches of the same row — both must change): `py-1.5` becomes `py-1.5 density-compact:py-1 density-comfortable:py-2.5`.
4. `dashboard/StoryHeaderRow.tsx:102`: `py-2` becomes `py-2 density-compact:py-1 density-comfortable:py-3`.
5. `issue-detail/AioTestRunsSection.tsx:365`: `py-2` becomes `py-2 density-compact:py-1 density-comfortable:py-3` (alongside the `min-h-11` change from Part A).
6. `dashboard/SprintBoardTab.tsx:533` AND `:708` (same column, two render branches — both must change): `p-2` becomes `p-2 density-compact:p-1 density-comfortable:p-3`. This is the one sanctioned deviation from vertical-only, because board columns are 2D and the already-density-aware `TaskCard` sits inside them.

**Explicitly out of scope — do not touch:** `IssueDetailSidebar.tsx:92` and `issue-detail/MetaRow.tsx:3` (field stacks; `space-y` variants are not the established idiom), and the six components that already honor density — `Sidebar.tsx:65`, `TaskCard.tsx:349`, `BacklogRow.tsx:93-204`, `TaskRow.tsx:85`, `MrRow.tsx:41`, `NotificationRow.tsx:204` (locked: do not regress).
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit && npx vitest run && test $(grep -rEoh "text-\[[0-9]+px\]" src/components/UnifiedFilterBar.tsx src/routes/dashboard/TaskCard.tsx src/components/app/Sidebar.tsx src/components/app/PinnedTabStrip.tsx src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx | wc -l | tr -d ' ') -eq 0 && test $(grep -v '^ *[/*]' src/routes/dashboard/release-detail/UnifiedTaskTable.tsx | grep -c "density-compact") -ge 3 && test $(grep -v '^ *[/*]' src/routes/my-tasks/MyTaskRow.tsx | grep -c "density-compact") -eq 2 && test $(grep -v '^ *[/*]' src/routes/dashboard/SprintBoardTab.tsx | grep -c "density-compact") -eq 2 && npx biome lint src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/components/app/Sidebar.tsx src/components/app/PinnedTabStrip.tsx src/hooks/useResizable.ts</automated>
  </verify>
  <done>All listed px constants are rem-based; `useResizable` accepts a function for `min`; the Sidebar scales its resize bounds from the live root font size and truncates nav labels; zero `text-[Npx]` remain in the 5 scoped files; the 6 ranked density targets carry the standard variant idiom; `tsc --noEmit` and the full `vitest run` suite pass with no new biome diagnostics in the touched files.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Text Size setting (S/M/L/XL) and expanded density coverage, both applied app-wide and pre-paint.</what-built>
  <how-to-verify>
1. Run `cd taskflow && npm run tauri dev`.
2. Go to Settings > Appearance. Confirm two selectors: Display Density (3 tiers) and Text Size (4 tiers).
3. Click Text Size > Extra Large. The entire app should scale instantly — text, padding, gaps, icons.
4. While at XL, visit: the sidebar (nav labels must truncate, not overflow or scroll horizontally), a release detail page (unified task table columns must not spill the issue key into the summary), and the pinned tab strip (tab labels sized proportionally).
5. Set Display Density > Compact. Confirm rows tighten on the release detail table, My Tasks, story header rows in Backlog/Sprint Board, AIO test run rows and sprint board columns — and that Sidebar / TaskCard / BacklogRow / TaskRow / MrRow / NotificationRow still behave exactly as before.
6. Pick Compact + Large, fully quit the app, relaunch, and land on any route other than Settings. Both settings must already be applied on first paint with no flash and without opening Settings (this is the pre-existing density bug being fixed).
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` clean
- `cd taskflow && npx vitest run` — full suite green, including new `applyFontScale` / `applyDensity` / `loadAppearance` DOM tests and the new Appearance selector test
- No new biome diagnostics in touched files (baseline drifts — gate on "no NEW files flagged", not an absolute count)
- Human verification checkpoint passed
</verification>

<success_criteria>
- Text Size selector with 4 tiers in Settings > Appearance, live-applying app-wide with no preview pane
- `fontScale` persisted through the existing zustand/Tauri store with a v28 migration and covered by `resetSettings`
- Both density and font scale applied pre-paint from the persisted store in `main.tsx` — no flash, no dependency on AppearanceSection mounting
- No text clipping or horizontal overflow at XL on the Sidebar, unified task table, or pinned tab strip
- Density visibly affects the 6 ranked surfaces; the 6 pre-existing density-aware components are unregressed
- The `text-[Npx]` conversion is limited to the 5 scoped chrome files; the remaining ~45 occurrences app-wide are explicitly deferred
</success_criteria>

<output>
Create `.planning/quick/260812-mry-add-compactness-and-font-size-settings-t/260812-mry-SUMMARY.md` when done
</output>
