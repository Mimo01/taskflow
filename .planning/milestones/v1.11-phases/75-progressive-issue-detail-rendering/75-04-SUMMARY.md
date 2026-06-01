---
phase: 75-progressive-issue-detail-rendering
plan: "04"
subsystem: perf-verification / docs
tags: [perf-verification, human-verify, GH-CUT-02, TTFMP, TTI]
dependency_graph:
  requires:
    - 75-02 (TTFMP/TTI performance.mark/measure instrumentation)
    - 75-03 (invalidation fan-out — sections refresh correctly)
  provides:
    - GH-CUT-02 perf verification artifact (taskflow/docs/perf/75-issue-detail-progressive.md)
  affects: []
tech_stack:
  added: []
  patterns:
    - performance.measure read via console.table for desktop-WebView perf capture
requirements: [GH-CUT-02, PERF-DETAIL-01, PERF-DETAIL-02]
status: complete
---

# 75-04 Summary — GH-CUT-02 Performance Verification

## What was built

Recorded the GH-CUT-02 performance verification artifact at
`taskflow/docs/perf/75-issue-detail-progressive.md` from a live capture of the running
Tauri app against a live Jira instance.

- **Task 1 (auto):** Scaffolded the artifact with before/after sections, TTFMP/TTI rows,
  per-section latency rows, a gating-section line, and capture-method instructions.
- **Task 2 (human-verify, blocking):** Operator ran the app, captured the
  `console.table(performance.getEntriesByType('measure'))` output, and confirmed the
  progressive-render behaviour. Numbers transcribed into the artifact.

## Measured results (live capture, 2026-05-31, build aebc236f)

| Metric | Value |
|--------|-------|
| TTFMP (header visible) | **1180 ms** |
| TTI (last section resolved) | **1682 ms** |
| Section tail (TTI − TTFMP) | **502 ms** |
| Gating section | **Changelog (activity)** — `ActivityTimeline` render coincides with the TTI mark |

The header now paints ~500 ms+ before the panel is fully interactive, versus the pre-split
global gate where the header was invisible until the heaviest combined call resolved. Changelog
(the heaviest payload) is the last independent section to resolve, as RESEARCH predicted.

## Human verification

Operator confirmed (live app):
- Header paints first, before any section content.
- Comments / subtasks / activity each show a brief localized skeleton, then fill — no global spinner.
- Cache-hit reopen shows no skeleton flash (200 ms delayed-loading gate, D-06).

Not performed this run:
- Live error-isolation force-test (blocking a single section's request). Per-section `ErrorState`
  rendering + retry is covered by automated tests added in 75-02, and invalidation fan-out by
  the 75-03 tests; the manual force-failure pass was skipped by the operator.

## Self-Check

- [x] `taskflow/docs/perf/75-issue-detail-progressive.md` exists with TTFMP, TTI, and gating section filled
- [x] Capture method documented (75-02 `performance.measure` marks → `console.table`)
- [x] Before/after framing recorded (pre-split global gate vs post-split progressive)
- [x] Progressive-render behaviour operator-confirmed (PERF-DETAIL-01/02, D-06)
- [~] Live error-isolation force-test not performed; covered by automated per-section ErrorState tests (D-07)
- [x] Commits: artifact scaffold + live-numbers fill

## Commits

- `docs(75-04): scaffold GH-CUT-02 progressive-render perf verification artifact`
- `docs(75-04): record GH-CUT-02 live perf numbers (TTFMP 1180ms / TTI 1682ms, changelog gates)`
