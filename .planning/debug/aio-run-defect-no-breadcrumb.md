---
status: resolved
trigger: "On AIO cycle run detail when I click on defect, the run is not saved into breadcrumb trail so I can't go back"
created: 2026-05-18
updated: 2026-05-18
---

## Symptoms

- **Expected:** Navigate to defect page and have the AIO run appear in the breadcrumb trail so you can navigate back
- **Actual:** Goes to the defect page but the breadcrumb trail doesn't include the AIO run — no way to go back
- **Errors:** No console errors
- **Timeline:** Happens every time (100% reproducible)
- **Reproduction:** AIO project → open a cycle → open a run detail → click on a defect in the defects section

## Current Focus

hypothesis: "DefectRow onOpen handler in AioTestRunDetailPage called navigate() directly without pushing to breadcrumb store first"
test: "clicking a defect row pushes the run page onto the breadcrumb trail before navigating"
expecting: "trail has 1 entry with label='Run {runId}' and path matching the run URL"
next_action: "done"
reasoning_checkpoint: "AioCycleDetailPage.openDefect shows the correct pattern: push then navigate. AioTestRunDetailPage was missing the push step entirely."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-18
  file: taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
  observation: "onOpen prop at line 413 was `(key) => navigate('/issue/${key}')` — no breadcrumb push"
- timestamp: 2026-05-18
  file: taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  observation: "openDefect (lines 669-672) correctly does push({ label: cycleName, path: location.pathname }) then navigate — the pattern to mirror"

## Eliminated

- No console errors — ruled out data-fetching or routing errors
- Breadcrumb store itself works correctly (push/pop verified by existing tests)

## Resolution

root_cause: "AioTestRunDetailPage.DefectRow.onOpen called navigate() directly without first calling useBreadcrumbStore.getState().push(), so the run page was never saved into the trail before navigating to the issue detail page."
fix: "Added useLocation hook, extracted openDefect helper that pushes { label: 'Run {runId}', path: location.pathname } before navigating — mirrors the AioCycleDetailPage.openDefect pattern exactly."
verification: "9/9 tests pass including new test 'clicking a defect row pushes the run page onto the breadcrumb trail before navigating'"
files_changed: "taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx, taskflow/src/routes/dashboard/AioTestRunDetailPage.test.tsx"
