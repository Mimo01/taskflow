# Phase 60: Static Dashboard / Welcome Screen - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 60-static-dashboard-welcome-screen
**Areas discussed:** Layout & visual warmth, Sprint card scope, My In-Progress subtasks, Release countdown details

---

## Layout & Visual Warmth

| Option | Description | Selected |
|--------|-------------|----------|
| Greeting row + 3 cards in a row | Full-width greeting at top, three equal cards side by side | |
| Greeting row + stacked single column | Full-width greeting, cards stacked vertically | |
| Greeting embedded in hero + cards below | Large hero section with name/date prominently centered, cards below | ✓ |

**User's choice:** Greeting embedded in hero + cards below

---

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle gradient background + large greeting text | Soft gradient/tinted surface, large name in warm tone, no illustrations | ✓ |
| Plain background, just large text | No color treatment, clean typography | |
| Accent color band + white text | Solid accent-colored hero band | |

**User's choice:** Subtle gradient background + large greeting text

---

| Option | Description | Selected |
|--------|-------------|----------|
| All same style — standard border + bg-card | Consistent with rest of app | |
| Subtle icon accent per card | Small colored icon in each card header | ✓ |
| You decide | Claude picks what fits best | |

**User's choice:** Subtle icon accent per card (sprint → orange/amber, subtasks → green, release → blue)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Good morning / afternoon / evening | Time-of-day variant based on hour | |
| Just "Welcome back, [name]" | Time-of-day neutral | ✓ |

**User's choice:** "Welcome back, [name]"

**Notes (freeform):** "there can be illustrations, make it professional but welcoming" — user confirmed illustrations are OK; deferred to Claude's discretion on style and placement.

---

## Sprint Card Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Write a fresh DashboardSprintCard | New component, reuses same query keys, SprintHealthPanel stays intact | ✓ |
| Adapt SprintHealthPanel in place | Strip at-risk list, add sprint name + progress bar | |

**User's choice:** Write a fresh DashboardSprintCard

---

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly the 3 required fields, nothing more | Sprint name, days remaining, % complete progress bar | |
| Add story point counts | Also show X / Y points done | |
| You decide | Claude adds whatever is naturally readable | ✓ |

**User's choice:** You decide (Claude's discretion on whether to add point counts)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state message inside the card | "No active sprint" — card stays visible | ✓ |
| Hide the card entirely | Dashboard collapses to 2 cards | |

**User's choice:** Empty state message — "No active sprint"

---

## My In-Progress Subtasks

| Option | Description | Selected |
|--------|-------------|----------|
| Status category = indeterminate only | Matches any Jira "In Progress" status | ✓ |
| Any non-done, non-todo status | Broader, includes custom statuses like "In Review" | |

**User's choice:** Status category = indeterminate (In Progress) only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page /issue/:key route | Opens issue detail page | ✓ |
| IssueDetailSheet (slide-over) | Opens sheet overlay without leaving dashboard | |

**User's choice:** Full-page /issue/:key route

---

| Option | Description | Selected |
|--------|-------------|----------|
| fetchSprintIssues — reuse sprint-board cache key | Zero extra API calls if sprint board cache warm | ✓ |
| Dedicated fetchMyInProgressSubtasks JQL query | Precise, independent, one extra fetch on first load | |

**User's choice:** fetchSprintIssues (reuse existing cache key)

---

| Option | Description | Selected |
|--------|-------------|----------|
| "No subtasks in progress — nice work!" | Friendly empty state | ✓ |
| "No subtasks in progress" | Neutral | |

**User's choice:** "No subtasks in progress — nice work!"

---

## Release Countdown Details

| Option | Description | Selected |
|--------|-------------|----------|
| Jira fix versions only | Pure Jira, no GitLab token needed | ✓ |
| Include GitLab milestone match | Show linked GitLab milestone alongside, adds GitLab dependency | |

**User's choice:** Jira fix versions only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state: "No upcoming releases" (card stays) | Layout stable | ✓ |
| Hide the card entirely | Dashboard shows 2 cards | |
| Show "N versions pending, no dates set" | Show count when versions exist but no dates | |

**User's choice:** "No upcoming releases" — card stays visible

---

| Option | Description | Selected |
|--------|-------------|----------|
| "Today" / "X days overdue" with warning badge | Clear urgency signal, amber/red | ✓ |
| Just show "0 days" or negative number | No special treatment | |

**User's choice:** "Today" / "X days overdue" with amber/red warning badge

---

## Claude's Discretion

- **Illustrations:** Style and placement of decorative SVG elements — professional but welcoming, fits shadcn/ui + Tailwind v4 constraints
- **Sprint card extra data:** Whether to show story point counts alongside the progress bar
- **Responsive behavior:** Breakpoints for 3-card row collapsing on narrow viewports

## Deferred Ideas

None — discussion stayed within phase scope.
