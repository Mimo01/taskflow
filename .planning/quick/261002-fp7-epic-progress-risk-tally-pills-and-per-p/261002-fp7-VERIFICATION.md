---
phase: 261002-fp7
status: human_needed
score: 4/4 must-haves verified (code); visual checks pending
human_verification:
  - test: "Open an epic with 3-4 risks; view Risks card"
    expected: "Pills fit in the 1rem sub row without clipping/overflow, amber for warnings, muted for info, card height unchanged"
    why_human: "Visual layout"
  - test: "Hover and click each pill"
    expected: "Short tooltip on hover, popover on click, no tooltip flash after close"
    why_human: "Interaction behavior"
  - test: "Check per-person block"
    expected: "Divider, 'By person' heading and spacing clearly separate it from bar + legend"
    why_human: "Visual"
---

# 261002-fp7 Verification

**Status:** human_needed

## Truths
1. Value text and one pill per risk, no +N: VERIFIED (RisksTile maps all risks; RiskOverflow/epic-risk-more count 0).
2. Type icon, token, tone classes, data-severity, aria-label=risk.text: VERIFIED (RISK_PILL_TONE, token null omits span; deriveRisks tokens per type).
3. Tooltip and popover kept via TipPopover/RiskItem: VERIFIED in code; interaction is a human check.
4. Per-person block: VERIFIED (`mt-6 border-t pt-4`, "By person" heading, `mt-2` rows, data-testid epic-assignee-block).

## Checks run
- vitest (epic-progress.test, issue-detail, EpicDetailSheet.test): 15 files, 408 passed.
- tsc --noEmit: clean.
- biome check on 5 files: clean.
