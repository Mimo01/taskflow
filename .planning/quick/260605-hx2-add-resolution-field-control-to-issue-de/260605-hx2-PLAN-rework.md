---
phase: quick-260605-hx2
plan: rework
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/transitions.ts
  - taskflow/src/services/jira/transitions.test.ts
  - taskflow/src/services/jira/types.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
  - taskflow/src/routes/dashboard/StatusPopover.tsx
  - taskflow/src/routes/dashboard/StatusPopover.test.tsx
autonomous: true
requirements: [HX2-REWORK]

must_haves:
  truths:
    - "Setting a resolution from the sidebar executes a workflow transition (POST /issue/{key}/transitions with fields.resolution), never a direct field PUT"
    - "The sidebar Resolution row is editable only when an in-place (to.id === currentStatusId) resolution-capable transition exists; otherwise it is read-only with an explanation"
    - "Selecting a resolution in the sidebar uses an id from the transition's fields.resolution.allowedValues and keeps the issue's visible status unchanged"
    - "When a user picks a resolution-capable transition in StatusPopover, a resolution picker is presented and the chosen resolution is sent in that transition's fields"
    - "The dead updateIssueField('resolution', …) path is removed from the sidebar"
    - "postTransition includes a fields object in the POST body only when one is provided; existing callers (no fields) send the unchanged { transition: { id } } body"
  artifacts:
    - path: "taskflow/src/services/jira/transitions.ts"
      provides: "postTransition with optional fields arg; fetchIssueTransitionsWithFields REST fetcher"
      contains: "fetchIssueTransitionsWithFields"
    - path: "taskflow/src/services/jira/types.ts"
      provides: "Transition field-metadata type (allowedValues for resolution)"
      contains: "allowedValues"
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Transition-based Resolution sidebar control"
    - path: "taskflow/src/routes/dashboard/StatusPopover.tsx"
      provides: "Resolution picker step during resolution-capable transitions"
  key_links:
    - from: "FieldsSection resolution control"
      to: "postTransition(..., fields)"
      via: "in-place transition mutation"
      pattern: "postTransition\\("
    - from: "FieldsSection"
      to: "GET /issue/{key}/transitions?expand=transitions.fields"
      via: "fetchIssueTransitionsWithFields on-demand query"
      pattern: "fetchIssueTransitionsWithFields"
    - from: "StatusPopover"
      to: "onSelect(transitionId, toName, { resolution })"
      via: "resolution-during-transition payload"
      pattern: "onSelect\\("
---

<objective>
Rework the issue-detail Resolution control so resolution is set by EXECUTING a workflow
transition (POST /issue/{key}/transitions with `fields.resolution`) instead of a direct
field PUT, which the live ESHOP Jira rejects ("Field 'resolution' cannot be set"). Deliver
BOTH entry points from the REWORK ADDENDUM: (1) an in-place sidebar edit that runs a
resolution-capable loop transition without visibly changing status, and (2) a resolution
picker step inside the StatusPopover status-change flow.

Purpose: The shipped direct-PUT control is non-functional on this Jira instance where
`resolution` lives only on transition screens. The transition mechanism is the only path
that works.
Output: Extended `postTransition`, a new on-demand `fetchIssueTransitionsWithFields` fetcher
+ field-metadata type, a transition-driven sidebar Resolution control, a StatusPopover
resolution step, and tests for all three.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260605-hx2-add-resolution-field-control-to-issue-de/260605-hx2-CONTEXT.md

@taskflow/src/services/jira/transitions.ts
@taskflow/src/services/jira/transitions.test.ts
@taskflow/src/services/jira/resolutions.ts
@taskflow/src/services/jira/types.ts
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
@taskflow/src/routes/dashboard/StatusPopover.tsx
@taskflow/src/routes/dashboard/StatusPopover.test.tsx

# Read the "REWORK ADDENDUM (2026-06-05)" section of CONTEXT.md first — its decisions are
# LOCKED and supersede the earlier "Clearing" and "statusCategory==='done'" notes.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend postTransition with optional fields; add fetchIssueTransitionsWithFields + field-metadata type</name>
  <files>taskflow/src/services/jira/transitions.ts, taskflow/src/services/jira/transitions.test.ts, taskflow/src/services/jira/types.ts, taskflow/src/services/jira.ts</files>
  <behavior>
    - postTransition(baseUrl, token, issueKey, transitionId) with NO fields arg → POST body is exactly `{ transition: { id } }` (existing callers unaffected).
    - postTransition(..., fields) with a fields object → POST body is `{ transition: { id }, fields }`; passing `{ resolution: { id: '1' } }` puts that under body.fields; passing `{ resolution: null }` is preserved (clearing).
    - fetchIssueTransitionsWithFields(baseUrl, token, issueKey) → GET `/rest/api/2/issue/{key}/transitions?expand=transitions.fields`, returns the `transitions` array; 401/403 throw ApiError, other non-OK throw Error (mirror fetchResolutions envelope).
  </behavior>
  <action>
    In transitions.ts: add an optional 5th param `fields?: Record<string, unknown>` to
    postTransition. Build the body as `{ transition: { id: transitionId }, ...(fields ? { fields } : {}) }`
    so the `fields` key is present ONLY when supplied (use a presence check, NOT truthiness —
    `fields` may legitimately be an object containing a null resolution). Do not change the
    existing URL, headers, or error handling. The two current callers (FieldsSection:254,
    SprintBoardTab:1185) pass no fields and MUST keep working unchanged.

    Add a new exported async `fetchIssueTransitionsWithFields(baseUrl, token, issueKey)`:
    GET `${baseUrl.replace(/\/$/,'')}/rest/api/2/issue/${issueKey}/transitions?expand=transitions.fields`
    with Bearer auth, apiFetch label 'Load Transitions'. On non-OK: 401/403 → ApiError, else
    generic Error (copy the envelope from fetchResolutions in resolutions.ts). Parse JSON and
    return the `.transitions` array typed as the new metadata type below.

    In types.ts: add an exported `JiraTransitionWithFields` type that extends the transition
    shape with `to: { id; name; statusCategory?: { key } }` and an optional `fields?` map where
    each entry is `{ required: boolean; allowedValues?: Array<{ id: string; name: string }>;
    operations?: string[] }`. A transition is "resolution-capable" iff `fields?.resolution`
    exists; `fields.resolution.allowedValues` is the picker source. Keep the existing
    JiraTransition untouched (do NOT widen the GreenHopper-fed type). Per the dual-file
    convention (types.ts ↔ jira.ts), mirror the new type into jira.ts as well, or re-export it.

    In jira.ts: re-export `fetchIssueTransitionsWithFields` and the new type from
    './jira/transitions' and './jira/types' respectively, following the existing
    `export { postTransition } from './jira/transitions'` (jira.ts:610) and
    `export { fetchResolutions, type JiraResolution } from './jira/resolutions'` (jira.ts:2186)
    patterns.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/jira/transitions.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>postTransition omits fields when none given and nests them when given; fetchIssueTransitionsWithFields hits the expand=transitions.fields URL with the resolutions-style error envelope; new type + re-exports compile; existing postTransition tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rework sidebar Resolution control to use in-place transition with fields</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx</files>
  <behavior>
    - On opening the Resolution editor, fetchIssueTransitionsWithFields runs (React Query key `['jira-issue-transitions-fields', issueKey, jiraBaseUrl]`, enabled only while editing).
    - "resolution-capable in-place transition" = a returned transition where `to.id === f.status.id` AND `fields.resolution` exists. The Select is editable only when such a transition exists.
    - When NO in-place resolution-capable transition exists → Resolution renders read-only with a short note ("Resolution can only be changed via a status transition.").
    - Selecting a value calls postTransition with `fields: { resolution: { id } }` using an id from that transition's allowedValues; "Unresolved" sends `fields: { resolution: null }` only when offered. The issue's visible status does NOT change (in-place loop).
    - Errors (fetch failure or transition rejection) surface inline; no special-casing of screen rejection.
  </behavior>
  <action>
    Remove the dead `handleResolutionChange` path and its `mutation.mutate({ fieldName:'resolution', … })`
    calls (FieldsSection:330-338) and the old `fetchResolutions`-only `resolutionsQuery` gating that fed the
    direct-PUT Select. Remove the `f.status.statusCategory?.key === 'done'` edit-gate (lines ~475-515).

    Add an on-demand query using fetchIssueTransitionsWithFields keyed
    `['jira-issue-transitions-fields', issueKey, jiraBaseUrl]`, `enabled: resolutionEditing`,
    `staleTime` short or Infinity per fix-versions precedent. Derive `inPlaceResolutionTransition`
    = first transition where `to.id === f.status.id && fields?.resolution`. Picker options come
    from `inPlaceResolutionTransition.fields.resolution.allowedValues` (prefer this over the global
    fetchResolutions list; the addendum permits keeping fetchResolutions as a fallback only).

    Add a resolution-transition mutation (reuse the existing transitionMutation structure at
    lines 250-293 for optimistic detail handling + invalidations, but pass `fields:
    { resolution: { id } | null }` to postTransition and do NOT optimistically change status.name
    since this is an in-place loop). On select: call it with the in-place transition id and the
    chosen resolution.

    Render logic in the Resolution MetaRow (~474-516): keep `data-testid="resolution-value"` for
    the read-only span and `data-testid="resolution-edit"` for the edit button, matching existing
    tests' selectors. When `resolutionEditing` and an in-place resolution-capable transition
    exists → inline Select (base-ui, Priority-style) whose items are the transition allowedValues
    (id as value, name as label) plus an "Unresolved" item (value `__unresolved__`) when clearing
    is supported. When editing but no capable transition (or the fetch errored/empty) → show the
    read-only value plus the inline explanation note. Surface mutation/fetch errors with the
    existing `text-xs text-destructive` styling.

    Update FieldsSection.test.tsx: add a mock for
    `@/services/jira/transitions` exporting both `postTransition: vi.fn()` and
    `fetchIssueTransitionsWithFields: vi.fn()` (extend the existing transitions mock at lines
    64-66). Use the same native-`<select>` Select stand-in already mocked (lines 85-134).
    Replace the two now-obsolete Resolution tests (lines 403-428, which assert the old
    `mutation.mutate({ fieldName:'resolution' })` payload) with:
    (a) read-only + explanation when fetch returns no in-place resolution-capable transition;
    (b) editable Select whose options come from the transition allowedValues when an in-place
    resolution-capable transition exists, and selecting an option calls postTransition with the
    transition id and `fields: { resolution: { id } }`. Mock fetchIssueTransitionsWithFields to
    return a transition with `to.id` matching the issue's `status.id` and a `fields.resolution.allowedValues`.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/issue-detail/FieldsSection.test.tsx</automated>
  </verify>
  <done>No direct-PUT resolution path remains; the sidebar Select is editable only with an in-place resolution-capable transition, executes that transition with fields.resolution, leaves visible status unchanged, and shows the read-only explanation otherwise; tests cover capable + non-capable cases.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add resolution picker step to StatusPopover status-change flow</name>
  <files>taskflow/src/routes/dashboard/StatusPopover.tsx, taskflow/src/routes/dashboard/StatusPopover.test.tsx, taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx</files>
  <behavior>
    - Picking a transition whose screen exposes resolution (resolution-capable) presents a resolution picker before executing, then calls onSelect with the chosen resolution included.
    - Picking a non-resolution-capable transition behaves exactly as today (onSelect(transitionId, toName) immediately).
    - FieldsSection's onSelect handler forwards the resolution into postTransition's fields when present.
  </behavior>
  <action>
    StatusPopover today reads from the GreenHopper cache (useGhTransitions) which carries NO
    per-transition field metadata. To learn which picked transition is resolution-capable, fetch
    that issue's REST transitions-with-fields on demand. Because StatusPopover only receives
    projectId/issueTypeId (not issueKey), thread an optional `issueKey` and `jiraBaseUrl` prop
    in from FieldsSection (it already has both) and run fetchIssueTransitionsWithFields with the
    same `['jira-issue-transitions-fields', issueKey, jiraBaseUrl]` key (shared cache with Task 2,
    enabled when the popover is open). Match the picked GH transition to its REST counterpart by
    `id` to read `fields?.resolution`.

    Extend `onSelect` signature to an optional third arg:
    `onSelect(transitionId, toStatusName, opts?: { resolution: { id: string } | null })`. When the
    picked transition is resolution-capable, instead of closing immediately, show a second step in
    the same popover: a resolution picker built from that transition's `fields.resolution.allowedValues`
    (Select or button list, consistent with the popover's existing item styling). On choosing a
    resolution, call `onSelect(id, toName, { resolution: { id } })` and close. Non-capable
    transitions keep calling `onSelect(id, toName)` with no opts (unchanged behavior). If the REST
    fetch is still loading/errored, fall back to the plain transition (no resolution step) rather
    than blocking.

    In FieldsSection: update the `handleTransition`/transitionMutation wiring so the StatusPopover
    onSelect's optional resolution is forwarded into postTransition as `fields: { resolution }`.
    Keep the existing optimistic status.name update for genuine status changes here.

    StatusPopover.test.tsx: extend the `@/services/jira` mock to also export
    `fetchIssueTransitionsWithFields` (or mock `@/services/jira/transitions`). Add a test: when the
    matched REST transition is resolution-capable, selecting it surfaces a resolution picker and
    choosing a resolution calls onSelect with `{ resolution: { id } }`; when not capable, onSelect
    is called immediately without opts (existing tests must still pass with the new optional prop).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/StatusPopover.test.tsx src/routes/dashboard/issue-detail/FieldsSection.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Resolution-capable transitions in StatusPopover present a resolution step and pass the choice through onSelect into postTransition fields; non-capable transitions are unchanged; existing StatusPopover tests pass; types compile.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` passes (biome + tsc clean — repo baseline is GREEN).
- `cd taskflow && npx vitest run src/services/jira/transitions.test.ts src/routes/dashboard/issue-detail/FieldsSection.test.tsx src/routes/dashboard/StatusPopover.test.tsx` all pass.
- Grep confirms no surviving direct-PUT resolution path: `grep -rn "fieldName: 'resolution'" taskflow/src` returns nothing.
- Post-build manual validation against live ESHOP-20308 (per addendum scope decision): set + clear resolution from the sidebar and via a status change.
</verification>

<success_criteria>
- Resolution is set exclusively through transitions; the direct updateIssueField('resolution', …) sidebar path is gone.
- Sidebar Resolution row: editable iff an in-place resolution-capable transition exists (status stays visibly unchanged), read-only with explanation otherwise.
- StatusPopover presents a resolution step for resolution-capable transitions and forwards the choice.
- postTransition is backward compatible (no fields ⇒ unchanged body); fetchIssueTransitionsWithFields uses expand=transitions.fields with the standard error envelope and is re-exported from jira.ts.
- All three test files pass; `npm run check` GREEN.
</success_criteria>

<output>
Create `.planning/quick/260605-hx2-add-resolution-field-control-to-issue-de/260605-hx2-SUMMARY-rework.md` when done.
</output>
