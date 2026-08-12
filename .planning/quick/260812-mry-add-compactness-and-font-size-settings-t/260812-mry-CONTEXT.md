# Quick Task 260812-mry: Add compactness and font size settings to Appearance section - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Task Boundary

Add a user-facing option to change compactness and the size of fonts / general text content across the app. Settings already has an Appearance section (`src/routes/settings/AppearanceSection.tsx`) — the new control goes there.

**Current state (scouted before discussion):**
- `AppearanceSection.tsx` already renders `<ThemeSection />` + a 3-tier **Display Density** selector (Compact / Default / Comfortable).
- Density persists via `useSettingsStore().density` and applies through `applyDensity()` in `src/services/theme.ts`, which sets/removes `data-density` on `document.documentElement`.
- `src/index.css` declares two Tailwind v4 variants:
  - `@variant density-compact (&:is([data-density="compact"] *));`
  - `@variant density-comfortable (&:is([data-density="comfortable"] *));`
- Density coverage is **thin**: only 15 usages across 5 components — `Sidebar.tsx`, `TaskCard.tsx`, `BacklogRow.tsx`, `TaskRow.tsx`, `MrRow.tsx`, `NotificationRow.tsx`.
- **Font size scaling does not exist at all.**

</domain>

<decisions>
## Implementation Decisions

### Font size mechanism — root rem scaling
Scale the root font size on `<html>` via a `data-font-scale` attribute. Because Tailwind v4 sizing tokens are rem-based, this scales text, padding, gaps, and icon boxes proportionally in one shot.

```css
html[data-font-scale="sm"] { font-size: 87.5%; }  /* 14px */
html                       { font-size: 100%; }   /* 16px baseline */
html[data-font-scale="lg"] { font-size: 112.5%; } /* 18px */
html[data-font-scale="xl"] { font-size: 125%; }   /* 20px */
```

- Mirror the existing density pattern exactly: `'md'`/default tier **removes** the attribute (CSS baseline), other tiers set it.
- Known risk to handle: any hardcoded `px` sizing will NOT scale. Audit for px-sized layout constants that would visually break at `xl` — notably persisted panel widths in the settings store (`sidebarWidth: 224`, `issueDetailPanelWidth`, `peekPanelWidth`, `mrDetailPanelWidth: 288`, `releaseDetailPanelWidth: 288`) and the virtualized-table explicit-px column sizing. Fixed px chrome that does not scale is acceptable; **text clipping or overflow at `xl` is not**.

### Control shape — two independent controls
Keep the existing **Display Density** selector untouched in behavior. Add a **separate Text Size** selector beside it in the same Appearance section. Users can mix freely (e.g. compact rows + large text).

- Do NOT collapse density and font size into a single combined "UI Scale" control.
- Do NOT rewire or migrate the existing `density` setting.
- 4 tiers for Text Size: S / M / L / XL, with M as the default/baseline.
- Follow the existing density selector's visual pattern (row of flex-1 buttons, label + description, `border-primary bg-accent` active state) so the two controls read as siblings.

### Density scope — extend to key surfaces (bounded)
Extend density variant coverage beyond the current 5 components to high-traffic surfaces that currently ignore it: detail panels, tables, headers, board columns.

- This is a **bounded sweep**, not an app-wide audit. Pick the highest-traffic surfaces; do not attempt to wire every component.
- Do not regress the 5 components that already honor density.

### Preview — live app-wide, no preview pane
Both selectors apply instantly to the entire app on click. The Settings page itself is the preview. Do not build a dedicated preview card or sample-row component.

### Claude's Discretion
- Exact tier labels/descriptions for the Text Size buttons.
- Precise selection of which "key surfaces" get density variants within the bounded sweep.
- Whether font scale needs a `useEffect` hydration sync in `AppearanceSection` (density has one — mirror it if the same hydration race applies).
- Store field naming (`fontScale` suggested) and its `Density`-style exported type.

</decisions>

<specifics>
## Specific Ideas

Mirror the existing density implementation end-to-end so the two features stay symmetric:

| Concern | Density (existing) | Font scale (new) |
|---|---|---|
| Store field | `density: Density` | `fontScale: FontScale` |
| Type | `'compact' \| 'default' \| 'comfortable'` | 4 tiers, baseline removes attr |
| Applier | `applyDensity()` in `services/theme.ts` | `applyFontScale()` alongside it |
| DOM hook | `data-density` on `documentElement` | `data-font-scale` on `documentElement` |
| Baseline | `'default'` removes the attribute | baseline tier removes the attribute |
| Persistence | zustand persist → Tauri LazyStore | same store, same mechanism |
| Hydration sync | `useEffect` in `AppearanceSection` | mirror if needed |

Apply the scale **before first render** where the theme is loaded (`main.tsx` calls the theme loader) to avoid a flash of wrong scale, consistent with how `loadTheme()` is handled.

`Settings.test.tsx` already covers the Appearance section — extend it rather than creating a parallel test file.

</specifics>

<canonical_refs>
## Canonical References

- Tailwind v4 `@variant` custom variants — the existing `@variant density-*` declarations in `src/index.css:10-11` are the pattern to follow.
- Tauri Store plugin (`@tauri-apps/plugin-store` `LazyStore`) — already wired via `createTauriStorage` in `lib/tauri-storage.ts`.

</canonical_refs>
