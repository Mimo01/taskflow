# Changelog

All notable changes to Taskflow are documented here.

## [1.14.20] — 2026-11-12

Notifications got a full redesign, plus easier setup and story editing.

### New
- Notification panel with stacks and quick actions
- In-app banners for new notifications
- Shorter desktop notifications
- Change a story's epic from its sidebar
- Add stories straight from an epic
- Search in project and board pickers

### Improved
- Attachments show as a tile grid
- One header style for issue sections
- Clear message when there's no active sprint

### Fixed
- Duplicate notifications
- Missing package mismatches
- Peek panel scrolling into blank space
- Data not reloading after saving a token

## [1.14.19] — 2026-11-09

Clearer handling of issues you can't open.

### New
- Clear panel for issues you can't open
- Recent items you can no longer open are marked
- Refresh button on issue detail

### Improved
- Issue actions shrink to icons in narrow windows
- Square row selection on My Tasks and Standup

### Fixed
- Story time missing subtasks in All assigned
- Standup rows not highlighting the peeked issue
- Broken Linux download links

## [1.14.18] — 2026-11-05

Zoomable previews and one person picker everywhere.

### New
- Zoom and fit controls in file previews
- One person picker that searches everyone
- All your subtasks listed on Standup Today

### Improved
- One time bar design across the app
- Issue relationship rows adapt to narrow panels
- Same graph layout for every release
- Standup works in narrow windows

### Fixed
- Package warnings now cover Bugs
- Wrong subtask estimates on time bars
- Escape leaving fullscreen when closing a preview

## [1.14.17] — 2026-11-03

Fix release coverage straight from the release page.

### New
- Fix tasks not covered by a release in one click
- One MR status per release task, with fixes
- Assign the release milestone to merged MRs
- Click a graph row to filter release issues
- Epic time by status and person

### Improved
- Time bars turn red only past 125% of the estimate
- Larger, cleaner release progress graph
- Tidier release detail header

### Fixed
- Linked MRs missing on issues
- MR donut counting MRs twice
- Release page scrolling into blank space

## [1.14.16] — 2026-11-02

Filter and sort release issues.

### New
- Filter and sort release issues
- Filter release tasks by MR label
- See why an MR isn't covered by the release
- Resize the Standup Notes columns

### Improved
- Every MR label is shown on the release page
- Standup follows the density setting

### Fixed
- Wrong MR label counts
- Release table header hidden while scrolling
- Hard-to-read dark mode app icon

## [1.14.15] — 2026-10-30

Releases list and release detail are redesigned.

### New
- Redesigned Releases page
- Redesigned release detail page
- Deployment package mismatches as an action list
- Refresh on AIO pages

### Improved
- Release task table keeps its header while scrolling
- Sync packages button removed

### Fixed
- Release detail showing empty or stale data
- Milestone links opening inside the app

## [1.14.14] — 2026-10-29

Bulk subtask creation is easier to correct.

### New
- Remove rows before creating subtasks in bulk

### Fixed
- Bulk subtask dialog not closing after creating
- AIO defect keys painting over the table header

## [1.14.13] — 2026-10-28

Story Points filter and a highlight for the peeked row.

### New
- Story Points filter on the Backlog and Sprint Board
- The row open in the peek panel is highlighted

### Improved
- Tighter columns in the AIO defects list
- My Tasks rows stay on one line in narrow windows

### Fixed
- Peek panel shadow cut off by sticky headers

## [1.14.12] — 2026-10-27

AIO cycle tabs split open and done work.

### Improved
- AIO Executions and Defects split into Open and Done

### Fixed
- AIO defect rows not updating after edits

## [1.14.11] — 2026-10-22

Find in page arrives.

### New
- Find in page with Cmd+F
- Step-level stats on AIO cycles

### Improved
- Global search moves to Cmd+Shift+F
- Friendlier AIO empty states

### Fixed
- Descriptions cut off before a code block
- Raw key syntax in command palette shortcuts

## [1.14.10] — 2026-10-16

Global search is ranked and much faster.

### New
- Search results ranked with your sprint first
- Jump straight to an issue by its key
- Include closed issues in search
- Epics get their own search section

### Improved
- Compact one-line search and recent rows

### Fixed
- "No results" flashing while typing
- Hyphenated words not matching in search
- Tokens sent to the wrong Jira instance
- Recent MRs from different projects mixed up

## [1.14.9] — 2026-10-14

Deployment package sync and a new AIO cycle dashboard.

### New
- See and fix a story's deployment package
- Unassign an issue without picking someone else
- Offer to close a story after its last subtask
- AIO cycle dashboard with burndown and stats

### Improved
- Redesigned AIO cycle and run pages
- AIO stats fit smaller screens

### Fixed
- Sidebar labels hidden in narrow windows
- Underscores in monospace text
- Slow issue opening due to package lookups

## [1.14.8] — 2026-10-08

Token handling is more forgiving.

### Fixed
- Pasted tokens with stray spaces failing to sign in
- Test connection ignoring the token you typed
- Save keeping the old token without telling you

## [1.14.7] — 2026-10-07

Duplicate subtask templates and drag-and-drop attachments.

### New
- Duplicate a subtask template
- Drag and drop attachments in the desktop app

### Improved
- Epic forecast leans on logged time
- Link search understands issue keys

### Fixed
- Link dialog running off screen
- Flag toggle in the sidebar not working
- Backlog titles squeezed by badges

## [1.14.6] — 2026-10-05

Jira text renders more faithfully.

### Fixed
- Underscores inside words turning into italics
- Stray backticks around monospace text

## [1.14.5] — 2026-10-02

Epic progress on epic detail and a redesigned Changes tab.

### New
- Epic progress with forecast, charts and risks

### Improved
- Clearer Changes tab with grouped edits and diffs

### Fixed
- Jira results skipped on servers with smaller pages
- Epic progress jumping while it loads

## [1.14.4] — 2026-09-29

New My Tasks bands and Worklogs presets.

### New
- My Tasks band for reviews waiting on your subtasks
- My Tasks band for issues in testing
- Last 7 Days and Last Month presets in Worklogs

### Improved
- Subtasks follow Jira's order everywhere

### Fixed
- Calendar weeks starting on Sunday

## [1.14.3] — 2026-09-22

One date picker everywhere and a tidier Sprint Board header.

### New
- One calendar date picker across the app
- Sprint Board header stays visible while scrolling

### Fixed
- Jira formatting bleeding into nearby text
- Strikethrough and bold rendering in links
- Date picker clearing when it shouldn't

## [1.14.2] — 2026-09-17

Attachments in comments and descriptions.

### New
- Insert attachments in comments and descriptions
- Issue type icons on release task rows

### Improved
- Clearer saving feedback in Create and Edit issue

### Fixed
- Releases missing subtasks with the fix version
- Backlog jumping while dragging near the edge
- Only the first pasted file being uploaded

## [1.14.1] — 2026-08-27

Open links in the browser you choose.

### New
- Open links in a browser of your choice
- Real review status for your MRs on My Tasks

### Fixed
- Lists not updating after sidebar edits
- Comment menu cut off near the composer

## [1.14.0] — 2026-08-13

Releases gain branch, milestone and drift tools.

### New
- Create a release branch and milestone
- Spot MRs that drifted from the release
- Fix an MR's branch or milestone in one click
- Check that a release was merged back
- Redesigned Epics page
- Density and text size settings

### Improved
- One row per task on the release page
- Faster release drift checks

### Fixed
- Unreadable Jira and GitLab error messages
- Release tickets in random order
- HTML in descriptions being interpreted

## [1.13.5] — 2026-08-04

Handy additions on issue detail.

### New
- Deployment package shown in the sidebar
- Worklog progress bar
- Copy the Jira link from the header

### Fixed
- Time tracking always showing no time logged
- Release rows opening the full page instead of the peek

## [1.13.4] — 2026-07-09

Preview more attachment types.

### New
- Preview text, code, PDF, video and audio files

### Fixed
- Some files opening as the wrong preview type

## [1.13.3] — 2026-07-02

Fix versions on the Backlog.

### New
- Fix version badge on Backlog rows

### Fixed
- Backlog titles truncating too early
- Sprint field not saving
- Tempo Account field not saving

## [1.13.2] — 2026-06-18

Less noise on My Tasks.

### Improved
- Subtasks of done stories are hidden in Current Sprint
- Empty worklog comments get a sensible default

### Fixed
- Flagging failing on Jira Data Center
- Stale direct match in search
- Space closing the command palette

## [1.13.1] — 2026-06-17

Search as you type and new page shortcuts.

### New
- Issues search as you type
- Keyboard shortcuts for 7 pages

### Improved
- Command palette opens with Cmd+F
- Status on My Tasks rows is display-only

### Fixed
- Errors when saving untouched custom fields
- Attachments missing on Jira Data Center
- AIO back button leaving the section

## [1.13.0] — 2026-06-16

My Tasks and a redesigned dashboard.

### New
- My Tasks page with your work in a smart order

### Improved
- Redesigned dashboard
- Standup recap can show today

### Fixed
- AIO tests showing Not Run on deep links

## [1.12.4] — 2026-06-12

Release milestone warnings and priority icons.

### New
- Warning for MRs on the wrong milestone
- Priority icons in the priority picker

### Fixed
- Bulk subtasks failing on required fields
- Priority pickers listing priorities you can't use
- Peek panel actions not working

## [1.12.3] — 2026-06-10

Clickable issue keys in text.

### New
- Issue keys in text open the issue
- Send a story to the top or bottom of the backlog

### Improved
- Tidier story context menu

### Fixed
- Resolution dialog shown off-centre
- Unclear GitLab certificate errors

## [1.12.2] — 2026-06-09

Setup wizard and keyboard polish.

### New
- Setup wizard shows its error log
- Setup wizard remembers your progress
- Escape cancels a drag on the board and backlog
- Peek AIO defects with a click

### Improved
- Old dates read as years and days

### Fixed
- Setup wizard stalling on the Jira step
- AIO defects table overflowing

## [1.12.1] — 2026-06-08

Standup Notes show more of your day.

### New
- Issues you created appear in Yesterday
- Worklog descriptions on Standup

### Fixed
- Teammates' commits missing on Standup
- Project keys breaking Standup queries

## [1.12.0] — 2026-06-07

Peek any issue and drag to rank or transition.

### New
- Peek any issue without leaving the page
- Drag to rank stories on the Backlog
- Drag cards to change status on the Sprint Board
- Subtask templates and bulk creation
- Choose a resolution when closing an issue
- Choose which Jira board the app uses

### Improved
- Issue type colours and icons on cards
- Unassigned option in assignee filters
- Watch a teammate's Standup

### Fixed
- Backlog drag drifting by a row
- Board not updating after edits
- Unassigned issues looking assigned

## [1.11.0] — 2026-06-01

Faster boards and richer releases.

### New
- Time in column on sprint cards
- Issue detail loads section by section
- Pin releases to the tab strip
- Edit a release in Jira and GitLab at once

### Improved
- Sprint Board and Backlog load much faster

### Removed
- Jira quick filters and Save Filter

### Fixed
- Board not updating after a status change
- Missing epic chips and flags on the Backlog
- Board columns overflowing narrow windows

## [1.10.4] — 2026-05-28

Cleaner worklog editing.

### Fixed
- Worklog actions now appear on hover
- Delete button discarding edits instead of deleting
- Worklog edit form getting cut off

## [1.10.3] — 2026-05-26

Better Jira text rendering and clickable worklog keys.

### Improved
- Issue keys in Worklogs open the issue

### Fixed
- Monospace links not clickable
- Lists after quotes shown inside the quote

## [1.10.2] — 2026-05-26

Subtasks inherit parent fields.

### New
- New subtasks inherit required fields from the parent

### Removed
- Sprint Progress page

### Fixed
- Subtask creation failing on some Jira setups
- Standup Today using the wrong issue status

## [1.10.1] — 2026-05-25

Standup Yesterday is easier to read.

### Improved
- Commits for the same task share one line

### Fixed
- Missing commits in Yesterday
- Yesterday using the UTC date
- Project pickers missing from Settings

## [1.10.0] — 2026-05-25

Standup Notes arrive.

### New
- Standup Notes page
- Set up AIO and Tempo in the setup wizard

### Improved
- Everyone sees every page, no roles needed
- Simpler sidebar settings

### Fixed
- AIO runs in progress shown as not executed
- Worklogs not refreshing after logging time
- MR discussions capped at 20

## [1.9.0] — 2026-05-23

Tempo worklogs and a new dashboard.

### New
- Worklogs page powered by Tempo
- Date presets and saved filters for worklogs
- Edit worklogs from any cell
- New dashboard with sprint and release cards

### Removed
- Customizable widget dashboard and Workload page

### Fixed
- Greeting showing your surname

## [1.8.1] — 2026-05-19

Flag issues from anywhere.

### New
- Flag issues from the board, backlog and detail

### Fixed
- Nested lists in descriptions
- Mentions showing usernames instead of names

## [1.8.0] — 2026-05-18

AIO Test Management integration.

### New
- AIO Test Management projects, cycles and runs
- Pin test cycles to the tab strip
- Resize sidebars by dragging
- Search closed issues
- Assign an issue to yourself in one click
- Jira links open inside the app

### Improved
- One status pill style everywhere

### Fixed
- Jira formatting in tables and panels
- Errors flashing on first AIO load

## [1.7.3] — 2026-05-10

Updates restart the app properly.

### Fixed
- App not reopening after an update

## [1.7.2] — 2026-05-10

Resizable sidebars and debugging tools.

### New
- Resize detail sidebars by dragging
- Clear an issue's story points
- Request bodies in Developer Tools

### Fixed
- Loading hanging on some Jira responses
- Milestone column stuck on Loading

## [1.7.1] — 2026-04-06

Updates install and relaunch reliably.

### Fixed
- App not relaunching after installing an update

## [1.7.0] — 2026-04-06

Maintenance release with no visible changes.

### Improved
- Behind-the-scenes clean-up

## [1.7] — 2026-04-05

Every view feels instant.

### Improved
- Pages load faster with smarter caching
- Loading skeletons on every data view
- Avatars load once and stay cached
- Backlog loads section by section

### Fixed
- Sprint board flashing and jumping
- Backlog rows loading in the wrong sprint

## [1.6.3] — 2026-03-29

Roomier update dialogs and a fixed restart.

### Improved
- Wider update dialogs

### Fixed
- Restart countdown not finishing after an update

## [1.6.2] — 2026-03-29

Copy and paste work everywhere on macOS.

### Fixed
- Copy and paste shortcuts not working on macOS
- Duplicate desktop notifications

## [1.6.1] — 2026-03-26

Smoother board scrolling and a sound for notifications.

### Improved
- Desktop notifications play a sound

### Fixed
- Swimlane headers not sticking while scrolling

## [1.6.0] — 2026-03-26

Taskflow can now update itself.

### New
- Automatic updates on a schedule you choose
- Update dialog with release notes and progress
- What's new after each update
- Release history in Settings
- About dialog in the app menu

## [0.1.0] — 2026-03-25

A test build for the new update pipeline.

### New
- Signed builds for macOS, Linux and Windows

## [1.5] — 2026-03-24

Deep Jira features and a customizable layout.

### New
- Activity timeline with changes, comments and worklogs
- Log and edit time on issues
- Attachments with previews and drag and drop
- Mention people in comments
- Customizable sidebar and dashboard
- Clone issues and watch them

### Improved
- Status changes work the same everywhere
- Rebuilt saved filters

## [1.4] — 2026-03-20

Faster lists and a sturdier app under the hood.

### New
- Developer Tools with a request log

### Improved
- Long lists scroll smoothly
- Better screen reader labels

## [1.3] — 2026-03-19

Visual identity and keyboard-driven workflows.

### New
- New app icon
- Settings split into pages
- Keyboard shortcuts and a command palette
- Pin issues as tabs and reopen recent items
- Merge request detail page
- Rich Jira text with mentions and panels

### Improved
- Density settings for lists and cards
- Redesigned notifications

### Fixed
- Board columns misaligned with headers
- Breadcrumbs piling up

## [1.2] — 2026-03-15

Work entirely within Taskflow.

### New
- Issue detail with inline editing
- Sprint board with drag and drop
- Create and edit issues
- Backlog with sprint sections
- Epics page and epic detail

### Improved
- Wider issue detail panel

### Fixed
- Sprints from other projects on the board
- Epic badges showing no name

## [1.1] — 2026-03-13

Polish across every feature.

### New
- Stories group their subtasks on the sprint board
- MR Attention tab
- Dashboard panels for subtasks, MRs and sprint
- Notifications page
- Debug Logs page

### Fixed
- Story points always showing zero
- Duplicate notifications
- False disconnected warnings

## [1.0] — 2026-03-12

Initial release — one desktop app for Jira and GitLab.

### New
- Connect Jira and GitLab with tokens kept in your keychain
- Setup wizard
- Dashboard with your tasks and MRs
- Issues and MRs linked by branch name
- Change status and comment from task rows
- Notifications and global search
