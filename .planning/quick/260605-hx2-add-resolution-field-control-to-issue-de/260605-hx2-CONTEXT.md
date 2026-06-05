# Quick Task 260605-hx2: Add resolution field control to issue detail sidebar - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Task Boundary

The issue's `resolution` cannot be changed anywhere in the UI today. Add a resolution
control to the issue detail sidebar (FieldsSection) so users can set/change it, mirroring
the existing editable-field pattern.
</domain>

<decisions>
## Implementation Decisions

### When editable
- **Always shown, read-only until done.** The resolution row is always visible in the
  sidebar. It is editable only when the issue's status is in the **done** status-category
  (`statusCategory.key === "done"`). For non-done issues, render the current value
  (or "Unresolved") as plain/read-only text — no edit affordance.
- Determine "done" via the issue's status category, consistent with how status category is
  already known in the detail view.

### Control style
- **Inline Select**, matching the Priority field pattern in `FieldsSection.tsx`
  (click value → inline `Select` dropdown of resolution options). Keep density/visuals
  consistent with Priority/Status, not the heavier Fix Versions popover.

### Clearing / Unresolved
- **Allow Unresolved.** Include an "Unresolved" option that clears the field
  (`mutation.mutate({ fieldName: 'resolution', value: null })`).
- Known caveat: Jira may reject a direct `resolution` field update (including clearing) when
  the field isn't on the issue's edit screen or is transition-only. The existing
  `useFieldMutation` error path (inline error message) is the acceptable failure surface —
  surface the error rather than special-casing it.

</decisions>

<specifics>
## Specific Ideas

- Mirror the **Priority** field implementation in
  `src/routes/dashboard/issue-detail/FieldsSection.tsx` for the inline Select + edit-state +
  `mutation.mutate({ fieldName: 'resolution', value: { id } | null })` pattern.
- Resolution options: fetch the global Jira resolution list (`GET /rest/api/2/resolution`)
  on first interaction, cached via React Query (mirror the Fix Versions on-open fetch).
- `resolution` must be added to the `fetchIssueDetail` fields list and to the
  `JiraIssueDetail` type so the current value is available to render.
- `notifications.ts` already tracks `resolution` in TRACKED_FIELDS — no change needed there.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Jira REST v2
`resolution` endpoint and field semantics are the only external reference.

</canonical_refs>
</content>
