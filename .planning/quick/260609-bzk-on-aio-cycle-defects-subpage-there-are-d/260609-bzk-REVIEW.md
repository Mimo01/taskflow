---
phase: 260609-bzk
reviewed: 2026-06-09T00:00:00Z
depth: quick
files_reviewed: 1
files_reviewed_list:
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 260609-bzk: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** quick
**Files Reviewed:** 1
**Status:** issues_found

## Summary

The change replaces a local `openDefect` (navigate + breadcrumb push) with `onOpenIssue` from `useOutletContext`, wiring DefectRow clicks to the PeekPanel. The wiring itself is architecturally correct — `onOpenIssue` is present in the Outlet context that `AppLayout` provides to all child routes. However, the `useOutletContext` call uses a local inline type assertion with no runtime guard, and the test harness does not inject the context, meaning every test that reaches a DefectRow click will throw an unhandled runtime error. There is also a latent issue with the `resolvedKey ?? ''` fallback inside `DefectRow`.

---

## Critical Issues

### CR-01: `useOutletContext` destructure crashes when context is absent — no runtime guard

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx:731`

**Issue:** `useOutletContext<{ onOpenIssue: (issueKey: string) => void }>()` is called with a bare TypeScript type assertion. React Router's `useOutletContext` returns `undefined` when the component is rendered outside an `<Outlet context={...}>` — which is exactly what every test in `AioCycleDetailPage.test.tsx` does (bare `<Route>` with no parent Outlet, no context value injected). The destructure `const { onOpenIssue } = ...` will throw `TypeError: Cannot destructure property 'onOpenIssue' of undefined` at test-time and at runtime if the page is ever accessed via a direct URL or a route not nested under `AppLayout`. In production today the path `/aio-cycle/:projectKey/:cycleKey` is always a child of `AppLayout`'s `<Outlet>`, so the crash is latent — but it is one routing change away from silent production breakage, and it already breaks tests silently if any test exercises the Defects tab row click.

Other outlet consumers in this codebase either provide a fallback (`?? {}` — see `EpicsPage.tsx:93`) or only destructure fields also present in the production context. This file is the only one that destructures a newly-added field without either a guard or a test-context shim.

**Fix:**

```tsx
// Line 731 — guard against missing context (matches EpicsPage pattern)
const outletCtx = useOutletContext<{ onOpenIssue?: (issueKey: string) => void }>() ?? {};
const onOpenIssue = outletCtx.onOpenIssue ?? (() => {});
```

And in `renderPage()` in the test file, add the context via a wrapper Route:

```tsx
function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/aio-cycle/PROJ/PROJ-CY-2']}>
        <Routes>
          <Route
            element={
              <Outlet
                context={{ onOpenIssue: vi.fn(), onIssueClick: vi.fn() }}
              />
            }
          >
            <Route path="/aio-cycle/:projectKey/:cycleKey" element={<AioCycleDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
```

---

## Warnings

### WR-01: `resolvedKey ?? ''` passes empty string to `onOpenIssue` — dead guard masks a real invariant violation

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx:248-253`

**Issue:** Inside `DefectRow`, the click/keydown handlers call `onOpen(resolvedKey ?? '')`. The `??` fallback is unreachable — `isClickable` is only `true` when `resolvedKey` is truthy (line 237: `const isClickable = !isLoading && !!resolvedKey`), so these handlers are only attached when `resolvedKey` is non-null and non-empty. The `?? ''` therefore silently masks an invariant violation: if the guard logic ever drifts (e.g., `isClickable` is widened), `onOpenIssue('')` will be called with an empty string, causing `handleOpenPeek` to set `peekIssueKey` to `''` (falsy), which will immediately close the panel via the `{peekIssueKey && ...}` conditional in `main.tsx:585`. The silent failure mode is confusing.

**Fix:** Assert the invariant explicitly:

```tsx
onClick: () => {
  if (!resolvedKey) return; // invariant guard — should never fire
  onOpen(resolvedKey);
},
onKeyDown: (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!resolvedKey) return;
    onOpen(resolvedKey);
  }
},
```

---

## Info

### IN-01: Breadcrumb push removed from DefectRow click — intentional but undocumented

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx:731-1230`

**Issue:** The previous `openDefect` called `useBreadcrumbStore.getState().push(...)` before navigating, which let the user navigate back to the cycle page from the issue detail. The new `onOpenIssue` opens a PeekPanel overlay instead of navigating, so no breadcrumb push is needed — PeekPanel is dismissed by closing it, not by back-navigation. This is safe. However, the change is not commented; a future developer removing the PeekPanel and reverting to navigate-based opening would silently lose the breadcrumb push again. A brief comment at line 731 explaining why no breadcrumb push is needed would prevent the regression:

```tsx
// onOpenIssue opens a PeekPanel overlay (no navigation, no breadcrumb push needed).
// If this ever reverts to navigate(), restore the breadcrumb push from git history.
const { onOpenIssue } = useOutletContext<{ onOpenIssue: (issueKey: string) => void }>();
```

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
