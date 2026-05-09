# Phase 50: Draggable Sidebar Resize - Research

**Researched:** 2026-05-09
**Domain:** React mouse-event resize handle pattern, Zustand persist store versioning, Tailwind inline-style layout
**Confidence:** HIGH

## Summary

Phase 50 adds drag-to-resize behaviour to four distinct sidebars: the main navigation sidebar (managed by `Sidebar.tsx` + `AppLayout`), and three detail-page right panels (Issue, MR, Release). All widths persist to the Zustand settings store via the existing Tauri plugin-store adapter. No external library is needed.

The implementation is purely in-tree. Every canonical file has been read; all layout structures, class names, store shape, and migration pattern are confirmed. The drag handle pattern (mousedown + document mousemove/mouseup) is a zero-dependency approach that matches what is already done in the codebase for similar interactive concerns. The main risk area is cursor stability during fast mouse moves, which is solved by clamping `cursor: ew-resize` on `<html>` during drag.

Width values must be applied as `style={{ width: '${px}px' }}` inline styles rather than Tailwind classes because Tailwind cannot generate arbitrary runtime values. `shrink-0` must be preserved on every resizable element so flex-shrink does not fight the inline width.

**Primary recommendation:** Implement a shared `useResizable` hook that encodes the mousedown/mousemove/mouseup pattern and the bounds clamping logic. Use it in Sidebar.tsx, IssueDetailPage.tsx, MergeRequestDetailPage.tsx, and ReleaseDetailPage.tsx. Wire all persistence through `useSettingsStore` at store version 14.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Collapse toggle and drag-resize are independent. Dragging sets the expanded width; the collapse toggle (Cmd+B / chevron button) still collapses to 64px. Uncollapsing restores the last drag-set width.
- **D-02:** The drag handle is only present (and the edge is only draggable) when the sidebar is in expanded mode. No drag affordance in collapsed (icon-only) state.
- **D-03:** All three detail pages get drag-to-resize: Issue detail, MR detail, and Release detail. Each has its own independently persisted width (three separate storage keys).

### Claude's Discretion
- **Drag handle visual:** Resize cursor (`ew-resize`) on hover over the border zone, plus a subtle border highlight (border-color change). No permanent visible element. Matches the app's clean, minimal aesthetic.
- **Main nav sidebar bounds:** 160px minimum / 320px maximum. 160px keeps nav labels and icons readable; 320px is the natural upper bound before the sidebar dominates the screen.
- **Detail panel bounds:** 240px minimum / 50% of the container width maximum. 240px keeps form fields and metadata readable; 50% cap ensures the main content area is never squeezed below half.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag handle mouse events | Browser / Client | — | Pure DOM event handling; no server involvement |
| Width state during drag | Browser / Client (local useState) | — | Transient; only committed to store on mouseup |
| Width persistence | Frontend (Zustand + Tauri store) | — | Already established pattern in settings.store.ts |
| Visual drag affordance (cursor + border) | Browser / Client (CSS) | — | CSS cursor and transition-color on hover |
| Sidebar collapse/expand coexistence | Browser / Client | — | sidebarCollapsed flag in existing store gate |

---

## Standard Stack

### Core (verified from codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (in use) | `useState`, `useRef`, `useEffect` for drag logic | Already the app framework [VERIFIED: codebase] |
| Zustand (persist) | in use | `useSettingsStore` — add 4 width fields | Established settings pattern; version migration already in place [VERIFIED: settings.store.ts] |
| Tailwind CSS | in use | Static layout classes (flex, overflow, shrink-0) | App-wide utility CSS [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native DOM events | — | mousedown, mousemove, mouseup on `document` | Drag detection without external dependency [VERIFIED: CONTEXT.md decision] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native mouse events | `react-resizable-panels` or `react-split-pane` | External libs add bundle weight + their own opinions on markup. Phase decision is no library. |
| `useSettingsStore` | Separate localStorage key | Store already owns layout state; adding a parallel persistence path would fragment the migration story |

**Installation:** No new packages required. [VERIFIED: CONTEXT.md, codebase]

---

## Architecture Patterns

### System Architecture Diagram

```
User mousedown on drag handle div
        │
        ▼
useResizable hook — captures startX + startWidth
        │  registers document mousemove + mouseup
        ▼
document mousemove → compute newWidth = clamp(startWidth + delta, min, max)
        │  → setState(localWidth) — drives style={{ width }}
        ▼
document mouseup → setState(isDragging=false)
        │  → store.setXxxWidth(localWidth) — persists to Tauri store
        ▼
Zustand persist → Tauri plugin-store → settings.json on disk
        │
        ▼
Next app launch → useSettingsStore hydrates → width restored from store
```

**Cursor stability:** On drag start, set `document.documentElement.style.cursor = 'ew-resize'`. On mouseup, clear it. This prevents cursor flicker when the mouse moves faster than the element boundary.

### Recommended Project Structure

```
taskflow/src/
├── hooks/
│   └── useResizable.ts          # NEW — shared drag-resize logic
├── components/app/
│   └── Sidebar.tsx              # MODIFIED — use useResizable for left nav
├── stores/
│   └── settings.store.ts        # MODIFIED — add 4 width fields, bump to v14
├── routes/dashboard/
│   ├── IssueDetailPage.tsx      # MODIFIED — use useResizable for right panel
│   ├── MergeRequestDetailPage.tsx # MODIFIED — use useResizable for right panel
│   └── ReleaseDetailPage.tsx    # MODIFIED — use useResizable for right panel
```

### Pattern 1: useResizable Hook

**What:** Encapsulates mousedown handler, document-level mousemove/mouseup cleanup, bounds clamping, and cursor lock.
**When to use:** Every drag handle in the app.

```typescript
// Source: standard React mouse-event resize pattern (no library)
interface UseResizableOptions {
  initialWidth: number;
  min: number;
  max: number | (() => number);   // max can be dynamic (50% of container)
  onCommit: (width: number) => void;
}

function useResizable({ initialWidth, min, max, onCommit }: UseResizableOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, width };
    setIsDragging(true);
    document.documentElement.style.cursor = 'ew-resize';
    document.documentElement.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    function onMouseMove(e: MouseEvent) {
      if (!startRef.current) return;
      const delta = e.clientX - startRef.current.x;
      const maxVal = typeof max === 'function' ? max() : max;
      const next = Math.min(maxVal, Math.max(min, startRef.current.width + delta));
      setWidth(next);
    }
    function onMouseUp() {
      setIsDragging(false);
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
      if (startRef.current) onCommit(width);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, min, max, onCommit, width]);

  return { width, isDragging, handleMouseDown };
}
```

> Note: the `width` captured in `onMouseUp` via the closure will be stale if `onCommit` depends on the current width at mouseup time. Use a `useRef` to track the latest width and read from it in `onMouseUp`. See Pitfall 3.

### Pattern 2: Drag Handle Div (Main Nav Sidebar)

**What:** A thin absolutely-positioned div along the right edge of `<aside>`. Conditionally rendered only when `!sidebarCollapsed`.

```tsx
// Source: 50-CONTEXT.md, 50-UI-SPEC.md
{!sidebarCollapsed && (
  <div
    aria-hidden="true"
    onMouseDown={handleMouseDown}
    className={`
      absolute right-0 top-0 h-full w-2
      cursor-ew-resize z-20
      border-r border-border
      transition-colors duration-100
    `}
    style={{
      borderColor: isDragging ? 'var(--ring)' : undefined,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ring)';
    }}
    onMouseLeave={(e) => {
      if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = '';
    }}
  />
)}
```

### Pattern 3: Applying Dynamic Width (Sidebar `<aside>`)

**What:** Replace Tailwind width classes with inline `style` for the resizable dimension. Keep `shrink-0` as a class.

```tsx
// Source: CONTEXT.md — "Established Patterns"
<aside
  className={`relative flex flex-col h-full border-r border-border bg-background shrink-0 transition-all duration-200`}
  style={{ width: sidebarCollapsed ? 64 : width }}
>
```

The `w-16 md:w-56` Tailwind classes that currently set width are removed; `shrink-0` remains.

### Pattern 4: Detail Page Right Panel

**What:** Replace the hardcoded `w-[42%]` (Issue) or `w-72` (MR, Release) with an inline style. Add a drag handle div on the LEFT border of the right panel.

```tsx
// Source: IssueDetailPage.tsx line 420; MergeRequestDetailPage.tsx line 263; ReleaseDetailPage.tsx line 756
<div
  className="relative border-l overflow-auto p-4 shrink-0"
  style={{ width: panelWidth }}
>
  {/* Drag handle on left edge */}
  <div
    aria-hidden="true"
    onMouseDown={handleMouseDown}
    className="absolute left-0 top-0 h-full w-2 cursor-ew-resize z-20 border-l border-border transition-colors duration-100"
    ...
  />
  {/* existing content */}
</div>
```

### Pattern 5: Store Version Bump + Migration

**What:** Increment `settings.store.ts` `version` from 13 → 14. Add migration guard for new fields.

```typescript
// Source: settings.store.ts — existing migration pattern
if (version < 14) {
  if (s.sidebarWidth === undefined) s.sidebarWidth = 224;
  if (s.issueDetailPanelWidth === undefined) s.issueDetailPanelWidth = null;
  if (s.mrDetailPanelWidth === undefined) s.mrDetailPanelWidth = 288;
  if (s.releaseDetailPanelWidth === undefined) s.releaseDetailPanelWidth = 288;
}
```

State interface additions:
```typescript
/** User-dragged main navigation sidebar width in px. Default: 224 (md:w-56). */
sidebarWidth: number;
setSidebarWidth: (w: number) => void;
/** Issue detail right panel width in px. Null = use 42% of container. */
issueDetailPanelWidth: number | null;
setIssueDetailPanelWidth: (w: number) => void;
/** MR detail right panel width in px. Default: 288 (w-72). */
mrDetailPanelWidth: number;
setMrDetailPanelWidth: (w: number) => void;
/** Release detail right panel width in px. Default: 288 (w-72). */
releaseDetailPanelWidth: number;
setReleaseDetailPanelWidth: (w: number) => void;
```

### Anti-Patterns to Avoid

- **Using Tailwind width classes for resizable elements:** Tailwind generates static classes; `w-[224px]` cannot be driven from a runtime variable. Use `style={{ width }}` instead.
- **Adding event listeners directly in JSX without cleanup:** Always add/remove document-level mousemove and mouseup inside a `useEffect` with a cleanup function.
- **Setting cursor only on the handle element:** During fast drags the cursor leaves the handle. Set `document.documentElement.style.cursor` on drag start and clear on mouseup.
- **Reading `width` state in the mouseup handler closure directly:** The closure captures the value at registration time (stale). Use a ref that tracks the live width.
- **Rendering the drag handle when sidebar is collapsed:** D-02 — no drag affordance in icon-only mode.
- **Removing `shrink-0` from the sidebar `<aside>`:** Without it the flex parent can shrink the sidebar during a drag, causing jank.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistence | Custom localStorage hooks | `useSettingsStore` (Zustand persist + Tauri adapter) | Already handles serialization, hydration, versioning, and Tauri file-write |
| Cursor stability | Per-element cursor CSS | Set `document.documentElement.style.cursor` | Only the root element guarantees cursor is maintained during fast mouse moves across element boundaries |
| Width clamping | Ad hoc Math.max/min scattered inline | Centralize in `useResizable` hook | Ensures all four sidebars enforce bounds consistently |

**Key insight:** The only custom code needed is the hook and the JSX additions. There is no pagination, no async fetch, no layout engine — just pointer arithmetic and state.

---

## Runtime State Inventory

This is a greenfield interactive feature (no rename/refactor). No runtime state migration is required.

**Stored data:** None — new store fields are added with defaults via migration v14. Existing persisted data is not modified.
**Live service config:** None.
**OS-registered state:** None.
**Secrets/env vars:** None.
**Build artifacts:** None — pure source change, no installed package rename.

---

## Common Pitfalls

### Pitfall 1: Stale Width in mouseup Closure
**What goes wrong:** `onCommit(width)` in the mouseup handler captures the `width` value from when the event listener was registered, not the current value at mouseup time.
**Why it happens:** JavaScript closures capture by reference for primitives via stale closure over `useState` value.
**How to avoid:** Track latest width in a `widthRef = useRef(width)` that is updated on every render, and call `onCommit(widthRef.current)` in the mouseup handler.
**Warning signs:** Committing a width to the store that is not the final drag position; the sidebar jumps on next mount.

### Pitfall 2: Cursor Flicker During Fast Drags
**What goes wrong:** The mouse moves faster than the re-render; it leaves the drag handle div; the browser resets the cursor to default.
**Why it happens:** `cursor: ew-resize` set only on the handle element applies only while the pointer is over that element.
**How to avoid:** On mousedown, set `document.documentElement.style.cursor = 'ew-resize'`. Clear it on mouseup.
**Warning signs:** Cursor blinks to arrow during fast horizontal drags.

### Pitfall 3: Text Selection During Drag
**What goes wrong:** Browser selects sidebar nav link text while dragging.
**Why it happens:** Default browser selection on mousemove.
**How to avoid:** Set `document.documentElement.style.userSelect = 'none'` on mousedown; clear on mouseup.
**Warning signs:** Text appears highlighted after a drag ends.

### Pitfall 4: `shrink-0` Absent on Sidebar
**What goes wrong:** The flex parent shrinks the sidebar as the user drags it narrower, creating a double-shrink effect.
**Why it happens:** Without `shrink-0`, the sidebar participates in flex shrinking as well as the explicit width drive.
**How to avoid:** Keep `shrink-0` as a Tailwind class on `<aside>` and the right panel `<div>` at all times.
**Warning signs:** Sidebar visibly collapses faster than the drag position suggests.

### Pitfall 5: Collapse Toggle Width Regression
**What goes wrong:** After implementing inline style width, the collapse toggle breaks (sidebar remains at dragged width even when `sidebarCollapsed` is true).
**Why it happens:** The inline `style={{ width }}` overrides the old Tailwind `w-16` collapsed class.
**How to avoid:** Conditionally drive width from state: `style={{ width: sidebarCollapsed ? 64 : sidebarWidth }}`. Do not use Tailwind classes for either collapsed or expanded width.
**Warning signs:** Sidebar shows labels/content when toggled to collapsed.

### Pitfall 6: 50%-max Computed at Wrong Time
**What goes wrong:** The 50% max for detail panels is computed from the container width, but the container ref has zero width on first mount.
**Why it happens:** `ref.current` is null or has `offsetWidth: 0` before the component's first paint.
**How to avoid:** Compute max inside the `mousemove` handler using `containerRef.current?.offsetWidth ?? Infinity`. If zero, fall back to `Infinity` (effectively no upper bound) rather than clamping to 0.
**Warning signs:** On the first drag, the panel collapses to its minimum width immediately.

---

## Code Examples

### Issue Detail Right Panel Width — Current vs New

```tsx
// CURRENT (IssueDetailPage.tsx line 420)
<div className="w-[42%] border-l overflow-auto p-4 shrink-0">

// NEW — driven by store (null falls back to "42% of container computed at drag time")
const containerRef = useRef<HTMLDivElement>(null);
const storedWidth = useSettingsStore((s) => s.issueDetailPanelWidth);
const setStoredWidth = useSettingsStore((s) => s.setIssueDetailPanelWidth);

// Derive initial width: if null, compute 42% of container at first drag
const initialWidth = storedWidth ?? null;

const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: initialWidth ?? 400, // placeholder; overridden below when null
  min: 240,
  max: () => (containerRef.current?.offsetWidth ?? 800) * 0.5,
  onCommit: setStoredWidth,
});

// In JSX:
<div ref={containerRef} className="flex flex-1 overflow-hidden">
  <div className="flex-1 overflow-auto">...</div>
  <div
    className="relative border-l overflow-auto p-4 shrink-0"
    style={{ width: storedWidth !== null ? width : '42%' }}
  >
    ...
  </div>
</div>
```

> The `issueDetailPanelWidth = null` default means "use 42% until the user first drags". After the first drag, the numeric px value is persisted and used going forward.

### Sidebar Width — Current vs New

```tsx
// CURRENT (Sidebar.tsx line 195)
<aside className={`... ${sidebarCollapsed ? 'w-16' : 'w-16 md:w-56'} ... shrink-0 transition-all duration-200`}>

// NEW
const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);   // default 224
const setSidebarWidth = useSettingsStore((s) => s.setSidebarWidth);
const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);

const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: sidebarWidth,
  min: 160,
  max: 320,
  onCommit: setSidebarWidth,
});

<aside
  className="relative flex flex-col h-full border-r border-border bg-background shrink-0 transition-all duration-200"
  style={{ width: sidebarCollapsed ? 64 : width }}
>
  {!sidebarCollapsed && (
    <div
      aria-hidden="true"
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-20"
    />
  )}
  ...
</aside>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External resize library (react-resizable-panels) | Native mousedown/mousemove/mouseup | Phase 50 decision | No new dependency; consistent with app philosophy |
| Tailwind width classes for layout | Inline `style={{ width }}` for dynamic user-controlled widths | Phase 50 (first use in project) | Must be applied carefully — only for resizable elements |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `issueDetailPanelWidth: null` as initial store value is valid TypeScript for the `SettingsState` interface | Standard Stack / Pattern 5 | Type error at compile time; must use `number \| null` in interface |
| A2 | `document.documentElement.style.userSelect` suppresses text selection during drag cross-browser in the Tauri WebView (Chromium) | Pitfall 3 | Alternative: add `select-none` class to body on drag start/end |
| A3 | `transition-all duration-200` on `<aside>` does not cause jank during drag (transitions fire on class changes, not style attribute changes) | Architecture Patterns | If Chromium transitions `style.width` changes too, drag will feel laggy; solution is to conditionally remove the transition class while `isDragging` is true |

**Note on A3:** This is the most impactful assumption. Recommend the planner include a task step: remove `transition-all duration-200` from the `<aside>` (or disable it via conditional class) while `isDragging` is true. The transition is valuable for the collapse animation but fights smooth drag feedback. [ASSUMED]

---

## Open Questions (RESOLVED)

1. **IssueDetailPage `issueDetailPanelWidth = null` → first-drag width**
   - What we know: When `null`, the panel currently renders at `w-[42%]`. We need a numeric px value to initialize `useResizable`. The natural approach is to read `containerRef.current.offsetWidth * 0.42` at mousedown time.
   - What's unclear: If the container has not yet mounted or is zero-width on first mousedown, the initial width will be wrong.
   - **RESOLVED:** On mousedown, compute initial width as `Math.max(240, containerRef.current?.offsetWidth * 0.42 ?? 400)`. Use this only when `storedWidth` is null. Plans 03 implements this via `issueDetailPanelWidth ?? 400` initialWidth with `storedWidth !== null ? width : '42%'` style fallback.

2. **Transition class on `<aside>` during drag (A3)**
   - What we know: The existing `transition-all duration-200` makes the collapse/expand animate smoothly.
   - What's unclear: Whether Chromium applies this transition to `style.width` changes caused by drag.
   - **RESOLVED:** Conditionally apply `transition-all duration-200` only when `!isDragging`. Use `isDragging` from `useResizable` as a gate: `className={... isDragging ? '' : 'transition-all duration-200'}`. Plans 02 and 03 both implement this guard.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely source code changes. No external CLI tools, databases, or services are required beyond what already runs in the existing dev environment.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Main nav sidebar drag-to-resize | Manual (mouse event in jsdom is limited) | `npm test -- --reporter=verbose` | N/A |
| SC-2 | Detail pages drag-to-resize | Manual | — | N/A |
| SC-3 | Cursor change / handle visibility | Manual | — | N/A |
| SC-4 | Width persisted and restored | Unit | `npm test -- src/stores/settings.store.test.ts` | ✅ exists (add to it) |
| SC-5 | Smooth resize, no jank | Manual | — | N/A |

**Store unit test additions (Wave 0):**
- Add to `settings.store.test.ts`: verify `sidebarWidth`, `issueDetailPanelWidth`, `mrDetailPanelWidth`, `releaseDetailPanelWidth` defaults; verify setters; verify migration guard at version 14.

### Sampling Rate
- **Per task commit:** `cd taskflow && npm test`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test cases in `taskflow/src/stores/settings.store.test.ts` — covers SC-4 (width fields defaults + setters + v14 migration)
- [ ] `taskflow/src/hooks/useResizable.ts` — new file (no test required; hook logic is integration-tested via manual drag)

*(Framework and config already present — no new test infrastructure setup needed)*

---

## Security Domain

No authentication, authorization, input validation, cryptography, or sensitive data is involved in this phase. Width values are numeric, user-controlled, clamped to bounds in `useResizable`, and stored only in local app storage. ASVS does not apply.

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/components/app/Sidebar.tsx` — current layout, class names, collapse pattern [VERIFIED: read in session]
- `taskflow/src/stores/settings.store.ts` — store shape, version 13, migration pattern [VERIFIED: read in session]
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — right panel `w-[42%]`, layout structure [VERIFIED: read in session]
- `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` — right panel `w-72`, layout structure [VERIFIED: read in session]
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — right panel `w-[42%]`, layout structure [VERIFIED: read in session]
- `taskflow/src/main.tsx` (line 469+) — AppLayout flex container [VERIFIED: read in session]
- `.planning/phases/50-draggable-sidebar-resize/50-CONTEXT.md` — locked decisions D-01–D-05 [VERIFIED: read in session]
- `.planning/phases/50-draggable-sidebar-resize/50-UI-SPEC.md` — interaction contract, color tokens, defaults [VERIFIED: read in session]
- `taskflow/vitest.config.ts` + `package.json` test scripts [VERIFIED: read in session]

### Secondary (MEDIUM confidence)
- Standard mousedown/mousemove/mouseup resize handle pattern — well-established browser DOM pattern; no single authoritative URL required [ASSUMED — very low risk, this is fundamental browser API]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in-codebase
- Architecture: HIGH — all source files read, exact class names and layout structures confirmed
- Pitfalls: HIGH for DOM cursor/selection issues (common knowledge), MEDIUM for A3 (transition during drag — needs runtime verification)

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable UI codebase; no fast-moving dependencies)
