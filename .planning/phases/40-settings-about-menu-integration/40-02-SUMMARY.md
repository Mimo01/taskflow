---
phase: 40-settings-about-menu-integration
plan: "02"
subsystem: settings-ui
tags: [settings, updates, version-history, github-releases, zustand]
dependency_graph:
  requires: [40-01]
  provides: [updates-settings-section, lastChecked-store-field]
  affects: [settings-store, Settings.tsx]
tech_stack:
  added: []
  patterns: [tanstack-query-fetch, accordion-expand, relative-time, inline-status-feedback]
key_files:
  created:
    - taskflow/src/routes/settings/UpdatesSection.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/routes/settings/Settings.tsx
decisions:
  - "Used placeholder GitHub Releases API URL — TODO(Phase-41): set real repo path when public"
  - "relativeTime copied locally from IssueDetailContent.tsx (not exported — kept as local helper per existing pattern)"
  - "checkResult 'available' branch renders text only (not a button link) since update.store already has available status set which triggers UpdateDialog via existing AppLayout listener"
metrics:
  duration: "~8min"
  completed: "2026-03-25T07:05:01Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 40 Plan 02: Updates Settings Section Summary

Updates settings section with frequency dropdown, Check Now button, last-checked timestamp, and expandable GitHub release history list — using settings store v12 with persisted lastChecked field.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add lastChecked to settings store and wire Updates into Settings sidebar | 31809cf | settings.store.ts, Settings.tsx |
| 2 | Create UpdatesSection with controls and version history list | 301be09 | UpdatesSection.tsx (new) |

## What Was Built

**settings.store.ts (v12):**
- Added `lastChecked: string | null` field and `setLastChecked` action to `SettingsState` interface
- Store defaults `lastChecked: null`
- Bumped store version 11 → 12 with migration guard `if (version < 12) s.lastChecked = null`

**Settings.tsx:**
- Added `RefreshCw` icon import and `UpdatesSection` import
- Extended `SettingsSection` type with `'updates'`
- Inserted `{ id: 'updates', label: 'Updates', icon: <RefreshCw> }` between Workflow and Advanced in `SECTIONS`
- Added `{activeSection === 'updates' && <UpdatesSection />}` render block

**UpdatesSection.tsx (278 lines):**
- Default export `UpdatesSection` with `data-testid="section-updates"`
- Current version display from `buildInfo.version`
- Frequency `<Select>` mapped to `FREQUENCY_OPTIONS` (Every hour → Manual only), reads/writes `updateCheckInterval`
- Last checked timestamp shown only when non-null, using local `relativeTime()` helper
- Check Now button: idle / checking (Loader2 spinner + "Checking...") / done states with 5s auto-reset
- Inline result: CheckCircle "Up to date" (green) or "Update available (x.y.z)" (yellow)
- `handleCheckNow` calls `updaterService.check()`, persists `setLastChecked`, transitions `useUpdateStore` states
- `VersionHistoryList` component: TanStack Query `['github-releases']` with 5min staleTime, retry:1
- Loading: 3 Skeleton rows
- Error: EmptyState with WifiOff icon, "Unable to load release history", Retry button
- Empty: EmptyState with PackageOpen icon, "No release history"
- Loaded: accordion with ChevronDown/Up, date formatted en-US, "current" Badge when tag matches `v${buildInfo.version}`
- Draft releases filtered out; changelogs rendered with `ReactMarkdown` + `remarkGfm`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `RELEASES_API_URL` uses `PLACEHOLDER/PLACEHOLDER` | UpdatesSection.tsx:32 | Real repo path not yet public — TODO(Phase-41) comment in place |

The placeholder stub does not prevent the section from rendering or the other controls from working. The version history list will show an error state (WifiOff) until the real URL is set, which is the correct behavior per D-15.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/settings/UpdatesSection.tsx
- FOUND: taskflow/src/stores/settings.store.ts
- FOUND: taskflow/src/routes/settings/Settings.tsx
- FOUND commit: 31809cf (feat(40-02): add lastChecked to settings store and wire Updates into Settings sidebar)
- FOUND commit: 301be09 (feat(40-02): create UpdatesSection with controls and version history list)
