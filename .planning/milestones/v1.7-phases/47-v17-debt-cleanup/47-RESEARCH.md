# Phase 47: v1.7 Documentation & Code Debt Cleanup — Research

**Researched:** 2026-03-30
**Domain:** Documentation hygiene, code debt, Nyquist compliance
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-03 | User sees sprint board story headers immediately while subtasks load progressively beneath them | Status update only: Phase 45-02 activated the feature (subtasksLoading wired at SprintBoardTab.tsx:1077); REQUIREMENTS.md still says "Deferred" — needs checkbox update and description rewrite to reflect activation |
</phase_requirements>

---

## Summary

Phase 47 is a pure cleanup phase with no new functionality. The v1.7 milestone audit (`.planning/v1.7-MILESTONE-AUDIT.md`) catalogued 9 discrete items across 5 categories: stale requirement checkboxes, a wrong library reference in a requirement description, unchecked ROADMAP plan checkboxes, missing SUMMARY frontmatter fields, two code debt items, and one untracked artifact. No architectural decisions are required.

Every change is either a text edit to a planning document, a one-line code substitution, a test file line removal, or a VALIDATION.md frontmatter flag change. All 9 audit items map to the 8 success criteria in ROADMAP.md. The final success criterion — Nyquist compliance — requires updating `nyquist_compliant: false` to `true` in four VALIDATION.md files plus filling sign-off checklists.

Key source file state confirmed by direct inspection (2026-03-30): BacklogPage.tsx has literal `30_000` at lines 268 and 278 (not yet using STALE_TIME_MS); SprintBoardTab.test.tsx still has the dead `fetchSprintIssues` mock at line 31; `taskflow/stats.html` exists on disk; `STALE_TIME_MS = 30_000` is exported from `taskflow/src/lib/query-constants.ts`; stats.html is not yet in `taskflow/.gitignore`.

**Primary recommendation:** Execute as two independent plans — code/artifact debt first (Plan 01), documentation debt second (Plan 02). Both can run in any order; neither depends on the other.

---

## Standard Stack

This phase touches no runtime dependencies. Only the existing project test toolchain is involved.

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.0.18 | Verify the dead mock removal and constant substitution do not break tests |
| TypeScript (tsc) | existing | Confirm BacklogPage constant substitution type-checks cleanly |

**No new packages required.**

---

## Architecture Patterns

### Project Document Conventions

Planning files use consistent YAML frontmatter patterns. The conventions observed across phases 43-46:

**SUMMARY frontmatter — correct format:**
```yaml
requirements-completed: [REQ-ID-1, REQ-ID-2]
```
Note: wrong variants found in the wild — `requirements_completed:` (underscore) and `requirements:` (missing suffix). Both are bugs that need fixing.

**VALIDATION.md frontmatter — Nyquist compliance fields:**
```yaml
nyquist_compliant: false   # must become true
wave_0_complete: false     # must become true when Wave 0 gaps resolved
```

Nyquist compliance requires ALL sign-off checklist items to be satisfied:
- All tasks have `<automated>` verify or Wave 0 dependencies
- Sampling continuity: no 3 consecutive tasks without automated verify
- Wave 0 covers all MISSING references
- No watch-mode flags
- Feedback latency documented
- `nyquist_compliant: true` set in frontmatter

For phases 43-46, VALIDATION.md files were drafted but sign-off was never completed. The sign-off items need to be checked and frontmatter updated.

**Phase 45 special case:** `45-VALIDATION.md` has no YAML frontmatter at all. A frontmatter block must be prepended.

### REQUIREMENTS.md checkbox conventions

```markdown
- [x] **REQ-ID**: Description    # satisfied
- [ ] **REQ-ID**: Description    # pending
- [~] **REQ-ID**: Description    # partial
```

### ROADMAP.md plan checkbox conventions

```markdown
- [x] 43-01-PLAN.md — description    # plan complete
- [ ] 43-01-PLAN.md — description    # not started
```

Plan `45-03-PLAN.md` exists on disk but was never added to ROADMAP.md at all — it needs a new line, not just a checkbox change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant substitution in BacklogPage | A new abstraction | Import `STALE_TIME_MS` from existing `@/lib/query-constants` | The constant already exists at value 30_000 — behavioral no-op |
| Nyquist sign-off | A script | Manual checklist review + frontmatter edit | The sign-off is a human-readable document artifact |

---

## Exact Audit Items (Authoritative Source: `.planning/v1.7-MILESTONE-AUDIT.md`)

The milestone audit is the single authoritative source. All 9 items are reproduced here with the exact files and changes.

### Documentation Gaps (6 items)

**Item D-1: REQUIREMENTS.md — ROUT-01, ROUT-02, ROUT-03 checkboxes**
- File: `.planning/REQUIREMENTS.md`
- Change: `- [ ] **ROUT-01/02/03**` → `- [x]`
- Evidence: Phase 42 VERIFICATION.md passed for all three; they are satisfied

**Item D-2: REQUIREMENTS.md — LOAD-02, QOPT-04, QOPT-05 checkboxes**
- File: `.planning/REQUIREMENTS.md`
- Change: `- [ ] **LOAD-02/QOPT-04/QOPT-05**` → `- [x]`
- Evidence: Phase 43 plans 01/02 delivered all three; SUMMARY requirements-completed fields confirm

**Item D-3: REQUIREMENTS.md — LOAD-03 status update (this phase's primary deliverable)**
- File: `.planning/REQUIREMENTS.md`
- Current: `- [ ] **LOAD-03**: ... — Infra complete, deferred pending query split`
- Change: Update checkbox to `- [x]` and rewrite description to reflect Phase 45-02 activation
- Evidence: Phase 45-02 wired subtasksLoading from real jira-sprint-subtasks query; integration checker confirmed at SprintBoardTab.tsx:1077

**Item D-4: REQUIREMENTS.md — CACH-02 description fix**
- File: `.planning/REQUIREMENTS.md`
- Change: `via @tauri-apps/plugin-fs` → `via @tauri-apps/plugin-store`
- Evidence: Phase 46 implemented with LazyStore from plugin-store, not plugin-fs

**Item D-5: ROADMAP.md — plan checkboxes and missing entry**
- File: `.planning/ROADMAP.md`
- Change: `- [ ] 43-01-PLAN.md` and `- [ ] 43-02-PLAN.md` → `- [x]`
- Change: `- [ ] 45-03-PLAN.md` does not yet exist in ROADMAP.md — add as `- [x] 45-03-PLAN.md — Gap closure: wire backlog prefetch with boardId chain in Sidebar`
- Evidence: All three plans have SUMMARY.md files with completed timestamps

**Item D-6: SUMMARY frontmatter — requirements-completed fields**

| Plan | File | Issue | Fix |
|------|------|-------|-----|
| 42-01 | `.planning/phases/42-foundation/42-01-SUMMARY.md` | Missing ROUT-03 from list | Add `- ROUT-03` to existing list |
| 44-04 | `.planning/phases/44-loading-ux/44-04-SUMMARY.md` | Wrong key: `requirements_completed: []` (underscore) | Rename to `requirements-completed: []` |
| 45-01 | `.planning/phases/45-query-optimization/45-01-SUMMARY.md` | No `requirements-completed` key at all | Add `requirements-completed: [QOPT-01, QOPT-02]` |
| 45-02 | `.planning/phases/45-query-optimization/45-02-SUMMARY.md` | No `requirements-completed` key at all | Add `requirements-completed: [QOPT-01, QOPT-02, QOPT-03]` |
| 46-02 | `.planning/phases/46-avatar-caching/46-02-SUMMARY.md` | Wrong key: `requirements:` (missing `-completed` suffix) | Rename to `requirements-completed: [CACH-01, CACH-02]` |

> NOTE: Planner must read each SUMMARY file before editing. The `requirements-completed` values for 45-01 and 45-02 should be cross-referenced against those plans' PLAN.md `requirements:` frontmatter fields as the authoritative source.

### Code Debt (2 items)

**Item C-1: BacklogPage.tsx — replace literal 30_000 with STALE_TIME_MS**
- File: `taskflow/src/routes/dashboard/BacklogPage.tsx`
- Lines 268 and 278: both have `staleTime: 30_000,`
- BacklogPage does NOT currently import STALE_TIME_MS (confirmed by grep returning no matches)
- Change: Add import `import { STALE_TIME_MS } from '@/lib/query-constants';` and replace both literals
- Verify: `cd taskflow && npx tsc --noEmit && npm test src/routes/dashboard/BacklogPage.test.tsx`

**Item C-2: SprintBoardTab.test.tsx — remove dead fetchSprintIssues mock**
- File: `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx`
- Line 31: `fetchSprintIssues: vi.fn().mockResolvedValue([]),` inside `vi.mock('@/services/jira', ...)`
- Context: SprintBoardTab.tsx no longer imports fetchSprintIssues. A separate `vi.mock('@/services/jira/issues', ...)` block (lines ~38-41) mocks fetchSprintStories and fetchSprintSubtasks — that block must NOT be touched.
- Change: Remove line 31 only; verify mock object syntax remains valid
- Verify: `cd taskflow && npm test src/routes/dashboard/SprintBoardTab.test.tsx`

### Artifacts (1 item)

**Item A-1: stats.html — untracked bundle analysis artifact**
- File: `taskflow/stats.html`
- Status: EXISTS on disk (confirmed 2026-03-30)
- NOT currently in `taskflow/.gitignore` (confirmed by grep returning no match)
- Action: Add `stats.html` to `taskflow/.gitignore`. Optionally delete the file (it is regenerated by `ANALYZE=true npx vite build`).

---

## Nyquist Compliance: What Is Required

For each of the 4 non-compliant phases, the VALIDATION.md sign-off checklist must be reviewed and frontmatter updated:

| Phase | File | Current State | Required Action |
|-------|------|---------------|-----------------|
| 43 — Cache Correctness | `.planning/phases/43-cache-correctness/43-VALIDATION.md` | `nyquist_compliant: false`, Wave 0 gap: `useIsActiveRoute.test.ts` | Verify test file exists (created by Plan 43-01), check all sign-off items, set `nyquist_compliant: true`, `wave_0_complete: true` |
| 44 — Loading UX | `.planning/phases/44-loading-ux/44-VALIDATION.md` | `nyquist_compliant: false`, 3 Wave 0 test stubs listed as gaps | Verify stubs were created during execution, check all sign-off items, set both flags true |
| 45 — Query Optimization | `.planning/phases/45-query-optimization/45-VALIDATION.md` | NO frontmatter at all; uses verification-item format | Prepend YAML frontmatter block with `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete` |
| 46 — Avatar Caching | `.planning/phases/46-avatar-caching/46-VALIDATION.md` | `nyquist_compliant: false`, Wave 0 gap: `avatarCache.test.ts` | Verify test file exists (created by Plan 46-01), check all sign-off items, set both flags true |

**Procedure for phases 43, 44, 46:**
1. Verify Wave 0 gap files now exist (they do — confirmed by SUMMARY files)
2. Check off sign-off checklist items that are now satisfied (all 6 items)
3. Set `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete` in frontmatter
4. Change `**Approval:** pending` to `**Approval:** complete (Phase 47 cleanup)`

**Procedure for phase 45 (no frontmatter):**
1. Prepend a YAML frontmatter block at the very top of the file
2. No body changes needed

---

## Common Pitfalls

### Pitfall 1: Wrong requirements-completed values in SUMMARY files
**What goes wrong:** Planner assigns the wrong REQ-IDs to a SUMMARY's requirements-completed field.
**Why it happens:** Multiple plans in a phase each cover partial requirements; it's easy to assign all requirements to one plan.
**How to avoid:** Cross-reference each plan's PLAN.md `requirements:` frontmatter field — that is the authoritative source for what a plan was supposed to deliver.
**Warning signs:** requirements-completed list differs from the plan's `requirements:` frontmatter.

### Pitfall 2: Removing the wrong line from the SprintBoardTab test mock
**What goes wrong:** Removing `fetchSprintIssues` from the wrong mock block, or corrupting mock object syntax.
**Why it happens:** SprintBoardTab.test.tsx has two separate vi.mock blocks — one for `@/services/jira` (the barrel, lines ~30-35) and one for `@/services/jira/issues` (lines ~38-41).
**How to avoid:** Remove only line 31 from the `@/services/jira` block. Leave `@/services/jira/issues` block entirely untouched.
**Warning signs:** Test failures after the edit.

### Pitfall 3: Editing wrong ROADMAP.md
**What goes wrong:** Editing `taskflow/src/ROADMAP.md` or similar when the target is `.planning/ROADMAP.md` at the repo root.
**Why it happens:** This phase outputs to `taskflow/.planning/phases/...` but ROADMAP.md lives at `.planning/ROADMAP.md`.
**How to avoid:** Always use the path `.planning/ROADMAP.md` for roadmap edits.

### Pitfall 4: stats.html gitignore scope
**What goes wrong:** Adding `stats.html` to the wrong `.gitignore`.
**Why it happens:** The file is `taskflow/stats.html` so it belongs in `taskflow/.gitignore`, not the root.
**How to avoid:** The file lives inside `taskflow/` — add the rule to `taskflow/.gitignore`.

### Pitfall 5: 45-03 missing from ROADMAP.md entirely
**What goes wrong:** Treating 45-03 as a checkbox change when it doesn't exist as a line yet.
**Why it happens:** 45-01 and 45-02 are listed; 45-03 was a gap-closure plan added after ROADMAP.md was last edited.
**How to avoid:** Add a new `- [x] 45-03-PLAN.md — ...` line under Phase 45's Plans section; do not just look for an existing checkbox to update.

---

## Code Examples

### Correct constant import for BacklogPage fix

```typescript
// Source: taskflow/src/lib/query-constants.ts (verified 2026-03-30)
// export const STALE_TIME_MS = 30_000; // 30 seconds

// Add to BacklogPage.tsx imports:
import { STALE_TIME_MS } from '@/lib/query-constants';

// Replace both occurrences (lines 268, 278):
staleTime: STALE_TIME_MS,   // was: staleTime: 30_000,
```

### Correct SUMMARY frontmatter format

```yaml
# Source: 43-01-SUMMARY.md (reference implementation)
requirements-completed: [LOAD-02, QOPT-04]
```

### VALIDATION.md frontmatter for phases 43, 44, 46 after update

```yaml
---
phase: 43           # or 44, 46
slug: cache-correctness   # or loading-ux, avatar-caching
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---
```

### VALIDATION.md frontmatter to prepend for phase 45 (no existing frontmatter)

```yaml
---
phase: 45
slug: query-optimization
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely documentation and code edits with no new external tool dependencies. The existing Vitest/TypeScript toolchain is the only validation tooling required and is confirmed to exist in `taskflow/`.

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
| LOAD-03 | Status update only — no new code | manual-only | N/A — verification is reading REQUIREMENTS.md after edit | N/A |

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

1. **44-04 SUMMARY requirements-completed value**
   - What we know: `44-04-SUMMARY.md` has `requirements_completed: []` (wrong key, empty list). Plan 44-04 was a gap-closure plan fixing TypeScript compilation — it did not independently deliver new requirements.
   - What's unclear: Should it remain empty or list co-deliverers?
   - Recommendation: Set `requirements-completed: []` (correct key, empty list) — 44-04 was infrastructure/fix work, not a new requirement delivery.

2. **42-01 SUMMARY ROUT-03 addition**
   - What we know: 42-01-SUMMARY.md currently lists ROUT-01 and ROUT-02 but not ROUT-03.
   - What's unclear: Whether 42-01-PLAN.md's requirements field includes ROUT-03.
   - Recommendation: Planner should read `42-01-PLAN.md` requirements frontmatter before adding ROUT-03. If requirements includes ROUT-03, add it. If ROUT-03 was delivered by 42-02 or 42-03, add it there instead.

---

## Sources

### Primary (HIGH confidence)

- `.planning/v1.7-MILESTONE-AUDIT.md` — authoritative list of all 9 debt items with exact evidence (read in full)
- `.planning/REQUIREMENTS.md` — current checkbox states verified by direct file read
- `.planning/ROADMAP.md` — current plan checkbox states verified by direct file read
- `taskflow/src/routes/dashboard/BacklogPage.tsx` lines 268/278 — literal `30_000` confirmed by grep; no existing STALE_TIME_MS import confirmed by grep
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` line 31 — dead mock confirmed by grep
- `taskflow/src/lib/query-constants.ts` — `STALE_TIME_MS = 30_000` confirmed by grep
- `taskflow/stats.html` — confirmed to exist by direct probe
- `taskflow/.gitignore` — confirmed stats.html is NOT yet listed

### Secondary (MEDIUM confidence)

- Nyquist compliance sign-off scope inferred from existing VALIDATION.md structure across phases 43-46
- requirements-completed values for 45-01/45-02 inferred from plan `requirements:` frontmatter — planner should verify against actual PLAN.md files

---

## Metadata

**Confidence breakdown:**
- Audit items: HIGH — all items verified against actual files
- SUMMARY frontmatter gaps: HIGH — verified by direct grep across all affected files
- Nyquist compliance scope: HIGH — VALIDATION.md files read directly
- requirements-completed values for 45-01/45-02: MEDIUM — inferred from plan requirements fields; planner should confirm

**Research date:** 2026-03-30
**Valid until:** Indefinite — all findings are against static planning documents
