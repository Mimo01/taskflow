---
phase: 94-release-detail-redesign
verified: 2026-10-30T00:00:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 94: Release detail redesign Verification Report

**Goal:** A cleaner, more professional release detail page with more graphs. It keeps all current info and the existing actions (Pin, Edit, Open in Jira, field edits).
**Status:** passed (initial verification)

## Automated checks
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 269 files passed, 1 skipped. 4138 tests passed, 2 skipped, 7 todo.

## Truths
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Burnup, MR donut, assignee rows and type waffle graphs exist and are wired (D-01, D-05) | VERIFIED | The four components are in `release-detail/graphs/`, each with tests. They are imported and rendered in `ReleaseDetailPage.tsx` (lines 312-359). |
| 2 | Burnup derivations: axis, done and scope series, D-16 invariant, no forecast (D-02, D-03, D-04, D-16) | VERIFIED | `releaseBurnup.ts` and its tests exist. Grep finds no `projectFinish` or `deriveProjection`. `created` and `resolutiondate` are added to the Jira fields in `services/jira.ts`. |
| 3 | Facts strip and description clamp preserve the old sidebar states (D-08, D-09, D-15) | VERIFIED | `ReleaseFacts.tsx` and `ReleaseDescription.tsx` exist with tests. The old sidebar, `DescriptionsSection` and `MetaRow` files are deleted. |
| 4 | Full-width page with one scroll wrapper, `release-detail-scroll`, and a sticky table header (D-07, D-13) | VERIFIED | The testid is present in `ReleaseDetailPage.tsx`. The sticky header was human-verified in the real Tauri app. |
| 5 | Refresh button calls `refreshReleaseDetail`, with upstream queries invalidated first (D-11) | VERIFIED | `lib/release-refresh.ts` exists and the page calls it at line 238. |
| 6 | The `releaseDetailPanelWidth` setting is removed and persist version is 32 with a delete migration (D-07) | VERIFIED | `settings.store.ts` has `version: 32` and `delete s.releaseDetailPanelWidth` at line 499. The earlier references at lines 433 and 495 are legacy migration steps that run before the delete. The migration test covers it. |
| 7 | Each figure appears once, and the header and actions are preserved (D-06, D-14) | VERIFIED | `ReleaseHeader.tsx` and the page tests pass. The dialogs and `EditReleaseModal` are unchanged. |
| 8 | Slots keep their size in loading, empty and error states (`GraphSlot`) | VERIFIED | `GraphSlot` and its test exist. The full-width skeleton and its test exist. |

## Plan 94-08 deviations
These are user-approved polish decisions recorded in 94-08-SUMMARY.md. The D-decision intent still holds, so they are not gaps.
- The 2x2 quad became a one-row band on wide containers.
- The side column became a full-width mismatch action table.
- MR labels moved into the MR graph cell as pills.
- By type shows one square per issue.
- The header uses the V1 icon property row.

## D-ID coverage
D-01 to D-09, D-11 and D-13 to D-16 are all covered in the truths above. D-10 (matching the sketches) was satisfied by the user's approval after 12 rounds of review. D-12 (the description and facts behaviour referenced in the 94-07 plan) is covered by the `ReleaseDescription`/`ReleaseFacts` tests and the approval. No D-ID referenced in a plan frontmatter lacks evidence.

## Human verification (approved 2026-10-30)
These items were covered by the user's approval of the final page in the real Tauri app.
- Sticky header in WebKit.
- Recharts rendering.
- React Compiler staleness when switching releases.
- Container breakpoints and narrow layouts.

## Review
The 94-REVIEW.md findings were fixed. 94-REVIEW-FIX.md lists 11 fixes and the full suite passes.

## Anti-patterns
No TBD, FIXME or XXX markers in `release-detail/` or `release-refresh.ts`.

## Gaps
None.
