# Changelog

All notable changes to Taskflow are documented here.

## [1.14.20] — 2026-11-12

Notifications got a full redesign, plus easier setup and story editing.

### New
- **Notification panel** — stacks per issue, quick actions
- **In-app notification banners**
- **Condensed desktop notifications**
- **Epic picker on stories** — and Add story from an epic
- **Searchable pickers** in Settings and setup
- **Wizard reopens** at steps an update changed

### Improved
- **Attachment tiles** — one grid, more file types preview
- **Issue section headers** — one shared style
- **No active sprint** messaging and card error states

### Fixed
- Duplicate notifications, package mismatches, peek over-scroll
- Settings reload after saving a token, setup wizard Done step

## [1.14.19] — 2026-11-09

Clearer handling of issues you can't open.

### New
- **Issue unavailable panel** — with Open in Jira and Try again
- **No access** marker in Recent
- **Refresh button** on issue detail

### Improved
- **Compact issue actions** in narrow windows
- **Square row selection** on My Tasks and Standup

### Fixed
- Story time in All assigned, Standup peek highlight, Linux download links

## [1.14.18] — 2026-11-05

Zoomable previews and one person picker everywhere.

### New
- **Zoomable previews** — fit, zoom and font size controls
- **One person picker** — searches people on the server
- **All my subtasks** on Standup Today

### Improved
- **One time bar design** across the app
- **Responsive relationship rows** and page headers
- **Release detail graphs** — same layout for every release
- **Standup in narrow windows**

### Fixed
- Deployment package checks cover Bugs, subtask estimates
- Preview layering and closing, person picker width

## [1.14.17] — 2026-11-03

Fix release coverage straight from the release page.

### New
- **Fix tasks not covered** by the release
- **MR status on task rows** — with per-MR fixes
- **Milestone on merged MRs**
- **Graph rows filter the Issues table**
- **Epic time by status and person**

### Improved
- **Time bar colours** — amber up to 125%, then red
- **Release Progress graph** — larger, less cluttered
- **Release detail header** and page header sizes

### Fixed
- Linked MRs on issues, MR donut count, not-covered reasons
- Package fix with several fix versions, release page scrolling

## [1.14.16] — 2026-11-02

Filter and sort release issues.

### New
- **Filter and sort release issues**
- **Filter release tasks by MR label**
- **Uncovered MR details** — reason, author, reviewers
- **Resizable Standup Notes columns**

### Improved
- **All MR labels shown**
- **Standup density** follows the density setting

### Fixed
- MR label counts, sticky table header, release team avatars
- AIO assignee names, dark mode app icon

## [1.14.15] — 2026-10-30

Releases list and release detail are redesigned.

### New
- **Redesigned Releases page**
- **Redesigned release detail page**
- **Deployment package mismatches** as an action list
- **AIO Refresh**

### Improved
- **Release task table** — sticky header, responsive columns
- **Sync packages** button removed

### Fixed
- Release detail reliability, milestone links, wiki monospace

## [1.14.14] — 2026-10-29

Bulk subtask creation is easier to correct.

### New
- **Remove rows** in bulk subtask creation

### Fixed
- Bulk subtask modal closing and reset, AIO defects sticky header

## [1.14.13] — 2026-10-28

Story Points filter and a highlight for the peeked row.

### New
- **Story Points filter** on Backlog and Sprint Board
- **Peeked row highlight**

### Improved
- **AIO defects list** — tighter columns
- **My Tasks** stays on one line in narrow windows

### Fixed
- Peek panel shadow over sticky headers

## [1.14.12] — 2026-10-27

AIO cycle tabs split open and done work.

### Improved
- **Executions and Defects tabs** — Open and Done sections

### Fixed
- AIO defect rows update straight away after edits

## [1.14.11] — 2026-10-22

Find in page arrives.

### New
- **Find in page** — Cmd+F, global search moves to Cmd+Shift+F
- **AIO step-level stats**

### Improved
- **AIO empty states**

### Fixed
- Wiki list before a code block, command palette shortcut glyphs

## [1.14.10] — 2026-10-16

Global search is ranked and much faster.

### New
- **Ranked global search** — current sprint first
- **Direct match by key**
- **Include closed issues** toggle
- **Epics in search**

### Improved
- **Compact search and Recent rows**
- **Palette groups** follow the query

### Fixed
- Search states and accuracy, switching Jira instances
- Recent MR collisions, AIO execution count

## [1.14.9] — 2026-10-14

Deployment package sync and a new AIO cycle dashboard.

### New
- **Deployment package sync** — RM week and one-click fix
- **Unassign** from issue detail
- **Move story to Done** prompt after the last subtask
- **AIO cycle dashboard**, burndown and statistics

### Improved
- **AIO cycle and run detail** redesign
- **Smaller screens** for AIO stats

### Fixed
- Sidebar labels, wiki underscores, faster package lookups

## [1.14.8] — 2026-10-08

Token handling is more forgiving.

### Fixed
- **Pasted tokens** with stray whitespace no longer fail
- **Test connection** uses the token you typed
- **Save** stores the typed token or shows an error

## [1.14.7] — 2026-10-07

Duplicate subtask templates and drag-and-drop attachments.

### New
- **Duplicate subtask template**
- **Drag and drop attachments** in the desktop app

### Improved
- **Epic forecast** leads with logged time
- **Issue link search** understands keys

### Fixed
- Link dialog overflow, flagging from the sidebar, Backlog title width

## [1.14.6] — 2026-10-05

Wiki rendering fixes.

### Fixed
- Underscores inside words stay literal, no stray backticks

## [1.14.5] — 2026-10-02

Epic progress on epic detail and a redesigned Changes tab.

### New
- **Epic progress section** — forecast, charts and risks

### Improved
- **Changes tab** — grouped entries, plain old → new, word diff

### Fixed
- Jira results skipped on servers with a lower page cap
- Epic progress skeleton jump

## [1.14.4] — 2026-09-29

New My Tasks bands and Worklogs presets.

### New
- **In Review — my subtasks** band on My Tasks
- **Testing band** on My Tasks
- **Last 7 Days and Last Month** Worklogs presets

### Improved
- **Subtasks follow Jira's order** everywhere

### Fixed
- Date picker weeks start on Monday

## [1.14.3] — 2026-09-22

One date picker everywhere and a tidier Sprint Board header.

### New
- **Shared date picker**
- **Sticky Sprint Board header**

### Fixed
- Several Jira wiki formatting bugs
- Date picker alignment and clearing

## [1.14.2] — 2026-09-17

Attachments in comments and descriptions.

### New
- **Attachments in comments and descriptions**
- **Task-type icon** on release rows

### Improved
- **Create and edit issue** saving feedback

### Fixed
- Releases missing subtasks, Backlog drag autoscroll
- Attachment upload and paste bugs

## [1.14.1] — 2026-08-27

Open links in the browser you choose.

### New
- **Open links in a chosen browser**
- **Real MR review status** on My Tasks

### Fixed
- Stale lists after sidebar edits, clipped comment menu

## [1.14.0] — 2026-08-13

Releases gain branch, milestone and drift tools.

### New
- **Release branch and milestone creation**
- **MR drift detection** with one-click fixes
- **Merged-back check** for released versions
- **One line per task** release table
- **Epics page redesign**
- **Density and text size** settings

### Improved
- **Release descriptions** moved to the sidebar
- **Faster drift lookups**

### Fixed
- Readable Jira and GitLab errors, release ticket order
- Escaped HTML in descriptions, density floors

## [1.13.5] — 2026-08-04

Small issue detail additions.

### New
- **Deployment package** field
- **Worklog progress bar**
- **Copy Jira link** button

### Fixed
- Time tracking showing "No time logged", release row clicks

## [1.13.4] — 2026-07-09

Preview more attachment types.

### New
- **Attachment preview** — text, code, PDF, video and audio

### Fixed
- More reliable preview type detection and loading

## [1.13.3] — 2026-07-02

Fix versions on the Backlog.

### New
- **Fix version badge** on Backlog rows

### Fixed
- Backlog summary width, no-op sprint board transitions
- Sprint and Tempo Account fields save correctly

## [1.13.2] — 2026-06-18

Less noise on My Tasks.

### Improved
- **Subtasks hidden** — under done stories in Current Sprint
- **Default worklog description**

### Fixed
- Flagging on Jira Data Center, false Direct Match in search
- Done story time and strike-through, Space closing the palette

## [1.13.1] — 2026-06-17

Search as you type and new page shortcuts.

### New
- **Search as you type** in the Issues group
- **Shortcuts for 7 pages**

### Improved
- **Command palette** moves to Cmd+F
- **Static status pill** on My Tasks

### Fixed
- Saving unchanged custom fields, attachments on Jira Data Center
- AIO breadcrumbs and collapsed test runs

## [1.13.0] — 2026-06-16

My Tasks and a redesigned dashboard.

### New
- **My Tasks page** — your work in a smart order

### Improved
- **Dashboard redesign**
- **Standup recap** can pick today

### Fixed
- AIO test status on deep links

## [1.12.4] — 2026-06-12

Release milestone warnings and priority icons.

### New
- **Wrong milestone warning** on release tasks
- **Priority icons** in the priority picker

### Fixed
- Bulk subtasks inherit required fields, scheme-scoped priorities
- Peek panel actions and subtask status updates

## [1.12.3] — 2026-06-10

Clickable issue keys in text.

### New
- **Clickable issue keys** in descriptions and comments
- **Send to top or bottom** on the Backlog

### Improved
- **Tidier story context menu**

### Fixed
- Resolution dialog position, clearer GitLab TLS errors

## [1.12.2] — 2026-06-09

Setup wizard and keyboard polish.

### New
- **Setup wizard** error log and saved progress
- **Escape** cancels drags and keeps fullscreen
- **Defect peek** on AIO cycles

### Improved
- **Relative times** show years and days

### Fixed
- Setup wizard stalling, AIO defects breadcrumbs and overflow
- Jira teletype macros

## [1.12.1] — 2026-06-08

Standup Notes show more of your day.

### New
- **Created issues** in Yesterday
- **Worklog descriptions**

### Fixed
- Worklog rows, JQL escaping, watched-person commits

## [1.12.0] — 2026-06-07

Peek any issue and drag to rank or transition.

### New
- **Universal issue peek**
- **Drag to rank** on the Backlog
- **Drag to transition** on the Sprint Board
- **Subtask templates** and bulk creation
- **Resolution prompt** on done transitions
- **Choose your Jira board**

### Improved
- **Type colours and icons** on cards and lists
- **Unassigned filter** and watched person on Standup
- **Standup status transitions**

### Fixed
- Breadcrumbs from peek, board sync, Backlog drag drift
- Wiki attachment links, unassigned avatars, bulk subtask layout

## [1.11.0] — 2026-06-01

Faster boards and richer releases.

### New
- **Time in column** on sprint cards
- **Progressive issue detail**
- **Pin releases** to the tab strip
- **Release edit** saves to Jira and GitLab

### Improved
- **Sprint Board and Backlog** load in one request
- **Cached workflow transitions**

### Removed
- **Jira quick filters and Save Filter**

### Fixed
- Board refresh after transitions, Backlog epic chips and flags
- Narrow board columns, fix version order

## [1.10.4] — 2026-05-28

Worklog editing polish.

### Fixed
- Worklog actions on hover, Delete deletes, unclipped edit form

## [1.10.3] — 2026-05-26

Wiki and Worklogs fixes.

### Fixed
- Wiki monospace links, dividers and lists after quotes
- Clickable keys in Worklogs, update checks in the debug log

## [1.10.2] — 2026-05-26

Subtasks inherit parent fields.

### New
- **Subtask field inheritance** from the parent

### Removed
- **Sprint Progress page**

### Fixed
- Subtask types with custom names, parent refresh, Standup Today

## [1.10.1] — 2026-05-25

Standup Yesterday is easier to read.

### Improved
- **Commits grouped per task** in Yesterday

### Fixed
- Missing commits, local dates, singular counts, project pickers

## [1.10.0] — 2026-05-25

Standup Notes arrive.

### New
- **Standup Notes page**
- **Integrations step** in the setup wizard

### Improved
- **Roles removed** — everyone sees everything
- **Simpler sidebar settings**

### Fixed
- AIO in-progress status, worklog refresh, MR discussions cap
- Attachment downloads, number search, progress bar style

## [1.9.0] — 2026-05-23

Tempo worklogs and a new dashboard.

### New
- **Worklogs page** with Tempo
- **Date presets and saved filters**
- **Edit worklogs** from any cell
- **Dashboard welcome screen** — sprint and release cards

### Removed
- **Widget dashboard** and Workload page

### Fixed
- Dashboard greeting names, breadcrumbs, release progress

## [1.8.1] — 2026-05-19

Issue flagging.

### New
- **Flag issues** from the board, backlog and detail

### Fixed
- Wiki nested lists, mention names

## [1.8.0] — 2026-05-18

AIO Test Management integration.

### New
- **AIO Test Management** — projects, cycles, runs
- **Pin test cycles**
- **Resizable sidebars**
- **Search closed issues**
- **Assign to me**
- **In-app issue links**

### Improved
- **Unified status pills**

### Fixed
- Wiki formatting, sprint board epic pill, AIO first-load errors

## [1.7.3] — 2026-05-10

Updater restart fix.

### Fixed
- Restart after an update, build fixes

## [1.7.2] — 2026-05-10

Resizable sidebars and debugging tools.

### New
- **Resizable sidebars**
- **Clear story points**
- **Request bodies** in Dev Tools

### Fixed
- Pagination hang, safer JQL, milestone column
- Resize handle fixes

## [1.7.1] — 2026-04-06

Update delivery fixes.

### Fixed
- Relaunch after installing an update, update builds

## [1.7.0] — 2026-04-06

Maintenance release.

### Improved
- **Milestone wrap-up**

## [1.7] — 2026-04-05

Every view feels instant.

### Improved
- **Faster loading** — code splitting and smarter caching
- **Skeleton screens** on all data views
- **Avatar caching**
- **Faster Backlog** with virtualized rows

### Fixed
- Sprint board flashes and jumps, Backlog loading glitches

## [1.6.3] — 2026-03-29

Update dialog polish.

### Improved
- **Wider update dialogs**

### Fixed
- Restart after update, release script fixes

## [1.6.2] — 2026-03-29

Clipboard fix.

### Fixed
- Copy and paste shortcuts on macOS, duplicate OS notifications

## [1.6.1] — 2026-03-26

Minor fixes.

### Fixed
- Sticky swimlane headers, notification sound

## [1.6] — 2026-03-26

Taskflow can now update itself.

### New
- **Automatic updates** with configurable checks
- **What's new** after updating
- **About dialog**
- **Release history** in Settings

## [1.5] — 2026-03-24

Deep Jira features and a customizable layout.

### New
- **Activity timeline** — changes, comments and worklogs
- **Time tracking** and worklogs
- **Attachments** with previews
- **Mentions** in comments
- **Customizable sidebar and dashboard**
- **Clone issue** and watchers

### Improved
- **Unified status transitions**
- **Saved filters** rebuilt

## [1.4] — 2026-03-20

A healthier codebase.

### New
- **Developer Tools** page
- **Faster long lists**

### Improved
- **Accessibility labels**
- **Dependency updates**

## [1.3] — 2026-03-19

Visual identity and keyboard-driven workflows.

### New
- **App icon**
- **Multi-page Settings**
- **Keyboard shortcuts** and command palette
- **Pinned tabs** and recent items
- **MR detail page**
- **Rich Jira text**

### Improved
- **Density settings**
- **Notifications redesign**

### Fixed
- Board alignment, sprint parsing, breadcrumbs

## [1.2] — 2026-03-15

Work entirely within Taskflow.

### New
- **Issue detail** with inline editing
- **Sprint board** with drag-and-drop
- **Create and edit issues**
- **Backlog** with sprint sections
- **Epics**

### Improved
- **Wider issue detail**

### Fixed
- Cross-project sprints, assignee search, epic badges

## [1.1] — 2026-03-13

Polish across every feature.

### New
- **Story hierarchy** on the sprint board
- **MR Attention** tab
- **Dashboard panels**
- **Notifications page**
- **Debug Logs** page

### Fixed
- Releases list, story points, MR data, duplicate notifications

## [1.0] — 2026-03-12

Initial release — one desktop app for Jira and GitLab.

### New
- **Secure token storage**
- **Setup wizard**
- **Dashboard** with tasks and MRs
- **Issue and MR linking** by branch name
- **Status changes and comments**
- **Notifications** and global search
