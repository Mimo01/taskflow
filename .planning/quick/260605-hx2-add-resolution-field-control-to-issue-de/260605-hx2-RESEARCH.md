# Quick Task 260605-hx2: Add resolution field control to issue detail sidebar - Research

**Researched:** 2026-06-05
**Domain:** React (TanStack Query) + Jira REST v2 field editing
**Confidence:** HIGH (all findings verified against codebase; Jira payload shapes from existing patterns + REST v2 conventions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Always shown, read-only until done.** Resolution row always visible. Editable only when
  issue status category is `done` (`statusCategory.key === "done"`). For non-done issues,
  render current value (or "Unresolved") as plain/read-only text — no edit affordance.
- Determine "done" via the issue's status category, consistent with how status category is
  already known in the detail view.
- **Inline Select**, matching the Priority field pattern in `FieldsSection.tsx`. Keep density
  consistent with Priority/Status, not the heavier Fix Versions popover.
- **Allow Unresolved.** Include an "Unresolved" option that clears the field
  (`mutation.mutate({ fieldName: 'resolution', value: null })`).
- Known caveat: Jira may reject a direct `resolution` field update (incl. clearing) when the
  field isn't on the issue's edit screen / is transition-only. The existing `useFieldMutation`
  error path (inline error message) is the acceptable failure surface — surface it, don't
  special-case it.

### Claude's Discretion
- Resolution options fetched via `GET /rest/api/2/resolution` on first interaction, cached via
  React Query (mirror Fix Versions on-open fetch).

### Deferred Ideas (OUT OF SCOPE)
- None.
</user_constraints>

## Summary

This is a tightly-scoped UI addition that replicates the existing **Priority** inline-Select
pattern in `FieldsSection.tsx`. All four wiring points already exist and are proven:
`useFieldMutation` (optimistic update + rollback), `updateIssueField` (PUT to issue), the
on-open React Query fetch pattern (Fix Versions/Statuses), and `statusCategory.key` already on
the fetched issue. The only new service code is a tiny `fetchResolutions` fetcher.

**Primary recommendation:** Add `fetchResolutions` to a jira sub-module (mirror
`statuses.ts`), add `resolution` to the `fetchIssueDetail` fields array and the **canonical**
`JiraIssueDetail` type in `jira.ts` (NOT `jira/types.ts` — see Pitfall 1), then add a Resolution
`MetaRow` in `FieldsSection.tsx` copying the Priority block, gated on
`f.status.statusCategory?.key === 'done'`.

<phase_requirements>
## Phase Requirements (quick task — derived from task description)

| ID | Description | Research Support |
|----|-------------|------------------|
| HX2-1 | Resolution row always visible in sidebar | New `MetaRow label="Resolution"` in FieldsSection |
| HX2-2 | Editable only when status category is `done` | `f.status.statusCategory?.key === 'done'` gate (already on type) |
| HX2-3 | Inline Select of resolution options | Copy Priority Select block; options from `fetchResolutions` |
| HX2-4 | "Unresolved" clears field via `value: null` | `updateIssueField` preserves null cleanly (verified) |
| HX2-5 | Current value rendered for non-done issues | `f.resolution?.name ?? 'Unresolved'` |
</phase_requirements>

## Findings (focus questions)

### 1. `updateIssueField` semantics — `value: null` is clean (HIGH)

`jira.ts:1476-1500`. Implementation:
```ts
body: JSON.stringify({ fields: { [fieldName]: value } })
```
- For **setting**: Jira REST v2 `resolution` expects `{ id }` or `{ name }`. Use `{ name }`
  to mirror Priority (`FieldsSection.tsx:311` uses `value: { name: value }`). `{ id }` also
  works; `{ name }` keeps the option-list shape simplest. **[CITED: Jira REST v2 set-field
  conventions — resolution is an object field like priority]**
- For **clearing**: `value: null`. `JSON.stringify` **preserves explicit `null` properties**
  (only `undefined` is dropped), so the body is `{"fields":{"resolution":null}}` — exactly
  what Jira expects to clear a resolution. **No coercion/drop risk.** [VERIFIED: codebase —
  same `value: null` clear path already used for story points (`FieldsSection.tsx:325`),
  fixVersions, and flagged unflag (`jira.ts:239`)]
- The mutation hook (`useFieldMutation.ts:21-25`) passes `value` straight through to
  `updateIssueField`. Optimistic patch (`useFieldMutation.ts:33-39`) writes
  `fields: { resolution: null }` (or the `{ name }` object) — see Pitfall 3 for the display
  mismatch this creates. [VERIFIED: codebase]

**This is the highest-risk area and it is clean** — the existing infra carries `value: null`
without modification.

### 2. Fetching resolution options (HIGH)

Pattern: copy `src/services/jira/statuses.ts` (`fetchAllJiraStatuses`, lines 35-52) — it is
the closest match (global list, Bearer PAT, no project arg). New file/function:

```ts
// src/services/jira/resolutions.ts  (mirror statuses.ts)
export interface JiraResolution { id: string; name: string; description?: string }

export async function fetchResolutions(baseUrl: string, token: string): Promise<JiraResolution[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/resolution`;
  const response = await apiFetch('jira', url,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    'Load Resolutions');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new ApiError('Failed to fetch resolutions', response.status, 'jira');
    throw new Error(`Failed to fetch resolutions: ${response.status}`);
  }
  return (await response.json()) as JiraResolution[]; // bare array
}
```
- `GET /rest/api/2/resolution` returns a **bare array** of `{ id, name, description }`.
  **[CITED: Jira REST v2 — /resolution returns array of resolution objects]**
- Re-export from `jira.ts` mirroring line 2184:
  `export { fetchResolutions, type JiraResolution } from './jira/resolutions';`
- **React Query trigger** — mirror Fix Versions (`FieldsSection.tsx:140-148`) and Statuses.
  Read PAT via `readSecret('jira-pat')`, gate with `enabled`:
  ```ts
  const resolutionsQuery = useQuery({
    queryKey: ['jira-resolutions', jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return [];
      return fetchResolutions(jiraBaseUrl, token);
    },
    enabled: resolutionEditing,           // fetch on first open
    staleTime: Infinity,                  // global list rarely changes
  });
  ```
  Key convention: `['jira-resolutions', jiraBaseUrl]` (project-independent — resolution list is
  global, unlike fix versions which key on `activeJiraProject`). [VERIFIED: codebase patterns]

### 3. Done status-category detection — already available (HIGH)

`statusCategory.key` is **already on the fetched issue** and used in this very file:
- Type: `jira.ts:1212` — `status: { id; name; statusCategory?: { key: string } }`.
- Already consumed at `FieldsSection.tsx:390` (`statusCategoryKey={f.status.statusCategory?.key}`)
  and `:849` (OverdueBadge). The `status` field is in the fetch array (`jira.ts:1359`).

**Exact test:** `f.status.statusCategory?.key === 'done'` (where `const f = issue.fields`,
`FieldsSection.tsx:93`). No fetch change and no type change needed for the gate. [VERIFIED: codebase]

### 4. `fetchIssueDetail` fields + type change (HIGH)

Two edits:
1. **Fields array** — `jira.ts:1357-1383`: add `'resolution'` to the array (anywhere; e.g.
   after `'priority'` line 1362).
2. **Type** — add to the **canonical** `JiraIssueDetail` in **`jira.ts:1206-1251`** (see
   Pitfall 1). Add inside `fields`:
   ```ts
   resolution: { id: string; name: string; description?: string } | null;
   ```
   Jira returns `{ id, name, description } | null` for resolution (null when unresolved).
   **[CITED: Jira REST v2 issue resource — resolution field shape]**

Render current value: `f.resolution?.name ?? 'Unresolved'`. [VERIFIED: codebase type location]

### 5. Pitfalls (actionable)

**Pitfall 1 — Dual `JiraIssueDetail` definitions (CRITICAL).** There are TWO
`JiraIssueDetail` interfaces: `jira.ts:1206` AND `jira/types.ts:142`. `FieldsSection.tsx:30`
and `IssueDetailSidebar.tsx:5` both import from `@/services/jira` → the **`jira.ts:1206`** copy
is canonical and the one that must get the `resolution` field. The `jira/types.ts:142` copy is
NOT re-exported through `@/services/jira` (jira.ts defines its own locally) and is unused by the
sidebar — adding `resolution` there alone will compile but leave the field typed `unknown` via
the index signature in the real path. **Edit `jira.ts:1206`.** (Matches the known
`jira.ts` dual-file gotcha in project memory.)

**Pitfall 2 — Screen-config rejection is expected, not a bug.** Direct `resolution` field
edits via PUT issue are commonly rejected by Jira when resolution isn't on the issue's Edit
screen (it is frequently transition-only). Per CONTEXT, **do not special-case** — the
`useFieldMutation` rollback + the inline `mutation.isError` message
(copy `FieldsSection.tsx:420-422`) is the accepted failure surface. Scope the error message to
the resolution field if other fields share the row region (use
`mutation.variables?.fieldName === 'resolution'`, mirroring `:837`).

**Pitfall 3 — Optimistic-update display mismatch.** `useFieldMutation` onMutate writes the raw
mutation `value` into `fields.resolution` (`useFieldMutation.ts:37`). If you send
`value: { name: 'Done' }`, the optimistic cache holds `{ name: 'Done' }` (no `id`/`description`)
— fine for `f.resolution?.name` rendering. If you send `value: null`, it correctly renders
"Unresolved". The `onSettled` invalidation (`useFieldMutation.ts:48`) refetches the real shape.
No extra handling needed as long as the render path only reads `.name`.

**Pitfall 4 — none in notifications.** `notifications.ts:123` already maps
`resolution: 'Resolution'` in `TRACKED_FIELDS`. **No change needed** — confirmed per CONTEXT.

## Implementation Checklist (for planner)

1. `src/services/jira/resolutions.ts` — new `fetchResolutions` + `JiraResolution` (mirror `statuses.ts`).
2. `jira.ts` — re-export `fetchResolutions`/`JiraResolution` (near line 2184).
3. `jira.ts:1357` — add `'resolution'` to `fetchIssueDetail` fields array.
4. `jira.ts:1206` (canonical type) — add `resolution: { id; name; description? } | null` to fields.
5. `FieldsSection.tsx` — add `resolutionEditing` state + `resolutionsQuery` (on-open, `enabled: resolutionEditing`); add Resolution `MetaRow` after Priority:
   - if `f.status.statusCategory?.key === 'done'` → inline `Select` (copy Priority block, `:399-444`), options = `[Unresolved] + resolutionsQuery.data`, `onValueChange` → `mutation.mutate({ fieldName: 'resolution', value: name === '__unresolved__' ? null : { name } })`.
   - else → read-only `{f.resolution?.name ?? 'Unresolved'}`.

## Sources

### Primary (HIGH confidence — codebase)
- `jira.ts:1206,1357-1383,1476-1500,2184` — type, fetch fields, updateIssueField, re-export.
- `FieldsSection.tsx:93,140-148,308-312,390,399-444` — Priority pattern, fixVersions on-open fetch, status category usage.
- `useFieldMutation.ts:21-48` — optimistic update / rollback / invalidation.
- `jira/statuses.ts:35-52`, `jira/versions.ts:17-55` — fetcher patterns.
- `notifications.ts:123` — resolution already tracked.

### Secondary (Jira REST v2 conventions)
- `GET /rest/api/2/resolution` returns array of `{ id, name, description }`.
- Resolution set via `{ id }` or `{ name }`; cleared via `null` — same object-field convention as priority.

## Metadata
- Standard stack: HIGH — all existing project infra.
- Pitfalls: HIGH — dual-type gotcha verified in this session and in project memory.
- Jira payload shapes: HIGH (set/clear) — `value:null` clear path proven by 3 existing fields.
- **Research date:** 2026-06-05 — **Valid until:** 2026-07-05.
