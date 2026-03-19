# Phase 24: Verify Phase 22 (Empty States + Error Recovery) - Research

**Researched:** 2026-03-19
**Domain:** Verification / audit of Phase 22 implementation against POLISH-01, POLISH-02, POLISH-03
**Confidence:** HIGH

## Summary

Phase 24 is a **verification-only phase** -- no code is written. The goal is to produce a `VERIFICATION.md` in `.planning/phases/22-polish-empty-states-error-recovery/` that proves (with evidence) that Phase 22 satisfied all three POLISH requirements. The milestone audit (v1.3-MILESTONE-AUDIT.md) flagged Phase 22 as having "Missing VERIFICATION.md" which is the specific gap this phase closes.

Phase 22 implemented three shared components (EmptyState, ErrorState, StaleDataBanner) plus an ApiError class, then retrofitted all 10 data views across 3 plans. The code is complete and committed. All 31 Phase 22 unit tests pass. What is missing is the formal verification document that cross-references each requirement against codebase evidence.

**Primary recommendation:** Follow the exact VERIFICATION.md format used by Phases 18-21 (observable truths table, requirements coverage, key link verification, test results, human verification items). Evidence should be gathered by reading source files and running tests -- no code changes needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POLISH-01 | All list views show an illustrated empty state with headline and CTA when there is no data | EmptyState component exists at `src/components/ui/empty-state.tsx`, imported in 10 views (MyTasksTab, SprintBoardTab, SprintProgressTab, BacklogPage, MrAttentionTab, WorkloadTab, ReleasesTab, EpicsPage, NotificationPopover, MergeRequestListPage). Each view passes a unique Lucide icon, title, optional subtitle, and optional action. 6 unit tests pass for EmptyState component. |
| POLISH-02 | All data views show an actionable error state with plain-language message and retry button on fetch failure | ErrorState component at `src/components/ui/error-state.tsx` imported in 10 views. StaleDataBanner at `src/components/ui/stale-data-banner.tsx` imported in 10 views. Three-state detection pattern (isError && !data -> ErrorState, isError && data -> StaleDataBanner, !isError && empty -> EmptyState) is implemented across all views. 10 unit tests for ErrorState + 3 for StaleDataBanner pass. |
| POLISH-03 | Authentication errors include a re-connect CTA navigating to Settings > Connections | ApiError class at `src/lib/api-error.ts` with isAuthError/getErrorSource helpers. ErrorState auto-detects auth errors (401/403) and renders "Session expired" + "Reconnect" button navigating to /settings. jira.ts (15+ sites) and gitlab.ts (12+ sites) retrofitted to throw ApiError on 401/403. 12 unit tests for ApiError module pass. |
</phase_requirements>

## Standard Stack

This phase uses no libraries -- it is a documentation/verification phase only.

### Verification Tools
| Tool | Purpose | Why |
|------|---------|-----|
| vitest | Run Phase 22 test suite for evidence | Already configured in project |
| grep/read | Examine source files for import chains and patterns | Codebase inspection |
| VERIFICATION.md format | Document structure | Established by Phases 18-21 |

## Architecture Patterns

### VERIFICATION.md Structure (from Phase 20 exemplar)

The project has an established VERIFICATION.md format used consistently across Phases 18-21. Phase 24 must produce this same format for Phase 22.

**Required sections:**
1. **Frontmatter** -- phase slug, verified timestamp, status, score
2. **Goal Achievement / Observable Truths table** -- numbered truths with Status + Evidence columns
3. **Required Artifacts** -- files created/modified with size and key evidence
4. **Key Link Verification** -- From/To/Via/Status/Evidence for each integration point
5. **Requirements Coverage** -- POLISH-01, POLISH-02, POLISH-03 each mapped to evidence
6. **Test Results** -- test file, count, pass/fail
7. **Anti-Patterns Found** -- any warnings or pre-existing issues
8. **Human Verification Required** -- items that need manual app testing
9. **Gaps Summary** -- open issues or none

### Evidence Gathering Pattern

For each requirement, verification needs THREE types of evidence:
1. **Component exists** -- file path, line count, exports
2. **Component is wired** -- import chain from view -> shared component -> dependencies
3. **Component is tested** -- test file, test count, pass/fail status

### Three-State Detection Pattern to Verify

Each data view should implement:
```
isError && !data       -> <ErrorState />
isError && data        -> <StaleDataBanner /> + stale content
!isError && data empty -> <EmptyState />
```

### Views to Verify (10 total)

| View | File | Empty Icon | Has CTA |
|------|------|-----------|---------|
| My Tasks | MyTasksTab.tsx | ClipboardList | No |
| Sprint Board | SprintBoardTab.tsx | Columns3 | No |
| Sprint Progress | SprintProgressTab.tsx | BarChart3 | No |
| Backlog | BacklogPage.tsx | Inbox | Yes (Create Issue) |
| MR Attention | MrAttentionTab.tsx | GitMerge | Yes (Connect GitLab) |
| Workload | WorkloadTab.tsx | Users | No |
| Releases | ReleasesTab.tsx | Package | No |
| Epics | EpicsPage.tsx | Layers | Yes (Create Epic) |
| Notifications | NotificationPopover.tsx | Bell | No |
| Command Palette | CommandPalette.tsx | SearchX (inline) | No |

Plus MergeRequestListPage.tsx which was added post-Phase-22 but also uses the shared components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verification document | Custom format | Established VERIFICATION.md format from Phases 18-21 | Consistency with audit tooling expectations |
| Evidence gathering | Manual screenshots | Automated test runs + source file inspection | Reproducible, machine-verifiable |

## Common Pitfalls

### Pitfall 1: Claiming verification without reading source
**What goes wrong:** Marking a requirement as "SATISFIED" based only on SUMMARY.md claims without checking the actual source files
**Why it happens:** SUMMARYs were written by the executor at completion time and may not reflect subsequent changes
**How to avoid:** Every truth must cite a specific file path and line range or test result
**Warning signs:** Evidence column says "per SUMMARY" instead of citing source

### Pitfall 2: Missing the CommandPalette special case
**What goes wrong:** Treating CommandPalette the same as other views for empty state verification
**Why it happens:** CommandPalette uses inline SearchX JSX in CommandEmpty, not the shared EmptyState component
**How to avoid:** Document this as an intentional deviation (cmdk visibility logic incompatibility) and verify the inline implementation separately

### Pitfall 3: Not checking auth error flow end-to-end
**What goes wrong:** Verifying ErrorState component in isolation but not checking that jira.ts/gitlab.ts actually throw ApiError
**Why it happens:** Component tests mock errors; service tests may not cover all throw sites
**How to avoid:** Verify both ends: (1) services throw ApiError on 401/403, (2) ErrorState detects and renders Reconnect CTA

### Pitfall 4: Ignoring store-level error propagation in NotificationPopover
**What goes wrong:** Expecting NotificationPopover to use the same useQuery error pattern as other views
**Why it happens:** NotificationPopover uses store-level error propagation (fetchError/retryFetch from polling hook)
**How to avoid:** Verify the store-level pattern separately: useNotificationPolling -> notifications.store -> NotificationPopover

### Pitfall 5: Confusing "skipped" UAT tests with failures
**What goes wrong:** Flagging the 7 skipped UAT tests as gaps
**Why it happens:** The UAT file shows 7/9 tests skipped -- but these were skipped because real data conditions couldn't be triggered (user has tasks, backlog has items, etc.), not because they failed
**How to avoid:** Note skipped UATs as "human verification needed" items, not as gaps

## Code Examples

### Evidence Pattern for Observable Truth

```markdown
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EmptyState component renders icon + title + optional subtitle + optional action | VERIFIED | `src/components/ui/empty-state.tsx` (22 lines), 6/6 tests pass in `empty-state.test.tsx` |
| 2 | MyTasksTab uses EmptyState with ClipboardList icon | VERIFIED | `src/routes/dashboard/MyTasksTab.tsx` line XX: `<EmptyState icon={ClipboardList} title="You're all caught up!" ...>` |
```

### Evidence Pattern for Requirements Coverage

```markdown
| Requirement | Description | Status | Evidence |
|-------------|------------|--------|----------|
| POLISH-01 | Empty states in all list views | SATISFIED | EmptyState imported in 10 views (list files). Each has unique icon + title. 6 component tests + view-level assertions pass. |
```

## State of the Art

This is a verification phase -- no technology choices needed. The Phase 22 implementation is complete using:

| Component | Current State | Evidence |
|-----------|--------------|----------|
| EmptyState | Complete, tested | 22 lines, 6 tests pass |
| ErrorState | Complete, tested | 53 lines, 10 tests pass |
| StaleDataBanner | Complete, tested | 24 lines, 3 tests pass |
| ApiError | Complete, tested | 59 lines, 12 tests pass |
| View retrofits | 10 views complete | All imports verified via grep |
| Service retrofits | jira.ts + gitlab.ts | 27+ throw sites converted to ApiError |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + @testing-library/react |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/components/ui/empty-state.test.tsx src/components/ui/error-state.test.tsx src/components/ui/stale-data-banner.test.tsx src/lib/api-error.test.ts` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLISH-01 | EmptyState renders icon/title/subtitle/action | unit | `cd taskflow && npx vitest run src/components/ui/empty-state.test.tsx -x` | Yes |
| POLISH-02 | ErrorState renders error + retry; StaleDataBanner renders retry + dismiss | unit | `cd taskflow && npx vitest run src/components/ui/error-state.test.tsx src/components/ui/stale-data-banner.test.tsx -x` | Yes |
| POLISH-03 | ApiError + isAuthError + ErrorState Reconnect CTA | unit | `cd taskflow && npx vitest run src/lib/api-error.test.ts src/components/ui/error-state.test.tsx -x` | Yes |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/components/ui/empty-state.test.tsx src/components/ui/error-state.test.tsx src/components/ui/stale-data-banner.test.tsx src/lib/api-error.test.ts`
- **Phase gate:** All 31 tests green before marking verification complete

### Wave 0 Gaps
None -- all test files exist and pass. This phase creates documentation only, no new test files needed.

## Open Questions

1. **MergeRequestListPage coverage**
   - What we know: MergeRequestListPage.tsx imports EmptyState, ErrorState, StaleDataBanner but was added after Phase 22 (via quick task)
   - What's unclear: Whether to include it in Phase 22's verification scope
   - Recommendation: Note it as additional coverage beyond the original 10 views but don't include it in the POLISH requirement evidence (it wasn't part of Phase 22's plan)

2. **NotificationPopover store-level error propagation testing**
   - What we know: Store writes fetchError/retryFetch, popover reads them. No dedicated test for this integration.
   - What's unclear: Whether the verification should flag this as a gap or accept component-level + store-level tests separately
   - Recommendation: Document the pattern as verified via code inspection; flag integration test as human verification item

## Sources

### Primary (HIGH confidence)
- Phase 22 SUMMARY files (22-01, 22-02, 22-03) -- detailed implementation records
- Phase 22 CONTEXT.md -- locked design decisions
- Source files in `taskflow/src/components/ui/` and `taskflow/src/lib/` -- direct inspection
- v1.3-MILESTONE-AUDIT.md -- identifies the exact gap (missing VERIFICATION.md)
- Phase 20 VERIFICATION.md -- exemplar format

### Secondary (MEDIUM confidence)
- Phase 22 UAT results -- 2 pass, 7 skipped (data conditions not triggerable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verification phase, no library decisions
- Architecture: HIGH - VERIFICATION.md format established by 4 prior phases
- Pitfalls: HIGH - based on direct analysis of Phase 22 implementation details

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- verification of completed work)
