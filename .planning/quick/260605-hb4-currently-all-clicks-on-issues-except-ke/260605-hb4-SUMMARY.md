---
quick_id: 260605-hb4
status: complete
date: 2026-06-05
commits:
  - 401e2ebe
  - dd20d942
---

# Quick Task 260605-hb4 — Summary

**Task:** Make issue clicks from the TopBar NotificationPopover and the Dashboard home In-Progress card always open the full issue page (`/issue/:key`) instead of the PeekPanel quick sidebar. Leave all other surfaces unchanged. Dashboard full-page open resets the breadcrumb trail.

**Status:** Complete — 3/3 tasks (Task 3 verification-only)
**Approach:** Option B — stop passing `onOpenIssue` at the two parent call sites so the leaf components' existing `(onOpenIssue ?? onIssueClick)` fallback resolves to the full-page handler. No leaf-component or `main.tsx` edits.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `401e2ebe` | fix | open full issue page from notifications & dashboard |
| `dd20d942` | test | lock full-page open behavior for notifications & dashboard |

## What changed

- **`src/components/app/TopBar.tsx`** — dropped `onOpenIssue` from the `<NotificationPopover>` element so row-body clicks fall through to the full-page `onIssueClick` (which is wired in `main.tsx` as `handleIssueClick(key, true)` → fresh breadcrumb trail). Removed `onOpenIssue` from TopBar's destructure (now unused there) while keeping the optional `onOpenIssue?` member on `TopBarProps` so `main.tsx` callers still type-check.
- **`src/routes/dashboard/index.tsx`** — dropped `onOpenIssue`; wrapped `onIssueClick={(key) => onIssueClick(key, true)}` for a fresh breadcrumb trail; widened the local outlet-context type to `(key, resetTrail?) => void`.
- **`src/routes/dashboard/DashboardInProgressCard.test.tsx`** — rewrote test 3 to assert body click → full-page (was peek).
- **`src/routes/notifications/NotificationPopover.test.tsx`** — added a test locking full-page open + `markAsRead` + `onClose` side effects on notification row clicks.

## Scope guards honored

- **Dashboard home only** — Sprint Board, Backlog, Standup Notes, Command Palette, and issue-detail inner panels untouched.
- **Fresh breadcrumb trail** on dashboard opens (the one subtlety: dashboard outlet-context `onIssueClick` defaults `resetTrail=false`, so it was wrapped explicitly with `true`). Notifications already reset the trail via TopBar wiring.
- `markAsRead` / popover-close / issue-key-button paths preserved (no regression).

## Deviation (Rule 3, resolved)

Removing `onOpenIssue` from the `<NotificationPopover>` element left it unused in TopBar's destructure, breaking the biome+tsc gate (TS6133 / noUnusedFunctionParameters). Removed it from the destructure only, keeping the optional `onOpenIssue?` member on `TopBarProps`. This is the unused-var cleanup the plan anticipated (Pitfall 5).

## Verification gate (exact output)

```
> taskflow@1.11.0 check
> biome check ./src && tsc --noEmit
Checked 459 files in 90ms. No fixes applied.

=== VITEST (npx vitest run) ===
 Test Files  158 passed | 2 skipped (160)
      Tests  1826 passed | 2 skipped | 13 todo (1841)
```

Targeted: `npx vitest run DashboardInProgressCard.test.tsx NotificationPopover.test.tsx` → 2 files passed, 16 tests passed.
