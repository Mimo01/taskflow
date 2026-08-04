# Changelog

All notable changes to Taskflow are documented here.

## [1.13.5] — 2026-08-04

### Added

- **Issue detail — Deployment package field under Fix Versions** — the sidebar now shows a read-only "Deployment package" row (sourced from Jira's custom field) between Fix Versions and Flagged, with an em dash placeholder when unset.
- **Issue detail — Worklog progress bar** — the Worklog tab now shows a spent-vs-estimated progress bar, matching the Standup page's styling, rolling up time from the issue itself plus its subtasks.
- **Issue detail — copy Jira link button** — a copy-link icon is now joined into the "Open in Jira" split button, copying the issue's browse URL with a brief checkmark confirmation.

### Fixed

- **Issue detail — Time Tracking field always showed "No time logged"** — the sidebar now reads Jira's server-computed aggregate time fields (which reliably cover Tempo-logged time and subtask estimates) instead of only the per-issue timetracking object, falling back to the nested object when aggregates are absent.
- **Releases page — row click now opens a preview, key click navigates full-page** — clicking an issue row on the release detail page now opens the peek panel like the rest of the app, while clicking the issue key still navigates directly; the release-name breadcrumb is now preserved when opening a full page from the release peek panel instead of falling back to the generic "Release" label.

## [1.13.4] — 2026-07-09

### Added

- **Issue detail — attachment preview now supports text, code, PDF, video, and audio files** — the attachment lightbox has been generalized into a type-switching preview modal. Clicking a previewable attachment row now opens an inline viewer instead of only working for images: text/markdown/log/CSV files render as plain text, recognized source files (JS/TS, Python, Ruby, Go, Rust, Java, C/C++, shell, YAML, XML, HTML, CSS, JSON) get syntax highlighting, PDFs render in an embedded viewer, and video/audio files get native media playback controls.

### Fixed

- **Attachment preview — hardened kind detection and loading behavior** — addressed follow-up code-review findings on the new preview modal: more reliable mimeType/extension-based classification, and fixes to how authenticated attachment blobs are fetched and released across preview types.

## [1.13.3] — 2026-07-02

### Added

- **Backlog — fix version badge on each story row** — a new badge cell appears before the epic badge, showing the first fix version assigned to the story so you can see release targeting at a glance without opening the issue.

### Fixed

- **Backlog — summary column fills available width without truncating too early** — the summary cell now uses a per-row flex layout instead of table layout, so it expands to fill all remaining space and only truncates when the row truly runs out of room. Fixed-width cells (type, key, priority, epic, fix version) take exactly the space they need; the summary absorbs the rest.
- **Sprint board — dragging a card to the same-status column no longer fires a transition** — dropping an issue onto the column it already belongs to was silently posting a no-op transition to the Jira API; that call is now suppressed, leaving the board state unchanged.
- **Issue edit — Sprint field now saves correctly** — the custom-field wrapper for Sprint fields now emits a bare integer id instead of `{ id: N }`. Jira Data Center rejects the object form with "Number value expected", causing Sprint changes made from the edit form to fail silently.
- **Issue edit — Tempo Account field now saves correctly** — the wrapper for Tempo Account fields now emits a bare string id instead of `{ id: "…" }`. The Tempo plugin rejects the object wrapper, causing Account selections to fail with a 400 on save.

## [1.13.2] — 2026-06-18

### Changed

- **My Tasks — hide subtasks under DONE stories in Current Sprint** — in the Current Sprint tab, subtask rows are no longer rendered beneath a story whose status is in the DONE category, cutting noise from completed work while keeping the parent visible.
- **Tempo worklog — sensible default description** — logging work with a blank comment now defaults the description to "Working on issue {PROJ-KEY}" instead of submitting an empty worklog comment.

### Fixed

- **Backlog — flagging issues now works on Jira Data Center** — flagging an issue from the Backlog used to fail with "Field 'customfield_…' cannot be set. It is not on the appropriate screen" because it issued a direct custom-field PUT subject to edit-screen security. Flags are now set through Jira's own agile-board endpoint (the same mechanism the native board uses), which resolves the Flagged field server-side and bypasses that restriction. If a flag update still fails, a dismissible banner explains what to ask your Jira admin.
- **Search — no more false-positive "Direct Match"** — the command palette's Direct Match row no longer shows a stale issue from a previous key lookup when the current query doesn't match a Jira key pattern. The key-lookup result is cleared when disabled and the row is gated on the active query.
- **My Tasks — DONE story time still rolls up when subtasks are hidden** — time logged on a completed story's subtasks is now aggregated independently of whether those subtask rows are displayed, so the parent's time total no longer drops to zero once its subtasks are hidden.
- **My Tasks — DONE stories strike through the key only** — a completed story now crosses out just its issue key, leaving the summary readable instead of striking through the whole row.
- **Command palette — Space no longer closes the panel** — keydown events inside the command palette panel are no longer allowed to propagate, so pressing Space while typing a query keeps the palette open.

## [1.13.1] — 2026-06-17

### Added

- **Search — debounced auto text search in the Issues group** — the Issues section of the command palette now automatically searches as you type (with a short debounce), and while a query is active it shows only matching results rather than mixing in the recent-items list. The previous 10-item cap on text search results has also been removed.
- **New keyboard shortcuts — navigate directly to 7 pages** — Go menu and global accelerators now cover: AIO Projects (Cmd+Shift+A), Backlog (Cmd+Shift+B), My Tasks (Cmd+Shift+M), Releases (Cmd+Shift+R), Sprint Board (Cmd+Shift+S), Standup (Cmd+Shift+N), and Dashboard (Cmd+Shift+D).

### Changed

- **Command palette shortcut moved to Cmd+F** — the command palette/search is now opened with Cmd+F instead of Cmd+K, and a capture-phase handler suppresses the native WKWebView find-in-page panel so the shortcut never leaks to the OS.
- **My Tasks — static status pill** — the status badge in My Tasks rows is now a plain display pill; status changes happen through the existing action menu, removing an accidental clickable area on the row.

### Fixed

- **Issue edit — no more 400 errors when saving unchanged custom fields** — the edit form now only submits custom fields the user actually changed; pre-filled fields (such as Sprint or Tempo Account) that were not touched are omitted from the PUT body, fixing a 400 "Number value expected" / "Account is required" error that appeared immediately after opening an issue for edit.
- **Issue detail — attachments now load on Jira Data Center** — the issue detail fetch now explicitly requests the `attachment` field alongside `*navigable`; attachment was silently absent on Jira DC because it is not a navigable field, causing the attachments panel to always appear empty.
- **AIO cycles — breadcrumb back-navigation** — clicking a cycle from the AIO project overview now pushes a breadcrumb so the back button returns to the overview page instead of leaving the AIO section entirely.
- **AIO issue detail — test runs always start collapsed** — test run groups on the issue detail panel now initialize collapsed on every open, preventing leftover expanded state from a previous issue.

## [1.13.0] — 2026-06-16

### Added

- **My Tasks — a dedicated personal task page** — A new "My Tasks" entry in the sidebar gives you a focused home for your own work. It opens in a smart "My Day" order (flagged and blocked first, then overdue, then issues in review with your merge request, then in-progress, then to-do), with a count strip that doubles as quick filters. Each row shows type, key, priority, status, due date (overdue highlighted), story points, merge-request health, and time logged. You can peek or open an issue, change its status, and log work right from the row. A scope toggle switches between your current sprint and everything assigned to — or reported by — you across sprints and the backlog (fetched with full server-side paging, so nothing is silently cut off).

### Changed

- **Dashboard redesign** — The dashboard is rebuilt around three focused regions: a personalized hero greeting that now shows the current sprint day, a top row pairing a "My Issues" sprint-progress card with an "Upcoming Releases" readiness timeline, and a full-width "Past 7 Days" chart that overlays your logged hours against your commit activity. Each section loads and degrades on its own and reuses already-fetched data, so the dashboard stays fast and adds no new API calls.
- **Standup recap — choose today** — The standup notes day selector now lets you pick today, not just earlier working days, and resolves the selected day correctly around midnight.

### Fixed

- **AIO test status on deep links** — Test cases no longer show "Not Run" when you open a cycle through a pinned tab or a deep link; the execution-status map now initializes on the cycle detail page itself, not only from the overview page.

## [1.12.4] — 2026-06-12

### Added

- **Releases — wrong-milestone MR warning** — on the release detail page, a task whose linked merge request targets a different (or missing) release milestone now shows a "Wrong milestone" warning, with the MR clickable so you can jump straight to it.
- **Issue detail — priority dropdown icons** — the Priority selector on the issue detail page now shows a colored priority icon next to each option and in the trigger, matching how priorities look elsewhere in the app.

### Fixed

- **Bulk subtasks — inherit required custom fields from the parent** — bulk subtask creation now inherits required custom fields (e.g. the Tempo "Account" field) from the parent issue, fixing a 400 "Account is required" error that only affected the bulk path while single-create worked.
- **Priority pickers — scheme-scoped values** — priority pickers now offer only the priorities allowed by the issue project's priority scheme, instead of the full global list.
- **Issue detail — subtask status changes propagate without reload** — transitioning a subtask from the drawer/peek preview now updates the issue detail view immediately, without needing a manual refresh.
- **Peek panel — drawer actions wired up** — the edit, clone, and add-subtask actions now work from the issue peek/drawer preview.

## [1.12.3] — 2026-06-10

### Added

- **Wiki renderer — clickable issue keys in prose** — issue keys (e.g. `ABC-123`) written in issue descriptions, comments, and wiki text now render as links that open the issue, matching how keys already behave elsewhere in the app.
- **Backlog — send a story to the top or bottom of its section** — the story right-click menu now has "Send to top" and "Send to bottom" actions that re-rank a story to the edge of its Backlog section in a single click.

### Changed

- **Backlog — tidier story context menu** — the story right-click menu is reordered and the redundant sprint/backlog divider removed.

### Fixed

- **Issue transitions — resolution picker dialog** — the Resolution prompt shown when moving an issue to a done status now appears as a properly centered dialog instead of being mispositioned.
- **GitLab — clearer TLS certificate errors** — GitLab connection failures caused by TLS/SSL certificate problems now surface an actionable message instead of a generic failure.

## [1.12.2] — 2026-06-09

### Added

- **Setup wizard — expandable error log** — when the Jira or GitLab connection step encounters an error, an expandable panel shows the full event log so you can diagnose what went wrong without guessing.
- **Setup wizard — save progress per step** — onboarding state is now saved at the end of each completed step, so restarting the wizard mid-flow resumes from where you left off.
- **Command palette — always open full page** — selecting an issue from the command palette now navigates directly to the full issue page, bypassing the peek preview.
- **Fullscreen ESC guard** — pressing Escape while the app is in fullscreen mode no longer exits fullscreen; the key is consumed so native fullscreen stays intact.
- **Drag cancel with Escape** — pressing Escape during a drag on the backlog or sprint board cancels the drag and snaps the card back to its original position.
- **Relative time — years + days** — time-ago labels (comments, issue detail, etc.) now show "1 year 3 days ago" for events over a year old, replacing the previous months-based fallback.
- **Wiki renderer — triple-brace teletype** — `{{{...}}}` triple-brace macros now render as inline code/teletype, consistent with the `{{...}}` variant.
- **AIO cycle defects — click to peek** — clicking a defect key on the AIO cycle defects page now opens the side peek preview; clicking the row title still opens the full page.

### Fixed

- **Setup wizard — Jira infinite render loop** — fixed a loop in JiraStep that triggered repeated board-sync calls, causing the wizard to stall.
- **AIO cycle defects — breadcrumb navigation** — clicking a defect key now correctly pushes the issue route to the breadcrumb trail.
- **AIO cycle defects — horizontal overflow** — the defects table no longer overflows on narrow windows; the table is now horizontally scrollable with minimum column widths.
- **Wiki renderer — Jira teletype inner-brace format** — fixed `{{{TEXT}}}`-style macros (with extra inner braces) not rendering as teletype.

## [1.12.1] — 2026-06-08

### Added

- **Standup Notes — created issues in Yesterday** — the Yesterday column now includes a "Created" section showing Jira issues you created that day, so work you kicked off is captured alongside activity and worklogs.
- **Standup Notes — worklog descriptions** — worklog entries now show a second line with the log description (when present), replacing the previous single-line summary.

### Fixed

- **Standup Notes — worklog display** — worklog rows now collapse to a single flat line per entry with a muted description, instead of accumulating into an unlabelled group.
- **Standup Notes — JQL escaping and loading guards** — project keys with special characters are now correctly escaped in JQL queries; loading guards prevent stale renders while data is in-flight.
- **Standup Notes — watched-person GitLab identity** — switching to a watched person now correctly resolves their GitLab user for commit matching, so MRs and commits attributed to teammates show up reliably.

## [1.12.0] — 2026-06-07

### Added

- **Universal issue peek** — click any issue anywhere (sprint board, backlog, standup, dashboard, search, command palette) to open a non-blocking slideover preview on the right; the view behind it stays scrollable and clickable, clicking another issue swaps the preview without closing it, and the issue **key** still opens the full page. Dismiss with Escape, the close button, or "Open full page".
- **Drag-to-rank on the Backlog** — drag stories within a Backlog section to reorder them; the new order saves to Jira and holds through background refreshes, with rollback if the save fails.
- **Drag-to-transition on the Sprint Board** — drag a card between columns to change its status; columns that cover several workflow statuses split into labelled drop zones during the drag so you can pick the exact transition, with optimistic move and rollback on failure.
- **Subtask templates & bulk creation** — create named subtask templates in Settings (each line with a required title plus optional fields like assignee, priority, labels, estimate, story points, due date, and components). From a parent issue, apply a template or build a list, preview and edit each row, then create all subtasks at once with per-row progress; a partial failure can be retried without duplicating already-created subtasks. Parent-inheritance placeholders (`@inherit`, `@current`, `@unassigned`) fill in at creation time.
- **Resolution control on issue transitions** — setting an issue to a done status now prompts for a Resolution (e.g. Done, Won't Do) as part of the workflow transition, from the issue detail sidebar, the status popover, and sprint-board drag/right-click — so issues close with the correct resolution instead of being left unresolved.
- **Done-state visuals everywhere** — done current-sprint stories now appear struck-through on the Backlog list, the Standup Notes Today section, and the Dashboard, matching the sprint board.
- **Issue-type color on cards** — sprint-board and backlog cards carry a left-edge color accent by issue type (Bug, Story, Task/Subtask, Epic), and priority is now shown as the Jira priority icon in the card footer and swimlane header.
- **Choose your Jira board** — pick which board drives the app (sprint board, backlog, ranking) from the onboarding wizard and Settings; the active board name is shown in the Jira connection card.
- **Issue-type and priority icons in lists** — backlog rows, the sprint-board story swimlane header, and the Epics page now show issue-type and priority icons in their own columns.
- **Filter by Unassigned** — the assignee filter on the Backlog and Sprint Board now includes an "Unassigned" option.
- **Standup Notes — watched person** — switch the standup view to a teammate via a "Showing: <name>" header picker (defaults to you); MR sections that need a matched GitLab account show a hint instead of leaking your own MRs.
- **Standup Notes — pick the recap day** — click the "Yesterday" column heading to recap any of the last 14 days instead of just the last working day.
- **Clear app cache** — a new "Clear all app cache" action in Settings → Advanced → Data clears the avatar and data caches.

### Changed

- **Subtask parent link** — on a subtask's detail page the parent is now shown in the main content area (matching how subtasks appear under a story), not tucked in the sidebar.
- **Issue peek layout** — the peek is a single, consistently padded column with Linked Issues and Merge Requests placed just above the activity feed, and a header showing the issue-type icon, key, and title.
- **Notifications & dashboard clicks** — clicking an issue in notifications or on the dashboard opens the full issue page directly (rather than the peek), since those surfaces are navigation entry points.
- **Epics page** — restyled to match the Backlog (headerless table, consistent column widths, and the same Unassigned-avatar treatment).
- **Standup Notes — status transitions** — yesterday's status changes now render as colored status pills (from → to) and collapse to a single initial → final transition per issue; sub-task activity nests under its parent story.

### Fixed

- Peek: "Open full page" now keeps the breadcrumb trail back to the page you opened the peek from.
- Sprint board / issue detail: editing fields or transitioning an issue now refreshes the board cache so the board stays in sync.
- Backlog: drag-and-drop no longer drifts by a row or snaps back during auto-scroll.
- Wiki: `[^filename]` attachment references now render as links instead of literal text.
- Unassigned issues now show a visually distinct dashed avatar placeholder instead of looking like an assigned user.
- Backlog: story-point badges use a fixed width so single- and double-digit values line up.
- Bulk Create Subtasks: long resolved assignee names are truncated and fields no longer collapse on narrow rows; the issue-type and template name show in the dropdowns instead of their internal ids.

## [1.11.0] — 2026-06-01

### Added

- **Sprint board — time-in-column badge** — each card now shows how long the issue has been in its current column, sourced from the GreenHopper `timeInColumn` field
- **Issue detail — progressive rendering** — the header (title, key, status, assignee) renders as soon as the base request resolves; comments, subtasks, and changelog each load independently with a localized skeleton, so a slow section never blanks the whole panel
- **Releases — pin to tab strip** — releases can now be pinned to the header tab strip, just like issues and AIO cycles
- **Releases — GitLab milestone description** — when a release is linked to a GitLab milestone, its description is shown alongside the Jira description
- **Releases — detail panels** — the release detail page now includes MR-state distribution, contributor list, issue-status distribution, and story-point effort panels
- **Releases — combined edit modal** — editing a release opens a modal that saves to both Jira (fix version) and the linked GitLab milestone in one action

### Changed

- **Sprint board — single-call data fetch** — all issues, columns, swimlanes, statuses, priorities, types, and epics now load in a single `allData.json` request (replaces the previous multi-call chain and per-issue enrichments)
- **Backlog — single-call data fetch** — all backlog issues now load in a single `data.json` request (replaces paginated REST + per-issue lookups)
- **Workflow transitions — cached per project** — available transitions are fetched once per project and cached by `projectId × issueTypeId → workflow`; the previous per-issue REST `/transitions` call on every drag-to-transition and status change is gone
- **Sprint board — filter bar** — the filter row is now full-width with horizontal scroll; the reload and manage buttons stay pinned at the right and are unaffected by scroll
- **Sprint board — quick filters** — Jira server-side quick filters (loaded from the board editmodel) have been removed; the app's own saved filters remain
- **Filters — Jira "Save Filter" removed** — the Save Filter button and Jira-saved-filter flow are gone from the filter bar; only app-local saved filters remain
- **Releases — layout** — deduplicated info between the main content and sidebar; issue status and story points moved to sidebar panels

### Fixed

- Status transition from the issue detail panel now refreshes the sprint board immediately
- Backlog: epic chips, flagged indicator, and flag action restored after the data-layer migration
- Backlog: CLOSED sprints are excluded from the move-to-sprint index so they no longer appear as move targets
- Backlog: epic column no longer clips the issue summary title at narrow widths
- Sprint board: columns no longer overflow horizontally at narrow window widths
- Notifications: scroll position no longer jumps when the list refreshes
- Filters: the Save button is hidden when the active filter already matches a saved one
- Fix versions (issue detail field) are now sorted by release date, with undated versions listed first

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
