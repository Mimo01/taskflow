# Phase 77: Universal Peek Slideover and Issue-Detail Refinements — Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/app/PeekPanel.tsx` | component | request-response | `src/routes/dashboard/IssueDetailSheet.tsx` | exact (same query wiring, same IssueDetailContent+Sidebar composition) |
| `src/main.tsx` | provider/layout | event-driven | `src/main.tsx` (self — add peek state alongside existing breadcrumb/handleIssueClick) | self-analog |
| `src/routes/dashboard/IssueDetailContent.tsx` | component | request-response | `src/routes/dashboard/IssueDetailPage.tsx` (sidebar drag handle pattern) | role-match |
| `src/routes/dashboard/issue-detail/FieldsSection.tsx` | component | CRUD | `src/routes/dashboard/issue-detail/FieldsSection.tsx` (self — remove parent MetaRow) | self-analog |
| `src/routes/dashboard/TaskCard.tsx` | component | event-driven | `src/routes/dashboard/BacklogRow.tsx` (epic badge stopPropagation) | role-match |
| `src/routes/dashboard/BacklogRow.tsx` | component | event-driven | `src/routes/dashboard/BacklogRow.tsx` (self — epic badge pattern already present) | self-analog |
| `src/routes/dashboard/DashboardInProgressCard.tsx` | component | event-driven | `src/routes/dashboard/BacklogRow.tsx` (epic badge stopPropagation) | role-match |
| Standup sub-components | component | event-driven | `src/routes/dashboard/BacklogRow.tsx` (same useOutletContext destructure pattern) | role-match |
| `src/components/app/CommandPalette.tsx` | component | event-driven | `src/components/app/CommandPalette.tsx` (self — add onOpenIssue alongside onIssueClick) | self-analog |
| `src/routes/notifications/NotificationPopover.tsx` | component | event-driven | `src/routes/notifications/NotificationPopover.tsx` (self — handleRowClick split) | self-analog |
| `src/stores/settings.store.ts` | store | CRUD | `src/stores/settings.store.ts` (self — v25 rankFieldKey migration is the exact pattern) | self-analog |
| `src/components/app/PeekPanel.test.tsx` | test | — | `src/routes/dashboard/IssueDetailContent.tsx` tests (no existing test to copy) | no analog |

---

## Pattern Assignments

### `src/components/app/PeekPanel.tsx` (component, request-response)

**Analog:** `src/routes/dashboard/IssueDetailSheet.tsx` (full file) + `src/routes/dashboard/IssueDetailPage.tsx` lines 652–675 (drag handle DOM)

**Imports pattern** — copy from `IssueDetailSheet.tsx` lines 1–11:
```tsx
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, X } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { JiraIssue } from '@/services/jira';
import { fetchEpicStories, fetchIssueDetail } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useResizable } from '@/hooks/useResizable';
import { IssueDetailContent } from '@/routes/dashboard/IssueDetailContent';
import { IssueDetailSidebar } from '@/routes/dashboard/IssueDetailSidebar';
```

**useResizable call** — copy from `IssueDetailPage.tsx` lines 319–329, substituting peek values:
```tsx
// IssueDetailPage.tsx:319-329 — this is the exact hook invocation to copy
const initialPanelWidth = useMemo(
  () => peekPanelWidth ?? 480,
  [peekPanelWidth],
);
const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: initialPanelWidth,
  min: 360,
  max: 720,
  onCommit: setPeekPanelWidth,
  direction: 'left',  // left edge drag handle, same as IssueDetailPage sidebar
});
```

**Drag handle DOM** — copy from `IssueDetailPage.tsx` lines 657–664, substituting aria-label per UI-SPEC:
```tsx
// IssueDetailPage.tsx:657-664
<div
  aria-hidden="true"
  aria-label="Resize preview panel"
  onMouseDown={handleMouseDown}
  className="absolute left-0 top-0 h-full w-3 cursor-col-resize z-20 border-l border-border transition-colors duration-100"
/>
```
Note: IssueDetailPage uses `cursor-ew-resize`; UI-SPEC §Interaction Contract mandates `cursor-col-resize` for the PeekPanel handle element. The hook still sets `ew-resize` globally during drag — that is correct and intentional.

**IssueDetailBody query wiring** — copy from `IssueDetailSheet.tsx` lines 62–154:
The entire `IssueDetailBody` inner function is the content. Extract it (it is currently unexported). Copy the `useQuery` for `jira-issue-detail` (lines 87–102) and the epic stories sub-query (lines 106–115) verbatim; the query keys and enabled conditions are already correct. Add a `layout` prop:

```tsx
// IssueDetailSheet.tsx:62-77 — interface to copy then extend
interface IssueDetailBodyProps {
  issueKey: string;
  onOpenIssue?: (key: string) => void;
  onEdit?: (initialValues: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
  layout?: 'two-column' | 'single-column';  // NEW — single-column for PeekPanel (D-06)
}
```

**Single-column layout wrapper** — copy from `IssueDetailSheet.tsx` lines 121–153 as the two-column baseline, then add the `layout` branch:
```tsx
// IssueDetailSheet.tsx:122-154 — two-column baseline (keep for IssueDetailSheet reuse)
// Two-column (existing):
<div data-testid="issue-detail-body" className="flex h-full overflow-hidden">
  <div className="flex-1 overflow-auto p-6">
    <IssueDetailContent ... />
  </div>
  <div className="w-[42%] border-l overflow-auto p-4 shrink-0">
    <IssueDetailSidebar ... />
  </div>
</div>

// Single-column variant (NEW for PeekPanel, D-06):
<div data-testid="issue-detail-body" className="flex flex-col h-full overflow-auto">
  <div className="p-4 border-b">
    <IssueDetailSidebar ... />   {/* sidebar fields stacked first */}
  </div>
  <div className="flex-1 p-4">
    <IssueDetailContent ... />   {/* description, comments/subtasks below */}
  </div>
</div>
```

**Skeleton** — copy from `IssueDetailSheet.tsx` lines 157–174:
```tsx
// IssueDetailSheet.tsx:157-174
function IssueDetailSkeleton({ 'data-testid': testId }: { 'data-testid'?: string }) {
  return (
    <div data-testid={testId ?? 'issue-detail-skeleton'} className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        ...
      </div>
    </div>
  );
}
```
For single-column peek, render the skeleton in a `flex-col` wrapper instead.

**Peek header bar** — no analog exists; build from UI-SPEC §Peek Header Bar:
```tsx
// New: PeekHeader (inline or extracted)
// UI-SPEC: h-10, px-4, border-b border-border; key left; ExternalLink + "Open full page" + X right
<div className="flex items-center justify-between h-10 px-4 border-b border-border shrink-0">
  <span className="text-xs font-mono text-muted-foreground">{issueKey}</span>
  <div className="flex items-center gap-1">
    <Button variant="ghost" size="sm" onClick={onNavigateFull}>
      <ExternalLink className="size-3.5 mr-1" />
      Open full page
    </Button>
    <Button variant="ghost" size="icon" aria-label="Close preview" onClick={onClose}>
      <X className="size-4" />
    </Button>
  </div>
</div>
```

**Escape dismiss** — copy from `CommandPalette.tsx` line 77:
```tsx
// CommandPalette.tsx:77
useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: open });
// PeekPanel equivalent:
useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: !!issueKey && !paletteOpen });
```

**Panel layout container** — the PeekPanel is mounted as a layout sibling. Its outer wrapper:
```tsx
// Derived from IssueDetailPage.tsx:654-655 right sidebar shape
<div
  className={`relative border-l border-border overflow-hidden flex flex-col shrink-0${isDragging ? '' : ' transition-all duration-200'}`}
  style={{ width }}
>
  {/* drag handle */}
  {/* peek header */}
  {/* IssueDetailBody */}
</div>
```

---

### `src/main.tsx` — AppLayout peek state + mount (layout, event-driven)

**Analog:** `src/main.tsx` self — existing `handleIssueClick` at lines 336–349 and `Outlet` context at lines 553–565 are the seams to extend.

**New state declarations** — add alongside existing breadcrumb/panel state:
```tsx
// Pattern: mirror existing panel state (e.g. paletteOpen: useState<boolean>)
const [peekIssueKey, setPeekIssueKey] = useState<string | null>(null);
const { peekPanelWidth, setPeekPanelWidth } = useSettingsStore();
```

**handleOpenPeek** — new handler, parallel to `handleIssueClick` at line 336:
```tsx
// Analog: handleIssueClick at main.tsx:336 — same signature, different behavior
const handleOpenPeek = (issueKey: string) => {
  setPeekIssueKey(issueKey);
};
```

**Route-change peek close** — copy the existing useEffect at lines 290–299, add a separate effect:
```tsx
// Analog: main.tsx:290-299 (breadcrumb reset on route change)
useEffect(() => {
  if (location.pathname !== prevPathRef.current) {
    setPeekIssueKey(null);
    prevPathRef.current = location.pathname;
  }
}, [location.pathname]);
```

**Outlet context extension** — copy lines 553–564 and add `onOpenIssue`:
```tsx
// main.tsx:553-564 — current Outlet context (copy and extend)
context={{
  onIssueClick: handleIssueClick,
  onEpicClick: handleIssueClick,
  onMRClick: handleMRClick,
  openEdit: handleOpenEdit,
  openClone: handleOpenClone,
  openAddSubtask: handleOpenAddSubtask,
  openCreateStory: handleOpenCreateStory,
  onOpenIssue: handleOpenPeek,   // NEW
}}
```

**AppLayout return — wrap `<main>` + `<PeekPanel>` in a row-flex div:**
```tsx
// Current: main.tsx:553 — <main className="flex-1 overflow-auto">
// Change to: wrap inside a new row-flex container
// Analog: IssueDetailPage.tsx layout (column flex → row flex for content+sidebar)
<div className="flex flex-row flex-1 overflow-hidden min-h-0">
  <main className="flex-1 overflow-auto min-w-0">
    <Outlet context={{ ... onOpenIssue: handleOpenPeek }} />
  </main>
  {peekIssueKey && (
    <PeekPanel
      issueKey={peekIssueKey}
      width={peekPanelWidth}
      onWidthChange={setPeekPanelWidth}
      onClose={() => setPeekIssueKey(null)}
      onOpenIssue={(key) => setPeekIssueKey(key)}
      onNavigateFull={(key) => { handleIssueClick(key, true); }}
    />
  )}
</div>
```

**CommandPalette and NotificationPopover** — currently receive `onIssueClick` as a direct prop (not via Outlet context). See lines 568–578. Add `onOpenIssue` alongside:
```tsx
// main.tsx:568-578 — CommandPalette direct prop (current)
<CommandPalette
  open={paletteOpen}
  onClose={() => setPaletteOpen(false)}
  onIssueClick={(key) => { handleIssueClick(key, true); setPaletteOpen(false); }}
  onOpenIssue={(key) => { handleOpenPeek(key); setPaletteOpen(false); }}  // NEW
  onNavigate={handlePaletteNavigate}
  ...
/>
```

---

### `src/routes/dashboard/IssueDetailContent.tsx` — parent breadcrumb + cursor fixes (component, request-response)

**Analog:** `src/routes/dashboard/issue-detail/FieldsSection.tsx` lines 641–653 (parent button being relocated)

**Current title block** — lines 217–223:
```tsx
// IssueDetailContent.tsx:217-223 — existing title block (INSERT parent breadcrumb ABOVE this)
<div>
  <p className="text-xs font-mono text-muted-foreground mb-1">{issue.key}</p>
  <h2 className="text-xl font-semibold leading-snug">{summary}</h2>
</div>
```

**Parent breadcrumb to insert above title** — derived from FieldsSection.tsx:641–653 (the button being removed), reformatted per UI-SPEC §DETAIL-01:
```tsx
// NEW — insert before the <div> at line 217
// Icon: ArrowUpRight (lucide), 12px. Key: text-xs font-mono. Summary: text-sm text-muted-foreground.
// Spacing: mb-1 between breadcrumb and title.
{issue.fields.issuetype.subtask && issue.fields.parent && (
  <div
    className="flex items-center gap-1 mb-1 cursor-pointer hover:underline"
    onClick={() => onOpenIssue?.(issue.fields.parent!.key)}
  >
    <ArrowUpRight className="size-3 text-muted-foreground" />
    <span className="font-mono text-xs text-muted-foreground">{issue.fields.parent.key}</span>
    <span className="text-sm text-muted-foreground">— {issue.fields.parent.fields.summary}</span>
  </div>
)}
```
Note: Verify `parent` exists on `JiraIssueDetail` type (`src/services/jira/types.ts`) before implementing — RESEARCH.md assumption A1.

**Cursor-pointer fixes on subtask rows** — lines 102–105:
```tsx
// IssueDetailContent.tsx:105 — CHANGE py-1.5 → py-2 and ADD cursor-pointer
// Current:
className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left"
// Fixed:
className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-accent text-sm text-left cursor-pointer"
```

**Cursor-pointer on epic story rows** — lines 257–284 (check similar `hover:bg-accent` buttons lacking `cursor-pointer`): add `cursor-pointer` to the `className` of each `<button>` in `subtaskListContent` and epic story list.

---

### `src/routes/dashboard/issue-detail/FieldsSection.tsx` — remove parent MetaRow (component, CRUD)

**Analog:** Self. The parent MetaRow at lines 641–653 is the thing being removed.

**Target block to delete** — lines 641–653:
```tsx
// FieldsSection.tsx:641-653 — DELETE THIS ENTIRE BLOCK
{/* Parent -- subtasks only, navigable */}
{isSubtask && f.parent && (
  <MetaRow label="Parent">
    <button
      type="button"
      onClick={() => onOpenIssue?.(f.parent?.key ?? '')}
      className="text-left hover:underline cursor-pointer"
    >
      <span className="font-mono text-xs">{f.parent.key}</span>
      <span className="text-xs text-muted-foreground ml-1">— {f.parent.fields.summary}</span>
    </button>
  </MetaRow>
)}
```
The exact text/styles here are the source of truth for the new breadcrumb in IssueDetailContent. No other changes to FieldsSection are required for DETAIL-01.

---

### `src/routes/dashboard/TaskCard.tsx` — key/body click split (component, event-driven)

**Analog:** `src/routes/dashboard/BacklogRow.tsx` lines 111–126 (epic badge: nested button with `e.stopPropagation()`)

**Epic badge pattern to copy** — BacklogRow.tsx lines 111–126:
```tsx
// BacklogRow.tsx:111-126 — THIS is the stopPropagation idiom to extend to TaskCard
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onIssueClick(epicKey);
  }}
  className={cn(
    'inline-flex max-w-full items-center overflow-hidden rounded border px-1.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity',
    epicColorResult.className,
  )}
>
  <span className="truncate">{epicName}</span>
</button>
```

**TaskCard change required** — current issue key span at lines 119–128:
```tsx
// TaskCard.tsx:119-128 — CURRENT: span inside a <button> (the outer button calls onClick)
<span
  className={cn(
    'text-xs font-mono text-muted-foreground',
    isDoneStatus(...) ? 'line-through ...' : 'group-hover:underline',
  )}
>
  {issue.key}
</span>
```

**Change:** The outer `<button>` (line 93) wrapping all card content must become `<div role="button" tabIndex={0}>` (to allow the inner key `<button>` to be valid HTML — no nested `<button>` inside `<button>`). The key `<span>` becomes a `<button>` with `stopPropagation`:
```tsx
// NEW key element (replaces the <span> at line 119-128)
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    navigate(`/issue/${issue.key}`);
  }}
  className="text-xs font-mono text-muted-foreground cursor-pointer hover:underline"
>
  {issue.key}
</button>
```
The outer `<div role="button">` `onClick` calls `onOpenIssue(issue.key)` (new prop from `useOutletContext`).

---

### `src/routes/dashboard/BacklogRow.tsx` — wire body to onOpenIssue (component, event-driven)

**Analog:** Self. The epic badge at lines 111–126 is the established `stopPropagation` pattern; the `<tr onClick>` at lines 217 and 233 is the target to change.

**Key cell** — lines 79–88 (current `<span>`):
```tsx
// BacklogRow.tsx:79-88 — CURRENT: span (no separate click)
<span className={cn('font-mono text-xs text-muted-foreground', doneSummaryClass(...))}>
  {issue.key}
</span>
```
**Change to:**
```tsx
// Pattern from BacklogRow.tsx epic badge (lines 111-126)
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onIssueClick(issue.key);   // key click → full-page (existing handler)
  }}
  className="font-mono text-xs text-muted-foreground cursor-pointer hover:underline"
>
  {issue.key}
</button>
```

**Row click** — lines 217 and 233 (both `<tr onClick>` variants):
```tsx
// BacklogRow.tsx:217 and 233 — CHANGE: onIssueClick → onOpenIssue
// Current:
onClick={() => onIssueClick(issue.key)}
// Changed to:
onClick={() => onOpenIssue(issue.key)}
```
Both the plain `<tr>` (line 213) and the ContextMenuTrigger `<tr>` (line 229) need this change.

**Prop addition:** `onOpenIssue: (key: string) => void` added to `BacklogRowProps`. Both callers destructure from `useOutletContext` (or are passed down from the backlog page component).

---

### `src/routes/dashboard/DashboardInProgressCard.tsx` — key/body click split (component, event-driven)

**Analog:** `src/routes/dashboard/BacklogRow.tsx` epic badge (lines 111–126, stopPropagation pattern)

**Current parent story row button** — lines 129–144:
```tsx
// DashboardInProgressCard.tsx:129-144 — CURRENT: single button, key is a trailing <span>
<button
  type="button"
  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 ..."
  onClick={() => onIssueClick(parentKey)}
>
  <IssueTypeIcon ... />
  <span className="text-sm font-medium flex-1 truncate">{parentSummary}</span>
  <span className="text-xs text-muted-foreground font-mono shrink-0">{parentKey}</span>
</button>
```

**Change:** Key `<span>` (the trailing `{parentKey}`) becomes a `<button>` with `stopPropagation`. The outer `<button onClick>` changes from `onIssueClick(parentKey)` to `onOpenIssue(parentKey)`. Same pattern for subtask rows at lines 148–166 and orphan rows at lines 172–188.

```tsx
// NEW key element (BacklogRow epic badge pattern):
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onIssueClick(parentKey);   // key → full-page
  }}
  className="text-xs text-muted-foreground font-mono shrink-0 cursor-pointer hover:underline"
>
  {parentKey}
</button>
```

---

### Standup sub-components — onOpenIssue destructure + key/body split (component, event-driven)

**Analog:** `src/routes/dashboard/BacklogRow.tsx` for the stopPropagation idiom; `src/main.tsx` Outlet context for the destructure pattern.

**Outlet context destructure pattern** — mirrors every other surface:
```tsx
// Pattern from any surface file using useOutletContext (e.g. BacklogPage destructure)
const { onIssueClick, onOpenIssue } = useOutletContext<AppOutletContext>();
```

**Pass-through to sub-components:**
```tsx
// Add onOpenIssue prop to TodayColumn (and yesterday/earlier sections) alongside onIssueClick
<TodayColumn
  onIssueClick={onIssueClick}
  onOpenIssue={onOpenIssue}   // NEW
  ...
/>
```

Per-row key/body split inside TodayColumn and standup sub-components: same BacklogRow epic badge pattern — key `<button>` with `stopPropagation` → `onIssueClick`, row/body click → `onOpenIssue`.

---

### `src/components/app/CommandPalette.tsx` — add onOpenIssue prop (component, event-driven)

**Analog:** Self. Current `CommandPaletteProps` and `handleIssueSelect` at lines 41–48 and 164–168.

**Current props interface** — lines 41–48:
```tsx
// CommandPalette.tsx:41-48 — CURRENT (copy and add onOpenIssue)
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onIssueClick: (issueKey: string) => void;   // key click → full-page
  onNavigate: (path: string) => void;
  onOpenNotifications: () => void;
  onOpenCreate: () => void;
}
```
**Add:** `onOpenIssue: (issueKey: string) => void;`

**Escape handler** — line 77 (already correct pattern for PeekPanel to copy):
```tsx
// CommandPalette.tsx:77 — useHotkeys pattern to replicate in PeekPanel
useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: open });
```

**handleIssueSelect dispatch:** Body selection (list item click or Enter) → `onOpenIssue`; key-element click (if rendered separately) → `onIssueClick`. For CommandPalette, the entire row is typically the body; the key text visible in the row is a display element. Per D-10: clicking the key text → `onIssueClick`, clicking anywhere else → `onOpenIssue`.

---

### `src/routes/notifications/NotificationPopover.tsx` — add onOpenIssue + key split (component, event-driven)

**Analog:** Self. Current `handleRowClick` at lines 269–284 and `NotificationRow` props pattern.

**Current handleRowClick** — lines 269–284:
```tsx
// NotificationPopover.tsx:269-284 — CURRENT: all row clicks navigate full-page
function handleRowClick(item: NotificationItem) {
  markAsRead(item.id);
  const issueKey = extractJiraIssueKey(item);
  if (issueKey && onIssueClick) {
    onIssueClick(issueKey);
    onClose?.();
    return;
  }
  ...
}
```
**Change:** `onIssueClick(issueKey)` → `onOpenIssue(issueKey)` for body row click. Add a separate `onIssueKeyClick` for key-element click:
```tsx
// NEW: key-click handler (still navigates full-page)
function handleKeyClick(issueKey: string) {
  markAsRead(/* item id */);
  onIssueClick?.(issueKey);
  onClose?.();
}
```

**NotificationPopover props** — current lines 216–220 (add `onOpenIssue`):
```tsx
// NotificationPopover.tsx:216-220 — add onOpenIssue prop
export default function NotificationPopover({
  onIssueClick,
  onOpenIssue,   // NEW
  onMRClick,
  onClose,
  ...
})
```

**NotificationRow** — add `onIssueKeyClick?: () => void` prop. The outer `<button>` calls `onClick` (body → peek); the key text becomes a `<button>` with `stopPropagation` + `onIssueKeyClick` (key → full-page), following the BacklogRow epic badge pattern.

---

### `src/stores/settings.store.ts` — v26 peekPanelWidth migration (store, CRUD)

**Analog:** Self. The v25 `rankFieldKey` migration at lines 447–449 is the exact pattern to copy.

**v25 migration pattern** — lines 447–449:
```ts
// settings.store.ts:447-449 — v25 rankFieldKey migration (COPY THIS PATTERN for v26)
if (version < 25) {
  if (s.rankFieldKey === undefined) s.rankFieldKey = null;
}
```

**Changes required (5 touch points, all in settings.store.ts):**

1. `initialSettings` object (line 58 area) — add after `rankFieldKey`:
```ts
// settings.store.ts:initialSettings — add after rankFieldKey (line 58)
peekPanelWidth: 480 as number,
```

2. `SettingsState` interface (line 70 area) — add field + setter:
```ts
peekPanelWidth: number;
setPeekPanelWidth: (w: number) => void;
```

3. `create()` actions block (line 246 area) — add setter alongside existing panel width setters:
```ts
// settings.store.ts:246 — copy pattern of setIssueDetailPanelWidth
setPeekPanelWidth: (w) => set({ peekPanelWidth: w }),
```

4. Version bump (find `version: 25` in the persist config) — change to `version: 26`.

5. Migration block (after line 449) — add immediately after the `version < 25` block:
```ts
// settings.store.ts — add after line 449 (after v25 block)
if (version < 26) {
  if (s.peekPanelWidth === undefined) s.peekPanelWidth = 480;
}
```

---

### Test files (PeekPanel.test.tsx, TaskCard.test.tsx, IssueDetailContent.test.tsx)

**No close analog exists.** Use Vitest + @testing-library/react standard setup from `taskflow/vitest.config.ts`.

Key test patterns from RESEARCH.md §Validation Architecture:

- `PeekPanel.test.tsx`: mock `useQuery` to return a fixture issue; assert `data-testid="issue-detail-body"` is present; assert no `role="dialog"` in DOM (PEEK-03); `fireEvent.keyDown(document, { key: 'Escape' })` and assert `peekIssueKey` becomes null (PEEK-07).
- `TaskCard.test.tsx`: render with `onClick` and `onOpenIssue` mocks; click the key button → assert `stopPropagation` fired and `navigate('/issue/KEY')` called; click the body → assert `onOpenIssue('KEY')` called (PEEK-05).
- `IssueDetailContent.test.tsx`: render with a subtask fixture that has `fields.parent`; assert `ArrowUpRight` icon and parent key appear above the `<h2>` (DETAIL-01); assert subtask row buttons have `cursor-pointer` class (DETAIL-02).

---

## Shared Patterns

### stopPropagation Inner Clickable
**Source:** `src/routes/dashboard/BacklogRow.tsx` lines 111–126 (epic badge)
**Apply to:** TaskCard key button, BacklogRow key cell, DashboardInProgressCard key spans, standup per-row key, NotificationRow key text, CommandPalette key text
```tsx
// BacklogRow.tsx:111-126 — canonical stopPropagation pattern
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onIssueClick(epicKey);      // swap onIssueClick for the specific key-click handler per surface
  }}
  className="...hover:opacity-80 transition-opacity"
>
```

### Outlet Context Destructure
**Source:** Every existing surface file (BacklogPage, StandupNotesPage, etc.) consuming `useOutletContext`
**Apply to:** All surface files that add `onOpenIssue` from context
```tsx
// Pattern shared across surfaces
const { onIssueClick, onOpenIssue, ... } = useOutletContext<AppOutletContext>();
```
The `AppOutletContext` type annotation in each surface file must be updated to include `onOpenIssue: (key: string) => void`.

### useResizable Direction Left
**Source:** `src/routes/dashboard/IssueDetailPage.tsx` lines 323–329 + `src/hooks/useResizable.ts` lines 32–97
**Apply to:** `PeekPanel.tsx`
```tsx
// IssueDetailPage.tsx:323-329
const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: initialPanelWidth,
  min: 240,
  max: () => (containerRef.current?.offsetWidth ?? 800) * 0.5,
  onCommit: setIssueDetailPanelWidth,
  direction: 'left',
});
// PeekPanel: same hook, min:360/max:720 (fixed, not container-relative), onCommit:setPeekPanelWidth
```

### Settings Store Version Migration
**Source:** `src/stores/settings.store.ts` lines 447–449 (v25 rankFieldKey)
**Apply to:** `settings.store.ts` v26 peekPanelWidth
```ts
// settings.store.ts:447-449 — exact pattern for v26
if (version < 25) {
  if (s.rankFieldKey === undefined) s.rankFieldKey = null;
}
// v26 pattern:
if (version < 26) {
  if (s.peekPanelWidth === undefined) s.peekPanelWidth = 480;
}
```

### useHotkeys Escape Dismiss
**Source:** `src/components/app/CommandPalette.tsx` line 77
**Apply to:** `PeekPanel.tsx` Escape key dismiss
```tsx
// CommandPalette.tsx:77
useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: open });
// PeekPanel: enabled: !!peekIssueKey && !paletteOpen  (Pitfall 6 — avoid double-dismiss)
```

### IssueDetailBody Two-Column Layout
**Source:** `src/routes/dashboard/IssueDetailSheet.tsx` lines 121–154
**Apply to:** `PeekPanel.tsx` (single-column variant derived from the two-column baseline)
The two-column layout (`flex h-full overflow-hidden`, left `flex-1`, right `w-[42%] border-l`) is the baseline. Single-column swaps to `flex flex-col h-full overflow-auto` with sidebar block first (per D-06).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/app/PeekPanel.test.tsx` | test | — | No existing PeekPanel component or test to copy from; use Vitest + RTL standard setup |
| `src/routes/dashboard/TaskCard.test.tsx` | test | — | No existing TaskCard test file; Wave 0 creation |
| `src/routes/dashboard/IssueDetailContent.test.tsx` | test | — | No existing IssueDetailContent test file; Wave 0 creation |

---

## Metadata

**Analog search scope:** `taskflow/src/` — components/app, routes/dashboard, routes/notifications, stores, hooks
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-06-03
