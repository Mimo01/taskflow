---
phase: quick-261111-m0g
verified: 2026-11-11T16:20:00Z
status: human_needed
score: 11/11 must-haves verified in code (WKWebView rendering and UX feel need human check)
human_verification:
  - test: "WKWebView blur + feathered mask (panel open over page content)"
    expected: "Content behind header and cards is frosted, edges fade softly, no hard rectangle, no full-page blur"
    why_human: "Chromium screenshots do not prove WKWebView rendering"
  - test: "Feel of motion (open stagger, hover lift, slide-out + collapse, fan, banner spring) in the Tauri app, light and dark"
    expected: "Matches the approved prototype"
    why_human: "Visual and temporal behaviour"
  - test: "Decide the banner filter deviation (Plan Task 4 step 9)"
    expected: "Answer 'keep' (per-type toggles only) or 'also respect the OS Jira/GitLab desktop switches'"
    why_human: "Product decision. CONTEXT said same filter as OS notifications. Code implements per-type toggles plus genuinely-new guard only."
---

# Quick 261111-m0g Verification

**Goal:** floating notification panel with motion, in-app banners, and a Banner duration setting.
**Status:** human_needed. All automated checks pass. The Task 4 human checkpoint is not recorded as completed in SUMMARY.md.

## Automated checks run

| Check | Result |
| --- | --- |
| `npx vitest run src/routes/notifications src/stores src/components/app src/routes/settings` | 44 files, 705 tests passed |
| `npx tsc --noEmit` | no errors |
| Debt markers (TBD/FIXME/XXX) in touched notification files | none |
| Swipe/drag/wheel/touch handlers in `routes/notifications/*.tsx` (non-test) | none |
| `taskflow/preview` harness removed | yes |
| 4 PNGs present in quick dir | yes |

## Must-have truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Chrome-less panel with feathered glass | VERIFIED | `TopBar.tsx:134` has `notif-glass ... w-[31rem] max-h-[calc(100vh-64px)] border-0 bg-transparent shadow-none ring-0`. `index.css:104-123` has `::before` inset -14px, radius 30px, `var(--glass)`, blur(18px) saturate(1.2), and two intersected masks with both the `-webkit-` and standard prefixes. |
| 2 | List scrolls | VERIFIED | `NotificationList.tsx:258` scroller is `min-h-0 flex-1 overflow-y-auto overscroll-contain select-none`. No `max-h-[520px]` or `bg-muted`. SUMMARY reports a browser scroll assertion. |
| 3 | Arrival while open slides in, stack node stable | VERIFIED | `data-entering` plus the `notif-enter` class in `NotificationList.tsx:383,391`. `knownIdsRef` logic is in the Popover. Covered by tests that passed. |
| 4 | Depth and hover/press motion | VERIFIED (code) | Shadow tokens and the avatar spring are present. Visual feel is for the human. |
| 5 | Open stagger and close fade | VERIFIED (code) | `data-intro` with `notif-stagger`. `data-[ending-style]:duration-[180ms]`. |
| 6 | Clear slides out then collapses without rebuild | VERIFIED | `data-leaving`, deferred `removeItems` after `NOTIF_EXIT_MS`, and a reduced-motion bypass at `NotificationPopover.tsx:199`. |
| 7 | Read flash and stack fan once per expand | VERIFIED | `data-flash`, `justExpanded`, `notif-fan` in `NotificationList.tsx`. |
| 8 | Bell rings and badge pops, also while open | VERIFIED | `TopBar.tsx:118,122` use `animate-bell-ring` and `notif-badge-pop`. The open-effect only resets on the open transition. |
| 9 | Banners | VERIFIED | `NotificationBanners.tsx` uses `createPortal`, `top-[60px] right-4 z-[70] w-96`, `MIN_RESUME_MS = 800`, and `setSuppressed(open)` plus `clear`. Rendered in `TopBar.tsx:146`. The store caps at 3 and skips when suppressed or when the duration is Off. `selectBannerItems` gates on first poll, hydration, `existingIds`, and null cursors. The polling hook wires it with `priorCursors`, `isFirstPoll` and `hasHydrated`. |
| 10 | Banner duration setting, v35 migration | VERIFIED | `settings.store.ts` default 5, `version: 35`, migration fills 5. "Banner duration" row at `NotificationSettingsSection.tsx:197`, with a test. |
| 11 | No swipe/drag, text not selectable, reduced-motion guard | VERIFIED | Grep clean. `select-none` on the scroller. The reduced-motion block covers `[data-notif-motion]`, its `::before`, `::after` and descendants. |

## Findings

- WARNING: SUMMARY.md says the banner filter deviation is "pending user confirmation" and does not record the Task 4 checkpoint answer. The human approval step is therefore unconfirmed. This is the only item outside the code evidence.
- No BLOCKERs. No stubs or orphaned artifacts found: every artifact in the plan exists, is substantive, and is wired.

## Notes

- Browser assertions (scroll, node identity, monotonic collapse, blur) are taken from the SUMMARY. The harness was deleted, so I did not re-run them. I confirmed the supporting code and unit tests instead.
