# Phase 21: Header Redesign + Pinned Issue Tabs - Research

**Researched:** 2026-03-16
**Domain:** React component architecture, Zustand persistence, keyboard navigation
**Confidence:** HIGH

## Summary

Phase 21 involves three distinct feature areas: (1) TopBar branding redesign with logo and app name, (2) a persistent pinned-tabs strip with Zustand + Tauri Store persistence, and (3) J/K keyboard list navigation across three views. All three build on patterns already established in earlier phases -- the recent-items store provides a direct template for the pinned-tabs store, react-hotkeys-hook is already installed for J/K bindings, and the TopBar/Sidebar components have clear modification points.

The primary technical risks are: stale data when resolving issue titles/type for tab display (must read from react-query cache at render time, never persist titles), managing the focus index for J/K navigation across three different list structures (flat list in Notifications, grouped hierarchy in My Tasks, sectioned table in Backlog), and ensuring the tab strip integrates cleanly between TopBar and the main content area in AppLayout without breaking the existing flex layout.

**Primary recommendation:** Follow the `recent-items.store.ts` pattern exactly for the pinned-tabs store (Zustand persist + LazyStore), store only `string[]` of issue keys, and build a shared `useListNavigation` hook for J/K that accepts a count and an `onSelect` callback to avoid duplicating logic across three views.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Logo + "Taskflow" text moved to the **left side of the TopBar** -- small app icon (20-24px) + text
- Sidebar logo/branding **removed** to avoid duplication -- sidebar keeps nav links only
- TopBar remains within the content column (right of sidebar), not full-width spanning above it
- Tab strip is a **separate row below the top bar** -- not inside the top bar
- **Hidden when no tabs are pinned** -- no empty placeholder; content gets full height
- Each tab shows: **issue type icon + key + truncated summary** (ellipsis at ~20 chars)
- Issue type icons: small colored icons (Bug, Story, Subtask, etc.) before the key
- Each tab has an **x close button** to unpin
- First 7 tabs visible in the strip; **+N badge** at the right end when >7 tabs pinned
- Clicking +N opens a **dropdown/popover** listing overflow tabs
- **No hard cap** on pinned tabs
- **Pin icon button in IssueDetailSheet header** row alongside edit and close buttons
- Visual state: **outline pin icon** (unpinned) -> **filled/solid pin icon** (pinned)
- Clicking a pinned tab opens the **IssueDetailSheet**
- Pinned tabs **persist across app restarts** -- new Zustand persist store (same Tauri Store pattern)
- Store only issue keys (not titles) -- resolve titles from cache at render time
- Must bump store `version` + `migrate` for any new persisted fields
- **Plain J/K keys** (no modifier) -- standard Gmail/Linear/GitHub pattern
- **J = next row, K = previous row, Enter = open detail panel**
- Focus indicator: **subtle background highlight** on the focused row
- **Stop at edges** -- no wrap-around
- **Smooth scroll** focused row into view when off-screen
- **Reset focus on navigation** -- focus clears when leaving the route
- Applies to: My Tasks, Notifications, Backlog list views
- Add J, K, Enter shortcuts to `src/lib/shortcuts.ts` registry

### Claude's Discretion
- Active tab visual treatment (bottom border accent vs background highlight)
- Tab spacing, height, and typography
- Pin icon choice (lucide Pin icon variant)
- Exact focus highlight color for J/K navigation
- How to resolve issue type for tab icons (from cache or stored alongside key)
- Whether to show a brief animation when tab strip appears/disappears

### Deferred Ideas (OUT OF SCOPE)
- Tab drag-and-drop reordering -- HEADER-F1
- Tab session restore with pre-loaded issue data -- HEADER-F2
- J/K navigation in Sprint Board cards -- KEYS-F1

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HEADER-01 | App header redesigned with consistent branding (logo + app name) on all routes | TopBar.tsx modification: add logo + "Taskflow" left-aligned; Sidebar.tsx: remove branding block |
| HEADER-02 | User can pin any open issue to the tab strip from the issue detail panel header | Pin button in IssueDetailContent header row; pinned-tabs store `togglePin(key)` action |
| HEADER-03 | Pinned issue tabs displayed in a tab strip below the top bar | PinnedTabStrip component inserted in AppLayout between TopBar and ReAuthBanner |
| HEADER-04 | User can close a pinned tab by clicking its x button | Each tab renders X button; calls `removePin(key)` on pinned-tabs store |
| HEADER-05 | Pinned tabs persist across app restarts | Zustand persist + Tauri LazyStore pattern (same as recent-items.store.ts) |
| HEADER-06 | Tab strip shows +N overflow when >7 pinned | PinnedTabStrip slices array at 7; renders Popover for overflow |
| HEADER-07 | Clicking a pinned tab opens the issue detail panel | Tab click calls `handleIssueClick(issueKey)` from AppLayout |
| KEYS-04 | J/K navigation in My Tasks list | useListNavigation hook + focus index state in MyTasksTab |
| KEYS-05 | J/K navigation in Notifications list | useListNavigation hook + focus index state in NotificationsPage |
| KEYS-06 | J/K navigation in Backlog list | useListNavigation hook + focus index state in BacklogPage |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^4.x (installed) | Pinned-tabs state management + persistence | Already used for settings, notifications, recent-items, auth stores |
| @tauri-apps/plugin-store | (installed) | LazyStore persistence backend for pinned tabs | Same pattern as settings.store.ts and recent-items.store.ts |
| react-hotkeys-hook | ^5.2.4 (installed) | J/K/Enter keyboard bindings | Already used for Cmd+K, Cmd+/, navigation shortcuts |
| lucide-react | (installed) | Pin icon, X icon for tabs | Already used throughout the app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn Popover | (installed) | +N overflow dropdown | Reuse existing Popover component for overflow tab list |
| @tanstack/react-query | (installed) | Cache-backed title/type resolution for tabs | Read issue data from query cache at render time |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand persist store | localStorage | Would not survive Tauri app updates; LazyStore is the established pattern |
| Inline J/K per component | Shared hook | Hook avoids triplicating identical focus logic |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  stores/
    pinned-tabs.store.ts       # New Zustand persist store (keys-only)
  hooks/
    useListNavigation.ts       # New shared J/K/Enter hook
  components/app/
    PinnedTabStrip.tsx          # New tab strip component
    TopBar.tsx                  # Modified: add branding left side
    Sidebar.tsx                 # Modified: remove branding
  routes/dashboard/
    IssueDetailSheet.tsx        # Modified: pass isPinned + onTogglePin
    IssueDetailContent.tsx      # Modified: add pin button to header row
    MyTasksTab.tsx              # Modified: integrate useListNavigation
    BacklogPage.tsx             # Modified: integrate useListNavigation
  routes/notifications/
    index.tsx                   # Modified: integrate useListNavigation
  lib/
    shortcuts.ts                # Modified: add J, K, Enter entries
```

### Pattern 1: Pinned-Tabs Store (keys-only persistence)
**What:** Zustand store persisting only issue key strings to Tauri LazyStore
**When to use:** For the pinned tabs feature
**Example:**
```typescript
// Source: modeled on existing recent-items.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyStore } from '@tauri-apps/plugin-store';

const tauriStore = new LazyStore('pinned-tabs.json');

const tauriStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    const value = await tauriStore.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await tauriStore.set(name, value);
    await tauriStore.save();
  },
  removeItem: async (name: string): Promise<void> => {
    await tauriStore.delete(name);
    await tauriStore.save();
  },
}));

interface PinnedTabsState {
  pinnedKeys: string[];
  togglePin: (key: string) => void;
  removePin: (key: string) => void;
  isPinned: (key: string) => boolean;
}

export const usePinnedTabsStore = create<PinnedTabsState>()(
  persist(
    (set, get) => ({
      pinnedKeys: [],
      togglePin: (key) =>
        set((s) => {
          if (s.pinnedKeys.includes(key)) {
            return { pinnedKeys: s.pinnedKeys.filter((k) => k !== key) };
          }
          return { pinnedKeys: [...s.pinnedKeys, key] };
        }),
      removePin: (key) =>
        set((s) => ({ pinnedKeys: s.pinnedKeys.filter((k) => k !== key) })),
      isPinned: (key) => get().pinnedKeys.includes(key),
    }),
    {
      name: 'pinned-tabs-store',
      storage: tauriStorage,
      version: 0,
      migrate: (persisted, _version) => persisted as unknown as PinnedTabsState,
    },
  ),
);
```

### Pattern 2: Shared List Navigation Hook
**What:** A reusable hook encapsulating J/K/Enter keyboard navigation with focus index state
**When to use:** In MyTasksTab, NotificationsPage, and BacklogPage
**Example:**
```typescript
// Source: react-hotkeys-hook patterns from Phase 19
import { useState, useEffect, useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface UseListNavigationOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  enabled?: boolean;
}

export function useListNavigation({ itemCount, onSelect, enabled = true }: UseListNavigationOptions) {
  const [focusIndex, setFocusIndex] = useState(-1);
  const focusRef = useRef<HTMLElement | null>(null);

  // Reset focus when item count changes (data reload)
  useEffect(() => {
    setFocusIndex(-1);
  }, [itemCount]);

  // Reset on unmount (route navigation)
  useEffect(() => () => setFocusIndex(-1), []);

  useHotkeys('j', () => {
    setFocusIndex((prev) => {
      const next = Math.min(prev + 1, itemCount - 1);
      return next;
    });
  }, { enabled: enabled && itemCount > 0 });

  useHotkeys('k', () => {
    setFocusIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      return next;
    });
  }, { enabled: enabled && itemCount > 0 });

  useHotkeys('enter', () => {
    if (focusIndex >= 0 && focusIndex < itemCount) {
      onSelect(focusIndex);
    }
  }, { enabled: enabled && focusIndex >= 0 });

  return { focusIndex, setFocusIndex };
}
```

### Pattern 3: Cache-Backed Issue Data Resolution for Tab Display
**What:** Read issue title and type from react-query cache at render time instead of storing them
**When to use:** In PinnedTabStrip to display tab labels
**Example:**
```typescript
// Resolve issue metadata from react-query cache (same pattern as handleIssueClick title resolution)
// Returns { summary, issueTypeName } or undefined if not in cache
function resolveIssueFromCache(queryClient: QueryClient, issueKey: string) {
  // Search jira-issues, jira-backlog-view, jira-issue-detail caches
  // Return { summary, issueTypeName } if found
  // Return undefined if not cached (tab shows key only as fallback)
}
```

### Anti-Patterns to Avoid
- **Storing titles in the pinned-tabs store:** Titles become stale when issues are renamed. Always resolve from cache at render time.
- **Using createContext/useContext:** Project rule -- prop threading only. Pass pinned-tabs callbacks through props from AppLayout.
- **Separate useHotkeys per component for J/K:** Creates three copies of identical logic. Extract to a shared hook.
- **Wrapping tab strip in its own context provider:** Violates the no-context rule. Thread `onIssueClick` and store actions as props.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistence across app restarts | Custom file I/O | Zustand persist + LazyStore | Atomic writes, migration support, established pattern |
| Keyboard shortcut binding | window.addEventListener | react-hotkeys-hook useHotkeys | Input guard (KEYS-07), scope management, cleanup |
| Overflow popover | Custom dropdown | shadcn Popover component | Already installed, accessible, positioned correctly |
| Scroll into view for focused rows | Manual scroll math | Element.scrollIntoView() | Browser-native, handles all edge cases |

**Key insight:** Every building block for this phase already exists in the codebase. The pinned-tabs store is a simplified version of the recent-items store (no timestamps, no title caching). The keyboard hook is the same one used for palette and navigation shortcuts. The overflow popover reuses the same Popover component as notifications and recent items.

## Common Pitfalls

### Pitfall 1: Stale Issue Titles in Tabs
**What goes wrong:** If you persist issue titles alongside keys, tabs show outdated text after an issue is renamed in Jira.
**Why it happens:** Titles change server-side; persisted snapshots become stale between syncs.
**How to avoid:** Store only keys. Resolve titles from `queryClient.getQueriesData()` at render time. Show the key as fallback when the cache miss occurs.
**Warning signs:** Tab shows old title even after a manual refresh updates the issue list.

### Pitfall 2: Focus Index Out of Bounds After Data Reload
**What goes wrong:** J/K focus index points past the end of the list after data refetches reduce the item count.
**Why it happens:** Background polling (`refetchInterval: 60_000`) can shrink the list while user has focus on a later item.
**How to avoid:** Clamp `focusIndex` to `Math.min(focusIndex, itemCount - 1)` in the hook. Reset to -1 when `itemCount` changes.
**Warning signs:** Enter on a focused row after data update opens the wrong issue or crashes.

### Pitfall 3: J/K Firing Inside Text Inputs
**What goes wrong:** Pressing J or K while typing in a comment composer or filter input triggers list navigation.
**Why it happens:** Missing `enableOnFormTags: false` on the hotkey registration.
**How to avoid:** react-hotkeys-hook defaults `enableOnFormTags` to `false` (verified in KEYS-07 decision). Do NOT override it. Just use `useHotkeys('j', ...)` with no extra options.
**Warning signs:** Typing "jira" in a text field causes row focus to jump.

### Pitfall 4: Tab Strip Breaking Flex Layout
**What goes wrong:** Inserting the tab strip between TopBar and main content breaks the `flex-1 overflow-auto` scroll behavior of the main area.
**Why it happens:** An extra flex child without `flex-shrink-0` can collapse or expand unpredictably.
**How to avoid:** Give PinnedTabStrip `flex-shrink-0` (like TopBar). Only render it when `pinnedKeys.length > 0` to avoid an empty placeholder consuming height.
**Warning signs:** Main content area no longer scrolls or has unexpected height.

### Pitfall 5: Backlog J/K Navigation Across Collapsed Sections
**What goes wrong:** Focus index counts items in collapsed sections that are not visible.
**Why it happens:** Backlog has collapsible sprint sections; hidden items should not be navigable.
**How to avoid:** Compute navigable item count from only the visible (filtered + non-collapsed) issues. Build a flat array of visible issue keys that the hook iterates over.
**Warning signs:** J/K skips large gaps or focuses invisible rows.

### Pitfall 6: Multiple Tabs Opening Multiple Detail Sheets
**What goes wrong:** Clicking tabs rapidly could stack multiple IssueDetailSheet opens.
**Why it happens:** Each tab click calls `handleIssueClick` which sets `selectedIssueKey`; fast clicks may cause flicker.
**How to avoid:** `handleIssueClick` already uses `setSelectedIssueKey` (a single state value, not a stack). Clicking another tab simply replaces the key. No extra debounce needed.
**Warning signs:** Sheet flickering between issues on rapid tab clicks.

## Code Examples

### Adding Branding to TopBar
```typescript
// TopBar.tsx -- add left-side branding
// Source: existing TopBar structure
<header className="h-12 border-b flex items-center px-4 flex-shrink-0 gap-2">
  {/* Left: Branding */}
  <div className="flex items-center gap-2 mr-auto">
    <img src="/app-icon.svg" alt="Taskflow" className="w-5 h-5" />
    <span className="text-base font-semibold">Taskflow</span>
  </div>

  {/* Right: existing icons (search, clock, bell) */}
  {/* ... existing buttons unchanged ... */}
</header>
```

### Removing Sidebar Branding
```typescript
// Sidebar.tsx -- remove lines 47-49 (the app name/logo block)
// Before:
<div className="px-4 py-5 border-b border-border">
  <span className="font-bold text-lg hidden md:block">Taskflow</span>
  <span className="font-bold text-lg md:hidden">TF</span>
</div>

// After: removed entirely. Navigation starts immediately.
```

### Tab Strip Integration in AppLayout
```typescript
// main.tsx -- AppLayout return, between TopBar and ReAuthBanner
<TopBar ... />
{pinnedKeys.length > 0 && (
  <PinnedTabStrip
    pinnedKeys={pinnedKeys}
    activeKey={selectedIssueKey}
    onTabClick={handleIssueClick}
    onTabClose={removePin}
  />
)}
{_hasHydrated && !jiraConnected && <ReAuthBanner />}
```

### Pin Button in IssueDetailContent
```typescript
// IssueDetailContent.tsx -- add Pin button alongside Edit and Open in Jira
import { Pin } from 'lucide-react';

// In the action buttons div:
<Button
  variant="outline"
  size="sm"
  onClick={() => onTogglePin?.(issueKey)}
  aria-label={isPinned ? `Unpin issue ${issueKey}` : `Pin issue ${issueKey}`}
  title={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
  className="gap-1.5 text-xs"
>
  <Pin className={cn('size-3.5', isPinned && 'fill-current text-primary')} />
  {isPinned ? 'Unpin' : 'Pin'}
</Button>
```

### Shortcut Registry Additions
```typescript
// shortcuts.ts -- append to SHORTCUTS array
{
  id: 'list-next',
  defaultKey: 'J',
  description: 'Next item',
  category: 'Lists',
},
{
  id: 'list-prev',
  defaultKey: 'K',
  description: 'Previous item',
  category: 'Lists',
},
{
  id: 'list-open',
  defaultKey: 'Enter',
  description: 'Open item',
  category: 'Lists',
},
```

Note: The `ShortcutCategory` type needs to be updated to include `'Lists'` (currently only `'Navigation' | 'Lists' | 'Actions' | 'General'` -- `'Lists'` is already in the union).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global event listeners for keyboard | react-hotkeys-hook with scoped hooks | Phase 19 | Clean cleanup, input guards, testable |
| localStorage for persistence | Zustand persist + Tauri LazyStore | Phase 18 | Survives app updates, atomic writes |
| Context providers for shared state | Prop threading from AppLayout | Project convention | Simpler debugging, explicit data flow |

**Deprecated/outdated:**
- None for this phase. All patterns are current.

## Open Questions

1. **Issue type resolution for tab icons**
   - What we know: `JiraIssue.fields.issuetype.name` gives the type name (Bug, Story, Subtask, etc.). This is available in react-query cache for any fetched issue.
   - What's unclear: Whether to store the issue type name alongside the key in the pinned-tabs store, or resolve it purely from cache.
   - Recommendation: Store only keys per the locked decision. Map issue type names to lucide icons at render time (Bug -> Bug icon, Story -> BookOpen, Subtask -> CornerDownRight, Task -> CheckSquare, Epic -> BookOpen). When cache misses occur, show a generic icon.

2. **Notifications J/K -- what does "Enter opens detail" mean?**
   - What we know: NotificationsPage uses an accordion pattern (click row to expand inline detail). It does not use `onIssueClick` -- it has `handleRowClick(id)` that toggles an expanded state.
   - What's unclear: Should Enter open the inline accordion or open the IssueDetailSheet?
   - Recommendation: Enter should call `handleRowClick(id)` to toggle the accordion (consistent with the existing click behavior). The notification items are not all Jira issues -- some are GitLab MRs -- so IssueDetailSheet is not always applicable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + @testing-library/react (jsdom) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEADER-01 | TopBar shows logo + app name | unit | `cd taskflow && npx vitest run src/components/app/TopBar.test.tsx -x` | Exists (needs update) |
| HEADER-02 | Pin button toggles pinned state | unit | `cd taskflow && npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -x` | Exists (needs update) |
| HEADER-03 | Tab strip renders pinned tabs | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | Wave 0 |
| HEADER-04 | Close button removes tab | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | Wave 0 |
| HEADER-05 | Store persists keys | unit | `cd taskflow && npx vitest run src/stores/pinned-tabs.store.test.ts -x` | Wave 0 |
| HEADER-06 | +N overflow for >7 tabs | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | Wave 0 |
| HEADER-07 | Tab click opens detail panel | unit | `cd taskflow && npx vitest run src/components/app/PinnedTabStrip.test.tsx -x` | Wave 0 |
| KEYS-04 | J/K in My Tasks | unit | `cd taskflow && npx vitest run src/routes/dashboard/MyTasksTab.test.tsx -x` | Exists (needs update) |
| KEYS-05 | J/K in Notifications | unit | `cd taskflow && npx vitest run src/routes/notifications/NotificationsPage.test.tsx -x` | Wave 0 |
| KEYS-06 | J/K in Backlog | unit | `cd taskflow && npx vitest run src/routes/dashboard/BacklogPage.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/pinned-tabs.store.test.ts` -- covers HEADER-05 (persistence)
- [ ] `src/components/app/PinnedTabStrip.test.tsx` -- covers HEADER-03, HEADER-04, HEADER-06, HEADER-07
- [ ] `src/routes/notifications/NotificationsPage.test.tsx` -- covers KEYS-05
- [ ] `src/routes/dashboard/BacklogPage.test.tsx` -- covers KEYS-06 (file may not exist yet)
- [ ] `src/hooks/useListNavigation.test.ts` -- covers shared J/K logic used by KEYS-04/05/06

## Sources

### Primary (HIGH confidence)
- Existing codebase: `recent-items.store.ts` -- direct pattern template for pinned-tabs store
- Existing codebase: `main.tsx` AppLayout -- integration point for tab strip and prop threading
- Existing codebase: `TopBar.tsx`, `Sidebar.tsx` -- branding modification points
- Existing codebase: `IssueDetailContent.tsx` -- pin button insertion point (lines 127-154, action buttons section)
- Existing codebase: `shortcuts.ts` -- registry extension point, `ShortcutCategory` type already includes 'Lists'
- Phase 21 CONTEXT.md -- locked decisions and constraints
- Phase 21 UI-SPEC.md -- visual and interaction contracts

### Secondary (MEDIUM confidence)
- react-hotkeys-hook behavior: `enableOnFormTags: false` default confirmed in KEYS-07 decision from Phase 19

### Tertiary (LOW confidence)
- None. All findings verified against existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in prior phases
- Architecture: HIGH -- all patterns replicate existing codebase conventions
- Pitfalls: HIGH -- identified from actual code structure analysis (flex layout, cache patterns, collapsible sections)

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- no external dependency changes expected)
