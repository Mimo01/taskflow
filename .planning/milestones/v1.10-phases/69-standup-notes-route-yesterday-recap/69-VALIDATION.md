---
phase: 69
slug: standup-notes-route-yesterday-recap
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-24
validated: 2026-05-25
---

# Phase 69 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 (jsdom env, React Testing Library 16.x) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm run test` (`vitest run`) |
| **Full suite command** | `npm run test && npm run build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Requirement Verification Map

Mapped to canonical `REQUIREMENTS.md` (STAND-01…STAND-06) and the test files actually
produced during execution. All commands run from `taskflow/`.

| Requirement | Behavior | Plan | Threat Ref | Secure Behavior | Test File | Automated Command | Status |
|-------------|----------|------|------------|-----------------|-----------|-------------------|--------|
| STAND-01 | `/standup-notes` route + sidebar entry (visible to everyone) | 03 | — | N/A | `routes.test.ts` | `npm run test -- routes` | ✅ green |
| STAND-02 | "Yesterday" = last working day (weekend + Tempo holiday skip) | 01 | — | N/A | `lib/standup-date.test.ts` | `npm run test -- standup-date` | ✅ green |
| STAND-03 | Tempo worklogs in recap (issue key + duration) | 04 | T-62-06 | token read inside queryFn, not in queryKey | `standup-notes/YesterdayColumn.test.ts` | `npm run test -- YesterdayColumn` | ✅ green |
| STAND-03 | Empty section when Tempo disabled | 04 | — | N/A | `standup-notes/YesterdayColumn.tempo-disabled.test.tsx` | `npm run test -- tempo-disabled` | ✅ green *(added by 2026-05-25 audit)* |
| STAND-04 | Jira changelog activity I authored (transitions + comments) | 01 | T-69-01, T-69-02 | JQL date internally computed + encoded; token never logged/returned | `services/jira-standup.test.ts` | `npm run test -- jira-standup` | ✅ green |
| STAND-05 | Git commits I authored + linked Jira key parsing | 01, 02 | T-69-02 | PRIVATE-TOKEN header; token not persisted/returned | `services/gitlab.test.ts` + `lib/standup-date.test.ts` | `npm run test -- gitlab` | ✅ green |
| STAND-06 | MR activity — comments + approvals I performed | 02, 04 | T-69-02 | PRIVATE-TOKEN header; token not persisted/returned | `services/gitlab.test.ts` | `npm run test -- gitlab` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Suite total:** 6 files, 80 tests, all green (`npm run test` against the standup-notes set).

---

## Wave 0 Requirements

- [x] `taskflow/src/lib/standup-date.test.ts` — STAND-02 (resolveYesterdayDate weekend + holiday skip), STAND-05 (Jira key extraction)
- [x] `taskflow/src/services/jira-standup.test.ts` — STAND-04 (author + date filtering, graceful degrade, ApiError) + `fetchIssueMeta`
- [x] `taskflow/src/services/gitlab.test.ts` — STAND-05 (`fetchUserCommits`), STAND-06 (`fetchUserMREvents`)
- [x] `taskflow/src/routes/routes.test.ts` — STAND-01 (route + import presence guards)
- [x] `taskflow/src/routes/standup-notes/YesterdayColumn.test.ts` — STAND-03 worklog display + MR grouping + parent-story rollup (`generateMarkdown`)
- [x] `taskflow/src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx` — STAND-03 empty section when Tempo disabled (render branch)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar entry visible and navigates to /standup-notes | STAND-01 | UI visibility requires running app | Click sidebar; verify route loads |
| Yesterday resolves correctly on Monday | STAND-02 | Date-sensitive; requires system clock or mock | Set system date to Monday; open page; verify Friday's data loads |
| Empty state for Jira / GitLab sections when those integrations are disabled or return nothing | STAND-04–06 | Per-source render branches not covered by a render test | Disable each integration; verify per-section empty/error state renders without crash |

*Tempo-disabled empty state (STAND-03) is now automated — see `YesterdayColumn.tempo-disabled.test.tsx`.*

---

## Validation Sign-Off

- [x] All requirements have automated verification or documented manual-only rationale
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-25

---

## Validation Audit 2026-05-25

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

Gap: STAND-03 "empty section when Tempo disabled" render branch (`YesterdayColumn.tsx:488`)
had no automated coverage (parked as manual-only). Filled by a new RTL render test,
`YesterdayColumn.tempo-disabled.test.tsx` (2 tests), asserting the disabled-notice copy
renders when `tempoEnabled={false}` and is absent when `tempoEnabled={true}`. Full standup
suite green: 6 files / 80 tests. `tsc --noEmit` clean.
