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

---

## REWORK ADDENDUM (2026-06-05) — direct field-PUT rejected by Jira

**Trigger:** The shipped control issues `PUT /rest/api/2/issue/{key}` with
`{ fields: { resolution: { name } } }`. The live ESHOP instance rejects it:
`"Field 'resolution' cannot be set. It is not on the appropriate screen, or unknown."`
On this Jira, `resolution` lives **only on a workflow transition screen**, not the Edit
screen — so a direct field update can never work. Resolution must be set by **executing a
transition** with `fields.resolution` in the POST body.

These decisions SUPERSEDE the "Clearing" mechanism note and the pure `statusCategory==='done'`
edit-gate above where they conflict.

<decisions>
### Mechanism (user: BOTH entry points)
Resolution is set via `POST /rest/api/2/issue/{key}/transitions` with
`{ transition: { id }, fields: { resolution: { id|name } } }`. Two entry points:

1. **In-place sidebar edit (transitions API).**
   - On demand (when the user goes to edit the Resolution row), fetch the issue's REST
     transitions WITH field metadata: `GET /issue/{key}/transitions?expand=transitions.fields`.
   - A transition is "resolution-capable" when its `fields` map contains a `resolution` key.
     Its `fields.resolution.allowedValues` provides the valid resolutions for the picker.
   - **Prefer an in-place transition** (`to.id === currentStatusId`, i.e. a loop) so the
     issue's status does NOT visibly change when only resolution is edited.
   - The sidebar Select is editable **only when an in-place resolution-capable transition
     exists**. This REPLACES the old `statusCategory==='done'` gate (in practice such loops
     exist on done issues, but gate on transition availability, not category).
   - If no in-place resolution-capable transition exists → render Resolution **read-only**
     with a short explanation that it can only be changed via a status transition.
   - Selecting a value executes the in-place transition with `fields.resolution`.

2. **Set during status change (StatusPopover flow).**
   - When the user picks a transition in `StatusPopover` whose screen exposes `resolution`
     (resolution-capable, typically the Resolve/Done transition), present a resolution
     picker as part of that transition, then execute the transition with `fields.resolution`.
   - This is how a brand-new resolution gets set when moving an issue to done.

### Clearing / Unresolved (revised)
- Clearing to "Unresolved" also goes through a transition (`fields: { resolution: null }`)
  and is only offered when a resolution-capable in-place transition supports it. If the
  workflow doesn't allow it, the existing error surface applies — do not special-case.

### Infrastructure
- Extend `postTransition(...)` to accept an optional `fields` object; include `fields` in
  the body only when present (`{ transition: { id }, fields }`). Preserve existing callers
  (`{ transition: { id } }`) unchanged.
- Add a REST `fetchIssueTransitionsWithFields(baseUrl, token, issueKey)` →
  `GET /issue/{key}/transitions?expand=transitions.fields`. React Query key
  `['jira-issue-transitions-fields', issueKey, jiraBaseUrl]`, fetched on demand. This is the
  per-issue interactive path; it is separate from the bulk GreenHopper transitions cache used
  for board/drag flows (do NOT replace that).
- `fetchResolutions` (global list) may remain as a fallback for the picker, but prefer the
  transition's `allowedValues` when available.
- Remove the now-dead direct `updateIssueField('resolution', …)` path from the sidebar.

### Failure surface
- If the REST transitions GET fails, or no resolution-capable transition exists, surface a
  clear inline message rather than a silent no-op. Reuse existing inline error styling.

### Scope decision
- Rebuild directly with self-discovering fallback (the expand=transitions.fields fetch is the
  runtime probe). Validate against the live ESHOP-20308 issue after build.
</decisions>

<specifics>
### Expected REST shapes
- `GET /issue/{key}/transitions?expand=transitions.fields` →
  `{ transitions: [ { id, name, to: { id, name, statusCategory: { key } },
  fields: { resolution?: { required, allowedValues: [ { id, name } ], operations? }, ... } } ] }`
- `POST /issue/{key}/transitions` body → `{ transition: { id }, fields: { resolution: { id } } }`
  (use `{ id }` from allowedValues when available; `{ name }` acceptable; `null` to clear).
</specifics>
</content>
