---
status: human_needed
score: 6/6 automated must-haves verified
verified: 2026-11-13
human_verification:
  - test: "Run the 7-item UAT checklist from PLAN Task 4 in `npm run tauri dev`"
    expected: "Issue header unchanged; Release, MR, AIO cycle and AIO run show one header bar, condense on scroll without flicker, tools collapse into the ⋯ menu at 860px and 720px, sticky table and tab bars still stick"
    why_human: "Visual, scroll and resize behaviour in the real WebKit webview (jsdom has no layout; the ResizeObserver mock fixes width at 600)"
---

# 261113-jpg Verification

**Goal:** Shared DetailHeader applied to Release, MR, AIO cycle and AIO run detail. IssueDetailHeader rebuilt on it with no behaviour change.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Issue header unchanged | VERIFIED (automated) | `IssueDetailHeader.test`, `IssueDetailPage.progressive.test` and `PeekPanel.test` are unmodified by the commits (empty diff) and pass. `IssueDetailHeader.tsx` composes `<DetailHeader>` (line 171). Visual parity needs UAT. |
| 2 | One header bar per page, no separate breadcrumb bar | VERIFIED | Each of the four pages and its header composer renders `<DetailHeader>`. Grep for `ReleaseBreadcrumbHeader`, `Go back` and `Refreshed: ` finds nothing in the pages. The only `lastRefreshed` hit is a prop name in `CycleHeader`. |
| 3 | Header above the scroller, condenses via `useCompactOnScroll` | VERIFIED (code) | Release header is rendered before `release-detail-scroll`, with `minOverflow` 240. Cycle uses 120, with `onScroll` on `aio-cycle-scroll`. MR wires `onScroll` to `mr-detail-scroll`. AIO run wires it to both scrollers. The hook has 16/4 hysteresis and the overflow guard. Real scroll behaviour needs UAT. |
| 4 | MR header spans the left column and the sidebar. AIO run has one header with prev/next | VERIFIED (code) | MR root is `flex-col`: `DetailHeader` then `div.flex.min-h-0.flex-1` holding both columns. AIO run uses one `DetailHeader`, and `aio-run-detail-position` is in the code. |
| 5 | Refresh and Pin are secondary tools, refreshed time in the tooltip only, Release Edit is primary | VERIFIED | Refresh `title` strings carry `Refreshed {time}` on MR, run and release. Release `ReleaseHeader` has the Edit, Refresh and Pin tools. Remaining labels need UAT. |
| 6 | Primary pairs: Release has Open in Jira, MR has Open in GitLab, cycle and run have none, no Pin on MR or run | VERIFIED | `ReleaseHeader` `primary` is `openLabel: 'Open in Jira'`. MR `primary` is `Open in GitLab` and is only set when `mr` is loaded. `Pin` does not appear in `MergeRequestDetailPage` or `AioTestRunDetailPage`. |

## Artifacts and wiring

- `detail-header.tsx`, `detail-header.test.tsx`, `useCompactOnScroll.ts` and its test exist and are substantive. All of them are imported and used by the pages.
- `MergeRequestDetailPage.test.tsx` is new (133 lines) and passes.
- The compile guard test passes and now covers the new files. The cycle `try/finally` was removed.
- The Release description is capped at `max-h-[40vh]`.
- No `TBD`, `FIXME` or `XXX` markers in the touched source files.

## Behavioural checks

- Ran 70 test files with 1357 tests passing and 2 skipped. These covered the primitive, the hook, the issue tests, release, cycle, MR, run and the compile guard.
- `tsc --noEmit` is clean.

## Human verification required

All 7 UAT checks (PLAN Task 4) are still pending, as expected. The areas most at risk, which only the real app can show:
- Release or cycle short-content scroll oscillation (hence the `minOverflow` guard).
- Sticky table header and tab bar offsets after the header moved out of the scroller.
- Label wrapping and the ⋯ collapse at 860px and 720px.
- Two-scroller condense on the AIO run page.

## Gaps

None found.
