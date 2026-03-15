# Architecture Research

**Domain:** UX & Branding additions to Tauri 2 + React 18 desktop app
**Researched:** 2026-03-15
**Confidence:** HIGH — based on direct codebase analysis, not inference

---

## Existing Architecture (Ground Truth)

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  main.tsx — createHashRouter + QueryClientProvider              │
│  AppLayout — owns all global overlay state                      │
│  ┌───────────┐  ┌──────────────────────────────────────────┐    │
│  │  Sidebar  │  │  flex-col wrapper                        │    │
│  │  (w-56)   │  │  ┌────────────────────────────────────┐  │    │
│  │           │  │  │ TopBar (h-12) — Search + Bell      │  │    │
│  │  NavLinks │  │  ├────────────────────────────────────┤  │    │
│  │  +Create  │  │  │ ReAuthBanners (conditional)        │  │    │
│  │  +Settings│  │  ├────────────────────────────────────┤  │    │
│  └───────────┘  │  │ <main> — <Outlet> route content    │  │    │
│                 │  └────────────────────────────────────┘  │    │
│                 └──────────────────────────────────────────┘    │
│                                                                  │
│  Global overlays (z-50, fixed/absolute, rendered by AppLayout): │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │  IssueDetailSheet   │  │  CreateEditIssueModal            │  │
│  └─────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

State Layer
┌──────────────┐  ┌────────────────────┐  ┌──────────────────────┐
│ useAuthStore │  │ useSettingsStore    │  │ useNotificationsStore│
│ auth.json    │  │ settings.json       │  │ notifications.json   │
│ (LazyStore)  │  │ (LazyStore)         │  │ (LazyStore)          │
└──────────────┘  └────────────────────┘  └──────────────────────┘

Data Layer: TanStack Query — all API calls, no per-component polling
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `AppLayout` (main.tsx) | Owns global overlay state, notification polling, custom field discovery | All global `useState` lives here: `selectedIssueKey`, modal open flags |
| `TopBar` | Renders search trigger, bell + badge; zero useQuery calls | Kept query-free for testability — documented design decision |
| `Sidebar` | Role-conditional nav links, Create Issue button | Reads `useSettingsStore` for role + debugMode |
| `IssueDetailSheet` | Global issue detail slide-over | Lifted to AppLayout so search/notifications/all routes share one instance |
| `CreateEditIssueModal` | Global create/edit modal | Same lifting pattern as IssueDetailSheet |
| Zustand stores | Cross-cutting persistent state | LazyStore + createJSONStorage; never raw localStorage |
| `useNotificationPolling` | Single poll coordinator hook called in AppLayout | Separated from TopBar for test isolation |

---

## Feature Integration Analysis

### 1. Command Palette (Cmd+K)

**Integration point:** AppLayout — same level as IssueDetailSheet and CreateEditIssueModal.

**Global keyboard listener placement:** A `useEffect` in AppLayout listens for `keydown` with
`(e.metaKey || e.ctrlKey) && e.key === 'k'`. This is the same pattern SearchOverlay uses for Escape.
The listener belongs in AppLayout so it is always active regardless of which route is mounted. Do NOT
add it in TopBar — TopBar is kept query-free by design and the palette needs QueryClient access.

**State:** A single `commandPaletteOpen: boolean` added to AppLayout local state alongside `selectedIssueKey`.
Pass `onOpenCommandPalette` down to TopBar so a Cmd+K icon in the header can also trigger it.

**Search across data stores and queries:** The palette fans out to multiple sources via a dedicated
`useCommandPaletteSearch(query)` hook:

1. Static nav actions — synchronous, no network (from `command-actions.ts` module)
2. `queryClient.getQueryData(...)` — reads already-cached sprint issues, backlog, epics from TanStack
   Query without firing new fetches
3. Live Jira/GitLab search — reuses `searchJira` and `searchGitLabMRs` services already in
   `SearchOverlay.tsx`; guarded by `enabled: query.length >= 2`

**Action registry pattern:** Define a static array in `src/lib/command-actions.ts`. Each entry has
`id`, `label`, `keywords`, `icon`, `onSelect: () => void`. Nav actions call `navigate(path)`.
Issue actions call `setSelectedIssueKey(key)`. Pass `setSelectedIssueKey` as a prop to `CommandPalette`
(prop-threading — zero createContext/useContext, consistent with entire codebase).

**Result:** `CommandPalette` receives `open`, `onClose`, `onIssueClick` props. Mounted in AppLayout
JSX alongside IssueDetailSheet.

```
AppLayout local state:
  commandPaletteOpen: boolean
  ↓ prop
CommandPalette
  ├── static nav actions (command-actions.ts)
  ├── queryClient.getQueryData cache reads (sync, no network)
  └── useQuery searchJira + searchGitLabMRs (debounced, enabled guard)
        ↓ result selected: onIssueClick
      setSelectedIssueKey (AppLayout) → IssueDetailSheet opens
```

---

### 2. Pinned Issue Tabs

**State management:** New Zustand store — `usePinnedTabsStore`. Persisted via LazyStore +
createJSONStorage, matching the auth/settings/notifications store pattern exactly. Shape:

```typescript
interface PinnedTab {
  key: string;
  summary: string;
  type: string; // 'Story' | 'Subtask' | 'Bug' | 'Epic'
}

interface PinnedTabsState {
  tabs: PinnedTab[];
  pin: (tab: PinnedTab) => void;
  unpin: (key: string) => void;
  reorder: (from: number, to: number) => void;
}
```

Cap at 7 tabs to prevent runaway. Store to `pinned-tabs.json`.

**Tab routing vs modal approach:** Do NOT add new routes. The entire app uses IssueDetailSheet as the
issue viewing mechanism — pinned tab clicks open the existing IssueDetailSheet via `setSelectedIssueKey`.
This is consistent with how search results, notifications, sprint board cards, and backlog all open
issues. Adding `/issues/:key` routes would require replacing IssueDetailSheet with a full-page layout,
which conflicts with the v1.2 decision to lift IssueDetailSheet to AppLayout as the single global entry
point.

**Tab bar placement:** A dedicated `PinnedTabBar` component rendered as a second row below TopBar —
cleaner separation than embedding inside TopBar's single-row layout. `PinnedTabBar` is conditionally
rendered only when `tabs.length > 0` to avoid a visual gap in the header when no tabs exist.

**IssueDetailSheet integration:** No structural changes to IssueDetailSheet. A tab click calls
`onIssueClick(tab.key)` — identical to every other entry point. Pin/unpin actions live in the
IssueDetailSheet header (a pin icon button alongside existing actions). When pinned: call
`usePinnedTabsStore.pin({ key, summary, type })` — the sheet already has the issue data in scope.

**New vs modified:**
- NEW: `src/stores/pinned-tabs.store.ts`
- NEW: `src/components/app/PinnedTabBar.tsx`
- MODIFIED: `TopBar` — pass `onIssueClick` to PinnedTabBar (prop already exists on TopBar)
- MODIFIED: `IssueDetailSheet` — add pin/unpin button in header area
- MODIFIED: `AppLayout` — render PinnedTabBar between TopBar and `<main>`

---

### 3. Multi-Page Settings

**Route structure vs single-page internal nav:** Use single-page internal nav. Do NOT add
`/settings/connections`, `/settings/appearance` etc. to the Hash router.

Rationale: Settings is a single page, not a feature area. Adding child routes requires updating the
router config, Sidebar NavLink active state logic, and back-navigation handling — all for a page whose
sections are small and stable. Internal `useState<SettingsSection>` is simpler and consistent with
how the Dashboard uses internal tab state for its panels.

**Structure:**

```
Settings.tsx
├── SettingsNav (left sidebar strip or top tabs)
│   └── tabs: Connections | Appearance | Notifications | Workflow
└── SettingsContent (renders active section)
    ├── ConnectionsPage  — existing TokenSection content
    ├── AppearancePage   — existing ThemeSection + RoleSection
    ├── NotificationsPage — existing NotificationSettingsSection
    └── WorkflowPage     — existing StaleMrThresholdSection + DebugModeSection
```

The six existing section components (TokenSection, ThemeSection, RoleSection, StaleMrThresholdSection,
NotificationSettingsSection, DebugModeSection) are unchanged — they are promoted into the appropriate
page wrapper. Existing tests for these components require no updates.

**New vs modified:**
- MODIFIED: `Settings.tsx` — add internal `activeSection` state, compose page wrappers, render nav
- NO router changes needed
- NO store changes needed

---

### 4. Keyboard Shortcuts System

**Global vs route-scoped:** Two categories:

1. **Global shortcuts** (always active): Cmd+K (command palette), `?` (help panel), Escape (close
   active overlay). Registered in AppLayout via a `useKeyboardShortcuts(handlers)` hook called
   alongside `useNotificationPolling` and `useCustomFieldDiscovery`.

2. **Route-scoped shortcuts** (active on specific routes only): e.g., `N` to create an issue on
   Sprint Board. Registered in the component owning the route via a local `useEffect` keydown
   listener — not in the global registry.

**Conflict resolution:** The global hook skips when `e.target` is an `INPUT`, `TEXTAREA`, or
`[contenteditable]` element. This prevents `?` or `N` firing while the user types in search or
comment fields. Route-scoped handlers do the same check locally.

**Shortcut registry structure:**

```typescript
// src/lib/keyboard-shortcuts.ts
export interface Shortcut {
  id: string;
  label: string;
  keys: string;          // display string e.g. "Cmd+K" or "?"
  scope: 'global' | string; // string = route path for scoped shortcuts
}

export const SHORTCUTS: Shortcut[] = [
  { id: 'command-palette', label: 'Open command palette', keys: 'Cmd+K', scope: 'global' },
  { id: 'help', label: 'Keyboard shortcuts', keys: '?', scope: 'global' },
];
```

The `?` help panel reads `SHORTCUTS` to render a reference table. It is a Dialog (shadcn/ui) mounted
in AppLayout — one more `useState helpOpen` flag.

**New vs modified:**
- NEW: `src/lib/keyboard-shortcuts.ts` — registry + types
- NEW: `src/hooks/useKeyboardShortcuts.ts` — global keydown listener
- NEW: `src/components/app/ShortcutsHelpPanel.tsx` — `?` dialog
- MODIFIED: `AppLayout` — call `useKeyboardShortcuts`, add `helpOpen` state, mount ShortcutsHelpPanel

---

### 5. Recent Items

**Where to store:** New fields added to `useSettingsStore` — NOT a separate store. Recent items are
a UI preference that belongs with other UI state. The settings store already persists via LazyStore;
a third store file for a 10-item list is unnecessary overhead.

```typescript
// Added to SettingsState in settings.store.ts
interface RecentItem {
  key: string;
  summary: string;
  type: string;
  openedAt: string; // ISO 8601 for ordering
}

recentItems: RecentItem[];            // max 10, front = most recent
addRecentItem: (item: RecentItem) => void;  // push front, dedup by key, trim to 10
clearRecentItems: () => void;
```

**How to update — intercepting issue open events:** The single entry point for opening any issue in
the app is `setSelectedIssueKey` in AppLayout. Wrap it in a handler that also calls `addRecentItem`:

```typescript
// In AppLayout
const handleIssueClick = (key: string) => {
  setSelectedIssueKey(key);
  const cached = queryClient.getQueryData<JiraIssue>(['jira-issue', key]);
  addRecentItem({
    key,
    summary: cached?.fields.summary ?? key,
    type: cached?.fields.issuetype?.name ?? 'Issue',
    openedAt: new Date().toISOString(),
  });
};
```

Pass `handleIssueClick` everywhere `setSelectedIssueKey` is currently threaded (TopBar, Outlet
context, IssueDetailSheet `onOpenIssue`). The summary reads from TanStack Query cache at call time —
no extra network request. Falls back to the key string if not cached.

**UI component:** `RecentItemsPopover` in TopBar — a clock/history icon triggering a Radix Popover
(same pattern as the Bell notification popover). Reads `recentItems` from `useSettingsStore` and calls
`onIssueClick` on selection.

**New vs modified:**
- MODIFIED: `settings.store.ts` — add `recentItems`, `addRecentItem`, `clearRecentItems`
- NEW: `src/components/app/RecentItemsPopover.tsx`
- MODIFIED: `AppLayout` — wrap `setSelectedIssueKey` with `addRecentItem` side effect
- MODIFIED: `TopBar` — add RecentItemsPopover

---

### 6. App Icon

**Tauri 2 icon configuration:** The icon bundle is declared in `src-tauri/tauri.conf.json` under
`bundle.icons`. The current config already lists all five required entries:

```json
"icon": [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico"
]
```

**No `tauri.conf.json` changes needed.** Only the source image files in `src-tauri/icons/` need
replacement.

**Asset requirements:**

| File | Size | Format | Platform Use |
|------|------|--------|-------------|
| `32x32.png` | 32×32 px | PNG | Windows taskbar, small contexts |
| `128x128.png` | 128×128 px | PNG | macOS Dock standard density |
| `128x128@2x.png` | 256×256 px | PNG | macOS Retina (filename convention; actual pixels are 256) |
| `icon.icns` | Multi-res bundle | ICNS | macOS — requires 16, 32, 64, 128, 256, 512, 1024 px layers |
| `icon.ico` | Multi-res bundle | ICO | Windows — requires 16, 32, 48, 256 px layers |

**Recommended workflow:** Create a 1024×1024 px PNG master, then use the Tauri CLI to generate all
required sizes:

```bash
npx tauri icon path/to/icon-master.png
```

This command auto-generates all sizes and formats into `src-tauri/icons/`, overwriting the existing
placeholder files. No manual ICO/ICNS conversion tools needed.

**Square*.png files** in `src-tauri/icons/` (Square107x107Logo.png etc.) are Windows UWP/Store logo
variants. For a portable executable (not a Store app), these are not used by the bundle. The `tauri icon`
command regenerates them automatically alongside the required files.

**New vs modified:**
- REPLACED: all files in `src-tauri/icons/` (same filenames; new artwork source)
- NO code changes

---

## Recommended Build Order

Dependencies drive this order — each step either unblocks the next or is independent:

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1 | App icon | Zero code dependencies; standalone file replacement; ships visual identity first |
| 2 | Multi-page Settings | Self-contained refactor; no new stores; validates internal nav pattern before using it elsewhere |
| 3 | Recent items (store addition) | `useSettingsStore` addition needed before TopBar UI; data layer before UI |
| 4 | Keyboard shortcuts registry | `keyboard-shortcuts.ts` module needed by both command palette (Cmd+K) and help panel (`?`); define once |
| 5 | Command palette | Depends on shortcut registry (step 4); reuses SearchOverlay's `performSearch` logic |
| 6 | Pinned tabs store + PinnedTabBar | Store first, then IssueDetailSheet pin button, then PinnedTabBar UI |
| 7 | RecentItemsPopover | Depends on recent items store (step 3); small self-contained UI |
| 8 | Shortcuts help panel | Depends on registry (step 4); reads static data; can ship with or after command palette |
| 9 | Illustrated empty states + error recovery | Final polish; no store or routing dependencies |

---

## Component Map: New vs Modified

### New Components

| File | Purpose |
|------|---------|
| `src/components/app/CommandPalette.tsx` | Cmd+K overlay; action registry + multi-source search |
| `src/components/app/PinnedTabBar.tsx` | Horizontal tab strip for pinned issues below TopBar |
| `src/components/app/RecentItemsPopover.tsx` | Clock icon popover in TopBar; reads recentItems from settings store |
| `src/components/app/ShortcutsHelpPanel.tsx` | `?` dialog; renders SHORTCUTS registry as reference table |
| `src/hooks/useKeyboardShortcuts.ts` | Global keydown listener; receives handler map from AppLayout |
| `src/lib/keyboard-shortcuts.ts` | Static shortcut registry + Shortcut interface |
| `src/lib/command-actions.ts` | Static nav action definitions for command palette |
| `src/stores/pinned-tabs.store.ts` | Pinned tab Zustand store with LazyStore persistence |

### Modified Components

| File | Change |
|------|--------|
| `src/main.tsx` (AppLayout) | Add `commandPaletteOpen`, `helpOpen` state; call `useKeyboardShortcuts`; wrap `setSelectedIssueKey` to call `addRecentItem`; render CommandPalette, PinnedTabBar, ShortcutsHelpPanel |
| `src/components/app/TopBar.tsx` | Add RecentItemsPopover icon; layout change from `justify-end` to accommodate new icons |
| `src/routes/dashboard/IssueDetailSheet.tsx` | Add pin/unpin icon button in sheet header |
| `src/stores/settings.store.ts` | Add `recentItems: RecentItem[]`, `addRecentItem`, `clearRecentItems` |
| `src/routes/settings/Settings.tsx` | Add internal `activeSection` state + SettingsNav; promote existing sections into page wrappers |

### Unchanged

| File | Reason |
|------|--------|
| `src/components/app/SearchOverlay.tsx` | Command palette can import `performSearch` function or duplicate the pattern; SearchOverlay itself stays unchanged |
| All existing settings section components | Promoted into page wrappers but their internal implementation is unchanged |
| `src/main.tsx` router config | No new routes needed for any v1.3 feature |
| All three existing Zustand stores (auth, notifications) | No changes needed |

---

## Data Flow Changes

### Issue Open Flow (updated with recent items)

```
User action (sprint card / search result / notification / pinned tab / palette result)
    ↓
handleIssueClick(key) in AppLayout
    ├── setSelectedIssueKey(key)
    │       ↓
    │   IssueDetailSheet opens
    └── addRecentItem({ key, summary from cache, type, openedAt })
            ↓
        useSettingsStore.recentItems updated
            ↓
        persisted to settings.json via LazyStore
```

### Command Palette Search Flow

```
User types in CommandPalette input (debounced 300ms)
    ↓
useCommandPaletteSearch(query)
    ├── filter SHORTCUTS + nav actions (sync, no network)
    ├── queryClient.getQueryData(['jira-sprint-issues', ...]) (sync cache read)
    ├── queryClient.getQueryData(['jira-backlog-view', ...]) (sync cache read)
    └── useQuery searchJira + searchGitLabMRs (enabled: query.length >= 2)

User selects a result:
    ├── Issue result → onIssueClick(key) → handleIssueClick in AppLayout
    └── Nav action   → navigate(path) via React Router useNavigate
```

### Pinned Tab Flow

```
User clicks tab in PinnedTabBar
    ↓
onIssueClick(tab.key) → handleIssueClick in AppLayout → IssueDetailSheet opens

User clicks pin icon in IssueDetailSheet header
    ↓
usePinnedTabsStore.pin({ key, summary, type })
    ↓
persisted to pinned-tabs.json via LazyStore
    ↓
PinnedTabBar re-renders with new tab
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Keyboard Listener in TopBar

**What people do:** Add Cmd+K listener to TopBar because that is where the search icon lives.

**Why it's wrong:** TopBar is kept query-free by documented design decision (for test isolation).
Adding a listener that opens a query-dependent overlay means TopBar tests require QueryClientProvider.

**Do this instead:** All global keyboard listeners go in AppLayout via `useKeyboardShortcuts`, same
pattern as `useNotificationPolling` and `useCustomFieldDiscovery`.

---

### Anti-Pattern 2: React Context for Command Palette or Shortcuts State

**What people do:** Create a `CommandPaletteContext` or `KeyboardShortcutsContext` provider.

**Why it's wrong:** The codebase uses zero `createContext`/`useContext` — this is an explicit
architectural decision documented in PROJECT.md key decisions. All cross-cutting state uses Zustand
stores or AppLayout local state with prop threading.

**Do this instead:** AppLayout local state + prop threading for overlay open/close; Zustand for
persisted state (pinned tabs, recent items); static module exports for the registry.

---

### Anti-Pattern 3: Routes for Pinned Tab Navigation

**What people do:** Add `/issues/:key` routes so pinned tabs behave like browser tabs.

**Why it's wrong:** The entire app uses IssueDetailSheet as the issue viewing mechanism. Issue keys
are modal parameters, not route paths. Mixing models requires duplicating issue detail rendering and
breaks the v1.2 architectural decision to lift IssueDetailSheet to a single global instance.

**Do this instead:** Tab click calls `setSelectedIssueKey(key)` — the sheet opens the same way it
does from every other entry point in the app.

---

### Anti-Pattern 4: New API Calls for Command Palette on Every Keystroke

**What people do:** Fire fresh Jira/GitLab queries on each debounce tick for issues, sprint data,
and backlog.

**Why it's wrong:** Issues, sprint data, and backlog are already in the TanStack Query cache from
the active route. Refetching them adds latency and unnecessary API traffic.

**Do this instead:** Read from `queryClient.getQueryData` for cached data (sync, instant). Only fire
new API calls for the live fuzzy text search path that genuinely requires a server query.

---

### Anti-Pattern 5: Settings Sub-Routes in the Hash Router

**What people do:** Add `/settings/connections`, `/settings/appearance` as children in the router config.

**Why it's wrong:** Settings is a single page, not a feature area requiring independent navigation.
Sub-routes add router config changes, sidebar active state updates, and back-navigation handling for
no user benefit — the sections are small and stable.

**Do this instead:** Internal `useState<SettingsSection>` in Settings.tsx. Zero router changes.

---

### Anti-Pattern 6: Separate Store for Recent Items

**What people do:** Create a fourth Zustand store (`recent-items.store.ts`) backed by a new LazyStore
file.

**Why it's wrong:** Recent items are a UI preference — they belong in settings state. Adding a store
for 10 items creates another LazyStore initialization, another persistence file, and another async
hydration cycle for negligible data.

**Do this instead:** Add `recentItems`, `addRecentItem`, and `clearRecentItems` directly to
`useSettingsStore`. Follows the established pattern — no new files, no new async initialization path.

---

## Integration Points Summary

| New Feature | Attaches To | Mechanism |
|-------------|-------------|-----------|
| CommandPalette | AppLayout | `commandPaletteOpen` state + `useKeyboardShortcuts` |
| CommandPalette search | TanStack Query cache | `queryClient.getQueryData` + `useQuery` (same auth pattern as SearchOverlay) |
| PinnedTabBar | AppLayout (below TopBar) | Reads `usePinnedTabsStore`; calls `onIssueClick` |
| Pin/unpin button | IssueDetailSheet header | Calls `usePinnedTabsStore.pin/unpin` |
| RecentItemsPopover | TopBar | Reads `useSettingsStore.recentItems`; calls `onIssueClick` |
| Recent items write | AppLayout | Wrap `setSelectedIssueKey` → call `addRecentItem` with cache lookup |
| Global keyboard shortcuts | AppLayout | `useKeyboardShortcuts` hook; SHORTCUTS registry module |
| ShortcutsHelpPanel | AppLayout | `helpOpen` state; reads SHORTCUTS registry |
| Multi-page Settings | Settings.tsx | Internal `activeSection` state; no router change |
| App icon | `src-tauri/icons/` | File replacement via `npx tauri icon` CLI; no code changes |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| AppLayout as integration point | HIGH | Read main.tsx directly; all global overlays already mounted here |
| Command palette search strategy | HIGH | TanStack Query `getQueryData` is documented API; SearchOverlay pattern already proven |
| Pinned tabs store pattern | HIGH | Matches three existing stores exactly; LazyStore + createJSONStorage is the established pattern |
| Recent items in settings store | HIGH | Settings store already handles multiple preference types; same persistence mechanism |
| Settings internal nav (no router) | HIGH | Current Settings.tsx is a single component; no routing infrastructure to build on |
| Keyboard shortcut placement | HIGH | TopBar query-free constraint is explicit in TopBar.tsx comment |
| App icon asset requirements | HIGH | tauri.conf.json read directly; Tauri 2 icon CLI is documented |

---

## Sources

- Direct codebase analysis: `main.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `SearchOverlay.tsx`,
  `settings.store.ts`, `auth.store.ts`, `notifications.store.ts`, `useNotificationPolling.ts`,
  `Settings.tsx`, `tauri.conf.json`, `src-tauri/icons/` directory listing
- Existing architectural decisions: PROJECT.md key decisions table (prop threading over context;
  zero createContext/useContext; LazyStore + createJSONStorage pattern; createHashRouter)
- Tauri 2 app icon documentation: https://tauri.app/distribute/app-icon/

---

*Architecture research for: Taskflow v1.3 UX & Branding — integration with existing Tauri 2 + React 18 app*
*Researched: 2026-03-15*
