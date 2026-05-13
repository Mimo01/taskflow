---
status: partial
phase: 54-aio-on-issue-detail
source: [54-VERIFICATION.md]
started: 2026-05-14T00:25:00Z
updated: 2026-05-14T00:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Gap 1 — Impacted executions list renders on no-runs path with real per-run status chips
expected: When an issue has linked test cases but no runs in the latest active (primary) cycle, the bare 'No test runs in active cycle' EmptyState is GONE and is replaced by a compact list showing one row per impacted execution (test case key + title, cycle key, run ID, colored status chip). Chip colors differ between PASS/FAIL/BLOCKED rows — not all gray 'Not Run'. Rows are read-only.
result: [pending]

### 2. Gap 2 — AioAttachmentsGrid populates on no-runs path
expected: On a no-runs ESHOP issue whose impacted-execution step content contains inline `[file.png|url]` refs, the 'AIO attachments' collapsible header is visible AND ≥1 thumbnail appears in the grid. When no inline image refs exist, the header still renders with the empty-state 'No inline image attachments found in linked test runs.' inside. Clicking a thumbnail opens the in-app ImageLightbox via the AuthImage bridge-URL translation path.
result: [pending]

### 3. Gap 3 — Nested wiki (`{panel}` with embedded `[name|url]` list) renders inside table cells
expected: Open an ESHOP issue whose failed test runs contain step content matching the verbatim Finding 1 fixture (`{panel}` block inside a `|cell|` table row). The step table renders without breaking — the panel content and the `VAS.png` text anchor render INSIDE the table cell. Clicking the link opens the in-app ImageLightbox (not the OS browser).
result: [pending]

### 4. ROADMAP SC end-to-end on a happy-path issue
expected: All four ROADMAP SCs visually confirmed on a real ESHOP issue (e.g. 393120): (1) section appears only when aioEnabled=true and loads lazily without blocking issue body; (2) step table renders Step/Expected/Actual columns with colored failure chips; (3) section is hidden (no error) when no AIO test cases linked; (4) attachment images open in the existing in-app ImageLightbox. Toggle aioEnabled OFF/ON to confirm gating.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
