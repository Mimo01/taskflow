---
status: passed
---

# Verification: Quick Task 260317-ric

**Task:** Redesign linked issues and merge requests on issue detail
**Verified:** 2026-03-17

## must_haves Check

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Linked issues grouped by link type label | PASS | `groupedLinks` useMemo at line 277, rendered with `Array.from(groupedLinks.entries()).map()` at line 596 |
| 2 | Each linked issue shows as compact card with status color dot and colored status badge | PASS | Card buttons at lines 601-613 with `statusDotColor()` and `statusBadgeClasses()` helpers |
| 3 | Each MR shows as compact card with author avatar, source branch, and state color | PASS | MR cards at lines 635-662 with two-row layout: title + state badge, then avatar + branch + reviewers |
| 4 | MR state badges use green for open, purple for merged, gray for closed | PASS | `mrStateClasses()` at line 158 returns correct color classes per state |
| 5 | Linked issue cards are clickable to open the target issue | PASS | `onClick={() => onOpenIssue?.(target.key)}` at line 604 |
| 6 | MR cards open web_url in external browser on click | PASS | `onClick={() => openUrl(mr.web_url)}` at line 638 |

## Artifacts Check

| Artifact | Exists | Provides |
|----------|--------|----------|
| IssueDetailSidebar.tsx | YES | Redesigned linked issues and merge requests sections |

## Key Links Check

| From | To | Pattern | Status |
|------|----|---------|--------|
| Linked issues section | onOpenIssue callback | `onOpenIssue.*target\.key` | PASS |
| MR section | openUrl | `openUrl.*mr\.web_url` | PASS |

## Result

**PASSED** — All 6 must_haves verified, all artifacts present, all key links intact.
