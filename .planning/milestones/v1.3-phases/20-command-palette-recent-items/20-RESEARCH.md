# Phase 20: Command Palette + Recent Items - Research

**Researched:** 2026-03-16
**Domain:** Command palette UI (cmdk + shadcn), recent items persistence (Zustand), keyboard shortcuts (react-hotkeys-hook)
**Confidence:** HIGH

## Summary

Phase 20 replaces the existing SearchOverlay with a cmdk-powered command palette (via shadcn's `command` component), adds a recent items tracking store with Tauri Store persistence, and wires navigation shortcuts using the existing react-hotkeys-hook infrastructure. The project already has all foundational dependencies installed (react-hotkeys-hook@5.2.4, Zustand@5.0.11, shadcn@4.0.5) -- the only new install is `npx shadcn add command` which pulls in cmdk@^1.1.1.

The codebase has well-established patterns for every integration point: Zustand persist with Tauri Store backend (settings.store.ts), prop-threaded onIssueClick through AppLayout/TopBar, useHotkeys for global shortcuts (main.tsx), Popover for TopBar popovers (notification popover), and react-query cache access via getQueryData. The palette needs to read cached issues and MRs from the react-query cache for instant fuzzy matching, fire live Jira searches for the tail item, and execute navigation/action commands.

**Primary recommendation:** Use shadcn Command component (wrapping cmdk) with custom backdrop overlay, NOT CommandDialog -- CommandDialog uses Radix Dialog which conflicts with the project's @base-ui/react Dialog and would introduce a second dialog primitive. Build the palette as a controlled component with its own backdrop, matching the existing SearchOverlay pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Command palette replaces SearchOverlay as the single search entry point -- SearchOverlay.tsx, SearchResultPanel.tsx, and their test files are deleted
- Built with cmdk@^1.1.1 + `npx shadcn add command`
- Cmd+K binding uses react-hotkeys-hook (not manual listener) to avoid macOS double-fire bug
- Selecting a Jira issue opens IssueDetailSheet; selecting a GitLab MR opens browser URL
- Both actions close the palette after selection
- Result groups by source type: Issues, Merge Requests, Navigation, Actions
- "Search Jira for X" tail item fires live query inline with loading skeleton
- App actions limited to: Toggle theme, Mark all notifications read
- Default state (<2 chars): Recent Items + Navigation groups
- App actions only appear when user types a matching query
- Recent items track any IssueDetailSheet open and any MR browser open
- Store entries with key/ID only (no cached title) -- fetch title on render
- Persist across app restarts via new Zustand persist store (Tauri Store pattern)
- Cap at 10 most recent items
- Clock icon popover matches notification popover style (w-80, same Popover component)
- Navigation shortcuts: Cmd+Shift+S (Sprint Board), Cmd+Shift+B (Backlog), Cmd+Shift+N (open notification popover)
- No chord/sequence shortcuts -- single modifier+key combos only
- Navigation actions in palette show keyboard shortcut hints right-aligned
- Add all new shortcuts to src/lib/shortcuts.ts

### Claude's Discretion
- Exact cmdk/Command component styling and theming integration
- Loading skeleton design for live Jira search
- Fuzzy matching configuration and scoring
- Recent items store name and internal structure
- How to trigger notification popover open from Cmd+Shift+N (may need lifting popover state)
- Whether to show empty-state text in palette when no recent items exist yet

### Deferred Ideas (OUT OF SCOPE)
- Frecency ranking (PALETTE-F2)
- Customizable keyboard shortcuts UI (PALETTE-F1 / KEYS-F1)
- Create issue from palette (deferred from PALETTE-04)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PALETTE-01 | Cmd+K / Ctrl+K opens palette from anywhere | useHotkeys('mod+k') in AppLayout, same pattern as existing mod+slash shortcut |
| PALETTE-02 | Fuzzy-matches cached Jira tasks and GitLab MRs by title/key | cmdk built-in filter + queryClient.getQueryData for cached data |
| PALETTE-03 | Navigation actions (Sprint Board, Backlog, Notifications, Settings) | Static CommandGroup with CommandItem entries calling navigate() |
| PALETTE-04 | App actions (Toggle theme, Mark all read) | CommandGroup actions calling applyTheme/setTheme/saveTheme and markAllRead |
| PALETTE-05 | "Search Jira for X" tail item fires live query for >=2 chars | forceMount CommandItem + useQuery with manual enabled flag |
| PALETTE-06 | Default state shows recent items | Conditional CommandGroup rendering based on input length |
| PALETTE-07 | Escape dismisses palette | cmdk built-in Escape + useHotkeys('escape', ..., { enableOnFormTags: true }) |
| RECENT-01 | Clock icon popover with last 10 recently opened items | Popover + new Zustand persist store, same pattern as NotificationPopover |
| RECENT-02 | Clicking recent item opens issue detail panel | onIssueClick prop threading (existing pattern) |
| KEYS-03 | Navigation shortcuts: Cmd+Shift+S/B/N | useHotkeys('mod+shift+s'), useHotkeys('mod+shift+b'), useHotkeys('mod+shift+n') in AppLayout |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | ^1.1.1 | Command palette engine | Powers Linear, Vercel, Raycast palettes; headless, zero-dependency, built-in fuzzy filter and keyboard nav |
| shadcn command | via `npx shadcn add command` | Styled cmdk wrapper | Pre-styled with Tailwind, generates Command/CommandInput/CommandList/CommandEmpty/CommandGroup/CommandItem/CommandSeparator/CommandShortcut into src/components/ui/command.tsx |
| react-hotkeys-hook | 5.2.4 | Keyboard shortcut binding | Already installed; used for mod+k, mod+shift+s/b/n, escape |
| zustand | 5.0.11 | Recent items state + persistence | Already installed; persist middleware + Tauri Store adapter pattern established in settings.store.ts |
| @tauri-apps/plugin-store | 2.4.2 | Persistence backend | Already installed; LazyStore for recent items JSON file |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.90.21 | Cache access + live search query | getQueryData for cached issues/MRs; useQuery for live Jira search |
| lucide-react | 0.577.0 | Icons (Clock, Search) | Clock icon for recent items trigger in TopBar |
| @tauri-apps/plugin-opener | already installed | Open MR URLs in browser | openUrl(mr.web_url) when selecting a GitLab MR |
| react-router-dom | 7.13.1 | Navigation | useNavigate() for Cmd+Shift+S/B route navigation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk built-in filter | fuse.js | cmdk filter is sufficient for this use case; fuse.js adds bundle size for no benefit since cmdk handles fuzzy matching internally |
| Custom backdrop overlay | CommandDialog (shadcn) | CommandDialog wraps Radix Dialog which conflicts with @base-ui/react Dialog -- use raw Command with custom backdrop instead |

**Installation:**
```bash
cd taskflow && npx shadcn add command
```

This generates `src/components/ui/command.tsx` and installs `cmdk@^1.1.1` as a dependency.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── app/
│   │   ├── CommandPalette.tsx       # New: replaces SearchOverlay
│   │   ├── RecentItemsPopover.tsx   # New: clock icon + popover
│   │   ├── TopBar.tsx               # Modified: replace SearchOverlay with palette trigger, add clock icon
│   │   ├── SearchOverlay.tsx        # DELETED
│   │   ├── SearchResultPanel.tsx    # DELETED
│   │   └── ...
│   └── ui/
│       └── command.tsx              # New: generated by shadcn
├── stores/
│   └── recent-items.store.ts       # New: Zustand persist store
├── lib/
│   └── shortcuts.ts                # Modified: 4 new entries
└── main.tsx                        # Modified: palette state, nav shortcuts, recent item tracking
```

### Pattern 1: Command Palette with Custom Backdrop (NOT CommandDialog)
**What:** Render shadcn `Command` inside a custom fixed backdrop overlay, NOT inside `CommandDialog`.
**When to use:** When the project uses @base-ui/react for dialogs (not Radix) -- CommandDialog imports Radix Dialog primitives which would conflict.
**Example:**
```typescript
// CommandPalette.tsx
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut } from '@/components/ui/command';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onIssueClick: (key: string) => void;
}

export function CommandPalette({ open, onClose, onIssueClick }: CommandPaletteProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="max-w-xl mt-16 mx-auto" onClick={(e) => e.stopPropagation()}>
        <Command className="rounded-lg border shadow-lg bg-popover">
          <CommandInput placeholder="Search issues, MRs, and actions..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No matches -- try different keywords</CommandEmpty>
            {/* Groups rendered conditionally based on input value */}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
```

### Pattern 2: Cached Data Access from React Query
**What:** Read cached Jira issues and GitLab MRs from react-query cache for instant fuzzy matching.
**When to use:** When palette opens -- no API call needed, just read what's already cached.
**Example:**
```typescript
import { useQueryClient } from '@tanstack/react-query';
import type { JiraIssue } from '@/services/jira';
import type { GitLabMR } from '@/services/gitlab';

// Inside CommandPalette component:
const queryClient = useQueryClient();

// Read cached my-tasks (returns { issues: JiraIssue[], myIssueKeys: Set<string> })
const myTasksData = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
  ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey]
);

// Read cached sprint board issues
const sprintData = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
  ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]
);

// Read cached GitLab MRs
const mrData = queryClient.getQueryData<{ assigned: GitLabMR[]; reviewRequested: GitLabMR[] }>(
  ['gitlab-mrs', gitlabBaseUrl, userId]
);
```

### Pattern 3: Zustand Persist Store for Recent Items
**What:** New persist store following the exact settings.store.ts pattern with LazyStore, version, and migrate.
**When to use:** For the recent-items.store.ts file.
**Example:**
```typescript
// recent-items.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyStore } from '@tauri-apps/plugin-store';

export interface RecentItem {
  type: 'jira' | 'gitlab';
  id: string;        // Issue key (PROJ-123) or MR iid string
  url?: string;      // For GitLab MRs -- browser open URL
  timestamp: number;  // Date.now() when opened
}

const tauriStore = new LazyStore('recent-items.json');

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

interface RecentItemsState {
  items: RecentItem[];
  pushItem: (item: Omit<RecentItem, 'timestamp'>) => void;
}

export const useRecentItemsStore = create<RecentItemsState>()(
  persist(
    (set) => ({
      items: [],
      pushItem: (item) =>
        set((s) => {
          // Remove duplicate if exists, prepend new, cap at 10
          const filtered = s.items.filter((i) => !(i.type === item.type && i.id === item.id));
          return { items: [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 10) };
        }),
    }),
    {
      name: 'recent-items-store',
      storage: tauriStorage,
      version: 0,
      migrate: (persisted, _version) => persisted as unknown as RecentItemsState,
    },
  ),
);
```

### Pattern 4: Navigation Shortcut Wiring
**What:** useHotkeys in AppLayout for Cmd+Shift+S/B/N, using react-router-dom navigate().
**When to use:** For KEYS-03 navigation shortcuts.
**Example:**
```typescript
// In AppLayout (main.tsx):
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

useHotkeys('mod+shift+s', () => navigate('/sprint-board'));
useHotkeys('mod+shift+b', () => navigate('/backlog'));
// mod+shift+n needs to open notification popover -- requires lifting popover open state
```

### Pattern 5: Notification Popover State Lifting for Cmd+Shift+N
**What:** The notification popover is currently controlled by @base-ui/react Popover's internal state. To open it programmatically from Cmd+Shift+N, the open state must be lifted to AppLayout.
**When to use:** For the Cmd+Shift+N shortcut.
**Example:**
```typescript
// TopBar needs to accept notificationPopoverOpen + onNotificationPopoverChange props
// AppLayout manages the state and passes it down
const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
useHotkeys('mod+shift+n', () => setNotifPopoverOpen(true));

// In TopBar:
<Popover open={notifPopoverOpen} onOpenChange={setNotifPopoverOpen}>
  ...
</Popover>
```

### Anti-Patterns to Avoid
- **Using CommandDialog:** It imports Radix Dialog which conflicts with @base-ui/react. Use raw Command with custom backdrop.
- **Using createContext for recent items:** Project rule: no createContext/useContext -- use Zustand store directly.
- **Caching titles in recent items store:** Titles go stale. Store only keys/IDs, fetch titles on render.
- **Manual keydown listeners for Cmd+K:** macOS fires keydown twice for Cmd+key combos in some WebKit scenarios. react-hotkeys-hook handles this correctly.
- **Adding useQuery to TopBar:** Critical project rule: TopBar must NOT use useQuery directly. Search/palette logic stays in child component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search filtering | Custom filter loop over items | cmdk built-in filter | cmdk normalizes diacritics, handles substring matching, scores results by relevance -- edge cases take weeks to get right |
| Keyboard navigation in results list | Arrow key handlers + focus management | cmdk built-in keyboard nav | aria-activedescendant, scroll-into-view, Home/End, all handled automatically |
| Accessible combobox pattern | Manual ARIA roles | cmdk accessibility | role=combobox, role=listbox, role=option, aria-selected, aria-expanded managed automatically |
| Tauri persistence adapter | Custom file I/O | Zustand persist + LazyStore | Exact pattern from settings.store.ts -- copy it |
| Theme toggle logic | Custom theme cycling | Existing applyTheme + setTheme + saveTheme | ThemeToggle.tsx already has the cycle: light -> dark -> system -> light |

**Key insight:** cmdk handles the three hardest parts of a command palette (fuzzy filtering, keyboard navigation, accessibility) with zero configuration. The implementation work is wiring data sources and actions, not building palette mechanics.

## Common Pitfalls

### Pitfall 1: CommandDialog Radix Conflict
**What goes wrong:** shadcn's CommandDialog imports from `@radix-ui/react-dialog`. This project uses `@base-ui/react` for dialogs. Two dialog primitives would conflict on focus trapping, portal z-index, and Escape handling.
**Why it happens:** shadcn assumes Radix is the dialog primitive.
**How to avoid:** Use raw `<Command>` inside a custom backdrop div. Handle Escape via useHotkeys. Handle backdrop click via onClick on the backdrop div.
**Warning signs:** Import errors mentioning @radix-ui/react-dialog, double Escape firing, focus trap conflicts.

### Pitfall 2: cmdk Filter vs Controlled Input State
**What goes wrong:** cmdk's built-in filter uses the CommandInput value. If you try to control filtering manually while also using cmdk's filter, results may not update correctly.
**Why it happens:** cmdk expects to own the search state by default.
**How to avoid:** For the default/search state toggle (<2 chars vs >=2 chars), read cmdk's input value via the `onValueChange` prop on `CommandInput`. Use this value to conditionally render groups. Let cmdk handle the actual filtering.
**Warning signs:** Groups not appearing/disappearing when expected, stale filter results.

### Pitfall 3: macOS Cmd+K Double-Fire
**What goes wrong:** On macOS, `window.addEventListener('keydown')` fires twice for Cmd+key combinations in some WebKit/Tauri webview scenarios.
**Why it happens:** WebKit keydown event propagation quirk with meta key held down.
**How to avoid:** Use react-hotkeys-hook's `useHotkeys('mod+k', ...)` which deduplicates internally.
**Warning signs:** Palette opens and immediately closes, or toggle state flickers.

### Pitfall 4: Stale Titles in Recent Items
**What goes wrong:** If issue titles are cached in the recent items store, they become stale when the issue is updated in Jira.
**Why it happens:** Jira issues are frequently renamed/updated.
**How to avoid:** Store only the issue key (e.g., "PROJ-42") and MR id + URL. On render, look up the title from the react-query cache. If not in cache, show just the key/ID as fallback.
**Warning signs:** Recent items showing outdated issue titles.

### Pitfall 5: Notification Popover Won't Open Programmatically
**What goes wrong:** Cmd+Shift+N should open the notification popover, but @base-ui/react Popover manages its own open state internally.
**Why it happens:** Popover is currently uncontrolled in TopBar.
**How to avoid:** Lift the Popover's open state to TopBar props. Pass `open` and `onOpenChange` from AppLayout. @base-ui/react Popover.Root accepts `open` prop for controlled mode.
**Warning signs:** Cmd+Shift+N does nothing, or opens but immediately closes.

### Pitfall 6: react-hotkeys-hook Code Name vs Symbol
**What goes wrong:** Using 'mod+/' instead of 'mod+slash' fails silently due to react-hotkeys-hook #1125 normalizer bug.
**Why it happens:** The library's key normalizer doesn't handle some symbols correctly.
**How to avoid:** Use code names for special keys: 'mod+slash', 'mod+k', 'mod+shift+s'. This is already the established pattern from Phase 19.
**Warning signs:** Shortcut doesn't fire, no error logged.

### Pitfall 7: Live Search Race Conditions
**What goes wrong:** User types "login", gets results, then types "bug" -- "login" results flash before "login bug" results load.
**Why it happens:** Multiple concurrent queries without cancellation.
**How to avoid:** Use react-query's built-in query key mechanism -- the query key includes the search term, so changing the term automatically cancels the previous query. Use `keepPreviousData: true` to avoid flash-to-empty.
**Warning signs:** Results flickering, showing results for previous search terms.

## Code Examples

### Theme Toggle Action (from existing ThemeToggle.tsx)
```typescript
// Source: taskflow/src/components/app/ThemeToggle.tsx
import { applyTheme, saveTheme, type Theme } from '@/services/theme';
import { useSettingsStore } from '@/stores/settings.store';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];

// In palette action handler:
const { theme, setTheme } = useSettingsStore();
const currentIndex = THEME_CYCLE.indexOf(theme);
const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
applyTheme(nextTheme);
setTheme(nextTheme);
await saveTheme(nextTheme);
```

### Mark All Read Action (from existing NotificationPopover.tsx)
```typescript
// Source: taskflow/src/stores/notifications.store.ts
import { useNotificationsStore } from '@/stores/notifications.store';

// In palette action handler:
const { markAllRead } = useNotificationsStore.getState();
markAllRead();
```

### Open MR in Browser (existing pattern)
```typescript
// Source: taskflow/src/components/app/SearchResultPanel.tsx
import { openUrl } from '@tauri-apps/plugin-opener';

// In palette MR select handler:
openUrl(mr.web_url);
```

### Existing Shortcut Registry Entry Pattern
```typescript
// Source: taskflow/src/lib/shortcuts.ts
export const SHORTCUTS: ShortcutEntry[] = [
  // ... existing entries ...
  {
    id: 'open-palette',
    defaultKey: '⌘K',
    description: 'Open command palette',
    category: 'General',
  },
  {
    id: 'nav-sprint',
    defaultKey: '⌘⇧S',
    description: 'Go to Sprint Board',
    category: 'Navigation',
  },
  {
    id: 'nav-backlog',
    defaultKey: '⌘⇧B',
    description: 'Go to Backlog',
    category: 'Navigation',
  },
  {
    id: 'nav-notifications',
    defaultKey: '⌘⇧N',
    description: 'Open Notifications',
    category: 'Navigation',
  },
];
```

### React Query Cache Access Pattern
```typescript
// Source: taskflow/src/hooks/useNotificationPolling.ts, MrAttentionTab.tsx
const queryClient = useQueryClient();

// Cached MRs -- shape: { assigned: GitLabMR[], reviewRequested: GitLabMR[] }
const mrCache = queryClient.getQueryData<{ assigned: GitLabMR[]; reviewRequested: GitLabMR[] }>(
  ['gitlab-mrs', gitlabBaseUrl, userId]
);

// Cached my-tasks -- shape: { issues: JiraIssue[], myIssueKeys: Set<string> }
const myTasks = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
  ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey]
);

// Cached sprint board -- same shape as my-tasks
const sprintBoard = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
  ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom SearchOverlay with manual results | cmdk-powered Command palette | This phase | Fuzzy matching, keyboard nav, accessibility all handled by cmdk |
| Separate search overlay + inline detail panel | Palette opens IssueDetailSheet directly | This phase | One fewer component (SearchResultPanel deleted) |
| No recent items tracking | Zustand persist store with 10-item cap | This phase | Users can quickly return to recently viewed items |
| No navigation shortcuts | Cmd+Shift+S/B/N for Sprint/Backlog/Notifications | This phase | Power users navigate without mouse |

**Deprecated/outdated:**
- SearchOverlay.tsx: Replaced by CommandPalette.tsx
- SearchResultPanel.tsx: No longer needed -- palette selects open IssueDetailSheet or browser directly

## Open Questions

1. **How to deduplicate cached issues across multiple query keys?**
   - What we know: Issues appear in both 'my-tasks' and 'sprint-board' caches. MRs appear in 'gitlab-mrs' cache.
   - What's unclear: Whether to merge all cached issues into a single deduped array for the palette, or search each cache separately.
   - Recommendation: Merge into a Map keyed by issue key / MR iid, then convert to array for cmdk. Deduplication prevents showing the same issue twice.

2. **cmdk `filter` prop behavior with dynamic groups**
   - What we know: cmdk filters items by their text content. Navigation/action items have static labels.
   - What's unclear: Whether cmdk's built-in filter correctly handles groups that should only show when query length >= 2.
   - Recommendation: Use conditional rendering of CommandGroup components based on query length. cmdk's filter handles the rest within rendered groups.

3. **"Search Jira for X" tail item with `forceMount`**
   - What we know: cmdk supports `forceMount` prop on CommandItem to always render regardless of filter state.
   - What's unclear: Exact interaction between forceMount and filter results ordering.
   - Recommendation: Use `forceMount` on the tail item and render it outside the filtered groups, after a CommandSeparator. This ensures it always appears at the bottom.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PALETTE-01 | Cmd+K opens palette | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | -- Wave 0 |
| PALETTE-02 | Fuzzy matches cached issues/MRs | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | -- Wave 0 |
| PALETTE-03 | Navigation actions visible | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | -- Wave 0 |
| PALETTE-04 | App actions (toggle theme, mark all read) | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | -- Wave 0 |
| PALETTE-05 | "Search Jira for X" tail item | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | -- Wave 0 |
| PALETTE-06 | Default state shows recent items | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | -- Wave 0 |
| PALETTE-07 | Escape dismisses palette | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | -- Wave 0 |
| RECENT-01 | Clock icon popover with last 10 items | unit | `cd taskflow && npx vitest run src/components/app/RecentItemsPopover.test.tsx -x` | -- Wave 0 |
| RECENT-02 | Clicking recent item opens detail | unit | `cd taskflow && npx vitest run src/components/app/RecentItemsPopover.test.tsx -x` | -- Wave 0 |
| KEYS-03 | Navigation shortcuts Cmd+Shift+S/B/N | unit | `cd taskflow && npx vitest run src/components/app/TopBar.test.tsx -x` | -- existing file, needs new tests |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/app/CommandPalette.test.tsx` -- covers PALETTE-01 through PALETTE-07
- [ ] `src/components/app/RecentItemsPopover.test.tsx` -- covers RECENT-01, RECENT-02
- [ ] `src/stores/recent-items.store.test.ts` -- covers store push/cap/dedup logic
- [ ] shadcn command install: `cd taskflow && npx shadcn add command` -- generates src/components/ui/command.tsx
- [ ] Mock for cmdk: vitest may need `vi.mock('cmdk', ...)` if cmdk uses DOM APIs not available in jsdom

## Sources

### Primary (HIGH confidence)
- Project codebase: SearchOverlay.tsx, TopBar.tsx, main.tsx, settings.store.ts, shortcuts.ts, NotificationPopover.tsx, theme.ts -- direct code inspection
- [shadcn/ui command docs](https://ui.shadcn.com/docs/components/radix/command) -- component API, sub-components, usage pattern
- [cmdk GitHub README](https://github.com/pacocoursey/cmdk) -- API reference: Command, CommandInput, CommandList, CommandGroup, CommandItem, shouldFilter, forceMount, keywords, onSelect
- CONTEXT.md -- locked decisions from user discussion session

### Secondary (MEDIUM confidence)
- [cmdk npm](https://www.npmjs.com/package/cmdk) -- version verification (1.1.1 latest stable)
- WebSearch results on cmdk/shadcn integration -- confirmed CommandDialog wraps Radix Dialog

### Tertiary (LOW confidence)
- cmdk `forceMount` behavior with custom groups -- inferred from API docs, needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed or well-documented, versions verified
- Architecture: HIGH -- all patterns exist in codebase (Zustand persist, useHotkeys, Popover, prop threading)
- Pitfalls: HIGH -- macOS double-fire documented in Phase 19 context, Radix conflict identified from project's @base-ui/react usage, stale title + cache access patterns observed in existing code

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable libraries, no fast-moving APIs)
