# Phase 32: Time Tracking, Attachments & Mentions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 32-time-tracking-attachments-mentions
**Areas discussed:** Time tracking input & display, Attachment viewing & upload UX, @mention autocomplete, Worklog timeline integration

---

## Time Tracking Input & Display

### Time input method

| Option | Description | Selected |
|--------|-------------|----------|
| Natural language text field | Single text input that parses "2h 30m", "1d", "45m" — matches Jira's log-work dialog | |
| Duration picker (hours + minutes) | Separate hour/minute selectors — structured but slower | |
| Combined: text field + fallback picker | Text input primary, clock icon opens picker for structure | ✓ |

**User's choice:** Combined: text field with parsing + fallback picker
**Notes:** None

### Time tracking summary placement

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar field row | Dedicated row in sidebar alongside Status, Assignee, Priority | |
| Inline section above timeline | Progress-bar card between description and timeline | |
| Both — sidebar + progress bar | Sidebar for numbers, thin progress bar at timeline top | |

**User's choice:** "You decide"
**Notes:** Deferred to Claude's discretion

### Log work trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Button in time tracking sidebar row | Small "+" or "Log work" button next to time summary | |
| Action bar button | "Log Work" button in top action bar | |
| Both — sidebar + action bar | Available from both locations | |

**User's choice:** "You decide"
**Notes:** Deferred to Claude's discretion

### Log work form appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expandable panel in sidebar | Expands form inline below time summary row | |
| Modal dialog | Centered dialog with form fields | |
| Popover from the button | Floating popover anchored to button — like StatusPopover | |

**User's choice:** "You decide"
**Notes:** Deferred to Claude's discretion

---

## Attachment Viewing & Upload UX

### Attachment display location

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated section below description | Collapsible "Attachments (N)" section — image grid + file list | ✓ |
| Sidebar section | Attachment list in right sidebar | |
| Tab alongside Activity | "Attachments" tab next to timeline | |

**User's choice:** Dedicated section below description
**Notes:** None

### File upload method

| Option | Description | Selected |
|--------|-------------|----------|
| Button + drag-and-drop on section | "Attach file" button + drop zone on section area | ✓ |
| Button only | Simple file picker, no drag-and-drop | |
| Drag-and-drop anywhere on page | Drop zone covers entire issue detail | |

**User's choice:** Button + drag-and-drop on section
**Notes:** None

### Image thumbnail click behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Lightbox overlay | Full-size image in modal with close/next/prev | ✓ |
| Open in OS default app | Download and open with system viewer | |
| Expand inline | Image expands in-place in section | |

**User's choice:** Lightbox overlay
**Notes:** None

---

## @Mention Autocomplete

### Popover behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Floating popover at cursor position | Dropdown at cursor, avatar + name, arrow keys + Enter | ✓ |
| Fixed dropdown below textarea | Dropdown below composer when @ typed | |
| Inline chip-style replacement | Rich text editor with styled mention chips | |

**User's choice:** Floating popover anchored to cursor position
**Notes:** Like Slack/GitHub pattern

### User list source

| Option | Description | Selected |
|--------|-------------|----------|
| Jira project assignable users | /rest/api/2/user/assignable/search?project={key} — cached | ✓ |
| All Jira users with text search | /rest/api/2/user/search — broader, slower | |
| Watchers + recent commenters only | Derived from existing data, limited set | |

**User's choice:** Jira project assignable users
**Notes:** None

### Mention rendering in WikiRenderer

| Option | Description | Selected |
|--------|-------------|----------|
| Highlighted name with @ prefix | Styled span: "@Display Name" with highlight/bold | ✓ |
| Plain text display name | Replace [~username] with name, no styling | |
| Badge-style chip | Colored badge/chip with name | |

**User's choice:** Highlighted name with @ prefix
**Notes:** Non-clickable — no user profile in Taskflow

---

## Worklog Timeline Integration

### Worklog entry style

| Option | Description | Selected |
|--------|-------------|----------|
| Compact single-line like changelog | "Alice logged 2h 30m — 3 days ago" in muted style | |
| Card-style like comments | Full card with avatar, time, date, comment body | |
| Medium — two-line entry | Avatar + name + time on first line, comment on second | ✓ |

**User's choice:** Medium — two-line entry
**Notes:** None

### Worklog edit/delete

| Option | Description | Selected |
|--------|-------------|----------|
| Inline 3-dot menu on own entries | Same pattern as comment edit/delete | ✓ |
| Edit via time tracking sidebar | Click entry to open in sidebar form | |
| Modal dialog for editing | Click edit to open modal with pre-filled fields | |

**User's choice:** Inline 3-dot menu on own entries
**Notes:** Consistent with comment CRUD pattern from Phase 31

---

## Claude's Discretion

- Time tracking summary placement (sidebar row recommended)
- Log work trigger placement (sidebar button recommended)
- Log work form appearance (popover recommended)
- Lightbox component implementation
- Attachment section default collapse state
- Duration parser implementation details
- Mention popover debounce/threshold

## Deferred Ideas

None — discussion stayed within phase scope
