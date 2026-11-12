# Changelog

All notable changes to Taskflow are documented here.

## [1.14.20] — 2026-11-12

Notifications are rebuilt from the ground up, so you can catch up and act in seconds.

### New
- Notifications for the same issue or MR stack together
- Reply, review or open a pipeline right from a notification
- New activity pops up as a short banner you can act on
- Desktop alerts say what happened in one line
- Change a story's epic right from its sidebar
- Add a story to an epic without leaving the epic

### Improved
- Project and board pickers let you search long lists
- Attachments show as neat tiles with type and size
- Sprint pages tell you when there's no active sprint

### Fixed
- Notifications no longer show up twice
- Saving a new token reloads your data straight away
- The peek panel no longer scrolls into empty space

## [1.14.19] — 2026-11-09

Issues you can't open now explain why and offer a way forward.

### New
- See why an issue can't be opened, with quick next steps
- Recent items you've lost access to are clearly marked
- Refresh an issue without leaving the page

### Improved
- Issue actions fold into icons when space is tight
- Row selection looks cleaner on My Tasks and Standup

### Fixed
- Story time in All assigned now includes subtasks
- Linux download links work again

## [1.14.18] — 2026-11-05

Zoom into any preview and find people faster wherever you pick them.

### New
- Zoom, fit and resize text in file previews
- Find anyone in any person picker, not just a short list
- Standup Today lists every subtask that's yours

### Improved
- Time bars look and read the same everywhere
- Issue details stay readable in narrow panels
- Every release page shares the same tidy graphs
- Standup adapts when the window gets small

### Fixed
- Package warnings now cover Bugs too
- Escape closes a preview without leaving fullscreen

## [1.14.17] — 2026-11-03

Spot release gaps and fix them without leaving the release page.

### New
- Add missing tasks to a release in one click
- See every MR's status for a task at a glance
- Put merged MRs on the release milestone
- Click any graph row to filter the release issues
- See where epic time went, by status and person

### Improved
- Time bars only turn red when well over estimate
- The release progress graph is larger and easier to read

### Fixed
- Issues now list every linked MR
- The MR donut counts each MR only once

## [1.14.16] — 2026-11-02

Find exactly the release issues you need with filters and sorting.

### New
- Filter and sort the issues of a release
- Narrow release tasks down by MR label
- See why an MR isn't covered by the release
- Drag to resize the Standup Notes columns

### Improved
- Every MR label is visible on the release page
- Standup spacing follows your density setting

### Fixed
- MR label counts match what the filter shows
- The app icon is easier to see in dark mode

## [1.14.15] — 2026-10-30

A fresh look for releases, with everything that matters in one place.

### New
- A redesigned Releases page with upcoming and shipped versions
- A release page with progress, MRs and the team at a glance
- Package mismatches you can fix straight from the list
- Refresh AIO test cycles whenever you need

### Improved
- The release task table keeps its header in view

### Fixed
- Release pages no longer show stale or empty data
- Milestone links open in your browser

## [1.14.14] — 2026-10-29

Bulk subtask creation is easier to get right.

### New
- Drop rows you don't need before creating subtasks

### Fixed
- The bulk subtask dialog closes once it's done
- AIO defect keys stay under the table header

## [1.14.13] — 2026-10-28

Filter by story points and always see which row you're peeking at.

### New
- Filter the Backlog and Sprint Board by story points
- The row you're peeking at stays highlighted

### Improved
- The AIO defects list fits more on screen
- My Tasks rows stay on one line in narrow windows

### Fixed
- The peek panel's shadow is no longer cut off

## [1.14.12] — 2026-10-27

Test cycles separate what's left to do from what's done.

### Improved
- AIO executions and defects split into Open and Done

### Fixed
- Defect changes show up on AIO pages straight away

## [1.14.11] — 2026-10-22

Find anything on the current page with Cmd+F.

### New
- Search the page you're on with Cmd+F
- See step-level pass rates on AIO cycles

### Improved
- Global search moves to Cmd+Shift+F
- AIO charts explain themselves when there's no data yet

### Fixed
- Descriptions with code blocks show in full again

## [1.14.10] — 2026-10-16

Search puts your current work first and finds things faster.

### New
- Search shows your sprint first, then backlog and closed
- Type an issue key to jump straight to it
- Include closed issues when you need them
- Epics get their own section in search

### Improved
- Search and recent items fit on tidy one-line rows

### Fixed
- "No results" no longer flashes while you type
- Hyphenated words now match in search

## [1.14.9] — 2026-10-14

Keep deployment packages in sync and follow test cycles on a new dashboard.

### New
- See a story's deployment week and fix it in one click
- Unassign an issue without picking someone else
- Close a story right after its last subtask
- Follow AIO cycles with a dashboard, burndown and stats

### Improved
- AIO cycle and run pages match the rest of the app

### Fixed
- Issues open faster
- Sidebar labels stay visible in narrow windows

## [1.14.8] — 2026-10-08

Connecting with a token just works, even when you paste a stray space.

### Fixed
- Pasted tokens with extra spaces now sign in
- Test connection checks the token you just typed
- Saving a token tells you if it couldn't be stored

## [1.14.7] — 2026-10-07

Reuse subtask templates and drop files straight onto issues.

### New
- Copy a subtask template to make a variation
- Drag and drop files onto an issue in the desktop app

### Improved
- Epic forecasts follow the time you actually log
- Find issues to link by typing their key

### Fixed
- Flagging from the issue sidebar works again
- Backlog titles get the room they need

## [1.14.6] — 2026-10-05

Jira descriptions and comments look the way they do in Jira.

### Fixed
- Names with underscores no longer turn into italics
- Monospace text no longer shows stray backticks

## [1.14.5] — 2026-10-02

See where an epic is heading and what changed on any issue.

### New
- Epic forecast, progress charts and risks on every epic

### Improved
- The Changes tab groups edits and shows clear before and after

### Fixed
- No more missing results on smaller Jira servers

## [1.14.4] — 2026-09-29

My Tasks shows reviews waiting on you and work in testing.

### New
- See stories in review that still have your subtasks
- See your issues that are in testing
- Pick Last 7 Days or Last Month in Worklogs

### Improved
- Subtasks appear in the same order as in Jira

### Fixed
- Calendars start the week on Monday

## [1.14.3] — 2026-09-22

Pick dates the same way everywhere and keep the sprint header in view.

### New
- One friendly calendar for every date field
- The Sprint Board header stays put while you scroll

### Fixed
- Jira formatting no longer spills into nearby text
- Clearing a date only happens when you mean it

## [1.14.2] — 2026-09-17

Put attachments right inside comments and descriptions.

### New
- Insert attachments into comments and descriptions
- Release tasks show their issue type icon

### Improved
- Creating and editing issues shows clear saving progress

### Fixed
- Releases include subtasks that carry the fix version
- Dragging on the Backlog no longer jumps around

## [1.14.1] — 2026-08-27

Open links in the browser you actually want.

### New
- Right-click any link to open it in a chosen browser
- My Tasks shows the real review status of your MRs

### Fixed
- Lists update right after you edit an issue

## [1.14.0] — 2026-08-13

Ship releases with confidence: branches, milestones and stray MRs, all handled.

### New
- Create the release branch and milestone in one step
- Catch MRs that slipped out of a release
- Fix an MR's target branch or milestone in one click
- Check that a release made it back to main
- A redesigned Epics page with progress at a glance
- Choose your density and text size

### Improved
- Each release task fits on one clear row

### Fixed
- Jira and GitLab errors are readable again

## [1.13.5] — 2026-08-04

A few handy extras on every issue.

### New
- See the deployment package in the issue sidebar
- Track logged time against the estimate
- Copy an issue's Jira link in one click

### Fixed
- Time tracking shows your logged time again

## [1.13.4] — 2026-07-09

Preview almost any attachment without downloading it.

### New
- Preview text, code, PDFs, video and audio in the app

## [1.13.3] — 2026-07-02

See each story's release right on the Backlog.

### New
- Backlog rows show the story's fix version

### Fixed
- Backlog titles use all the space they have
- Sprint and Account fields save correctly

## [1.13.2] — 2026-06-18

My Tasks stays focused on work that's still open.

### Improved
- Finished stories hide their subtasks in Current Sprint
- Worklogs without a comment get a sensible description

### Fixed
- Flagging works on Jira Data Center
- Space no longer closes the command palette

## [1.13.1] — 2026-06-17

Search as you type and jump to any page with a shortcut.

### New
- Issue search updates as you type
- Jump to 7 main pages with keyboard shortcuts

### Improved
- Open the command palette with Cmd+F

### Fixed
- Editing an issue no longer fails on untouched fields
- Attachments show up on Jira Data Center

## [1.13.0] — 2026-06-16

Meet My Tasks, your personal home for the day's work.

### New
- My Tasks puts flagged, overdue and in-review work first

### Improved
- A redesigned dashboard with sprint, releases and your week
- Standup can recap today, not just yesterday

### Fixed
- Test results show correctly when opened from a link

## [1.12.4] — 2026-06-12

Catch MRs on the wrong milestone before release day.

### New
- Release tasks warn when an MR is on the wrong milestone
- Priorities show their icons when you pick one

### Fixed
- Bulk subtasks fill in required fields from the parent
- Edit, clone and add subtask work from the peek panel

## [1.12.3] — 2026-06-10

Issue keys in text become links you can click.

### New
- Click issue keys in descriptions and comments
- Send a story to the top or bottom of its section

### Fixed
- Clearer messages for GitLab certificate problems

## [1.12.2] — 2026-06-09

A smoother setup and handy keyboard touches.

### New
- The setup wizard shows what went wrong and remembers progress
- Escape cancels a drag and keeps you in fullscreen
- Peek at AIO defects with a single click

### Improved
- Older dates read naturally, like "1 year 3 days ago"

### Fixed
- The setup wizard no longer stalls on Jira

## [1.12.1] — 2026-06-08

Standup Notes capture more of what you did.

### New
- Yesterday includes the issues you created
- Worklogs on Standup show their descriptions

### Fixed
- A teammate's Standup shows their commits

## [1.12.0] — 2026-06-07

Peek at any issue, and drag to rank or change status.

### New
- Peek at any issue without leaving where you are
- Drag stories to reorder the Backlog
- Drag cards between columns to change status
- Create many subtasks at once from templates
- Pick a resolution when you close an issue
- Choose which Jira board the app follows

### Improved
- Cards show their issue type and priority at a glance
- Filter by unassigned and watch a teammate's Standup

### Fixed
- Dragging on the Backlog stays where you drop it

## [1.11.0] — 2026-06-01

Boards load in a blink and releases tell you more.

### New
- See how long a card has been in its column
- Issue details appear section by section, no waiting
- Pin releases as tabs
- Edit a release in Jira and GitLab at once

### Improved
- The Sprint Board and Backlog load much faster

### Removed
- Jira quick filters and Save Filter

### Fixed
- The board updates right after a status change

## [1.10.4] — 2026-05-28

Editing worklogs is clearer and tidier.

### Fixed
- Edit and delete appear when you hover a worklog
- Delete really deletes the worklog

## [1.10.3] — 2026-05-26

Jira text renders more faithfully and worklog keys open issues.

### Improved
- Click an issue key in Worklogs to open it

### Fixed
- Links in monospace text are clickable
- Lists after a quote no longer end up inside it

## [1.10.2] — 2026-05-26

New subtasks fill in the fields you'd otherwise retype.

### New
- Subtasks copy required fields from their parent

### Removed
- The Sprint Progress page

### Fixed
- Creating subtasks works on more Jira setups

## [1.10.1] — 2026-05-25

Standup's Yesterday is quicker to scan.

### Improved
- Commits for the same task share one line

### Fixed
- Yesterday lists every commit you made
- Project pickers are back in Settings

## [1.10.0] — 2026-05-25

Meet Standup Notes: your daily update, ready before the meeting.

### New
- Standup Notes gathers yesterday's work and today's plan
- Set up AIO and Tempo during first-time setup

### Improved
- Everyone sees every page, no roles to pick

### Fixed
- Worklogs refresh as soon as you log time
- MR discussions load in full

## [1.9.0] — 2026-05-23

Track team time with Tempo and start the day on a fresh dashboard.

### New
- See team worklogs by epic, story and subtask
- Save your favourite worklog filters
- Add, edit or delete worklogs from any cell
- A welcome dashboard with your sprint and next release

### Removed
- The widget dashboard and Workload page

## [1.8.1] — 2026-05-19

Flag issues that need attention, wherever you are.

### New
- Flag issues from the board, backlog or issue page

### Fixed
- Mentions show people's names

## [1.8.0] — 2026-05-18

Your AIO test cycles now live right next to your Jira work.

### New
- Browse AIO test projects, cycles and runs
- Pin test cycles as tabs
- Drag sidebars to the width you like
- Find closed issues in search
- Assign an issue to yourself in one click
- Jira links open inside the app

### Fixed
- AIO pages load without error flashes

## [1.7.3] — 2026-05-10

Updates restart the app properly.

### Fixed
- The app reopens on its own after updating

## [1.7.2] — 2026-05-10

Resize panels to fit the way you work.

### New
- Drag detail sidebars to any width
- Clear an issue's story points

### Fixed
- Loading no longer hangs on some Jira responses

## [1.7.1] — 2026-04-06

Updates install and relaunch reliably.

### Fixed
- The app relaunches after installing an update

## [1.7.0] — 2026-04-06

Maintenance release with no visible changes.

### Improved
- Behind-the-scenes clean-up

## [1.7] — 2026-04-05

Every view feels instant.

### Improved
- Pages open instantly and stay loaded
- Placeholders show the layout while data loads
- Avatars load once and stay put
- The Backlog fills in section by section

### Fixed
- The sprint board no longer flashes or jumps

## [1.6.3] — 2026-03-29

Roomier update dialogs and a reliable restart.

### Improved
- Update dialogs give release notes more room

### Fixed
- The app restarts right after an update

## [1.6.2] — 2026-03-29

Copy and paste work everywhere on macOS.

### Fixed
- Cmd+C and Cmd+V work in every field on macOS
- Desktop notifications no longer arrive twice

## [1.6.1] — 2026-03-26

Smoother board scrolling and a sound for notifications.

### Improved
- Desktop notifications play a sound

### Fixed
- Swimlane headers stick while you scroll

## [1.6.0] — 2026-03-26

Taskflow now keeps itself up to date.

### New
- Updates arrive automatically on a schedule you choose
- See what's in an update before installing it
- Find out what's new after each update
- Browse past releases in Settings

## [0.1.0] — 2026-03-25

A test build for the new update pipeline.

### New
- Signed builds for macOS, Linux and Windows

## [1.5] — 2026-03-24

Do almost everything you'd do in Jira, in a layout you control.

### New
- One activity feed for changes, comments and worklogs
- Log and edit time right on the issue
- Add attachments with previews and drag and drop
- Mention teammates in comments
- Arrange the sidebar and dashboard your way
- Clone issues and watch the ones you care about

### Improved
- Changing status works the same everywhere

## [1.4] — 2026-03-20

Faster lists and a sturdier app under the hood.

### New
- Developer Tools show every request the app makes

### Improved
- Long lists scroll smoothly
- Screen readers can read more of the app

## [1.3] — 2026-03-19

A new look and a keyboard for everything.

### New
- A brand new app icon
- Settings organised into pages
- Keyboard shortcuts and a command palette
- Pin issues as tabs and jump back to recent ones
- A full page for every merge request
- Jira text with mentions, panels and images

### Improved
- Choose how compact lists and cards are
- Notifications are easier to scan

## [1.2] — 2026-03-15

Do your Jira work without ever opening Jira.

### New
- Edit issues in place
- Move cards across the sprint board
- Create and edit issues with your project's fields
- Plan sprints from the Backlog
- Manage epics and their stories

### Improved
- The issue panel gives details more room

## [1.1] — 2026-03-13

Polish across every feature.

### New
- Stories group their subtasks on the sprint board
- See MRs that need your attention
- Dashboard panels for subtasks, MRs and the sprint
- A full page for all notifications

### Fixed
- Story points show their real values
- No more false "disconnected" warnings

## [1.0] — 2026-03-12

Jira and GitLab, together in one desktop app.

### New
- Connect Jira and GitLab, with tokens safe in your keychain
- A guided setup to get you connected
- A dashboard with your tasks and merge requests
- Issues and MRs linked automatically by branch name
- Change status and comment without opening Jira
- Notifications and search across Jira and GitLab
