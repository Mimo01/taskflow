---
phase: 54-aio-on-issue-detail
slug: aio-on-issue-detail
date: 2026-05-13
---

# Phase 54 Validation

Sourced from `54-RESEARCH.md § Validation Architecture`.

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=dot` |
| Full suite command | `cd taskflow && npm test` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| AIOI-01 | Section returns null when aioEnabled=false | unit | `cd taskflow && npm test -- issue-steps` |
| AIOI-01 | Section renders skeleton then data when aioEnabled=true | integration | `cd taskflow && npm test -- AioTestRunsSection` |
| AIOI-01 | Section hidden entirely when no AIO test cases linked | integration | `cd taskflow && npm test -- AioTestRunsSection` |
| AIOI-01 | Empty state shown when test cases linked but no cycle runs | integration | `cd taskflow && npm test -- AioTestRunsSection` |
| AIOI-02 | Step table renders Step/Expected/Actual/Status columns | integration | `cd taskflow && npm test -- AioTestRunsSection` |
| AIOI-02 | Status chip shows correct color class per status | unit | `cd taskflow && npm test -- issue-steps` |
| AIOI-02 | NOT_EXECUTED steps show `—` in Actual column | integration | `cd taskflow && npm test -- AioTestRunsSection` |
| AIOI-02 | Multiple test cases render collapsible blocks | integration | `cd taskflow && npm test -- AioTestRunsSection` |
| AIOI-03 | Thumbnail renders AuthImage with attachment URL | integration | `cd taskflow && npm test -- AioTestRunsSection` |
| AIOI-03 | Thumbnail click opens ImageLightbox with correct src | integration | `cd taskflow && npm test -- AioTestRunsSection` |

## Service Unit Tests (new module: issue-steps.ts)

| Test | Behavior | Automated Command |
|------|----------|-------------------|
| fetchAioTestCasesForIssue — 200 | Returns AioTestCase[] from paginated response | `cd taskflow && npm test -- issue-steps` |
| fetchAioTestCasesForIssue — 200 empty | Returns [] | `cd taskflow && npm test -- issue-steps` |
| fetchAioTestCasesForIssue — 401 | Throws ApiError | `cd taskflow && npm test -- issue-steps` |
| fetchAioTestCasesForIssue — 404 | Returns [] | `cd taskflow && npm test -- issue-steps` |
| fetchAioTestRunSteps — 200 | Returns AioTestRunStep[] | `cd taskflow && npm test -- issue-steps` |
| fetchAioTestRunSteps — 404 | Returns [] | `cd taskflow && npm test -- issue-steps` |

## Sampling Rate

| Gate | Command |
|------|---------|
| Per task commit | `cd taskflow && npm test -- --reporter=dot` |
| Per wave merge | `cd taskflow && npm test` |
| Phase gate | Full suite green before `/gsd-verify-work` |

## Wave 0 Test File Gaps

These test files must be created in Plan 54-00 (Wave 0) before implementation begins:

- [ ] `taskflow/src/services/aio/issue-steps.test.ts` — covers fetchAioTestCasesForIssue and fetchAioTestRunSteps (REQ AIOI-01, AIOI-02)
- [ ] `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` — covers section render, gating, empty states, step table, lightbox trigger (REQ AIOI-01, AIOI-02, AIOI-03)
- [ ] Live probe results for step field names and testcase issueKey param — must be documented as KEY DECISIONS in `54-PROBE-FINDINGS.md` before Wave 1

## Phase Gate Command

```bash
cd taskflow && npm test
```

All tests must be green before running `/gsd-verify-work` for Phase 54.
