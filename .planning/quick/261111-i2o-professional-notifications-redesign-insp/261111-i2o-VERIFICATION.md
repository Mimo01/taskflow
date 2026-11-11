---
phase: quick-261111-i2o
verified: 2026-11-11
status: human_needed
score: 11/11 must-haves verified (automated)
human_verification:
  - test: "Open the bell popover in the running app (light + dark) with real notification data"
    expected: "Ledger look: stacks with peek edges and +N, expand in place with Show less / Clear, hover corner X + cluster, Reply/Review pills, single-row header; no clipping"
    why_human: "Visual and hover behaviour; grep and jsdom cannot judge it"
  - test: "Click Reply on a Jira comment card"
    expected: "Issue opens and the comment composer textarea has focus"
    why_human: "Real routing and mount timing across routes"
---

# Quick 261111-i2o Verification

**Goal:** Ledger (B) notifications redesign with stacks, hover X and cluster, quick actions, single-row shell.
**Result:** All automated checks pass. Only visual and cross-route behaviour is left for a human.

## Automated

- `npx vitest run src/routes/notifications src/stores`: 21 files, 420 tests, all passed.
- `npx tsc --noEmit`: clean.
- Debt markers (TBD/FIXME/XXX) in the notifications dir and the composer-focus store: none.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A/B/C light and dark previews exist | VERIFIED | `directions-light.png` and `directions-dark.png` are in the quick dir (commit 5eeaf559 precedes the build commits) |
| 2 | User pick drives the build | VERIFIED | SUMMARY records "B Ledger"; the code matches it (card uses `bg-card`, ring, semibold when unread, no dot or halo) |
| 3 | Stack: 2+ cards become one stack with peek edges and +N | VERIFIED | `stackEntries` at `notification-view.ts:765`; `StackCard` at `NotificationRow.tsx:702` with peek-edge divs and `+{stackMore}` |
| 4 | Expand in place with Show less / Clear header; keyboard Enter/Space/ArrowRight to expand, Esc/ArrowLeft to collapse | VERIFIED | `stack-header` entry; `StackHeader` has "Show less" (L743); `NotificationList` handles the keys and calls `onToggleStack` |
| 5 | Clear removes all ids including duplicates | VERIFIED | `stackIds` = `cards.flatMap(entryIds)`, and `entryIds` includes `duplicateIds`; popover calls `removeItems(stackIds(entry))` (L234) |
| 6 | Hover/focus corner X (`aria-label="Clear notification"`) plus read/open cluster | VERIFIED | `NotificationRow.tsx:587-592` (`opacity-0` until `group-hover` or `focus-within`); cluster at L646 |
| 7 | Reply/Review quick actions use existing navigation only | VERIFIED | `getQuick` in the popover: Jira Reply calls `requestComposerFocus`, `onIssueClick`, `onClose`; GitLab Reply and pipeline are gated by `isSafeHttpUrl`; Review and Open MR call `onMRClick(pid/iid)` guarded by null checks |
| 8 | Composer focus flag | VERIFIED | `composer-focus.store.ts` exists; `CommentComposer.tsx:82-88` focuses and clears when `composerFocus === issueKey` (test added) |
| 9 | Read cards never dimmed; one colour carrier | VERIFIED | Title is `font-normal` when read; `NotificationAvatar` has no opacity classes; tests assert no dimming |
| 10 | Single-row shell, no inverted `bg-foreground` pressed state; width 30rem | VERIFIED | No `bg-foreground` in the popover; `TopBar.tsx` changed to `w-[30rem]`; segmented Unread/All and source dropdown present |
| 11 | Bell count counts cards | VERIFIED | `countUnreadCards` is not in the diff; a test was added in `useUnreadCardCount.test.ts` |

Other artifacts: `preview/` has been deleted and was never tracked. The final light and dark PNGs exist.

## Notes (informational)

- `TopBar.tsx` was modified (width only); it is not listed in the plan's files, but it is required for the 30rem default.
- There is no `getState()` read in popover render.

## Gaps

None.
