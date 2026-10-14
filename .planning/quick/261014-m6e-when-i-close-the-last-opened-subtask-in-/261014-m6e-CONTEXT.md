# Quick Task 261014-m6e: Prompt to move story to Done when last open subtask is closed - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Task Boundary

When the user moves the last open subtask of a story to a done state, a modal pops up asking whether to also move the parent story to done.

</domain>

<decisions>
## Implementation Decisions

### Entry points
- Trigger from BOTH places that transition issues: Sprint Board (SprintBoardTab.tsx drag/transition via postTransition) and the issue-detail sidebar status field (FieldsSection.tsx transitionMutation). Share one helper/hook + one modal component; don't duplicate logic.

### "Last open subtask" definition
- Every other sibling subtask has statusCategory=done after this transition. Fetch siblings fresh from the server (not stale cache — see memory: enrichment invalidation no-op / fetch-once pitfalls). Skip the prompt if the parent is already in a done category, or if the issue transitioned is not a subtask / has no parent.

### Story move
- On "Yes", the modal ALWAYS lets the user pick among the parent story's done-category transitions (list from REST expand=transitions; honour fields.resolution requirement via existing resolution flow in FieldsSection / postTransition fields param). "No"/dismiss leaves the story untouched.

### Claude's Discretion
- Modal visual design (reuse existing dialog primitives), query invalidation details, test layout.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Respect memory notes: Base UI Select needs `items`; resolution only via transition; shared fetcher cache keys.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
