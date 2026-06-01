# Phase 71: GreenHopper Adapter Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 71-greenhopper-adapter-foundation
**Areas discussed:** Adapter target shape, Module layout & imports, Entity-map resolver contract, Fixture strategy

---

## Adapter Target Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Existing JiraIssue (drop-in) | Reconstruct JiraIssue from jira.ts; lossy on GH-only fields (timeInColumn, color, flagged) | |
| New lean Issue + slim consumers | Define new app-internal Issue; rewrite ~60 imports incrementally | |
| JiraIssue superset | Return JiraIssue extended with optional GH-only fields; no consumer change, GH extras available | ✓ |

**User's choice:** "you decide" — Claude selected JiraIssue superset.
**Notes:** Matches hard-cutover-per-surface policy; phases 72-75 stay path-swap-only; GH-only data (timeInColumn etc.) remains accessible.

---

## Module Layout & Imports

| Option | Description | Selected |
|--------|-------------|----------|
| services/jira/greenhopper/ + re-export via jira.ts | Folder under services/jira/; public surface re-exported through legacy jira.ts; no import churn in 72-75 | ✓ |
| services/jira/greenhopper/ + deep imports | Folder, but phases 72-75 import from 'services/jira/greenhopper' directly | |
| Top-level services/greenhopper/ | Peer to jira/ and tempo/; splits conceptual Jira surface | |

**User's choice:** "you decide" — Claude selected re-export via jira.ts.
**Notes:** Respects the dual-file memory note (60 imports via jira.ts). Folder structure follows the established aio/ / tempo/ / jira/ pattern.

---

## Entity-Map Resolver Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Throw — fail loud | GH should never reference unknown IDs; throw on miss | |
| Fallback shim + warn | Synthesize 'Unknown' placeholder + console.warn; optional IDs return undefined | ✓ |
| Return undefined, caller decides | Resolver always returns undefined on miss; adapter chooses per field | |

**User's choice:** "you decide" — Claude selected fallback shim for required refs, undefined for optional refs.
**Notes:** One stale id should not crash the board. "Unknown" chips are visible self-reporting bugs. console.warn fires once per unique missing id per session.

---

## Fixture Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Real captures, anonymized + committed | One-shot capture against real GH endpoint; commit redacted JSON | |
| Handwritten minimal fixtures | TS-literal fixtures; no PII; risk of drift from real responses | |
| Hybrid: one captured + handwritten edges | Real anonymized happy-path + handwritten edges for missing IDs, subtasks, epics, estimate variants | ✓ |

**User's choice:** "you decide" — Claude selected Hybrid.
**Notes:** Success criterion #4 requires real-response fixtures. Edge fixtures stay stable and exercise the fallback-shim and optional-resolver paths.

---

## Claude's Discretion

User answered "you decide" on all four gray areas. Decisions are recommended in CONTEXT.md; the planner retains flexibility on internal naming, exact `EntityMaps` field names, the rapidViewId threading style for `greenhopperFetch`, and the `warnOnce` implementation.

## Deferred Ideas

- transitions.json caching → Phase 72
- allData / data caching → out of milestone scope
- details.json `Section.html` sanitization → Phase 75
- Network-log verification ("exactly one request") → per-phase verification in 73-75
- Rich details adapter (operations / sprint / tabs) → Phase 75
