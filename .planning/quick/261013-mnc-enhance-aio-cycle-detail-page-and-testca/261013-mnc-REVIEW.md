# 261013-mnc Code Review (quick depth, advisory)

Reviewer returned findings inline; orchestrator recorded them here. Blockers spot-checked against source.

## Blockers
- **CR-01** AioCycleDetailPage.tsx:108/160/183 — cycle loads but runsQuery errors → neither error block nor content renders (blank body, no retry). VERIFIED. Pre-existing gating shape (old page also required !runsQuery.isError), not a regression — still worth fixing: gate whole-page error on cycleQuery only; let ExecutionsList show runs error/retry.
- **CR-02** aioUtils.ts:84-96 + useAioCycleData status-map query — initializeAioStatusMap swallows errors, queryFn returns true, cached 1h → all statuses Not Run after transient /config failure; map is a module global not keyed by project. VERIFIED. Pre-existing (6efe14b7).

## Warnings
- WR-01 RunSidebar "Back to cycle" NavLink doesn't pop breadcrumb trail → trail includes cycle itself, grows per round-trip.
- WR-02 Run detail ArrowLeft/Right fires with Cmd/Alt/Ctrl/Shift, in SELECT/role=radio targets; effect has no dep array.
- WR-03 jiraProjectIdQuery error → runs never run → "No runs match filters" + tiles skeleton forever.
- WR-04 DefectsList key NavLink active for unresolved rows → navigates to /issue/<numeric id>; onOpenIssue fallback is a silent no-op.
- WR-05 Selected "In progress" chip vanishes when count→0; filter stuck, radiogroup unreachable by keyboard.
- WR-06 issue-steps: unknown status ID ignores name fallback; n/a → PASS mapping questionable.
- WR-07 new Date(x).toISOString() throws on bad epoch; relativeTime throws on NaN.

## Info
- IN-01 defect key sort should use localeCompare numeric.
- IN-02 duplicate React keys for repeated custom-field names / empty-id trigger chips.
- IN-03 run page fires unused summaries/status-map queries via useAioCycleData.
- IN-04 one Jira fetch per defect (unbounded) — out of scope.
