# Phase 29: Developer Tools - Research

**Researched:** 2026-03-20
**Domain:** Developer tooling UI, API instrumentation, performance visualization
**Confidence:** HIGH

## Summary

Phase 29 consolidates the existing debug logs page into a unified Developer Tools page with three tabs (Logs, Operations, Waterfall), a granular settings panel, and hidden access via Cmd+Shift+D / command palette. The implementation is primarily a frontend restructuring and extension of existing patterns -- no new external libraries are needed beyond what the project already uses.

The core technical challenge is the new operation-level profiling store that groups individual `apiFetch` calls into logical operations with wall-clock timing. This requires: (1) extending `apiFetch` with an `operation` parameter, (2) creating a new Zustand store for operation tracking, (3) annotating ~60 existing `apiFetch` call sites across 16 files with operation labels, and (4) building the waterfall visualization with pure CSS bars.

**Primary recommendation:** Build incrementally -- settings store migration first, then the operation profiler store, then the three tab views, and finally the routing/navigation cleanup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tabbed view with three tabs: Logs | Operations | Waterfall
- Existing `/debug-logs` route and sidebar Bug icon removed entirely -- replaced by `/dev-tools`
- `DebugModeSection` removed from Settings page -- settings move inline to Dev Tools page
- Header has Clear button only -- no Pause, no Export
- Route registered in `routes.tsx` but no sidebar link -- Cmd+Shift+D and command palette only (DEVT-04)
- Explicit operation labels in code -- callers pass an `operation` string to `apiFetch`
- Fetches with the same operation label within a time window are grouped into a single operation
- Requires annotating ~15-20 existing call sites across Jira and GitLab services
- Display: expandable cards with wall-clock time as headline, sum of individual fetch durations as secondary stat
- Ungrouped fetches appear in a collapsible "Ungrouped Requests" section at bottom of Operations tab
- CSS bars with percentage-based widths and absolute positioning, no external charting library
- Source-based colors: Jira blue, GitLab orange, operation bars neutral gray, error fetches red
- Bars are read-only with duration labels inline; no tooltips, no click-to-navigate
- Master + granular model for settings with five granular controls
- Replace `debugMode` with `devToolsEnabled` + 4 granular booleans + `retentionLimit`; Zustand persist version bump
- Settings panel lives inline on Dev Tools page as a collapsible section

### Claude's Discretion
- Settings panel collapse/expand behavior and placement within the page
- Tab component implementation (existing pattern vs new)
- Exact operation time-window threshold for grouping concurrent fetches
- CSS bar sizing strategy (percentage vs pixel calculations)
- Zustand migration logic for `debugMode` -> `devToolsEnabled`
- Which call sites get which operation labels (naming convention)
- Keyboard shortcut registration approach (add to SHORTCUTS array)
- Command palette entry text and section
- Commit structure and plan count

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEVT-01 | Unified Developer Tools page combining debug logs and API profiler in a cohesive layout | Existing `DebugLogs.tsx` provides the base; shadcn Tabs already available; page structure in UI-SPEC |
| DEVT-02 | Operation-level profiling groups multiple fetches into logical operations with total time, fetch count, and per-fetch breakdown | New `operation-profiler.store.ts` needed; `apiFetch` needs `operation` param; ~60 call sites across 16 files need annotation |
| DEVT-03 | Granular settings panel with independent toggles: request logging, response body capture, operation profiling, performance waterfall, retention limit | Settings store version bump from 7 to 8; migrate `debugMode` to `devToolsEnabled` + granular booleans; shadcn Select for retention dropdown |
| DEVT-04 | Developer Tools hidden from main Settings navigation -- accessible only via Cmd+Shift+D or command palette | Add to SHORTCUTS array with navMeta; NAV_SHORTCUTS filter auto-populates command palette; remove Bug icon from Sidebar |
| DEVT-05 | Performance waterfall visualization showing operation timeline with fetch durations | CSS-only bars using percentage-based positioning; operation rows expandable to show nested fetch bars; color-coded by source |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| Zustand | State management for operation profiler store + settings migration | Already used for all stores in project |
| zustand/middleware (persist) | Persisting devtools settings | Already used by settings.store.ts |
| React | UI components | Project framework |
| react-router-dom | Route registration for /dev-tools | Already used for all routing |
| react-hotkeys-hook | Cmd+Shift+D keyboard shortcut | Already used for all shortcuts |
| shadcn Tabs | Tab component (tabs.tsx already exists) | Already in project UI library |
| shadcn Select | Retention limit dropdown (select.tsx already exists) | Already in project UI library |
| lucide-react | Icons (Settings gear, chevrons) | Already the project icon library |
| Tailwind CSS v4 | All styling including waterfall bars | Already the project styling solution |

### No new libraries needed
The phase requires zero new dependencies. All UI components (Tabs, Select) already exist in the shadcn component library. The waterfall visualization uses pure CSS (percentage-based div positioning).

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   ├── settings.store.ts          # MODIFY: migrate debugMode -> devToolsEnabled + granular toggles
│   ├── debug-log.store.ts         # MODIFY: add operation field to ApiLogEntry, configurable retention
│   └── operation-profiler.store.ts # NEW: operation grouping and timing
├── lib/
│   ├── apiFetch.ts                # MODIFY: add operation param, read granular toggles
│   └── shortcuts.ts               # MODIFY: add nav-devtools entry
├── routes/
│   ├── dev-tools/                 # NEW: replaces debug-logs/
│   │   ├── index.tsx              # Route entry (lazy loadable)
│   │   ├── DevToolsPage.tsx       # Page shell: header, settings, tabs
│   │   ├── LogsTab.tsx            # Logs tab (adapted from DebugLogs.tsx)
│   │   ├── OperationsTab.tsx      # Operations tab with expandable cards
│   │   ├── WaterfallTab.tsx       # Waterfall visualization
│   │   ├── DevToolsSettings.tsx   # Collapsible settings panel
│   │   ├── OperationCard.tsx      # Expandable operation card
│   │   └── WaterfallBar.tsx       # CSS bar component
│   ├── debug-logs/                # DELETE: replaced by dev-tools
│   ├── settings/
│   │   └── DebugModeSection.tsx   # DELETE: settings move to dev-tools page
│   └── routes.tsx                 # MODIFY: replace /debug-logs with /dev-tools
├── components/app/
│   ├── Sidebar.tsx                # MODIFY: remove Bug icon NavLink
│   └── CommandPalette.tsx         # NO CHANGE: reads NAV_SHORTCUTS automatically
```

### Pattern 1: Operation Profiler Store
**What:** New Zustand store that tracks operations as groups of fetches
**When to use:** Every time `apiFetch` is called with an `operation` parameter

```typescript
// New store: operation-profiler.store.ts
interface FetchRecord {
  id: string;
  source: 'jira' | 'gitlab';
  method: string;
  url: string;
  status: number | null;
  durationMs: number;
  startTime: number;     // performance.now() relative timestamp
  error?: string;
}

interface Operation {
  id: string;
  label: string;
  startTime: number;     // performance.now() when first fetch started
  endTime: number;       // performance.now() when last fetch completed
  wallClockMs: number;   // endTime - startTime
  serverTimeMs: number;  // sum of individual fetch durations
  fetches: FetchRecord[];
  timestamp: string;     // ISO string for display
}

interface OperationProfilerState {
  operations: Operation[];
  ungrouped: FetchRecord[];
  startOperation: (label: string) => string;       // returns operation ID
  addFetchToOperation: (opId: string, fetch: FetchRecord) => void;
  endOperation: (opId: string) => void;
  addUngrouped: (fetch: FetchRecord) => void;
  clear: () => void;
}
```

### Pattern 2: apiFetch Operation Parameter
**What:** Extend `apiFetch` signature with optional `operation` parameter
**How it works:**

```typescript
export async function apiFetch(
  source: 'jira' | 'gitlab',
  url: string,
  init?: RequestInit,
  operation?: string,   // NEW: operation label for grouping
): Promise<Response> {
  // Read granular settings
  const settings = useSettingsStore.getState();
  if (!settings.devToolsEnabled) {
    // fast path: no instrumentation
    // ... existing non-debug path
  }

  // If operation profiling enabled and operation label provided,
  // record fetch in operation profiler store
  // If request logging enabled, record in debug log store
  // If response body capture disabled, skip body cloning
}
```

### Pattern 3: Waterfall CSS Bars
**What:** Pure CSS timeline using percentage positioning
**Key technique:**

```typescript
// Calculate bar position as percentage of total timeline
const timelineStart = Math.min(...allOperations.map(o => o.startTime));
const timelineEnd = Math.max(...allOperations.map(o => o.endTime));
const totalDuration = timelineEnd - timelineStart;

const leftPct = ((op.startTime - timelineStart) / totalDuration) * 100;
const widthPct = (op.wallClockMs / totalDuration) * 100;

// Render:
<div className="relative h-5" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
  <div className="absolute inset-0 bg-muted rounded-sm" />
  <span className="text-xs font-mono ml-1">{op.wallClockMs}ms</span>
</div>
```

### Pattern 4: Settings Store Migration
**What:** Version bump from 7 to 8, migrate `debugMode` to granular settings
**Key approach:**

```typescript
// In migrate function:
if (version < 8) {
  // Carry forward existing debugMode as the new master toggle
  s.devToolsEnabled = s.debugMode ?? false;
  s.requestLogging = s.debugMode ?? false;
  s.responseBodyCapture = s.debugMode ?? false;
  s.operationProfiling = false;  // new feature, default off
  s.performanceWaterfall = false; // new feature, default off
  s.retentionLimit = 200;
  // Clean up old field
  delete s.debugMode;
}
```

### Anti-Patterns to Avoid
- **Don't use canvas/SVG for waterfall:** CSS divs are simpler, more accessible, and match the "no external charting library" decision
- **Don't create a separate settings route:** Settings panel is inline on the Dev Tools page per decision
- **Don't use React context for operation tracking:** Zustand `getState()` is the established pattern for accessing state outside React (e.g., from `apiFetch`)
- **Don't group by time window alone:** The decision says callers pass explicit `operation` labels; time windowing is only for grouping fetches within the same named operation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switching | Custom tab state | shadcn Tabs (already in project) | Accessible, handles keyboard nav, existing component |
| Dropdown select | Custom dropdown | shadcn Select (already in project) | Accessible, styled consistently |
| Keyboard shortcut | Manual event listener | react-hotkeys-hook + SHORTCUTS array | Established pattern, auto-integrates with command palette |
| Persistent storage | localStorage adapter | createTauriStorage() | Existing adapter handles Tauri Store plugin correctly |

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests
**What goes wrong:** Changing `apiFetch` signature breaks all tests that mock or call it
**Why it happens:** ~60 call sites and potentially many test files reference `apiFetch`
**How to avoid:** Make `operation` parameter optional (4th arg with `undefined` default). Existing calls continue to work without changes. Only annotate call sites that should be grouped.
**Warning signs:** Test failures after changing `apiFetch` signature

### Pitfall 2: Settings Migration Losing debugMode State
**What goes wrong:** Users who had `debugMode: true` lose their preference after upgrade
**Why it happens:** Migration doesn't carry forward the old value
**How to avoid:** In migration step (version < 8), set `devToolsEnabled = s.debugMode ?? false` and `requestLogging = s.debugMode ?? false` so existing debug users keep logging on
**Warning signs:** Users report dev tools disabled after update

### Pitfall 3: Operation Timing Races
**What goes wrong:** Operations never "end" because async fetches complete out of order
**Why it happens:** Multiple concurrent fetches within an operation; unclear when the operation is "done"
**How to avoid:** Use a counter pattern -- operation tracks pending fetch count. When counter hits 0, mark endTime. Or use the simpler approach: each fetch records its own startTime/endTime, and operation wallClock = max(endTime) - min(startTime).
**Warning signs:** Operations stuck in "pending" state, NaN durations

### Pitfall 4: Performance Impact of Always-On Instrumentation
**What goes wrong:** Response body cloning (`.clone().text()`) adds latency to every API call
**Why it happens:** Body cloning is expensive for large responses
**How to avoid:** Gate body cloning behind `responseBodyCapture` toggle specifically. When only `requestLogging` is on (not body capture), skip the clone. When `devToolsEnabled` is false, skip ALL instrumentation (fast path).
**Warning signs:** Slower API responses when dev tools are enabled

### Pitfall 5: Stale Sidebar Reference to debugMode
**What goes wrong:** Sidebar still reads `debugMode` after migration removes it
**Why it happens:** Sidebar.tsx uses `const { debugMode } = useSettingsStore()` to conditionally show Bug icon
**How to avoid:** Remove the debug-logs NavLink entirely from Sidebar.tsx (per decision). No conditional needed since Dev Tools has no sidebar entry.
**Warning signs:** TypeScript error on `debugMode` property after removing it from store

### Pitfall 6: Command Palette Auto-Registration
**What goes wrong:** Dev Tools doesn't appear in command palette
**Why it happens:** Forgetting that `NAV_SHORTCUTS` filter requires `category: 'Navigation'` AND `navMeta` to be set
**How to avoid:** Ensure the new SHORTCUTS entry has `category: 'Navigation'` and `navMeta: { label: 'Developer Tools', route: '/dev-tools' }`
**Warning signs:** Entry visible in shortcuts panel but not in command palette

## Code Examples

### Shortcut Registration
```typescript
// Add to SHORTCUTS array in lib/shortcuts.ts
{
  id: 'nav-devtools',
  defaultKey: '⌘⇧D',
  description: 'Open Developer Tools',
  category: 'Navigation',
  displayKeys: ['⌘', '⇧', 'D'],
  navMeta: { label: 'Developer Tools', route: '/dev-tools' },
}
```

### Settings Store New Fields
```typescript
// New fields in SettingsState interface
devToolsEnabled: boolean;        // master toggle (replaces debugMode)
requestLogging: boolean;         // capture method/url/status/duration
responseBodyCapture: boolean;    // capture response body (expensive)
operationProfiling: boolean;     // group fetches into operations
performanceWaterfall: boolean;   // record timing for waterfall
retentionLimit: number;          // max entries: 50|100|200|500|1000
```

### ApiLogEntry Extension
```typescript
// Extend existing interface in debug-log.store.ts
export interface ApiLogEntry {
  // ... existing fields ...
  operation?: string;  // NEW: operation label from apiFetch caller
}
```

### apiFetch Granular Toggle Reading
```typescript
const { devToolsEnabled, requestLogging, responseBodyCapture, operationProfiling } =
  useSettingsStore.getState();

if (!devToolsEnabled) {
  // fast path -- no instrumentation at all
}

// Only clone response body if responseBodyCapture is on
if (responseBodyCapture) {
  const clone = response.clone();
  responseBody = await clone.text().catch(() => '');
}

// Only record in operation profiler if operationProfiling is on AND operation label present
if (operationProfiling && operation) {
  // add to operation profiler store
}
```

## apiFetch Call Site Inventory

Total call sites requiring annotation: ~60 across 16 files. Key groupings by logical operation:

| Operation Label | Files | Call Count | Source |
|----------------|-------|------------|--------|
| Load Sprint Board | jira/sprints.ts, jira/issues.ts | ~4 | jira |
| Load My Tasks | jira/issues.ts (fetchMyTasksHierarchy) | ~2 | jira |
| Load Backlog | jira/backlog.ts | ~3 | jira |
| Load Issue Detail | jira/issues.ts, jira/comments.ts, jira/links.ts | ~4 | jira |
| Search Issues | jira/issues.ts (searchJira), jira/client.ts | ~2 | jira |
| Create/Edit Issue | jira/issues.ts, create-edit queries | ~4 | jira |
| Load Epics | jira/epics.ts (via client.ts) | ~3 | jira |
| Fetch Notifications | notifications.ts | ~7 | mixed |
| Load Merge Requests | gitlab.ts (fetchAssigned/Authored/ReviewerMRs) | ~3 | gitlab |
| Load MR Detail | gitlab.ts (fetchMRDetail + related calls) | ~5 | gitlab |
| Validate Connection | jira/projects.ts, gitlab.ts | ~2 | mixed |
| Load Fields/Metadata | jira/fields.ts, jira/transitions.ts | ~6 | jira |
| Load Releases | gitlab.ts (milestones, tags) | ~4 | gitlab |
| Manage Comments | jira/comments.ts (post/update/delete) | ~3 | jira |
| Issue Transitions | jira/transitions.ts | ~2 | jira |
| Issue Links | jira/links.ts | ~2 | jira |

**Recommendation for operation labeling:** Not every call site needs an operation label on day one. Start with the ~15-20 highest-traffic operations that users would actually profile (Load Sprint Board, Load My Tasks, Load Backlog, Load Issue Detail, Fetch Notifications, Load MRs). Leave lower-frequency calls (validate, field discovery) ungrouped initially -- they'll appear in the "Ungrouped Requests" section.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single `debugMode` boolean | Master toggle + 4 granular booleans + retention limit | Users can enable just logging without expensive body capture |
| `/debug-logs` in sidebar | Hidden `/dev-tools` via Cmd+Shift+D | Cleaner UI for non-developers |
| Flat log list | Grouped operations with waterfall | Actual performance debugging capability |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | taskflow/vitest.config.ts |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEVT-01 | Dev Tools page renders with three tabs | unit | `cd taskflow && npx vitest run src/routes/dev-tools/DevToolsPage.test.tsx -x` | No -- Wave 0 |
| DEVT-02 | Operation profiler groups fetches by operation label | unit | `cd taskflow && npx vitest run src/stores/operation-profiler.store.test.ts -x` | No -- Wave 0 |
| DEVT-03 | Settings toggles control granular features; migration preserves debugMode | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | No -- Wave 0 |
| DEVT-04 | Shortcut registered, sidebar link removed | unit | `cd taskflow && npx vitest run src/lib/shortcuts.test.ts -x` | No -- Wave 0 |
| DEVT-05 | Waterfall bars render with correct percentage positions | unit | `cd taskflow && npx vitest run src/routes/dev-tools/WaterfallTab.test.tsx -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/stores/operation-profiler.store.test.ts` -- covers DEVT-02 (operation grouping logic)
- [ ] `taskflow/src/routes/dev-tools/DevToolsPage.test.tsx` -- covers DEVT-01 (page structure, tabs)
- [ ] `taskflow/src/stores/settings.store.test.ts` -- covers DEVT-03 (migration from v7 to v8, new toggles). Note: file may already exist for other settings tests.

## Open Questions

1. **Operation time-window threshold for grouping**
   - What we know: Fetches with the same operation label should be grouped. Multiple fetches from the same caller happen nearly simultaneously.
   - What's unclear: How long to keep an operation "open" before marking it complete (e.g., 500ms after last fetch? 2 seconds?)
   - Recommendation: Use 2 seconds of inactivity. If no new fetch with the same label arrives within 2s, auto-close the operation. This handles sequential fetches within the same logical operation while not keeping operations open indefinitely.

2. **Operation ID propagation through async call chains**
   - What we know: Service functions call `apiFetch` directly. Multi-fetch operations (like `fetchBacklogView` which calls `fetchBacklogIssues` + `fetchSprintsForBoard`) are composed at the service layer.
   - What's unclear: Whether to pass operation ID through the call chain or use the label-based grouping.
   - Recommendation: Label-based grouping is simpler. The composing function passes the operation label to each `apiFetch` call. No need for an explicit operation ID in the public API.

3. **Retention limit enforcement scope**
   - What we know: Settings specify retention limit (default 200) for the debug log store.
   - What's unclear: Should the operation profiler store also enforce the same limit, or a separate one?
   - Recommendation: Apply retention limit to debug log entries (as today) AND to operations in the profiler store. Use the same configured value for both. Operations are coarser-grained so this is generous.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all referenced source files in the project
- Existing `debug-log.store.ts`, `apiFetch.ts`, `settings.store.ts` -- current implementation patterns
- `shortcuts.ts` -- established shortcut registration pattern
- `routes.tsx` -- current route structure
- `Sidebar.tsx` -- current debug-logs NavLink that needs removal
- `CommandPalette.tsx` -- NAV_SHORTCUTS consumption pattern
- `29-UI-SPEC.md` -- visual contract for the page
- `29-CONTEXT.md` -- locked decisions from user discussion

### Secondary (MEDIUM confidence)
- apiFetch call site count (~60) verified via grep across all service files

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in the project, no new dependencies
- Architecture: HIGH -- extends well-established patterns (Zustand stores, apiFetch instrumentation, shortcut registry)
- Pitfalls: HIGH -- identified from direct code inspection of migration patterns, store patterns, and sidebar references
- Operation labeling scope: MEDIUM -- exact call site groupings are a recommendation; implementer should verify at annotation time

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable project, no external dependency changes)
