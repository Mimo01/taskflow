---
phase: 54-aio-on-issue-detail
source: "54-05 Wave 4 human UAT (2026-05-13)"
status: open
plan_target: "54-06"
---

# Wave 4 UAT Findings — Phase 54

The 54-05 human verification surfaced two issues that block phase close. The originally built artifacts (section placement, step table layout, thumbnails, lightbox, collapsible blocks) work correctly. These two follow-ups are the remaining work.

## Finding 1 — Step content rendered as raw Jira wiki markup

**Symptom:** On real SHOP test runs, step `step`, `expectedResult`, and `actualResult` fields contain Jira wiki markup that is currently rendered as plain text in the step table. Example real content from a Failed step:

```
h4.*Steps*

||*S.No.*||*Step*||*Expected Result*||*Actual Result*||
|1. |Nacitanie eshop home page |Kontrola OK |Works as expected|
|2. |{color:#d04437}*FAILED:*{color} Plati pre tarify S, M, L: \\ • 5 GB (1000001, 5,13 €) |Kontrola OK |V kosiku mam Tarif M a zariadenie na splatky...
{panel}
# [img-a.png|https://jira.other.example/plugins/servlet/aio-tcms/bridge/tcms/browse?c_pId=100&page=run-details-attachment&params=%7B%22cycleId%22:1,%22caseId%22:2,%22runId%22:3,%22attachmentId%22:4,%22projectId%22:100%7D]
{panel}|
```

**Root cause:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:115-119` renders these fields as `{step.step}` text nodes. Probe finding B did not flag wiki markup because the inspected steps (run 12131, run 14733) had short plain-text content.

**Sub-issue (link navigation):** Inline `[file.png|https://jira.other.example/...]` patterns become markdown links. In the Tauri webview, clicking a standard `<a href>` navigates the webview in-place — the app is replaced by the Jira login page (no PAT-based session for the attachment servlet endpoint).

**Existing app pattern:** `taskflow/src/routes/dashboard/WikiRenderer.tsx` already handles every construct in the example above (tables via remark-gfm, `{panel}`, `{color}` via jira2md, headings, `*bold*`, `\\` linebreaks). It is used for issue descriptions. It does NOT currently customize `<a>` rendering — that gap needs closing.

**External link convention:** App uses `openUrl` from `@tauri-apps/plugin-opener` everywhere external Jira links are opened (e.g. `IssueDetailContent.tsx`, `MergeRequestDetailPage.tsx`, `SubtasksPanel.tsx`).

## Finding 2 — Slow load due to full cycle scan

**Symptom:** AIO section takes several seconds to populate on issue detail (perceived as blocking).

**Root cause:** `taskflow/src/services/aio/issue-runs.ts:87-125` (`fetchAioTestRunsForCycle`) paginates the entire active cycle's run list (`startAt` loop, all pages), then `AioTestRunsSection.tsx:226` filters client-side by `testCaseKey`. For large cycles (the production SHOP cycles span thousands of runs across many test cases), this is the bottleneck.

**User direction:** "load everything directly, do not load all and search."

## Unknowns to probe before implementation

The phase 54 probe (54-PROBE-FINDINGS.md) covered field names but not direct-lookup paths. Before coding, probe the live AIO instance for:

1. **Traceability response — discarded run linkage?**
   - Current code in `projects.ts:18-27` only extracts `item.test.ID`, `item.test.detail.key`, `item.test.detail.title`. Inspect a full raw response from `/rest/aio-tcms/1.0/project/{aioProjectId}/traceability/defect/{jiraIssueNumericId}` — does each item include `runs[]`, `executions[]`, `cycleKey`, or any run ID we can use to fetch run details directly without scanning the cycle?
2. **Direct run lookup by test case key?**
   - Try `GET /project/{projectKey}/testcycle/{cycleKey}/testrun?testCaseKey=SHOP-TC-8477` and `?testCaseID=68141`. Probe finding A confirmed `/testcase` ignores all params, but `/testrun` was not probed for filter params.
3. **Cross-cycle run search by test case?**
   - Is there an endpoint that returns runs for a test case across cycles (e.g. `/testcase/{caseKey}/testrun`)? If yes we could skip the cycle scan entirely.

If all three return negative, the optimization falls back to caching the cycle's run list aggressively (longer staleTime + background refetch) and parallelizing the steps fetch.

## Out of scope

- Step attachment thumbnails — probe B confirmed no `attachments` field in step responses on this instance (only inline image URLs inside the wiki text). The thumbnail UI built for 54-05 stays unused until/unless an instance exposes attachments.
- Editing test runs from issue detail (read-only contract).

## Test approach

- Wiki rendering: extend `AioTestRunsSection.test.tsx` with fixtures containing each construct (table, color, panel, attachment link, heading). Verify links call `openUrl` instead of navigating.
- Perf: probe-driven. If a direct endpoint exists, write a service test against the new endpoint shape. If not, write a test that the cycle scan is cached and not re-fired on repeat opens.
