# Phase 47: v1.7 Documentation & Code Debt Cleanup — Research

**Researched:** 2026-03-30
**Domain:** Documentation hygiene, code debt, Nyquist compliance
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-03 | User sees sprint board story headers immediately while subtasks load progressively beneath them | Status update only: Phase 45-02 activated the feature (subtasksLoading wired at SprintBoardTab.tsx:1077); REQUIREMENTS.md still says "Deferred" — needs checkbox and description update |
</phase_requirements>

---

## Summary

Phase 47 is a pure cleanup phase with no new functionality. The v1.7 milestone audit (`.planning/v1.7-MILESTONE-AUDIT.md`) catalogued 9 discrete items across 5 categories: stale requirement checkboxes, a wrong library reference, unchecked ROADMAP plan checkboxes, missing SUMMARY frontmatter fields, two code debt items, and one untracked artifact. No architectural decisions are required.

Every change is either a text edit to a planning document, a one-line code substitution, a test file cleanup, or a VALIDATION.md frontmatter flag change. All 9 audit items map to the 8 Success Criteria in ROADMAP.md — the final criterion (Nyquist compliance) requires updating `nyquist_compliant: false` to `true` in four VALIDATION.md files plus filling the Validation Sign-Off checklists.

**Primary recommendation:** Work through the 8 success criteria sequentially as a single plan. Each criterion is independent (no dependency ordering) so a single wave is appropriate.

---

## Standard Stack

This phase touches no runtime dependencies. The only tooling involved is the project's existing test suite.

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.0.18 | Verify the dead mock removal does not break SprintBoardTab.test.tsx |
| TypeScript (tsc) | existing | Confirm BacklogPage constant substitution type-checks cleanly |

**No new packages required.**

---

## Architecture Patterns

### Project Document Conventions

Planning files use consistent YAML frontmatter patterns. The relevant conventions observed across phases 43-46:

**SUMMARY frontmatter — correct format:**
```yaml
requirements-completed: [REQ-ID-1, REQ-ID-2]
```

**VALIDATION.md frontmatter — Nyquist compliance fields:**
```yaml
nyquist_compliant: false        # -> must become true
wave_0_complete: false          # -> must become true when Wave 0 gaps resolved
```

Nyquist compliance requires ALL of the following sign-off checklist items to be satisfied:
- All tasks have `<automated>` verify or Wave 0 dependencies
- Sampling continuity: no 3 consecutive tasks without automated verify
- Wave 0 covers all MISSING references
- No watch-mode flags
- Feedback latency documented
- `nyquist_compliant: true` set in frontmatter

For phases 43-46, the VALIDATION.md files were drafted but sign-off was never completed. The sign-off items need to be checked and frontmatter updated.

### REQUIREMENTS.md checkbox conventions

```markdown
- [x] **REQ-ID**: Description    # satisfied
- [ ] **REQ-ID**: Description    # pending
- [~] **REQ-ID**: Description    # partial
```

### ROADMAP.md plan checkbox conventions

```markdown
- [x] 43-01-PLAN.md — description    # plan complete
- [ ] 43-01-PLAN.md — description    # plan not started
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant substitution in BacklogPage | A new abstraction | Import `STALE_TIME_MS` from existing `@/lib/query-constants` | The constant already exists, value matches (30_000) |
| Nyquist sign-off | A script | Manual checklist review + frontmatter edit | The sign-off is a human-readable document artifact |

---

## Exact Audit Items (Authoritative Source: `.planning/v1.7-MILESTONE-AUDIT.md`)

The milestone audit is the single authoritative source. All 9 items are reproduced here with the exact files and lines to change.

### Documentation Gaps (6 items)

**Item D-1: REQUIREMENTS.md — ROUT-01, ROUT-02, ROUT-03 checkboxes**
- File: `.planning/REQUIREMENTS.md`
- Current: `- [ ] **ROUT-01**:`, `- [ ] **ROUT-02**:`, `- [ ] **ROUT-03**:`
- Change to: `- [x] **ROUT-01**:`, `- [x] **ROUT-02**:`, `- [x] **ROUT-03**:`
- Evidence: Phase 42 VERIFICATION.md passed for all three; they are satisfied

**Item D-2: REQUIREMENTS.md — LOAD-02, QOPT-04, QOPT-05 checkboxes**
- File: `.planning/REQUIREMENTS.md`
- Current: `- [ ] **LOAD-02**:`, `- [ ] **QOPT-04**:`, `- [ ] **QOPT-05**:`
- Change to: `- [x] **LOAD-02**:`, `- [x] **QOPT-04**:`, `- [x] **QOPT-05**:`
- Evidence: Phase 43 plans 01/02 delivered all three; SUMMARY requirements-completed fields confirm

**Item D-3: REQUIREMENTS.md — LOAD-03 status update**
- File: `.planning/REQUIREMENTS.md`
- Current: `- [ ] **LOAD-03**: ... — Infra complete, deferred pending query split`
- Change: Update to `- [x]` and revise description to reflect Phase 45-02 activation; note human verification still needed
- Evidence: Phase 45-02 wired subtasksLoading from real jira-sprint-subtasks query; audit confirmed at SprintBoardTab.tsx:1077

**Item D-4: REQUIREMENTS.md — CACH-02 description fix**
- File: `.planning/REQUIREMENTS.md`
- Current: `via @tauri-apps/plugin-fs`
- Change to: `via @tauri-apps/plugin-store`
- Evidence: Phase 46 implemented with LazyStore from plugin-store, not plugin-fs

**Item D-5: ROADMAP.md — plan checkboxes 43-01, 43-02, 45-03**
- File: `.planning/ROADMAP.md`
- Lines to change: The three `- [ ] 43-01-PLAN.md`, `- [ ] 43-02-PLAN.md`, `- [ ] 45-03-PLAN.md` entries
- Change to: `- [x]` for all three
- Evidence: All three plans have SUMMARY.md files with completed timestamps

**Item D-6: SUMMARY frontmatter — requirements-completed fields**

The audit (`.planning/v1.7-MILESTONE-AUDIT.md` tech_debt section) lists specific plans missing `requirements-completed`. Cross-referencing actual SUMMARY frontmatter:

| Plan | File | Missing Field | Should Be |
|------|------|---------------|-----------|
| 42-03 | `.planning/phases/42-foundation/42-03-SUMMARY.md` | `requirements-completed:` has only `[ROUT-05]` | `[ROUT-01, ROUT-02, ROUT-03, ROUT-04, ROUT-05]` — plans 42-01 and 42-02 cover ROUT-01 through ROUT-04 but 42-03 only claims ROUT-05; the audit flags "42-03" as missing — this is the orphan bundle-analysis plan for ROUT-05 specifically; check 42-01 and 42-02 SUMMARY files separately |
| 44-02 | `.planning/phases/44-loading-ux/44-02-SUMMARY.md` | has `requirements-completed: [LOAD-03, LOAD-04, LOAD-05]` | present — not actually missing |
| 44-04 | `.planning/phases/44-loading-ux/44-04-SUMMARY.md` | has `requirements_completed: []` (wrong key name, empty list) | `requirements-completed: [LOAD-01, LOAD-03, LOAD-04, LOAD-05]` or update based on what 44-04 actually did |
| 45-01 | `.planning/phases/45-query-optimization/45-01-SUMMARY.md` | no `requirements-completed` key | `requirements-completed: [QOPT-01, QOPT-02, LOAD-03]` — 45-01 built the service layer for sprint split (QOPT-01/02) and subtask loading infra (LOAD-03) |
| 45-02 | `.planning/phases/45-query-optimization/45-02-SUMMARY.md` | no `requirements-completed` key | `requirements-completed: [QOPT-01, QOPT-02, QOPT-03, LOAD-03]` |
| 46-01 | `.planning/phases/46-avatar-caching/46-01-SUMMARY.md` | has `requirements-completed: [CACH-01, CACH-02]` | present — not actually missing |
| 46-02 | `.planning/phases/46-avatar-caching/46-02-SUMMARY.md` | has `requirements: [CACH-01, CACH-02]` (wrong key name) | rename to `requirements-completed: [CACH-01, CACH-02]` |

> NOTE: The planner should verify each SUMMARY's actual content before writing. The key finding is that 45-01 and 45-02 have no `requirements-completed` key at all, and 44-04/46-02 have wrong key names.

### Code Debt (2 items)

**Item C-1: BacklogPage.tsx — replace literal 30_000 with STALE_TIME_MS**
- File: `taskflow/src/routes/dashboard/BacklogPage.tsx`
- Lines: 268 and 278 both have `staleTime: 30_000,`
- Change: Replace with `staleTime: STALE_TIME_MS,`
- Required import: `import { STALE_TIME_MS } from '@/lib/query-constants';`
- Context: These are the `jira-sprint-stories` and `jira-sprint-subtasks` queries in BacklogPage. The constant already exists with value 30_000 — behavioral no-op.
- Verify: `cd taskflow && npx tsc --noEmit && npm test`

**Item C-2: SprintBoardTab.test.tsx — remove dead fetchSprintIssues mock**
- File: `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx`
- Line 31: `fetchSprintIssues: vi.fn().mockResolvedValue([]),`
- This is inside the `vi.mock('@/services/jira', ...)` factory at lines 30-35
- Context: fetchSprintIssues is now a deprecated thin wrapper; SprintBoardTab.tsx no longer imports it directly. The mock at line 31 is unused. A separate mock block for `@/services/jira/issues` at lines 38-41 now mocks `fetchSprintStories` and `fetchSprintSubtasks`.
- Change: Remove line 31 from the `@/services/jira` mock object
- Verify: `cd taskflow && npm test src/routes/dashboard/SprintBoardTab.test.tsx`

### Artifacts (1 item)

**Item A-1: stats.html — untracked bundle analysis artifact**
- File: `taskflow/stats.html`
- Status: EXISTS (confirmed by file probe)
- Action: Add `stats.html` to `taskflow/.gitignore` (or to root `.gitignore` if that's the convention) so it stays ignored. Optionally delete the file.
- Note: File is untracked by git already. The fix is to ensure it stays that way via .gitignore. Deleting it is also acceptable — it is regenerated by `ANALYZE=true npx vite build`.

---

## Nyquist Compliance: What Is Required

Nyquist compliance means VALIDATION.md frontmatter reads `nyquist_compliant: true` and all sign-off checklist items are checked.

For each of the 4 non-compliant phases, the VALIDATION.md sign-off checklist must be reviewed:

| Phase | File | Current Status |
|-------|------|----------------|
| 43 — Cache Correctness | `.planning/phases/43-cache-correctness/43-VALIDATION.md` | `nyquist_compliant: false`; Wave 0 gap: `useIsActiveRoute.test.ts` — this file was created by Plan 43-01 |
| 44 — Loading UX | `.planning/phases/44-loading-ux/44-VALIDATION.md` | `nyquist_compliant: false`; Wave 0 items list 5 test stubs as gaps — these were filled during execution |
| 45 — Query Optimization | `.planning/phases/45-query-optimization/45-VALIDATION.md` | No frontmatter (no `nyquist_compliant` flag at all); document has different format |
| 46 — Avatar Caching | `.planning/phases/46-avatar-caching/46-VALIDATION.md` | `nyquist_compliant: false`; Wave 0 gaps include `avatarCache.test.ts` — created by Plan 46-01 |

**What to do for each:**
1. Verify the Wave 0 gap files now exist (they do — confirmed by SUMMARY files)
2. Check off the sign-off checklist items that are now satisfied
3. Set `nyquist_compliant: true` and `wave_0_complete: true` in frontmatter
4. For Phase 45 (no frontmatter): add proper frontmatter block

---

## Common Pitfalls

### Pitfall 1: Wrong requirements-completed values
**What goes wrong:** Planner adds wrong REQ-IDs to a SUMMARY's requirements-completed field.
**Why it happens:** Multiple plans in a phase each cover partial requirements; it's easy to assign all requirements to one plan.
**How to avoid:** Cross-reference each plan's PLAN.md `requirements:` frontmatter field — that is the authoritative source for what a plan was supposed to deliver.
**Warning signs:** requirements-completed list differs from the plan's `requirements:` frontmatter.

### Pitfall 2: Removing the wrong line from the test mock
**What goes wrong:** Removing `fetchSprintIssues` from the wrong mock block, or corrupting the mock object syntax.
**Why it happens:** SprintBoardTab.test.tsx has two separate mock blocks — one for `@/services/jira` (the barrel) and one for `@/services/jira/issues`.
**How to avoid:** Read the full mock block before editing. Only remove `fetchSprintIssues: vi.fn().mockResolvedValue([]),` from line 31 inside the `@/services/jira` mock (lines 30-35). Leave the `@/services/jira/issues` mock (lines 38-41) untouched.
**Warning signs:** Test failures after the edit.

### Pitfall 3: Forgetting to check ROADMAP.md vs .planning/ROADMAP.md
**What goes wrong:** Editing the wrong ROADMAP.md — the project has `.planning/ROADMAP.md` (root planning), not a roadmap inside taskflow/.
**Why it happens:** The output path for this phase is `taskflow/.planning/phases/...` but ROADMAP.md is in `.planning/ROADMAP.md` at the repo root.
**How to avoid:** Always use the path `.planning/ROADMAP.md` for roadmap edits.

### Pitfall 4: stats.html gitignore scope
**What goes wrong:** Adding `stats.html` to `taskflow/.gitignore` when it should be in the root, or vice versa.
**Why it happens:** stats.html is generated in `taskflow/` directory, so it belongs in `taskflow/.gitignore`.
**How to avoid:** The file is at `taskflow/stats.html` — add the ignore rule to `taskflow/.gitignore`.

---

## Code Examples

### Correct constant import for BacklogPage fix

```typescript
// Source: taskflow/src/lib/query-constants.ts (existing file)
import { STALE_TIME_MS } from '@/lib/query-constants';

// Usage (replaces 30_000 literals at lines 268 and 278):
staleTime: STALE_TIME_MS,
```

### Correct SUMMARY frontmatter format

```yaml
# Source: 43-01-SUMMARY.md (reference implementation)
requirements-completed: [LOAD-02, QOPT-04]
```

### Correct VALIDATION.md frontmatter after compliance update

```yaml
---
phase: 43
slug: cache-correctness
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely documentation and code edits with no new external tool dependencies. The existing Vitest/TypeScript toolchain is the only validation tooling required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test -- --reporter=verbose` |
| Full suite command | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAD-03 | Status update only (no new code) | manual-only | N/A — verification is reading REQUIREMENTS.md after edit | N/A |

LOAD-03's deliverable in this phase is a documentation status update, not functional code. No new test is required.

For the two code changes:
- BacklogPage constant substitution: `cd /Users/mimo/Desktop/Tasker/taskflow && npm test src/routes/dashboard/BacklogPage.test.tsx`
- Dead mock removal: `cd /Users/mimo/Desktop/Tasker/taskflow && npm test src/routes/dashboard/SprintBoardTab.test.tsx`

### Sampling Rate

- **Per task commit:** `cd /Users/mimo/Desktop/Tasker/taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — no new test files are required. All code changes involve removing or substituting existing code; the existing test suite is sufficient.

---

## Open Questions

1. **Phase 44-04 SUMMARY requirements field**
   - What we know: `44-04-SUMMARY.md` has `requirements_completed: []` (wrong key name, empty value). Plan 44-04 was a gap-closure plan that fixed TypeScript compilation and updated REQUIREMENTS.md tracking — it didn't complete any new requirements itself.
   - What's unclear: Should the field be empty (plan didn't satisfy requirements) or should it list LOAD-01/03/04/05 as co-deliverers?
   - Recommendation: Set `requirements-completed: []` (correct key, empty list) — 44-04 was infrastructure/fix work, not a new requirement delivery.

2. **Phase 45-03 SUMMARY requirements-completed**
   - What we know: `45-03-SUMMARY.md` has `requirements-completed: [QOPT-03]` (already correct from SUMMARY review).
   - What's unclear: Nothing — this one is fine.
   - Recommendation: No change needed for 45-03.

---

## Sources

### Primary (HIGH confidence)

- `.planning/v1.7-MILESTONE-AUDIT.md` — authoritative list of all 9 debt items with exact evidence
- `.planning/REQUIREMENTS.md` — current checkbox states verified by direct file read
- `.planning/ROADMAP.md` — current plan checkbox states verified by direct file read
- `taskflow/src/routes/dashboard/BacklogPage.tsx` lines 268/278 — literal 30_000 confirmed by grep
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` line 31 — dead mock confirmed by grep
- `taskflow/stats.html` — confirmed to exist
- Phase 43-46 SUMMARY.md files — requirements-completed field presence/absence verified by grep

### Secondary (MEDIUM confidence)

- Nyquist compliance interpretation from VALIDATION.md sign-off checklists (inferred from existing structure across phases 43-46)

---

## Metadata

**Confidence breakdown:**
- Audit items: HIGH — all items verified against actual files
- SUMMARY frontmatter gaps: HIGH — verified by direct grep across all affected files
- Nyquist compliance scope: HIGH — VALIDATION.md files read directly
- requirements-completed values to add for 45-01/45-02: MEDIUM — inferred from plan `requirements:` frontmatter fields; planner should verify against plan PLAN.md files

**Research date:** 2026-03-30
**Valid until:** Indefinite — all findings are against static planning documents
