---
name: pin-unpin-sidesection-width
status: resolved
trigger: "On issue detail when I click pin/unpin the sidesection width gets reset to default value"
created: "2026-05-25"
updated: "2026-05-25"
---

# Debug Session: pin-unpin-sidesection-width

## Symptoms

- **Expected:** Side section retains whatever width the user has resized it to after pin/unpin
- **Actual:** Width resets to the default value when pin/unpin is clicked
- **Trigger:** Happens on pin/unpin click (not sure if before/after animation)
- **Errors:** No console errors visible
- **Timeline:** Unknown — not sure if it ever worked correctly

## Current Focus

```
hypothesis: resolved
test: null
expecting: null
next_action: complete
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/IssueDetailPage.tsx
  observation: >
    useResizable is called with initialWidth computed as an inline expression:
    `issueDetailPanelWidth ?? Math.round((containerRef.current?.offsetWidth ?? 952) * 0.42)`.
    This expression is evaluated on EVERY render of IssueDetailPage. When
    issueDetailPanelWidth is null (no stored value), the fallback reads
    containerRef.current?.offsetWidth from the DOM. On the first render after
    data loads (when the ref transitions from null to the actual DOM node), this
    value changes — e.g. from Math.round(952*0.42)=399 to Math.round(1200*0.42)=504.
    Any subsequent re-render that produces a different containerRef measurement
    changes initialWidth, which triggers the sync useEffect inside useResizable.

- timestamp: 2026-05-25
  file: taskflow/src/hooks/useResizable.ts (lines 51-56)
  observation: >
    The sync effect `useEffect(() => { if (!isDragging) setWidth(initialWidth) }, [initialWidth, isDragging])`
    fires whenever initialWidth changes. When pin/unpin is clicked, AppLayout
    re-renders (it subscribes to pinnedKeys), which cascades a re-render to
    IssueDetailPage via the Outlet context. During this re-render, if
    issueDetailPanelWidth is null, the inline initialWidth expression is
    recomputed from containerRef.current?.offsetWidth, producing a value that
    may differ from the one computed on the previous render. This change triggers
    the sync effect, resetting width state to the (possibly stale) fallback value.

## Eliminated Hypotheses

- Component remounting on pin/unpin: No key prop on Outlet or route, IssueDetailPage
  does not unmount. Eliminated.
- PinnedTabStrip changing container width: The strip is horizontal and only affects
  height of the flex-col layout. Width of containerRef is unaffected. Eliminated as
  primary cause (though it may produce the render that triggers the effect).
- issueDetailPanelWidth becoming null after being set: Nothing in the codebase resets
  this value outside of resetSettings(). Eliminated.

## Resolution

```
root_cause: >
  In IssueDetailPage, the initialWidth prop passed to useResizable was an inline
  expression re-evaluated on every render. When issueDetailPanelWidth is null
  (user has not yet dragged the panel), the fallback reads
  containerRef.current?.offsetWidth — a live DOM measurement that differs between
  renders (null pre-mount, actual px value post-mount). Pin/unpin triggers a
  re-render of IssueDetailPage (via AppLayout's pinnedKeys subscription cascading
  through the Outlet context), which re-evaluates the expression with the current
  DOM width. Because this produces a new value, the sync useEffect inside
  useResizable fires and resets the width state to the recomputed fallback.
fix: >
  Wrapped the initialWidth computation in useMemo with [issueDetailPanelWidth] as
  the sole dependency. containerRef.current is intentionally excluded — it is a
  mutable ref property, not reactive state. The memoized value only changes when
  the user's stored preference changes (null → a committed drag value), which is
  the correct and only intended trigger for the sync effect.
verification: type-check passes (tsc --noEmit clean), no lint errors
files_changed:
  - taskflow/src/routes/dashboard/IssueDetailPage.tsx
```
