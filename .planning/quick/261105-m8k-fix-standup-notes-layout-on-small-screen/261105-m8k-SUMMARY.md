---
phase: quick-261105-m8k
plan: 01
subsystem: standup-notes
tags: [layout, container-queries, settings-migration]
key-files:
  created:
    - taskflow/src/routes/standup-notes/split-ratio.ts
    - taskflow/src/routes/standup-notes/split-ratio.test.ts
    - taskflow/src/routes/standup-notes/today-row-classes.ts
  modified:
    - taskflow/src/routes/standup-notes/StandupSplit.tsx
    - taskflow/src/routes/standup-notes/StandupSplit.test.tsx
    - taskflow/src/routes/standup-notes/TodayColumn.tsx
    - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
    - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
    - taskflow/src/routes/standup-notes/TodayMrsSection.tsx
    - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
    - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
    - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/settings.store.test.ts
decisions:
  - Split persisted as ratio (standupYesterdayRatio), store v34 resets legacy px width to 50/50
  - MIN_PANE_PX stays 320
  - Panes stack vertically below 40rem split-container width (evidence-driven)
completed: 2026-11-05
---

# Quick 261105-m8k: Standup Notes small-screen layout

Standup split now persists a fraction of its container (sidebar toggle resizes both panes), and Today/Yesterday row titles stay visible at every width via container-query tiers plus a stacked layout in very narrow windows.

## Commits
- c86506bc: percentage split, split-ratio helpers, store v34 migration, tests
- 26634dc1: progressive row compaction, shared `today-row-classes.ts`, TodayColumn padding/`@container` split
- 7e1a7aaa: stack panes <40rem, pill-drop tier, shown-ratio clamp fix

## Final tier table (keyed to the TodayColumn inner @container, content width)
| Content width | Change |
|---|---|
| < 36rem | SP slot hidden |
| < 32rem | time bar w-24 -> w-16 |
| < 28rem | time bar hidden; MR trailing tag ("awaiting review", "N open threads", "not approved") hidden |
| < 24rem | status pill: min-w-0, max-w-20, truncate |
| < 20rem | status pill hidden (added after screenshots) |
| always | title `flex-1 min-w-16 truncate`; avatar never hidden |

MIN_PANE_PX = 320 (unchanged). Stack threshold 40rem of split-container width (= 2 x MIN_PANE_PX).

## Stack-or-not decision
Side-by-side is kept whenever both panes can have 320px. At 800px window + sidebar open the split container is ~576px; the left floor wins and Today gets ~256px, which clipped the avatar/cluster off the pane even after compaction (screenshot before the fix). Below 40rem the panes therefore stack (Yesterday over Today, single scroll region, separator hidden, inline % width overridden with `!` classes). 800px with the sidebar closed (800px split) stays side by side and looks fine.

## Screenshot matrix (all under /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/59efd71a-a0e9-4484-8799-0be93db5e425/scratchpad/m8k/, 900px high, ratio 0.5 unless stated)
| Window | Sidebar open | Sidebar closed |
|---|---|---|
| 800 | w800-sb1-r50.png (stacked) | w800-sb0-r50.png |
| 1024 | w1024-sb1-r50.png (+ w1024-sb1-r50-dark.png) | w1024-sb0-r50.png |
| 1280 | w1280-sb1-r50.png (+ r30, r70) | w1280-sb0-r50.png |
| 1440 | w1440-sb1-r50.png | w1440-sb0-r50.png |
| 1920 | w1920-sb1-r50.png | w1920-sb0-r50.png |

Plus w1280-sb1-r30.png and w1280-sb1-r70.png (13 PNGs total). Every PNG was viewed.

Findings:
- Before fix (first render, 1280 sb open): titles visible but short; at 800 sb open Today avatars clipped off the right edge; at 1280 ratio 0.7 (Today ~320px) indented subtask avatars were clipped.
- After: titles visible (truncated with ellipsis, one line per row) in every row of both columns at all widths; avatar always present and unclipped; sidebar toggle at same ratio resizes both panes (compare sb0 vs sb1 shots at same width); dark theme OK; 1440/1920 show the full cluster (pill, SP, bar, avatar) with long titles.
- Known quirk (pre-existing, left alone): pill column width varies per row (status name length), so pills are not column-aligned; indented rows' avatars sit ~7px right of top-level rows.
- At ratio 0.7 / ~17rem content width the status pill is hidden (full status not shown on that row).

## Deviations from plan
1. [Rule 1 - Bug] The first StandupSplit render clamped the shown ratio against a 960px fallback container, capping 0.7 to 0.667. Fixed to use only static 20-80% bounds (CSS min/max enforce px floors). Commit: task 3.
2. [Rule 1 - Bug] Added a `<20rem` pill-hide tier (not in plan's tier list) after screenshots showed avatar clipping on indented rows in ~320px panes.
3. v33 migration block body emptied (comment only, `if (version < 33)` retained for the existing source-regex test) so the only `standupYesterdayWidth` reference left in settings.store.ts is the v34 delete; plan verify expected this.
4. Yesterday column did not need its own `@container` (no trailing clusters there); only title min-width floors were applied. Left pane `px-6` unchanged.

## Deferred / notes
- Container query thresholds are in rem while MIN_PANE_PX is px; with a non-default root font size the stack threshold shifts slightly. Acceptable.
- Preview files (preview-standup.html, src/__preview/) were deleted and never committed.

## Self-Check: PASSED
