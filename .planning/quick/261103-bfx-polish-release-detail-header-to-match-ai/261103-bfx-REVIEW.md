# Code Review — 261103-bfx (quick depth)

Scope: 9eefc432..32d0a85f (MrLabels, ReleaseMrDonut, ReleaseHeader, ReleaseDetailSkeleton, ReleaseDetailPage + tests). 0 blockers, 2 warnings, 2 info.

## Warnings

### WR-01: Label strip hidden while MR donut is loading/error (ReleaseDetailPage.tsx:529)
Strip renders only when `showDonut && donutState === 'ready'`.
**Disposition: not a regression.** Before this task the labels lived inside ReleaseMrDonut's GraphSlot, which rendered a skeleton (no labels) on `loading` and the error text on `error` — same visibility. React Query keeps `data` across refetches, so `loading` only occurs on first load. Table keeps its own label-filter clear control. No change.

### WR-02: `mr-labels-all` "all labelled" checkmark removed (MrLabels.tsx:93)
**Disposition: intended.** The strip renders nothing when there are no labels and no unlabelled MRs (CONTEXT decision); an "all labelled" state with zero labels cannot occur in practice when MRs exist with labels (pills show instead).

## Info

### IN-01: Title row no longer wraps (ReleaseHeader.tsx:164-178)
**Disposition: verified** by screenshot at 400px container width — actions are icon-only, title truncates, no overflow.

### IN-02: Pinned state shown by icon fill only
`aria-label`/`title` carry the state. Optional `aria-pressed` — not applied (matches AIO CycleHeader).
