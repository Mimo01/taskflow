# Phase 31: Issue Detail Enrichment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 31-Issue Detail Enrichment
**Areas discussed:** Activity timeline layout, Timeline filter UX, Watcher & overdue placement, Clone issue behavior

---

## Activity Timeline Layout

### Q1: How should the activity timeline relate to the existing comments section?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace comments section | Timeline becomes the single activity stream — comments appear as timeline entries alongside field changes. Composer stays at bottom. | ✓ |
| Tabbed view | Add Description / Activity tabs. Comments move into Activity tab. | |
| Separate section below comments | Keep comments as-is, add History section below for field changes only. | |

**User's choice:** Replace comments section
**Notes:** Cleaner, no duplication. Unified stream.

### Q2: How should changelog entries be visually distinguished from comments?

| Option | Description | Selected |
|--------|-------------|----------|
| Compact field changes | Comments keep card style. Field changes are compact single-line entries with muted text — like GitHub's timeline. | ✓ |
| Uniform cards | Both use same card style, different icon/color. | |
| Grouped field changes | Multiple changes within same minute collapsed into single grouped entry. | |

**User's choice:** Compact field changes
**Notes:** GitHub-style timeline pattern.

### Q3: Default sort order?

| Option | Description | Selected |
|--------|-------------|----------|
| Newest first | Most recent at top — matches existing comment sort default. | ✓ |
| Oldest first | Chronological from issue creation. | |

**User's choice:** Newest first

---

## Timeline Filter UX

### Q1: How should the activity filter controls look?

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle chips | Pill-shaped chips: [All] [Changes] [Comments]. Active highlighted. | ✓ |
| Segmented control | iOS-style toggle button group. | |
| Dropdown select | Small dropdown: "Show: All activity". | |

**User's choice:** Toggle chips

### Q2: Should chips show counts?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show counts | Each chip shows count: [All (24)] [Changes (16)] [Comments (8)]. | ✓ |
| No counts | Keep minimal: [All] [Changes] [Comments]. | |

**User's choice:** Yes, show counts

---

## Watcher & Overdue Placement

### Q1: Where should the watch/unwatch toggle go?

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar field row | Add Watchers row in sidebar alongside Status, Assignee, etc. Eye icon + count + toggle. | ✓ |
| Header action button | Add Watch button next to Pin/Edit/Open in Jira. | |
| Both sidebar + header | Count in sidebar, toggle in header. | |

**User's choice:** Sidebar field row

### Q2: Where should the overdue badge appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Everywhere due date shows | Red badge on: detail sidebar, board cards, backlog rows, search results. | ✓ |
| Issue detail only | Only on detail page sidebar. | |
| Detail + board cards | Detail and board cards, not backlog/search. | |

**User's choice:** Everywhere due date shows

---

## Clone Issue Behavior

### Q1: How should clone work?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-filled create form | Clone opens CreateEditIssueModal pre-filled with source fields. User reviews before saving. | ✓ |
| Direct API clone | Creates immediately via API, navigates to new issue. | |
| Confirmation dialog | Shows what will be copied, then creates via API. | |

**User's choice:** Pre-filled create form

### Q2: Where should the Clone button go?

| Option | Description | Selected |
|--------|-------------|----------|
| Action bar with Pin/Edit | Add alongside existing Pin, Edit, Open in Jira buttons. | ✓ |
| 3-dot overflow menu | Inside overflow menu for less-common actions. | |
| Sidebar action | Button in right sidebar. | |

**User's choice:** Action bar with Pin/Edit

---

## Claude's Discretion

- Loading states for changelog API fetch
- Changelog entry grouping strategy
- Exact overdue badge styling
- Icon choices for timeline entry types

## Deferred Ideas

None — discussion stayed within phase scope
