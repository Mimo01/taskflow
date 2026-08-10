# Phase 85: Sprint Insights (Conditional — Probe-Gated) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 85-sprint-insights-conditional-probe-gated
**Areas discussed:** Probe execution model, Committed-data source, Velocity scope & N, Chart form & placement

---

## Probe Execution Model

| Option | Description | Selected |
|--------|-------------|----------|
| You run probes, paste results | Claude generates exact commands/script using the user's PAT; user runs against live DC and pastes JSON; Claude documents outcomes before planning | ✓ |
| Probe-as-first-plan, you execute | Planning produces a Plan 1 'Probe' (in-app harness/dev-tools button) the user runs to gate later plans | |
| Build behind runtime feature-detect | Skip upfront probe; build both charts to self-probe at runtime | |

**User's choice:** You run probes, paste results.
**Notes:** Claude built a self-discovering `probe.sh` (board → closed sprints → SP field → active sprint → all gating endpoints). User ran it against `https://jira.corp.sk`/`PROJ`. All three probes PASSED — results recorded in CONTEXT `<probe_results>` (criterion 1 satisfied at discuss time). Landmines surfaced: closed-sprint ascending ordering (Probe A), sparse SP (Probe B), time-based burndown unit (Probe C).

---

## Committed-Data Source (velocity)

| Option | Description | Selected |
|--------|-------------|----------|
| Add GreenHopper sprintreport probe | Probe rapid/charts/sprintreport for true committed vs completed | |
| Approximate from final state | committed = all assigned SP in closed sprint; completed = done SP — from the prescribed agile endpoint | ✓ (Claude decided) |
| Completed-only (drop 'committed') | Show only completed velocity trend | |

**User's choice:** "You decide."
**Notes:** Claude chose personal-scoped approximation from the agile endpoint — sprintreport is team-level/non-per-assignee, so it can't serve a *personal* committed-vs-completed split. committed = my final-assigned SP, completed = my done SP, with a mandated inline caveat comment (not start-of-sprint commitment). Avoids a third probe.

---

## Velocity Scope & N

| Option | Description | Selected |
|--------|-------------|----------|
| Personal, last 6 closed | displayName-scoped, 6 most-recent closed sprints (min 3) | ✓ (Claude decided) |
| Personal, last 8 closed | Same scope, deeper 8-sprint window | |
| Whole-sprint velocity, last 6 | Team velocity (conflicts with INSIGHT-01 'personal') | |

**User's choice:** "You decide."
**Notes:** Claude chose personal, last 6 — matches INSIGHT-01 'personal' literally; 6 keeps the `p-limit(3)` fan-out cheap. Probe A's ascending-order landmine means fetching the most-recent (not first-page) closed sprints.

---

## Chart Form & Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Leave form to my discretion | Coherent defaults consistent with Phase 83/84; user reviews CONTEXT | ✓ |
| Discuss chart specifics | Nail down chart types, axes, message wording, exact placement | |

**User's choice:** Leave form to Claude's discretion.
**Notes:** Defaults — velocity = overlaid/grouped bars (committed faint / completed filled); burndown = remaining-time line/area from `.changes` + `.workRateData` (hours axis per Probe C); both appended at Dashboard bottom with independent degradation.

## Claude's Discretion

- Velocity & burndown chart types and exact visual treatment.
- Dashboard placement/order and component decomposition (`VelocityChart`/`BurndownChart` vs inline).
- "<3 closed sprints" explanatory message wording.

## Deferred Ideas

- True team velocity via GreenHopper `sprintreport` (team-level, not personal).
- Points-based burndown (this DC's burndown is time/hours).
- Configurable N for the velocity window.
- Backfilling SP on legacy sprints (out of scope; <3-guard covers sparse data).
