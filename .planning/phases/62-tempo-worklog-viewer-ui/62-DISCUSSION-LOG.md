# Phase 62: Tempo Worklog Viewer UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 62-Tempo Worklog Viewer UI
**Areas discussed:** People filter source, Sidebar placement, Cell format, Custom date range

---

## People Filter Source

| Option | Description | Selected |
|--------|-------------|----------|
| Extract from first worklog fetch | Populate dropdown from authors in initial fetch; single-select | |
| Jira assignable users API | Call fetchAssignableUsers on mount; shows all team members | |
| Manual username input | Free-text or type-ahead field | |

**User's choice (Q1):** Manual username input

**Follow-up Q2 — Input mechanics:**

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-value tag input | User types username, hits Enter to add chip; empty = all | |
| Comma-separated text field | Single input, type multiple usernames | |
| Fetched from first load, but editable | Pre-populate from initial fetch, allow add/remove | |

**User's choice (Q2):** "Only a single person can be selected at a time" (freeform)

**Follow-up Q3 — How single person is selected:**

| Option | Description | Selected |
|--------|-------------|----------|
| Extract names from first worklog fetch | Dropdown from initial fetch authors | |
| Plain text input field | User types Jira username directly | |
| You decide | Claude picks best pattern | |

**User's choice (Q3):** "Text input with autocomplete. The same as we use on multiple places in the app (can be visually different based on what you need here)"

**Notes:** User overrode TEMPO-03 multi-select to single-select. The people list comes from the initial worklog fetch's author data. UI pattern mirrors the BacklogFilterBar MultiFilterCombobox but adapted to single-select.

---

## Sidebar Placement

| Option | Description | Selected |
|--------|-------------|----------|
| tracking section | Add 'Tempo' next to Sprint Progress and Releases | ✓ |
| New 'timesheets' section | Dedicated section for Tempo | |
| testing section (alongside AIO) | Both are plugin-gated integrations | |

**User's choice:** tracking section (Recommended)

**Follow-up Q — Icon and label:**

| Option | Description | Selected |
|--------|-------------|----------|
| Clock icon, label 'Worklogs' | Clock is intuitive for time-tracking; Worklogs matches Tempo terminology | ✓ |
| Timer icon, label 'Timesheets' | Timesheets is the Tempo plugin name | |
| You decide | Claude picks best fit | |

**User's choice:** Clock icon, label 'Worklogs' (Recommended)

**Notes:** Straightforward — no follow-ups needed.

---

## Cell Format

**Q1 — Hours format:**

| Option | Description | Selected |
|--------|-------------|----------|
| Xh Ym format (e.g. 7h 30m) | Most readable; matches Jira display style | ✓ |
| Decimal hours (e.g. 7.5h) | Compact; easy to scan totals | |
| You decide | Claude picks for table layout | |

**User's choice:** Xh Ym format

**Q2 — Zero cells:**

| Option | Description | Selected |
|--------|-------------|----------|
| Empty / blank | No text; non-zero cells stand out | ✓ |
| Em dash — | Signals intentional empty vs not loaded | |
| 0h | Explicit zero; consistent but clutters table | |

**User's choice:** Empty / blank (Recommended)

**Notes:** Simple and consistent decisions.

---

## Custom Date Range

| Option | Description | Selected |
|--------|-------------|----------|
| Two inline <input type="date"> fields | Simple; no extra components; appear in filter bar | |
| Calendar popover (shadcn Calendar + Popover) | Better UX; more code; shadcn Calendar available | |
| You decide | Claude picks whichever fits filter bar layout | ✓ |

**User's choice:** You decide

**Notes:** Claude will use two inline `<input type="date">` fields — simpler, no extra components, reliable cross-platform.

---

## Claude's Discretion

- **Custom date range UI:** Two inline `<input type="date">` fields in the filter bar when "Custom" preset is selected. From and To fields appear inline; selecting both dates triggers fetch.

## Deferred Ideas

None — discussion stayed within phase scope.
