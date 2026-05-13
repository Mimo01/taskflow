# Phase 53: Cycle Detail + Header Pinning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 53-Cycle Detail + Header Pinning
**Areas discussed:** Header tab integration, Progress bar data source, Test run list data shape, Defects display

---

## Header Tab Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the existing strip | Detect key format (CY- pattern), extend PinnedTabStrip with discriminated union, reuse all drag/reorder/unpin infrastructure | ✓ (Claude's discretion) |
| Separate pinned-cycles store + new strip | Second tab strip row below issue strip, new store | |
| You decide | Claude picks the approach | ✓ (user chose this) |

**User's choice:** "You decide" — delegated to Claude.

**Follow-up Q — Pin flow:** "Yes, that works" — pin button on cycle detail calls togglePin + stores meta. Tab click navigates to /aio-cycle route.

**Follow-up Q — Ordering:** "Yes, that works" — free reorder between issues and cycles, no grouping constraint.

**Claude's rationale:** Extending the existing strip reuses all drag/reorder/ghost/context-menu infrastructure (significant complexity to duplicate). Cycle keys (PROJ-CY-N) are structurally distinct and reliably detectable. Metadata (name + projectKey) stored at pin time — no extra API fetch.

---

## Progress Bar Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Count from test runs | Tally status strings from runs fetched for AIOC-02. Zero extra API calls. | ✓ (Claude's discretion) |
| Use /detail endpoint | One extra GET /testcycle/{key}/detail call. Schema unknown. | |
| Use /summary + /config | Two extra calls, status ID resolution required. | |

**User's choice:** "You decide" — delegated to Claude.

**Claude's rationale:** Test runs are already fetched for AIOC-02 (the run list). Counting them costs nothing extra. AioTestRun.status is human-readable. The /detail endpoint has unknown schema (researcher risk). The /summary + /config approach adds N+1 complexity that Phase 52 explicitly deferred.

---

## Test Run List Data Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Check docs first | Researcher verifies full AioTestRun response shape. Use inline fields if available; fall back to testcase endpoint if not. | ✓ |
| Fetch testcases endpoint in parallel | One extra paginated fetch. Deterministic but adds an API call regardless. | |
| Show test case key as label | Display PROJ-TC-5 instead of name. No extra fetch. | |

**User's choice:** "Check docs first (Recommended)" — researcher verifies API fields, falls back to testcase join only if needed.

**Follow-up Q — Status chips normalization:** "Normalize to standard labels" — NOT_EXECUTED → Not Run, PASS → Pass, FAIL → Fail, BLOCKED → Blocked. OR-logic multi-select filter chips.

---

## Defects Display

| Option | Description | Selected |
|--------|-------------|----------|
| Proceed if inline; descope if separate call | If defect keys are a field on AioTestRun, render them. If separate per-run endpoint required, descope AIOC-03. | ✓ |
| Proceed either way | Accept N+1 defect fetches for failed runs. | |
| Descope AIOC-03 entirely | Skip defects in Phase 53. | |

**User's choice:** "Proceed if inline; descope if separate call" — researcher determines which branch applies.

**Follow-up Q — Defects placement:** "Separate defects section below the run list (Recommended)" — deduplicated list of Jira issue keys, clickable links to /issue/:key.

---

## Claude's Discretion

- **Header tab integration:** Extend existing PinnedTabStrip with discriminated union. Cycle metadata stored at pin time in `pinnedCycleMeta`. Key detection via `/CY-/` pattern.
- **Progress bar data source:** Count from test runs (zero extra API calls).

## Deferred Ideas

- **AIOC-03 defects (if not inline):** Descoped if defects require a separate per-run endpoint.
- **Burndown / trend charts:** AIOCH-01/02 — explicitly out of scope (no time-series API data).
- **Real-time cycle status updates:** Not planned for this phase.
