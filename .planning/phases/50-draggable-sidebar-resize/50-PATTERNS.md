# Phase 50: Draggable Sidebar Resize - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 7 (1 new, 5 modified, 1 extended test)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `taskflow/src/hooks/useResizable.ts` | hook | event-driven | `taskflow/src/hooks/useDelayedLoading.ts` | role-match |
| `taskflow/src/components/app/Sidebar.tsx` | component | event-driven | `taskflow/src/components/app/Sidebar.tsx` (self — modify) | exact |
| `taskflow/src/stores/settings.store.ts` | store | CRUD | `taskflow/src/stores/settings.store.ts` (self — extend) | exact |
| `taskflow/src/routes/dashboard/IssueDetailPage.tsx` | component | request-response | `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` | role-match |
| `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` | component | request-response | `taskflow/src/routes/dashboard/IssueDetailPage.tsx` | role-match |
| `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` | component | request-response | `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` | role-match |
| `taskflow/src/stores/settings.store.test.ts` | test | — | `taskflow/src/stores/settings.store.test.ts` (self — extend) | exact |

---

## Pattern Assignments

### `taskflow/src/hooks/useResizable.ts` (hook, event-driven) — NEW

**Analog:** `taskflow/src/hooks/useDelayedLoading.ts`

This file does not exist yet. The analog provides the hook file structure convention for this project.

**Imports pattern** (`useDelayedLoading.ts` lines 1–1):
```typescript
import { useEffect, useRef, useState } from 'react';
```
The new hook uses the same three React primitives. Add `useCallback` if the handleMouseDown is to be memoized.

**Hook structure pattern** (`useDelayedLoading.ts` lines 11–28):
```typescript
// Named export (not default), accepts typed options object, returns derived values
export function useDelayedLoading(isPending: boolean, delayMs = 200): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // register side effect
    return () => {
      // cleanup — always provided
    };
  }, [isPending, delayMs]);

  return showSkeleton;
}
```

**Document-level event listener + cleanup pattern** (`IssueDetailPage.tsx` lines 479–487):
```typescript
// Pattern already in use in the codebase for mousedown-based outside-click detection.
// useResizable follows the same addEventListener / removeEventListener in useEffect cleanup.
useEffect(() => {
  function handleClick(e: MouseEvent) {
    // ...
  }
  document.addEventListener('mousedown', handleClick);
  return () => document.removeEventListener('mousedown', handleClick);
}, [/* deps */]);
```

**Core hook shape to implement** (from RESEARCH.md Pattern 1 — authoritative, no in-tree analog):
```typescript
interface UseResizableOptions {
  initialWidth: number;
  min: number;
  max: number | (() => number); // dynamic max for 50%-of-container case
  onCommit: (width: number) => void;
}

export function useResizable({ initialWidth, min, max, onCommit }: UseResizableOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  // Track live width in a ref to avoid stale closure in mouseup handler (Pitfall 1)
  const widthRef = useRef(width);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, width };
    setIsDragging(true);
    document.documentElement.style.cursor = 'ew-resize';
    document.documentElement.style.userSelect = 'none';
  };

  useEffect(() => {
    widthRef.current = width; // keep ref in sync on every render
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
      onCommit(widthRef.current); // read from ref, not stale closure (Pitfall 1)
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, min, max, onCommit]);

  return { width, isDragging, handleMouseDown };
}
```

**JSDoc comment style** (`useDelayedLoading.ts` lines 3–10):
```typescript
/**
 * One-line summary.
 *
 * @param foo — what it is
 * @param bar — what it is
 */
```

---

### `taskflow/src/components/app/Sidebar.tsx` (component, event-driven) — MODIFIED

**Analog:** Self — file already exists; pattern is extracted from it directly.

**Current store selector pattern** (`Sidebar.tsx` lines 63–66):
```typescript
// One selector per value. Do NOT destructure the whole store object.
const { devToolsEnabled, sidebarItems } = useSettingsStore();
const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
```
Add `sidebarWidth` and `setSidebarWidth` following the same selector pattern.

**Current `<aside>` with hardcoded Tailwind width** (`Sidebar.tsx` line 195 — the line to replace):
```tsx
<aside
  className={`relative flex flex-col h-full ${sidebarCollapsed ? 'w-16' : 'w-16 md:w-56'} border-r border-border bg-background shrink-0 transition-all duration-200`}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
>
```

**New `<aside>` pattern after modification** (remove `w-16`/`w-16 md:w-56` classes; drive width via inline style; conditionally suppress transition during drag):
```tsx
<aside
  className={`relative flex flex-col h-full border-r border-border bg-background shrink-0 ${isDragging ? '' : 'transition-all duration-200'}`}
  style={{ width: sidebarCollapsed ? 64 : width }}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
>
```
Keep `shrink-0` — removing it causes Pitfall 4 (double-shrink during drag).

**Hover chevron toggle button position** (`Sidebar.tsx` lines 200–211):
```tsx
// The hover chevron is at absolute -right-3 top-1/2. The drag handle div will also
// be positioned absolute right-0. z-index on the chevron button is z-10.
// Drag handle must use z-20 to stay above it (or right-0 with w-2 that doesn't overlap -right-3).
<button
  type="button"
  onClick={toggleSidebarCollapsed}
  className={`absolute -right-3 top-1/2 -translate-y-1/2 z-10 ...`}
>
```

**Drag handle div to insert (conditionally rendered, expanded-only per D-02):**
```tsx
{!sidebarCollapsed && (
  <div
    aria-hidden="true"
    onMouseDown={handleMouseDown}
    className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-20 border-r border-border transition-colors duration-100"
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ring)';
    }}
    onMouseLeave={(e) => {
      if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = '';
    }}
    style={{ borderColor: isDragging ? 'var(--ring)' : undefined }}
  />
)}
```

---

### `taskflow/src/stores/settings.store.ts` (store, CRUD) — MODIFIED

**Analog:** Self — file already exists; pattern is extracted from it directly.

**Interface field declaration pattern** (`settings.store.ts` lines 100–103):
```typescript
// Field: JSDoc comment on the line above, then field, then setter
/** Whether the sidebar is collapsed to icon-only mode. Default: false. */
sidebarCollapsed: boolean;
toggleSidebarCollapsed: () => void;
```
New fields follow the same style:
```typescript
/** User-dragged main navigation sidebar width in px. Default: 224 (md:w-56 = 14rem). */
sidebarWidth: number;
setSidebarWidth: (w: number) => void;
/** Issue detail right panel width in px. Null = use 42% of container until first drag. */
issueDetailPanelWidth: number | null;
setIssueDetailPanelWidth: (w: number) => void;
/** MR detail right panel width in px. Default: 288 (w-72). */
mrDetailPanelWidth: number;
setMrDetailPanelWidth: (w: number) => void;
/** Release detail right panel width in px. Default: 288 (w-72). */
releaseDetailPanelWidth: number;
setReleaseDetailPanelWidth: (w: number) => void;
```

**Simple setter pattern** (`settings.store.ts` line 204):
```typescript
toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
// Scalar setters use the simple form:
setSidebarWidth: (w) => set({ sidebarWidth: w }),
setIssueDetailPanelWidth: (w) => set({ issueDetailPanelWidth: w }),
setMrDetailPanelWidth: (w) => set({ mrDetailPanelWidth: w }),
setReleaseDetailPanelWidth: (w) => set({ releaseDetailPanelWidth: w }),
```

**Migration block pattern** (`settings.store.ts` lines 362–396):
```typescript
// Each version guard is a standalone `if (version < N)` block.
// Guards use `=== undefined` checks to preserve existing user values.
if (version < 6) {
  if (s.sidebarCollapsed === undefined) s.sidebarCollapsed = false;
}
// ...
if (version < 13) {
  if (s.jiraConcurrencyLimit === undefined) s.jiraConcurrencyLimit = 6;
}
return persisted as SettingsState;
```
New v14 block goes immediately before the `return`:
```typescript
if (version < 14) {
  if (s.sidebarWidth === undefined) s.sidebarWidth = 224;
  if (s.issueDetailPanelWidth === undefined) s.issueDetailPanelWidth = null;
  if (s.mrDetailPanelWidth === undefined) s.mrDetailPanelWidth = 288;
  if (s.releaseDetailPanelWidth === undefined) s.releaseDetailPanelWidth = 288;
}
```
Also increment `version: 13` → `version: 14` at `settings.store.ts` line 336.

---

### `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (component, request-response) — MODIFIED

**Analog:** `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx`

**Current imports** (`IssueDetailPage.tsx` line 14):
```typescript
import { useEffect, useRef, useState } from 'react';
```
No new React imports needed — `useRef` and `useState` already imported.

**Current two-column flex layout** (`IssueDetailPage.tsx` lines 353–420):
```tsx
<div className="flex flex-1 overflow-hidden">
  {/* Left column: scrollable content */}
  <div className="flex-1 overflow-auto">
    {/* ... */}
  </div>

  {/* Right sidebar */}
  <div className="w-[42%] border-l overflow-auto p-4 shrink-0">
    {/* IssueDetailSidebar content */}
  </div>
</div>
```

**Modification target** — the right panel `<div>` at line 420:
```tsx
// BEFORE:
<div className="w-[42%] border-l overflow-auto p-4 shrink-0">

// AFTER (replace Tailwind width class with inline style + add relative + drag handle):
<div
  className="relative border-l overflow-auto p-4 shrink-0"
  style={{ width: issueDetailPanelWidth !== null ? width : '42%' }}
>
  <div
    aria-hidden="true"
    onMouseDown={handleMouseDown}
    className="absolute left-0 top-0 h-full w-2 cursor-ew-resize z-20 border-l border-border transition-colors duration-100"
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ring)';
    }}
    onMouseLeave={(e) => {
      if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = '';
    }}
    style={{ borderColor: isDragging ? 'var(--ring)' : undefined }}
  />
  {/* existing IssueDetailSidebar content unchanged */}
```

**Container ref** — the outer `flex flex-1 overflow-hidden` div at line 353 needs a ref:
```tsx
const containerRef = useRef<HTMLDivElement>(null);
// ...
<div ref={containerRef} className="flex flex-1 overflow-hidden">
```

**Store wiring**:
```typescript
const issueDetailPanelWidth = useSettingsStore((s) => s.issueDetailPanelWidth);
const setIssueDetailPanelWidth = useSettingsStore((s) => s.setIssueDetailPanelWidth);

const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: issueDetailPanelWidth ?? 400, // 400 = placeholder; style falls back to '42%' when null
  min: 240,
  max: () => (containerRef.current?.offsetWidth ?? 800) * 0.5,
  onCommit: setIssueDetailPanelWidth,
});
```

---

### `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` (component, request-response) — MODIFIED

**Analog:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx`

**Current right panel** (`MergeRequestDetailPage.tsx` lines 262–263):
```tsx
{/* Right sidebar — narrowed to w-72 (288px) from w-[42%] */}
<div className="w-72 border-l overflow-auto p-4 shrink-0">
```

**Modification target** — same pattern as IssueDetailPage but simpler: no null-fallback (store default is numeric 288):
```tsx
const containerRef = useRef<HTMLDivElement>(null);
const mrDetailPanelWidth = useSettingsStore((s) => s.mrDetailPanelWidth);
const setMrDetailPanelWidth = useSettingsStore((s) => s.setMrDetailPanelWidth);

const { width, isDragging, handleMouseDown } = useResizable({
  initialWidth: mrDetailPanelWidth,
  min: 240,
  max: () => (containerRef.current?.offsetWidth ?? 800) * 0.5,
  onCommit: setMrDetailPanelWidth,
});
```

**Two-column flex container** (`MergeRequestDetailPage.tsx` line 191):
```tsx
// Add ref here:
<div ref={containerRef} className="flex flex-1 overflow-hidden">
```

**Right panel after modification**:
```tsx
<div
  className="relative border-l overflow-auto p-4 shrink-0"
  style={{ width }}
>
  <div
    aria-hidden="true"
    onMouseDown={handleMouseDown}
    className="absolute left-0 top-0 h-full w-2 cursor-ew-resize z-20 border-l border-border transition-colors duration-100"
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--ring)';
    }}
    onMouseLeave={(e) => {
      if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = '';
    }}
    style={{ borderColor: isDragging ? 'var(--ring)' : undefined }}
  />
  {/* existing content unchanged */}
```

---

### `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` (component, request-response) — MODIFIED

**Analog:** `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx`

**Current right panel** (`ReleaseDetailPage.tsx` line 756):
```tsx
{/* Right sidebar */}
<div className="w-[42%] border-l overflow-auto p-4 shrink-0">
```
Note: ReleaseDetailPage uses `w-[42%]` like IssueDetailPage, but the store default for `releaseDetailPanelWidth` is 288 (not null), so no null-fallback needed. Width switches to numeric immediately on first store hydration.

**Modification pattern** — identical to `MergeRequestDetailPage.tsx` above, substituting `releaseDetailPanelWidth` / `setReleaseDetailPanelWidth` as store selectors.

**Two-column container** (`ReleaseDetailPage.tsx` line 423):
```tsx
// Add ref here:
<div ref={containerRef} className="flex flex-1 overflow-hidden">
```

---

### `taskflow/src/stores/settings.store.test.ts` (test) — EXTENDED

**Analog:** Self — file already exists; pattern is extracted directly.

**Test file header and Tauri mock** (`settings.store.test.ts` lines 1–19 — do not change these):
```typescript
// biome-ignore assist/source/organizeImports: post-vi.mock imports must follow specific order to avoid TDZ circular dependency
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

// biome-ignore assist/source/organizeImports: import order must match module init order to avoid TDZ circular dependency
import { useSettingsStore } from './settings.store';
```

**`describe` block pattern** (`settings.store.test.ts` lines 189–212):
```typescript
describe('settings.store — updateCheckInterval (Phase 38)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        updateCheckInterval: 6,
      } as any);
    });
  });

  it('updateCheckInterval defaults to 6', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.updateCheckInterval).toBe(6);
  });

  it('setUpdateCheckInterval updates the value', () => {
    act(() => useSettingsStore.getState().setUpdateCheckInterval(24));
    expect(useSettingsStore.getState().updateCheckInterval).toBe(24);
  });
});
```

**New test block to append** — follows same describe/beforeEach/it structure:
```typescript
describe('settings.store — resize panel widths (Phase 50)', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({
        sidebarWidth: 224,
        issueDetailPanelWidth: null,
        mrDetailPanelWidth: 288,
        releaseDetailPanelWidth: 288,
      } as any);
    });
  });

  it('sidebarWidth defaults to 224', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.sidebarWidth).toBe(224);
  });

  it('issueDetailPanelWidth defaults to null', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.issueDetailPanelWidth).toBeNull();
  });

  it('mrDetailPanelWidth defaults to 288', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.mrDetailPanelWidth).toBe(288);
  });

  it('releaseDetailPanelWidth defaults to 288', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.releaseDetailPanelWidth).toBe(288);
  });

  it('setSidebarWidth persists a new value', () => {
    act(() => useSettingsStore.getState().setSidebarWidth(280));
    expect(useSettingsStore.getState().sidebarWidth).toBe(280);
  });

  it('setIssueDetailPanelWidth transitions from null to a number', () => {
    act(() => useSettingsStore.getState().setIssueDetailPanelWidth(360));
    expect(useSettingsStore.getState().issueDetailPanelWidth).toBe(360);
  });

  it('setMrDetailPanelWidth updates value', () => {
    act(() => useSettingsStore.getState().setMrDetailPanelWidth(320));
    expect(useSettingsStore.getState().mrDetailPanelWidth).toBe(320);
  });

  it('setReleaseDetailPanelWidth updates value', () => {
    act(() => useSettingsStore.getState().setReleaseDetailPanelWidth(300));
    expect(useSettingsStore.getState().releaseDetailPanelWidth).toBe(300);
  });
});
```

---

## Shared Patterns

### Zustand selector pattern
**Source:** `taskflow/src/components/app/Sidebar.tsx` lines 63–66
**Apply to:** All modified component files that read from `useSettingsStore`
```typescript
// One selector call per value — prevents re-renders from unrelated store changes
const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
```

### useRef for document-level event listeners
**Source:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 476–487
**Apply to:** `useResizable.ts` (the same addEventListener/removeEventListener in useEffect cleanup pattern)
```typescript
useEffect(() => {
  function handler(e: MouseEvent) { /* ... */ }
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [/* deps */]);
```

### Drag handle visual — `var(--ring)` token
**Source:** `50-RESEARCH.md` Pattern 2, consistent with existing Tailwind CSS variable usage in the project
**Apply to:** All drag handle divs in Sidebar, IssueDetailPage, MergeRequestDetailPage, ReleaseDetailPage
```tsx
style={{ borderColor: isDragging ? 'var(--ring)' : undefined }}
```

### `shrink-0` preservation
**Source:** `taskflow/src/components/app/Sidebar.tsx` line 195 (current), `IssueDetailPage.tsx` line 420, `MergeRequestDetailPage.tsx` line 263, `ReleaseDetailPage.tsx` line 756
**Apply to:** Every element that receives an inline `style={{ width }}`. This class must remain as a Tailwind class alongside the inline style.

### Store migration guard style
**Source:** `taskflow/src/stores/settings.store.ts` lines 362–396
**Apply to:** New v14 migration block in `settings.store.ts`
```typescript
if (version < N) {
  if (s.fieldName === undefined) s.fieldName = defaultValue;
}
```

---

## No Analog Found

All files have direct analogs in the codebase. No file requires falling back to RESEARCH.md patterns alone — though `useResizable.ts` relies on RESEARCH.md Pattern 1 for the core mouse-event logic because no drag-resize hook currently exists in the codebase.

---

## Metadata

**Analog search scope:** `taskflow/src/hooks/`, `taskflow/src/stores/`, `taskflow/src/components/app/`, `taskflow/src/routes/dashboard/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-09
