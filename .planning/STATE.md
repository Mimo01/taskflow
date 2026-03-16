---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: UX & Branding
status: complete
stopped_at: Phase 22 complete — all v1.3 phases done
last_updated: "2026-03-16T17:40:27.271Z"
last_activity: "2026-03-16 — Phase 22 Plan 02 executed (Dashboard view retrofit: MyTasksTab, SprintBoardTab, SprintProgressTab, BacklogPage, MrAttentionTab)"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 26
  completed_plans: 29
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, and notifications — in one place, without switching between Jira and GitLab.
**Current focus:** Phase 22 complete — all 10 data views have shared empty/error/stale states

## Current Position

Phase: 22 of 22 (Polish — Empty States + Error Recovery)
Plan: 3 of 3
Status: Complete
Last activity: 2026-03-16 - Completed quick task 260316-vhc: Make epic and backlog rows whole-row clickable

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v1.3)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 18. App Icon + Multi-Page Settings | TBD | — | — |
| 19. Keyboard Foundation | TBD | — | — |
| 20. Command Palette + Recent Items | TBD | — | — |
| 21. Header Redesign + Pinned Issue Tabs | TBD | — | — |
| 22. Polish — Empty States + Error Recovery | TBD | — | — |

*Updated after each plan completion*
| Phase 18-app-icon-multi-page-settings P01 | 3 | 2 tasks | 4 files |
| Phase 18-app-icon-multi-page-settings P03 | 5 | 2 tasks | 5 files |
| Phase 18-app-icon-multi-page-settings P02 | 5 | 2 tasks | 53 files |
| Phase 18-app-icon-multi-page-settings PP04 | 7 | 2 tasks | 4 files |
| Phase 18-app-icon-multi-page-settings P05 | 8 | 2 tasks | 3 files |
| Phase 18-app-icon-multi-page-settings P06 | 3 | 2 tasks | 5 files |
| Phase 18-app-icon-multi-page-settings P06 | 30 | 3 tasks | 5 files |
| Phase 19-keyboard-foundation P01 | 8 | 3 tasks | 4 files |
| Phase 19-keyboard-foundation P02 | 8 | 2 tasks | 2 files |
| Phase 19-keyboard-foundation PP03 | 12 | 2 tasks | 4 files |
| Phase 19 P04 | 3 | 2 tasks | 4 files |
| Phase 19-keyboard-foundation P06 | 2 | 2 tasks | 2 files |
| Phase 19-keyboard-foundation P05 | 1 | 1 tasks | 2 files |
| Phase 20-command-palette-recent-items P01 | 3 | 2 tasks | 8 files |
| Phase 20-command-palette-recent-items P03 | 2 | 2 tasks | 2 files |
| Phase 20-command-palette-recent-items P02 | 4 | 2 tasks | 2 files |
| Phase 20-command-palette-recent-items P04 | 4 | 2 tasks | 7 files |
| Phase 20-command-palette-recent-items P05 | 2 | 2 tasks | 3 files |
| Phase 20-command-palette-recent-items P06 | 2 | 2 tasks | 3 files |
| Phase 21-header-redesign-pinned-issue-tabs P01 | 2 | 2 tasks | 3 files |
| Phase 21-header-redesign-pinned-issue-tabs P02 | 2 | 2 tasks | 5 files |
| Phase 21-header-redesign-pinned-issue-tabs P03 | 5 | 2 tasks | 6 files |
| Phase 21-header-redesign-pinned-issue-tabs P04 | 2 | 2 tasks | 4 files |
| Phase 21-header-redesign-pinned-issue-tabs P05 | 2 | 2 tasks | 4 files |
| Phase 22 P01 | 12 | 2 tasks | 11 files |
| Phase 22 P03 | 7 | 2 tasks | 7 files |
| Phase 22 P02 | 9 | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table.
Key v1.3 constraints from research:
- Phase 18: Settings uses internal `useState` nav — no new routes for sub-pages
- Phase 19: `react-hotkeys-hook@^5.2.4` needed (new install); audit all existing `window.addEventListener('keydown')` calls first
- Phase 20: `cmdk@^1.1.1` + `npx shadcn add command` needed; use `react-hotkeys-hook` for Cmd+K (not manual listener) to avoid macOS double-fire bug
- Phase 21: Store only issue keys in pinned-tabs store — never titles (stale title pitfall); must bump store `version` + `migrate` for any new persisted fields
- No `createContext`/`useContext` anywhere — prop threading only
- [Phase 18-app-icon-multi-page-settings]: Settings store persist uses version:1 + migrate for backward-compatible evolution of persisted fields
- [Phase 18-app-icon-multi-page-settings]: ConnectionsSection.tsx stub created at Wave 0 so test files compile with zero TS errors
- [Phase 18-app-icon-multi-page-settings]: validateFn prop typed as Promise<any> to accept both validateJira/validateGitLab return types without duplication
- [Phase 18-app-icon-multi-page-settings]: ConnectionsSection token input always editable (not readOnly) to satisfy onChange-based status reset test expectations
- [Phase 18-app-icon-multi-page-settings]: SVG pipeline for tauri icon works directly (no PNG intermediate or sharp needed); explicit rect background fill required to prevent transparent-area artifacts in macOS Dock
- [Phase 18-app-icon-multi-page-settings]: applyDensity uses data-density DOM attribute; 'default' removes it for CSS baseline; compact/comfortable set it
- [Phase 18-app-icon-multi-page-settings]: AppearanceSection calls setDensity + applyDensity together on user selection for immediate DOM + store update
- [Phase 18-app-icon-multi-page-settings]: NotificationsSection is a pure wrapper — all notification UI lives in NotificationSettingsSection
- [Phase 18-app-icon-multi-page-settings]: WorkflowSection uses aria-label on checkbox inputs for accessible-name test queries while keeping adjacent label layout
- [Phase 18-app-icon-multi-page-settings]: BacklogRow uses tr/td layout — density applied per td cell since tr ignores CSS padding
- [Phase 18-app-icon-multi-page-settings]: TaskCard p-2 split to px-2 py-2 for density variants — preserves horizontal spacing while allowing vertical density control
- [Phase 18-app-icon-multi-page-settings]: Sidebar nav wrapped in overflow-y-auto to stay scrollable at comfortable density; Debug promoted to top-level Advanced section
- [Phase 19-keyboard-foundation]: react-hotkeys-hook@^5.2.4 chosen as keyboard shortcut library for Phase 19
- [Phase 19-keyboard-foundation]: TDD RED scaffold pattern: test files written before component implementation
- [Phase 19-keyboard-foundation]: shortcuts.ts is pure constants module (no imports) so it is a zero-dependency leaf node
- [Phase 19-keyboard-foundation]: keyboardOverrides typed as Record<string, string> for O(1) lookup by shortcut id
- [Phase 19-keyboard-foundation]: react-hotkeys-hook requires code property in fireEvent.keyDown calls — s.code !== undefined guard means events without code are silently ignored in tests
- [Phase 19-keyboard-foundation]: No useHotkeys('escape') inside Dialog components — @base-ui/react/dialog handles Escape natively; adding it would cause double-fire
- [Phase 19-keyboard-foundation]: defaultKey for show-shortcuts set to '⌘/' (display label) not 'mod+/' — avoids adding displayKey field to ShortcutEntry; useHotkeys arg hardcoded separately in main.tsx
- [Phase 19]: Menu API built into tauri crate by default in v2.10.3 -- no feature flag needed
- [Phase 19-keyboard-foundation]: Use 'mod+slash' (code name) instead of 'mod+/' (symbol) to bypass react-hotkeys-hook #1125 normalizer bug
- [Phase 20-command-palette-recent-items]: shadcn command component wraps cmdk@^1.1.1 for accessible command palette primitives
- [Phase 20-command-palette-recent-items]: Recent items store uses same LazyStore persistence pattern as settings store
- [Phase 20-command-palette-recent-items]: Cache-backed title lookup uses getQueriesData with prefix key for cross-query lookups
- [Phase 20-command-palette-recent-items]: RecentItemRow is a private sub-component within RecentItemsPopover.tsx
- [Phase 20-command-palette-recent-items]: Custom backdrop overlay instead of CommandDialog to avoid Radix Dialog conflict with @base-ui/react
- [Phase 20-command-palette-recent-items]: cmdk tests require ResizeObserver and scrollIntoView polyfills in jsdom
- [Phase 20-command-palette-recent-items]: handleIssueClick wraps setSelectedIssueKey + pushRecentItem for all issue-opening entry points
- [Phase 20-command-palette-recent-items]: Notification popover controlled from AppLayout via open/onOpenChange for Cmd+Shift+N programmatic open
- [Phase 20-command-palette-recent-items]: Create issue action placed first in Actions group order
- [Phase 20-command-palette-recent-items]: Navigation and Actions groups rendered unconditionally outside isDefaultState ternary to fix cmdk unmount/remount race
- [Phase 21-header-redesign-pinned-issue-tabs]: Pinned-tabs store follows exact same LazyStore persistence pattern as recent-items store
- [Phase 21-header-redesign-pinned-issue-tabs]: useListNavigation focusIndex starts at -1 (no selection); J from -1 goes to 0
- [Phase 21-header-redesign-pinned-issue-tabs]: PinnedTabStrip resolves issue metadata from react-query cache -- no extra API calls
- [Phase 21-header-redesign-pinned-issue-tabs]: BacklogRow converted to React.forwardRef for scrollIntoView support from parent
- [Phase 21-header-redesign-pinned-issue-tabs]: Ref map pattern (useRef<Map<string, Element>>) used for dynamic row ref tracking in J/K navigation
- [Phase 21-header-redesign-pinned-issue-tabs]: Focus highlight uses bg-muted + border-l-2 border-primary + aria-current across all list views
- [Phase 21-header-redesign-pinned-issue-tabs]: selectedIssueKey passed via outlet context (not React context) to stay consistent with prop-threading pattern; guards useListNavigation enabled in all list views
- [Phase 21-header-redesign-pinned-issue-tabs]: Branding moved to Sidebar with hidden md:block for responsive text
- [Phase 21-header-redesign-pinned-issue-tabs]: Pinned tab skeleton uses Skeleton component from ui/skeleton for consistency
- [Phase 22]: ApiError extends Error with status + source fields for structured HTTP error propagation
- [Phase 22]: isAuthError uses 3-tier detection: ApiError.status, raw object .status, Error.message heuristic
- [Phase 22]: ErrorState auto-detects auth via isAuthError, shows Reconnect CTA to /settings for 401/403
- [Phase 22]: NotificationPopover uses store-level error propagation (fetchError/retryFetch) from polling hook, not prop threading
- [Phase 22]: CommandPalette uses inline SearchX JSX in CommandEmpty instead of EmptyState to avoid breaking cmdk visibility logic
- [Phase 22]: StaleDataBanner shown only when isError + cached data; full ErrorState when isError + no data
- [Phase 22]: Three-state detection pattern: isError && !data -> ErrorState, isError && data -> StaleDataBanner, !isError && empty -> EmptyState

### Pending Todos

None.

### Blockers/Concerns

- Phase 18 (icon): 1024×1024 source PNG with artwork ~860×860 on canvas must be created before `tauri icon` CLI can run — design asset dependency
- Phase 22 (empty states): Monochrome geometric SVG illustration assets do not exist yet — design asset dependency
- Phase 20: macOS Cmd+K double-fire and cold-launch webview focus bugs require verification on a physical macOS device in the production build before marking complete

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260316-q7o | I want to be able to open settings with a keyboard shortcut | 2026-03-16 | 41bffad | | [260316-q7o-i-want-to-be-able-to-open-settings-with-](./quick/260316-q7o-i-want-to-be-able-to-open-settings-with-/) |
| 260316-qc2 | Generalize navigation shortcuts to auto-appear in command palette | 2026-03-16 | 8a4a11a | | [260316-qc2-generalize-navigation-shortcuts-to-auto-](./quick/260316-qc2-generalize-navigation-shortcuts-to-auto-/) |
| 260316-qj3 | Add all relevant shortcuts to app toolbar menu bar | 2026-03-16 | cfe3a49 | | [260316-qj3-add-all-relevant-shortcuts-to-app-toolba](./quick/260316-qj3-add-all-relevant-shortcuts-to-app-toolba/) |
| 260316-q9b | Better rich text rendering in issue detail | 2026-03-16 | 4e4be18 | Verified | [260316-q9b-better-rich-text-rendering-in-issue-deta](./quick/260316-q9b-better-rich-text-rendering-in-issue-deta/) |
| 260316-r0x | Redo issue detail as full page with back/breadcrumb nav | 2026-03-16 | 6333799 | Verified | [260316-r0x-redo-issue-detail-as-full-page-with-back](./quick/260316-r0x-redo-issue-detail-as-full-page-with-back/) |
| 260316-r34 | Better clarity in notifications - show context like status changes from/to | 2026-03-16 | b36eb0f | Verified | [260316-r34-better-clarity-in-notifications-show-con](./quick/260316-r34-better-clarity-in-notifications-show-con/) |
| 260316-rlb | Notification polish: remove priority/labels, Jira→issue detail, styled changes, hover contrast | 2026-03-16 | e79a9d5 | | [260316-rlb-remove-priority-and-labels-from-notifica](./quick/260316-rlb-remove-priority-and-labels-from-notifica/) |
| 260316-s5u | Add comment mentions and expand notifications (6 new types, per-type toggles, color badges) | 2026-03-16 | f115824 | Verified | [260316-s5u-add-comment-mentions-and-expand-notifica](./quick/260316-s5u-add-comment-mentions-and-expand-notifica/) |
| 260316-ssu | Remove "+ Add" quick-create buttons from sprint board columns | 2026-03-16 | cad6eff | | [260316-ssu-remove-add-buttons-from-sprint-board-col](./quick/260316-ssu-remove-add-buttons-from-sprint-board-col/) |
| 260316-tdk | Redo breadcrumb navigation on issue detail (context-aware stacking) | 2026-03-16 | 0437ed4 | Verified | [260316-tdk-redo-breadcrumb-navigation-on-issue-deta](./quick/260316-tdk-redo-breadcrumb-navigation-on-issue-deta/) |
| 260316-tbl | Redo style for pinned task tabs (compact) | 2026-03-16 | 3a07d4e | Verified | [260316-tbl-redo-style-for-pinned-task-tabs-compact-](./quick/260316-tbl-redo-style-for-pinned-task-tabs-compact-/) |
| 260316-ulr | Make linked issues in issue detail sidebar clickable | 2026-03-16 | a013ec2 | | [260316-ulr-make-the-linked-issues-on-issue-detail-n](./quick/260316-ulr-make-the-linked-issues-on-issue-detail-n/) |
| 260316-uqt | Sort MyTasks and SprintBoard by Jira rank order | 2026-03-16 | a7bff1a | | [260316-uqt-make-the-tasks-in-mytasks-backlog-and-sp](./quick/260316-uqt-make-the-tasks-in-mytasks-backlog-and-sp/) |
| 260316-uv2 | Remove X button from pinned tabs, add right-click unpin | 2026-03-16 | 0510e20 | | [260316-uv2-keep-pinned-tabs-compact-when-populated-](./quick/260316-uv2-keep-pinned-tabs-compact-when-populated-/) |
| 260316-v6i | Display ? for unassigned story points in backlog, nowrap keys | 2026-03-16 | 0bbcc51 | | [260316-v6i-display-for-unassigned-story-points-in-b](./quick/260316-v6i-display-for-unassigned-story-points-in-b/) |
| 260316-uxr | Match epic badge colors with Jira, show colors on epic detail | 2026-03-16 | 42f5d48 | | [260316-uxr-match-epic-badge-colors-with-jira-show-c](./quick/260316-uxr-match-epic-badge-colors-with-jira-show-c/) |
| 260316-vhc | Make epic and backlog rows whole-row clickable | 2026-03-16 | c70bb2d | | [260316-vhc-on-epics-page-make-the-whole-row-clickab](./quick/260316-vhc-on-epics-page-make-the-whole-row-clickab/) |

## Session Continuity

Last session: 2026-03-16T21:57:00Z
Stopped at: Completed quick task 260316-vhc (whole-row clickable epic and backlog rows)
Resume: Milestone v1.3 (UX & Branding) is fully executed. All 5 phases (18-22), 29 plans complete. Ready for /gsd:audit-milestone or /gsd:complete-milestone.
