# Project Research Summary

**Project:** Taskflow — v1.3 UX & Branding
**Domain:** UX and branding additions to an existing Tauri 2 + React 19 desktop developer productivity app
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

Taskflow v1.3 is a well-bounded UX and branding milestone layered onto a mature, already-shipped v1.2 codebase. Research was conducted against the actual live codebase — not inference — giving an unusually high confidence baseline. The work involves two new npm packages (`cmdk@^1.1.1`, `react-hotkeys-hook@^5.2.4`), one shadcn code-gen step (`npx shadcn add command`), and a set of component and store additions that follow patterns the codebase has already established. No architectural changes are needed — AppLayout, Zustand LazyStore persistence, TanStack Query cache reads, and prop threading are all the right foundation, and research confirms they extend cleanly to every v1.3 feature.

The recommended delivery order is driven by two hard constraints: the keyboard shortcut registry (`keyboard-shortcuts.ts`) must exist before either the command palette or the help panel can be built, and the Settings restructure should happen before the command palette so "Go to Settings" palette actions work from day one. Everything else (app icon, empty/error states) is fully independent and can slot into any phase. The highest-complexity feature — pinned issue tabs — touches the most files and should come last, after the TopBar layout is settled and the `handleIssueClick` wrapper pattern is proven by the command palette phase.

The critical risk cluster is keyboard event management. Three separate pitfalls converge here: the macOS Cmd+K double-fire bug in shadcn/cmdk (GitHub issue #2469), Escape handler competition across overlays, and the `?` shortcut firing inside text inputs. All three have known, tested solutions — use `react-hotkeys-hook` with `{ capture: true }`, a centralized shortcut hook, and an `isTyping` input guard respectively. The second risk is Zustand store migration: any phase that adds new persisted fields must include a `version` bump and `migrate` function. This is a confirmed production crash pattern from the v1.2 history of this exact codebase (`readIds` on the notifications store).

## Key Findings

### Recommended Stack

The v1.3 feature set requires only two new runtime dependencies on top of an already-complete stack. `cmdk@^1.1.1` (consumed via the shadcn `Command` component code-gen) provides the headless command palette primitive — built-in fuzzy scoring, keyboard navigation, and grouping, production-proven in Linear and Raycast. `react-hotkeys-hook@^5.2.4` provides declarative shortcut binding with the `mod` cross-platform alias (maps to Cmd on macOS, Ctrl on Windows/Linux), scope management, and `enableOnFormTags: false` to block shortcuts inside inputs. Both are React 19 compatible, verified live against the npm registry on 2026-03-15. All other features — recent items, empty/error states, pinned tabs, Settings restructure — use the existing stack with no new packages.

**Core technologies for v1.3:**
- `cmdk@^1.1.1` (via `npx shadcn add command`): command palette primitive — built-in fuzzy search, proven in production by Linear/Raycast, React 19 compatible
- `react-hotkeys-hook@^5.2.4`: declarative keyboard shortcuts — `mod` alias for cross-platform, scope management, form-input guard via `enableOnFormTags`
- `Zustand@^5.0.11` (already installed): state for pinned tabs and recent items — follow existing LazyStore + createJSONStorage pattern exactly
- `TanStack Query` (already installed): command palette reads cache via `queryClient.getQueryData` (sync, no network overhead)
- `@tauri-apps/cli@^2` (already installed): `tauri icon` CLI generates all platform icon variants from one source PNG

**What NOT to add:** kbar (unmaintained ~2 years, no React 19 types), fuse.js (redundant with cmdk's built-in scorer), react-error-boundary (unnecessary in this Tauri desktop context), any Lottie/animation library for empty states (static SVGs are the correct approach — zero runtime cost, consistent with Linear's style).

### Expected Features

Research validated all v1.3 features against Linear, Notion, and VS Code as reference implementations. The feature set breaks cleanly into table stakes (users assume these exist in any keyboard-first dev tool) and competitive differentiators (what makes Taskflow feel like a product rather than a prototype).

**Must have (table stakes):**
- Command palette with Cmd+K — muscle-memory shortcut in every dev tool users touch daily (Linear, Figma, VS Code, GitHub)
- Fuzzy search within palette — users don't know exact titles; must tolerate imprecision; cmdk handles this natively
- `?` key opens keyboard shortcut reference panel — standard in Gmail, Linear, GitHub; developers expect a discoverable cheat sheet
- Settings split into logical sections with sidebar nav — 6+ sections on a single scroll page is unnavigable; sidebar is the norm in mature desktop apps
- Actionable empty states (headline + sub-copy + CTA) — blank screens feel broken, not empty
- Actionable error states (plain-language message + retry CTA) — "something went wrong" with no button is a dead end
- App icon replacing the default Tauri placeholder — the default icon undermines trust in a team-facing tool immediately

**Should have (competitive differentiators):**
- Pinned issue tabs in header — context-switching between 3–5 issues without re-searching mirrors Linear's multi-issue workflow
- Recent items in palette default state — surfaces last-visited issues before the user types (Linear/VS Code pattern)
- Global "go to" keyboard shortcuts (G+S = sprint board, G+B = backlog) — power users bypass menus; makes the app feel keyboard-native
- J/K keyboard navigation in list views — Vim/Gmail/Linear users expect row navigation in Sprint Board and My Tasks
- Illustrated monochrome empty states — same warmth as Linear's zero-state style at zero runtime cost

**Defer to v2+:**
- Customisable keyboard shortcuts — conflict detection + persistence + settings UI is disproportionate complexity; ship a fixed well-chosen default set
- Tab drag-and-drop reordering — DnD on a narrow flex header strip with overflow is fiddly for marginal value; pin chronology order is sufficient
- Live API search in palette on every keystroke — adds latency, hammers on-premise Jira, breaks instant-feel; use cache + "Search Jira for X" tail item (Raycast pattern)
- Palette frecency ranking — recency ordering (already needed for recent items) is a good-enough approximation at this scale
- Tab session restore across restarts — persist pin keys only (not issue data); treat as favourites, not session

### Architecture Approach

Every v1.3 feature integrates through three established patterns the codebase already uses: global overlays mount in AppLayout (same as IssueDetailSheet and CreateEditIssueModal), cross-cutting persistent state lives in Zustand stores with LazyStore + createJSONStorage, and all cross-component wiring uses prop threading with zero `createContext`/`useContext`. The command palette opens from AppLayout state; the keyboard shortcut registry is a static module consumed by both the global shortcuts hook and the help panel; pinned tabs are a new Zustand store following the three existing stores exactly; recent items are added as fields to the existing `settings.store.ts` (not a fourth store); the Settings restructure is internal `useState` nav with no router changes.

**Major new components:**
1. `CommandPalette.tsx` — Cmd+K overlay, multi-source search (cache reads + live query), action registry; mounts in AppLayout alongside IssueDetailSheet
2. `PinnedTabBar.tsx` — horizontal tab strip rendered as a second row below TopBar; conditionally shown when `tabs.length > 0`; reads `usePinnedTabsStore`, calls `onIssueClick`
3. `RecentItemsPopover.tsx` — clock icon in TopBar, reads `useSettingsStore.recentItems`, calls `onIssueClick`
4. `ShortcutsHelpPanel.tsx` — `?` dialog, renders static `SHORTCUTS` registry as grouped reference table
5. `useKeyboardShortcuts.ts` hook — global keydown listener registered in AppLayout; skips when target is INPUT/TEXTAREA/contenteditable
6. `keyboard-shortcuts.ts` — static shortcut registry (single source of truth for both hook registration and help panel rendering)
7. `command-actions.ts` — static nav action definitions for palette
8. `pinned-tabs.store.ts` — new Zustand store with LazyStore persistence; stores `PinnedTab[]` (key + summary + type); cap at 7

**Key modified files:** `AppLayout` (most changes: new state flags, new hooks, new renders), `TopBar` (new icons), `IssueDetailSheet` (pin/unpin button in header), `settings.store.ts` (recentItems fields), `Settings.tsx` (internal section nav)

**Architectural constraints to respect:** No `createContext`/`useContext` anywhere (explicit PROJECT.md decision); no new routes for Settings sub-pages (internal `useState`, not router children); no new routes for pinned tab navigation (tab click calls `setSelectedIssueKey`, not navigate); no keyboard listener in TopBar (TopBar is kept query-free by documented design decision).

### Critical Pitfalls

1. **macOS Cmd+K double-fire (shadcn/cmdk issue #2469)** — window listener and cmdk's internal Dialog listener both respond to the same keydown event, toggling open then closed in one cycle. Use `react-hotkeys-hook` with `"mod+k"` (built-in protection against double-fire) rather than a manual `window.addEventListener`. Verify on a physical macOS device in the production build, not the dev server.

2. **Zustand store `undefined` fields on migration** — adding new top-level keys to `settings.store.ts` or `pinned-tabs.store.ts` leaves them `undefined` (not defaulted) for existing users whose persisted JSON has no such key. Always bump `version` and add a `migrate` function before any component reads a new field. The v1.2 codebase already hit this pattern (`readIds`); it is a confirmed production crash.

3. **Escape/arrow-key handler conflicts across overlays** — SearchOverlay, CommandPalette, ShortcutsHelpPanel, and IssueDetailSheet (shadcn Dialog) all intercept `Escape`. Without centralized priority, the wrong overlay closes. Audit all existing `window.addEventListener('keydown')` calls before adding new handlers; use the single `useKeyboardShortcuts` hook for all global registration.

4. **`?` shortcut fires inside text inputs** — a window keydown handler for `?` fires unconditionally in `QuickCreateInput`, `CommentComposer`, settings form fields. Guard every single-character shortcut: `const isTyping = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable`.

5. **macOS webview cold-launch keyboard events** — on first launch before any user interaction, `Cmd+K` does nothing (WKWebView DOM hasn't received focus — Tauri issue #5464). After `getCurrentWindow().setFocus()` on mount, also call `document.body.focus()` to ensure the DOM is ready to receive keydown events.

6. **Pinned tab stale titles** — never persist issue titles alongside keys in `pinnedTabs` store. Resolve display labels lazily from TanStack Query cache at render time. Storing titles produces stale labels when issues are renamed in Jira.

7. **Tab bar overflow breaks fixed `h-12` header layout** — cap tabs at 5–8 with a `+N` overflow dropdown; test with 8+ pinned issues before shipping; implement overflow handling together with the initial tab bar, never as a follow-up.

## Implications for Roadmap

Based on combined research, the dependency graph produces a clear 5-phase structure. The first two phases are foundational (low risk, unblock later phases). Phases 3–4 deliver the high-value keyboard-first features. Phase 5 is pure polish with zero blocking dependencies.

### Phase 1: Foundation — App Icon + Multi-Page Settings

**Rationale:** App icon has zero code dependencies and ships the product's visual identity first. Settings restructure is a self-contained refactor with no new stores or router changes; it must come before the command palette so "Go to Connections" and other palette actions work from launch. Both are low risk and provide natural validation of small patterns before higher-stakes work begins.

**Delivers:** New app icon across all platforms (macOS Dock, Windows taskbar, system tray) via `tauri icon` CLI; Settings with sidebar nav across 4 sections (Connections, Appearance, Notifications, Workflow); existing 6 section components promoted into page wrappers with internal `activeSection` state in Settings.tsx.

**Addresses:** App icon table stake; multi-page Settings table stake; Settings deep-link prerequisite for command palette

**Avoids:** macOS dock icon oversized (artwork must be ~860×860 on a 1024×1024 canvas before running `tauri icon` — Pitfall 1 from PITFALLS.md); Settings navigation destroying in-progress form state (use internal `useState` nav, not router children — Pitfall 6 and Architecture Anti-Pattern 5)

**Stack needed:** `tauri icon` CLI (already installed); no npm changes

### Phase 2: Keyboard Foundation — Shortcut Registry + Help Panel

**Rationale:** The shortcut registry (`keyboard-shortcuts.ts`) is a pure static module with no UI dependencies. It must exist before both the command palette (Phase 3) and any global shortcut registrations can be written. Building it as an isolated phase forces the registry design to be finalized before consumers are written — a single source of truth for both hook registration and help panel rendering.

**Delivers:** `src/lib/keyboard-shortcuts.ts` registry + `Shortcut` interface; `src/hooks/useKeyboardShortcuts.ts` global keydown listener; `ShortcutsHelpPanel` Dialog mounted in AppLayout; `?` shortcut registered in AppLayout; `helpOpen` state in AppLayout

**Addresses:** `?` help panel table stake; keyboard discoverability; single registration point for all global shortcuts

**Avoids:** Escape handler conflicts — auditing all existing `window.addEventListener('keydown')` calls is the first task of this phase, before any new handlers are added (Pitfall 3); `?` text-input guard must be in the initial implementation (Pitfall 5)

**Stack needed:** `react-hotkeys-hook@^5.2.4` (new install)

### Phase 3: Command Palette + Recent Items

**Rationale:** Depends on the shortcut registry (Phase 2) for `mod+k` registration and on Settings existing (Phase 1) so "Go to Settings" palette actions are working from day one. Recent items store is a same-phase concern — the `useSettingsStore` addition is minimal and the palette needs it for its pre-search default state.

**Delivers:** `CommandPalette.tsx` (Cmd+K, fuzzy search across issues/MRs/nav actions, cache-first, "Search Jira for X" tail item); `recentItems` fields added to `useSettingsStore`; `handleIssueClick` wrapper in AppLayout (wraps `setSelectedIssueKey` to also call `addRecentItem`); `RecentItemsPopover` in TopBar; settings store version bumped with migrate function

**Addresses:** Command palette table stake (highest-impact single feature); recent items differentiator; global G+letter navigation shortcuts (register in same phase via `useKeyboardShortcuts`)

**Avoids:** Cmd+K double-fire — use `react-hotkeys-hook` not manual `window` listener (Pitfall 2); cold-launch webview focus gap — `document.body.focus()` after `getCurrentWindow().setFocus()` on mount (Pitfall 5 / Pitfall 9 from PITFALLS.md); new API calls per keystroke — cache-first via `queryClient.getQueryData`, live search only for text queries ≥2 chars (Architecture Anti-Pattern 4); new React Context for palette state — AppLayout local state + prop threading (Architecture Anti-Pattern 2)

**Stack needed:** `cmdk@^1.1.1` (new install); `npx shadcn add command` (code-gen step)

### Phase 4: Header Redesign — Pinned Issue Tabs

**Rationale:** Highest-complexity feature in the milestone. Touches TopBar layout, a new Zustand store, `IssueDetailSheet` header, and AppLayout render tree. Must be built after `handleIssueClick` wrapper is proven and TopBar icon additions are settled (Phase 3). Building last prevents rework if earlier phases shift TopBar layout assumptions.

**Delivers:** `src/stores/pinned-tabs.store.ts` (new Zustand store with LazyStore persistence; `PinnedTab[]` with key/summary/type; cap at 7); `PinnedTabBar.tsx` rendered as second row below TopBar, conditionally shown; pin/unpin button in `IssueDetailSheet` header; `+N` overflow dropdown for tabs beyond display capacity

**Addresses:** Pinned tabs differentiator (highest-value P2 feature); J/K list navigation can be added here as route-scoped shortcuts using the established `useKeyboardShortcuts` pattern

**Avoids:** Stale tab titles — store only issue keys; resolve display labels from TanStack Query cache (Pitfall 7); tab bar overflow breaking fixed header layout — implement overflow handling in the same PR as the initial tab bar (Pitfall 8); routes for pinned tab navigation — tab click calls `setSelectedIssueKey`, not `navigate` (Architecture Anti-Pattern 3); `useQuery` per tab on mount — use `queryClient.getQueryData` synchronously for labels

**Stack needed:** No new packages; Zustand + LazyStore pattern (existing)

### Phase 5: Polish — Empty States + Error Recovery

**Rationale:** Fully independent of all other features. No store changes, no routing changes, no new dependencies. An ideal final phase — the app is stable, all views exist, and applying consistent empty/error states is low-risk, high-polish work.

**Delivers:** Consistent `EmptyState` component (illustration + headline + sub-copy + optional CTA) and `ErrorState` component (plain-language message + retry/reconnect CTA) applied across My Tasks, Sprint Board, Backlog, Notifications, Search, Releases, Workload views. SVG illustration assets for 4 categories: no-data, error, no-results, first-use.

**Addresses:** Empty states table stake; error recovery table stake; illustrated empty states differentiator

**Avoids:** Empty states without a primary action — every empty state must include at least one CTA button; illustration is decorative only (UX pitfall from PITFALLS.md)

**Stack needed:** Inline SVG + lucide-react (already installed); no new packages

### Phase Ordering Rationale

- **Settings before command palette:** Hard dependency — palette "Go to X" actions require working Settings navigation
- **Shortcut registry before palette and help panel:** Both consumers read from the same static module; define once, consume everywhere
- **Pinned tabs last:** Touches the most files (TopBar, AppLayout, IssueDetailSheet, new store); other phases must settle TopBar layout and `handleIssueClick` first
- **App icon in Phase 1:** Zero code dependencies; early delivery of visual identity
- **Polish in Phase 5:** No blockers; benefits from the full app being stable and all views existing

### Research Flags

Phases with well-documented patterns (skip deeper research):
- **Phase 1 (Icon + Settings):** Tauri icon CLI is official documented tooling; Settings internal-nav is a straightforward `useState` refactor with no new APIs
- **Phase 2 (Shortcut Registry + Help Panel):** react-hotkeys-hook is well-documented; help panel is a read-only Dialog reading a static module
- **Phase 5 (Empty/Error States):** Established Carbon/PatternFly design system patterns; no integration complexity

Phases requiring care during implementation (not full research, but verify these specific things):
- **Phase 3 (Command Palette):** The macOS Cmd+K double-fire and cold-launch webview focus bugs are not caught by unit tests and require verification on a physical macOS device in the production build before marking the feature complete. Do not ship without this verification step.
- **Phase 4 (Pinned Tabs):** Tab overflow with 8+ pins and the TopBar height contract must be designed upfront, not discovered during review. The store migration pattern must be correct from the first commit — no `undefined` fields in production.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions verified live on 2026-03-15; React 19 peer deps confirmed for both new packages; existing stack (React 19.1, Zustand 5, TanStack Query 5) inspected directly in package.json |
| Features | HIGH | Patterns verified against Linear, Notion, VS Code as primary references; feature list validated against actual codebase capabilities and existing component structure |
| Architecture | HIGH | Based on direct codebase analysis (main.tsx, TopBar.tsx, stores, tauri.conf.json, Settings.tsx, SearchOverlay.tsx), not inference; all integration points confirmed; no assumptions made |
| Pitfalls | HIGH | macOS keyboard bugs traced to specific filed Tauri and shadcn GitHub issues with confirmed fixes; Zustand migration pitfall is a confirmed v1.2 regression in this exact codebase; macOS icon padding is a documented community issue |

**Overall confidence:** HIGH

### Gaps to Address

- **SVG illustration assets:** Research specifies the approach (monochrome geometric SVGs, lucide-react primitives as building blocks, consistent style matching Linear's zero-states) but the actual design assets do not exist yet. Phase 5 is blocked until these assets are created or sourced. This is a design dependency, not a technical unknown.

- **App icon source asset:** The `tauri icon` CLI workflow is fully documented, but the 1024×1024 source PNG must be designed first. Phase 1 icon work is blocked until this asset is ready. The macOS canvas padding requirement (~860×860 artwork on a 1024×1024 canvas) must be applied before running the CLI — this is a design constraint to communicate to whoever creates the asset.

- **J/K list navigation scoping:** The feature is confirmed viable via route-scoped `useKeyboardShortcuts` additions (one hook call per list view). Exact key bindings and focus management behavior within Sprint Board and My Tasks should be reviewed against those components' row/card structure before starting Phase 4. Not a blocker — this is a design confirmation step.

## Sources

### Primary (HIGH confidence)
- Existing Taskflow codebase (`/Users/mimo/Desktop/Tasker/taskflow/src/`) — read directly on 2026-03-15; architecture, existing patterns, actual runtime versions confirmed
- npm registry live queries (2026-03-15) — `cmdk@1.1.1` peer deps (`react: '^18 || ^19'`), `react-hotkeys-hook@5.2.4` peer deps (`react: '>=16.8.0'`) confirmed
- Official Tauri v2 docs (v2.tauri.app) — app icon CLI workflow, asset requirements, global shortcut plugin
- Official shadcn/ui docs (ui.shadcn.com) — Command component, cmdk dependency, CommandDialog installation
- Nielsen Norman Group — left-side vertical navigation on desktop
- Carbon Design System / PatternFly — empty state pattern guidelines

### Secondary (MEDIUM confidence)
- react-hotkeys-hook official docs (react-hotkeys-hook.vercel.app) — hook API, `mod` modifier, scopes, `enableOnFormTags`
- Zustand persist middleware docs (zustand.docs.pmnd.rs) — migration API, `version` + `migrate` pattern
- Linear, Notion, VS Code product analysis — feature comparison for command palette, shortcuts, settings, tabs, empty states
- cmdk GitHub (dip/cmdk) — confirmed used by Linear and Raycast in production
- shadcn/ui issue #2469 — Cmd+K double-fire on macOS (confirmed bug, confirmed fix pattern)

### Tertiary (MEDIUM confidence — GitHub issue trackers)
- tauri-apps/tauri #5464, tauri-apps/tao #208, tauri-apps/tauri #14770 — macOS webview cold-launch keyboard focus
- tauri-apps/tauri discussions #10999 — macOS icon canvas padding requirement
- cmdk issue #266 — React 19 peer dep resolution in v1.0.4+
- shadcn/ui discussion #7743 — keyboard shortcut best practices

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
