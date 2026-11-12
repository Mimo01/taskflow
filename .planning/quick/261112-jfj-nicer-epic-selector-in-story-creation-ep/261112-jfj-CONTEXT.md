# Quick Task 261112-jfj: Nicer epic selector in story creation + epic selector in story detail sidebar - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

User request: "When I am creating stories, I want a nicer way to select epics. Make the selector nicer with better UI/UX. Also add epic selector to the story detail sidebar, I want to be able to change epics there."

Two surfaces:
1. Create/Edit issue modal — Epic Link field (`taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` ~L397-490; epics query in `useCreateEditQueries.ts` ~L107).
2. Story detail sidebar — Epic MetaRow (`taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` ~L832), currently read-only pill that navigates to the epic.

</domain>

<decisions>
## Implementation Decisions

### Option row content (LOCKED)
- One-line rows: epic shown as the coloured pill (same epicColorToTailwind styling as the sidebar Epic pill) containing the epic name (Epic Name field, fall back to summary), muted epic key right-aligned.
- Check mark on the selected row. A "No epic" row at the top.
- Search input at the top of the popup ("Search epics…").
- Same component used in both the create modal and the sidebar (one shared EpicPicker, like components/ui/person-picker.tsx).

### Search scope (LOCKED)
- Only open epics (statusCategory != Done) in the project.
- Typing runs a SERVER-SIDE Jira search (debounced; matches key or text), not a client filter over a single capped page — see memory "Fetch-once page-cap pitfall". Empty query = most recently updated open epics.
- Needs fields for name + colour (epicNameFieldKey, epicColorFieldKey from settings) in the search response.
- If the currently-linked epic is Done / not in results, the trigger still renders it correctly (resolve its own data).

### Sidebar interaction (Claude's discretion — chosen)
- Clicking the Epic row value opens the picker (consistent with the Sprint / Assignee rows in FieldsSection). Trigger shows the coloured pill (or "—"/"No epic" muted when empty).
- Picker includes an "Open <KEY>" action (footer item) so navigating to the epic is still one click away when an epic is set.
- "No epic" removes the link. Mutation via the existing field-mutation path (useFieldMutation / epic link field PUT); optimistic update + invalidations so the sidebar, backlog rows and the epic's stories section (['jira-epic-stories'] family) refresh. Verify how the epic link is set on this Jira (epicLinkFieldKey customfield PUT); if the field isn't on the edit screen, fall back to the Agile API (POST /rest/agile/1.0/epic/{epicKey}/issue, and /epic/none/issue to remove).
- Stories only (not epics, not subtasks) — same gating as the existing row.

### Claude's Discretion
- Popup width/height, keyboard navigation details (arrow keys + Enter, Esc closes), debounce timing, loading/empty states (use compact EmptyState-style text, e.g. "No open epics match").
- Base on existing primitives (PersonPicker / Popover / Base UI patterns) — memory: Base UI Select needs `items`, popup defaults to anchor width; use Popover-based autocomplete.

</decisions>

<specifics>
## Specific Ideas

Approved row preview:
```
🔍 Search epics…
──────────────────────────
  No epic
✓ [■ Payments revamp]     PRJ-120
  [■ Onboarding v2]       PRJ-98
  [■ Reporting]           PRJ-77
```

Relevant project memories: shared PersonPicker (server-side search pattern), fetch-once page-cap pitfall, optimistic mark unmount (don't branch a stateful mutation cell on a value its own optimistic patch flips), match the local button row, hover affordance without layout shift, issue-detail assignee entry point (FieldsSection + useFieldMutation).

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
