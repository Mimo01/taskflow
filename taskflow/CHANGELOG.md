
## [Unreleased]

### Bug Fixes

- add Edit menu to Tauri app for macOS clipboard shortcuts
- prevent duplicate OS notifications by checking store before dispatch

### Documentation

- update debug knowledge base with wizard-paste-broken
- resolve debug wizard-paste-broken
- resolve debug duplicate-os-notifications and update knowledge base

### Miscellaneous

- build Taskflow v1.6.1 macOS universal binary
## [1.6.1]

### Bug Fixes

- fix biome formatting in SprintBoardTab and notifications test
- update notifications test to expect sound param in sendNotification call
- JS-driven sticky swimlane headers for virtual scroll
- add sound to OS notification dispatch

### CI/CD

- auto-update README download links after each release

### Documentation

- resolve debug notification-no-sound, update knowledge base

### Features

- remove saved filters section and unused imports from Sidebar
- extract saved filter sync into dedicated hook and wire into app layout
- update release.sh to auto-generate changelog when no message given
- add generate-changelog.sh for categorized markdown changelogs
- add release script that gates on tests and lint

### Miscellaneous

- sync version files and add planning docs
## [1.6]

### Bug Fixes

- mock build-info in updater tests to avoid dev-build guard
- add ACL permission and skip update checks in dev builds
- auto-fix biome format and lint errors so CI passes

### Documentation

- complete CI pipeline quick task
- complete phase execution
- complete manual setup and E2E verification

### Features

- add CI workflow for push and PR to main

### Testing

- persist human verification items as UAT
## [0.1.0]

### Bug Fixes

- add releaseCommitish for cross-repo release creation
- add MemoryRouter to ReleasesTab tests, guard subtasks null access in jira.ts

### Documentation

- complete ci-pipeline plan 01
- create phase plan
- add validation strategy
- research ci pipeline phase
- record phase 41 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution and verification
- complete settings/about tests plan
- complete Updates settings section plan
- complete About dialog plan — menu wiring and dialog component
- create phase plan — 3 plans in 2 waves
- add validation strategy
- research phase domain
- fix typography weight contract and declare Updates section focal point
- UI design contract
- record phase 40 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution and verification
- complete version policy enforcement plan
- complete update dialog lifecycle + what's new plan
- create phase plan — update dialog lifecycle + version policy enforcement
- UI design contract approved
- fix UI-SPEC checker issues — copywriting labels, typography weights, focal points
- UI design contract
- add validation strategy
- research phase domain
- record phase 39 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete update polling hook plan
- complete updater service layer plan
- create phase plan
- UI design contract
- fix typography weight count (3→2 weights)
- UI design contract
- add validation strategy
- research phase domain
- record phase 38 context session
- capture phase context
- create milestone v1.6 roadmap (4 phases)
- define milestone v1.6 requirements
- complete project research
- start milestone v1.6 Release & Auto-Update Pipeline

### Features

- add updater signing pubkey to tauri.conf.json
- add GitHub Actions release workflow
- replace placeholder URLs with Mimo01/taskflow-releases
- create AboutDialog and wire native menu-about event
- create UpdatesSection with controls and version history list
- add lastChecked to settings store and wire Updates into Settings sidebar
- SoftMinimumBanner + HardMinimumOverlay + AppLayout wiring
- version policy service, hook, and policy JSON
- WhatsNewDialog component + AppLayout wiring
- settings store v11 migration + UpdateDialog component
- create update polling hook and add updater config to tauri.conf.json
- add updateCheckInterval to settings store with v10 migration
- build-time version injection pipeline
- add update service wrapper and state machine store with tests
- register Tauri updater plugin in Rust backend and install npm dep

### Testing

- persist human verification items as UAT
- add UpdatesSection tests and update Settings nav count to 7
- add AboutDialog unit tests
- add failing tests for WhatsNewDialog component
- add failing tests for UpdateDialog component
## [1.5]

### Bug Fixes

- update WidgetGrid for react-grid-layout v2 API
- remove unused imports and variables causing TS build errors
- update Settings test mock with sidebar/dashboard store fields
- revise plans based on checker feedback
- invalidate all view caches after issue field mutations
- reduce released badge size in fix version picker
- restore arrow prefix on status transition badges
- use Jira-compatible date format for worklog started field
- enrich subtask assignees via follow-up search in issue detail
- add MR state badge (merged/opened) to issues table for clarity
- release detail UX — milestone warning, clickable issues, assignee/author columns, MR color distinction
- add GitLab milestone link to release detail page and paginate milestone fetch
- restore sprint board sticky headers and fix backlog row overlap
- fix sticky headers and remove bulk edit UI
- redesign SprintGoalBanner for subtler appearance
- revise plans based on checker feedback
- move Log Work to action buttons row and fix MentionPopover positioning
- restore all 15 original type exports destroyed by plan 01
- add OverdueBadge to issue detail sidebar due date
- show exact date/time on hover for all timestamps
- address UAT feedback — tooltip, filter tabs, composer visibility, clone style & links
- revise plans based on checker feedback

### Documentation

- evolve PROJECT.md after phase completion
- complete phase execution
- complete wire saved filters to board plan
- create phase plan
- add validation strategy
- research phase domain
- add gap closure phase 37 — wire saved filters to sprint board
- update milestone audit after gap closure phases 35-36
- evolve PROJECT.md after phase completion
- complete phase execution
- complete restore-sidebar-drag-reorder plan
- create phase plan
- UI design contract
- fix non-compliant spacing token in UI-SPEC
- UI design contract
- add validation strategy
- research phase domain
- record phase 36 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete saved filter UI integration plan
- complete saved filter UI components plan
- complete saved filter service layer plan
- create phase plan — 3 plans across 3 waves for saved filter restoration
- fix generic Cancel labels in dialog copywriting
- fix UI-SPEC checker issues
- add UI design contract for saved filters restoration
- add validation strategy
- research phase domain
- add gap closure phases 35-36
- add v1.5 milestone audit report
- complete phase execution
- complete visual verification checkpoint
- complete widget implementations plan
- complete widget grid infrastructure plan
- complete sidebar customization UI plan
- complete foundation types, registries, store extensions plan
- create phase plan
- add validation strategy
- research phase domain
- UI design contract for layout customization
- record phase 34 context session
- capture phase context
- update debug knowledge base with time-logging-500
- resolve debug time-logging-500
- complete release detail page quick task
- evolve PROJECT.md after phase completion
- complete phase execution
- complete saved filter wiring and visual polish plan
- complete bulk operations plan
- complete saved filter UI plan
- complete sprint goal banner and quick filter chips plan
- complete service layer and state stores plan
- complete test stubs plan
- create phase plan
- add validation strategy
- research phase domain
- revise UI-SPEC copywriting and spacing clarifications
- UI design contract for board-sprint-filters
- record phase 33 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- phase verification - 16/16 must-haves verified
- complete gap closure plan for types.ts regression
- create gap closure plan for types.ts regression
- complete time tracking UI plan
- complete attachments UI plan
- complete @mention autocomplete plan
- complete service layer plan
- create phase plan
- add validation strategy
- research phase domain
- fix blocked copywriting labels in UI design contract
- UI design contract for time tracking, attachments & mentions
- record phase 32 context session
- capture phase context
- complete phase execution
- resolve verification gaps — OverdueBadge sidebar + labels clarification
- complete visual verification plan
- complete activity timeline and watcher toggle plan
- complete overdue badge and clone issue plan
- complete changelog and watcher service layer plan
- update validation strategy task map
- create phase plan
- add validation strategy
- research phase domain
- UI design contract for issue detail enrichment
- record phase 31 context session
- capture phase context
- complete v1.5 project research

### Features

- wire saved filter store into sprint board with active filter banner
- add dnd-kit sortable drag-reorder to SidebarItemsList (GREEN)
- wire SavedFilterList into Sidebar, add Saved Filters to CommandPalette, upgrade widget
- wire SaveFilterDialog into UnifiedFilterBar and fix attachment delete prop
- create SavedFilterList component with context menu and tests
- add saved-filter store and filter service tests
- add JiraSavedFilter type and filter CRUD service
- create SaveFilterDialog and EditFilterDialog components
- add saved-filter store and filter service tests
- add JiraSavedFilter type and filter CRUD service
- remove Role section from settings (wizard-only)
- add section grouping to sidebar navigation
- fix role-preset wiring and extract sidebar settings section
- add edit mode toggle switch to dashboard
- create CustomJqlWidget and wire all 11 widgets into registry
- create WorkloadWidget, SavedFiltersWidget, PinnedIssuesWidget
- create NotificationsWidget, SprintProgressWidget, MrAttentionWidget, ReleasesWidget
- create panel wrapper widgets and refactor Dashboard to widget grid
- install react-grid-layout and create WidgetGrid, WidgetCard, WidgetPicker
- add SidebarItemsList and PresetButtons to Settings > Appearance
- add Switch component and refactor Sidebar to data-driven rendering
- create sidebar nav item registry and widget registry with role presets
- extend settings store with sidebar/dashboard layout state and v9 migration
- green badge for released versions in fix version picker
- filter fix version picker to unreleased + recent released
- add editable fix version picker to issue detail
- render transition buttons as colored status badges
- extend JiraTransition type with statusCategory
- migrate remaining status badge consumers to shared utility
- create shared status style utility and migrate category-key consumers
- add assignee avatars to subtask and epic story rows in issue detail
- add status transition popover to issue detail sidebar
- move MR label coverage indicator to sidebar with unlabeled MR details
- add label coverage indicator to release detail page
- add label summary section to release detail page
- make ticket key extraction case-insensitive with space tolerance
- add issue-MR matching table to release detail page
- add fetchMilestoneMRs and fetchFixVersionIssues helpers
- build ReleaseDetailPage with inline editing
- add updateFixVersion service, route wiring, and release row navigation
- wire saved filter JQL into sprint board filtering
- add saved filters to sidebar and command palette
- wire bulk selection and BulkActionBar into SprintBoardTab
- add card checkboxes, BulkActionBar, and BulkProgressIndicator
- create SavedFilterList and wire Save Filter into UnifiedFilterBar
- wire SprintGoalBanner and QuickFilterChipRow into SprintBoardTab
- create SprintGoalBanner and QuickFilterChipRow components
- create SaveFilterDialog and EditFilterDialog components
- create board-selection and saved-filter stores, extend filter store
- create board-config and filters service modules with type extensions
- add WorklogEntry, timeline integration, filter chip, and worklog CRUD
- create AttachmentsSection, AttachmentUpload, and integrate into IssueDetailContent
- add @mention autocomplete with cursor-anchored popover
- add TimeTrackingSummary, DurationInput, LogWorkPopover and integrate into sidebar
- create AttachmentThumbnail, AttachmentFileRow, and AttachmentLightbox components
- add timeline module with worklog entry type
- add service layer for time tracking, attachments, and user search
- add WatcherToggle sidebar widget with optimistic toggle
- add ActivityTimeline replacing CommentThread with unified changelog+comments view
- add Clone Issue button to action bar
- add OverdueBadge component with isOverdue utility and 3-location integration
- add watcher CRUD service with tests
- add changelog types, timeline merge/filter utilities with tests

### Miscellaneous

- complete v1.5 Dashboard Redesign & Feature Parity milestone

### Refactoring

- unify status transition UI across issue detail, task row, and board
- remove saved filters feature entirely

### Testing

- add failing tests for saved filter sprint board integration
- add failing tests for sidebar drag-reorder (RED)
- add failing tests for case-insensitive and space-tolerant ticket key matching
- persist human verification items as UAT
- add component test stubs for board and filter UI
- add service test stubs for board-config and filters
- persist human verification items as UAT
- add failing tests for isOverdue utility

### Merge

- resolve STATE.md conflict after 33-00 merge
## [1.4]

### Bug Fixes

- scope error styling to status badge only, not entire row
- align dev-tools source colors with notifications and improve error visibility
- move dev tools settings from DevToolsPage to Settings → Advanced
- restore Dev Tools link in sidebar above Settings
- add Cmd+Shift+D accelerator to native Dev Tools menu item
- add Advanced section to Settings sidebar for API logging toggle
- wire Cmd+Shift+D hotkey and render DebugModeSection in Settings
- disambiguate ConnectionsSection test selectors after label update
- resolve TopBar test regression and ConnectionsSection label ambiguity
- eliminate all double-casts from production code
- add vitest globals type reference to setup.ts
- fix 18 test failures across 7 remaining test files
- fix 41 test failures in SprintBoardTab, BacklogPage, MrAttentionTab
- remove unused _sprintIdsWithIssues variable from jira.ts

### Documentation

- update retrospective for v1.4
- re-audit milestone — all 27 requirements satisfied
- complete phase execution
- complete A11Y-01 checkbox cleanup plan
- mark A11Y-01 requirement as complete
- create phase plan for A11Y-01 checkbox cleanup
- add validation strategy
- research phase domain
- add gap closure phase 30 — fix A11Y-01 test regression
- mark 5 debug sessions as resolved
- evolve PROJECT.md after gap closure completion
- complete phase execution
- resolve UAT gaps and debug sessions after 29-05 gap closure
- complete gap closure plan - notification grouping and waterfall redesign
- create gap closure plan for notification grouping and waterfall redesign
- evolve PROJECT.md after phase completion
- complete phase execution
- complete gap closure plan for stale menu-debug-logs listener
- gap closure plan for stale menu-debug-logs listener
- complete operation labels and routing plan
- complete Developer Tools UI plan
- complete foundation stores and apiFetch plan
- create phase plan
- add validation strategy
- research phase domain
- fix UI-SPEC typography weights and CTA copy
- UI design contract for Developer Tools page
- record phase 29 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- update verification to passed (17/17)
- complete list virtualization plan
- complete Jira service module tests plan
- complete accessibility ARIA labels plan
- complete store tests and memoized unread count plan
- complete Jira service module tests plan
- create phase plan — 5 plans across tests, virtualization, accessibility
- fix typography contract to 2-weight scale (400/600)
- UI design contract
- add validation strategy
- research phase domain
- record phase 28 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete type safety cleanup plan
- complete jira service decomposition plan
- complete CreateEditIssueModal decomposition plan
- complete IssueDetailSidebar decomposition plan
- complete shared utilities & small refactors plan
- create phase plan — 5 plans across 2 waves
- fix typography contract to use 2 weights only
- UI design contract (non-visual refactoring phase)
- add validation strategy
- research phase domain
- record phase 27 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete gap closure plan for vitest globals type fix
- create gap closure plan for tsc vitest globals fix
- complete phase execution
- complete test regression fixes plan
- complete test infrastructure fixes plan
- create phase plan
- add validation strategy
- research phase domain
- record phase 26 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete dependency updates plan
- complete Biome linter/formatter plan
- create phase plan
- add validation strategy
- research phase domain
- record phase 25 context session
- capture phase context
- create milestone v1.4 roadmap (5 phases, 27 requirements)
- define milestone v1.4 requirements (27 requirements)
- start milestone v1.4 Internal Quality & Performance
- add debug sessions and quick task plans

### Features

- replace native title tooltip with styled popover on waterfall fetch bars
- redesign waterfall summary row and expanded view
- add response size tracking to FetchRecord and apiFetch
- add notification grouping and redesign waterfall timeline
- update frontend listener to navigate to /dev-tools
- update Tauri native menu to use menu-dev-tools ID
- wire /dev-tools route, Cmd+Shift+D shortcut, remove debug-logs references
- annotate apiFetch call sites with operation labels
- add OperationsTab and WaterfallTab with CSS bar visualization
- add DevToolsPage shell, settings panel, and LogsTab
- update apiFetch with granular dev tools toggles and operation profiler
- migrate settings store to granular dev tools toggles and create operation profiler store
- virtualize NotificationPopover and SprintBoardTab swimlanes
- install @tanstack/react-virtual and virtualize BacklogPage
- add ARIA labels and roles to CreateEditIssueModal form inputs and custom dropdowns
- cache _unreadCount in notifications store (PERF-02)
- enable Biome noExplicitAny and fix last any type
- create barrel index.ts, delete monolithic jira.ts
- decompose CreateEditIssueModal into orchestrator + sub-components
- create jira/ domain modules with types, client, and 11 domain files
- create orchestrator, barrel export, update original file
- create shared hook, utilities, and section sub-components
- extract useCreateEditForm and useIssueMutations hooks
- add global LazyStore mock and npm test script
- update major deps: Vite 8, plugin-react 6, TypeScript 5.9, jsdom 29
- auto-fix codebase with Biome and resolve violations
- install Biome and configure linter/formatter
- improve notification display, add fetchAuthoredMRs, split cursor tracking

### Miscellaneous

- complete v1.4 milestone — Internal Quality & Performance
- update minor/patch deps, remove unused autoprefixer and postcss
- fix trailing newline in config.json
- update app icon assets across all platforms
- add gitignore and remove .claude from git tracking

### Refactoring

- extract route config to routes.tsx, replace inline style
- extract createTauriStorage factory, deduplicate 5 stores

### Testing

- complete UAT - 8 passed, 2 issues
- add unit tests for epics, backlog, client Jira modules
- add unit tests for issues, sprints, fields Jira modules
- add unit tests for worklogs, links, projects modules
- add unit tests for 6 untested Zustand stores
- add unit tests for comments, transitions, versions modules

### A11y

- add htmlFor/id label associations to ConnectionsSection inputs
## [1.3]

### Bug Fixes

- add macOS dev-mode warning for desktop notifications
- add markAsUnread store action and wire toggle in notification popover
- move unread indicator to left accent bar, make changes more prominent
- use wheel events for trackpad swipe — macOS trackpad generates wheel not mouse drag
- rewrite swipe using mousedown + document listeners for reliable drag
- inline quick actions where timestamp is, no more overlap
- fetch project labels for colors instead of unsupported include_labels_details param
- polish MR detail page to match Jira detail patterns
- use correct cache key and shape for GitLab MR list
- polish linked issues and MR sections — match app hover style, fix overflow
- fix popover width — set w-[28rem] on PopoverContent wrappers, not inner divs
- collapsible sidebar polish — centered icons, hover chevron, visible headers
- backlog table overflow, epic badge cleanup, and sprint ordering
- prevent backlog table horizontal overflow with long text
- reduce popover max-heights for better sizing
- prevent image re-renders when opening notification popover
- comment composer sticky only in comment section, prevent image re-renders on menu/edit
- align sprint board column headers with card columns
- robust sprint field parsing for all Jira DC response formats
- move backlog filter bar inside scroll container so it scrolls away
- remove ml-4 left margin from subtask cards on sprint board
- remove epic badge from sprint board TaskCards
- epic color polish — remove accent bar, simplify sidebar badge, fix sprint board epic data
- show ? badge when story points field is undefined
- fix epic color not showing on detail + make epics page color prominent
- pinned tabs actively fetch issue data on app start
- move close X to vertically centered position, slightly bigger
- match close badge to app's shadcn style conventions
- hide breadcrumb bar entirely when trail is empty
- remove breadcrumb animation artifacts and stabilize DOM rendering
- stack key above summary in pinned tabs for compact horizontal layout
- breadcrumb trail using zustand store, image URL mangling
- remove QuickCreateInput from sprint board columns
- breadcrumb trail, image URL mangling, and navigation behavior
- breadcrumb trail accumulation and attachment image rendering
- distinct hover colors for read vs unread rows
- stronger hover bg on notification rows
- remove unread border-width difference, add active press state
- softer hover, better unread/read contrast
- stronger hover effect on notification rows
- make unread notifications and hover effect more prominent
- resolve Jira attachment images via auth and show mention display names
- pinned tabs overhaul — drag reorder, inline SVG icon, remove notifications route
- disable J/K navigation when issue detail sheet is open
- handle all cache shapes for recent item title resolution
- resolve epic titles from jira-epics-basic cache in handleIssueClick
- fix Navigation/Actions cmdk unmount race and resolve recent item title
- address UAT feedback — autofocus, create action search, recent item titles, KEYS-03 wording
- revise plans based on checker feedback
- use default menu and append Help item to avoid replacing native menus
- use mod+slash binding to bypass react-hotkeys-hook #1125
- revise plans 05 and 06 based on checker feedback
- make main sidebar nav scrollable in comfortable density
- scrollable sidebar nav + promote Debug to top-level Advanced section

### Documentation

- evolve PROJECT.md after phase completion
- complete phase execution
- complete verify-phase-22-empty-error-states plan
- write Phase 22 verification report
- create phase plan
- add validation strategy
- research phase domain
- mark phase 23 as architecturally resolved
- record phase 23 context session
- capture phase context — architecturally resolved
- add gap closure phases 23-24
- update STATE.md with notification row redesign completion
- update STATE.md with notification overhaul completion
- update STATE.md after MR detail polish and navigation changes
- update debug knowledge base with notification-bell-image-rerender
- resolve debug notification-bell-image-rerender
- update debug knowledge base with sprint-board-header-misalignment
- resolve debug sprint-board-header-misalignment
- update debug knowledge base with sprint-field-shows-dash
- resolve debug sprint-field-shows-dash
- update debug knowledge base with subtask-cards-shifted-right
- resolve debug subtask-cards-shifted-right
- update debug knowledge base with pinned-tabs-loading-bug
- resolve debug pinned-tabs-loading-bug
- create plan for full-page issue detail with back/breadcrumb nav
- complete better rich text rendering plan
- complete add all shortcuts to app toolbar plan
- complete generalize navigation shortcuts plan
- complete dashboard view retrofit plan
- complete remaining views retrofit plan
- create phase plan — 3 plans in 2 waves
- add research and validation strategy
- research phase domain — empty states, error recovery, auth detection
- UI design contract for empty states + error recovery
- record phase 22 context session
- capture phase context
- complete phase execution
- resolve UAT gaps and debug sessions after gap closure
- complete J/K navigation fix + notifications route plan
- complete branding and pinned tab UAT fixes plan
- create gap closure plans for UAT issues
- complete phase execution
- complete pin button and J/K navigation plan
- complete header redesign + pinned tab strip plan
- complete foundation artifacts plan
- create phase plan — 3 plans across 3 waves
- add validation strategy
- research phase domain
- revise UI design contract — fix typography and add focal point
- UI design contract
- record phase 21 context session
- capture phase context
- complete phase execution
- complete UAT gap closure plan
- create gap closure plan for UAT navigation search + recent item title bugs
- complete phase execution
- complete Create issue action gap closure plan
- create gap closure plan for PALETTE-04 Create issue action
- complete command palette integration plan
- complete CommandPalette component plan
- complete RecentItemsPopover plan
- complete foundation dependencies plan
- create phase plan
- add validation strategy
- research phase domain
- fix UI-SPEC copywriting empty state and clock icon accessibility
- UI design contract for command palette + recent items
- record phase 20 context session
- capture phase context
- re-verify after gap closure plans 05 and 06
- complete mod+slash hotkey fix plan
- complete native Help menu plan
- create gap closure plans 19-05 (mod+slash fix) and 19-06 (native Help menu)
- complete phase execution
- complete mod+/ hotkey gap closure plan
- create 19-04-PLAN.md gap closure for mod+/ hotkey
- complete phase execution
- complete keyboard-foundation plan 03
- complete shortcut registry + settings store data layer plan
- complete keyboard foundation test harness plan
- create phase plan
- add validation strategy
- research keyboard foundation phase
- fix UI-SPEC typography weight, spacing, and copywriting per checker
- UI design contract
- record phase 19 context session
- capture phase context
- complete phase execution
- complete density rollout plan — Phase 18 all plans done
- checkpoint reached — density rollout tasks 1+2 complete
- complete NotificationsSection + WorkflowSection plan
- complete density infrastructure and AppearanceSection plan
- update SUMMARY with icon cache diagnosis and resolution steps
- complete app icon plan — node-graph SVG + tauri icon pipeline
- complete Settings sidebar-nav + ConnectionsSection plan
- complete settings store migration + test scaffolds plan
- create phase plan
- add validation strategy
- research phase — app icon + multi-page settings
- record phase 18 context session
- capture phase context
- create milestone v1.3 roadmap (5 phases)
- define milestone v1.3 requirements
- complete project research
- start milestone v1.3 UX & Branding

### Features

- expand Jira changelog field extraction for richer notifications
- type badges + smarter body parsing for notification details
- refine notification row — source border, better hover, visible parent chip
- redesign notification row — avatar-led with sentence-style layout
- remove swipe gestures, use hover actions replacing timestamp
- Apple-style swipe actions for notification rows
- redesign notification interactions — click-to-open, swipe gestures, source badges
- redesign notification row — avatar-led layout with source dots and icon actions
- redesign notification row v2 — premium layout with action tray
- redesign NotificationRow with sleek compact card layout
- redesign notification actions — click to read, hover for actions
- redesign notification actions — open in browser + dismiss
- move quick actions into NotificationRow with polished hover UI
- enhance notifications with time groups, unread filter, bell pulse, inline actions
- replace dual notification icons with single tabbed popover
- split TopBar into two notification icons for Jira and GitLab
- add source-specific notification selectors and filter popover by source
- render MR list labels with GitLab hex colors
- enrich fetchProjectMRs with label colors and update GitLabMR type
- display milestone on MR detail and labels/milestone on MR list
- add source section headers to NotificationPopover and update tests
- add milestone to GitLabMRDetail and labels/milestone to GitLabMR types
- redesign NotificationRow with prominent source badges and improved layout
- add distinct badge colors for MR comment notification types
- remove inline NotificationDetail, add direct navigation
- render GitLab labels with actual colors on MR detail
- add GitLabLabel type and include_labels_details param
- replace external GitLab links with internal MR detail routes
- wire MR routes, sidebar nav link, and breadcrumb integration
- add MR detail page, MR list page, and fetchMRDetail API
- redesign linked issues and MR sections with compact cards
- apply comment sort order in views and add settings toggle
- add commentSortOrder to settings store with v7 migration
- add Merge Requests section to issue detail sidebar
- show only epic title in epic badge on issue detail sidebar
- pass jiraBaseUrl from TaskRow to InlineComment
- rewrite InlineComment with rich text, edit/delete, formatting toolbar
- widen notifications and recents popovers from w-96 to w-[28rem]
- show parent story context in NotificationRow for subtasks
- add parentKey/parentSummary to NotificationItem and enrich Jira queries
- redesign keyboard shortcuts modal with keycap badges and search
- implement collapsible sidebar with toggle button and Cmd+B shortcut
- add sidebarCollapsed to settings store with persistence
- unified filter bar with quickfilters, status filter, and UI redesign
- exclude Done epics from epic listing queries
- align popover sizes between recent items and notifications
- replace J/GL circles with avatar images in NotificationRow
- add authorAvatarUrl to NotificationItem and populate from APIs
- add clear notifications action, widen popover, color-code notification badges
- wire UnifiedFilterBar into BacklogPage and SprintBoardTab
- redesign comment section with sticky composer, card layout, edit/delete
- create shared filter store, UnifiedFilterBar, and quickfilter persistence
- add updateComment and deleteComment Jira API functions
- sticky active sprint header in backlog view
- make BacklogRow whole-row clickable
- make EpicRow whole-row clickable
- apply real Jira epic colors to all badge locations
- discover epic color field and add color mapping utility
- add icons to context menu, add send to front/back actions
- replace X button with right-click context menu for unpin
- sort MyTasks and SprintBoard by Jira rank order
- make linked issues clickable in issue detail sidebar
- inline X after summary text for compact tab close
- tiny corner X badge for tab close, no extra width
- swap type icon to X on hover for zero-width close button
- replace X close button with drag-off-strip to unpin
- restyle pinned tabs with compact layout and loading transition
- back button uses breadcrumb trail instead of browser history
- push source page into breadcrumb trail on list-to-issue navigation
- color-coded notification badges and gitlabUsername wiring
- per-type notification toggles and settings UI
- expand notification types and add 6 new fetchers
- styled change cards for status/assignee changes
- make Jira notification links navigate to issue detail instead of external Jira
- remove priority and labels from notification UI and data
- update notification UI to render multi-line arrow-format changes
- add changelog extraction to Jira and system note parsing to GitLab notifications
- rewire router and issue clicks to full-page /issue/:key route
- create IssueDetailPage route component with back/breadcrumb nav
- trim toolbar menus and add conditional Debug menu
- wire frontend event listeners for all menu actions
- build full native menu bar with all app shortcuts
- add Jira markup pre-processor, mention badges, callout panels, and image lightbox
- derive Navigation group from NAV_SHORTCUTS registry
- add navMeta to ShortcutEntry and NAV_SHORTCUTS export
- add Cmd+, keyboard shortcut to open Settings
- replace inline empty/error states in BacklogPage and MrAttentionTab
- replace inline empty/error states in MyTasksTab, SprintBoardTab, SprintProgressTab
- add notification error propagation and CommandPalette search empty state
- replace inline empty/error states in WorkloadTab, ReleasesTab, EpicsPage
- add ErrorState component and retrofit ApiError in jira/gitlab services
- add ApiError class, EmptyState, and StaleDataBanner components
- two-line pinned tab layout with skeleton loading state
- add selectedIssueKey to outlet context and /notifications route
- move branding from TopBar to Sidebar and copy app icon to public
- integrate J/K keyboard navigation in My Tasks, Notifications, and Backlog
- add pin button to IssueDetailContent header
- create PinnedTabStrip component and wire into AppLayout
- redesign TopBar with branding and remove Sidebar branding
- add J/K/Enter shortcut entries to registry
- create pinned-tabs store and useListNavigation hook
- add Create issue action to CommandPalette Actions group
- wire CommandPalette into AppLayout with shortcuts, recent item tracking, delete old search
- replace SearchOverlay with palette trigger and controlled notification popover in TopBar
- build CommandPalette component with fuzzy search and grouped results
- build RecentItemsPopover component
- add Phase 20 shortcut entries to registry
- install shadcn command component and create recent-items store
- wire frontend listener for native Help menu shortcuts event
- add native Help menu with Keyboard Shortcuts item
- change show-shortcuts hotkey from ? to mod+/
- wire ? shortcut in AppLayout and migrate SearchOverlay Escape to useHotkeys
- create KeyboardShortcutsPanel component
- extend settings store with keyboardOverrides + v2 migration
- create shortcut registry constants file
- install react-hotkeys-hook@^5.2.4
- apply density variants to sprint board cards
- apply density variants to list rows and sidebar nav
- implement WorkflowSection with sprint prefs + stale MR + debug
- implement NotificationsSection wrapping NotificationSettingsSection
- implement AppearanceSection with theme toggle and density selector
- add applyDensity() service, density CSS variants, and startup baseline call
- generate all platform icon sizes via tauri icon CLI
- generate node-graph SVG app icon source
- create ConnectionsSection with inline Jira/GitLab test feedback
- rewrite Settings.tsx as two-column sidebar-nav shell
- migrate settings store — add density + sprint pref fields

### Miscellaneous

- complete v1.3 UX & Branding milestone
- remove audit file from root (archived to milestones/)
- archive phase directories to milestones/v1.2-phases/

### Testing

- update tests for redesigned NotificationRow layout
- update notification tests for simplified popover behavior
- add comprehensive tests for mentions, images, panels, and mixed content
- add failing tests for mention badges, callout panels, and image rendering
- complete UAT - 2 passed, 0 issues, 7 skipped
- complete UAT — 12/12 passed, all gaps resolved
- diagnose UAT gaps - 4 issues with root causes
- complete UAT - 6 passed, 4 issues
- add regression test for navigation items in search state
- add Create issue action test coverage
- add CommandPalette tests covering open/close, groups, and selection
- add RecentItemsPopover tests
- diagnose UAT gaps - mod+slash key naming bug, missing native menu
- complete UAT retest - 1 passed, 1 blocker issue
- complete UAT - 1 passed, 1 issue
- add keyboardOverrides test cases to settings.store.test.ts
- add failing RED test scaffold for KeyboardShortcutsPanel
- update WorkflowSection test to reflect Debug moved to Advanced section
- add failing tests for WorkflowSection content
- write RED test scaffolds for Settings sidebar nav and ConnectionsSection

### Config

- switch model profile to quality, enable UI phase settings

### Style

- show ? badge for unestimated story points, prevent key wrapping
- polish context menu with separator, destructive unpin, PinOff icon
## [1.2]

### Bug Fixes

- close tech debt — backlog cache, docs, milestone audit
- close v1.2 audit gaps — BOARD-04 statusId bug + missing VERIFICATION.md
- correct CreateEpicDialog credential sources to useAuthStore + readSecret
- correct cache invalidation key in handleCreateModalClose
- correct cache invalidation key after create + close phase 13 verification
- add cursor-pointer to navigable links
- remove Sprint from epics, make Epic and Parent navigable
- remove Epic Name from epics, fetch epic name for stories
- show correct fields per issue type
- move Epic column header to match row order (after Key)
- show epic badge after key using fetched epicNames map, not null customfield_10015
- use noun prop in MultiFilterCombobox for correct count placeholder (epic/assignee/label)
- filter sprint sections by originBoardId derived from active sprint, not discovered boardId
- use Agile board issue API for sprint grouping to avoid customfield_10020 variance
- replace board sprint API with JQL openSprints/futureSprints to eliminate cross-project sprints
- hide cross-project sprints by filtering out sprint sections with no project issues
- filter board sprints by originBoardId to exclude cross-project sprints
- filter sprint issues by projectKey to exclude other-project stories
- assignee pagination, fuzzy filter, and custom field autocomplete
- replace useDebounce/useCallback with useEffect for assignee search
- fix assignee dropdown clipping and re-search on focus
- fix assignee search and subtask time estimate
- reset modal form state on each open
- restrict subtask creation to non-subtask issues
- wire Edit/AddSubtask handlers and add Epic Link filter
- resolve all TypeScript errors and test failures before human verification
- remove unused JiraIssueDetail import and onClose from IssueDetailBody
- set IssueDetailSheet width to 75vw
- use inline style to force 95vw sheet width (overrides shadcn base)
- widen IssueDetailSheet to 95vw
- widen IssueDetailSheet and sidebar for metadata display

### Documentation

- mark nyquist_compliant true — 16/16 BacklogPage tests green
- complete phase execution
- complete QuickCreateInput wiring plan — BOARD-04 GREEN
- complete CreateEpicDialog credential fix plan
- complete fix-cache-invalidation-key plan
- create phase 14 plans — BOARD-04, BACK-03, EPIC-04 gap fixes
- add validation strategy
- research phase wiring and credential bugs
- add gap closure phase 14
- complete phase execution
- complete human verification — EPIC-01..04 confirmed on Orange Jira instance
- checkpoint — test gate passed, awaiting human verification
- complete EpicDetailSheet plan
- complete epic filter and CreateEpicDialog plan
- complete EpicsPage route plan
- complete epic service foundation plan
- create phase 13 epic-management plan
- add validation strategy
- research phase epic-management
- record phase 13 context session
- capture phase context
- complete phase execution
- complete final-wiring plan — human verification approved
- complete plan — route/sidebar wiring confirmed, TypeScript clean, checkpoint pending
- add redesign notes for Jira-style backlog layout change
- complete move-to-sprint and create story plan
- complete BacklogPage UI implementation plan
- complete backlog view foundation plan
- create phase plan
- add validation strategy
- research backlog view phase
- record phase 12 context session
- capture phase context
- mark Phase 11 complete — all CREATE requirements verified
- complete wire modal entry points plan
- complete issue links plan — IssueLinkRow + CreateEditIssueModal wiring
- complete CreateEditIssueModal and DescriptionEditor plan
- complete Wave 0 RED stubs and jira.ts service foundation plan
- create phase 11 plan — 5 plans across 5 waves
- add validation strategy
- research phase create/edit issue form
- record phase 11 context session
- capture phase context
- mark BOARD-02 and BOARD-05 complete, clean up config trailing newline
- complete phase execution
- complete sprint board human verification — Phase 10 COMPLETE
- complete drag-and-drop + QuickCreate plan
- complete sprint board rebuild plan
- complete sprint board foundation plan
- create phase plan
- add validation strategy
- research phase sprint board redesign
- record phase 10 context session
- capture phase context
- complete phase execution
- complete plan 09-08 — IssueDetailSheet wired, sidebar widened, Phase 9 verified
- complete search/notifications entry point wiring plan
- complete IssueDetailSheet entry points plan
- complete inline field editors plan
- complete comment thread, compose box, and Open in Jira plan
- complete IssueDetailSheet foundation plan
- complete custom field discovery infrastructure plan
- complete install-deps Wave-0-scaffolds plan
- complete WikiRenderer plan
- create phase 9 plan (8 plans, 5 waves)
- add validation strategy
- research phase domain - issue detail, wiki rendering, custom field discovery
- record phase 9 context session
- capture phase context
- create milestone v1.2 roadmap (5 phases)
- define milestone v1.2 requirements
- complete project research
- start milestone v1.2 Jira Parity

### Features

- wire QuickCreateInput into SprintBoardTab DroppableCells
- show stories for epics, subtasks for stories, nothing for subtasks
- real avatar images on list, lazy load detail sheet data
- wire EpicDetailSheet into AppLayout
- create EpicDetailSheet slide-over component
- implement CreateEpicDialog component (EPIC-04)
- add epic filter bar to SprintBoardTab (EPIC-02)
- add /epics NavLink to Sidebar and register route in main.tsx
- create EpicsPage route component and CreateEpicDialog stub
- add EpicEnriched interface + fetchEpicsWithEnrichment + fetchEpicStories to jira.ts
- register /backlog route and Sidebar NavLinks; fix epicNames TypeScript errors
- make epic badge clickable to open epic detail
- epic names from API, multi-select for epic and assignee filters
- replace select dropdowns with fuzzy autocomplete comboboxes in BacklogFilterBar
- rewrite BacklogPage to Jira-style sprint sections layout
- add fetchSprintsForBoard and fetchBacklogView to jira.ts
- register /backlog route and add Backlog NavLink to Sidebar
- wire bulk move-to-sprint and Create Story in BacklogPage
- add openCreateStory to AppLayout Outlet context
- create BacklogPage component and fix BacklogRow avatar src
- create BacklogFilterBar component
- create BacklogRow component
- add fetchBacklogIssues and addIssuesToSprint to jira.ts
- add Edit button and Add Subtask button in IssueDetailContent
- lift modal state to AppLayout and add Sidebar Create Issue button
- wire issue links into CreateEditIssueModal
- implement IssueLinkRow component
- implement CreateEditIssueModal component
- implement DescriptionEditor component
- extend jira.ts with five new Phase 11 service functions
- redesign sprint board with story swimlanes and 3-column layout
- wire DndContext into SprintBoardTab and useDroppable into BoardColumn
- create DraggableCard and QuickCreateInput components
- rebuild SprintBoardTab with workflow-API columns and grouped layout
- create StoryHeaderRow and BoardColumn components
- add fetchProjectStatuses and createIssue to jira.ts
- wire IssueDetailSheet into search results and notification rows
- wire IssueDetailSheet into SprintBoardTab and MyTasksTab
- add onClick to TaskCard and onIssueClick to TaskRow
- implement inline field editors with optimistic updates in IssueDetailSidebar
- add comment thread and Open in Jira to IssueDetailContent (ISSUE-07, 09)
- build CommentComposer with wiki markup toolbar (ISSUE-08)
- build IssueDetailSheet, IssueDetailContent, IssueDetailSidebar
- extend settings store, update main.tsx discovery hook, remove discoverStoryPointsField
- implement WikiRenderer with jira2md + react-markdown pipeline
- add discoverCustomFields, fetchIssueDetail, updateIssueField to jira.ts

### Miscellaneous

- delete REQUIREMENTS.md — archived to milestones/v1.2-REQUIREMENTS.md
- complete v1.2 milestone
- install @dnd-kit/core and @dnd-kit/utilities
- install deps and shadcn Sheet for phase 9
- update GSD config and remove archived REQUIREMENTS.md
- archive v1.1 phase directories to milestones/v1.1-phases/
- complete v1.1 milestone

### Performance

- drop story enrichment from list page, load only on detail

### Refactoring

- route epic clicks through IssueDetailSheet, delete EpicDetailSheet
- update BacklogPage tests for Jira-style sprint section design

### Testing

- fill Nyquist validation gaps for CREATE-01..04
- fill Nyquist gaps for BOARD-02 and BOARD-05
- fill EPIC-03 nyquist gap with EpicDetailSheet behavioral tests
- add failing BOARD-04 test for QuickCreateInput wiring
- add Wave 0 RED test stubs for EpicsPage, EpicDetailSheet, CreateEpicDialog
- create BacklogPage.test.tsx with RED stubs for BACK-01..05
- Wave 0 RED stubs for CreateEditIssueModal and jira service functions
- add Wave 0 RED stubs for SprintBoardTab and QuickCreateInput
- add failing ISSUE-04 optimistic update tests
- add failing tests for IssueDetailSheet, IssueDetailContent, IssueDetailSidebar
- add Wave 0 test scaffolds for phase 9
- add failing tests for WikiRenderer

### Audit

- mark all ISSUE-01..09 requirements green — nyquist_compliant: true
- mark nyquist_compliant after confirming all 34 targeted tests GREEN

### Wip

- 11-create-edit-issue-form paused at task 2/2
## [1.1]

### Bug Fixes

- deduplicate notifications on prepend to prevent phantom growth
- prevent false disconnected state from network errors in apiFetch
- bootstrap jira identity on startup for existing sessions
- populate jiraUsername/displayName in auth store after Jira validation
- include done story points in WorkloadTab pts total
- scan MR source_branch for Jira ticket keys in linkMRToTask
- show skeleton while Stronghold token loads in MR panels
- preserve Jira/GitLab URLs when marking disconnected
- split useSettingsStore selector to avoid infinite re-render loop
- add last-refreshed timestamp to Dashboard header
- three dashboard data-loading bugs
- align MyTasksTab gitlab-mrs cache shape with MrAttentionTab/MrHealthPanel
- harden MyTasksTab against non-array data shapes
- fix default Button hover + improve ErrorPage styling
- fix SubtasksPanel sprintData?.issues access + align test assertions
- add cursor-pointer to subtask rows
- sanitize rehydrated notifications store on load
- fix subtask row clicks and always show view-all link
- fix subtask sprint query and remove broken notifications link
- add fetchProjectMilestonesInRange to gitlab.ts
- correct JiraIssue parent fixture shape in SprintBoardTab.test.tsx
- suppress orphan subtask rendering and fix onMutate cache shape in MyTasksTab
- add maxResults=200 to fetchSprintIssues parent query
- mark service disconnected in apiFetch on network error or 401
- remove resolution = Unresolved from sprint JQL queries
- resolve story points always showing zero across all tabs
- move Debug Logs to bottom section above Settings
- decode URL for readability in expanded view
- show full URL in expanded log entry
- pretty-print JSON before truncating response body
- pretty-print JSON response bodies
- hide Debug Logs sidebar link unless debug mode is enabled
- harden task counts and revert name-based GitLab matching
- fix fetchFixVersions endpoint + auth store rehydration guard
- add assignee filter to fetchSprintIssues subtask JQL
- rename handleProjectChange param from projectId to projectKey
- clear stale numeric activeJiraProject on store rehydration
- add issuetype not in subtaskIssueTypes() guard to sprint JQL
- revise plans per checker feedback

### Documentation

- archive resolved notifications-append-duplicates debug session
- archive resolved sprint-subtask-assignee-filter debug session
- resolve debug mr-attention-slow-load
- resolve workload tab debug sessions (pagination, person-filter, dropdown-loading)
- resolve debug mr-attention-slow-load
- resolve debug my-tasks-mr-matching
- resolve debug settings-url-loss
- complete phase execution
- complete /notifications page plan — SUMMARY + STATE updated
- complete MyTasksTab non-array guards plan — SUMMARY + STATE updated
- add gap closure plans 08-07 and 08-08 for UAT failures
- complete phase execution
- complete gap closure plan — SubtasksPanel + NotificationsPanel fixes
- add gap closure plan 08-06 for SubtasksPanel and NotificationsPanel fixes
- complete dashboard integration plan — visual checkpoint approved
- complete dashboard integration plan — checkpoint pending visual verification
- complete MrHealthPanel + SprintHealthPanel plan
- complete SubtasksPanel + fetchActiveSprint plan
- complete NotificationsPanel plan
- complete wave-0 test stubs plan
- create phase 8 plan (5 plans, 3 waves)
- add validation strategy
- research phase dashboard enrichment
- record phase 8 context session
- capture phase context
- resolve UAT gaps after gap closure
- complete phase execution
- complete MR attention tab userId race condition fix plan
- complete subtask toggle hit target plan
- create gap closure plans 04 and 05
- complete phase execution
- complete story/subtask hierarchy UI plan
- complete MrRow viaSubtaskKey and MrAttentionTab MRAT-02 plan
- complete Wave 0 test scaffold and MyTasksTab orphan fix plan
- create phase plan
- add validation strategy
- research phase 7 story/subtask hierarchy + MR subtask filter
- record phase 7 context session
- capture phase context
- resolve debug sprint-assignee-storypoints
- resolve debug sprint-done-always-zero
- resolve debug story-points-always-zero
- complete phase execution
- complete done-story exclusion fix plan
- create gap closure plan 06-03 for done-story exclusion fix
- complete phase execution
- complete sprint progress enrichment plan
- complete WorkloadTab rewrite plan — WORK-01/02/03 done
- create phase plan
- add validation strategy
- research phase workload and sprint progress enrichment
- record phase 6 context session
- capture phase context
- complete phase execution
- resolve debug sprint-subtask-assignee-filter
- resolve debug releases-tasks-and-gitlab-link
- complete phase execution
- complete fetchFixVersions endpoint + auth store rehydration plan
- complete subtask assignee filter plan
- create UAT gap closure plans 05-07 and 05-08
- complete phase execution
- resolve UAT gaps and debug sessions after 05 gap closure
- complete releases wrong project fix plan
- complete sprint JQL subtask guard plan
- create gap closure plans 05-05 and 05-06
- complete phase execution
- complete fetchSprintIssues two-query subtask plan
- complete JiraIssue type extension + discovery plan
- complete Releases sort and badge plan
- complete prerequisites plan — Badge, state filter fix, REL/APIF test stubs
- create phase 5 plan (4 plans, 3 waves)
- add validation strategy
- research phase api-foundation-quick-wins
- record phase 5 context session
- capture phase context
- create milestone v1.1 roadmap (4 phases)
- define milestone v1.1 requirements
- complete project research
- start milestone v1.1 Polish

### Features

- add type labels, metadata chips, clickable titles, linkified body to notification UI
- extend NotificationItem with url, type, priority, labels, entityState
- route notification poll requests through apiFetch for debug logging
- broaden Jira notifications to assignee/reporter/watcher updates
- widen onboarding wizard containers from max-w-md to max-w-lg
- increase default Tauri window from 800x600 to 1100x750
- count all stories in WorkloadTab Tasks column + Done badge
- WorkloadTab subtask nesting and worklog attribution
- add fetchIssueWorklogs to jira.ts
- add comment count badge to TaskRow and existing comments list to InlineComment
- remove /notifications route and Bell NavLink from sidebar
- add JiraComment type and fetchComments function to jira.ts
- remove NotificationsPanel from dashboard and delete its files
- register /notifications route and add Bell sidebar link
- create NotificationsPage full-page component
- wire ErrorPage as errorElement on root router
- add ErrorPage component using useRouteError and useNavigate
- add "View all notifications" Link to NotificationsPanel
- rewrite dashboard/index.tsx with 2x2 panel grid
- implement SprintHealthPanel (DASH-03) and add fetchActiveSprint
- implement SubtasksPanel and convert test stubs to GREEN
- implement NotificationsPanel DASH-04
- implement MrHealthPanel (DASH-02)
- add fetchActiveSprint and JiraActiveSprint to jira.ts
- extend MrAttentionTab with project-level MR pool
- add fetchProjectMRs to gitlab.ts and fix MyTasksTab userId + query key
- fix gitlab-mrs query key and enabled guard for userId race condition
- expand subtask toggle hit target in TaskCard
- restructure SprintBoardTab with boardGroups memo and per-story collapse
- extend TaskCard with subtask count chip, chevron, and isSubtask variant
- implement MRAT-02 subtask-linked MR inclusion in MrAttentionTab
- add viaSubtaskKey optional prop to MrRow
- switch sidebar links to NavLink with active styling
- mount GitLabReAuthBanner in AppLayout
- add GitLabReAuthBanner named export to ReAuthBanner.tsx
- add 15s AbortController timeout to apiFetch
- add Tech Lead sidebar branch with dual-section Developer and PM nav
- add Tech Lead radio option to onboarding and settings role pickers
- expand role type union to include 'tech-lead' in stores
- add Stories and Subtasks columns to assignee breakdown table
- sort assignee rows by total pts desc with alphabetical tiebreaker
- sort assignees by story points descending
- fix done-story exclusion — include as sub-rows, exclude from count/pts
- rewrite SprintProgressTab with stacked bar, time totals, per-assignee table
- rewrite WorkloadTab with table layout, time tracking, expand/collapse
- update all consumers from group to project selection
- add listGitLabProjects, fetchProjectMilestones, update stores
- add Debug Logs page, DebugModeSection, sidebar link, route wiring
- wire apiFetch into jira.ts and gitlab.ts
- add debug-log store, apiFetch wrapper, debugMode setting
- implement two-query subtask strategy in fetchSprintIssues
- wire useStoryPointsFieldDiscovery into AppLayout startup
- extend JiraIssue interface and add discoverStoryPointsField + settings store key
- implement Released/Unreleased/timing badges in ReleasesTab
- implement releases sort newest-to-oldest in useMemo
- install shadcn Badge and fix searchGitLabMRs state filter
- wire live React Query data into Dashboard overview cards
- add p-4 margins to 6 tab components and Sidebar Work section
- replace Dashboard tabs with role-aware overview summary cards
- add 6 flat routes and role-aware sidebar nav

### Miscellaneous

- record linter-injected SPPG-07 tests as deferred items
- archive phase directories from completed milestones
- delete REQUIREMENTS.md after v1.0 archive
- complete v1.0 MVP milestone

### Refactoring

- workload two-pass computation and jira pagination fixes

### Testing

- add failing tests for assignee/reporter/watcher notification broadening
- complete re-verification UAT — 2 passed, 0 issues, 3 skipped
- diagnose UAT gaps with root causes
- complete UAT - 7 passed, 3 issues
- add failing tests for NotificationsPanel DASH-04
- add failing test stubs for SprintHealthPanel and NotificationsPanel
- add failing test stubs for SubtasksPanel and MrHealthPanel
- add failing test for project-level MR linking in MyTasksTab
- update UAT with gap diagnoses
- complete UAT - 4 passed, 2 issues, 1 skipped
- add failing MRAT-02 tests for subtask-linked MR inclusion
- add failing HIER-02 stubs for SprintBoardTab
- add failing tests for stories and subtasks columns
- add failing test for assignee sort by total pts desc
- add failing test for sort assignees by story points descending
- diagnose UAT gap - done story exclusion in WorkloadTab
- complete UAT - 7 passed, 1 issue
- add failing SPPG-01/02/03 test cases for stacked bar, time totals, per-assignee table
- add failing tests for WORK-01/02/03 — RED state
- update tests for project-based GitLab selection
- add failing REL-01 fetchFixVersions endpoint tests
- add failing APIF-02 subtask assignee filter tests
- update UAT with diagnoses for gap closure plans 07-08
- complete UAT - 1 passed, 3 issues
- add failing APIF-02 guard test for subtask-only first query
- add gap diagnoses to UAT
- complete UAT - 1 passed, 2 issues, 1 skipped
- add failing APIF-02 tests for two-query subtask strategy
- add failing tests for APIF-01 type extension and APIF-03 discovery
- add APIF-04 and REL-01/02/03 test stubs (RED state)
## [1.0]

### Bug Fixes

- remove unused React import from SearchResultPanel test
- extract data.values from paginated envelope in fetchFixVersions
- add vi import to scaffold test files for TypeScript compliance
- serialize vault initialization to prevent concurrent open failures
- gate queries on token state to prevent 401s before PAT loads
- use native-tls for tauri-plugin-http to trust system certificate store
- humanize network error messages in TokenSection group/project fetches
- replace silent-failure guards with loading/error state in TokenSection
- resolve Phase 2 UAT issues — styles, CORS, persistence
- resolve Phase 1 UAT issues — all 15 tests passing
- enable dangerous-settings feature for tauri-plugin-http
- add acceptInvalidHostnames to danger config
- accept invalid TLS certs and fix selector width
- correct http plugin scope format in capabilities
- migrate to Tailwind v4 to match shadcn@4.0.5 components
- update gitlab.test.ts to use vi.mock for plugin-http fetch
- update jira.test.ts to use vi.mock for plugin-http fetch
- switch service files to tauri-plugin-http and add capabilities scope
- resolve 4 TypeScript compile errors in foundational files

### Documentation

- complete gap closure and re-verify phase — 25/25 must-haves
- resolve UAT gaps after 04 gap closure
- complete ADF description fix and GitLab chip plan
- complete fetchFixVersions fix plan — paginated envelope extraction
- create UAT gap closure plans 04 and 05
- complete phase execution
- complete global search plan — SearchOverlay, SearchResultPanel, TopBar updated
- complete PM dashboard tabs plan
- complete service layer and test scaffolds plan
- create phase plan
- add validation strategy
- research phase pm-dashboard-search
- move resolved debug sessions to resolved/
- record phase 4 context session
- capture phase context
- resolve debug missing-styles-tailwind
- complete phase execution
- complete StatusPopover/InlineComment wiring plan
- complete fix silent-failure selectors plan
- complete delete-dead-config-files plan
- create UAT gap closure plans 05-07
- complete phase execution
- complete notification UI plan — TopBar, popover, polling, settings
- complete notification engine plan — 18 tests GREEN, NOTF-01 through NOTF-06
- create phase 3 plans
- add validation strategy
- research phase — notification plugin, polling strategy, store patterns
- record phase 3 context session
- capture phase context
- complete phase execution
- complete write actions plan — StatusPopover + InlineComment with optimistic transitions
- complete link engine integration plan summary and state updates
- complete developer dashboard UI plan summary and state updates
- complete service layer and link engine plan
- create phase plan
- add validation strategy
- research phase 2 developer dashboard
- record phase 2 context session
- capture phase context
- complete phase execution
- complete fix-plugin-http-mock-pattern plan
- fix gap-closure plan dependencies and sync VALIDATION.md
- create gap closure plan 06 — fix 9 failing unit tests
- complete UAT gap closure plan — CSS import and CORS fix
- add UAT gap closure plan 05 (CSS import + CORS fix)
- add root causes from diagnosis
- complete phase execution
- complete gap closure plan — TS errors fixed, queryClient wired
- create gap closure plan 04 (TS errors + queryClient wiring)
- complete role picker, settings page, and app shell plan
- complete PAT onboarding flow plan
- complete foundation scaffold plan
- add validation strategy
- research phase 1 foundation — Tauri 2 scaffold, Stronghold, Jira/GitLab validation
- record phase 1 context session
- capture phase context
- create roadmap (4 phases)
- define v1 requirements
- complete project research
- initialize project

### Features

- add adfToPlainText utility and fix Jira description excerpt
- wire Search icon into TopBar and complete SearchResultPanel tests
- build SearchOverlay with debounced parallel search and grouped results
- extend store, wire role-conditional dashboard, implement SprintProgressTab and WorkloadTab
- extend service types and add new API functions
- add write mutations to MyTasksTab and pass new props to TaskRow
- wire StatusPopover and InlineComment into TaskRow
- Task 2 — NotificationPopover, NotificationSettingsSection, layout wiring
- Task 1 — TopBar, NotificationRow, NotificationDetail components GREEN
- implement notification engine — service, stores, plugin registration
- wire link engine into dashboard UI with review health badges
- create linkEngine, dashboard store, extend settings store
- extend Jira and GitLab service layers with Phase 2 API functions
- add missing CSS import to main.tsx
- wire Jira project-switch cache invalidation in TokenSection
- implement onboarding wizard components
- implement jira and gitlab service modules
- implement service layer, stores, and placeholder routes
- scaffold Tauri 2 + React 18 + TypeScript project

### Miscellaneous

- create Wave 0 test scaffolds for PM tabs and search
- delete dead PostCSS and Tailwind v3 config files
- remove root .gitignore and node_modules cache
- consolidate into single repo and add gitignore
- add project config

### Testing

- re-verify gap closures — 2 passed, 1 minor style issue
- add failing tests for ADF description and clickable ticket chip
- add failing tests for fetchFixVersions paginated envelope
- update UAT with gap diagnoses
- complete UAT - 7 passed, 3 issues
- add failing tests for ReleasesTab PM-03/PM-04
- add failing tests for SprintProgressTab and WorkloadTab
- add failing tests for matchGitLabToFixVersion
- complete UAT - 7 passed, 0 issues, 7 skipped (no live notifications)
- complete UAT - 3 passed, 5 issues, 3 skipped
- add Wave 0 failing test scaffolds + Tauri notification plugin install
- add failing tests for MR linking and TaskRow health chips
- add failing tests for linkEngine pure functions
- add failing tests for Phase 2 Jira and GitLab service functions
- add failing tests for Phase 2 Jira and GitLab service functions
- complete UAT - 2 passed, 2 issues, 11 skipped
- add failing JiraStep tests; install shadcn components
- add failing tests for jira and gitlab service modules
- add failing test scaffolds for service layer

### Style

- unify Jira and GitLab link style in SearchResultPanel

### Wip

- 02-developer-dashboard UAT paused — 11/11 tests pending, infra fixes committed
- 01-foundation UAT in progress, paused at test 2/15
