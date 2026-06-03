---
phase: 77-universal-peek-slideover-and-issue-detail-refinements
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - taskflow/src/components/app/CommandPalette.tsx
  - taskflow/src/components/app/PeekPanel.tsx
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/notifications/NotificationPopover.tsx
  - taskflow/src/routes/notifications/NotificationRow.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/stores/settings.store.ts
findings:
  blocker: 1
  warning: 7
  info: 4
  total: 12
status: fixed
resolved: BL-01, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, WR-07 (commits 6ace4ded, 0bfdc0f2, 11609735, c3204708, 7c876046). IN-01..04 left as tracked tech-debt.
---

# Phase 77: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the universal "peek" slideover implementation: the new `PeekPanel`, the
extracted shared `IssueDetailView`, the key-vs-body click split across
`TaskCard`/`BacklogRow`/`DashboardInProgressCard`/`NotificationRow`/`CommandPalette`,
the route-change close effect and resizable persistence in `main.tsx`, and the
`peekPanelWidth` settings migration.

The event-propagation split (`stopPropagation` on the key element, body handler on
the wrapper) is implemented consistently and correctly across the click surfaces —
no double-fire was found in the primary render paths. The resizable persistence,
route-change close effect, and store migration (v26) are sound.

However, the `NotificationRow` key/body split has a real wiring gap in
`NotificationPopover`'s non-virtual fallback render path (BLOCKER below: the issue-key
button becomes a dead control there). Several secondary defects exist: duplicate
recent-item pushes, a GitLab recent-item id/route mismatch, an Escape-handler
focus-trap interaction, and an unstable `initialPanelWidth` memo. Details below.

## Critical Issues

### BL-01: NotificationPopover non-virtual path drops `onIssueKeyClick` — issue-key button becomes a dead control

**File:** `taskflow/src/routes/notifications/NotificationPopover.tsx:204-212`
**Issue:** The virtualized branch (lines 180-188) passes `onIssueKeyClick={() => onIssueKeyClick(entry.item)}` to `NotificationRow`, but the non-virtual fallback branch (lines 204-212) renders `NotificationRow` **without** `onIssueKeyClick`. In `NotificationRow`, the key element is a `<button>` whose handler does `e.stopPropagation(); onIssueKeyClick?.();` (NotificationRow.tsx:286-289). When `onIssueKeyClick` is undefined, clicking the issue key in the fallback path:
1. stops propagation (so the row body `onClick` → `onOpenIssue`/peek never fires), and
2. calls nothing (optional-chained no-op).

The result is a fully dead control: in the non-virtual path, clicking the issue key neither opens the peek nor navigates full-page. This is exactly the PEEK-05 behavior the phase set out to deliver, silently broken on one render path. The fallback path is reachable whenever `rowVirtualizer.getVirtualItems()` returns an empty array (`useVirtual = virtualItems.length > 0`, line 146) — e.g. zero measured height during initial mount, or any environment where the virtualizer has not yet produced rows.

**Fix:** Pass `onIssueKeyClick` in the fallback branch too:
```tsx
<NotificationRow
  key={entry.item.id}
  item={entry.item}
  isUnread={!readSet.has(entry.item.id)}
  onClick={() => onRowClick(entry.item)}
  onIssueKeyClick={() => onIssueKeyClick(entry.item)}
  onMarkRead={() => onMarkRead(entry.item)}
  onDismiss={() => onDismiss(entry.item)}
  onOpenInBrowser={onOpenInBrowser(entry.item)}
/>
```

## Warnings

### WR-01: Duplicate recent-item push on full-page navigation from CommandPalette

**File:** `taskflow/src/components/app/CommandPalette.tsx:177-183` (and `:168-174`)
**Issue:** `handleIssueKeyClick` calls `pushRecentItem(...)` (line 180) and then `onIssueClick?.(issueKey)` (line 181). In `main.tsx`, the wired `onIssueClick` is `(key) => { handleIssueClick(key, true); ... }` and `handleIssueClick` itself calls `pushRecentItem(...)` again (main.tsx:441). So a single key click pushes the same recent item twice. The store de-dupes by `(type, id)` (recent-items.store.ts:23-24), so no visible duplication, but the first push uses the palette-resolved title and the second may overwrite with a cache-resolved/undefined title, and the work is redundant. `handleIssueSelect` (peek path) similarly pushes here and again inside `IssueDetailView`'s effect (IssueDetailView.tsx:188-192).
**Fix:** Push the recent item in exactly one place per flow. Since `handleIssueClick` and `IssueDetailView` already own recent-item tracking, drop the `pushRecentItem` calls in `handleIssueKeyClick`/`handleIssueSelect`, or pass the resolved title through so the downstream push is authoritative.

### WR-02: GitLab recent-item id/route mismatch produces malformed `/mr/:id` navigation

**File:** `taskflow/src/components/app/CommandPalette.tsx:186-188` vs `:291-295` and `:221`
**Issue:** `handleMRSelect` stores a GitLab recent item with `id: `${mr.project_id}/${mr.iid}`` and navigates `/mr/${mr.project_id}/${mr.iid}` (correct, two-segment route). But the recent-items default-state click handler navigates `onNavigate(`/mr/${item.id}`)` (line 294) — correct only if `item.id` already contains `project_id/iid`. Meanwhile `getRecentItemLabel` looks up the cached MR via `allMRs.find((mr) => String(mr.iid) === item.id)` (line 221), which compares a bare `iid` against a `project_id/iid` string and therefore never matches, so the cached title is never resolved. The label also renders `!${item.id}` → `!12345/67`, leaking the project id into the displayed handle. (Note: appears partially pre-existing, but the peek work re-touched these paths.)
**Fix:** Pick one canonical GitLab recent-item id format and use it consistently: either store the composite `project_id/iid` and update `getRecentItemLabel` to split on `/` for both the `!iid` label and the `mr.iid` lookup, or store the bare `iid` plus a separate `projectId` field and rebuild the route from both.

### WR-03: `initialPanelWidth` memo reads a ref during render and is keyed only on the store value

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:311-314`
**Issue:** `initialPanelWidth = useMemo(() => issueDetailPanelWidth ?? Math.round((containerRef.current?.offsetWidth ?? 952) * 0.42), [issueDetailPanelWidth])`. On first render `containerRef.current` is `null` (ref attached on the same render's returned JSX), so the fallback `952 * 0.42` magic constant is always used for the two-column initial width when no persisted width exists — the real container width is never measured because the memo never re-runs after the ref attaches (its only dep is `issueDetailPanelWidth`). Reading a ref inside `useMemo` is also a render-purity smell. This only degrades the un-dragged default width, hence WARNING not BLOCKER.
**Fix:** Measure the container in a `useLayoutEffect` after mount and store the measured initial width in state, or drop the ref read from the memo and compute the percentage width via a post-mount effect.

### WR-04: PeekPanel Escape handler is gated only on `paletteOpen`, not on other open overlays

**File:** `taskflow/src/components/app/PeekPanel.tsx:52-55`
**Issue:** `useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: !!issueKey && !paletteOpen })`. The guard correctly avoids stealing Escape from the command palette, but the peek body renders editable surfaces (CommentComposer, inline comment/worklog edit `Textarea`s, the assignee/label/story-point inline inputs in `FieldsSection`). With `enableOnFormTags: true`, pressing Escape while editing a comment inside the peek will close the entire panel instead of cancelling the inline edit, discarding in-progress text. Inline editors that implement their own Escape-to-cancel (e.g. FieldsSection story-points `onKeyDown` Escape) will both cancel AND close the panel because the hotkey fires globally.
**Fix:** Either set `enableOnFormTags: false` for the peek Escape (so Escape in a field is handled locally first), or track an "inline edit active" flag and extend the `enabled` guard, consistent with how `paletteOpen` is already excluded.

### WR-05: Outlet context shape is widened but `IssueDetailPage` does not consume `onOpenIssue`

**File:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx:24-29,76-82`
**Issue:** `main.tsx` provides `onOpenIssue: handleOpenPeek` in the outlet context (main.tsx:582), and the phase intent (D-13) is "clicks inside peek swap, full-page clicks navigate." But `IssueDetailPage` destructures only `{ onIssueClick, openEdit, openClone, openAddSubtask }` and passes `onOpenIssue={onIssueClick}` to its `IssueDetailView` (line 79). That means on the **full-page** route, clicking a subtask/epic-story/linked-issue/parent body calls `onIssueClick` (full navigation), never opening a peek — which is a defensible product choice, but it diverges from the peek surfaces where the same elements open a peek. The inconsistency is undocumented and the `onOpenIssue` context value is silently unused on this route.
**Fix:** Confirm the intended behavior. If full-page child clicks should open a peek, destructure and pass `onOpenIssue` from context. If they should navigate, add a comment stating the deliberate divergence so the unused context key is not mistaken for a wiring bug.

### WR-06: `handleMarkRead` uses a ternary expression as a statement (no-op-prone pattern)

**File:** `taskflow/src/routes/notifications/NotificationPopover.tsx:308-310`
**Issue:** `readSet.has(item.id) ? markAsUnread(item.id) : markAsRead(item.id)` is a conditional expression evaluated for side effects only. `readSet` is rebuilt on every render from `readIds` (line 244); the toggle works, but the expression-statement form is fragile (a future refactor that returns a value, or a linter with `no-unused-expressions`, will silently break it) and is inconsistent with the explicit `if/else` used elsewhere in the file (e.g. `handleMarkAllRead`).
**Fix:** Use an explicit statement:
```ts
if (readSet.has(item.id)) markAsUnread(item.id);
else markAsRead(item.id);
```

### WR-07: Worklog edit fallback `started` timestamp can desync from the displayed local time

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:431-438`
**Issue:** In `handleWorklogEditSave`, when `original?.started` is missing the code falls back to `new Date().toISOString().replace('Z', '+0000')`. `toISOString()` returns UTC; the naive string `.replace('Z', '+0000')` reinterprets that UTC wall-clock time as a `+0000`-offset timestamp, which is correct only because UTC *is* +0000 — so this particular replacement happens to be safe. However it is brittle: any future change to use a local-time formatter with this same `.replace` would silently shift the worklog by the local offset. Flagging because the pattern reads as a TZ bug and invites one. Lower severity because the current value is numerically correct.
**Fix:** Build the offset string explicitly (e.g. format the Date with an explicit `+00:00`/`+0000` offset from `getTimezoneOffset`) rather than string-replacing `Z`, and add a comment that the value must be true +0000 UTC.

## Info

### IN-01: Hardcoded layout magic number `952` for default panel width

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:312` (also `IssueDetailSkeleton` `width: '42%'` at :806)
**Issue:** `952` is an unexplained fallback container width used to compute the 42% default. It is undocumented and will silently produce a wrong initial split on differently-sized windows until the user drags. Extract to a named constant with a comment, or derive from a measured value (see WR-03).

### IN-02: `IssueDetailContent` ignores `comments` author-name resolution edge for null `author`

**File:** `taskflow/src/routes/dashboard/IssueDetailContent.tsx:204-210`
**Issue:** The user-map builder guards `c.author?.displayName` but then casts `c.author as { displayName; name? }`. If a comment has `author === null` the optional chain skips it correctly, so no crash — but the duplicated cast pattern (also present in IssueDetailView.tsx:248-253) is copy-pasted across two files. Consider extracting a shared `buildInitialUserMap` helper to avoid drift between the two mention maps.

### IN-03: `extractJiraIssueKey` regex only matches uppercase project keys

**File:** `taskflow/src/routes/notifications/NotificationPopover.tsx:39,45` and `NotificationRow.tsx:47`
**Issue:** `/^[A-Z]+-\d+$/` (no `i` flag) only matches uppercase keys, whereas `CommandPalette`'s `resolvedKeyLookup` uses `/i` (CommandPalette.tsx:71). Jira keys are conventionally uppercase so this is usually fine, but the inconsistency means a lowercased key in a notification title/body would not be linkified. Align on one casing policy.

### IN-04: `useResizable` effect depends on `onCommit`/`max` identities that are recreated each render

**File:** `taskflow/src/hooks/useResizable.ts:69-95`
**Issue:** The drag effect lists `[isDragging, direction, min, max, onCommit]` as deps. Callers pass inline arrow `onCommit`/`max` (e.g. PeekPanel.tsx:47 `onCommit: onWidthChange` is stable, but IssueDetailView.tsx:318-319 passes an inline `max: () => ...`). When `isDragging` is true and the parent re-renders, the effect tears down and re-attaches the `mousemove`/`mouseup` listeners mid-drag. It functionally survives (listeners reattach immediately), but it is unnecessary churn during an active drag. Memoize the `max` callback in callers, or capture `onCommit`/`max` in refs as is already done for `width`.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
