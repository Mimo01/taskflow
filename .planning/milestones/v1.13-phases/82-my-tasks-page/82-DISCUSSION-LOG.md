# Phase 82: My Tasks Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 82-my-tasks-page
**Areas discussed:** Filter strip behavior, Subtask nesting, My Day sort, All-Assigned scope UX, Context menu actions

---

## Filter strip behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Single-select, transient | One filter active at a time; re-click clears; resets on reload | ✓ |
| Multi-select, transient | OR-combine multiple counts; resets on reload | |
| Single-select, persisted | Active filter also survives restart | |

**User's choice:** Single-select, transient
**Notes:** Aligns with criterion 7 — only grouping mode and scope persist; the filter is transient. Filter narrows on top of the current grouping/scope (D-02).

---

## Subtask nesting (My Day & By Status)

| Option | Description | Selected |
|--------|-------------|----------|
| Flat rows everywhere | Subtasks as first-class rows; parent shown as context | |
| Nested under parent always | Subtasks indented under parent in every mode | ✓ |
| Flat, collapse subtasks of done parents | Flat, hide subtasks under Done parents | |

**User's choice:** Nested under parent always
**Notes:** Parent is the grouping/sort anchor in all three modes; standalone tasks render as single rows.

---

## My Day sort (with always-nested subtasks)

| Option | Description | Selected |
|--------|-------------|----------|
| Parent floats to its most-urgent child | Parent rank = highest-attention item in its subtree | ✓ |
| Parent sorts by its own status only | Subtasks ride along regardless of urgency | |
| Subtasks break out of nesting in My Day only | Flat attention-sort in My Day; nested elsewhere | |

**User's choice:** Parent floats to its most-urgent child
**Notes:** Sort key computed over the whole subtree against the band order flagged/blocked → overdue → in-review → in-progress → to-do → done. Flagged as the highest-subtlety implementation point; warrants its own unit test.

---

## All-Assigned scope UX (By Sprint & Parent ordering + guardrails)

| Option | Description | Selected |
|--------|-------------|----------|
| Active first, recent closed, lazy/progressive | Active → closed newest-first → backlog; stream pages, no cap | ✓ |
| Active first; collapse closed sprints by default | Same order, closed groups start collapsed | |
| Open/unresolved only by default | Hide Done/resolved across all sprints by default | |

**User's choice:** Active first, then recent closed; lazy/progressive
**Notes:** No client-side page cap; `fetchAllSearchPages` server-side pagination enforced by criterion 6's unit test. Loading indicator while pages stream in.

---

## Context menu actions

| Option | Description | Selected |
|--------|-------------|----------|
| Log Work | Open LogWorkPopover (required by criterion 5) | ✓ |
| Flag / Unflag | Toggle impediment flag | |
| Copy issue key / link | Copy KEY or deep link | ✓ |
| Open in browser | Open issue in Jira/GitLab web | |

**User's choice:** Log Work + Copy issue key / link
**Notes:** Flag/Unflag and Open-in-browser deferred — flagging still happens via peek/detail; the My Day flagged-band sort still reads the flag, it just isn't toggled here.

---

## Claude's Discretion

- Loading-indicator placement/style for progressive All-Assigned paging.
- Row component decomposition (reuse/adapt TaskCard/BacklogRow vs. new MyTaskRow).
- Store shape and selector design for `my-tasks.store.ts`.
- Optional collapse/expand affordance on sprint/parent groups.

## Deferred Ideas

- Flag/Unflag and Open-in-browser context-menu actions — easy to add later.
- Rank-order priority-stripe coloring (`priority-stripe-rest-rank.md`) — sprint-board concern, out of scope.
