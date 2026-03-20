# Phase 30: Fix A11Y-01 Test Regression & Checkbox Cleanup - Research

**Researched:** 2026-03-20
**Domain:** Test query fix, requirements housekeeping
**Confidence:** HIGH

## Summary

Phase 30 is a small gap-closure phase identified by the v1.4 milestone audit. The sole functional gap is A11Y-01, which was marked "partial" because `ConnectionsSection.test.tsx` had a test query (`getByText(/jira/i)`) that matched multiple elements after accessibility labels were added in Phase 28. The fix -- tightening the query to `getByText('Jira', { selector: 'span' })` -- has already been applied in the test file.

The remaining work is purely administrative: updating the A11Y-01 checkbox in REQUIREMENTS.md from `[ ]` to `[x]`, and verifying the full test suite passes with zero failures. The audit originally flagged 4 stale checkboxes (TEST-02, PERF-02, A11Y-01, A11Y-02), but only A11Y-01 remains unchecked -- the other three were already corrected.

**Primary recommendation:** Mark A11Y-01 checkbox as complete in REQUIREMENTS.md, verify full test suite green, update traceability table status.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| A11Y-01 | All form inputs in CreateEditIssueModal and ConnectionsSection have proper aria labels | Implementation already correct in both components. Test regression already fixed. Only REQUIREMENTS.md checkbox update remains. |
</phase_requirements>

## Standard Stack

Not applicable -- this phase involves no new libraries or dependencies. The existing stack is:

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.1.0 | Test runner (already configured) |
| @testing-library/react | existing | DOM queries in tests (already configured) |

## Architecture Patterns

### Current State (verified)

**ConnectionsSection.tsx** (lines 82-151): Each `ConnectionCard` renders:
- A `<span>` with the service title (e.g., "Jira")
- A `<label htmlFor={urlId}>` with "{title} URL" text
- A `<label htmlFor={tokenId}>` with "{title} Token" text

The original test used `getByText(/jira/i)` which matched both the `<span>Jira</span>` and `<label>Jira URL</label>` after the a11y fix added labels. The test file already contains the corrected query at line 107:
```typescript
expect(screen.getByText('Jira', { selector: 'span' })).toBeInTheDocument();
expect(screen.getByText('GitLab', { selector: 'span' })).toBeInTheDocument();
```

**CreateEditIssueModal.tsx**: Already has proper `htmlFor`/`id` associations for Summary, Description, Parent, Story Points, and Time Estimate fields, plus `aria-label` on the epic combobox filter and close button.

### Anti-Patterns to Avoid
- **Broad text matchers after adding labels:** When adding `<label>` elements that include the component name, existing `getByText(/name/i)` queries will match multiple elements. Always use `{ selector }` or `getByRole` to disambiguate.

## Don't Hand-Roll

Not applicable for this phase.

## Common Pitfalls

### Pitfall 1: Forgetting to update traceability table
**What goes wrong:** Checkbox is updated but the traceability table at the bottom of REQUIREMENTS.md still says "Pending"
**How to avoid:** Update both the checkbox on line 50 AND the traceability row for A11Y-01 (line 102) from "Pending" to "Complete"

### Pitfall 2: Assuming audit-flagged items are still broken
**What goes wrong:** Spending time fixing things that were already fixed between audit and phase execution
**How to avoid:** Always verify current state before making changes. In this case, 3 of 4 stale checkboxes and the test query were already fixed.

## Code Examples

### REQUIREMENTS.md checkbox fix (line 50)
```markdown
# Before:
- [ ] **A11Y-01**: All form inputs in CreateEditIssueModal and ConnectionsSection have proper aria labels

# After:
- [x] **A11Y-01**: All form inputs in CreateEditIssueModal and ConnectionsSection have proper aria labels
```

### REQUIREMENTS.md traceability fix (line 102)
```markdown
# Before:
| A11Y-01 | Phase 30 | Pending |

# After:
| A11Y-01 | Phase 30 | Complete |
```

## State of the Art

Not applicable -- no technology changes in this phase.

## Open Questions

None. The scope is fully understood and all items have been verified.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | taskflow/vitest.config.ts |
| Quick run command | `cd taskflow && npx vitest run src/routes/settings/ConnectionsSection.test.tsx` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| A11Y-01 | Form inputs have proper aria labels | unit | `cd taskflow && npx vitest run src/routes/settings/ConnectionsSection.test.tsx` | Yes |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/routes/settings/ConnectionsSection.test.tsx`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green (615 tests, 0 failures)

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. ConnectionsSection.test.tsx already passes (9/9 tests green).

## Current Verified State

| Item | Status | Evidence |
|------|--------|----------|
| ConnectionsSection.test.tsx query fix | Already applied | Line 107 uses `{ selector: 'span' }` |
| ConnectionsSection.test.tsx passes | Yes | 9/9 tests pass |
| Full test suite passes | Yes | 60 files pass, 1 skipped, 615 tests green |
| A11Y-01 implementation (ConnectionsSection) | Correct | htmlFor/id pairs on lines 91, 104 |
| A11Y-01 implementation (CreateEditIssueModal) | Correct | htmlFor/id on Summary, Description, Parent, Story Points, Time Estimate |
| REQUIREMENTS.md A11Y-01 checkbox | Unchecked `[ ]` | Line 50 -- needs update |
| REQUIREMENTS.md A11Y-01 traceability | "Pending" | Line 102 -- needs update |
| TEST-02 checkbox | Already `[x]` | No action needed |
| PERF-02 checkbox | Already `[x]` | No action needed |
| A11Y-02 checkbox | Already `[x]` | No action needed |

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `ConnectionsSection.tsx`, `ConnectionsSection.test.tsx`, `CreateEditIssueModal.tsx`
- Direct test execution: `npx vitest run` -- 615 tests pass, 0 failures
- `.planning/v1.4-MILESTONE-AUDIT.md` -- gap identification and recommended fix
- `.planning/REQUIREMENTS.md` -- current checkbox state

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies
- Architecture: HIGH - direct file inspection
- Pitfalls: HIGH - simple scope with verified state

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable, no external dependencies)
