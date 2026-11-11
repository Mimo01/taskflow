# Quick Task 261111-m0g: Floating notification panel with motion and in-app banners - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Task Boundary

Follow-up to 261111-i2o (Ledger notifications with stacks, hover ✕ and quick actions). The user's verdict on i2o was: "it looks very flat; I don't like the container; it should feel more responsive (hover, slide, …)".

The design was iterated in a standalone interactive prototype over 4 rounds with the user. That prototype is the design reference:
`.planning/quick/261111-m0g-floating-notification-panel-with-motion-/261111-m0g-prototype.html`. It uses the app's tokens and the Geist font. Open it in a browser. Its bottom bar is a prototype control only and must not be built.

Build the approved prototype design into the real notifications UI: `taskflow/src/routes/notifications/*` and the TopBar host. Also add in-app banners for new notifications, with a banner duration setting.

</domain>

<decisions>
## Implementation Decisions

### Container: "B · Floating" (user chose it over a popover and a side panel)
- There is NO boxed popover chrome: no border/ring, no solid panel background and no grey inner tray.
- The header and cards float at the top-right under the TopBar. The panel is about 31rem wide, its height hugs the content, and max-height is about `100vh - 64px`.
- Behind the content sits a frosted blur layer: a `::before` at inset -14px, radius about 30px, `var(--glass)` tint, and `backdrop-filter: blur(18px) saturate(1.2)` with the `-webkit-` prefix.
  - Its edges are feathered with two intersected linear-gradient masks. WebKit needs `-webkit-mask-composite: source-in`; standard is `mask-composite: intersect`.
  - User: "blur only behind the notification content". It is NOT a full-page blur and NOT a full-height strip.
- Clicking outside, pressing Esc or clicking the bell closes the panel.
- **The list MUST scroll** when it is taller than the max-height. This was broken in the prototype, so give the flex child `min-h-0` and `overflow-auto`, or use the virtualizer's scroll element correctly.

### Depth (user: "just right")
- Cards get soft layered shadows (`--sh-rest`) and a hairline ring (`--hair`): `oklch(0 0 0 / 7%)` in light, `oklch(1 0 0 / 8%)` in dark.
- On hover a card lifts `translateY(-1px)` and takes `--sh-hover`, and its avatar scales to 1.06 with a spring. On press it scales to 0.99.
- Read cards are slightly translucent and become solid on hover. Read text is never dimmed (prior rule).
- This explicitly overrides the earlier "no shadows" UAT rule, for notifications only.

### Motion
- **Open:** the header fades and slides down 4px. The cards stagger in from translateX(16px) at about 35ms each.
- **Close:** a quick fade, about 180ms.
- **Hover controls:** the ✕ in the top-left corner scales in from 0.6 with a spring. The cluster at the top-right slides in from translateX(6px) and the time fades out.
- **Clearing (✕, Clear on a stack, Done):** the card slides out to the right (translateX(115%) and fades), then its height collapses smoothly. Do NOT rebuild or flash the list. Clear on a stack staggers its cards out.
- **Read/unread toggle:** a small scale "flash" and an in-place class swap.
- **Stacks:** on hover the peek edges spread (3px and 6px). On expand the cards fan out with a spring. Stacks are kept from i2o.
- **New notification while the panel is OPEN:** it MUST slide into the list from the top (translateY(-10px) to 0 and fade in). If it belongs to an existing stack, the stack updates its +N. This was broken in the prototype and must work.
- **New notification at any time:** the bell rings (rotate keyframes) and its badge pops (scale 1.35 with a spring).
- All motion respects `prefers-reduced-motion`.
- Easings: `--ease-out: cubic-bezier(.22,1,.36,1)` and `--spring: cubic-bezier(.34,1.4,.64,1)`.

### Swipe and drag: REMOVED
User: "remove the slide action and drag altogether, I don't like it". There are no swipe gestures, no pointer drag and no wheel-swipe. Card text is not selectable inside the list (`user-select: none`).

### In-app banners (new)
- When new notifications arrive, they show as banners: the same card style with `--sh-pop` shadow, fixed at the top-right below the TopBar (about top 60px, right 16px, width 24rem).
- **Entrance and exit:** a banner slides in from the right with a spring and leaves by sliding out to the right.
- **Stacking:** at most 3 are visible, newest on top.
- **Timing:** hovering pauses the timer. A banner auto-dismisses after the configured duration.
- **Dismissal and click:** the ✕ dismisses a banner. Clicking it opens the item (same navigation as a row click), marks it read and dismisses it. Quick-action pills work as they do in the list.
- **Visibility:** no banners while the notification panel is open, because the item enters the list instead.
- **Rendering:** render through a portal to `document.body`, because of the `isolate <main>` z-index memory.
- **Which items:** the same filter as OS desktop notifications, i.e. the existing per-type toggles in `settings.store.ts` and the dispatch in `src/services/notifications.ts`. Banners must not fire for the initial load or backfill, only for genuinely new items.
- **Setting:** add "Banner duration" to Settings → Notifications with the options Off / 3s / 5s / 8s, default 5s. Persist it in `settings.store`.

### Claude's Discretion
- Whether to keep the Base UI Popover primitive for focus and outside-click handling, or use a custom portal layer.
- Exact component structure, the banner queue store, and the tests.
- How the virtualizer coexists with enter and exit animations. Not rebuilding the list is the requirement.
- The i2o REVIEW.md warnings (WR-03 height estimates, WR-04 stack collapse on filter change, WR-06 keyboard issues) touch the same code. Do not make them worse; fix them where the rewrite naturally touches them.

</decisions>

<specifics>
## Specific Ideas

- Prototype tokens to reuse as CSS vars: `--sh-rest`, `--sh-hover`, `--sh-pop`, `--glass` and `--hair`. Each has light and dark values; see the prototype `:root` and `html.dark`. The app sets `.dark` on `<html>`.
- Card radius is about 14px, padding 12px 14px, and the gap between cards is 8px.
- Keep from i2o:
  - the Ledger colour rules;
  - the one-row header: title, Unread|All light segmented control, "All sources ▾", mark-all-read, ⋯;
  - quick-action pills;
  - stacks with Show less / Clear;
  - bell counts cards.
- Placeholder data only in tests and screenshots.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261111-m0g-floating-notification-panel-with-motion-/261111-m0g-prototype.html` (APPROVED design + motion reference)
- `.planning/quick/261111-i2o-professional-notifications-redesign-insp/261111-i2o-SUMMARY.md` and `261111-i2o-REVIEW.md`
- Memory: `project_main_isolate_portal_overlays.md`, `project_wkwebview_custom_highlight_gaps.md`, `project_react_compiler_module_read.md`

</canonical_refs>
