# Phase 3: Notifications Hub - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see a unified chronological feed of Jira comment mentions/replies and GitLab MR thread activity. They receive configurable OS desktop notifications for new items and can manage read/unread state per item or all at once. No write actions (reply, react, transition) — those are a future phase. No PM views. No global search.

</domain>

<decisions>
## Implementation Decisions

### Feed entry design
- Each notification row shows: **left border color accent** (Jira orange / GitLab purple) + **small source icon** (Jira J / GitLab fox) — both together for strong visual disambiguation
- Content per row: **title + body preview (2 lines)** — e.g. entity title ("PROJ-123: Fix login bug") + first ~80 chars of comment/thread body
- Unread indicator: **bold title + subtle background tint** for unread rows; normal weight, no tint for read rows
- Clicking a notification row: **opens an in-app read-only detail panel** showing full comment/thread content (author, timestamp, full body, entity title) — marks as read on open; no actions in the panel
- Detail panel does NOT include reply/transition actions (those are future scope)

### Navigation & badge placement
- Bell icon lives in a **new top bar above the main content area** (new layout component, persistent across all pages)
- Clicking the bell icon **opens a dropdown popover panel** with the notification feed — does not navigate away from the current page
- Unread badge: **red circle with count number, capped at 99+**, overlaid on the bell icon in the top bar
- Badge updates in real time as new notifications arrive

### Poll interval
- Notification polling is **user-configurable** in Settings (new section, similar to staleMrThresholdDays)
- **Default: 60 seconds. Minimum: 30 seconds. Maximum: 300 seconds (5 min)**
- Uses the same TanStack Query poll coordinator established in Phase 2 — no separate polling mechanism
- Cursor-based delta polling: only fetch items newer than the last-seen timestamp; persist last-seen cursor in Tauri Store

### OS notification behavior
- **User-configurable per source**: separate toggles in Settings for Jira OS notifications and GitLab OS notifications — user can enable/disable each independently
- OS notification format: **Title: source + entity** (e.g. "Jira — PROJ-123: Fix login bug") / **Body: author + comment snippet** (e.g. "J.Smith: Fixed the issue by updating...")
- Clicking an OS notification: **focus the app window + open the bell popover** showing the relevant notification
- When OS notification permission is denied: show an **in-app actionable banner** (using existing `alert.tsx`) explaining the situation and linking to OS settings — banner is dismissible

### Read/unread state management
- Mark individual notification as read: click the row (opens detail panel, marks read simultaneously)
- Mark all as read: a "Mark all as read" button in the popover header
- Read state persisted in Tauri Store (survives app restart)

### Claude's Discretion
- Exact left border width and color values for Jira vs GitLab
- Detail panel layout (slide-in vs inline expansion vs modal)
- Empty state design when no notifications exist
- Loading skeleton for the popover panel
- Exact top bar layout (height, alignment, other elements in the bar)
- Typography and spacing within notification rows

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/popover.tsx` — shadcn/ui Popover: ready to use for the bell dropdown panel
- `src/components/ui/alert.tsx` — for the OS notification permission-denied banner
- `src/components/ui/button.tsx` — for "Mark all as read" and "Open in Jira/GitLab" buttons
- `src/stores/settings.store.ts` — Zustand persist pattern; notification poll interval + per-source OS notification toggles go here (same as staleMrThresholdDays)
- `src/components/app/Sidebar.tsx` — vertical sidebar already established; top bar is a new sibling layout component alongside the sidebar
- `@tauri-apps/plugin-opener` (openUrl) — already used in Phase 2 for external links; use same pattern for "open in browser" if added

### Established Patterns
- **TanStack Query poll coordinator**: Phase 3 plugs notification queries into the same coordinator established in Phase 2 (min 30s, no per-component polling)
- **tauri-plugin-http fetch**: all Jira and GitLab API calls must use `fetch` from `@tauri-apps/plugin-http`
- **Zustand + persist**: new notification state (unread items, last-seen cursor, read IDs) follows existing store conventions; persist via Tauri Store
- **Inline errors, no toast**: error handling stays consistent with Phase 2 — no modal, no global toast

### Integration Points
- `src/main.tsx` / app layout — top bar is a new layout layer above the content area; needs to wrap both sidebar and content
- `src/stores/settings.store.ts` — add `notificationPollIntervalSecs`, `osNotifJiraEnabled`, `osNotifGitlabEnabled`
- New `src/stores/notifications.store.ts` — unread count, notification items, last-seen cursor, read IDs (persisted)
- New `src/services/notifications.ts` — delta polling logic, event ID deduplication (jira-comment-{id} / gitlab-note-{id})
- Tauri Notification plugin — for dispatching OS desktop notifications on macOS/Windows/Linux
- New route `/notifications` or notification popover component attached to the top bar bell icon

</code_context>

<specifics>
## Specific Ideas

- Bell icon in top bar with red badge: `🔔 [3]` — badge overlays top-right of icon
- Notification row mockup: `| [J border] [J icon]  PROJ-123: Fix login bug  (bold, tinted bg)  2m ago |`
  - Below: `"J.Smith: The issue was caused by a race condition in..."`
- Popover header: `Notifications  [Mark all as read]`
- OS notification: Title: `"Jira — PROJ-123"` / Body: `"J.Smith: The issue was caused by..."`
- Permission-denied banner (uses alert.tsx): `"Desktop notifications are blocked. Enable them in System Settings → Notifications → Taskflow."`

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-notifications-hub*
*Context gathered: 2026-03-11*
