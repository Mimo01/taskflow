# Feature Research — v1.3 UX & Branding

**Domain:** Developer Productivity Desktop App — UX & Branding (Tauri 2 + React 18, shadcn/ui)
**Researched:** 2026-03-15
**Confidence:** HIGH (patterns well-established in Linear/Notion/VS Code; implementation verified against existing codebase)

> This file supersedes the v1.2 FEATURES.md.
> v1.0–v1.2 features are shipped and stable. This file focuses exclusively on the v1.3 UX & Branding features.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any keyboard-first developer tool. Missing these makes the app feel unpolished compared to Linear, Notion, or VS Code — tools the target users use daily.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Command palette opens with Cmd+K | Muscle-memory shortcut in every modern dev tool (Linear, Figma, Notion, VS Code, GitHub); users reach for it automatically | MEDIUM | shadcn/ui ships a `Command` component built on cmdk — no new npm dependency needed; add via `npx shadcn@latest add command` |
| Fuzzy search within command palette | Users don't know exact titles; fuzzy matching removes need for precision | LOW | cmdk's built-in filter handles this; no custom scorer needed at this data scale |
| Command palette covers issues, MRs, and nav actions | Users expect one box, not three; unified access mirrors how Linear's Cmd+K works | MEDIUM | Reuses existing TanStack Query cache (jira-search, gitlab-mrs); groups results by type; cached data only (no live keystroke API calls) |
| Escape closes the palette | Universal dismiss behaviour for overlays | LOW | cmdk handles this natively |
| Arrow key navigation in palette | Keyboard-first flow cannot require mouse after opening | LOW | cmdk handles this natively |
| `?` key opens keyboard shortcut reference panel | Standard in Gmail, Linear, GitHub; developers expect a discoverable cheat sheet | LOW | Simple Dialog/Sheet listing grouped shortcuts; reads from a central shortcut registry |
| Settings split into logical sections with sidebar nav | A single long-scroll page with 6+ sections is hard to navigate; sidebar-per-section is the norm in any mature desktop app (System Preferences, Linear settings, VS Code settings) | MEDIUM | Existing `Settings.tsx` is one long scroll with 6 section components; needs sidebar nav + child routes; existing section components migrate with minimal change |
| Empty states explain what to do | Blank screens with no explanation feel broken; users need contextual guidance (headline + sub-copy + CTA) | LOW | Primarily copy + icon/SVG illustration; no new data fetching logic |
| Error states offer a recovery action | "Something went wrong" with no button is a dead end; retry or reconnect CTA expected | LOW | Retry button + plain-language message; reuses existing loading/error patterns already present on all data views |
| App icon matches product quality | The default Tauri icon undermines trust in a team-facing tool immediately | MEDIUM | Tauri 2 `tauri icon` CLI converts a single 1024×1024 PNG to all platform sizes (icns, ico, png variants); design asset required first |

### Differentiators (Competitive Advantage)

Features that elevate the app from "functional" to "fast and delightful" for developer users. These are what make Taskflow feel like a product, not a prototype.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pinned issue tabs in header | Developers context-switch between 3–5 issues simultaneously; persistent tabs eliminate re-searching and re-opening issue detail — mirrors how Linear handles multi-issue workflows | HIGH | Requires new `usePinnedTabsStore` Zustand slice, TopBar redesign to accommodate tab strip, overflow dropdown for >N tabs, integration with IssueDetailSheet open/close lifecycle |
| Recent items quick-access in header or palette default state | Surfaces last N visited issues without re-opening search; reduces friction for returning to interrupted work — pattern used by Linear (recents in palette), VS Code (recent files in Cmd+P) | MEDIUM | New `useRecentItemsStore` Zustand slice (bounded array, max 15); populated by existing `onIssueClick` in AppLayout — just wraps one call; display in palette default state before user types |
| Global "go to" keyboard shortcuts (G+B = backlog, G+S = sprint board) | Power users bypass menus entirely; mirrors Linear's navigation shortcuts and Gmail's two-key combos; makes the app feel keyboard-native | MEDIUM | `useGlobalShortcuts` hook in AppLayout listening on `document.keydown`; shortcut definitions in a central registry (constants file); same registry feeds `?` help panel |
| J/K keyboard navigation in list views | Developers coming from Vim, Gmail, or Linear expect row navigation without mouse; makes Sprint Board and My Tasks feel fast during standup or triage | MEDIUM | `useKeyboardNav` hook per list view; active row index in local state; Enter opens detail; must handle focus management correctly |
| Illustrated empty states | Monochrome SVG illustrations (Linear's zero-state style) make the app feel intentionally designed rather than abandoned; high perceived quality for low implementation cost | LOW | SVG assets only; no logic change; consistent illustration style across all data views |
| Settings sections deep-linkable | `/settings/connections`, `/settings/notifications` etc. — enables "Go to Connections settings" as a command palette action in a future phase | LOW | Hash router already supports child routes; add routes under `/settings`; minimal extra work during settings restructure |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Customisable keyboard shortcuts | Power-user appeal; "let me remap Cmd+K to something else" | Requires a shortcut registry with conflict detection, persistence, a settings UI section, and migration logic — disproportionate complexity for a small team tool where defaults will be fine | Ship a fixed, well-chosen default set; document them clearly in the `?` panel; revisit only if user feedback is specific and repeated |
| Tab session restore across restarts | "My pinned tabs should survive app quit" | Serialising open issue state to disk and rehydrating on boot adds a persistence + migration concern; issue data may be stale or deleted after a restart | Persist pinned tab keys only (not issue data); on boot, keys remain pinned but detail panel is closed; treat as "favourites not session" — this is already what pinning implies |
| Animated/Lottie illustrated empty states | Higher visual polish; "makes it feel alive" | Lottie in Tauri 2 webview adds bundle weight (~500 KB for lottie-web) and potential rendering variance across platforms; animation may also feel patronising in a focused work tool | Static SVGs — same warmth, zero runtime cost, no cross-platform risk |
| Live API search in command palette (search-as-you-type against Jira) | "Fresher results than the cache" | Adds visible latency on every keystroke; hammers on-premise Jira server; breaks the palette's instant-feel premise | Use TanStack Query cache as the palette data source; add a "Search Jira for X →" tail item that opens the full SearchOverlay for live results — same pattern used by Raycast |
| Tab drag-and-drop reordering in the header strip | "I want to organise my pinned tabs" | DnD on a narrow header tab strip is fiddly (especially in a flex overflow container with @dnd-kit); adds implementation complexity for marginal value; tab strip only holds 4–6 items before overflow | Fixed insertion order: tabs appear in pin chronology; user can unpin and re-pin to reorder — equivalent outcome without DnD complexity |
| Palette frecency ranking (most-used items first) | Makes the palette smarter over time | Requires usage tracking, scoring algorithm, and persistence; adds complexity to what should be a thin search layer | Start with recency (most recently visited first) using the `recentItems` store — already needed for recent items feature; good enough approximation of frecency for this scale |

---

## Feature Dependencies

```
Command Palette (Cmd+K)
    └──reuses──> Existing SearchOverlay query data (jira-search, gitlab-mrs)
    └──uses──> shadcn Command component (add via npx shadcn add command)
    └──reads from──> useRecentItemsStore (default state before typing)
    └──can navigate to──> /settings/connections etc. (requires multi-page settings routes)
    └──can show shortcut hints──> shortcut registry (shares source with ? panel)

Keyboard Shortcuts System
    └──requires──> Central shortcut registry (new constants file: shortcuts.ts)
    └──enhances──> Command Palette (palette shows ⌘K, G+S hints on action items)
    └──feeds──> ? Help Panel (reads from same registry — single source of truth)
    └──lives in──> useGlobalShortcuts hook in AppLayout

? Help Panel
    └──requires──> Shortcut registry (read-only display)
    └──independent of──> command palette (can be built in same phase)

Pinned Issue Tabs
    └──requires──> usePinnedTabsStore (new Zustand slice with persistence)
    └──requires──> TopBar redesign (tab strip replaces icon-only bar)
    └──integrates with──> IssueDetailSheet (tab click opens sheet; close collapses open state, not pin state)
    └──independent of──> command palette (can be built in separate phase)

Recent Items
    └──requires──> useRecentItemsStore (new bounded Zustand slice, max 15)
    └──populated by──> onIssueClick in AppLayout (already exists — wraps one call)
    └──displayed in──> Command Palette default state (before user types)
    └──optionally displayed in──> header dropdown (same phase as TopBar redesign)
    └──depends on──> nothing blocking; can be built before or after palette

Multi-Page Settings
    └──requires──> Settings child routes (/settings/connections, /settings/appearance, /settings/notifications, /settings/workflow)
    └──requires──> Settings sidebar nav component (new)
    └──migrates──> existing Settings.tsx section components into individual route files
    └──enables──> command palette "go to settings" actions (deep-link)
    └──independent of──> all other v1.3 features; good to build early

Empty & Error States
    └──independent of──> all other v1.3 features
    └──applies to──> existing data views (no new components)
    └──requires──> SVG illustration assets per state category (no-data, error, no-results, first-use)

App Icon
    └──requires──> source PNG/SVG design asset (1024×1024)
    └──uses──> tauri icon CLI (built into Tauri 2 toolchain; no new deps)
    └──independent of──> all other features; can be done in any phase
```

### Dependency Notes

- **Command palette should be built after settings routes exist** so "Go to Connections" can be a working palette action from day one. Settings restructure is a natural Phase 1.
- **Pinned tabs are the highest-complexity feature** — they touch TopBar layout, a new store slice, and the IssueDetailSheet open/close contract. Build after TopBar redesign is settled and IssueDetailSheet integration is clear. Natural Phase 3–4.
- **Recent items is a low-risk store addition** — `onIssueClick` already flows through `AppLayout`; wrapping it is one line. The only design decision is where to display recents (palette default state is the right answer). Bundle with the command palette phase.
- **Keyboard shortcut registry and `?` panel are tightly coupled** — define the registry constants first; the panel is just a read-only display grouped by category. Natural same-phase as command palette.
- **Empty/error states are fully independent** — can be done in any phase; good candidate for a standalone polish phase at end of milestone.
- **App icon is fully independent** — depends only on a design asset being ready; can be done in Phase 1 if asset is ready.

---

## Phase Recommendations for v1.3

### Phase 1 — Foundation: Multi-Page Settings + App Icon

Low risk, high readiness. Settings restructure unlocks palette deep-links. App icon has zero code dependencies.

- [ ] App icon: source asset → `tauri icon` CLI → all platform sizes
- [ ] Settings child routes: `/settings/connections`, `/settings/appearance`, `/settings/notifications`, `/settings/workflow`
- [ ] Settings sidebar nav component with active route highlighting
- [ ] Migrate existing 6 section components into their route files
- [ ] Deep-linkable from sidebar and eventually command palette

### Phase 2 — Power Features: Command Palette + Keyboard Shortcuts

Highest-impact phase. Adds keyboard-first power to an app with a lot of data.

- [ ] Add shadcn `Command` component (`npx shadcn add command`)
- [ ] `CommandPalette` component: dialog wrapper, groups (Recent, Issues, MRs, Navigation)
- [ ] Default state: recent items list (before typing)
- [ ] Fuzzy-filtered results: issues + MRs from TanStack Query cache; nav actions as static items
- [ ] "Search Jira for X →" tail item that opens SearchOverlay
- [ ] Keyboard shortcut registry constants file (`shortcuts.ts`)
- [ ] `useGlobalShortcuts` hook in AppLayout (G+S, G+B, G+M, etc.)
- [ ] `?` key → ShortcutsHelpPanel Dialog

### Phase 3 — Recent Items Store

Can be bundled into Phase 2 or done separately. Very low risk.

- [ ] `useRecentItemsStore` Zustand slice (bounded array, persist)
- [ ] Instrument `onIssueClick` in AppLayout to write to store
- [ ] Wire recent items into command palette default state

### Phase 4 — Header Redesign: Pinned Tabs

Highest complexity in the milestone. Build after all other features are stable.

- [ ] `usePinnedTabsStore` Zustand slice (pinned keys array, persist)
- [ ] TopBar redesign: add tab strip; pin/unpin actions from IssueDetailSheet
- [ ] Tab overflow: `+N more` dropdown when tabs exceed container width
- [ ] Tab click → opens IssueDetailSheet for that key
- [ ] Close tab X button: removes from open state; pin remains until explicit unpin

### Phase 5 — Polish: Empty States + Error Recovery

Independent; apply across all existing views.

- [ ] SVG illustration assets: no-data, error, no-results, first-use
- [ ] Consistent `EmptyState` component: illustration + headline + sub-copy + optional CTA
- [ ] Consistent `ErrorState` component: plain-language message + retry/reconnect CTA
- [ ] Apply to: My Tasks, Sprint Board, Backlog, Notifications, Search, Releases, Workload

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| App icon redesign | MEDIUM | LOW | P1 |
| Multi-page Settings with sidebar nav | HIGH | MEDIUM | P1 |
| Command palette (Cmd+K) | HIGH | MEDIUM | P1 |
| Keyboard shortcuts + `?` panel | HIGH | MEDIUM | P1 |
| Actionable error recovery states | HIGH | LOW | P1 |
| Illustrated empty states | MEDIUM | LOW | P1 |
| Recent items (palette default state) | MEDIUM | LOW | P1 |
| Pinned issue tabs in header | HIGH | HIGH | P2 |
| J/K list view navigation | MEDIUM | MEDIUM | P2 |
| Global "go to" shortcuts (G+S, G+B) | MEDIUM | MEDIUM | P2 — bundle with keyboard shortcuts phase |

**Priority key:**
- P1: Must have for v1.3 milestone
- P2: Should have; include if time allows
- P3: Future milestone

---

## Competitor Feature Analysis

| Feature | Linear | Notion | VS Code | Our Approach |
|---------|--------|--------|---------|--------------|
| Command palette | Cmd+K; frecency-ranked; nav + issue actions; instant | Cmd+K; creates blocks + navigates pages | Cmd+Shift+P (actions), Cmd+P (files); extensible | Cmd+K; fuzzy across issues, MRs, nav actions; cached data; "Search Jira for X" tail item |
| Keyboard shortcuts | Comprehensive; G+letter navigation; two-key combos; `?` panel | Partial coverage; `?` panel exists | Full coverage; fully customisable | Fixed set; G+letter navigation; `?` panel; no customisation v1 |
| Pinned/open tabs | Full tab system: pin, drag reorder, overflow; T to search tabs | Page favourites in left sidebar | Editor tabs with pin (prevents auto-close) | Header strip; pin/unpin; overflow dropdown; no drag reorder (v1) |
| Settings structure | Sidebar nav; deeply categorised; keyboard-navigable | Sidebar nav in modal overlay; clean | Sidebar nav in dedicated settings window; search | Sidebar nav; 4 sections: Connections, Appearance, Notifications, Workflow; deep-linkable |
| Recent items | Shown in Cmd+K default state before typing; frecency-ranked | Recent pages listed in sidebar | Recent files as Cmd+P default state | Shown in Cmd+K default state; recency-ordered (not frecency); max 15 items |
| Empty states | Illustrated monochrome SVGs; contextual copy; action CTAs; consistent style | Illustrated; playful; contextual | Minimal; functional welcome screen | Illustrated monochrome SVGs; consistent `EmptyState` component; contextual headline + CTA |
| App icon | Custom mark (triangle-based); consistent on all platforms | Custom N mark; instantly recognisable | Consistent VS Code logo across platforms | New abstract/geometric mark via `tauri icon` CLI; replace default Tauri icon |

---

## Implementation Notes for This Codebase

### shadcn/ui Command Component (cmdk)

The project already uses shadcn/ui with Tailwind v4. The `Command` component is built on cmdk (the same library powering Linear and Raycast). Add it with `npx shadcn@latest add command`. This provides `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandEmpty`, `CommandSeparator`, and `CommandShortcut` — everything needed for a full palette. No new npm packages required beyond what cmdk brings.

### Keyboard Shortcut Registration

For shortcuts that work within the focused Tauri window (all use cases in v1.3), `document.addEventListener('keydown', handler)` inside a `useEffect` in a custom hook is sufficient. `@tauri-apps/plugin-global-shortcut` is only needed for system-wide shortcuts when the window is not focused — not required for v1.3. The hook should live in `AppLayout` after onboarding completes to avoid firing during onboarding.

### Zustand Store Pattern for Pinned Tabs and Recent Items

Follow the existing `notifications.store.ts` pattern exactly: `createJSONStorage(() => localStorage)` with `partialize` to select only the fields that need persistence. Key decisions:
- `pinnedTabs: string[]` — array of issue keys; use `string[]` not `Set` (Set serializes as empty object in JSON persist — documented as a known caveat in PROJECT.md)
- `recentItems: { key: string; title: string; type: 'issue' | 'mr'; timestamp: number }[]` — max 15 items; newest first; deduped on key

### Settings Routes with createHashRouter

The existing `createHashRouter` supports nested children. Add child routes under `/settings` in `main.tsx` with a settings layout component that renders the sidebar nav + `<Outlet />`. Each existing section component (`TokenSection`, `RoleSection`, `ThemeSection`, etc.) moves into its route. Existing `/settings` route becomes a redirect to `/settings/connections`.

### Tauri App Icon

`tauri icon ./path/to/icon.png` (run from `taskflow/src-tauri/`) generates all required platform-specific sizes automatically. Source PNG must be 1024×1024 with transparency. Output goes to `src-tauri/icons/`. No manual resizing or format conversion.

---

## Sources

- [shadcn/ui Command component docs](https://www.shadcn.io/ui/command) — HIGH confidence (official shadcn docs)
- [cmdk GitHub — Fast, unstyled command menu React component](https://github.com/dip/cmdk) — MEDIUM confidence (GitHub; confirmed used by Linear and Raycast)
- [Command Palette UX Patterns — uxpatterns.dev](https://uxpatterns.dev/patterns/advanced/command-palette) — MEDIUM confidence (WebSearch)
- [Maggie Appleton — Command K Bars](https://maggieappleton.com/command-bar) — MEDIUM confidence (well-known UX analysis)
- [Tauri 2 Global Shortcut Plugin (official docs)](https://v2.tauri.app/plugin/global-shortcut/) — HIGH confidence (official Tauri v2 docs)
- [Linear Keyboard Shortcuts Help changelog](https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help) — MEDIUM confidence (official Linear changelog)
- [Linear Personalized Sidebar / Multi-page Settings](https://linear.app/changelog/2024-12-18-personalized-sidebar) — MEDIUM confidence (official Linear changelog)
- [NN/G — Left-Side Vertical Navigation on Desktop](https://www.nngroup.com/articles/vertical-nav/) — HIGH confidence (Nielsen Norman Group)
- [Carbon Design System — Empty States Pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/) — HIGH confidence (IBM design system)
- [PatternFly — Empty State Design Guidelines](https://www.patternfly.org/components/empty-state/design-guidelines/) — HIGH confidence (RedHat design system)
- [Taskflow PROJECT.md (codebase)](/.planning/PROJECT.md) — HIGH confidence (authoritative project spec)
- Codebase inspection: `taskflow/src/main.tsx`, `taskflow/src/components/app/TopBar.tsx`, `taskflow/src/routes/settings/Settings.tsx`

---

*Feature research for: Taskflow v1.3 UX & Branding*
*Researched: 2026-03-15*
