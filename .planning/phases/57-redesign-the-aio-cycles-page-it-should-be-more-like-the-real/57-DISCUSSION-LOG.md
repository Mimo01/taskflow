# Phase 57: Redesign the AIO Cycles Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 57-redesign-the-aio-cycles-page-it-should-be-more-like-the-real
**Areas discussed:** Folder depth, Summary API, Layout, Cycle columns, Owner display, Closed cycle handling

---

## Folder depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full tree — all levels | Render each folder level with indented children. Matches the real AIO sidebar. | ✓ |
| Top-level only | Just root folders as section headers, ignoring sub-folders. | |
| Two levels max | Root + one level of sub-folders. Middle ground. | |

**User's choice:** Full tree — all levels
**Notes:** The `folder` API response has 3+ nesting levels. The UI should render the full hierarchy recursively.

---

## Summary API vs. N+1 run fetches

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — use summary API | One API call gets stats for all cycles via `testRunDistribution`. Researcher probes status ID mapping. | ✓ |
| Keep per-cycle run fetching | Current approach: N separate run fetches, per-row skeleton loading. | |

**User's choice:** Use summary API
**Notes:** The `paged2` file shows the summary shape. Status IDs 51, 53, 54, 55, 901 need researcher confirmation.

---

## Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Left sidebar tree + right cycle list | Folder tree in left panel. Click folder → cycles in right panel. | ✓ |
| Inline accordion tree | Full nested tree rendered inline, same general area as current. | |
| You decide | Claude picks layout. | |

**User's choice:** Left sidebar tree + right cycle list
**Notes:** Classic two-panel file-explorer layout.

---

## Cycle columns

| Option | Description | Selected |
|--------|-------------|----------|
| Key \| Name \| Status \| Progress bar + counts | Current columns, now from summary API. | |
| Key \| Name \| Owner \| Total tests \| Progress bar | Add owner (resolved from ownedByID) and total test count. | ✓ |
| Name \| Progress bar only | Minimal — name + visual bar only. | |

**User's choice:** Key | Name | Owner | Total tests | Progress bar
**Notes:** Owner requires Jira user API lookup for ownedByID. Total tests from summary.totalTests.

---

## Owner display

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve to display name via Jira user API | Fetch user info for each unique owner ID. Shows actual name. | ✓ |
| Show raw user ID as-is | No extra API calls. Looks technical. | |

**User's choice:** Resolve via Jira user API
**Notes:** Sample IDs: "JIRAUSER23429", "ext94772". Use /rest/api/2/user?username= endpoint.

---

## Closed cycle handling

| Option | Description | Selected |
|--------|-------------|----------|
| Hide closed + remember folder | Clean default — open only, folder persists. | |
| Show all + don't persist | All cycles visible, no persistence. | |
| Show all + add a toggle + remember | Open by default, "Show closed" toggle, folder remembered. | ✓ |

**User's choice:** Show all + add a "Show closed" toggle + remember
**Notes:** Toggle default = off (closed hidden). Selected folder persisted across page visits.

---

## Claude's Discretion

- Left panel width (e.g., w-56 or w-64)
- Folder tree initial expand behavior (auto-expand first folder)
- Visual indicator for closed cycle rows (muted text, badge, or strikethrough)
- Query arrangement (folder tree + count + cycle list + summaries — whether combined or separate queries)
- Progress bar rendering details

## Deferred Ideas

- Resizable left panel — adds complexity, not needed for v1.8
- Folder search/filter — for large trees, future phase
- AIO write actions (cycle creation) — AIOWR-02, explicitly out of scope
- Pre-loading AIO token into auth store — deferred from Phase 56, useAioCredentials() is the chosen approach
