---
phase: quick-261002-h9e
verified: 2026-10-02T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Open a real issue whose Description was edited, switch Activity to Changes"
    expected: "Toggle shows +N / -M words; expanding shows Before|After with red/green words; status rows show pills; Jira's real item shapes (Sprint, Fix Version per-value items, Link, Attachment) render sensibly"
    why_human: "Visual layout and live Jira changelog shapes cannot be checked by grep or unit tests. The plan itself lists this manual sanity check"
---

# Quick 261002-h9e Verification

**Goal:** Changes tab shows side-by-side diffs, chips, +/- tokens, burst grouping and a label column.
**Status:** human_needed. All automated checks pass.

## Automated checks (run by verifier)
- `npx vitest run src/routes/dashboard/issue-detail/`: 15 files, 265 passed, 2 skipped.
- `npx tsc --noEmit`: clean.
- `npx biome check` on the 5 touched files: clean.
- `diff@^9.0.0` is in `dependencies` and in the lockfile. The summary records Task 0 as approved.
- `dangerouslySetInnerHTML` and `WikiRenderer` are not used in ChangelogEntry.tsx. The only grep hit is a comment.

## Truths
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Long text collapsed behind "Show changes (+N / −M words)" with a preview. Expanding shows Before/After, red and green, stacked at narrow widths | VERIFIED | `LongTextDiff` and `DiffColumn` use `grid-cols-1 sm:grid-cols-2`. `wordDiff` is memoised. There is a whitespace-only branch and a `maxEditLength` fallback. Test at ChangelogEntry.test.tsx:83 |
| 2 | Short fields render old (muted, line-through) → new with ∅ for an empty side. Status uses `statusPillClass` in a flex parent | VERIFIED | `ShortChange` and `StatusChangeValue` (wrapper `flex items-center`). Tests at lines 38, 55 and 73 |
| 3 | Multi-value fields render +/− chips, with items merged per field within a group | VERIFIED | `MultiValueChange` and `mergeGroupItems` (token accumulation and cancellation). Tests at lines 116 (render) and 134 (merge) |
| 4 | Same-author edits within 5 minutes with nothing between them render as one block | VERIFIED | `groupChangeBursts` compares adjacent gaps, and NaN timestamps never merge. Tests cover comment, author and 6-minute splits and chaining |
| 5 | Fixed-width icon + label column. Short and multi rows stay on one line | VERIFIED | `ItemRow` uses `flex-none w-32` with an icon map. Short and multi rows use `truncate` and `whitespace-nowrap` |
| 6 | Unknown shapes fall back to the short chip. Nothing throws or drops data | VERIFIED | `str()` guards, the `?? []` default, and an empty-token fallback to `ShortChange`. Test "does not throw on unknown shapes" |
| 7 | Filter chip counts are unchanged | VERIFIED | `counts = countByType(allEntries)` is untouched. Grouping runs on the unfiltered sorted list, before the type filter (ActivityTimeline.tsx) |

## Key links
- ActivityTimeline calls `groupChangeBursts(sortedEntries)` before filtering. WIRED.
- changelogDiff calls `diffWords` with `maxEditLength` and handles an undefined result. WIRED.
- ChangelogEntry calls `useJiraStatusList` only inside `StatusChangeValue`. WIRED.

## Anti-patterns
No TBD, FIXME or TODO markers. No stubs. No unused `filterTimeline` import was left in ActivityTimeline.

## Minor observations (non-blocking)
- `mergeGroupItems` returns `from === to` for a short field that goes A→B→A and shows "A → A". This is cosmetic and could be dropped.
- Multi-value tokens are not de-duplicated across the per-value `Link` or `Attachment` items beyond the set logic. This is acceptable.

## Human verification required
See the frontmatter. A visual check in the running app against a real Jira issue is needed to confirm the layout and the real changelog shapes. The shapes were flagged UNVERIFIED in the plan.
