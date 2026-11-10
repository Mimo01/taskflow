# Phase 95: Notifications redesign - Pattern Map

**Mapped:** 2026-11-10
**Files analyzed:** 13 new/modified (+ 4 test files)
**Analogs found:** 12 / 13

All paths are relative to the inner app dir `/Users/mimo/Documents/Projects/taskflow/taskflow/` (so `src/...` = `taskflow/src/...` from the repo root).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/routes/notifications/NotificationRow.tsx` (rewrite) | component | event-driven (click/hover/key) | `src/routes/standup-notes/IssueActivityGroup.tsx` (`ActivityGroupHeader`) + current row | role-match (overlay-button pattern exact) |
| `src/routes/notifications/NotificationGroupHeader.tsx` (new) | component | event-driven | `IssueActivityGroup.tsx` `ActivityGroupHeader` (lines 200-254) | exact |
| `src/routes/notifications/NotificationList.tsx` (new, extracted from popover) | component | transform + virtualized render | `VirtualizedNotificationList` in `NotificationPopover.tsx:109-219` | exact (extract) |
| `src/routes/notifications/NotificationPopover.tsx` (modify) | component | request-response (store reads) | itself + `src/routes/dashboard/AioCyclesScopeBar.tsx` (segmented filter) | exact |
| `src/routes/notifications/notification-view.ts` (new) | utility | transform (pure) | `getTimeGroup` / `buildVirtualEntries` / `extractJiraIssueKey` in `NotificationPopover.tsx:28-106` | role-match |
| `src/routes/notifications/notification-view.test.ts` (new) | test | transform | `src/stores/notifications.store.test.ts` (pure, no DOM) | role-match |
| `src/hooks/useNow.ts` (new, 60s tick) | hook | event-driven (timer) | `src/hooks/useUpdatePolling.ts` (timer hook; not read in full) | partial |
| `src/stores/notifications.store.ts` (modify: prune, `dismissedIds`, `clearRead`) | store | CRUD + persist | itself (lines 99-218) | exact |
| `src/stores/notifications.store.test.ts` (extend) | test | CRUD | itself (`makeItem`, `beforeEach` reset) | exact |
| `src/services/notifications.ts` (modify: due-date id, dedupe type) | service | batch/request-response | itself (lines 42-60, 457) | exact |
| `src/components/app/TopBar.tsx` (verify only, no change expected) | component | request-response | itself (lines 15-30, 86-111) | exact |
| `src/routes/notifications/NotificationRow.test.tsx` / `NotificationPopover.test.tsx` (rewrite/extend) | test | event-driven | current `NotificationPopover.test.tsx` (lines 1-40 setup) | exact |
| Keyboard layer (inside `NotificationList.tsx`) | component logic | event-driven | none exact; `src/hooks/useListNavigation.ts` is global j/k via react-hotkeys-hook | partial |

## Pattern Assignments

### `NotificationGroupHeader.tsx` and `NotificationRow.tsx` (component, event-driven)

**Analog:** `src/routes/standup-notes/IssueActivityGroup.tsx` `ActivityGroupHeader` (lines 200-254). This replaces the current `div[role=button]` + nested `<button>` (`NotificationRow.tsx:193-208, 284-296`, which carries a biome-ignore).

**Imports pattern** (IssueActivityGroup.tsx lines 19-23; note `@/` alias used in new code):
```typescript
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { useIsPeeked } from '@/stores/peek.store';
```
Existing row also uses `import { CachedAvatar } from '@/components/ui/cached-avatar'` and `import { LinkContextMenu } from '@/components/ui/link-context-menu'` (NotificationRow.tsx:15-16).

**Overlay-button core pattern** (IssueActivityGroup.tsx lines 222-253):
```tsx
const isPeeked = useIsPeeked(issueKey);
return (
  <div
    className={cn(
      'relative flex w-full items-center gap-2 px-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 hover:bg-muted/50',
      // focus-within outranks the plain peek tint; the overlay keeps focus after a click
      isPeeked ? PEEKED_ROW_CLASS : 'focus-within:bg-muted/50',
    )}
    data-peeked={isPeeked ? 'true' : undefined}
  >
    <button
      type="button"
      aria-label={`Open ${issueKey} ${summary}`}
      className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onBodyClick}
    />
    <IssueTypeIcon ... className="pointer-events-none relative size-4 shrink-0" />
    <button
      type="button"
      className="relative z-10 shrink-0 rounded text-xs text-muted-foreground font-mono cursor-pointer hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onKeyClick}
    >
      {issueKey}
    </button>
    <span className="pointer-events-none relative flex-1 min-w-16 truncate text-sm">{summary}</span>
  </div>
);
```
Adapt: spec wants inset ring (`focus-visible:ring-2 ring-inset`), unread dot cell 8px, glyph 16px, avatar 20px, time `w-12`; hook `useIsPeeked` must be called before early returns. Peek is NOT wired from TopBar (D-13), so `data-peeked` only matters if an issue is open in peek elsewhere; for `.map` contexts compare against `usePeekStore`.

**Hover tray (keep from current row, add focus reveal)** (NotificationRow.tsx lines 241-279):
```tsx
<div className="flex-shrink-0 relative flex items-center h-5">
  <span className="text-[10px] ... tabular-nums group-hover:opacity-0 transition-opacity duration-100">{relTime(item.createdAt)}</span>
  {hasActions && (
    <span className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
      ...
      {item.url && onOpenInBrowser && (
        <LinkContextMenu href={item.url}>
          <ActionIcon onClick={() => onOpenInBrowser()} title={...}><ExternalLink className="w-3.5 h-3.5" /></ActionIcon>
        </LinkContextMenu>
      )}
```
Change: add `group-focus-within:opacity-100` (and hide time on focus-within), tray buttons `relative z-10`, 24px squares, rename Dismiss `X` -> Done `Check`, read toggle `Mail`/`MailOpen`, use `Tooltip`/`TooltipContent` from `@/components/ui/tooltip`. Keep the `ActionIcon` `stopPropagation` shape (lines 135-169).

**Tooltip with TooltipBody** (analog `src/routes/dashboard/AioCyclesScopeBar.tsx` lines 38-61):
```tsx
<Tooltip>
  <TooltipTrigger delay={0} render={<Badge .../>}>...</TooltipTrigger>
  <TooltipContent>
    <TooltipBody title="..." note={...}>
      <div className="truncate">...</div>
    </TooltipBody>
  </TooltipContent>
</Tooltip>
```
`TooltipTrigger` default `delay = 150` (`components/ui/tooltip.tsx:12`); pass `delay={600}` for the row hover tooltip (UI-SPEC ~600ms). Rows via `TooltipRow` (`components/ui/tooltip-body.tsx`) with `icon` marker.

**Colour tokens for the three status glyphs** (`src/lib/statusStyles.ts` lines 121-133): use `CHIP_TONE_CLASS` text parts only: `text-red-600 dark:text-red-400` / destructive, `text-green-600 dark:text-green-400`, `text-amber-600 dark:text-amber-400`. Entity-state pill on group headers: `statusPillClass(...)` (line 92) inside a flex parent; or the old `stateConfig` (NotificationRow.tsx:85-89) mapping merged/closed/opened re-expressed via `CHIP_TONE_CLASS` (`purple`/`red`/`green`).

**Helpers to keep:** `relTime` (NotificationRow.tsx:34-44) but change signature to `relTime(iso, now)` taking ticking now (Pitfall 9); drop `typeConfig` rainbow badge map (55-83) in favour of a glyph map; `parseBody` (99-131) can feed the tooltip text only, not the row.

**State preservation (D-05):** one component for read/unread, vary classes only (e.g. `isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'` and the dot `bg-primary` toggling opacity), never branch the component tree on `isUnread`.

---

### `NotificationList.tsx` (component, transform + virtualized)

**Analog:** `VirtualizedNotificationList` in `src/routes/notifications/NotificationPopover.tsx` lines 109-219.

**Imports/virtualizer config** (lines 14, 126-146):
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
const parentRef = useRef<HTMLDivElement>(null);
const rowVirtualizer = useVirtualizer({
  count: entries.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 64,          // spec: 32 events/groups, 28 headers -> estimateSize: (i) => ...
  overscan: 5,
  getItemKey: (index) => {
    const entry = entries[index];
    if (!entry) return index;
    return entry.type === 'header' ? `header:${entry.key}` : `item:${entry.item.id}`;
  },     // spec keys: header:{bucket} / group:{entityKey} / event:{id}
});
const virtualItems = rowVirtualizer.getVirtualItems();
const useVirtual = virtualItems.length > 0;
```

**Absolute-position wrapper with measureElement** (lines 157-172):
```tsx
<div
  key={virtualRow.key}
  ref={rowVirtualizer.measureElement}
  data-index={virtualRow.index}
  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
>
```
Container: `<div ref={parentRef} className="overflow-y-auto max-h-[520px]">`; add `relative` (memory: sr-only escape). Pitfall 5: the jsdom fallback branch (lines 193-215) duplicates markup; extract one `renderEntry(entry)` used by both branches. For keyboard focus, add `data-entry-index` and focus via `rowVirtualizer.scrollToIndex(i)` then `requestAnimationFrame(() => parentRef.current?.querySelector('[data-entry-index="i"] button')?.focus())`. Skeleton in RESEARCH "Keyboard layer skeleton"; ignore keys when `(e.target as HTMLElement).closest('input,textarea')`.

---

### `NotificationPopover.tsx` (component, store-reads)

**Analog:** itself plus `AioCyclesScopeBar.tsx` for the segmented control and `FieldsSection.tsx` / `release-detail/NotCoveredFixActions.tsx` for the overflow menu.

**Segmented Unread|All control** (AioCyclesScopeBar.tsx lines 67-92), copy verbatim, swap values/labels:
```tsx
<fieldset className="m-0 ml-auto inline-flex rounded-lg border-0 bg-muted p-0.5">
  <legend className="sr-only">Cycle status</legend>
  {([{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }] as const).map(({ value, label }) => (
    <button
      key={value} type="button" aria-pressed={statusFilter === value}
      onClick={() => setStatusFilter(value)}
      className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        statusFilter === value ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
    >{label}</button>
  ))}
</fieldset>
```
Note: layout is left-aligned in the popover filter bar (drop `ml-auto`).

**Overflow menu** (`src/routes/dashboard/release-detail/NotCoveredFixActions.tsx` lines 12-15, 63-92):
```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
<DropdownMenu>
  <DropdownMenuTrigger ...>...</DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem ...>...</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
Note: UI-SPEC says "add dropdown-menu only if missing"; it exists in `components/ui/dropdown-menu.tsx`. Nested inside a Base UI Popover; verify focus/Esc behaviour in preview.

**Store selectors, not whole-store** (current anti-pattern at lines 229-243: `useNotificationsStore()`); replace with per-field selectors, as `useUnreadCount` does (`notifications.store.ts:227`):
```ts
export const useUnreadCount = () => useNotificationsStore((s) => s._unreadCount);
```
For actions use separate `useNotificationsStore((s) => s.markAsRead)` calls (stable refs).

**Click handler to keep (D-13)** (lines 274-307): mark read, then `onIssueClick(issueKey)` / `onMRClick(\`${mrProjectId}/${mrIid}\`)` then `onClose?.()`. Remove the `onOpenIssue` branch priority (TopBar never passes it; `TopBar.tsx:22-24` comment), or keep as optional fallback. Replace `extractJiraIssueKey` (lines 28-47) with `getEntityKey`/`getJiraKey` from `notification-view.ts`.

**Error banner fix (Pitfall 3)**, currently line 487 only shows `ErrorState` when empty. Add above the list:
```tsx
{fetchError && visibleItems.length > 0 && retryFetch && (
  <div className="m-2"><StaleDataBanner onRetry={retryFetch} onDismiss={() => setStaleDismissed(true)} /></div>
)}
```
`StaleDataBanner` props: `{ onRetry, onDismiss }` (`components/ui/stale-data-banner.tsx:4-7`). Its copy is "Couldn't refresh — showing cached data" (em dash).

**Alert banners** keep as lines 447-484 (`Alert`/`AlertDescription` with absolute dismiss button), copy updated to the UI-SPEC copywriting contract.

**Empty states:** `EmptyState` props `{icon, title, subtitle, action, compact}` (`components/ui/empty-state.tsx:5-12`); use `compact` and `action` for "Notification settings". Existing `renderEmptyState` structure at lines 333-372 is the template (keep icons `Bell`/`BellOff`).

**Tabs counts:** neutral `bg-muted text-muted-foreground`, hidden at 0 (replace lines 429-440 coloured classes). Active tab style kept (`text-foreground border-b-2 border-primary`, lines 421-425).

**mark-all scoped:** existing `handleMarkAllRead` (lines 266-272) uses `markAllRead()` / `markAllReadBySource(activeTab)`; disable button at 0 unread for scope.

---

### `notification-view.ts` (utility, pure transform)

**Analog:** helpers inside `NotificationPopover.tsx`:
- `getTimeGroup` (lines 69-78) -> change to `bucketOf(iso, now: Date)` with `Today / Yesterday / This week / Older`, no `new Date()` inside (Pitfall 9).
- `buildVirtualEntries` (lines 91-106) -> basis for `buildEntries(items, readSet, filter, expandedGroups, now)`; entries become `header | group | event`.
- `sortNewestFirst` (lines 56-60).
- `getEntityKey`: RESEARCH "Pure grouping helper" code example. Replace both regex copies (`/^[A-Z]+-\d+$/` at Popover:40 and Row:48) with one accepting digits: `/^([A-Z][A-Z0-9]*-\d+):/`. GitLab: `${mrProjectId}/${mrIid}` (matches the `onMRClick` arg format at Popover:292).

No existing `useNow` or similar module: `grep` of `hooks/` finds no `useNow`, create it.

---

### `src/hooks/useNow.ts` (hook, timer)

No close analog (no existing `useNow`). Plan from RESEARCH Pitfall 9: `const [now, setNow] = useState(() => Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]); return now;`. For the module-level-read hazard see memory `project_react_compiler_module_read`: pass `now` down as a prop/arg, never read it inside a helper called during render.

---

### `src/stores/notifications.store.ts` (store, CRUD + persist)

**Analog:** itself.

**Prune readIds in `prependItems`** (current lines 117-124):
```ts
prependItems: (newItems) =>
  set((s) => {
    const existingIds = new Set(s.items.map((i) => i.id));
    const deduped = newItems.filter((i) => !existingIds.has(i.id));
    if (deduped.length === 0) return s;
    const items = [...deduped, ...s.items].slice(0, 200);
    return { items, ...computeUnreadCounts(items, s.readIds) };
  }),
```
Change: also filter `deduped` against `s.dismissedIds` (tombstones), prune `readIds` to `new Set(items.map(i=>i.id))` and return `readIds` (RESEARCH "Store pruning" snippet).

**Dismiss with tombstone** (current `removeItem`, lines 157-162):
```ts
removeItem: (id) =>
  set((s) => {
    const items = s.items.filter((i) => i.id !== id);
    const readIds = s.readIds.filter((rid) => rid !== id);
    return { items, readIds, ...computeUnreadCounts(items, readIds) };
  }),
```
Add `dismissedIds: string[]` append + `.slice(-500)`; add `clearRead` (remove all items with id in readIds, tombstone them) and group variants (`markGroupRead`, `removeItems(ids)`) following the same `set((s) => ...)` + `computeUnreadCounts` shape. Note `markAllReadBySource` (146-155) is the pattern for `Set` merge dedupe.

**Persist/merge (additive field)** (lines 186-215): add `dismissedIds: s.dismissedIds` to `partialize`, and in `merge` guard `const dismissedIds = Array.isArray(p.dismissedIds) ? p.dismissedIds : [];` mirroring the `readIds` guard at line 204. Add the field to the `NotificationsState` interface (lines 46-78) and initial state (102-113); `clearAll` (164-174) should reset it.

**Duplicate type (Pitfall 4):** `services/notifications.ts:42-60` re-declares `NotificationItem` identically. Dedupe: in the service replace the interface with `import type { NotificationItem, NotificationType } from '../stores/notifications.store'; export type { NotificationItem };`. Check the service's `NotificationType` import source (service lines ~1-40 not read) before editing; ensure no circular import (store imports only zustand + tauri-storage).

---

### `src/services/notifications.ts` (service)

**Due-date id (D-10)**, line 457: change
```ts
id: `jira-duedate-${issue.key}`,
```
to include the due date: `` `jira-duedate-${issue.key}-${issue.fields.duedate}` ``. `issue.fields.duedate` is already narrowed non-null by the `continue` at line 447. Check `services/notifications.test.ts` for assertions on the old id format.

---

### Tests

**Store test setup pattern** (`src/stores/notifications.store.test.ts` lines 34-47): `act(() => useNotificationsStore.setState({ items: [], readIds: [], ... }))` in `beforeEach`; add `dismissedIds: []` to the reset; reuse `makeItem(id, ...)`. Describe blocks use `NOTF-05`-style legacy prefix; new ones use `NOTIF-xx`.

**Popover test setup** (`NotificationPopover.test.tsx` lines 1-40): mock `@tauri-apps/plugin-opener` and `@/lib/useDetectedBrowsers` (needed by `LinkContextMenu`), reset store in `beforeEach`, `render(<NotificationPopover />)`. In jsdom the virtualizer returns 0 items so the fallback branch renders (Pitfall 5), so keyboard tests exercise the fallback path. Rewrite `NotificationRow.test.tsx` around roles/text (class/testid assertions on `notification-row`, `type-badge`, `action-tray`, border/tint classes will all break). Add a `rerender` test flipping `isUnread` asserting the same DOM node (Pitfall 7).

**Pure test:** `notification-view.test.ts` with injected `now`, no store, no jsdom features.

---

## Shared Patterns

### Neutral status-only colour
**Source:** `src/lib/statusStyles.ts:121-133` (`CHIP_TONE_CLASS`)
**Apply to:** `NotificationRow`, `NotificationGroupHeader`. Only pipeline-failure (red), mr-approval (green), due-date (amber) glyphs get colour; everything else `text-muted-foreground`.

### Overlay button for nested interactive
**Source:** `src/routes/standup-notes/IssueActivityGroup.tsx:200-254`
**Apply to:** event rows and group headers (overlay = row action; key button / tray buttons `relative z-10`; text `pointer-events-none relative`).

### Density variants (padding/font only)
**Source:** `density-compact:py-1 density-comfortable:py-2.5` (IssueActivityGroup.tsx:226; defined `src/index.css:10-11`). Never add/remove lines.

### Tooltips
**Source:** `components/ui/tooltip.tsx` (`Tooltip`, `TooltipTrigger delay`, `TooltipContent`) + `components/ui/tooltip-body.tsx` (`TooltipBody`, `TooltipRow`). Max 4 rows; plain text only (no `dangerouslySetInnerHTML`; Jira/GitLab text is user-controlled).

### Peek highlight
**Source:** `src/stores/peek.store.ts:20` `useIsPeeked(key)` + `src/lib/peek-highlight.ts` `PEEKED_ROW_CLASS` (last in `cn()`).

### Selectors, not whole-store subscription
**Source:** `notifications.store.ts:227-231` selectors; avoid `useNotificationsStore()` bare call (Popover:229).

### External links
**Source:** `openExternal` from `src/lib/openExternal` (Popover:21,324) and `LinkContextMenu`; keep http(s) only.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/hooks/useNow.ts` | hook | timer | No existing ticking-now hook; use RESEARCH Pitfall 9 sketch |
| Popover-scoped keyboard layer (in `NotificationList.tsx`) | logic | event-driven | Only global `useListNavigation` (react-hotkeys-hook j/k, `src/hooks/useListNavigation.ts`); popover-scoped `onKeyDown` + `scrollToIndex` roving focus has no precedent. Use RESEARCH skeleton |
| `KeyboardShortcutsPanel` entries | config | n/a | `lib/shortcuts.ts` `SHORTCUTS` is a global-hotkey registry with `defaultKey`/overrides (react-hotkeys-hook strings), not a fit for popover-local keys; per D-14 do NOT add, use tooltips |

## Metadata

**Analog search scope:** `src/routes/notifications`, `src/routes/standup-notes`, `src/routes/dashboard` (AioCyclesScopeBar, release-detail), `src/components/ui`, `src/components/app/TopBar.tsx`, `src/stores`, `src/services/notifications.ts`, `src/hooks`, `src/lib`
**Files scanned:** ~25 (full reads: NotificationRow, NotificationPopover, notifications.store, IssueActivityGroup, tooltip-body, empty-state, stale-data-banner; partial: statusStyles, AioCyclesScopeBar, shortcuts, services/notifications, tests)
**Pattern extraction date:** 2026-11-10
