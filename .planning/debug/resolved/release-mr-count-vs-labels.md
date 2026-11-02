---
status: resolved
trigger: "On release detail page, the merge request count shows fewer mrs than the labels"
created: 2026-11-02
updated: 2026-11-02
---

# Debug: release-mr-count-vs-labels

## Symptoms

- **Expected:** The MR donut total (centre count) on the release detail page should be consistent with the label pills shown beside it.
- **Actual:** The donut centre count shows fewer MRs than the label pills add up to.
- **Errors:** None reported.
- **Scope:** All releases.
- **Timeline:** Started after a recent change (candidate: 261102-ers "show all MR labels, no +N cap", and 261102 MR donut layout work — legend centred under ring, label pills right + top-aligned).
- **Reproduction:** Open any release detail page; compare MR donut centre count with the sum/counts on the label pills.

## Notes for investigator

- Determine first whether this is a real counting bug (MRs dropped / filtered / deduped incorrectly, pagination cap — see memory "Fetch-once page-cap pitfall") or expected overlap (one MR carrying several labels, so pill counts legitimately sum to more than the MR total). If it is overlap-by-design, report that rather than "fixing" it, and propose a display option.
- Related memory: feedback_mr_donut_layout.md, feedback_show_all_labels_no_collapse.md, feedback_release_detail_design_prefs.md.
- App source lives in the inner taskflow/taskflow/ dir (npm, vitest, biome there).

## Current Focus

- hypothesis: two causes, both by design/deliberate: (1) label pill counts are per-label (an MR with N labels counts in N pills); (2) pills are counted over the three-channel union (driftRows) while donut centre counts milestone MRs only (releaseMrs)
- next_action: await user decision on display (checkpoint returned); no code changed

## Evidence

- useReleaseDetail.ts:665-667: labelSummary/labelCoverage = computeLabelSummary(driftRows.map(r=>r.mr)); mrStateCounts = computeMrStateCounts(releaseMrs) (milestone MRs only). Different sets.
- releaseSummaries.ts:113-133: computeLabelSummary increments once per (MR,label) pair -> multi-label MRs counted in each pill.
- Commits ac622d71 and e78d7136 deliberately moved pills/no-label to the union set so pill count matches the task-table filter.

## Eliminated

## Resolution

- root_cause: MR donut centre/state counts were computed over milestone-only MRs (channel B) while label pills/no-label warning/task filter use the three-channel union (driftRows). Union is larger when branch-only or fix-version-only MRs exist.
- fix: useReleaseDetail.ts now computes mrDonutCounts and mrStateCounts over the deduped union (driftRows.map(r=>r.mr)). Pills and per-label counting unchanged; Releases list untouched.
- verification: new test 'MR donut total equals the three-channel union' fails pre-fix (open=0 vs 1), passes post-fix; src/routes/dashboard vitest 1749 passed; biome + tsc clean.
- files_changed: taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts, useReleaseDetail.test.tsx
- commit: 295f28ee
- user_verified: 2026-11-02 (approved)
- follow_up_not_done: donut empty-state check in ReleaseDetailPage.tsx still uses milestone-only MRs ("No merge requests in this milestone yet")
