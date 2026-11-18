---
phase: 102
source: 102-REVIEW.md
fixed: [CR-01, WR-01, WR-02]
deferred: [IN-01, IN-02, IN-03, IN-04, IN-05, IN-06, IN-07]
---

# Phase 102 code review fixes

| Finding | Status | Commit | Evidence |
|---------|--------|--------|----------|
| CR-01 Attach on an empty composer | Fixed | 82679775 | The empty composer collapsed whenever the window lost focus (window-blur reproduced in Playwright WebKit). It now ignores blurs while the window is unfocused, and the Attach button keeps focus on mousedown. Both new tests fail without the fix. |
| WR-01 Epic draft resumes into the active project | Fixed | fbed8e18 | Latches the draft's project for the session, as CreateEditIssueModal does. Two tests fail without the fix (`expected 'PROJ' to be 'OTHER'`). |
| WR-02 Story points sent while hidden | Fixed | 806b3b6d | When createmeta is unknown the row now stays visible, matching the builder and labelsOffered. The test fails without the fix. |
| IN-01..IN-07 | Deferred | — | Info only. IN-05 (the scroll fix also runs on the first load and on Reply) and IN-06 (a whitespace-only draft is hidden on collapse) are worth revisiting if users notice them. |
