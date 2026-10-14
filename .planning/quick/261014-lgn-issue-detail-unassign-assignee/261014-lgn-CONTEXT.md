# Quick Task 261014-lgn: Unassign assignee from issue detail - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Task Boundary

On issue detail, the user can add/change the assignee but cannot unassign. The only assignee control is the Edit Issue modal (`taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx`, combobox ~L493-580). Edit save path: `useIssueMutations.ts` L173-175 sends `fields.assignee = name ? {name} : null` via `bulkUpdateIssue` (`services/jira.ts` ~L2754). Jira Server/DC typically needs `{ name: null }` to unassign — `null` is likely ignored.

</domain>

<decisions>
## Implementation Decisions

### Unassign UX
- Add an explicit "Unassigned" option at the top of the assignee dropdown; selecting it unassigns.
- An empty/blurred field with no pick must keep the current assignee (no accidental unassign). Note existing onFocus handler clears selectedAssigneeName — that must not turn into an implicit unassign.

### Entry point
- Edit modal only; no separate inline sidebar control.

### Claude's Discretion
- Payload shape for unassign (verify against Jira Server/DC semantics; likely `{ name: null }`), post-save cache invalidation so the detail view shows "Unassigned" (watch stale fallbacks like `fresh?.assignee ?? sub.fields.assignee` in `services/jira.ts` ~L1940), tests.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
