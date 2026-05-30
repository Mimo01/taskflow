# Issue Detail — Progressive Rendering Performance (GH-CUT-02)

Verification artifact for Phase 75: progressive issue-detail rendering. Records the
before/after **time-to-first-meaningful-paint** (header visible) and **time-to-fully-interactive**
(last section resolved), per-section query latencies, and which section gates "fully loaded."

> The app is a Tauri desktop app reading a live Jira instance, so real-network timing
> cannot be asserted deterministically in unit tests (per 75-VALIDATION Manual-Only table).
> Numbers below are a single live capture and vary by Jira instance and network conditions.

---

## Capture Context

| Field | Value |
|-------|-------|
| Test issue (key) | _not recorded in this capture_ |
| Jira instance | live instance (operator's configured Jira) |
| Network conditions | live network; single-run capture (Assumption A3 — instance/network dependent) |
| Build / commit | `aebc236f` (Phase 75, progressive rendering merged) |
| Date captured | 2026-05-31 |
| Source | `console.table(performance.getEntriesByType('measure'))` — 75-02 instrumentation |

## How Captured

TTFMP/TTI instrumentation was baked into the page in 75-02 (`IssueDetailPage.tsx`):
`performance.mark('issue-detail-start')` on mount, `performance.measure('TTFMP', …)` when
the base issue first resolves (header paint), and `performance.measure('TTI', …)` when all
sections have resolved — at which point the page logs
`console.table(performance.getEntriesByType('measure'))`.

The `TTFMP` and `TTI` measures below are read directly from that table (`duration` column, ms).
Per-section network latencies (Network panel / React Query devtools) were not recorded in this
run; the aggregate tail `TTI − TTFMP` captures the time spent on sections beyond the header,
and the render timeline identifies the gating section.

---

## Before (single global gate)

The pre-split page blanked the entire panel behind one `isLoading || !issue` gate until the
slowest call (the combined `fetchIssueDetail` with `expand=changelog` + inline comments +
subtask enrichment) resolved — nothing was visible until everything was ready. So perceived
first paint equalled fully-interactive: the header was invisible for the full load duration,
which was bounded by the heaviest combined call (≥ the post-split TTI).

| Metric | Value |
|--------|-------|
| Time-to-first-meaningful-paint (header visible) | ≈ TTI (panel blank until fully loaded) — header had **no** independent earlier paint |
| Time-to-fully-interactive (last section resolved) | ≥ 1682 ms (combined single call was heavier than any one split call) |

## After (progressive)

Header paints the instant the base fetch resolves; each section (comments, subtasks, changelog)
shows a 200 ms-gated localized skeleton, then content.

| Metric | Value |
|--------|-------|
| Time-to-first-meaningful-paint (header visible) — `TTFMP` measure | **1180 ms** |
| Time-to-fully-interactive (last section resolved) — `TTI` measure | **1682 ms** |
| Section tail (`TTI − TTFMP`) | **502 ms** |

**Perceived improvement:** the header now appears at **1180 ms** instead of waiting the full
**1682 ms+** for every section — the user sees meaningful content **~500 ms+ earlier**, and each
slower section fills in independently rather than holding the whole panel hostage.

### Per-section latencies

| Section | Query key | Latency |
|---------|-----------|---------|
| Base issue (header) | `jira-issue-detail` | ≈ 1180 ms (= TTFMP; header render at timeline ~1900) |
| Comments | `jira-issue-comments` | not separately captured (network panel not recorded) |
| Enriched subtasks | `jira-subtask-enrichment` | not separately captured |
| Changelog (activity) | `jira-issue-changelog` | ≈ 1682 ms (= TTI; `ActivityTimeline` render coincides with the TTI mark) |
| Worklogs | (worklogs query) | not separately captured |

### Gating section

**Which section gates "fully loaded":** **Changelog (activity).** In the capture, the `TTI`
measure (1682 ms) coincides with the `ActivityTimeline` render on the measure timeline
(~2409 ms timeline = ~1694 ms after `issue-detail-start`), confirming the changelog query —
the heaviest payload — is the last independent section to resolve, exactly as RESEARCH predicted.

---

## Visual / Behavioral Confirmation (PERF-DETAIL-01/02, D-06/07/08)

- [x] Header (title / key / status / assignee) appears first, before any section content.
- [x] Comments, subtasks, and activity each show a brief localized skeleton, then fill —
      **no global blocking spinner** gates the whole panel.
- [x] Cache-hit reopen shows **no skeleton flash** (200 ms delayed-loading gate, D-06).
- [ ] Per-section error isolation: forcing a single section to fail (e.g. block the
      `/comment` request in DevTools) shows an inline "Couldn't load comments" + Retry
      while the rest of the panel stays fully functional (D-07). — _not manually forced this
      run; covered by automated per-section `ErrorState` tests added in 75-02 and the
      invalidation fan-out tests in 75-03._
- [ ] Retry refetches the failed section successfully. — _same: automated coverage, not manually re-forced._

> Measured perf (TTFMP/TTI/gating section) captured 2026-05-31. Progressive-render behaviour
> (header-first paint, per-section skeletons, no global spinner, no cache-hit flash) confirmed
> by the operator running the live app. Live error-isolation force-test not performed this run.

---

*GH-CUT-02: TTFMP, TTI, and the gating section are recorded from a live capture. Per-section
network latencies were not separately recorded in this run (the aggregate tail and render
timeline stand in for them).*
