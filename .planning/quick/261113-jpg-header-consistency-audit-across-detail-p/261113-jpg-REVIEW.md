---
status: warnings
depth: quick
range: ca62065f..6cb327b2
---
# Code Review — 261113-jpg

No blocker regressions. IssueDetailHeader behaviour matches ca62065f (loading gating, tiny mode, ⋯ ordering, trail trimming, parent walk-back).

## Warnings
- **WR-01** ReleaseDetailPage.tsx:49 — fixed `minOverflow: 240` can be smaller than the real collapse height (meta + up-to-40vh description + strip + title) → compact/expand flip-flop on pages with overflow between 241px and the collapse height. Fix: measure the collapsible block (ResizeObserver) and pass as minOverflow.
- **WR-02** MergeRequestDetailPage.tsx:84, AioTestRunDetailPage.tsx:88 — default `minOverflow` 0; title collapse (~30-40px) can flicker short pages. Fix: pass ~60. (IssueDetailView also 0 — unchanged from approved behaviour.)
- **WR-03** detail-header.tsx:273 — `trail.slice(0, trail.length - trimTrail)` goes negative if trimTrail > length. Clamp with Math.max(0, …). No current caller triggers it.
- **WR-04** AioCycleDetailPage.tsx:87 — `void refresh(...).finally(...)` leaves unhandled rejection (pre-existing). Add `.catch`.

## Info
- **IN-01** useCompactOnScroll.ts:21-23 — resetKey change on a reused scroller re-expands without checking scrollTop.
- **IN-02** MergeRequestDetailPage.tsx:~255 — no error branch; failed fetch shows skeleton forever (pre-existing).
