---
phase: 70
slug: standup-notes-today-section
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
validated: 2026-05-25
---

# Phase 70 — Validation Strategy

> Per-phase validation contract. Audited and rewritten retroactively by /gsd:validate-phase
> on 2026-05-25 to reflect the phase's final shape after the in-phase redesign.

---

## Scope Reconciliation (2026-05-25)

The original planning-time map targeted a leaf-only filter, a Pinned section (STAND-08),
and a Log Work action (STAND-09). During Plan 03's human-verify checkpoint and the
subsequent standup redesign (commit c5b19544), the phase changed substantially:

- **STAND-07** delivered as a **grouped** model (parent stories + nested subtasks),
  replacing the locked leaf-only rule.
- **STAND-08 (Pinned)** — **DESCOPED** (won't-do): the Pinned section was removed by
  the user; `TodayPinnedSection.tsx` and its test no longer exist.
- **STAND-09 (Log Work)** — **DESCOPED** (won't-do): the Log Work action was dropped
  from the Today column during the redesign (70-UAT.md test #4).
- New, in-scope behavior added: a **Participating-MRs** section (`mrMatching.ts` +
  `TodayParticipatingSection`) and MR↔story matching.

Only STAND-07 requires automated verification; the two descoped requirements do not.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react (jsdom) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/standup-notes/ src/services/gitlab.test.ts` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Build verify** | `cd taskflow && npm run build` (Phase 59 standing rule — not just tsc) |
| **Estimated runtime** | ~1 second (scoped); ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green AND `npm run build` zero errors
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 70-01-01 | 01 | 1 | STAND-07 | T-70-01 (accepted) | Grouped split: parent w/ subtasks appears; done excluded; orphan subtask standalone; assignee = me | unit | `npx vitest run src/routes/standup-notes/filterSprintItems.test.ts` | ✅ | ✅ green |
| 70-02-03 | 02 | 2 | STAND-07 (column) | T-70-02 (mitigated) | TodayColumn renders grouped rows; MRs section hidden without GitLab | render | `npx vitest run src/routes/standup-notes/TodayColumn.test.tsx` | ✅ | ✅ green |
| 70-03-03 | 03 | 3 | STAND-07 (MR↔story) | — | reviewer + participating MRs matched to sprint keys by title then branch | unit | `npx vitest run src/routes/standup-notes/mrMatching.test.ts` | ✅ | ✅ green |
| 70-03-03 | 03 | 3 | MRs (scope) | — | Participating = open MRs I commented on, actionable filter applied | render | `npx vitest run src/routes/standup-notes/TodayParticipatingSection.test.tsx` | ✅ | ✅ green |
| 70-03-03 | 03 | 3 | MRs (scope) | — | Reviewer MRs render; hidden-when-empty | render | `npx vitest run src/routes/standup-notes/TodayMrsSection.test.tsx` | ✅ | ✅ green |
| (redesign) | — | — | STAND-07 (copy) | — | Copy-to-clipboard markdown includes Today rows | unit | `npx vitest run src/routes/standup-notes/TodayColumn.markdown.test.ts` | ✅ | ✅ green |
| ~~70-02~~ | — | — | ~~STAND-08 (pinned)~~ | — | DESCOPED — Pinned section removed by user | — | — | n/a | ➖ descoped |
| ~~70-02~~ | — | — | ~~STAND-09 (log work)~~ | — | DESCOPED — Log Work dropped in redesign | — | — | n/a | ➖ descoped |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ➖ descoped*

---

## Wave 0 Requirements

Existing infrastructure (vitest + jsdom + @testing-library/react) covers all in-scope
requirements. STAND-07's pure-function core was extracted to `filterSprintItems` (Plan 01)
specifically so it could be unit-tested without React; its test suite was updated in
Plan 03 to assert the grouped model (with an explicit regression guard for "parent with
subtasks now appears"). No audit gaps — all in-scope behavior is covered.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real sprint data groups correctly across stories + my nested subtasks | STAND-07 | Depends on live Jira sprint board state | Open `/standup-notes` with an active sprint; confirm only my stories/subtasks appear, grouped, done excluded |
| Participating MRs reflect live GitLab comment activity (30-day window) | MRs (scope) | Requires a live GitLab events round-trip | Open `/standup-notes`; confirm MRs you commented on (open, actionable) appear under the participating section or nested under their matched story |

---

## Validation Sign-Off

- [x] All in-scope requirements have automated verify or a documented manual-only justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — all in-scope covered)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-25

---

## Validation Audit 2026-05-25

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Descoped | 2 (STAND-08 pinned, STAND-09 log work) |

The original map was obsolete (it targeted leaf-only filtering, Pinned, and Log Work).
Rewritten to the phase's final shape. STAND-07 (grouped) is covered by
`filterSprintItems.test.ts` + column/markdown/MR tests (130 standup-notes+gitlab tests
green). STAND-08 and STAND-09 are descoped won't-do per REQUIREMENTS.md and need no tests.
