---
phase: quick-261102-fy2
verified: 2026-11-02T00:00:00Z
status: human_needed
score: 6/6 must-haves verified (code); visual polish needs human sign-off
human_verification:
  - test: "Open /standup-notes in the real app at Text size xl (and lg) with the default 1100px window, in a real Jira dataset"
    expected: "Today column summaries stay readable (not truncated to 2-5 characters) while the status pill is shown"
    why_human: "Screenshot comfortable-xl.png shows Today summaries collapsing to 'Checkout re…', 'Wire u…', 'In…' because the pill, SP slot and 9rem progress slot are non-shrinking. Whether this counts as 'looks good' is a design judgement."
  - test: "Narrow the window to about 700px"
    expected: "Rows with long status names ('Selected for Development', 'Ready for Release') do not overflow"
    why_human: "SUMMARY admits extreme-700-default-md.png still overflows slightly on indented sub-task rows. Decide whether that is acceptable, since Tauri sets no minimum window width."
---

# Quick 261102-fy2: Standup notes polish - Verification Report

**Goal:** Respect display density and text size better, show task status as trailing status pills in rows, and make sure it looks good.
**Status:** human_needed. All code-level truths are verified. Two visual-quality questions are left for the user.
**Re-verification:** No, initial verification.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every Jira issue row (Yesterday group header and sub-task header, Today In Progress and Up Next rows) has a trailing status pill coloured by category | VERIFIED | `IssueActivityGroup.tsx` renders `statusPillClass(statusCategoryKey)` inside `pointer-events-none relative flex shrink-0`, only when `statusName` is set. It is passed to group headers and sub-task headers. Today rows in `TodayInProgressSection.tsx` and `TodayUpNextSection.tsx` use `statusPillClass(issue.fields.status.statusCategory?.key)` in a flex wrapper. Screenshots confirm. |
| 2 | Summary truncates before the pill, the pill never shrinks, no wrap | VERIFIED (with caveats) | The pill wrapper and trailing cluster are `shrink-0`, and no `flex-wrap` remains in `standup-notes`. Screenshots at md and sm are one line per row. At 1100px with xl text, Today summaries truncate heavily (see human items). At about 700px, long status names overflow slightly, as the SUMMARY admits. |
| 3 | Padding and gaps follow density on one consistent scale | VERIFIED | The stacked `[&>*]:py-*` wrappers and `mb-4 pt-4` are gone (grep is clean). Groups use `gap-1 density-compact:gap-0.5 density-comfortable:gap-2`. Sections use `gap-6 density-compact:gap-4 density-comfortable:gap-8`. Screenshots show row heights changing per density. |
| 4 | Text and icons scale with Text size, with no px-fixed sizes | VERIFIED | The grep finds only `CachedAvatar size={20}` (rem-mapped) and none of `[Npx]`. The comfortable-xl screenshot shows scaled text and icons. |
| 5 | Rows with and without SP or progress have identical height and pills line up | VERIFIED (deviation noted) | Slots are fixed-width and use an `invisible` placeholder. They are reserved per section, not always, which is a documented deviation. Pills are right-aligned and the right edges line up. |
| 6 | Markdown output is unchanged | VERIFIED | `generateMarkdown` never reads the new fields, and a test compares fixtures with and without status. The existing markdown tests pass unmodified. |

**Score:** 6/6 at code level.

## Key Links

| From | To | Status |
|------|----|--------|
| `fetchIssueMeta` | `buildGroups` | WIRED. The main URL has `fields=...,status`, the parent follow-up has `fields=subtasks,status`, and both are mapped to `statusName`/`statusCategoryKey`/`parentStatus*`. |
| `buildGroups` | `IssueActivityGroup` | WIRED. `group.statusName` and `st.statusName` are passed as props. The rollup prefers the parent's own status, then falls back to `parentStatus*`. |
| Today `IssueRow` | `statusPillClass` | WIRED. |

The issue-meta `staleTime` was lowered to 5 minutes in `StandupNotesPage.tsx`.

## Spot-checks

- `npx vitest run src/services/jira-standup.test.ts src/routes/standup-notes` passed: 11 files, 106 tests.
- The preview harness (`src/__preview`, `standup-preview.html`) is deleted.
- No TBD/FIXME markers were introduced. The grep found none in the diff.

## Anti-patterns and warnings

- The Today progress slot is `hidden w-36 ... @[32rem]:flex`. When the column is under 32rem the progress bar is hidden entirely, which is a behaviour deviation from the plan. It is documented and reasonable.
- The StandupPageHeader change (`shrink-0 gap-4`, `min-w-0`) was never screenshotted. It is a trivial class change.
- Today status pills have no `pointer-events-none`. This is not required there, because those rows are not click-overlay headers.

## Human verification required

1. **Text size xl at 1100px (design judgement).** In `comfortable-xl.png` the Today column summaries are truncated to a few characters because the non-shrinking pill, SP slot and 9rem progress slot consume the width. The plan's own rule is "truncate before pill", so it is technically met, but readability is poor. The user should decide whether to accept it or shrink the slots.
2. **About 700px window.** Long status names on indented sub-task rows overflow slightly (documented in `extreme-700-default-md.png`). No minimum window width is configured, so the user should decide whether it matters.

## Gaps summary

No blocking gaps. The implementation matches the must-haves and the tests pass. Status is `human_needed` because "looks good" is subjective and two visible layout compromises remain.
