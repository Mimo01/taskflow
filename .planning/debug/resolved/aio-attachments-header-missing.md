---
status: resolved
trigger: "UAT Test 2 Gap 2 - AIO attachments collapsible header absent on no-runs ESHOP issue"
created: 2026-05-14T00:00:00Z
updated: 2026-05-18
---

## Current Focus

hypothesis: CONFIRMED — Cascade from Gap 1. When `data.runs.length === 0` AND `data.impactedExecutions.length === 0`, the defensive guard at AioTestRunsSection.tsx:606 returns null for the entire <section>, including the AioAttachmentsGrid. Per UAT Gap 1, impacted executions are not flowing through (live API has 2 executions for ESHOP-393120 but `data.impactedExecutions` resolves to empty), so the guard fires and hides everything.
test: Code trace of render path + cross-reference UAT Gap 1 report + existing component test asserting this exact behaviour.
expecting: AioAttachmentsGrid renders at line 631 only when execution reaches line 612 return statement. Lines 595 and 606 are two short-circuit points that hide the entire section.
next_action: Return ROOT CAUSE FOUND diagnosis. Do NOT fix (goal: find_root_cause_only).

## Symptoms

expected: AIO attachments collapsible header is visible on no-runs ESHOP issue. When inline image refs exist in impactedExecutions step content, ≥1 thumbnail shows. When none exist, empty-state text shows inside the header.
actual: "i dont see the new section at all. inline aio images work" — header is absent entirely on ESHOP-393120.
errors: None reported.
reproduction: Open ESHOP-393120 (defect, jiraProjectID 10134, AIO project 13806). AIO test runs section renders but the AIO attachments collapsible header is absent.
started: Discovered 2026-05-14 during UAT for Phase 54.

## Eliminated

- hypothesis: AioAttachmentsGrid is gated on attachments.length > 0 (would hide header on empty state)
  evidence: AioAttachmentsGrid (lines 150-212) renders the collapsible <button> unconditionally and only branches on attachments.length === 0 INSIDE the expanded body (line 172) to show the empty-state text. The component itself is correct — it always renders the header and shows the empty-state inside when attachments is empty.
  timestamp: 2026-05-14T01:00:00Z

- hypothesis: AioAttachmentsGrid is rendered only inside the in-cycle branch (not under impacted-executions branch)
  evidence: At line 631, `<AioAttachmentsGrid attachments={aioAttachments} />` is placed AFTER the `hasInCycleRuns ? ... : <ImpactedExecutionsList />` ternary (lines 618-630) — so the grid IS rendered on both branches as a sibling of the run-list ternary. Placement is correct.
  timestamp: 2026-05-14T01:00:00Z

## Evidence

- timestamp: 2026-05-14T01:00:00Z
  checked: AioTestRunsSection.tsx render branches (lines 592-633)
  found: Three short-circuit points hide the section: (1) line 595 `if (data === null) return null` — no linked test cases; (2) line 598 `if (data === undefined) return null` — query not loaded; (3) line 606 `if (!hasInCycleRuns && !hasImpactedExecutions) return null` — defensive when both empty. AioAttachmentsGrid at line 631 is only reachable when execution proceeds past ALL three guards.
  implication: If `data.impactedExecutions` is empty (per Gap 1) AND `data.runs` is empty (no-runs path), line 606 returns null and the AioAttachmentsGrid is never rendered.

- timestamp: 2026-05-14T01:00:00Z
  checked: 54-HUMAN-UAT.md Test 1 (line 17-24) and Gap 1 (line 61-67)
  found: User confirms Gap 1 — for ESHOP-393120 the live API has 2 impacted executions (testRuns 263794, 263793) in cycle ESHOP-CY-1011 (ID 14041), but the UI shows none. This means `data.impactedExecutions` resolves to empty array in the queryFn for this issue.
  implication: Direct cascade confirmed — Gap 1 leaves impactedExecutions empty, which triggers line 606 short-circuit, which hides AioAttachmentsGrid.

- timestamp: 2026-05-14T01:00:00Z
  checked: AioTestRunsSection.test.tsx Test 4 (lines 201-216)
  found: Existing test "renders nothing (section hidden) when legacy path returns no usable runs and no impacted executions (Plan 54-07 D-04 second case)" — asserts `container.querySelector('[data-testid="aio-test-runs-section"]')` is null when both arrays are empty.
  implication: The line 606 guard is intentional code — it's tested and documented as D-04 second case. The contract violation is at the contract level: Gap 2 verification truth (54-VERIFICATION.md line 12) says the header should still render with empty state INSIDE, but the current implementation hides the entire section (including the header) when both data arrays are empty.

- timestamp: 2026-05-14T01:00:00Z
  checked: 54-VERIFICATION.md row 84 (data-flow trace) and Gap 2 contract
  found: Verification claims "empty-state header (Gap 2) — Always rendered when AIO data present, even when no inline image refs found". The qualifier "when AIO data present" is doing heavy lifting — the implementation defines "AIO data present" as `hasInCycleRuns || hasImpactedExecutions`. When both are false (Gap 1 cascade), the header is NOT rendered, contradicting the user-facing Gap 2 truth statement.
  implication: Two distinct things conflated in the design: (a) "linked test cases exist" (data !== null), and (b) "we resolved at least one runnable execution to render" (hasInCycleRuns || hasImpactedExecutions). The Gap 2 contract treats the header as a function of (a), but the code treats it as a function of (b).

## Resolution

root_cause: |
  AioTestRunsSection.tsx:606 short-circuits the entire <section> (including AioAttachmentsGrid)
  with `if (!hasInCycleRuns && !hasImpactedExecutions) return null;`. For ESHOP-393120, Gap 1
  leaves `data.impactedExecutions` empty (live API has 2 executions but the queryFn does not
  populate them) AND `data.runs` is empty (no-runs path), so the guard fires and the
  AioAttachmentsGrid at line 631 is never mounted. The Gap 2 contract requires the header to
  render whenever data is non-null (i.e. linked test cases exist), but the implementation only
  renders the section when at least one execution slot resolves. This is a direct cascade
  from Gap 1 (parallel debug session) combined with a design-vs-code mismatch on the
  "header always visible" contract.

fix: not_applied (goal: find_root_cause_only)
verification: not_applied (goal: find_root_cause_only)
files_changed: []
