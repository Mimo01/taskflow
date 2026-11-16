# Phase 95: Notifications redesign - Research

**Researched:** 2026-11-10
**Domain:** In-app notification feed UX (React 19 + Tailwind v4 + Zustand + TanStack Virtual, Tauri/WKWebView)
**Confidence:** HIGH on the current-state inventory (read from source), MEDIUM on external best practice (GitHub/Linear docs via web search), design recommendations are judgment calls flagged as open decisions.

All paths below are relative to the inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow/` unless noted.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists. The user chose to skip discuss-phase and deferred specifics to research/discuss ("Notifications already work; redesign them visually and polish the UI/UX"). Nothing is locked. Treat the user's stored preferences (section "Project Constraints") as strong constraints. The open decisions at the end are the items the UI-SPEC step should lock.

### Locked Decisions
None.

### Claude's Discretion
Everything: layout, grouping, triage model, keyboard support, density, badge semantics, empty states.

### Deferred Ideas (OUT OF SCOPE)
None recorded. Proposed out-of-scope list in this research: new notification sources, push/websocket delivery, a Settings redesign, OS-notification content changes (see "Scope fences").

<phase_requirements>
## Phase Requirements

No IDs mapped in ROADMAP (`Requirements: TBD`). Candidate IDs proposed for the planner to adopt (NOTIF-xx; existing store tests already use a legacy `NOTF-0x` prefix, so the new prefix `NOTIF` does not collide):

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | Feed rows are one line per event at every density; no stacked chip/body/parent lines | Memory `feedback_one_row_one_line`; current row is 3-4 lines (`NotificationRow.tsx:222-357`) |
| NOTIF-02 | Events on the same issue/MR are grouped under one entity header (newest first, group sorted by newest event) | Duplicate-per-issue ids (`services/notifications.ts:207,248,316,393`); Standup `IssueActivityGroup` precedent |
| NOTIF-03 | Unread state = leading dot + weight, replacing blue tint + avatar ring; colour reserved for status semantics (failed / approved / due) | Memory `feedback_dashboard_ui_preferences` ("colour = status only") vs 9 rainbow badges (`NotificationRow.tsx:55-83`) |
| NOTIF-04 | Triage model: read/unread toggle, dismiss ("Done"), "Mark all read" scoped to current filter, "Clear read" bulk action | GitHub Done-vs-read, Linear inbox (see Best Practices) |
| NOTIF-05 | Keyboard navigation inside the popover: Up/Down (j/k), Enter open, u toggle read, e dismiss, Esc close | Linear/GitHub shortcuts; current rows only Tab+Enter/Space |
| NOTIF-06 | Header/filter bar redesign: segmented Unread/All + source tabs with neutral counts, matches AIO cycles segmented-filter precedent | Memory `project_aio_cycles_closed_filter` |
| NOTIF-07 | Empty / error / permission states use shared `EmptyState`, `StaleDataBanner`, `Alert`; error shown even when cached items exist | `NotificationPopover.tsx:446-494` (error only shown if list empty) |
| NOTIF-08 | Peek-open row highlight via `useIsPeeked`; row click = open peek + mark read (existing behaviour preserved) | Memory `project_peek_highlight_store` |
| NOTIF-09 | Data hygiene: prune `readIds` to existing items; dismissed due-date reminders do not reappear next poll | Pitfalls 1 and 2 below (real bugs found) |
| NOTIF-10 | Bell badge semantics: count of unread, 99+ cap, pulse only on increase, no pulse while open (preserve) | `TopBar.tsx:50-66,91-101` |
</phase_requirements>

## Summary

Notifications are a client-side delta-poll feed. `useNotificationPolling` (hook, `src/hooks/useNotificationPolling.ts`) runs a TanStack Query every `notificationPollIntervalSecs` (default 60, clamped 30-300) that calls `fetchNewNotifications` (`src/services/notifications.ts:746`) for Jira (4 JQL queries: assignee/watch updates, mentions, all-comments, due dates) and GitLab (per-MR notes, approvals, pipelines). Results are appended to a persisted Zustand store (`src/stores/notifications.store.ts`, Tauri store file `notifications.json`), capped at 200, with `readIds: string[]` as the read model and cached unread counters. The UI is a single surface: a bell in `TopBar` opening a 28rem Popover containing `NotificationPopover` (header, source tabs, unread toggle, virtualized time-grouped list of `NotificationRow`). There is no notifications page and no in-app toast. OS notifications are dispatched from the polling hook.

The current visual design breaks several of the user's stored design rules: rows are 3-4 lines tall (violates "one row = one line at every density"), nine rainbow type badges plus orange/purple source borders and blue unread tint (violates "colour = status only"), and the popover carries bespoke tab/badge styling instead of shared patterns. Functionally there are also gaps: no entity grouping (one issue can produce many near-identical rows, because `issue-update` ids embed the `updated` timestamp), no keyboard navigation, no bulk "clear", errors invisible once any cached item exists, and two real data bugs (unbounded `readIds`, dismissed due-date reminders resurrect on the next poll).

**Primary recommendation:** Keep the popover as the single surface (no new page). Rebuild the row as one line per event, group events by entity (issue key / MR) with a one-line group header following the Standup `IssueActivityGroup` pattern, use a leading unread dot with neutral type glyphs (colour only for failed/approved/due), add a scoped keyboard layer and a "Done" (dismiss) + "Clear read" triage model, and fix the two data-hygiene bugs in the same phase. Do not add dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetching Jira/GitLab events, cursors, dedupe | Services + polling hook (client; Tauri HTTP) | -- | No backend; `apiFetch` through `@tauri-apps/plugin-http` (`services/notifications.ts:18`) |
| Read/unread, dismiss, persistence, counts | Zustand store (Tauri store file) | -- | Source of truth; counters cached in store (PERF-02) |
| Entity grouping / time bucketing / filtering | Pure view-model helpers (`lib/` or route-local, unit-testable) | Popover component | Keep logic out of JSX so it is testable without the compiler/virtualizer |
| Rendering (rows, groups, header, empty/error) | React components in `routes/notifications/` | Shared `components/ui` primitives | Follow shipped primitives |
| Navigation on click (peek vs full page vs MR route) | `main.tsx` handlers passed through `TopBar` props | -- | Existing `onOpenIssue` / `onIssueClick` / `onMRClick` wiring; TopBar deliberately exposes no peek callback (`TopBar.tsx:22-24`) -- verify before changing |
| OS notification dispatch | Polling hook + `tryDispatchOsNotification` | -- | Unchanged by this phase |
| Settings (per-type toggles, interval) | `routes/settings/NotificationSettingsSection.tsx` | settings store | Out of scope except a link from empty/permission states |

## Current Implementation Inventory

### Data flow
```
Settings store (interval, per-type toggles, OS toggles) --+
Auth store (urls, user ids/names)                          |
                                                           v
 useNotificationPolling (hooks/useNotificationPolling.ts:23)  -- useQuery key ['notifications', jiraBaseUrl, gitlabBaseUrl, activeJiraProject], refetchInterval, background=true (:119-236)
   |  reads PATs via readSecret (:122-125); MR list from cache ['gitlab-mrs', ...] or fetches assigned/authored/reviewer MRs (:127-163)
   v
 fetchNewNotifications (services/notifications.ts:746)  Promise.allSettled(jira, gitlab) -> dedupe by id -> sort newest-first (:787-806)
   |  Jira: 4 sub-queries, maxResults=20 each (:141,271,345,420); GitLab: notes/approvals/pipelines per MR in batches (:509-680)
   v
 filter by per-type toggle (:177-181) -> prependItems (store :117, cap 200) -> advance per-source cursors (:185-196, :207)
   |  -> OS notification per genuinely new item if source toggle on (:209-224) -> permissionDenied / notificationSendError flags
   v
 useNotificationsStore (persist 'notifications-store', file notifications.json; persists items, readIds, 2 cursors only: :186-195)
   v
 TopBar bell badge (useUnreadCount) + NotificationPopover (tabs, unreadOnly, virtualized list) -> NotificationRow
```

### Files and line anchors
| Concern | Location |
|---------|----------|
| Store, types, counters, persist/merge | `src/stores/notifications.store.ts` (types :17-44, counters :82-95, actions :115-184, persist :186-216, selectors :227-231) |
| Item type duplicated in service | `src/services/notifications.ts:42-60` (duplicate of the store's `NotificationItem`; keep in sync or dedupe) |
| Polling hook | `src/hooks/useNotificationPolling.ts` (mounted at `src/main.tsx:654`) |
| Bell, badge, pulse, popover shell (`w-[28rem]`, `p-0`) | `src/components/app/TopBar.tsx:50-66,86-111`; open state lifted to `main.tsx:144`; opened by menu event `main.tsx:339`, palette `main.tsx:553` |
| Feed UI | `src/routes/notifications/NotificationPopover.tsx` (508 lines): tabs :62-66,412-444; unread toggle :381-399; time groups :69-106; virtualizer :109-219 (est. 64px, overscan 5, `max-h-[520px]`, stable `getItemKey` :138); click handlers :275-328; empty states :333-372; permission / send-error banners :446-484; fetch error only when list empty :487-492 |
| Row UI | `src/routes/notifications/NotificationRow.tsx` (361 lines): `div[role=button]` + inner key `<button>` (:193-208, :284-296), source border colour :187, unread tint + avatar ring :205-215, type badge map :55-83, entity state badge :85-89, body parser :99-131, hover action tray (read/unread, open external via `LinkContextMenu`, dismiss) :245-279, parent chip :347-357, `relTime` :34-44 |
| Palette hooks | `CommandPalette.tsx:60,323,334,368` ("Mark all notifications read", "open-notifications" action) |
| Settings | `routes/settings/NotificationSettingsSection.tsx` (poll interval, 9 per-type toggles, 2 OS toggles; native checkboxes), `NotificationsSection.tsx` wrapper; settings fields in `stores/settings.store.ts:25-27,65-73,182-217` |
| Bell animation | `src/index.css:65-68` (`animate-bell-ring`) |

### Event types and ids (grouping keys)
`comment-mention`, `issue-update`, `mr-note`, `gitlab-mention`, `jira-comment`, `mr-approval`, `pipeline-failure`, `issue-assignment`, `due-date-reminder`. Ids: `jira-assign-{key}-{created}` (:207), `jira-issue-{key}-{updated}` (:248), `jira-comment-{id}` (:316), `jira-allcomment-{id}` (:393), `jira-duedate-{key}` (:457), `gitlab-system-{noteId}` (:571), `gitlab-note-{noteId}` (:590), `gitlab-approval-{mrIid}-{userId}` (:622), `gitlab-pipeline-{pipelineId}` (:653).

There is no structured entity key on the item. The Jira key is recovered by regex from `entityTitle` ("PROJ-1: title") in two places (`NotificationPopover.tsx:31-47`, `NotificationRow.tsx:46-51`). GitLab entities have optional `mrProjectId` + `mrIid`.

### Existing tests (vitest, jsdom, no React Compiler)
- `src/routes/notifications/NotificationRow.test.tsx` (22 tests): border colour per source, type badges, key split, state badge, body chips, unread tint, parent chip, action tray, LinkContextMenu. **Many assert implementation classes/testids (`notification-row`, `type-badge`, `action-tray`, border classes, blue tint) -- a redesign will deliberately break these; rewrite, do not preserve.**
- `src/routes/notifications/NotificationPopover.test.tsx` (9 tests): permission banner, row click marks read/navigates/closes, tabs, empty states, "All caught up", time-group headers.
- `src/stores/notifications.store.test.ts` (~13 tests): prepend/dedupe/cap 200, markAsRead idempotent, markAllRead, counters, persistence shape.
- `src/services/notifications.test.ts`, `src/components/app/TopBar.test.tsx` (badge 3 / 99+ / hidden), `CommandPalette.test.tsx`.
- There is no keyboard-navigation, grouping, or hook-level (polling) test.

## Design Language the Redesign Must Follow

### Shared primitives to reuse (all exist)
| Primitive | Path | Use here |
|-----------|------|----------|
| `EmptyState` (`compact`, `action`) | `components/ui/empty-state.tsx` | All empty states; `action` slot for "Open settings" |
| `ErrorState` | `components/ui/error-state.tsx` | Total failure with no cache (already used) |
| `StaleDataBanner` ("Couldn't refresh - showing cached data" + Retry + dismiss) | `components/ui/stale-data-banner.tsx` | **Fetch error while items exist** (currently invisible) |
| `Alert` | `components/ui/alert.tsx` | Permission / send-error banners (keep) |
| `CachedAvatar` | `components/ui/cached-avatar.tsx` | Author avatar |
| `LinkContextMenu` | `components/ui/link-context-menu.tsx` | Right-click on open-external |
| `Popover` (Base UI) | `components/ui/popover.tsx` | Shell (keep) |
| `Tabs` / segmented patterns, `Switch` (note AIO cycles rejected Switch) | `components/ui/tabs.tsx` | Filter bar |
| `TooltipBody`/`TooltipRow` | `components/ui/tooltip-body.tsx` | Full body / absolute timestamp on hover |
| `useIsPeeked` + `PEEKED_ROW_CLASS` | `stores/peek.store.ts`, `lib/peek-highlight.ts` | Highlight the row/group whose issue is open in peek |
| `statusPillClass`, status colours | `lib/statusStyles.ts:92` | Only if a status pill is shown for entity state |
| Density variants `density-compact:` / `density-comfortable:` | `index.css:10-11` | Padding + font only |
| Standup `IssueActivityGroup` | `routes/standup-notes/IssueActivityGroup.tsx` | Precedent for entity-group header + child lines, overlay-button pattern |
| `PageHeader` | `components/ui/page-header.tsx` | **Not applicable** (popover has no page header). Relevant only if a page is added (Decision D1) |

### User preferences that bind this phase (from memory index; treat as locked)
1. **One row = one line at every density** (`feedback_one_row_one_line`): drop data, never stack. Density changes padding/font only. Directly conflicts with the current 3-4 line row.
2. **Colour = status only; little text, detail on hover; no legends; everything hoverable** (`feedback_dashboard_ui_preferences`).
3. **No bespoke placeholder graphics; use compact `EmptyState` with truthful text, no jargon** (`feedback_empty_graph_slot_use_emptystate`).
4. **Follow shipped pages; lead with "mirror X"** (`feedback_design_follow_shipped_pages`); **match the neighbouring control row** (`feedback_match_local_button_row`).
5. **Narrow layouts**: avatar never drops; compact first then drop; tight side panels (`feedback_narrow_layout_preferences`). Popover is fixed 28rem; if width changes, check it still fits the window.
6. **Detail pages: no card panels** (`feedback_detail_pages_no_card_panels`); do not wrap groups in `rounded-xl ring-1` cards. Use `border-b`/`divide-y` and `rounded px-2 py-1.5 hover:bg-accent` rows.
7. **Hover affordances must not shift layout** (`project_hover_affordance_no_layout_shift`): the current action tray overlays the timestamp (absolute, `NotificationRow.tsx:246`) which is fine; do not add flow-width hover icons.
8. **Overlay-button pattern for whole-row click + inner key button** (`project_overlay_button_nested_interactive`): the current `div[role=button]` + nested `<button>` carries a `biome-ignore` (`NotificationRow.tsx:193`) and is an ARIA nested-interactive violation. Replace with an `absolute inset-0` sibling overlay button.
9. **Screenshot before restyling after any rejection** (`feedback_screenshot_before_restyling`): plan a throwaway vite preview page with `@source '../src'` for visual verification; the user rejects blind restyles.
10. **Italic + `truncate` clips glyph** -> `pr-0.5` if italic is used; **`not-sr-only` undoes truncate**; **sr-only inside non-`relative` scroller stretches document** -> keep `relative` on the popover scroller if sr-only labels are added (`project_sr_only_scroller_needs_relative`).
11. **Pre-commit runs full vitest + biome + tsc** (`project_precommit_blocks_red_commits`): combine RED/GREEN in one commit per tdd task. Biome baseline drifts: gate on "no NEW files flagged".
12. **Scoped edits**: no bulk find-replace of identifiers, no `biome --write` over all of `src` (`feedback_scoped_edits_and_ui_judging`).

## Notification UX Best Practices (what fits taskflow, what to avoid)

Sources: GitHub Docs (inbox, Done vs read, grouping, shortcuts), Linear Docs (Inbox). [CITED: docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox] [CITED: linear.app/docs/inbox]. Slack/Jira specifics were not verified in this session; treat as general knowledge [ASSUMED].

| Topic | Industry pattern | Recommendation for taskflow |
|-------|-----------------|------------------------------|
| Read vs Done | GitHub separates "read" from "Done" (Done removes from inbox, kept 3 months; `is:done`). Linear has read/unread (U), archive/delete, snooze (H) | Two-state model plus removal: **read/unread** (toggle) and **Done = dismiss** (removes). Keep current store semantics (`removeItem`); label the action "Done" (check icon) and make read-toggle a dot. Skip snooze (needs timers + persistence; defer). |
| Grouping | GitHub: group by repository or date. Linear: flat list per issue (one inbox entry per issue, updated in place) | **Group by entity** (issue key / MR) inside time buckets. Collapses the duplicate `jira-issue-{key}-{updated}` spam. Group row shows latest event + "+N" count; expand to show events. Mirrors Linear's one-entry-per-issue and the Standup group. |
| Unread indicator | Leading dot, bold title (GitHub, Linear) | Leading dot + font-weight; drop blue tint and avatar ring. Peeked highlight (primary tint) then never competes with an unread tint. |
| Bulk actions | GitHub: select + mark done; Linear: Alt+U all read | Keep "Mark all read" scoped to the active filter (existing `markAllReadBySource` logic); add "Clear read" (dismiss all read). No multi-select checkboxes (adds density cost). Confirm nothing: both are cheap to recover from since items re-fetch only if cursor allows (see Pitfall 2). |
| Keyboard | GitHub: E done, Shift+U unread, Shift+I read, J/K nav. Linear: J/K, U, H, D, auto-advance after action | Popover-scoped: Up/Down or j/k move focus, Enter open, `u` toggle read, `e` (or Delete) dismiss and advance to next row, Esc closes (Base UI already). Do not register global hotkeys for these. |
| Density | Linear/GitHub inbox rows are single-line with metadata right-aligned | One line: `[dot] [type glyph] [avatar 20] key  title/snippet  ...  time`. Matches user's one-row-one-line rule. Body preview is single-line `truncate` or tooltip only. |
| Inline actions | Hover-revealed read / done / open | Keep hover tray, absolutely positioned over the timestamp (no layout shift), also visible on keyboard focus (`group-focus-within:`). Open-external stays with `LinkContextMenu`. |
| Empty states | Positive "inbox zero" wording | Keep three truthful variants (no notifications yet / all caught up / filtered-empty), via compact `EmptyState`; add "Open notification settings" action when the reason may be disabled types. |
| Badge semantics | Count of unread, capped, clears on read | Keep unread count with 99+ cap, and keep pulse-on-increase. Tab counts neutral (`bg-muted`) not rainbow. |
| Avoid | Auto-mark-read on popover open (hides new items before seen); infinite red numerals per tab; toasts on every poll; rainbow type badges; multi-line cards; modal confirms for dismiss | Do none of these. No toast library exists in the repo (`grep` found only `ConnectionsSection` mentioning toast-like helpers) -- do not add one for undo. |

## Standard Stack

No new libraries. Everything required already ships. [VERIFIED: package.json grep]

| Library | Version (package.json) | Purpose |
|---------|-----------------------|---------|
| react / react-compiler (build only) | ^19.1.0 | UI |
| zustand (+persist) | ^5.0.11 | Store |
| @tanstack/react-query | ^5.90.21 | Polling |
| @tanstack/react-virtual | ^3.13.23 | List virtualization (already used) |
| @base-ui/react | ^1.2.0 | Popover/Tabs primitives |
| react-hotkeys-hook | ^5.2.4 | Available; prefer plain `onKeyDown` on the list container for popover-scoped keys |
| lucide-react | existing | Type glyphs |
| vitest ^4.0.18, @testing-library | existing | Tests |

## Package Legitimacy Audit

No external packages are installed in this phase (recommendation is "no new dependencies"). Audit not required. If the planner decides to add a toast/undo library, that is a deviation requiring a `checkpoint:human-verify` and a slopcheck run.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Recommended structure
```
src/routes/notifications/
├── NotificationPopover.tsx      # shell: header, filter bar, banners, list host (slimmer)
├── NotificationList.tsx         # virtualized list of entries (header | group | event), keyboard layer
├── NotificationGroupHeader.tsx  # entity group one-liner (overlay button pattern)
├── NotificationRow.tsx          # single-line event row (rewritten)
├── notification-view.ts         # pure: getEntityKey, groupByEntity, bucketByTime, applyFilters, buildEntries
├── notification-view.test.ts
└── (existing tests rewritten)
```

### Pattern 1: Pure view-model, thin components
Derive `entries: Entry[]` (`time-header | group | event`) in a pure function from `(items, readSet, filter, expandedGroups)`. Component renders entries; virtualizer keys by stable entry id (`header:today`, `group:{entityKey}`, `event:{id}`) -- extend the existing `getItemKey` (`NotificationPopover.tsx:138-141`). Unit-test the pure function without jsdom/virtualizer/compiler concerns.

### Pattern 2: Entity key helper
Add one `getEntityKey(item)` shared by popover + row (removes the two duplicated regex sites): Jira -> key from `entityTitle` prefix or `/browse/KEY` url; GitLab -> `${mrProjectId}/${mrIid}` when both present, else fall back to `item.url`, else `item.id` (ungrouped). **Derive at read time; do not add a persisted field** (avoids a store migration for the 200 persisted items). If a field is preferred later, `merge` in the persist config (`store :198-215`) is where migration goes.

### Pattern 3: Overlay button for row click
Row container `div.relative`; `<button class="absolute inset-0">` is the primary action (mark read + peek/navigate); key `<button class="relative z-10">` is a sibling; icon/summary `pointer-events-none relative`; action tray buttons `relative z-10`. Reference: `routes/standup-notes/IssueActivityGroup.tsx` (`ActivityGroupHeader`) [CITED: memory project_overlay_button_nested_interactive].

### Pattern 4: Keyboard layer (popover-scoped)
Roving focus over interactive overlay buttons; `onKeyDown` on the list scroller handles ArrowUp/Down/j/k (move focus; call `virtualizer.scrollToIndex` for off-screen entries because only mounted rows exist), `u`, `e`. After dismiss, focus the next entry (Linear auto-advance). Ignore keys when event target is an input/textarea.

### Pattern 5: Peeked highlight
Group headers and event rows for the open issue use `useIsPeeked(issueKey)` and put `PEEKED_ROW_CLASS` last in `cn()`. Hook must be called before early returns; inside `.map`, compare against `usePeekStore` key instead [CITED: memory project_peek_highlight_store]. Note: row click currently calls `onOpenIssue` (peek) when provided; `TopBar` passes only `onIssueClick`/`onMRClick` (`TopBar.tsx:104-108`), so the popover today navigates full page, never peeks, contrary to the comments in the popover. Verify intended behaviour before wiring (see Open Questions).

### Anti-patterns to avoid
- Stacked body/parent lines (violates one-row-one-line). Put body in a tooltip (`TooltipBody`) and parent summary in the group header.
- Per-type rainbow colours; source-coloured left border.
- Subscribing to the whole store with `useNotificationsStore()` (`NotificationPopover.tsx:229`): re-renders on every poll/flag change. Use targeted selectors (the hook's own comment at `useNotificationPolling.ts:24-26` warns about this).
- `getState()` in render, or deriving render values from module-level mutable state (React Compiler staleness) [CITED: memory project_react_compiler_module_read].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Empty/error/stale UI | Custom placeholders | `EmptyState` compact, `ErrorState`, `StaleDataBanner`, `Alert` | User rejected bespoke empty graphics |
| Avatars | `<img>` + initials | `CachedAvatar` | Caching, fallback |
| Peek highlight | Local selected state | `useIsPeeked` + `PEEKED_ROW_CLASS` | Single mechanism app-wide |
| Hover details | Custom popover | `TooltipBody` / `TooltipRow` | Consistent <=4 row tooltips |
| Virtualization | Manual windowing | Existing `useVirtualizer` with stable `getItemKey` | Already solved height-cache bug (comment `:133-137`) |
| Relative time | New formatter | Extend `relTime` (`NotificationRow.tsx:34`) / reuse existing app date helper if one exists (grep `lib/` before writing) | Consistency; add absolute time in `title`/tooltip |
| Toast/undo | New toast lib | Inline immediate action, no undo | No toast infra; avoid dependency |

## Common Pitfalls

### Pitfall 1: `readIds` grows without bound (real bug)
`prependItems` caps `items` at 200 (`store :122`) but never prunes `readIds`; `markAsRead` appends (`:126-130`) and `readIds` is persisted whole (`:191`). Over months it grows unbounded and `computeUnreadCounts` builds a `Set` of it on every mutation. **Fix:** in `prependItems`, `readIds = readIds.filter(id => itemIdSet.has(id))` after capping. Safe because evicted items cannot return unless the cursor regresses. Test: add >200 items, assert `readIds.length <= 200`.
**Warning signs:** `notifications.json` size creeping up.

### Pitfall 2: Dismissed due-date reminders resurrect every poll (real bug)
`jira-duedate-{key}` has a stable id and `createdAt = new Date()` (`services/notifications.ts:457-463`), and Query D ignores the cursor ("time-based ... always kept"). `dismiss` = `removeItem` deletes the id from `items`, so the next poll's `prependItems` dedupe (`store :119`) no longer matches and the item returns at the top of "Today" -- and `existingIds` (hook `:204`) no longer contains it, so an **OS notification fires again every poll** until the due date passes. Also, a *read* due-date item stays deduped only while in `items`. **Fix options:** (a) include the due date in the id (`jira-duedate-{key}-{duedate}`) and keep a persisted `dismissedIds` tombstone list (pruned by age/size); or (b) make Done on a due-date item set read + hide flag rather than delete. Recommend (a)+tombstones for all types (also protects against cursor regression re-fetching a dismissed comment). Needs store test + persist migration (`merge` guard for missing field).

### Pitfall 3: Fetch error is invisible once any cached item exists
`NotificationPopover.tsx:487` shows `ErrorState` only when `fetchError && visibleItems.length === 0`. With cached items, a broken PAT or network failure is silent. **Fix:** `StaleDataBanner` above the list when `fetchError` and items exist (wire `retryFetch`; dismiss local state).

### Pitfall 4: Item type is declared twice
`NotificationItem` exists in both `stores/notifications.store.ts:28` and `services/notifications.ts:42`. Adding a field to one silently diverges. Re-export from one.

### Pitfall 5: Virtualizer height cache with expandable groups
Expanding a group changes entry count and heights. Keep stable `getItemKey` per entry id (existing fix) and ensure `measureElement` stays on the wrapper. Collapsing a group while its child is focused must move focus to the header. The non-virtual fallback branch (`:157-215`, used when `virtualItems.length === 0`, e.g. jsdom) duplicates markup -- extract a shared `renderEntry` so both paths stay in sync; tests in jsdom exercise the fallback, production exercises the virtual path.

### Pitfall 6: Query-key churn and polling
`queryKey` includes `activeJiraProject` (`hook :120`); switching project refetches from the stale cursor but does not clear the project's items (items are cross-project). Do not add store-derived values (e.g. `items.length`) to the key (`storeItemsRef` pattern exists to avoid this). Redesign must not change the polling hook's contract; any new store fields are additive.

### Pitfall 7: Optimistic/stateful cell unmount
Do not choose which component renders based on `isUnread` if that component holds local state (hover tray, focus). Mark-read flips `isUnread` immediately (store write). Render the same stateful row for read and unread and vary only classes [CITED: memory project_optimistic_mark_unmount]. Test with `rerender`, not static props.

### Pitfall 8: WKWebView
- Hover-only actions need a `focus-within` equivalent for keyboard.
- `backdrop-blur-sm` on sticky time headers over virtualized absolutely-positioned rows is already used (`:174`); sticky does not work inside the virtual branch (headers are absolutely positioned), so "sticky header" is effectively not sticky there. Do not promise sticky time headers unless implemented with a separate overlay.
- Do not rely on `::highlight`, `user-select:none` tricks or blob URLs here (none needed).
- Popover renders in a portal (Base UI) so the `main isolate` overlay issue does not apply; if a full-page/overlay variant is built it must portal to body.
- Truncation: `truncate` + flex child needs `min-w-0`; use explicit-px sizing for narrow leading cells (avatar) to avoid 0-width collapse (memory project_virtualized_table_zero_width_col).

### Pitfall 9: React Compiler vs vitest
Vitest runs without the compiler; the app runs with it. Notification code calls `Date.now()` in `relTime` and `new Date()` in `getTimeGroup` during render: the compiler may memoize these on unchanged inputs so relative times and Today/Yesterday buckets go stale in the real app while tests pass. Mitigate: derive "now" from a ticking source (e.g. a `useNow(60_000)` hook returning state) and pass it into pure helpers as an argument. Validate by compiling the changed files if a staleness symptom appears.

### Pitfall 10: Test brittleness
Existing row tests assert classes/testids that will change. Rewrite them around behaviour (roles, text, aria) and keep stable `data-testid`s only where the plan names them. The pre-commit gate runs the full suite, so land component rewrite + test rewrite in the same commit.

## Code Examples

### Pure grouping helper (shape, to adapt)
```ts
// notification-view.ts -- pure, no React. [ASSUMED design; adapt in plan]
export function getEntityKey(item: NotificationItem): string {
  if (item.source === 'jira') {
    const m = /^([A-Z][A-Z0-9]*-\d+):/.exec(item.entityTitle) ?? /\/browse\/([A-Z][A-Z0-9]*-\d+)/.exec(item.url ?? '');
    if (m) return `jira:${m[1]}`;
  }
  if (item.mrProjectId && item.mrIid) return `gitlab:${item.mrProjectId}/${item.mrIid}`;
  return `item:${item.id}`; // ungrouped
}
```
Note the existing regex `^[A-Z]+-\d+$` rejects keys with digits in the project prefix (e.g. `AB2-5`); the replacement above accepts them. Verify against real project keys before adopting.

### Store pruning (Pitfall 1)
```ts
// in prependItems after slice(0, 200)
const idSet = new Set(items.map((i) => i.id));
const readIds = s.readIds.filter((id) => idSet.has(id));
return { items, readIds, ...computeUnreadCounts(items, readIds) };
```

### Keyboard layer skeleton
```tsx
// on the list scroller
onKeyDown={(e) => {
  if ((e.target as HTMLElement).closest('input,textarea')) return;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); focusEntry(idx + 1); }
  if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); focusEntry(idx - 1); }
  if (e.key === 'u') toggleRead(current);
  if (e.key === 'e') { dismiss(current); focusEntry(idx); } // advance
}}
// focusEntry: virtualizer.scrollToIndex(i); then requestAnimationFrame -> querySelector(`[data-entry-index="${i}"] button`)?.focus()
```

## Runtime State Inventory

Not a rename/migration phase, but persisted data is touched if Pitfall 2 (tombstones) or schema changes are adopted.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Tauri store file `notifications.json` key `notifications-store` (items<=200, readIds, 2 cursors) | Additive fields only; handle missing in `merge` (`store :198-215`); one-time prune of oversized `readIds` happens naturally on next `prependItems` |
| Live service config | None -- verified: no external service holds notification state | None |
| OS-registered state | macOS notification permission for the app (unchanged) | None |
| Secrets/env vars | `jira-pat`, `gitlab-pat` via stronghold, read per poll | None |
| Build artifacts | None | None |

## Environment Availability

Code/config-only phase; no new external tools. Existing toolchain: node/npm, vitest, biome, tsc (all used by the pre-commit hook). A Chromium for screenshot previews is cached per memory notes (`feedback_context_parent_rows`); confirm at execution time. Step skipped otherwise.

## State of the Art

| Old (current) | Current practice | Impact |
|---------------|------------------|--------|
| Per-event cards with chips | One-line rows grouped per entity (Linear/GitHub) | Higher density, scan rhythm; fits user rule |
| Colour-coded type badges | Neutral glyph + semantic colour only for state | Matches "colour = status only" |
| Mark read only | Read + Done/archive (+ snooze in Linear) | Triage; adopt Done, defer snooze |
| Mouse-only | Keyboard triage (J/K/E/U) | NOTIF-05 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | User wants the orange/purple source colour dropped in favour of a neutral glyph | Best Practices / Design | They may value source colour as a quick cue; decision D3 |
| A2 | Popover (not a page) remains the right surface | Summary | A full Inbox page would add routing/PageHeader scope; decision D1 |
| A3 | Slack/Jira-inbox specifics (not verified this session) | Best Practices | Low; only GitHub/Linear are cited |
| A4 | Dismissing should remain permanent delete (no archive view) | Triage | User may want a "Done" history; decision D4 |
| A5 | Jira project keys may contain digits (regex fix) | Code Examples | Wrong regex would split groups; verify against real keys |
| A6 | React Compiler memoizes `Date.now()`/`new Date()` render reads (Pitfall 9) | Pitfalls | Unverified for these specific files; verify by compiling if stale times appear |
| A7 | Row click should open peek when available (current popover comments suggest so; TopBar does not pass `onOpenIssue`) | Pattern 5 | Behaviour may be intentionally full-page; check main.tsx wiring |

## Open Questions (RESOLVED)

All resolved in 95-CONTEXT.md (discuss-phase); defaults below were adopted except D9, corrected by D-13.

1. **D1 Surface: popover only vs add an Inbox page.** Default: **popover only** (no new route). Scope and consistency win; revisit if the list needs more width. If a page is chosen, use `PageHeader` (text-2xl, no icon) and the AIO-cycles segmented filter. **RESOLVED:** D-01.
2. **D2 Row anatomy.** Default: single line `[dot][type glyph][avatar 20][key][title ... ][time]`; body preview in a hover `TooltipBody`; entity-state (Open/Merged/Closed) as a tiny status pill only on group headers; parent story summary dropped from rows (or shown in the group tooltip). Alternative: second muted line for body only (violates NOTIF-01; not recommended). **RESOLVED:** D-02, D-03.
3. **D3 Colour.** Default: neutral type glyphs; semantic colour only for pipeline-failure (red), approval (green), due-date (amber); source shown as small Jira/GitLab glyph (no coloured left border); tab counts neutral. **RESOLVED:** D-04.
4. **D4 Triage vocabulary.** Default: keep read toggle + dismiss, relabel dismiss "Done" (check icon / tooltip), add "Clear read"; no snooze, no archive view, no undo. **RESOLVED:** D-08.
5. **D5 Grouping scope.** Default: time buckets (Today / Yesterday / This week / Older -- replaces "Earlier") containing entity groups; group placed by newest event; groups with one event render as a plain row (no header); groups auto-expanded when they contain unread, collapsed otherwise. Alternative: entity groups only, no time buckets. **RESOLVED:** D-06 (+ D-09 group triage).
6. **D6 Filter bar.** Default: segmented `Unread | All` (as AIO cycles) replacing the toggle button, source tabs kept but counts neutral; header actions "Mark all read" (scoped) and overflow for "Clear read". Keep the header minimal. **RESOLVED:** D-12.
7. **D7 Keyboard.** Default: j/k + arrows, Enter, `u`, `e`; documented in the existing `KeyboardShortcutsPanel` only if those panel entries are registry-driven (check `lib/shortcuts.ts`); otherwise tooltips. **RESOLVED:** D-14 (tooltips only — lib/shortcuts.ts is a global-hotkey registry).
8. **D8 Dismissal persistence (Pitfall 2).** Default: persisted `dismissedIds` tombstones capped (e.g. 500) + due-date id includes due date. **RESOLVED:** D-10, D-11.
9. **D9 Click target.** Confirm whether notification clicks should peek (via `onOpenIssue`) or navigate full-page (current effective behaviour). Default: preserve current effective behaviour (full page) unless the user says otherwise. **RESOLVED:** D-13 — full-page navigation, no peek (corrects NOTIF-08).
10. **D10 Dock/OS badge, snooze, per-entity mute, notification page, new sources.** Default: out of scope. **RESOLVED:** out of scope (CONTEXT deferred).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 + @testing-library/react (jsdom), no React Compiler in tests |
| Config file | `vitest.config.ts` (inner app dir) |
| Quick run command | `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/notifications src/stores/notifications.store.test.ts src/components/app/TopBar.test.tsx` |
| Full suite command | `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run && npx tsc --noEmit && npx biome lint ./src` |

Run all commands from the inner app dir (repo root is the outer dir). Pre-commit runs the full suite, so a RED-only commit is blocked.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | Row renders exactly one text line: no body/parent block elements; same structure at compact/default/comfortable | component | `npx vitest run src/routes/notifications/NotificationRow.test.tsx` | rewrite (exists) |
| NOTIF-02 | `getEntityKey`, `groupByEntity`, `bucketByTime` (incl. Today/Yesterday boundary with injected `now`), group ordered by newest event, single-event group is plain row | unit | `npx vitest run src/routes/notifications/notification-view.test.ts` | ❌ Wave 0 |
| NOTIF-03 | Unread shows dot + weight, read does not; semantic colour classes only on failed/approved/due types | component | `...NotificationRow.test.tsx` | rewrite |
| NOTIF-04 | markAllRead scoped to active tab/filter; "Clear read" removes only read items and their ids; dismiss removes item | store + component | `npx vitest run src/stores/notifications.store.test.ts src/routes/notifications/NotificationPopover.test.tsx` | extend |
| NOTIF-05 | ArrowDown/Up/j/k move focus, Enter activates, `u` toggles read, `e` dismisses and focuses next; keys ignored in inputs | component (userEvent) | `...NotificationPopover.test.tsx` | ❌ Wave 0 (add cases) |
| NOTIF-06 | Unread/All segmented filter + source tabs filter correctly; counts match store | component | `...NotificationPopover.test.tsx` | extend |
| NOTIF-07 | Fetch error + cached items shows StaleDataBanner with Retry calling `retryFetch`; error + empty shows ErrorState; empty variants text | component | `...NotificationPopover.test.tsx` | extend |
| NOTIF-08 | Row/group for peeked issue has `data-peeked`; row click marks read and calls open handler | component | `...NotificationPopover.test.tsx` | extend |
| NOTIF-09 | `prependItems` prunes `readIds` to existing items (>200 case); dismissed due-date id does not return after re-prepend of same fetch result; persisted merge tolerates missing `dismissedIds` | store | `npx vitest run src/stores/notifications.store.test.ts` | extend |
| NOTIF-10 | Badge 3 / 99+ / hidden (existing); pulse not asserted | component | `npx vitest run src/components/app/TopBar.test.tsx` | exists |

Additional regression: stateful-row test using `rerender` flipping `isUnread` must not remount the row or lose focus (Pitfall 7); fail-first proof on any bug-fix test (temp-copy swap, not `git stash`).

### Sampling Rate
- **Per task commit:** quick run command above (plus `npx biome lint` on touched files only).
- **Per wave merge:** full suite + `npx tsc --noEmit`.
- **Phase gate:** full suite green; plus manual visual check (below).

### Manual-only verification (justified: layout/WKWebView cannot be asserted in jsdom)
Screenshot via throwaway vite preview page (with `@source '../src'`) at compact/default/comfortable density and popover widths; verify one-line truncation, no hover layout shift, avatar never drops, dark mode. Then a Tauri smoke: bell opens, keyboard nav works, OS notification still fires.

### Wave 0 Gaps
- [ ] `src/routes/notifications/notification-view.test.ts` -- NOTIF-02, grouping/bucketing with injected `now`
- [ ] Keyboard test cases in `NotificationPopover.test.tsx` (NOTIF-05); virtual path is not exercised in jsdom (fallback branch renders), so test the pure entry builder plus fallback rendering and rely on manual check for virtualized focus/scroll
- [ ] Rewrite `NotificationRow.test.tsx` expectations (class/testid assertions) -- NOTIF-01/03
- No framework install needed.

## Security Domain

`security_enforcement` not disabled in `.planning/config.json` (key absent -> enabled). Phase is UI-only over existing data.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Tokens already in stronghold; unchanged |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | Notification text originates from Jira/GitLab (user-controlled): render as text only (React escaping), never `dangerouslySetInnerHTML`; open URLs only via `openExternal`/`LinkContextMenu`; keep `item.url` http(s) only |
| V6 Cryptography | no | -- |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via comment body/entity title in tooltip or markup | Tampering | Plain-text rendering; `TooltipBody` text only; no HTML injection |
| Malicious `url` (javascript:, file:) passed to openExternal | Spoofing/EoP | Validate scheme http/https before `openExternal` (verify existing helper does; add if not) |
| PII/customer data in fixtures | Info disclosure | Placeholders only in tests and `.planning` (memory `feedback_no_customer_data_in_repo`) |

## Scope fences (proposed)
In: popover UI (shell, list, group, row, header), view-model helpers, store hygiene (prune, tombstones, clear-read), error/stale banner, keyboard, tests. Out: polling/fetch logic and sources, OS notification content, Settings page redesign (only an optional link), snooze, new route, new dependencies, `jira.ts` changes.

## Sources

### Primary (HIGH)
- Codebase files listed in "Current Implementation Inventory" (read in full this session).
- Memory index and feedback/project notes under `/Users/mimo/.claude/projects/-Users-mimo-Documents-Projects-taskflow/memory/` (design preferences, pitfalls).

### Secondary (MEDIUM)
- GitHub Docs, "Managing notifications from your inbox" -- https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox (Done vs read, grouping by repo/date, 3-month Done retention)
- GitHub Docs, "Keyboard shortcuts" -- https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts (E done, Shift+U/I)
- Linear Docs, "Inbox" -- https://linear.app/docs/inbox (J/K, U, Option+U, H snooze, auto-advance)

### Tertiary (LOW)
- Slack / Jira inbox patterns: not verified this session; general knowledge only [ASSUMED].

## Metadata

**Confidence breakdown:**
- Current-state inventory: HIGH -- direct source reads with line numbers.
- Design-language constraints: HIGH -- from the user's own stored feedback.
- Best-practice mapping: MEDIUM -- GitHub/Linear docs via search, adapted by judgment.
- Pitfalls 1-3 (data bugs): HIGH from code reading; not reproduced at runtime. Pitfall 9 (compiler staleness): MEDIUM/unverified.

**Research date:** 2026-11-10
**Valid until:** ~30 days (internal code stable; check `git log` on `src/routes/notifications` and `stores/notifications.store.ts` before planning).
