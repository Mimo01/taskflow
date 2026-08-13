---
phase: 88-release-branch-milestone-creation
plan: 11
status: complete
completed: 2026-08-10
requirements: [RELBR-03, RELBR-04, RELMS-02, RELMS-04]
---

# Plan 88-11 Summary — Live-GitLab verification and Open Question #1

## Outcome

Task 1 (automated gate) and Task 5 (read-only `probe.sh` collision scan) were performed.
Tasks 2, 3 and 4 — the live create-branch, create-milestone and restricted-PAT
checkpoints — were **waived by the user** at the wave-4 checkpoint. They are recorded
below as `waived — not performed`, not as verified.

## Task-by-task

### Task 1 — Full-suite gate — PASSED

| Gate | Result |
|------|--------|
| `npx vitest run` | 2222 passed, 2 skipped, 13 todo (175 files). Baseline in 88-VERIFICATION.md was 187 — well above. Zero failures. |
| `npx tsc --noEmit` | Clean, no output. |
| `npx biome check src` | Exactly 2 errors, both formatting, both in `BacklogPage.tsx` / `BacklogRow.tsx` — the known project baseline. Zero errors in any file touched by Plans 88-07..88-10. |

### Task 2 — Live create-branch (RELBR-04, un-waives 88-05-T3) — `waived — not performed`

The user declined the live write checkpoints at the wave-4 gate. The create-branch path
against a real GitLab instance therefore **remains unexecuted**; coverage is still
mocked-fetch unit tests only. The originally waived 88-05-T3 checkpoint is **NOT**
discharged.

### Task 3 — Live create-milestone and cross-view propagation (RELMS-02, CR-02) — `waived — not performed`

Not performed. The originally waived 88-06-T3 checkpoint is **NOT** discharged. CR-02's
invalidation-granularity fix (Plan 88-09) remains verified by unit test only, not by
real-world cross-view propagation.

### Task 4 — Restricted-PAT error surfacing (WR-11, CR-01, CR-03) — `waived — not performed`

Not performed. No second scope-restricted PAT was created. WR-11's body-first 401/403
classification remains verified in source and by mocked-fetch tests only; the two
verbatim GitLab error strings this checkpoint demanded were not captured.

### Task 5 — `probe.sh` live collision scan (RELMS-04, D-07/A3) — PASSED

Run against `git.devel.sun.orange.sk`, project 455. 265 milestones fetched with
`include_ancestors=true`. All five acceptance criteria met.

**Probe B verdict, verbatim:**
```
PROBE B => PASS (project_id field present — D-07 local filter is viable)
```
- milestones with `project_id == 455`: **265**
- milestones with `project_id != 455` or absent (inherited): **0**

Assumption A3 confirmed — `ownProjectMilestones` takes its filtering path, never the
defensive unfiltered fallback.

**Probe C — trimmed-duplicate check:** empty. **Zero `COLLISION:` lines**, and zero exact
full-title duplicates. `normalizeMilestoneTitle` blocks no legitimate title in the team's
real history, so `findDuplicateMilestone` is validated against real data.

**Probe C — off-format titles: 157 of 265.**
- **78** structurally correct but not zero-padded (`D.M.YYYY` not `DD.MM.YYYY`) — e.g.
  `13.4.0 (3.1.2023)`, `25.9.0 (3.6.2025)`, `29.6.0 (6.3.2026)`, `21.12.0 (25.6.2024)`.
- **79** legacy or non-version titles — `v0.6.13`..`v0.14.8` series, `sprint-0`, `sprint-2`,
  `sprint-3`, `XMAS`, `CHR5`, `8.26`, `8.28.0`, `6.8.0`, `4.7.0`, `4.2.0`, `2.x` series,
  `1.x` series, `15.11.2022`, and one malformed `17.4.0 (Fix 26.09.2023)`.
- **State distribution:** 1 active, 264 closed. The sole active milestone
  `33.7.0 (11.08.2026)` **is** in strict D-01/D-02 format — no active release carries an
  off-format title.

**App / probe agreement:** confirmed in the running app. The create-milestone dialog for
release `Standard 18.8.2026` (±7-day window → 2026-08-11 .. 2026-08-25) showed exactly
`33.7.0 (11.08.2026)` — the only milestone in that window and the newest in the project.
No inherited titles present, consistent with Probe B's zero-ancestor result.

**Documentation:** `88-RESEARCH.md` heading renamed to `## Open Questions (RESOLVED)`
(grep count 1), question #1's `Recommendation:` bullet replaced with a `Resolved:` bullet
carrying the date, the verbatim Probe B verdict, the collision count and the off-format
count. Question #2 content left intact apart from an added discharge line.

## Findings recorded for escalation (out of scope per plan step 5 — not fixed here)

1. **Non-padded dates weaken duplicate detection.** `findDuplicateMilestone` compares the
   whole normalized title, and the team writes dates both padded and unpadded. A legacy
   `25.9.0 (3.6.2025)` would not collide with a newly created `25.9.0 (03.06.2025)`, so the
   app can create what the team reads as a second milestone for the same release. Zero
   collisions today, but the check is weaker in practice than the clean result implies.

2. **Duplicate version numbers across different dates.** `28.9.0` exists as both
   `(16.12.2025)` and `(13.01.2026)`; `33.6.0` as both `(04.08.2026)` and `(28.07.2026)`.
   Because D-09 derives branch names from the version component only, `release/28.9.0` and
   `release/33.6.0` are each ambiguous between two milestones.

## Deviations

- Tasks 2-4 waived by user decision at the wave-4 checkpoint (see above). Recorded as
  `waived — not performed` per the plan's anti-rationalization guard.
- Task 5 was executed by the orchestrator rather than the user pasting output, because the
  user supplied the full command with a keychain-backed read-only PAT. The plan's stated
  reason for the prohibition (the PAT being unreadable outside the Tauri stronghold) did
  not apply.
- `/tmp/phase88-titles.json` retained during analysis, deleted afterwards per plan step 5.

## Requirement status

| Req | Status |
|-----|--------|
| RELBR-03 | Unit/component tested (88-07); live verification waived |
| RELBR-04 | Unit/component tested (88-08, 88-09); live verification waived |
| RELMS-02 | Unit tested (88-09); live cross-view propagation waived |
| RELMS-04 | **Live-verified** — zero collisions against 265 real milestone titles |

## Self-Check: PASSED

`## Open Questions (RESOLVED)` present exactly once; question #1 carries a `Resolved:`
bullet naming the date and the verbatim Probe B verdict.
