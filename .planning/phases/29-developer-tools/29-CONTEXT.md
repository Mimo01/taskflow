# Phase 29: Developer Tools - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Unified hidden Developer Tools page combining debug logs, operation-level API profiling, and performance waterfall visualization. Accessible only via Cmd+Shift+D or command palette — not visible in Settings navigation or sidebar. Replaces the existing `/debug-logs` route and `DebugModeSection` in Settings. Granular settings panel with independent toggles lives inline on the Dev Tools page.

</domain>

<decisions>
## Implementation Decisions

### Page Layout & Structure
- Tabbed view with three tabs: **Logs | Operations | Waterfall**
- One section visible at a time — reuses existing tab patterns
- Existing `/debug-logs` route and sidebar Bug icon **removed entirely** — replaced by `/dev-tools`
- `DebugModeSection` removed from Settings page — settings move inline to Dev Tools page
- Header has **Clear button only** — no Pause, no Export
- Route registered in `routes.tsx` but no sidebar link — Cmd+Shift+D and command palette only (DEVT-04)

### Operation Grouping (DEVT-02)
- **Explicit operation labels in code** — callers pass an `operation` string to `apiFetch` (e.g., `'Load Sprint Board'`)
- Fetches with the same operation label within a time window are grouped into a single operation
- Requires annotating ~15-20 existing call sites across Jira and GitLab services
- **Timing: show both** — wall-clock total as headline, sum of individual fetch durations as secondary stat
- **Display: expandable cards** — each operation card shows name, wall-clock time, fetch count, server time sum; expand to see per-fetch breakdown (method, URL, status, duration)
- **Ungrouped fetches** appear in a collapsible "Ungrouped Requests" section at the bottom of Operations tab

### Waterfall Visualization (DEVT-05)
- **Operations with nested fetches** — each operation is a row with a bar spanning wall-clock time; expand to see individual fetch bars nested underneath showing parallelism
- **CSS bars** — div elements with percentage-based widths and absolute positioning, no external charting library
- **Source-based colors** — Jira fetches blue, GitLab fetches orange (matching existing badge colors), operation bars neutral gray, error fetches red
- **No interaction** — bars are read-only with duration labels inline; no tooltips, no click-to-navigate

### Settings Granularity (DEVT-03)
- **Master + granular model** — "Enable Developer Tools" master toggle at top; when off, everything disabled; when on, individual toggles become active
- Five granular controls:
  1. Request logging (toggle)
  2. Response body capture (toggle)
  3. Operation profiling (toggle)
  4. Performance waterfall (toggle)
  5. Retention limit (dropdown: 50, 100, **200 default**, 500, 1000)
- **Replace `debugMode`** in settings store with `devToolsEnabled` + 4 granular booleans + `retentionLimit`; Zustand persist version bump for migration
- **Persist all toggles** across restarts via existing LazyStore adapter
- Settings panel lives **inline on the Dev Tools page** as a collapsible section — not in the Settings route

### Claude's Discretion
- Settings panel collapse/expand behavior and placement within the page
- Tab component implementation (existing pattern vs new)
- Exact operation time-window threshold for grouping concurrent fetches
- CSS bar sizing strategy (percentage vs pixel calculations)
- Zustand migration logic for `debugMode` → `devToolsEnabled`
- Which call sites get which operation labels (naming convention)
- Keyboard shortcut registration approach (add to SHORTCUTS array)
- Command palette entry text and section
- Commit structure and plan count

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing debug infrastructure
- `taskflow/src/stores/debug-log.store.ts` — Current in-memory log store (ApiLogEntry type, 200-entry FIFO, append/clear)
- `taskflow/src/lib/apiFetch.ts` — Instrumented fetch wrapper; needs `operation` parameter added
- `taskflow/src/routes/debug-logs/DebugLogs.tsx` — Current log viewer (LogCard component, expandable detail); being replaced
- `taskflow/src/routes/debug-logs/index.tsx` — Current route entry point; being removed

### Settings and routing
- `taskflow/src/stores/settings.store.ts` — Settings store with `debugMode`; needs migration to granular toggles
- `taskflow/src/routes/settings/DebugModeSection.tsx` — Current debug toggle in Settings; being removed
- `taskflow/src/routes/routes.tsx` — Route definitions; `/debug-logs` replaced with `/dev-tools`

### Keyboard and command palette
- `taskflow/src/lib/shortcuts.ts` — Shortcut registry; add `nav-devtools` entry with Cmd+Shift+D
- `taskflow/src/components/app/CommandPalette.tsx` — Command palette; add Developer Tools entry
- `taskflow/src/components/app/Sidebar.tsx` — Sidebar nav; remove Bug icon link to debug-logs

### Requirements
- `.planning/REQUIREMENTS.md` — DEVT-01 through DEVT-05 requirements
- `.planning/ROADMAP.md` — Phase 29 success criteria (5 criteria)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LogCard` component in `DebugLogs.tsx`: expandable card pattern with summary row + detail panel — can be adapted for operation cards
- `statusColor()` utility in `DebugLogs.tsx`: HTTP status color mapping — reuse directly
- `formatBody()` utility in `DebugLogs.tsx`: JSON pretty-print — reuse directly
- `ApiLogEntry` interface in `debug-log.store.ts`: well-defined entry type — extend with `operation?: string` field
- Source badge styling (blue for Jira, orange for GitLab) in `DebugLogs.tsx` — reuse for waterfall colors
- `createTauriStorage()` factory for Zustand persistence (Phase 27 REFAC-04) — already used by settings store

### Established Patterns
- Zustand with persist middleware + LazyStore adapter for settings persistence
- `getState()` pattern for accessing store outside React (used in `apiFetch`)
- Tab-like navigation in Settings page (sidebar sections) — inform tab component approach
- Centralized shortcut registry in `lib/shortcuts.ts` — append new entries
- No React context/useContext — prop threading throughout codebase

### Integration Points
- `apiFetch()` is the single instrumentation point — all Jira/GitLab calls flow through it
- `useSettingsStore` read in `apiFetch` via `getState()` — will read granular toggles instead of `debugMode`
- `useDebugLogStore` append in `apiFetch` — will also feed operation profiler store
- Route registration in `routes.tsx` — add `/dev-tools`, remove `/debug-logs`
- Sidebar in `Sidebar.tsx` — remove Bug icon nav link
- Shortcut registry in `shortcuts.ts` — add Cmd+Shift+D entry
- Command palette reads `NAV_SHORTCUTS` — new entry auto-appears

</code_context>

<specifics>
## Specific Ideas

- Operation cards should match the expandable pattern already used by LogCard — consistent UX
- Waterfall bars should use the same Jira-blue / GitLab-orange color scheme as the source badges in the current debug logs
- The Dev Tools page is a power-user feature — can be more information-dense than the main app UI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-developer-tools*
*Context gathered: 2026-03-20*
