---
status: human_needed
score: 7/7 must-haves verified (automated); visual check pending
human_verification:
  - test: "Open a release detail with uncovered MRs (npm run tauri dev); narrow the window"
    expected: "Header shows count + reason chips; each row is one line (reason pill, key, title, author, reviewers, state pill, BR/MS); author name collapses to avatar under 860px, reviewers drop under 640px, reason pill under 520px, state under 400px; nothing wraps"
    why_human: "Layout, container-query behaviour and visual polish are not checkable via grep or jsdom"
---

# Quick 261102-fkr Verification

Commit 29360ad5 checked against the code. SUMMARY claims were not relied on.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Reason pill replaces key glyph | VERIFIED | `SecondaryReasonPill` has testid `secondary-reason-pill` with `data-reason`. Labels are No task / Not in version / Not evaluated. `<AlertTriangle>` is removed from the secondary-key-flagged span. The pill is passed as `reasonCell`. |
| 2 | Author (avatar + name) and all reviewers | VERIFIED | `MrAuthorCell` reuses `COL_PERSON`, so the name is sr-only below 860px and the avatar stays. `MrReviewersCell` maps every reviewer to a `CachedAvatar` with no `+N` cap, a title "Reviewers: ...", and an em-dash fallback. `gitlab.ts` types `avatar_url?`. |
| 3 | State pill with Draft precedence | VERIFIED | `mrStateLabel` returns Draft only when `state === 'opened' && draft`, else Open / Merged / Closed / Locked. `MrStatePill` has testid `secondary-mr-state`. |
| 4 | Header count + reason chips from the displayed rows | VERIFIED | Counts are computed over `filteredSecondaryRows`. Zero-count chips are filtered out. Chips have testids `secondary-reason-chip-*`. The h4 text is unchanged. |
| 5 | One line per row, columns drop | VERIFIED (code) | Fixed-width `flex-none` columns with `@max-[...]:hidden`. The summary is `truncate`. The header strip uses the same constants. Visual confirmation is deferred to the human check. |
| 6 | No branches, labels or dates added | VERIFIED | The diff adds none. |
| 7 | Existing behaviour preserved | VERIFIED | `TaskMrCell` still renders raw `mr.state`; only the class ternary was extracted. `TaskRow` and `driftDetection.ts` are untouched. Key-cell testids and titles are unchanged. All 123 tests in the file pass, including the pre-existing ones. |

T-91.1-14: `secondaryReason` maps `taskReason` null to 'unevaluated', never to a drift reason.

## Spot-checks run

- `vitest run UnifiedTaskTable.test.tsx`: 123/123 pass.
- `tsc --noEmit -p .`: clean.
- `biome check` on the 3 touched files: clean.

## Anti-patterns

No TBD/FIXME/XXX introduced in the diff. No stubs.

## Gaps

None. Only the visual and responsive check above remains.
