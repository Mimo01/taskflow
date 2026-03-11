# Phase 3: Notifications Hub — Research

**Researched:** 2026-03-11
**Domain:** Tauri Notification Plugin, Jira/GitLab polling APIs, Zustand + TanStack Query state patterns
**Confidence:** HIGH (core patterns verified against official docs and existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Feed entry design**
- Each notification row shows: left border color accent (Jira orange / GitLab purple) + small source icon (Jira J / GitLab fox)
- Content per row: title + body preview (2 lines) — entity title ("PROJ-123: Fix login bug") + first ~80 chars of comment/thread body
- Unread indicator: bold title + subtle background tint for unread rows; normal weight, no tint for read rows
- Clicking a notification row: opens an in-app read-only detail panel showing full comment/thread content (marks as read on open); no actions in panel
- Detail panel does NOT include reply/transition actions (future scope)

**Navigation & badge placement**
- Bell icon lives in a new top bar above the main content area (new layout component, persistent across all pages)
- Clicking the bell icon opens a dropdown popover panel — does not navigate away from current page
- Unread badge: red circle with count number, capped at 99+, overlaid on the bell icon
- Badge updates in real time as new notifications arrive

**Poll interval**
- Notification polling is user-configurable in Settings (new section, similar to staleMrThresholdDays)
- Default: 60 seconds. Minimum: 30 seconds. Maximum: 300 seconds
- Uses the same TanStack Query poll coordinator established in Phase 2
- Cursor-based delta polling: only fetch items newer than last-seen timestamp; persist cursor in Tauri Store

**OS notification behavior**
- User-configurable per source: separate toggles in Settings for Jira OS notifications and GitLab OS notifications
- OS notification format: Title: source + entity / Body: author + comment snippet
- Clicking an OS notification: focus the app window + open the bell popover
- Permission-denied: show in-app actionable banner (using existing `alert.tsx`) — dismissible

**Read/unread state management**
- Mark individual notification as read: click the row (opens detail panel, marks read simultaneously)
- Mark all as read: "Mark all as read" button in popover header
- Read state persisted in Tauri Store (survives app restart)

### Claude's Discretion
- Exact left border width and color values for Jira vs GitLab
- Detail panel layout (slide-in vs inline expansion vs modal)
- Empty state design when no notifications exist
- Loading skeleton for the popover panel
- Exact top bar layout (height, alignment, other elements in the bar)
- Typography and spacing within notification rows

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTF-01 | User sees a unified notification feed combining Jira comment mentions/replies and GitLab MR thread activity | Jira JQL `comment ~ currentUser()` + GitLab MR discussions API; unified `NotificationItem` type; chronological sort by `createdAt` |
| NOTF-02 | Notifications are fetched via polling (configurable interval, minimum 30 seconds) | TanStack Query `refetchInterval` pattern already established in Phase 2 (MyTasksTab 60s); interval from settings store; last-seen cursor in Tauri Store |
| NOTF-03 | User receives native OS desktop notifications (macOS, Windows, Linux) for new activity | `@tauri-apps/plugin-notification` — `isPermissionGranted`, `requestPermission`, `sendNotification` confirmed in official docs; `notification:allow-notify` capability |
| NOTF-04 | App shows an in-app badge with the count of unread notifications | `unreadCount` derived from notifications store (items where `readIds` does not contain `id`); badge rendered on bell icon in top bar |
| NOTF-05 | User can mark individual notifications as read | Click row → `markAsRead(id)` in notifications store → add to `readIds` Set → persist |
| NOTF-06 | User can mark all notifications as read | "Mark all as read" button → `markAllRead()` in store → add all current item IDs to `readIds` → persist |
</phase_requirements>

---

## Summary

Phase 3 builds a notifications hub on top of the polling and store infrastructure already established in Phase 2. The implementation splits cleanly into two parts: an engine layer (delta polling + deduplication + OS notification dispatch) and a UI layer (top bar + popover + detail panel + settings).

The core technical challenge is the API polling strategy. Neither Jira Server REST v2 nor GitLab's notes/discussions APIs expose a native `since`/`created_after` cursor parameter — you must use timestamp-based delta filtering client-side. For Jira, the JQL `comment ~ currentUser() AND updatedDate >= "-1d"` pattern finds relevant issues but cannot guarantee only comments after the cursor; the service layer must filter comment `updated` timestamps against the stored cursor. For GitLab, MR discussions are polled per-MR using the existing `fetchMRDiscussions` pattern with client-side timestamp filtering.

The Tauri Notification plugin v2 (`@tauri-apps/plugin-notification`) covers OS desktop notifications on all three platforms. The JavaScript API (`isPermissionGranted`, `requestPermission`, `sendNotification`) is straightforward. The limitation to be aware of: clicking an OS notification on desktop does not fire a programmable action callback (the `onAction` API is mobile-only) — window focusing must be handled via a separate app-start check or OS-level behavior, not a click handler.

**Primary recommendation:** Use cursor-based last-seen timestamp stored in Tauri Store; filter new items client-side by comparing `created`/`updated` fields; stable event IDs (`jira-comment-{id}` / `gitlab-note-{id}`) prevent duplicates across polls. For OS notification click → window focus, use the window's `setFocus()` method called during app startup (check for pending focus on resume) rather than relying on notification action callbacks.

---

## Standard Stack

### Core (all already installed in the project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/plugin-notification` | `^2` (to install) | OS desktop notifications | Official Tauri plugin; cross-platform macOS/Windows/Linux |
| `@tauri-apps/plugin-store` | `^2.4.2` (installed) | Persist cursor + read IDs | Already used in settings.store.ts via LazyStore |
| `@tanstack/react-query` | `^5.90.21` (installed) | Polling coordinator | Phase 2 pattern; `refetchInterval` drives all polls |
| `zustand` | `^5.0.11` (installed) | Notification state | Same pattern as settings.store.ts + auth.store.ts |
| `lucide-react` | `^0.577.0` (installed) | Bell icon, badge | Already used in MyTasksTab (RefreshCw) |
| `@base-ui/react` Popover | `^1.2.0` (installed) | Bell dropdown popover | Phase 2 popover.tsx already wraps this |

### Tauri Plugin Not Yet Installed

```
notification plugin requires installation
```

Only `tauri-plugin-notification` needs to be added — everything else is already present.

**Installation (new dependency only):**
```bash
cd taskflow
npm install @tauri-apps/plugin-notification
cargo add tauri-plugin-notification
```

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
taskflow/src/
├── services/
│   └── notifications.ts          # delta polling logic, API calls, deduplication
├── stores/
│   └── notifications.store.ts    # unread count, items, readIds, lastSeenCursor
├── components/
│   └── app/
│       └── TopBar.tsx            # persistent top bar with bell + badge
├── routes/
│   └── notifications/
│       └── NotificationPopover.tsx   # popover panel content
│       └── NotificationRow.tsx       # single row (left border, icon, title, preview)
│       └── NotificationDetail.tsx    # read-only detail panel
│       └── notifications.test.tsx    # service unit tests
└── routes/
    └── settings/
        └── NotificationSettingsSection.tsx  # poll interval + per-source OS toggles

taskflow/src-tauri/
└── src/
    └── lib.rs                    # register tauri_plugin_notification::init()
```

### Pattern 1: TanStack Query Poll Coordinator (ESTABLISHED — replicate exactly)

**What:** `useQuery` with `refetchInterval` drives all background polling. No per-component `setInterval`. The interval value comes from the settings store.

**Phase 2 reference pattern (MyTasksTab.tsx):**
```typescript
// Source: taskflow/src/routes/dashboard/MyTasksTab.tsx
const { data, isLoading, isError } = useQuery({
  queryKey: ['jira-issues', 'my-tasks', activeJiraProject],
  queryFn: () => fetchSprintIssues(jiraBaseUrl!, token, activeJiraProject!),
  refetchInterval: 60_000,
  refetchIntervalInBackground: true,
  staleTime: 30_000,
  enabled: !!activeJiraProject && !!jiraBaseUrl,
})
```

**For notifications (adapt this):**
```typescript
// Source: pattern from MyTasksTab.tsx, adapted for notifications
const pollIntervalMs = useSettingsStore(s => s.notificationPollIntervalSecs) * 1000

const { data: newNotifs } = useQuery({
  queryKey: ['notifications', jiraBaseUrl, gitlabBaseUrl],
  queryFn: () => fetchNewNotifications(jiraBaseUrl, gitlabBaseUrl, tokens, lastSeenCursor),
  refetchInterval: pollIntervalMs,   // user-configurable, min 30_000
  refetchIntervalInBackground: true,
  staleTime: pollIntervalMs - 5_000,
  enabled: !!jiraBaseUrl || !!gitlabBaseUrl,
})
```

### Pattern 2: Notifications Store (follows settings.store.ts pattern exactly)

```typescript
// Source: pattern from taskflow/src/stores/settings.store.ts
const tauriStore = new LazyStore('notifications.json')
const tauriStorage = createJSONStorage(() => ({
  getItem: async (name) => (await tauriStore.get<string>(name)) ?? null,
  setItem: async (name, value) => { await tauriStore.set(name, value); await tauriStore.save() },
  removeItem: async (name) => { await tauriStore.delete(name); await tauriStore.save() },
}))

interface NotificationsState {
  items: NotificationItem[]
  readIds: Set<string>            // persisted
  lastSeenCursor: string | null   // ISO timestamp, persisted
  markAsRead: (id: string) => void
  markAllRead: () => void
  setItems: (items: NotificationItem[]) => void
  setLastSeenCursor: (ts: string) => void
}
```

**Important:** Zustand `persist` middleware handles serialization. `Set<string>` will need to be serialized as an array and deserialized back — use a custom `partialize` or store `readIds` as `string[]` in state with a getter that returns a Set.

### Pattern 3: Stable Event ID Deduplication

```typescript
// Canonical event ID format — prevents duplicate notifications across polls
type EventId = `jira-comment-${string}` | `gitlab-note-${string}`

function toEventId(source: 'jira', commentId: string): EventId
function toEventId(source: 'gitlab', noteId: string): EventId

// In fetchNewNotifications: filter new items against existing item IDs
const existingIds = new Set(store.items.map(i => i.id))
const deduped = incoming.filter(item => !existingIds.has(item.id))
```

### Pattern 4: Tauri Notification Plugin (verified against official v2 docs)

```typescript
// Source: https://v2.tauri.app/plugin/notification/
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

async function dispatchOsNotification(title: string, body: string): Promise<void> {
  let granted = await isPermissionGranted()
  if (!granted) {
    const state = await requestPermission()
    granted = state === 'granted'
  }
  if (granted) {
    await sendNotification({ title, body })
  }
  // If still not granted: caller sets permissionDenied flag → in-app banner
}
```

**OS notification format (from CONTEXT.md):**
- Title: `"Jira — PROJ-123: Fix login bug"`
- Body: `"J.Smith: Fixed the issue by updating..."`

### Pattern 5: Top Bar Layout Integration

The existing `AppLayout` in `main.tsx` has `<div className="flex flex-col flex-1 overflow-hidden">` containing `ReAuthBanner` and `<main>`. The `TopBar` is inserted as the first child of that div:

```typescript
// Source: taskflow/src/main.tsx — AppLayout, with TopBar added
return (
  <div className="flex h-screen overflow-hidden">
    <Sidebar />
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar />                    {/* NEW: bell + badge */}
      {!jiraConnected && <ReAuthBanner />}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  </div>
)
```

### Pattern 6: Window Focus on OS Notification Click

**Limitation:** The `onAction` callback in `@tauri-apps/plugin-notification` is mobile-only. Desktop OS notification clicks do not fire a programmable callback in Tauri v2.

**Workaround:** Use `getCurrentWindow().setFocus()` from `@tauri-apps/api/window` triggered by app startup / visibility change. The app window will be brought to focus when the user clicks the OS notification and the OS activates the app window natively.

```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewindow/
import { getCurrentWindow } from '@tauri-apps/api/window'

// Called on app mount — brings window forward when OS activates app
await getCurrentWindow().setFocus()
```

The capability needed is `core:window:allow-set-focus` in `capabilities/default.json`.

### Anti-Patterns to Avoid

- **Per-component setInterval:** Never use `setInterval` in notification components — use TanStack Query `refetchInterval` as established in Phase 2
- **Token strings in Zustand:** Never store PAT strings in notification store — use `readSecret('jira-pat')` refs as established in MyTasksTab
- **Global toast for errors:** Inline errors only, consistent with Phase 2 pattern
- **Polling all MR discussions every tick:** Only poll MRs where current user is involved (assigned or reviewer) — reuse the existing `fetchAssignedMRs`/`fetchReviewerMRs` query results
- **Set<T> in Zustand persist:** Zustand JSON serialization doesn't handle `Set<T>` — store `readIds` as `string[]`, expose a derived `readIdSet` for O(1) lookup

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS desktop notifications | Custom OS notification layer | `@tauri-apps/plugin-notification` | Cross-platform permission model, OS integration handled |
| Persisted notification state | Custom localStorage adapter | `LazyStore` + Zustand persist (same as settings.store.ts) | Already established pattern; handles async Tauri Store |
| Popover dropdown | Custom dropdown | `popover.tsx` (base-ui) already in project | Already wired, tested in Phase 2 |
| Permission-denied UI | Custom component | `alert.tsx` already in project | CONTEXT.md explicitly calls this out |
| JSON storage adapter | Custom Tauri Store binding | `createJSONStorage` + `LazyStore` (copy from settings.store.ts verbatim) | Established pattern with save() calls |
| Time formatting ("2m ago") | Custom date library | Native `Intl.RelativeTimeFormat` or simple timestamp diff | No extra dependency needed; not complex |

**Key insight:** The notification plugin installation (`npm install @tauri-apps/plugin-notification` + Cargo) is the only new dependency needed. All UI primitives, storage, and polling infrastructure already exist in the project.

---

## Common Pitfalls

### Pitfall 1: Jira Comment Delta Polling — No Native `since` Filter

**What goes wrong:** Developers assume `GET /rest/api/2/issue/{key}/comment` supports a date filter to return only new comments. It does not. Fetching all comments for all relevant issues on every poll is expensive and scales poorly.

**Why it happens:** The JQL search approach (`comment ~ currentUser() AND updatedDate >= "-1d"`) finds issues where the user was recently mentioned, but the `updatedDate` refers to the issue's update time, not a specific comment's creation time. There is no JQL function to filter by comment date AND content simultaneously on Jira Server.

**How to avoid:**
1. Use JQL `comment ~ currentUser() AND updatedDate >= "YYYY-MM-DD HH:mm"` to get candidate issues (issues with recent activity where current user is mentioned)
2. For each candidate issue, fetch `GET /rest/api/2/issue/{key}/comment?orderBy=-created&maxResults=20` to get recent comments
3. Filter comments client-side: `comment.updated > lastSeenCursor` AND `comment.body` contains the user's username/displayName
4. Store the maximum `comment.updated` timestamp as the new cursor

**Warning signs:** Polls taking >2 seconds, or the notification feed showing old items repeatedly.

### Pitfall 2: GitLab Notes API Has No `created_after` Parameter

**What goes wrong:** The GitLab MR notes API (`GET /projects/:id/merge_requests/:iid/notes`) does not accept `created_after` or `updated_after`. All notes are returned and must be client-side filtered.

**How to avoid:** The Phase 2 `fetchMRDiscussions` already fetches all discussions for an MR. For notifications, use the same pattern but:
1. Only poll MRs where the user is involved (assigned/reviewer) — already fetched by Phase 2 queries
2. Filter notes client-side by `note.created_at > lastSeenCursor`
3. Filter to notes authored by others (not the current user) to avoid self-notification

**Warning signs:** Generating OS notifications for the user's own comments.

### Pitfall 3: `Set<string>` Cannot Be JSON-Serialized by Zustand Persist

**What goes wrong:** `readIds` stored as `Set<string>` in Zustand state will serialize as `{}` (empty object) when persisted through `createJSONStorage`. After app restart, `readIds` becomes an empty Set.

**How to avoid:** Store `readIds` as `string[]` in Zustand state. Add a derived selector `readIdSet = new Set(state.readIds)` or use `.includes()` for membership checks. The persist middleware serializes arrays correctly.

### Pitfall 4: Tauri Notification `onAction` Is Mobile-Only

**What goes wrong:** Developer implements `onAction` callback expecting to intercept desktop notification clicks and programmatically open the popover. This callback does not fire on desktop (macOS/Windows/Linux).

**How to avoid:** Do not attempt click-to-open-popover via the notification plugin. The OS will bring the Taskflow window to the foreground natively when the notification is clicked. Add `getCurrentWindow().setFocus()` to the app startup sequence. The user will see the app window — the popover state can be set to "open" on the next interaction or via a query param approach.

**Warning signs:** `onAction` callback registered but never firing on desktop during testing.

### Pitfall 5: `notificationPollIntervalSecs` Validation Must Be Client-Side Clamped

**What goes wrong:** User types "5" in the settings input, triggering a 5-second poll interval. This will hammer the Jira/GitLab servers and may trigger rate limiting.

**How to avoid:** Clamp the value in the setter: `Math.max(30, Math.min(300, value))`. Never allow the TanStack Query `refetchInterval` to go below 30,000ms. Display the clamped value back in the input.

### Pitfall 6: Notification Plugin Requires Cargo Registration

**What goes wrong:** Developer installs npm package but forgets to add `tauri_plugin_notification::init()` in `src-tauri/src/lib.rs` and `tauri-plugin-notification` in `Cargo.toml`. The app panics or silently fails to send notifications.

**How to avoid:** Both steps are required:
1. `Cargo.toml` dependency + `lib.rs` plugin registration
2. Capability permissions in `capabilities/default.json`
3. npm package install

---

## Code Examples

### Tauri Notification Plugin — Full Permission + Send Flow

```typescript
// Source: https://v2.tauri.app/plugin/notification/
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

export async function tryDispatchOsNotification(
  title: string,
  body: string,
): Promise<'sent' | 'denied' | 'error'> {
  try {
    let granted = await isPermissionGranted()
    if (!granted) {
      const state = await requestPermission()
      granted = state === 'granted'
    }
    if (!granted) return 'denied'
    await sendNotification({ title, body })
    return 'sent'
  } catch {
    return 'error'
  }
}
```

### Cargo.toml and lib.rs Changes

```toml
# src-tauri/Cargo.toml — add this line
tauri-plugin-notification = "2"
```

```rust
// src-tauri/src/lib.rs — add plugin init
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())  // ADD
        .plugin(tauri_plugin_store::Builder::default().build())
        // ... other existing plugins
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
```

### capabilities/default.json Changes

```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "stronghold:default",
    "store:default",
    "http:default",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify"
  ]
}
```

### Notifications Store Pattern

```typescript
// Source: adapted from taskflow/src/stores/settings.store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LazyStore } from '@tauri-apps/plugin-store'

const tauriStore = new LazyStore('notifications.json')
const tauriStorage = createJSONStorage(() => ({
  getItem: async (name) => (await tauriStore.get<string>(name)) ?? null,
  setItem: async (name, value) => { await tauriStore.set(name, value); await tauriStore.save() },
  removeItem: async (name) => { await tauriStore.delete(name); await tauriStore.save() },
}))

export interface NotificationItem {
  id: string           // 'jira-comment-{id}' | 'gitlab-note-{id}'
  source: 'jira' | 'gitlab'
  entityTitle: string  // "PROJ-123: Fix login bug"
  author: string       // "J.Smith"
  bodyPreview: string  // first ~80 chars
  fullBody: string
  createdAt: string    // ISO 8601
}

interface NotificationsState {
  items: NotificationItem[]
  readIds: string[]               // string[] not Set — JSON-serializable
  lastSeenCursor: string | null   // ISO timestamp
  permissionDenied: boolean       // transient, not persisted
  setItems: (items: NotificationItem[]) => void
  prependItems: (newItems: NotificationItem[]) => void
  markAsRead: (id: string) => void
  markAllRead: () => void
  setLastSeenCursor: (ts: string) => void
  setPermissionDenied: (v: boolean) => void
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      readIds: [],
      lastSeenCursor: null,
      permissionDenied: false,
      setItems: (items) => set({ items }),
      prependItems: (newItems) => set((s) => ({
        items: [...newItems, ...s.items].slice(0, 200), // cap at 200
      })),
      markAsRead: (id) => set((s) => ({
        readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
      })),
      markAllRead: () => set((s) => ({
        readIds: s.items.map(i => i.id),
      })),
      setLastSeenCursor: (ts) => set({ lastSeenCursor: ts }),
      setPermissionDenied: (v) => set({ permissionDenied: v }),
    }),
    {
      name: 'notifications-store',
      storage: tauriStorage,
      partialize: (s) => ({
        // Only persist these fields; permissionDenied is transient
        items: s.items,
        readIds: s.readIds,
        lastSeenCursor: s.lastSeenCursor,
      }),
    },
  ),
)
```

### Settings Store Extension

```typescript
// Source: taskflow/src/stores/settings.store.ts — extend existing interface
interface SettingsState {
  // ... existing fields ...
  notificationPollIntervalSecs: number  // default 60, min 30, max 300
  osNotifJiraEnabled: boolean           // default true
  osNotifGitlabEnabled: boolean         // default true
  setNotificationPollIntervalSecs: (secs: number) => void
  setOsNotifJiraEnabled: (v: boolean) => void
  setOsNotifGitlabEnabled: (v: boolean) => void
}
```

### Jira Comment Delta Polling Strategy

```typescript
// Source: Jira Server REST API v2 pattern + community research
async function fetchNewJiraComments(
  baseUrl: string,
  token: string,
  projectKey: string,
  currentUserDisplayName: string,
  lastSeenCursor: string | null,
): Promise<NotificationItem[]> {
  const since = lastSeenCursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sinceJql = since.substring(0, 16).replace('T', ' ')  // "YYYY-MM-DD HH:mm"

  // Step 1: Find candidate issues (commented recently, mentions current user)
  const jql = `project = ${projectKey} AND comment ~ "${currentUserDisplayName}" AND updatedDate >= "${sinceJql}" ORDER BY updated DESC`
  const searchResp = await fetch(
    `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,comment&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const { issues } = await searchResp.json()

  // Step 2: For each issue, filter comments newer than cursor containing user mention
  const results: NotificationItem[] = []
  for (const issue of issues) {
    for (const comment of issue.fields.comment.comments ?? []) {
      if (comment.updated > (lastSeenCursor ?? '')) {
        if (comment.body.includes(currentUserDisplayName)) {
          results.push({
            id: `jira-comment-${comment.id}`,
            source: 'jira',
            entityTitle: `${issue.key}: ${issue.fields.summary}`,
            author: comment.author.displayName,
            bodyPreview: comment.body.substring(0, 80),
            fullBody: comment.body,
            createdAt: comment.created,
          })
        }
      }
    }
  }
  return results
}
```

### GitLab MR Note Delta Polling Strategy

```typescript
// Source: GitLab Notes API docs + existing fetchMRDiscussions pattern in gitlab.ts
async function fetchNewGitlabNotes(
  baseUrl: string,
  token: string,
  currentUserId: number,
  mrList: GitLabMR[],
  lastSeenCursor: string | null,
): Promise<NotificationItem[]> {
  const results: NotificationItem[] = []
  const since = lastSeenCursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  for (const mr of mrList) {
    const url = `${baseUrl}/api/v4/projects/${mr.project_id}/merge_requests/${mr.iid}/notes?order_by=created_at&sort=desc&per_page=20`
    const resp = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } })
    const notes = await resp.json()

    for (const note of notes) {
      if (note.system) continue                  // skip system notes
      if (note.author.id === currentUserId) continue  // skip own notes
      if (note.created_at <= since) break        // notes sorted desc — stop at cursor

      results.push({
        id: `gitlab-note-${note.id}`,
        source: 'gitlab',
        entityTitle: mr.title,
        author: note.author.name,
        bodyPreview: note.body.substring(0, 80),
        fullBody: note.body,
        createdAt: note.created_at,
      })
    }
  }
  return results
}
```

### Window Focus on App Activation

```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewindow/
import { getCurrentWindow } from '@tauri-apps/api/window'

// Called in AppLayout on mount — ensures window is visible when OS activates app
useEffect(() => {
  getCurrentWindow().setFocus().catch(() => {/* non-critical */})
}, [])
```

### Badge Count Selector

```typescript
// Derived selector — avoids storing count separately
export const useUnreadCount = () =>
  useNotificationsStore((s) => {
    const readSet = new Set(s.readIds)
    return s.items.filter(i => !readSet.has(i.id)).length
  })

// Cap display at 99+
const displayCount = count > 99 ? '99+' : String(count)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `setInterval` for polling | TanStack Query `refetchInterval` | No memory leaks, deduplication, background tab throttling |
| `localStorage` for persistence | Tauri Store + Zustand persist | Works in Tauri webview, survives app restart |
| Webhooks for real-time | Cursor-based delta polling | No server component needed; PAT-only arch |
| `onAction` for notification click | OS-native window activation + `setFocus()` | Desktop apps get OS-level behavior for free |

**Deprecated/outdated:**
- Jira Server (Support ended Feb 15, 2024): Still the target environment per project constraints. REST API v2 is the appropriate target — same patterns documented here remain valid for Jira Data Center.

---

## Open Questions

1. **`currentUserDisplayName` for Jira mention matching**
   - What we know: `GET /rest/api/2/myself` returns `displayName` and `emailAddress`
   - What's unclear: Jira mentions use `@displayName` format or `[~username]` — the exact string in `comment.body` varies by Jira version
   - Recommendation: Fetch and store `displayName` + `name` (username) from auth validation; check both `~username` and `@displayName` in body text

2. **GitLab current user ID for self-exclusion**
   - What we know: `validateGitLab` returns `id`, `name`, `username` — stored in auth flow
   - What's unclear: The current `auth.store.ts` does not persist `userId` — only `gitlabConnected` and `gitlabBaseUrl`
   - Recommendation: Extend `useAuthStore` to include `gitlabUserId: number | null` during the Phase 3 engine plan; set it from the existing validation response

3. **`commentedOnDate` availability on target Jira Server version**
   - What we know: `commentedOnDate` is referenced in community posts but not in official Server docs; availability varies by version
   - What's unclear: Whether the target on-premise instance supports this JQL function
   - Recommendation: Use `updatedDate` (documented for Server) as the primary filter; treat `commentedOnDate` as optional enhancement if testing confirms availability

4. **OS notification permission prompt timing on macOS**
   - What we know: macOS requires explicit permission; `requestPermission()` shows system prompt
   - What's unclear: Whether the permission prompt should appear on first launch or only when the user enables OS notifications in Settings
   - Recommendation: Only call `requestPermission()` when the user first enables OS notifications for a source in Settings — not on app start

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `taskflow/vite.config.ts` (vitest inline config implied by scripts) |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose src/services/notifications.test.ts src/stores/notifications.store.test.ts` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | Jira + GitLab items merged and sorted chronologically | unit | `npx vitest run src/services/notifications.test.ts` | Wave 0 |
| NOTF-01 | `NotificationRow` renders source border + icon | unit | `npx vitest run src/routes/notifications/NotificationRow.test.tsx` | Wave 0 |
| NOTF-02 | `refetchInterval` uses `notificationPollIntervalSecs * 1000`, clamped ≥30s | unit | `npx vitest run src/services/notifications.test.ts` | Wave 0 |
| NOTF-03 | `tryDispatchOsNotification` calls `sendNotification` when `isPermissionGranted` true | unit | `npx vitest run src/services/notifications.test.ts` | Wave 0 |
| NOTF-03 | Returns `'denied'` and sets `permissionDenied` flag when permission refused | unit | `npx vitest run src/services/notifications.test.ts` | Wave 0 |
| NOTF-03 | Permission-denied banner renders from `alert.tsx` when `permissionDenied` is true | unit | `npx vitest run src/routes/notifications/NotificationPopover.test.tsx` | Wave 0 |
| NOTF-04 | Badge count matches `items.length - readIds.length` | unit | `npx vitest run src/stores/notifications.store.test.ts` | Wave 0 |
| NOTF-04 | Badge displays "99+" when count > 99 | unit | `npx vitest run src/components/app/TopBar.test.tsx` | Wave 0 |
| NOTF-05 | `markAsRead(id)` adds id to `readIds` | unit | `npx vitest run src/stores/notifications.store.test.ts` | Wave 0 |
| NOTF-06 | `markAllRead()` adds all item IDs to `readIds` | unit | `npx vitest run src/stores/notifications.store.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/services/notifications.test.ts`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps (test files needed before implementation)

- [ ] `taskflow/src/services/notifications.test.ts` — covers NOTF-01, NOTF-02, NOTF-03
- [ ] `taskflow/src/stores/notifications.store.test.ts` — covers NOTF-04, NOTF-05, NOTF-06
- [ ] `taskflow/src/routes/notifications/NotificationRow.test.tsx` — covers NOTF-01 UI
- [ ] `taskflow/src/routes/notifications/NotificationPopover.test.tsx` — covers NOTF-03 banner
- [ ] `taskflow/src/components/app/TopBar.test.tsx` — covers NOTF-04 badge display

---

## Sources

### Primary (HIGH confidence)
- `https://v2.tauri.app/plugin/notification/` — Full install guide, permission flow, sendNotification API, capability permissions list
- `https://v2.tauri.app/reference/javascript/notification/` — TypeScript API: isPermissionGranted, requestPermission, sendNotification, onNotificationReceived, onAction (mobile-only clarification)
- `https://v2.tauri.app/reference/javascript/api/namespacewindow/` — getCurrentWindow, setFocus() method
- `taskflow/src/stores/settings.store.ts` — LazyStore + createJSONStorage + Zustand persist pattern (authoritative for this project)
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — TanStack Query refetchInterval pattern (authoritative for this project)
- `taskflow/src/services/gitlab.ts` — fetchMRDiscussions, PRIVATE-TOKEN header, existing MR endpoint patterns
- `taskflow/src/services/jira.ts` — Bearer token, JQL search pattern, existing endpoints

### Secondary (MEDIUM confidence)
- `https://docs.gitlab.com/api/notes/` — MR notes endpoint confirmed; `created_after`/`updated_after` absence confirmed; sort params confirmed
- `https://docs.gitlab.com/api/discussions/` — MR discussions endpoint confirmed; pagination confirmed
- `https://docs.gitlab.com/api/events/` — `after` date filter confirmed; MR DiscussionNote NOT supported confirmed

### Tertiary (LOW confidence — verify against real instance)
- Community posts on Jira JQL `comment ~ currentUser() AND updatedDate >= "..."` pattern — works but date filtering is on issue level, not comment level; confirmed by multiple community threads but not official docs
- `commentedOnDate` JQL function — referenced in community posts; availability on specific Jira Server versions unconfirmed

---

## Metadata

**Confidence breakdown:**
- Tauri Notification Plugin API: HIGH — verified against official v2 docs
- TanStack Query polling pattern: HIGH — directly observed in existing codebase
- Zustand persist pattern: HIGH — directly observed in settings.store.ts
- GitLab Notes/Discussions API: HIGH — verified against official GitLab docs
- Jira comment delta polling strategy: MEDIUM — no official `since` filter; community-verified workaround with JQL + client-side filtering
- `onAction` desktop limitation: MEDIUM — documented in official plugin reference, confirmed by GitHub issue #2150 in plugins-workspace

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable APIs; Tauri plugin API unlikely to change within 30 days)
