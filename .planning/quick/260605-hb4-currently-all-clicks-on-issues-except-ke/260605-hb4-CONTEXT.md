# Quick Task 260605-hb4: Force full-page open for notification & dashboard issue clicks - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Task Boundary

Currently all clicks on an issue/task (except the issue **key** link) open the **PeekPanel** quick sidebar. Notifications and the Dashboard home should instead **always open the full issue page** (`/issue/:key`) — never the peek sidebar.

The mechanism: two outlet-context handlers exist —
- `onOpenIssue` → `handleOpenPeek` → opens the PeekPanel sidebar
- `onIssueClick` → `handleIssueClick` → `navigate('/issue/:key')` (full page)

Today, notification rows and the dashboard In-Progress card prefer `onOpenIssue` for body clicks (`(onOpenIssue ?? onIssueClick)(key)`), and only the issue-key button (with `stopPropagation`) forces `onIssueClick`.

</domain>

<decisions>
## Implementation Decisions

### Notifications scope
- "Notifications" = the TopBar **NotificationPopover** dropdown and its **NotificationRow** items. There is no dedicated notifications page/route — only the popover.
- Both the row-body click and the issue-key click in notifications must navigate full-page (key already does; body must change from peek to full-page).

### Dashboard scope
- **Dashboard home only** — the Dashboard landing page cards, i.e. `DashboardInProgressCard` (and any other issue-clickable widget rendered by `routes/dashboard/index.tsx`).
- **Out of scope (leave peek behavior unchanged):** Sprint Board (`SprintBoardTab`), Backlog (`BacklogPage`/`BacklogRow`), Standup Notes, Command Palette, and the issue-detail inner panels. Do NOT touch these.

### Breadcrumb behavior
- Opening the full page from notifications/dashboard should **start a fresh breadcrumb trail** (`resetTrail = true`), treating it as a new entry point — same as clicking the issue key from the TopBar today.

### Claude's Discretion
- **How to force full-page**: prefer the minimal, local change. Make the notification row body click and the dashboard In-Progress card body click call the full-page handler directly (instead of the `onOpenIssue ?? onIssueClick` peek-preferring fallback), and ensure those calls reset the breadcrumb trail. Avoid broad refactors of `main.tsx` wiring unless cleaner.
- Keep the issue-key-button path working (it already navigates full-page) — no regression.
- Preserve `markAsRead` and popover-close side effects on notification clicks.

</decisions>

<specifics>
## Specific Ideas

Key files identified during discovery:
- `src/routes/notifications/NotificationPopover.tsx` — `handleRowClick` (~L274) prefers `onOpenIssue`; `handleIssueKeyClick` (~L299) uses `onIssueClick`.
- `src/routes/notifications/NotificationRow.tsx` — row body → `onOpenIssue`; key button → `onIssueClick` (PEEK-05 comment).
- `src/routes/dashboard/DashboardInProgressCard.tsx` — body clicks use `(onOpenIssue ?? onIssueClick)(key)` at ~L137/171/210; key buttons use `onIssueClick`.
- `src/routes/dashboard/index.tsx` — reads outlet context `onIssueClick` + `onOpenIssue`, passes both to the card.
- `src/main.tsx` — `handleIssueClick(issueKey, resetTrail=false)` (~L353), `handleOpenPeek` (~L322); outlet context wires `onIssueClick`/`onOpenIssue`; TopBar already wires `onIssueClick={(key)=>handleIssueClick(key, true)}`.

</specifics>

<canonical_refs>
## Canonical References

No external specs — internal "PEEK-05" convention governs key-button-vs-body click. Requirements fully captured in decisions above.

</canonical_refs>
