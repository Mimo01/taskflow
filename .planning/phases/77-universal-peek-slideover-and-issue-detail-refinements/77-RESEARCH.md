# Phase 77: Universal Peek Slideover and Issue-Detail Refinements - Research

**Researched:** 2026-06-03
**Domain:** React UI refactor — layout panel, click model, state management, detail component reuse
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Peek is a push/squeeze layout panel — NOT a base-ui Dialog. Eliminates backdrop/aria-hidden tension.
- **D-02:** Mounted at app/layout level (around the routed Outlet in AppLayout in `main.tsx`), not per-route.
- **D-03:** User-resizable via drag divider. Default 480px, min 360, max 720. Width persisted in settings store (versioned migrate chain).
- **D-04:** Left border + no dimming. `border-l border-border`.
- **D-05:** Full interactive detail — reuse `IssueDetailContent` + `IssueDetailSidebar` exactly.
- **D-06:** Single-column layout inside peek: sidebar fields stacked first, then description, then comments/subtasks. Full-page layout unchanged.
- **D-07:** Close on route navigation to a different route. Swapping issues within same view keeps peek open.
- **D-08:** No click-away dismissal. Only Esc, X close, and "Open full page".
- **D-09:** Peek header: issue key left; "Open full page" + X right.
- **D-10:** Issue key becomes a distinct inner clickable with `stopPropagation()` → navigate full-page. Body opens peek. Applies to: TaskCard, BacklogRow, DashboardInProgressCard, Standup, CommandPalette, NotificationPopover.
- **D-11:** Parent link → breadcrumb above issue title in IssueDetailContent. Remove from FieldsSection sidebar (~line 641).
- **D-12:** Cursor-pointer sweep across all clickable issue-detail areas.
- **D-13:** `onOpenIssue` prop is context-sensitive: swap-peek inside peek, navigate full-page on /issue/:key route.

### Claude's Discretion

- Exact technical seam for D-13 (how `onOpenIssue` routes to swap-vs-navigate based on render context).
- Drag-divider implementation details (resize handle component, pointer math, persistence key naming).
- Skeleton/loading state inside peek follows existing `IssueDetailSkeleton`.

### Deferred Ideas (OUT OF SCOPE)

- Deep-link/URL sync for open peek (`?peek=PROJ-123`).
- Modifier-click (cmd/ctrl-click → full page) as alternative affordance.
- Keyboard navigation between issues while peek is open (j/k).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PEEK-01 | Clicking an issue anywhere (except its key) opens a slideover preview | App-level `handleIssueClick` seam confirmed at `main.tsx:336`; body-click plumbing flows through `useOutletContext` |
| PEEK-02 | Peek works for any issue type | `IssueDetailBody` already handles all issue types via `fetchIssueDetail`; isEpic branch in IssueDetailContent handles epic-specific content |
| PEEK-03 | Underlying view stays fully interactive (non-blocking, no focus trap, no backdrop) | CSS layout sibling — no Dialog, no focus trap; confirmed D-01 eliminates all modal concerns |
| PEEK-04 | Clicking another issue swaps preview without closing | `peekIssueKey` state update at AppLayout level; no unmount, just key change triggers new query |
| PEEK-05 | Issue key click → full-page detail | `stopPropagation` + `navigate('/issue/:key')` pattern already established in BacklogRow epic badge |
| PEEK-06 | Explicit "Open full page" affordance in peek | Peek header bar (D-09) with `ExternalLink` + "Open full page" button navigates to `/issue/:key` |
| PEEK-07 | Peek dismissed via Escape + explicit close control | `useHotkeys` already used in CommandPalette for Escape; same pattern applies; X button calls close handler |
| DETAIL-01 | Parent shown in main content (not sidebar) on subtask detail | Parent MetaRow at `FieldsSection.tsx:641-653` confirmed; IssueDetailContent title area at `:217-223` confirmed |
| DETAIL-02 | Clickable areas show pointer cursor on hover | IssueDetailContent subtask buttons at `:102-105` have no `cursor-pointer`; epic story buttons at `:257-284` also lack it; audit confirms gaps below |
</phase_requirements>

---

## Summary

Phase 77 introduces a universal non-blocking peek panel and two issue-detail refinements. The codebase already has all the reusable ingredients: `IssueDetailBody` (the inner component of the unused `IssueDetailSheet`) is the direct reuse target for peek content; `handleIssueClick` in `AppLayout` (`main.tsx:336`) is the seam where peek state attaches; `useResizable` hook and `useSettingsStore` migration chain are the exact patterns for the drag divider; and the `stopPropagation` idiom for inner clickables already exists (BacklogRow epic badge, NotificationRow action icons).

The main new work is: (1) adding peek state (`peekIssueKey`, `peekWidth`) to `AppLayout` and mounting `PeekPanel` as a layout sibling to the `<main>` element at `main.tsx:553`; (2) updating `useOutletContext` to expose `onOpenIssue` (peek-open) alongside the existing `onIssueClick` (navigate); (3) splitting issue key and body click targets on six surfaces; (4) building `PeekPanel` as a CSS layout panel wrapping `IssueDetailBody` in single-column mode; (5) relocating the parent link; and (6) adding missing `cursor-pointer` classes.

The D-01 decision (CSS layout panel, no base-ui Dialog) fully eliminates the `aria-hidden` / `modal={false}` concern noted in STATE.md. There is no focus trap to worry about — focus management for the peek is minimal: Escape dismissal via `useHotkeys` is the only keyboard concern.

**Primary recommendation:** Mount `PeekPanel` as a sibling to `<main className="flex-1 overflow-auto">` inside the inner flex column (`flex flex-col flex-1 overflow-hidden`) of `AppLayout`. Change the outer `<main>` to not occupy `flex-1` alone when the peek is open — instead make the content area and peek panel siblings in a `flex flex-row` layout. Add `peekIssueKey` and `peekPanelWidth` state to `AppLayout` and wire them through `useOutletContext` and `PeekPanel` props.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Peek panel state (open key, width) | AppLayout (main.tsx) | Settings store (width persistence) | Must be at layout level per D-02; persisted width follows existing store pattern |
| Peek open/close/swap logic | AppLayout | — | Co-located with handleIssueClick; flows down via context |
| Peek panel rendering | PeekPanel component | IssueDetailBody (reused) | New wrapper; reuses existing body query+layout |
| Click-split (key vs body) | Each surface (TaskCard, BacklogRow, etc.) | AppLayout context | Surfaces own their DOM; AppLayout provides the two handlers |
| onOpenIssue context-sensitivity | PeekPanel (provides swap fn) / IssueDetailPage (provides navigate fn) | IssueDetailContent/Sidebar/FieldsSection | Prop passes through; each render site wires the correct handler |
| Parent breadcrumb | IssueDetailContent | FieldsSection (removal) | DETAIL-01 moves ownership from sidebar to main content |
| Cursor-pointer audit | IssueDetailContent, FieldsSection | LinkedIssuesSection, IssueDetailSidebar | DETAIL-02 sweep across all detail components |
| Width persistence | settings.store.ts (version 26) | useResizable hook | Following Phase 76 v25 rankFieldKey migration pattern |
| Route-change close | AppLayout (useEffect on location.pathname) | — | Already tracks location; add peek reset to same effect |

---

## Standard Stack

No new packages. This phase is pure React/Tailwind/Zustand refactor using existing project libraries.

### Core (existing, reused)

| Library | Version | Purpose | Relevance to Phase 77 |
|---------|---------|---------|----------------------|
| `react` + `react-dom` | 18.x | Component model | PeekPanel component; state co-location |
| `react-router-dom` | 6.x | `useLocation`, `useNavigate`, `useOutletContext`, `Outlet` | Route-change detection; Outlet context extension |
| `zustand` + `persist` | 4.x | `useSettingsStore` | Adding `peekPanelWidth` field + version 26 migration |
| `react-hotkeys-hook` | current | `useHotkeys` | Escape key dismiss (mirrors CommandPalette pattern) |
| `lucide-react` | current | `ExternalLink`, `X`, `ArrowUpRight` | Peek header icons; parent breadcrumb icon |
| `@tanstack/react-query` | 5.x | `useQuery` | IssueDetailBody reuses existing query wiring |
| tailwindcss | 3.x | CSS layout | Flex layout for squeeze; `border-l border-border` |

### No new installations required

The UI-SPEC registry table confirms: "No new `npx shadcn add` commands required for this phase."

---

## Package Legitimacy Audit

No new packages installed in this phase. N/A.

---

## Architecture Patterns

### System Architecture Diagram

```
User click on issue body (any surface)
        │
        ▼
useOutletContext().onOpenIssue(key)          useOutletContext().onIssueClick(key)
        │   [new: sets peekIssueKey]                  │   [existing: navigate('/issue/:key')]
        ▼                                             ▼
AppLayout (main.tsx)                         handleIssueClick (existing)
  └─ peekIssueKey state                        └─ navigate + breadcrumb
  └─ peekPanelWidth state
        │
        ▼
   <div class="flex flex-row flex-1 overflow-hidden">
     ┌───────────────────┬─────────────────────┐
     │  <main>           │  <PeekPanel>        │
     │  flex-1           │  style={{width}}    │
     │  overflow-auto    │  border-l           │
     │  <Outlet />       │  ┌───────────────┐  │
     │                   │  │ PeekHeader    │  │
     │                   │  │ key | [Open] X│  │
     │                   │  ├───────────────┤  │
     │                   │  │ IssueDetailBody│ │
     │                   │  │ (single-col)  │  │
     │                   │  └───────────────┘  │
     └───────────────────┴─────────────────────┘
                                │ drag divider (useResizable, direction='left')
```

Route change (location.pathname change):
```
location.pathname change
        │
        ▼
useEffect in AppLayout
  └─ if new route ≠ current route → setPeekIssueKey(null)
```

onOpenIssue context-sensitivity:
```
Rendered inside PeekPanel:
  onOpenIssue = (key) => setPeekIssueKey(key)   [swap]

Rendered inside IssueDetailPage (/issue/:key):
  onOpenIssue = onIssueClick (from useOutletContext) [navigate]
```

### Recommended Project Structure

```
src/
├── components/app/
│   └── PeekPanel.tsx          # New: squeeze layout wrapper + header + IssueDetailBody composition
├── main.tsx                   # Modified: add peekIssueKey state, PeekPanel mount, context extension
├── routes/dashboard/
│   ├── IssueDetailContent.tsx # Modified: parent breadcrumb above title, cursor-pointer on subtask/epic rows
│   ├── TaskCard.tsx           # Modified: key split out as inner clickable
│   ├── BacklogRow.tsx         # Modified: body calls onOpenIssue, key confirms stopPropagation
│   ├── DashboardInProgressCard.tsx  # Modified: key/body split
│   └── issue-detail/
│       ├── FieldsSection.tsx  # Modified: remove parent MetaRow (~line 641)
│       └── LinkedIssuesSection.tsx  # Audit cursor-pointer (already present — confirmed)
├── stores/settings.store.ts   # Modified: add peekPanelWidth, version bump to 26
└── hooks/useResizable.ts      # Reused as-is for PeekPanel drag divider
```

### Pattern 1: App-level Outlet Layout with Peek Sibling

**What:** The `AppLayout` return currently has:
```tsx
// main.tsx:512-565 (VERIFIED from code read)
<div className="flex h-screen overflow-hidden">
  <Sidebar />
  <div className="flex flex-col flex-1 overflow-hidden">
    <TopBar ... />
    {pinnedKeys.length > 0 && <PinnedTabStrip ... />}
    {/* banners */}
    <main className="flex-1 overflow-auto">
      <Outlet context={{ onIssueClick, ... }} />
    </main>
  </div>
  {/* Command palette, modals, etc. */}
</div>
```

**Change required:** Wrap `<main>` and `<PeekPanel>` inside a new `<div className="flex flex-row flex-1 overflow-hidden min-h-0">`:

```tsx
// After change (VERIFIED pattern from IssueDetailPage right-sidebar layout)
<div className="flex flex-row flex-1 overflow-hidden min-h-0">
  <main className="flex-1 overflow-auto min-w-0">
    <Outlet context={{ onIssueClick, onOpenIssue: handleOpenPeek, ... }} />
  </main>
  {peekIssueKey && (
    <PeekPanel
      issueKey={peekIssueKey}
      width={peekPanelWidth}
      onWidthChange={setPeekPanelWidth}
      onClose={() => setPeekIssueKey(null)}
      onOpenIssue={(key) => setPeekIssueKey(key)}
      onNavigateFull={(key) => { handleIssueClick(key); setPeekIssueKey(null); }}
    />
  )}
</div>
```

Source: Derived from actual `main.tsx` code read at lines 512-565. [ASSUMED: exact wrapper class names — verify against layout; `min-h-0` needed to prevent flex overflow in some browser scenarios]

### Pattern 2: useResizable for PeekPanel (VERIFIED EXISTING)

The `useResizable` hook at `src/hooks/useResizable.ts` [VERIFIED from code read] accepts `direction: 'left'` which inverts the delta — this is exactly what a right-edge peek panel needs (dragging the left edge inward increases panel width). Current usage in `IssueDetailPage` uses `direction: 'left'`:

```tsx
// IssueDetailPage.tsx:323-329 (VERIFIED from code read)
const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: initialPanelWidth,
  min: 240,
  max: () => (containerRef.current?.offsetWidth ?? 800) * 0.5,
  onCommit: setIssueDetailPanelWidth,
  direction: 'left',
});
```

For PeekPanel, the values change:
- `min: 360`, `max: 720` (D-03)
- `initialWidth: peekPanelWidth ?? 480` (default 480 per D-03)
- `onCommit: setPeekPanelWidth` (to settings store)

The drag handle DOM pattern to copy from `IssueDetailPage.tsx:657-664`:
```tsx
<div
  aria-hidden="true"
  aria-label="Resize preview panel"
  onMouseDown={handleMouseDown}
  className="absolute left-0 top-0 h-full w-3 cursor-col-resize z-20 border-l border-border transition-colors duration-100"
/>
```

Note: The UI-SPEC specifies `cursor-col-resize` (not `cursor-ew-resize`). The existing useResizable hook sets `document.documentElement.style.cursor = 'ew-resize'` during drag — this is fine because `ew-resize` and `col-resize` are visually similar and the global cursor lock is intentional during active drag.

### Pattern 3: Settings Store Version Migration (VERIFIED EXISTING)

Current version: 25. Phase 76 added `rankFieldKey` at version 25:

```ts
// settings.store.ts:447-449 (VERIFIED from code read)
if (version < 25) {
  if (s.rankFieldKey === undefined) s.rankFieldKey = null;
}
```

Phase 77 adds `peekPanelWidth`. Follow the exact same pattern:

1. Add to `initialSettings` (default `480` as number): `peekPanelWidth: 480 as number`
2. Add to `SettingsState` interface: `peekPanelWidth: number; setPeekPanelWidth: (w: number) => void;`
3. Add setter in `create()`: `setPeekPanelWidth: (w) => set({ peekPanelWidth: w }),`
4. Bump `version: 25` → `version: 26`
5. Add migration block:
```ts
if (version < 26) {
  if (s.peekPanelWidth === undefined) s.peekPanelWidth = 480;
}
```

### Pattern 4: onOpenIssue Context-Sensitivity (D-13)

**What:** The `onOpenIssue` prop already flows from `IssueDetailBody` → `IssueDetailContent` → subtaskListContent, epic stories, and `IssueDetailSidebar` → `FieldsSection` → `LinkedIssuesSection`. The seam exists; only the value passed changes.

**Two render contexts:**

| Render context | Who passes onOpenIssue | Value |
|----------------|----------------------|-------|
| Inside `PeekPanel` | `PeekPanel` component | `(key) => setPeekIssueKey(key)` (swap) |
| Inside `IssueDetailPage` (`/issue/:key`) | `IssueDetailPage` directly | `onIssueClick` from `useOutletContext()` (navigate) |

**IssueDetailPage currently wires** (line 520, 673):
```tsx
onOpenIssue={onIssueClick}   // passes navigate handler
```

**PeekPanel will wire:**
```tsx
onOpenIssue={(key) => onOpenIssue(key)}  // passes swap handler
```

No changes needed to `IssueDetailContent`, `IssueDetailSidebar`, `FieldsSection`, or `LinkedIssuesSection` for D-13 — they already accept `onOpenIssue?: (key: string) => void` and call it correctly. The context-sensitivity is entirely at the mount site.

**Important nuance:** `IssueDetailPage` also passes `onOpenIssue` (as `onIssueClick`) to `IssueDetailSidebar`. Both mount points already support this via the existing prop signature. [VERIFIED from code read of IssueDetailPage.tsx:520, 673]

### Pattern 5: Outlet Context Extension

Current outlet context at `main.tsx:555-563`:
```tsx
context={{
  onIssueClick: handleIssueClick,
  onEpicClick: handleIssueClick,
  onMRClick: handleMRClick,
  openEdit: handleOpenEdit,
  openClone: handleOpenClone,
  openAddSubtask: handleOpenAddSubtask,
  openCreateStory: handleOpenCreateStory,
}}
```

Phase 77 adds `onOpenIssue: handleOpenPeek` to this context. Every surface that needs to split key/body click will call `onOpenIssue(key)` for the body (peek) and `onIssueClick(key)` for the key (full page). Surfaces that don't split (e.g. CommandPalette, NotificationPopover) pass `onIssueClick` directly as before for the key-click path; adding `onOpenIssue` for their body-click path.

All surfaces consume context via `useOutletContext<{...}>()`. TypeScript will require updating the type annotation on each surface's `useOutletContext` call when the new field is added.

**CommandPalette and NotificationPopover are passed `onIssueClick` as a direct prop** from `main.tsx` (not via `useOutletContext`) — see `main.tsx:571-578`, `main.tsx:216-220`. They need a second prop `onOpenIssue` added alongside `onIssueClick`. [VERIFIED from code read]

### Pattern 6: Route-Change Peek Close (D-07)

The existing `useEffect` at `main.tsx:290-299` already tracks `location.pathname` for breadcrumb reset. The peek close piggybacks on the same pattern:

```tsx
// Existing at main.tsx:290-299
useEffect(() => {
  if (!location.pathname.startsWith('/issue/') && ...) {
    breadcrumbReset();
  }
}, [location.pathname, breadcrumbReset]);
```

Add `setPeekIssueKey(null)` to a separate `useEffect` that fires on any pathname change:
```tsx
const prevPathRef = useRef(location.pathname);
useEffect(() => {
  if (location.pathname !== prevPathRef.current) {
    // Close peek on any route change
    setPeekIssueKey(null);
    prevPathRef.current = location.pathname;
  }
}, [location.pathname]);
```

Alternatively, a simpler formulation: just close on every pathname change unconditionally (peek state resets on route). This is simpler and correct per D-07 (same-view issue swaps update `peekIssueKey` without navigating, so `location.pathname` doesn't change).

### Anti-Patterns to Avoid

- **Mounting PeekPanel inside `<Outlet>` or any route component:** Breaks universality (D-02). Must be at AppLayout level, outside the Outlet.
- **Using a base-ui Dialog with `modal={false}`:** Explicitly rejected (D-01). Do not introduce a Dialog portal.
- **Click-away dismissal:** Explicitly rejected (D-08). No backdrop click handler.
- **Using `navigate` inside `PeekPanel.onOpenIssue`:** For D-13 swap case, call `setPeekIssueKey` only. Navigate is reserved for key clicks and "Open full page".
- **Passing `peekIssueKey` down through Outlet context:** Surfaces don't need to know whether the peek is open. Only the two handlers (`onOpenIssue` for body, `onIssueClick` for key) flow down.
- **Wrapping the entire AppLayout in a new flex container:** The existing `<div className="flex h-screen overflow-hidden">` at `main.tsx:513` is the root. Add the row-flex wrapper around only `<main>` + `<PeekPanel>`, inside the column flex div.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-resize panel width | Custom mouse event handler | `useResizable` hook (exists at `src/hooks/useResizable.ts`) | Already handles stale-closure pitfall (widthRef), cursor lock, text-selection suppression, `direction: 'left'` |
| Persisted panel width | localStorage or sessionStorage | `useSettingsStore` with versioned migrate | All other panel widths use this pattern; Tauri Store is the persistence layer |
| Keyboard Escape dismiss | Raw `document.addEventListener('keydown')` | `useHotkeys('escape', ...)` (react-hotkeys-hook) | Already used in CommandPalette; handles `enableOnFormTags: true` so Escape works while typing |
| Issue detail data fetching in peek | New query | `IssueDetailBody` (extracted from `IssueDetailSheet.tsx:62-154`) | Already wires all 5 custom field keys, isEpic branch, epicStories sub-query, loading state |
| Single-column layout variant | New component tree | `IssueDetailContent` + `IssueDetailSidebar` with flex-col wrapper | D-05 mandates full fidelity reuse; single-column is a wrapper layout choice, not a new component |

---

## Per-Surface Click Audit (D-10)

### TaskCard.tsx — lines 70-145 [VERIFIED from code read]

**Current structure:** One big `<button>` wrapping all content. The issue key is a `<span>` at line 118-129 with `group-hover:underline` styling — currently a span inside the button, not a separate interactive element.

**Change required:**
- Extract `<span>{issue.key}</span>` (line 127) into a nested `<button type="button" onClick={(e) => { e.stopPropagation(); navigate('/issue/' + issue.key); }}>` inside the outer button.
- The outer button's `onClick` changes from `onClick` (navigate) to calling `onOpenIssue(issue.key)`.
- Nested interactive elements inside a `<button>` are technically invalid HTML, but this is the established React pattern here — BacklogRow's epic badge (line 111-126 of BacklogRow.tsx) does exactly this (stopPropagation nested click inside a `<tr>` row click). For TaskCard, the outer element should become a `<div role="button">` instead of `<button>` to allow the inner key `<button>` to be valid. Alternatively, use absolute positioned overlay — the planner should pick one approach.
- **Recommended approach:** Convert outer `<button>` to `<div role="button" tabIndex={0} onClick={handleBodyClick}>` and keep key as `<button>` (standard interactive-element-within-interactive-element workaround). [ASSUMED: planner picks final approach]

### BacklogRow.tsx — lines 76-88 (key cell), 211-236 (row click) [VERIFIED from code read]

**Current structure:** `<tr onClick={() => onIssueClick(issue.key)}>` with key as `<span>` in a `<td>` (line 80-88). Epic badge cell (lines 111-128) already uses `e.stopPropagation()` pattern.

**Change required:**
- The key `<span>` (line 82-87) becomes `<button type="button" onClick={(e) => { e.stopPropagation(); onIssueClick(issue.key); }}>` with `cursor-pointer hover:underline`.
- The `<tr onClick>` changes to call `onOpenIssue(issue.key)` instead of `onIssueClick`.
- Both the context-menu tr and the non-context-menu tr (lines 213-222 and 225-238) need updating.
- `onIssueClick` prop (currently the only click handler passed to BacklogRow) needs a companion `onOpenIssue` prop added.

### DashboardInProgressCard.tsx — lines 125-185 [VERIFIED from code read]

**Current structure:** Parent story rows and subtask rows are `<button type="button" onClick={() => onIssueClick(key)}>`. The issue key appears as a `<span className="text-xs text-muted-foreground font-mono shrink-0">` at the end of each row (right side).

**Change required:**
- The right-side key `<span>` becomes a nested `<button>` with `stopPropagation`.
- Outer button calls `onOpenIssue(key)`.
- `onIssueClick` prop → kept as key-click handler; `onOpenIssue` prop added.

### Standup Notes Page — line 113, 407, 414 [VERIFIED from code read]

**Current structure:** Consumes `onIssueClick` from `useOutletContext()` and passes it to sub-components. The standup surfaces pass `onIssueClick` directly to `TodayColumn` and to the yesterday/earlier sections.

**Change required:**
- Destructure `onOpenIssue` from `useOutletContext` in addition to `onIssueClick`.
- Pass `onOpenIssue` down to `TodayColumn` and other sub-components for body clicks.
- Per-row components in standup need the key/body split. [ASSUMED: exact sub-component structure requires deeper read of standup sub-components]

### CommandPalette.tsx — lines 53, 164-168 [VERIFIED from code read]

**Current structure:** Receives `onIssueClick` as a direct prop. `handleIssueSelect` (line 164-168) calls `onIssueClick(issueKey)` for all interactions (list selection via keyboard or mouse).

**Nuance:** CommandPalette is a search/keyboard-first UI. Per D-10, clicking an issue body in the palette opens peek; the palette then closes. The result rows show the issue key prominently. The split is: clicking the key text → full-page; clicking anywhere else in the row → peek.

**Change required:**
- Add `onOpenIssue: (key: string) => void` prop to `CommandPaletteProps`.
- `handleIssueSelect` dispatches to `onOpenIssue` for the "select" action (body click / Enter), and `onIssueClick` for key-specific click.
- In `main.tsx`, pass `onOpenIssue: (key) => { handleOpenPeek(key); setPaletteOpen(false); }` to `CommandPalette`.

### NotificationPopover.tsx / NotificationRow.tsx [VERIFIED from code read]

**Current structure:** `NotificationRow` is a single big `<button type="button" onClick={onClick}>` (line 189-194). The `entityTitle` is parsed via `splitKey()` (line 178) which extracts `issueKey` and `title` for Jira notifications. The key is rendered as text within the row but not a separate clickable.

**Change required:**
- `NotificationRow` needs to render the issue key as a separate inner `<button>` with `stopPropagation` → `onIssueKeyClick`.
- Add `onIssueKeyClick?: () => void` prop to `NotificationRowProps`.
- `NotificationPopover` passes `onIssueKeyClick={() => { onIssueClick(issueKey); onClose?.(); }}` (full-page navigate).
- The outer `<button onClick={onClick}>` changes to call `onOpenIssue`.
- `NotificationPopover` receives `onOpenIssue` as a new prop from `main.tsx`.

---

## Detail Refinements Code Audit

### DETAIL-01: Parent Link Relocation

**Current location (VERIFIED from code read):**
- `FieldsSection.tsx:641-653` — renders `<MetaRow label="Parent">` with a `<button onClick={() => onOpenIssue?.(f.parent?.key)}>` when `isSubtask && f.parent`.
- The button already has `cursor-pointer` and `hover:underline` (line 647).

**Target location:**
- `IssueDetailContent.tsx` — the title block is at lines 217-223:
```tsx
<div>
  <p className="text-xs font-mono text-muted-foreground mb-1">{issue.key}</p>
  <h2 className="text-xl font-semibold leading-snug">{summary}</h2>
</div>
```

**Change:** Add parent breadcrumb before the title block when `issue.fields.issuetype.subtask && issue.fields.parent`:
```tsx
{issue.fields.issuetype.subtask && issue.fields.parent && (
  <div className="flex items-center gap-1 mb-1 cursor-pointer hover:underline"
       onClick={() => onOpenIssue?.(issue.fields.parent!.key)}>
    <ArrowUpRight className="size-3 text-muted-foreground" />
    <span className="font-mono text-xs text-muted-foreground">{issue.fields.parent.key}</span>
    <span className="text-xs text-muted-foreground">— {issue.fields.parent.fields.summary}</span>
  </div>
)}
```

Note: `issue.fields.parent` field must be present on `JiraIssueDetail`. Need to verify type definition includes `parent`. [ASSUMED: `parent` field exists on `JiraIssueDetail` — verify in `src/services/jira/types.ts` before implementing]

**Removal from FieldsSection:** Delete the `{isSubtask && f.parent && (<MetaRow ...>)}` block at lines 641-653.

### DETAIL-02: Cursor-Pointer Audit Results

| Location | Element | Currently has cursor-pointer? | Action |
|----------|---------|-------------------------------|--------|
| `IssueDetailContent.tsx:102-105` | Subtask row buttons (subtaskListContent) | No — `hover:bg-accent text-sm` but no `cursor-pointer` | Add `cursor-pointer` |
| `IssueDetailContent.tsx:257-284` | Epic story row buttons | No — same class pattern | Add `cursor-pointer` |
| `IssueDetailContent.tsx:310-313` | "Add subtask" button | No — only `hover:bg-accent` | Add `cursor-pointer` |
| `IssueDetailContent.tsx:322-335` | Pin button | No — it's a shadcn `<Button>` | shadcn Button has `cursor-pointer` in base styles — check, likely OK |
| `FieldsSection.tsx:429,462,488,593,647,661,774,839` | Various field edit triggers | Yes — `cursor-pointer` present | No change needed |
| `LinkedIssuesSection.tsx:45` | Linked issue rows | Yes — `cursor-pointer` already | No change needed |
| New parent breadcrumb (IssueDetailContent) | Parent link above title | N/A (new, include from creation) | Include `cursor-pointer` in creation |

**Key finding:** `IssueDetailContent.tsx` buttons consistently lack `cursor-pointer` — the subtask buttons, epic story buttons, and "Add subtask" button. This is the primary gap for DETAIL-02. `FieldsSection` and `LinkedIssuesSection` are already correct.

---

## Common Pitfalls

### Pitfall 1: Nested `<button>` Inside `<button>` (TaskCard)
**What goes wrong:** HTML does not allow `<button>` inside `<button>`. Chrome silently breaks the nesting; both click handlers may fire incorrectly.
**Why it happens:** TaskCard is currently a single `<button>`. Naively adding a key `<button>` inside creates invalid HTML.
**How to avoid:** Convert the outer element to `<div role="button" tabIndex={0}>` with keyboard handler (`onKeyDown` for Enter/Space), keeping the inner key as `<button>`. Alternatively, use a `<span>` for the key with `onClick + stopPropagation` (no nesting issue since `<span>` is not interactive by default).
**Warning signs:** Clicking the key navigates AND opens peek (both fire); browser devtools shows nested button warning.

### Pitfall 2: Stale Width on PeekPanel After Store Hydration
**What goes wrong:** `useResizable` initializes `width` from `initialWidth` at mount time. If the Tauri Store hydrates after mount, `issueDetailPanelWidth` arrives late and the panel renders at the wrong width.
**Why it happens:** Zustand persist with async Tauri storage; the store may not be hydrated on first render.
**How to avoid:** Follow the existing `IssueDetailPage` pattern: `useMemo` the `initialPanelWidth` from the store value; `useResizable` has a `useEffect` that syncs `width` when `initialWidth` changes (not during drag). This is already handled in the hook. [VERIFIED from useResizable.ts:50-56]
**Warning signs:** Panel renders at 480px even after user previously dragged to a different width.

### Pitfall 3: Peek Close Firing on Issue Swap (D-04 / D-07)
**What goes wrong:** If peek close is wired to "any state change" rather than "route navigation", clicking a different issue from the underlying list (which calls `setPeekIssueKey(newKey)`) also closes the peek momentarily before reopening with the new key, causing a flash.
**Why it happens:** Over-eager peek reset logic.
**How to avoid:** The route-change close uses `location.pathname` comparison — swapping peek issues does NOT change the pathname, so the `useEffect` on `location.pathname` is safe. Never call `setPeekIssueKey(null)` when processing a body click; only set it to the new key.
**Warning signs:** Peek flashes closed/open on issue swap; PEEK-04 test fails.

### Pitfall 4: IssueDetailBody Query Duplication
**What goes wrong:** Peek and full-page (`/issue/:key` for the same key) run duplicate queries with the same cache key `['jira-issue-detail', issueKey, jiraBaseUrl]`. This is actually fine — TanStack Query deduplicates. But if the peek and the full-page detail are showing the same key at the same time (user opened full page via key click, peek is still visible briefly), the data is shared.
**Why it happens:** Per D-07, "Open full page" navigates to `/issue/:key` which is a different route and closes the peek. So simultaneous render of both is not possible in the normal flow.
**How to avoid:** No special handling needed — the `navigate` to `/issue/:key` triggers `location.pathname` change which clears `peekIssueKey`. Just confirm the sequence: `onNavigateFull` → `handleIssueClick` → `navigate` → `location.pathname` change → `useEffect` → `setPeekIssueKey(null)`.

### Pitfall 5: `py-1.5` vs `py-2` Subtask Rows
**What goes wrong:** The UI-SPEC §Spacing mandates subtask row `py-2` (8px). Current code has `py-1.5` at `IssueDetailContent.tsx:105`. If overlooked, spacing regression fails the Nyquist check.
**Why it happens:** UI-SPEC was approved after code was written; the spec explicitly calls this out.
**How to avoid:** Change `py-1.5` → `py-2` in `subtaskListContent` button at line 105.
**Warning signs:** Subtask rows look tighter than 8px vertical padding.

### Pitfall 6: `useHotkeys` Escape Scope Conflict
**What goes wrong:** CommandPalette's `useHotkeys('escape', onClose, { enabled: open })` and the new PeekPanel's `useHotkeys('escape', closePeek, { enabled: !!peekIssueKey })` both fire when both are open.
**Why it happens:** react-hotkeys-hook processes all registered handlers with the same key.
**How to avoid:** Ensure CommandPalette's Escape is always given priority when it is open (it already gates on `enabled: open`). PeekPanel's Escape should not fire when the CommandPalette is open. Pass `enabled: !!peekIssueKey && !paletteOpen` or use priority ordering. Alternatively, CommandPalette's `onClose` closes the palette but not the peek; the peek stays open. This is the simplest approach and likely the right UX: Escape closes the topmost overlay first.

---

## Code Examples

### IssueDetailBody Extraction and Reuse

`IssueDetailSheet.tsx` exports only `IssueDetailSheet` today. The `IssueDetailBody` function (lines 62-154) is unexported. [VERIFIED from code read]

To reuse in `PeekPanel`, either:
1. **Export `IssueDetailBody`** from `IssueDetailSheet.tsx` — simplest, no refactor.
2. **Extract `IssueDetailBody` to its own file** (e.g. `src/routes/dashboard/IssueDetailBody.tsx`) — cleaner, avoids importing from a Dialog wrapper file.

Recommended: Extract to its own file. `IssueDetailSheet.tsx` becomes a thin wrapper that imports `IssueDetailBody`.

The `IssueDetailBody` interface needs one addition for the single-column peek layout (D-06):
```tsx
interface IssueDetailBodyProps {
  issueKey: string;
  onOpenIssue?: (key: string) => void;
  onEdit?: (initialValues: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
  layout?: 'two-column' | 'single-column';  // new prop
}
```

When `layout === 'single-column'`, render `IssueDetailSidebar` fields above `IssueDetailContent` in a `<div className="flex flex-col">` wrapper instead of the current `<div className="flex h-full overflow-hidden">` side-by-side.

Note: `IssueDetailBody` as currently written does NOT include comments, changelog, worklogs, or `CommentComposer` — those live only in `IssueDetailPage`. The peek uses `IssueDetailBody` which has the simpler content scope. The CONTEXT.md says "fully editable" but the reuse target for the peek is `IssueDetailBody`, which is the subset without the full activity timeline. [ASSUMED: comments/timeline are not part of the peek content given the reuse target is IssueDetailBody — confirm with planner]

**Important gap:** `IssueDetailBody` currently uses its own `useQuery` for `jira-issue-detail`. It does NOT wire the 4 independent queries (comments, subtask enrichment, changelog, worklogs) that `IssueDetailPage` added in Phase 75+. In the peek, the missing queries mean subtask enrichment won't load, and there will be no comment composer. This is a deliberate scope boundary (peek reuses the IssueDetailSheet body, not the full IssueDetailPage body). The planner should document this explicitly.

### Settings Store Addition

```typescript
// In initialSettings (settings.store.ts)
peekPanelWidth: 480 as number,

// In SettingsState interface
peekPanelWidth: number;
setPeekPanelWidth: (w: number) => void;

// In create() actions
setPeekPanelWidth: (w) => set({ peekPanelWidth: w }),

// version bump: 25 → 26
version: 26,

// migrate() addition:
if (version < 26) {
  if (s.peekPanelWidth === undefined) s.peekPanelWidth = 480;
}
```

---

## Runtime State Inventory

Step 2.5: SKIPPED. This is a greenfield UI phase, not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, or build artifacts are affected.

---

## Environment Availability

Step 2.6: SKIPPED. This phase has no external dependencies beyond the existing project stack. No new CLI tools, services, databases, or runtimes required.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `IssueDetailSheet` as base-ui Dialog (75vw) | CSS layout panel squeeze (Phase 77) | Phase 77 | Eliminates modal / aria-hidden concerns entirely |
| All issue clicks → navigate full-page | Body click → peek, key click → navigate | Phase 77 | Per-surface key/body split required |
| Parent link in sidebar FieldsSection | Parent breadcrumb above title in main content | Phase 77 | DETAIL-01 |
| No `cursor-pointer` on subtask/epic story rows | `cursor-pointer` added | Phase 77 | DETAIL-02 |

**Deprecated/outdated:**
- `IssueDetailSheet` Dialog wrapper: after Phase 77, this component is superseded by `PeekPanel`. The `IssueDetailSheet.tsx` file stays but its Dialog wrapper is no longer invoked; `IssueDetailBody` is extracted and reused. The Dialog wrapper shell may be deleted in a later cleanup phase.

---

## aria-hidden / Focus Management Confirmation

The STATE.md blocker note: "Phase 77: `Sheet modal={false}` vs CSS `position:fixed` — must verify `@base-ui/react Dialog modal={false}` suppresses `aria-hidden` on document root before writing plans."

**Resolution (VERIFIED by D-01):** This concern is **fully eliminated**. The peek is a CSS layout sibling — no Dialog, no portal, no `aria-hidden` manipulation. The `@base-ui/react` Dialog is not used at all.

**Remaining focus management considerations:**
- No focus trap — the underlying view is fully interactive (PEEK-03). The peek panel is just a DOM sibling.
- Escape key dismiss is wired via `useHotkeys` at AppLayout level (or PeekPanel level). Since there is no focus trap, focus stays wherever it was when the peek opened. This is correct behavior for a non-modal panel.
- When peek closes via Escape, focus does not need to be restored to the triggering element (unlike a modal). The underlying view remains focused/interactive throughout.
- Screen reader: The peek panel is persistent DOM — `aria-live` or `role="complementary"` should be considered for accessibility, but this is not required for D-08 compliance. [ASSUMED: no specific a11y requirement for the peek panel beyond the WCAG cursor rules in DETAIL-02]

---

## Validation Architecture

Nyquist validation is ENABLED (config.json `workflow.nyquist_validation` absent → treated as true).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| PEEK-01 | Body click opens peek (peekIssueKey set) | unit | `vitest run src/components/app/PeekPanel.test.tsx` | Wave 0: create test file |
| PEEK-02 | Peek works for story, subtask, bug, epic | unit | same | Test that IssueDetailBody renders for each type |
| PEEK-03 | No focus trap, no backdrop | unit/smoke | `vitest run src/components/app/PeekPanel.test.tsx` | Assert no Dialog in DOM; assert underlying clickable elements still fire |
| PEEK-04 | Body click while peek open swaps key | unit | same | Assert peekIssueKey changes, no unmount/remount flash |
| PEEK-05 | Key click navigates full-page, no peek | unit | `vitest run src/routes/dashboard/TaskCard.test.tsx` | Wave 0: create test file; mock navigate |
| PEEK-06 | "Open full page" button navigates | unit | PeekPanel test | Assert navigate called with `/issue/:key` |
| PEEK-07 | Escape + X dismiss peek | unit | PeekPanel test | `fireEvent.keyDown(document, {key: 'Escape'})`; assert peekIssueKey null |
| DETAIL-01 | Parent breadcrumb above title, not in sidebar | unit | `vitest run src/routes/dashboard/IssueDetailContent.test.tsx` | Wave 0: create; assert ArrowUpRight + parent key visible above h2 for subtask issues |
| DETAIL-02 | All clickable areas have cursor-pointer | smoke/visual | `vitest run src/routes/dashboard/IssueDetailContent.test.tsx` | Assert `cursor-pointer` class on subtask buttons, epic story buttons |

**Manual-only checks** (not automatable without Tauri runtime):
- Drag divider resizes panel and persists width across app restart (requires Tauri Store)
- Underlying view fully interactive while peek open (requires real browser + layout)
- Route-change closes peek (requires react-router navigation in integration context)

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/components/app/PeekPanel.test.tsx` — covers PEEK-01, PEEK-02, PEEK-03, PEEK-04, PEEK-06, PEEK-07
- [ ] `taskflow/src/routes/dashboard/TaskCard.test.tsx` — covers PEEK-05 for TaskCard key click
- [ ] `taskflow/src/routes/dashboard/IssueDetailContent.test.tsx` — covers DETAIL-01, DETAIL-02

---

## Security Domain

This phase introduces no authentication, session management, access control, cryptography, or data validation concerns. All data flows through the existing `fetchIssueDetail` query which is already secured by PAT-based auth via `readSecret('jira-pat')`. No new API endpoints or data surfaces.

ASVS V5 Input Validation: The `peekIssueKey` value is derived from user clicks on existing issue keys already present in the DOM — no new user-supplied text input. Not applicable.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `issue.fields.parent` exists on `JiraIssueDetail` type (needed for DETAIL-01 parent breadcrumb in IssueDetailContent) | DETAIL-01 audit | If parent field is absent on the type, adding the breadcrumb requires a type update in `src/services/jira/types.ts` — adds a Wave 0 task |
| A2 | TaskCard outer `<button>` → `<div role="button">` is the right approach for key/body split (vs span-based key click) | Per-surface audit / Pattern section | If chosen wrong, interactive nesting issues may surface; planner must pick and document the approach |
| A3 | CommandPalette Escape priority: when both palette and peek are open, Escape closes palette first, then peek on second press | Pitfall 6 | If both fire simultaneously, both close at once — degraded UX. Needs explicit priority handling in implementation |
| A4 | IssueDetailBody (the peek content) does NOT include comments/timeline/worklogs — peek is a "preview" scope, not the full IssueDetailPage scope | IssueDetailBody Extraction section | If full fidelity (D-05) means comments must also appear in the peek, IssueDetailBody must be upgraded to include the Phase 75+ independent queries, significantly increasing scope |
| A5 | `min-h-0` is needed on the row-flex wrapper inside AppLayout to prevent flex overflow | Pattern 1 layout change | Without `min-h-0`, content may overflow the viewport in some browsers; harmless to include, risky to omit |
| A6 | Standup sub-components (TodayColumn, etc.) receive onIssueClick as a prop and will need onOpenIssue added alongside it — exact file/prop structure not read | Per-surface audit | Standup may have more surfaces needing the split than the 3 cited lines; requires deeper read before implementation |

---

## Open Questions (RESOLVED)

1. **IssueDetailBody content scope in the peek (A4)** — **RESOLVED**
   - What we know: `IssueDetailBody` (lines 62-154 of IssueDetailSheet.tsx) has `useQuery` for the base issue and epic stories. It does NOT have the comments, subtask enrichment, changelog, or worklogs queries that `IssueDetailPage` adds.
   - What's unclear: D-05 says "fully editable — comments, transitions, edit, add subtask". Does "comments" mean the comment composer must appear in the peek? If so, `IssueDetailBody` is insufficient and the peek content must be closer to `IssueDetailPage`'s scope.
   - **RESOLVED by orchestrator (D-05 override):** CONTEXT.md D-05 is a LOCKED decision and wins over the researcher's recommendation of option (a). The peek MUST render the full interactive detail INCLUDING comments/composer. Option (b) is chosen — but instead of bolting queries onto the thin `IssueDetailBody`, Plan 77-02 extracts a shared `IssueDetailView` from `IssueDetailPage` (carrying all Phase 75 independent queries: comments, subtask enrichment, changelog, worklogs, plus the comment/worklog mutations and `CommentComposer`) with a `layout: 'two-column' | 'single-column'` prop. The peek renders it single-column (D-06); `IssueDetailPage` renders it two-column. See Plan 77-02 objective.

2. **`issue.fields.parent` type coverage** — **RESOLVED**
   - What we know: `FieldsSection.tsx` accesses `f.parent?.key` and `f.parent?.fields.summary` where `f = issue.fields`. This field access works today in the sidebar.
   - What's unclear: Whether `parent` is declared on the `JiraIssueDetail` type vs accessed via a dynamic index.
   - **RESOLVED during planning:** `JiraIssueDetail.fields.parent` is already declared at `taskflow/src/services/jira/types.ts:152`. Plan 77-01 Task 1 confirms this only — no type change is required for DETAIL-01.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `taskflow/src/main.tsx` lines 336-425 (handleIssueClick), 512-594 (AppLayout return), 555-563 (Outlet context)
- Direct code read: `taskflow/src/routes/dashboard/IssueDetailSheet.tsx` (full file) — `IssueDetailBody`, `IssueDetailSkeleton`
- Direct code read: `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (lines 1-400) — subtaskListContent, title block, prop interface
- Direct code read: `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (full file) — `useResizable` usage, `onOpenIssue` wiring, sidebar layout
- Direct code read: `taskflow/src/stores/settings.store.ts` (full file) — version 25, rankFieldKey migration pattern, all panel width fields
- Direct code read: `taskflow/src/hooks/useResizable.ts` (full file) — `direction: 'left'`, stale-closure pattern, store hydration sync
- Direct code read: `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` (lines 620-680) — parent MetaRow at line 641-653
- Direct code read: `taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx` (full file) — `cursor-pointer` confirmed present
- Direct code read: `taskflow/src/routes/dashboard/TaskCard.tsx` (lines 60-145) — single-button structure
- Direct code read: `taskflow/src/routes/dashboard/BacklogRow.tsx` (lines 70-240) — key cell, row click, stopPropagation pattern
- Direct code read: `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` (lines 125-185) — button structure
- Direct code read: `taskflow/src/routes/notifications/NotificationPopover.tsx` + `NotificationRow.tsx` — single-button structure, onIssueClick prop path
- Direct code read: `taskflow/src/components/app/CommandPalette.tsx` (lines 45-183) — onIssueClick prop, handleIssueSelect
- Direct code read: `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` (via grep) — useOutletContext usage at line 113
- Direct code read: `.planning/phases/77-universal-peek-slideover-and-issue-detail-refinements/77-CONTEXT.md` — all locked decisions
- Direct code read: `.planning/phases/77-universal-peek-slideover-and-issue-detail-refinements/77-UI-SPEC.md` — spacing, typography, color, component inventory

### Secondary (MEDIUM confidence)
- `taskflow/.planning/config.json` — `workflow.nyquist_validation` absent → treated as enabled [VERIFIED]
- `taskflow/vitest.config.ts` — test environment jsdom, setupFiles, globals [VERIFIED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing; verified by code read
- Architecture patterns: HIGH — all patterns derived directly from existing code reads (useResizable, settings store migration, Outlet context)
- Per-surface click audit: HIGH — verified each surface file directly
- Pitfalls: MEDIUM — derived from code structure + known React patterns; some edge cases (A2, A3) are ASSUMED
- Assumptions: see Assumptions Log — 6 items, all LOW-MEDIUM risk

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable codebase; fast-moving only if Phase 78/79 land before planning completes)
