---
phase: quick-261001-sqm
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 6/6 must-haves verified (automated)
human_verification:
  - test: "Drag the Brush handles on both charts in the real Tauri app (light and dark)"
    expected: "Strip is neutral, range follows the drag, preset deselects, zoom persists across Count/Time tabs"
    why_human: "Recharts Brush cannot render in jsdom (ResponsiveContainer has no size); only wrapper data-x-from/to and presets are unit-tested"
  - test: "Check Time chart status colours and CFD Remaining line legibility"
    expected: "Logged=done, Remaining=in progress, Estimate=to do are legible; 2px CFD Remaining distinguishable from in-progress area edge"
    why_human: "Visual"
  - test: "Click and keyboard-activate risk keys in the Risks popover; hover then click the Risks tile"
    expected: "Opens the issue, no flicker on hover-then-click"
    why_human: "Real popover and hover behaviour"
---

# Quick 261001-sqm Verification

**Goal:** Epic progress iteration 7 (Risks with clickable keys, hero-tooltip data sources, shared x-domain, shared zoom, ConfidenceMeter, status-coloured Time series).
**Status:** human_needed (automated checks all pass)

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Risks popover with real key buttons calling onOpenIssue, +N more, RISK_VISIBLE_KEYS | VERIFIED | EpicProgressSummary.tsx uses Popover/PopoverTrigger with openOnHover; slice by RISK_VISIBLE_KEYS, aria-expanded button, onOpenIssue?.(key); IssueDetailContent.tsx:319 threads onOpenIssue; no moreKeys or RISK_MAX_KEYS left in src |
| 2 | No chart footers; Data sources block in hero tooltip; flag only for approximate history | VERIFIED | No epic-cfd-note in non-test source; `data-slot="tooltip-source"` at Summary:140; Section passes sourceFlag from HISTORY_SOURCE_TEXT, null for real |
| 3 | One shared x-domain and ticks | VERIFIED | Section computes chartDomain once and passes the same zoom to both charts; both charts use `domain={[dateKeyMs(from), dateKeyMs(to)]}`, allowDataOverflow, axisTicks; no 'dataMin' left; padToDomain on both datasets |
| 4 | Brush plus presets, state lifted, persists across tabs | VERIFIED (code and unit tests); visual drag is human | Zoom state in EpicProgressSection (useState before early returns), Brush in both charts, ZoomPresets in both |
| 5 | ConfidenceMeter wherever confidence appears | VERIFIED | Used in Finish tile, Finish tooltip, per-part rows, chart tooltip (with confidenceReason) and forecast legend |
| 6 | Time series status-coloured, shared Remaining | VERIFIED | epic-markers.tsx: logged=done, remaining=indeterminate, estimate=new, with status-line and status-area markers; forecast and band stay neutral |

## Behavioural checks

- vitest (epic-progress lib, tooltip-body, issue-detail dir, EpicDetailSheet, IssueDetailContent): 16 files, 357 passed, 2 skipped, 0 failed.
- `npx tsc --noEmit`: clean (exit 0).
- biome: 8 warnings only, no errors (baseline drift; not attributed to this task).
- No TODO/FIXME/TBD/XXX in the new files.

## Notes

- Deviations in SUMMARY (rangeIndexes semantics, epoch Brush key, null-domain fallback) are plausible and covered by tests. The Brush remount-by-epoch approach is only exercised in a real browser, so it is included in the human items.

## Gaps

None.
