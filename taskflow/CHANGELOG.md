# Changelog

All notable changes to Taskflow are documented here.
Entries are written by hand for each release.

## [1.10.4] — 2026-05-28

### Fixed
- Worklogs: worklog entry actions (edit pencil, delete) now appear on hover so the row stays clean at a glance
- Worklogs: the edit form's **Delete** button (previously labelled "Discard Changes") now deletes the entry directly instead of discarding edits
- Worklogs: the cell popover removes its scroll cap while an entry is being edited so the edit form is never clipped
- Worklogs: the "Log Work" button in the cell popover is now labelled **Add New Entry** to distinguish it clearly from editing an existing entry

## [1.10.4] — 2026-05-28

### Fixed

- Worklogs: worklog entry actions (edit pencil, delete) now appear on hover so the row stays clean at a glance
- Worklogs: the edit form's **Delete** button (previously labelled "Discard Changes") now deletes the entry directly instead of discarding edits
- Worklogs: the cell popover removes its scroll cap while an entry is being edited so the edit form is never clipped
- Worklogs: the "Log Work" button in the cell popover is now labelled **Add New Entry** to distinguish it clearly from editing an existing entry

## [1.10.3] — 2026-05-26

### Fixed

- Wiki: `{{[URL]}}` and `{{[display|URL]}}` monospace-wrapped links now render as clickable hyperlinks instead of raw angle-bracket text
- Wiki: Jira `----` horizontal dividers now render as a styled separator line
- Wiki: Lists following a `{quote}` block no longer appear inside the blockquote when the closing tag is on its own line
- Worklogs: epic, story, and subtask key cells are now clickable and open the issue directly
- Settings → Updates: update check results are now visible in the debug log panel

## [1.10.2] — 2026-05-26

### Added

- **Subtask parent-field inheritance** — required custom fields on the create-subtask form are now auto-populated from the parent issue's values, so you no longer need to re-enter fields like Tempo Account. The inherited values are visible in the inputs before submit and are sent to Jira with their original types preserved.

### Removed

- **Sprint Progress page** — the tab, skeleton, health panel, sidebar entry, and route have been removed.

### Fixed

- Subtask creation no longer fails on Jira instances where the subtask issue type has a non-standard name; the type is now matched by the `subtask` flag rather than by name.
- Parent issue detail refreshes automatically after a new subtask is created.
- Standup **Today** story placement now uses the status of the issue actually assigned to you — the parent story if you're assigned to it, or your subtask's status if you're only assigned to the subtask. Previously it always used the parent story's status.

## [1.10.1] — 2026-05-25

### Changed

- The Standup Notes **Yesterday** column now groups all commits for the same task onto a single line and skips merge commits, and its section dividers were tidied up for a cleaner read.

### Fixed

- The **Yesterday** recap now lists every commit from your last working day instead of dropping some.
- The **Yesterday** column heading now reflects your local date rather than UTC.
- Summary stat lines now read correctly for a single item (e.g. "1 commit", "1 story", "1 merge-request event").
- Jira and GitLab project pickers now show up under Settings → Connections.
- The Standup page no longer breaks when a story is missing story points.

## [1.10.0] — 2026-05-25

### Added

- **Standup Notes page** — a new sidebar page that assembles your daily standup at a glance. *Yesterday* covers your last working day (Monday rolls back to Friday; weekends and Tempo holidays are skipped) with your Tempo worklogs, Jira status changes and comments, Git commits, and merge-request activity. *Today* shows your open sprint subtasks grouped under their parent stories, with participating merge requests. Includes one-click "Copy as markdown" and refresh.
- **Integrations step in the onboarding wizard** — enable AIO Test Management (with project picker) and Tempo Timesheets during first-time setup instead of going to Settings afterwards.

### Changed

- **Removed Developer / Project Manager roles** — everyone now sees every nav item and dashboard surface. The role step is gone from onboarding, and role toggles/presets are gone from Settings.
- **Settings → Sidebar** is now a simple show/hide list; drag-to-reorder was removed.

### Fixed

- AIO test runs that are in progress now show as *In Progress* instead of *Not Executed*; AIO status mapping is more resilient to non-standard AIO instances.
- Worklogs refresh immediately after you log time.
- Merge-request discussions load past the previous 20-item cap.
- Non-image attachments download correctly.
- Searching a number also searches tasks in your selected projects.
- Progress bars across the app share one consistent style.

## [1.9.0] — 2026-05-23

### Added

- **Tempo Timesheets integration** — Worklogs page in the sidebar (when Tempo is enabled in Settings → Integrations) shows a 3-level Epic → Story → Subtask hierarchy table with sticky date header and sticky first column
- **6 date presets** — This Week (default), Last Week, This Month, Last Month, Last Working Day, and Custom range with from ≥ to validation
- **Single-select people filter** with combobox + chip + clear button
- **Per-day totals row, per-person totals column, and grand total cell** computed client-side from the fetched worklog data
- **Per-cell worklog CRUD via popover** — click any cell to view the worklog entries for that issue/day; inline edit with duration validation (rejects "abc"/empty), one-click trash delete (no confirmation), and "Add entry" reusing the LogWorkPopover for new worklogs; broad-prefix cache invalidation keeps cell + row + column + grand totals consistent
- **Saved Tempo filters** — save any combo of date preset + person + custom range; load/rename/reorder/delete via right-click context menu on each filter pill; persists across app restarts via Zustand + Tauri Store
- **Weekend and holiday columns** coloured grey/red via the Tempo schedule API
- **Static dashboard welcome screen** — gradient hero with personalised greeting and en-GB long-form date
- **Sprint health card** — current sprint name, days remaining, percent-complete progress bar from real story-point data
- **My In-Progress card** — up to 3 of the user's own in-progress subtasks; clicking one pushes Dashboard onto the breadcrumb trail before navigating to the issue
- **Next Release card** — soonest unreleased fix version with days-countdown timing label and a live progress bar showing percent of release issues done

### Removed

- **Widget-based customizable dashboard system** — drag/resize grid, widget picker, and all 11 widget types (replaced by the static welcome screen above)
- **Workload page** and the `/workload` route + sidebar entry
- **react-grid-layout** and **@types/react-grid-layout** dependencies

### Fixed

- **Dashboard greeting** now handles on-prem Jira display names of the form `SURNAME Firstname OrgCode (status)` (e.g. `DOE Jane ACME (ext.)` → `Jane`); previously the all-caps surname leaked into the greeting
- **In-Progress card breadcrumb** — clicking a subtask now adds Dashboard to the breadcrumb trail so back-navigation works
- **Release card** now shows a progress bar and "X% complete · N / M issues" caption beneath the timing label

### Changed

- **Test suite** — 1298 passing, 0 failing, 0 warnings after all v1.9 additions/removals
- **Dead code sweep** — zero stale widget / workload references remain in the codebase

## [1.8.1] — 2026-05-19

### Added

- **Issue flagging** — flag and unflag issues from the sprint board, backlog, and issue detail sidebar; flagged issues are highlighted with a yellow background and flag icon; right-click context menus in the sprint board and backlog include Flag/Unflag actions

### Fixed

- WikiRenderer: nested ordered lists now render with correct indentation; bullet characters no longer appear on unordered list items; single newlines inside paragraphs no longer produce extra blank lines
- Mention pills (`[~username]`) now resolve to display names for users not already present as assignee, reporter, or comment author — resolved via Jira API on first render

## [1.8.0] — 2026-05-18

### Added

- **AIO Test Management integration** — connect to an AIO TCMS instance via Settings → Integrations; the Testing sidebar section appears when enabled
- **AIO project overview** — two-panel layout with recursive folder tree (expand/collapse, per-folder cycle count badges) and a 5-column cycle table driven by the batch summary endpoint with zero N+1 fetches
- **AIO cycle detail** — execution progress bar decoupled from run list (resolves ~0.4 s faster via batch summary POST); Executions tab with filterable run table and clickable rows; Defects tab with Jira-enriched reporter, assignee, priority, and severity columns
- **Pin test cycles** — pin any AIO cycle to the header tab strip from the cycle detail page; tabs persist across restarts and can be unpinned
- **AIO on issue detail** — lazy-loaded test runs section shows an impacted executions list with per-run status chips, step table (Step / Expected / Actual) with WikiRenderer rendering and failure markers, and an AIO attachments grid; opens in the existing in-app lightbox
- **Draggable sidebar resize** — drag the right edge of the main nav sidebar or any detail panel sidebar to any width; preference persisted to local storage and restored on next launch
- **Search closed Jira tasks** — command palette now searches resolved and closed issues; type a Jira key (`PROJ-123`) for a direct match at the top of results
- **Assign to me** — quick action in the assignee popover sets the current user without opening the full picker
- **Internal link routing** — Jira issue URLs and `fixForVersion` links in rendered wiki/descriptions now navigate within the app instead of opening the browser; source page is pushed to the breadcrumb trail

### Fixed

- WikiRenderer: `\+` and `\\` in table cells, brace-quoted formatting (`{*}bold{*}`, `{_}italic{_}`), image rendering in issue descriptions, nested panel blocks inside table cells, numbered lists inside panels
- Sprint board: epic pill now displays data; assignee-before-status column ordering restored
- Self-authored changelog entries and comments filtered from the issue activity timeline
- AIO credentials gate on all queries prevents first-load 401 flash

### Changed

- Backlog: Summary and Epic columns swapped; Epic column right-aligned
- Status badges and pills unified to a single `statusPillClass` helper across all views
- All API calls now carry an operation group label (visible in Dev Tools request log)

## [1.7.3] — 2026-05-10

### Fixed
- Updater restart now uses the correct process plugin command (app.restart()) after applying an update
- CI pipeline: fixed macOS Rust target and Windows package-lock version mismatch that caused build failures

## [1.7.2] — 2026-05-10

### Added
- Draggable sidebar resize — drag the sidebar edge to any width; resize handles on issue detail, MR detail, and releases detail panels
- Story points field can now be cleared to empty (no story points set)
- Request body now shown in Dev Tools request log for POST and PUT calls
- Separate "updater" log category in Dev Tools for update-check calls

### Fixed
- Pagination loop no longer hangs when Jira returns empty issues with total > 0
- versionId is validated before JQL interpolation to prevent injection
- GitLab milestone column shows a dash instead of "Loading" when no milestone matched
- Sidebar prefetch timer is now cleared on unmount
- useResizable syncs width when initialWidth changes after mount
- Drag handle border color uses state-driven hover, not CSS :hover
- Issue detail panel pixel fallback computed correctly on first drag

### Changed
- Release script simplified: CI now owns all builds and release publishing; release.sh is a thin version-bump-and-tag-push trigger
- Pre-commit hook now enforces a full quality gate: biome check + all tests must pass before any commit

## [1.7.1] — 2026-04-06

### Fixed
- App now properly relaunches after installing an update
- Resolved CI build and artifact collection issues that prevented auto-update delivery

## [1.7.0] — 2026-04-06

Maintenance release to close out the v1.7 milestone.

- Archived v1.7 phase directories and finalized milestone

## [1.7] — 2026-04-05

Performance overhaul — every view now feels instant.

### Added
- Route code-splitting with lazy loading for 6 heavy views (sprint board, backlog, epics, workload, sprint progress, MR attention)
- React Compiler auto-memoization, replacing all manual `useMemo`/`useCallback`/`memo` wrappers
- Layout-matched skeleton screens on all 8 data views with flicker prevention via `useDelayedLoading`
- Session-persistent caching (`gcTime: Infinity`) with route-aware smart polling
- Query parallelization across sprint board and backlog, with sidebar hover/focus prefetch
- Avatar caching system with memory + disk persistence via `CachedAvatar` component
- `ChunkErrorBoundary` and `RouteSpinner` for graceful lazy-load failures
- Bundle analysis tooling (`rollup-plugin-visualizer`)

### Changed
- Backlog view rewritten to per-section queries with progressive loading
- Sprint board uses parallel queries and `useBoardId` hook for faster data resolution
- Backlog grid converted from HTML table to div-based CSS grid with always-on virtualization
- Removed all manual memoization from components (React Compiler handles it)

### Fixed
- Sticky header white flash, reload race conditions, and collapse jump on sprint board
- Backlog progressive loading — broken rows, scroll jumps, wrong sprint assignments
- Context menu group wrapping and unused import warnings
- MR detail page polish per user feedback

## [1.6.3] — 2026-03-29

Release pipeline hardening and update dialog polish.

### Added
- Wider update dialogs with expanded changelog areas
- Polished changelog rendering in settings release history

### Fixed
- Broken auto-restart countdown after update — now relaunches immediately
- Idempotent version bump handling when tag already exists
- Tighter changelog list item margins in update dialogs
- Release script hardened with auto-credentials from macOS Keychain and correct artifact paths

## [1.6.2] — 2026-03-29

Developer tooling and clipboard fix.

### Added
- Full local release lifecycle script (`release.sh`) replacing GitHub Actions release workflow
- Husky pre-commit and pre-push hooks replacing CI-only linting
- `bump-version.mjs` for atomic version bumps across all config files

### Fixed
- macOS Edit menu added for clipboard shortcuts (Cmd+C/V/X) in Tauri
- Duplicate OS notifications prevented by checking store before dispatch

## [1.6.1] — 2026-03-26

Minor fixes and internal improvements.

### Added
- Release script with test and lint gates
- Changelog generation script for categorized markdown output
- Saved filter sync extracted into dedicated hook

### Fixed
- JS-driven sticky swimlane headers for virtual scroll compatibility
- Sound added to OS notification dispatch
- Removed saved filters section and unused imports from sidebar

## [1.6] — 2026-03-26

Auto-update pipeline — Taskflow can now update itself.

### Added
- Tauri updater plugin with signed update manifests and endpoint configuration
- Update service wrapper with state machine store (idle → checking → available → downloading → relaunch)
- Automatic update polling with configurable interval (1h, 6h, 12h, 24h, or manual)
- `UpdateDialog` showing changelog and download progress
- `WhatsNewDialog` displayed after restart with cached release notes
- Version policy enforcement — soft minimum (dismissible banner) and hard minimum (blocking overlay)
- `AboutDialog` accessible from native menu bar
- Updates section in Settings with version history list fetched from GitHub releases
- Build-time version injection pipeline (`inject-version.cjs`) with git tag, commit SHA, and build date
- GitHub Actions cross-platform release workflow (Linux + Windows)

## [1.5] — 2026-03-24

Taskflow becomes a power tool with deep Jira feature parity and customizable layout.

### Added
- Unified activity timeline combining changelog, comments, and worklogs with filter chips
- Time tracking with worklog CRUD, natural language duration input (`1h 30m`), and sidebar summary
- File attachments with thumbnails, lightbox preview, and drag-drop upload
- `@mention` autocomplete in comment composer with cursor-anchored popover
- Sprint goal banner and board quick filter chips
- Saved filter management synced to Jira with sprint board integration
- Customizable sidebar with drag-and-drop reorder and role presets
- Widget-based dashboard with 11 widget types and responsive grid layout (`react-grid-layout`)
- Release detail page with inline editing, issue-MR matching table, and label coverage indicator
- Clone Issue button and watcher toggle in issue detail
- Overdue badge on due dates across issue detail, task rows, and backlog
- Fix version picker filtered to unreleased + recent released versions
- Colored status transition badges replacing plain text buttons

### Changed
- Status transitions unified across issue detail, task rows, and sprint board
- Saved filters feature fully rebuilt from scratch with proper Jira CRUD

## [1.4] — 2026-03-20

Internal quality milestone — no new user features, but a much healthier codebase.

### Added
- Biome linter and formatter with CI-ready scripts; all 162 source files auto-formatted
- 126 new tests (489 → 615+), zero failures, zero warnings
- Developer Tools page with operation profiling waterfall and filterable log viewer
- `@tanstack/react-virtual` virtualization for backlog, notifications, and sprint board lists
- ARIA labels and roles on form inputs and custom dropdowns
- Major dependency updates: Vite 8, TypeScript 5.9, plugin-react 6

### Changed
- Monolithic `jira.ts` (2000+ lines) decomposed into 14 focused domain modules with barrel export
- `CreateEditIssueModal` and `IssueDetailSidebar` split into composable sub-components
- Zero `any` types and zero double-casts remaining in production code
- Dev Tools moved from standalone page to Settings → Advanced section
- Notification unread count cached in store to avoid recomputation

## [1.3] — 2026-03-19

Visual identity and keyboard-driven workflows.

### Added
- Custom node-graph SVG app icon generated for all platform sizes
- Multi-page Settings with sidebar navigation (Connections, Appearance, Notifications, Workflow, Advanced)
- Keyboard shortcuts system with `Cmd+/` help panel, J/K list navigation, and configurable bindings
- Command palette (`Cmd+K`) with fuzzy search across Jira issues, pages, and actions
- Header redesign with pinned-issue tab strip persisted across restarts
- Recent items quick-access popover with tracked navigation history
- Collapsible sidebar with `Cmd+B` toggle and centered icon mode
- Illustrated empty states and actionable error recovery across 10+ views
- Full MR detail page with discussions, labels, milestone, and internal navigation
- Rich text rendering for Jira wiki markup (mentions, callout panels, image lightbox)
- Native menu bar with all app shortcuts and conditional Debug menu
- Notification redesign: avatar-led layout, type badges, hover quick actions, source filtering

### Changed
- Density system (compact/comfortable/spacious) applied to all list rows, cards, and sidebar
- Notifications consolidated from dual icons to single tabbed popover
- Comment sort order configurable in settings
- Epic colors fetched from Jira and applied consistently across all badge locations

### Fixed
- Sprint board column header alignment with card columns
- Sprint field parsing for all Jira Data Center response formats
- Breadcrumb trail accumulation and attachment image rendering via auth proxy
- Notification popover image re-renders eliminated

## [1.2] — 2026-03-15

Full Jira parity — work entirely within Taskflow without opening Jira.

### Added
- Issue detail panel with inline field editing, comment thread, and wiki rendering
- Sprint board rebuilt with Jira-workflow columns, drag-and-drop transitions, and quick-create input
- Create/edit issue form with dynamically discovered fields from Jira `createmeta` API
- Backlog view with sprint sections, bulk move-to-sprint, and multi-filter comboboxes
- Epic management: epics page, epic detail sheet, create epic dialog, epic filter on sprint board
- Issue links section in create/edit modal
- Custom field discovery infrastructure with settings persistence

### Changed
- Issue detail sheet widened to 75vw for comfortable metadata display
- Backlog layout redesigned to match Jira's sprint-section grouping
- Board sprints filtered by `originBoardId` to exclude cross-project sprints

### Fixed
- Cross-project sprints appearing in board by filtering on project key
- Assignee search pagination, fuzzy filter, and custom field autocomplete
- Epic badge showing null custom field instead of fetched epic name
- Sprint issue API endpoint variance across Jira Data Center instances

## [1.1] — 2026-03-13

Polish pass — fixes and enrichments across every existing feature.

### Added
- Subtask two-query strategy in sprint issue fetching for accurate parent/child data
- Story points field auto-discovery at app startup
- WorkloadTab with subtask nesting, time tracking columns, and expandable done stories
- SprintProgressTab with stacked status bar, time totals, and per-assignee breakdown table
- Story/subtask hierarchy in sprint board with collapsible parent swimlanes
- MR Attention tab with project-level MR pool and subtask-linked MR inclusion
- Dashboard panels: SubtasksPanel, MrHealthPanel, SprintHealthPanel
- Full-page `/notifications` route with type labels, metadata chips, and linkified body
- Tech Lead role with dual-section sidebar navigation
- Debug Logs page with `apiFetch` wrapper for API call inspection
- Comment count badge on task rows with inline comment viewing

### Fixed
- Releases tab using wrong endpoint; now uses paginated `fixVersions` with sort and badges
- Story points always showing zero (field discovery was missing)
- Done stories incorrectly excluded from WorkloadTab (now shown as sub-rows)
- GitLab group selection replaced with project-level selection for accurate MR/milestone data
- Duplicate notifications on prepend prevented with deduplication guard
- Network errors no longer cause false "disconnected" state

## [1.0] — 2026-03-12

Initial release — a cross-platform desktop app unifying Jira and GitLab for development teams.

### Added
- Tauri 2 desktop app with React 18 frontend, no admin rights required
- Secure PAT storage via OS keychain (Stronghold)
- Onboarding wizard with Jira and GitLab connection validation
- Developer dashboard with live task and MR data
- Automatic Jira issue ↔ GitLab MR linking via branch name matching
- Role-aware views: Developer (My Tasks, Sprint Board, MR Attention) and PM (Sprint Progress, Workload, Releases)
- Jira write actions: status transitions and inline comments from task rows
- Unified notification hub with OS desktop notifications and in-app badge
- Global search across Jira issues and GitLab merge requests
- Settings page with connection management and role selection
