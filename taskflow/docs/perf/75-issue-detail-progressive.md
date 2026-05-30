# Issue Detail — Progressive Rendering Performance (GH-CUT-02)

Verification artifact for Phase 75: progressive issue-detail rendering. Records the
before/after **time-to-first-meaningful-paint** (header visible) and **time-to-fully-interactive**
(last section resolved), per-section query latencies, and which section gates "fully loaded."

> **Status:** Scaffold — numeric cells await a live capture (Task 2, human-verify).
> The app is a Tauri desktop app reading a live Jira instance, so real-network timing
> cannot be asserted deterministically in unit tests (per 75-VALIDATION Manual-Only table).

---

## Capture Context

| Field | Value |
|-------|-------|
| Test issue (key) | `TODO — issue with a non-trivial comment thread + subtasks + active changelog` |
| Jira instance | `TODO — instance host` |
| Network conditions | `TODO — e.g. office LAN / VPN / home; latency is instance- and network-dependent (Assumption A3)` |
| Build / commit | `TODO — git short SHA of the build under test` |
| Date captured | `TODO` |

## How Captured

The TTFMP/TTI instrumentation was baked into the page in 75-02
(`IssueDetailPage.tsx`): `performance.mark('issue-detail-start')` on mount,
`performance.measure('TTFMP', …)` when the base issue first resolves (header paint),
and `performance.measure('TTI', …)` when all sections have resolved. When TTI fires,
the page calls `console.table(performance.getEntriesByType('measure'))`.

1. Run the app: `cd taskflow && npm run dev` (or the tauri dev command), connected to live Jira.
2. Open DevTools console. Navigate to the test issue (record its key above).
3. Read the `console.table(...)` output for `TTFMP` and `TTI` (`duration` column, ms).
4. Read per-section latencies from the Network panel / React Query devtools
   (base `jira-issue-detail`, `jira-issue-comments`, `jira-subtask-enrichment`,
   `jira-issue-changelog`, worklogs).
5. Note which section resolves last — that section gates "fully loaded".

---

## Before (single global gate)

The pre-split page blanked the entire panel behind one `isLoading || !issue` gate until
the slowest call (changelog expand) resolved — nothing was visible until everything was ready.

| Metric | Value |
|--------|-------|
| Time-to-first-meaningful-paint (header visible) | `TODO` (qualitatively: equal to TTI — panel was blank until fully loaded) |
| Time-to-fully-interactive (last section resolved) | `TODO` |

> If a pre-split build is not readily available, record the qualitative before-state
> (panel blank until the slowest call) and capture only the "After" numbers below.

## After (progressive)

Header paints the instant the base fetch resolves; each section (comments, subtasks, changelog)
shows a 200 ms-gated localized skeleton, then content.

| Metric | Value |
|--------|-------|
| Time-to-first-meaningful-paint (header visible) — `TTFMP` measure | `TODO` ms |
| Time-to-fully-interactive (last section resolved) — `TTI` measure | `TODO` ms |

### Per-section latencies

| Section | Query key | Latency |
|---------|-----------|---------|
| Base issue (header) | `jira-issue-detail` | `TODO` ms |
| Comments | `jira-issue-comments` | `TODO` ms |
| Enriched subtasks | `jira-subtask-enrichment` | `TODO` ms |
| Changelog (activity) | `jira-issue-changelog` | `TODO` ms |
| Worklogs | (worklogs query) | `TODO` ms |

### Gating section

**Which section gates "fully loaded":** `TODO — confirm during capture`
(RESEARCH expects **changelog**, the heaviest expand payload, to resolve last.)

---

## Visual / Behavioral Confirmation (PERF-DETAIL-01/02, D-06/07/08)

- [ ] Header (title / key / status / assignee) appears first, before any section content.
- [ ] Comments, subtasks, and activity each show a brief localized skeleton, then fill —
      **no global blocking spinner** gates the whole panel.
- [ ] Cache-hit reopen shows **no skeleton flash** (200 ms delayed-loading gate, D-06).
- [ ] Per-section error isolation: forcing a single section to fail (e.g. block the
      `/comment` request in DevTools) shows an inline "Couldn't load comments" + Retry
      while the rest of the panel stays fully functional (D-07).
- [ ] Retry refetches the failed section successfully.

---

*GH-CUT-02 satisfied when every `TODO` cell above is filled from a live capture and the
behavioral checklist is confirmed by a human.*
