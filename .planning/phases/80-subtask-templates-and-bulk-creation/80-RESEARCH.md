# Phase 80: Subtask Templates and Bulk Creation — Research

**Researched:** 2026-06-05
**Domain:** Tauri + React + TanStack Query + zustand — Jira DC subtask creation pipeline, createmeta field resolution, sequential bulk creation, persistent template store
**Confidence:** HIGH (all findings verified from codebase source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Templates are global — single `createTauriStorage('subtask-templates.json')` store. Not keyed per project.
- **D-02:** Field resolution at apply time against active project's subtask createmeta. Fields/values not supported silently dropped; "N fields skipped" badge in preview (unobtrusive, not blocking).
- **D-03:** Dropping (not blocking) even for required fields — missing required fields only surface through create-time API error, never as a hard pre-preview block.
- **D-04:** Each template stores its chosen subtask issue type. That type's createmeta determines editable fields.
- **D-05:** Bulk modal subtask type defaults to template's stored type; ad-hoc defaults to first subtask type from `issuetype.subtask === true`. Never name comparison.
- **D-06:** Subtask type per-template, not per-row — all rows share one issue type.
- **D-07:** Curated core inline (title, assignee, priority, labels, due date, original estimate, story points) + Advanced expand (components, custom fields) per row.
- **D-08:** Full optional field set reachable via Advanced expand.
- **D-09:** Placeholders resolve at creation time: `@inherit` → assignee, priority, labels, components, due date from parent; `@current` → logged-in user as assignee; `@unassigned` → cleared assignee.
- **D-10:** New ad-hoc rows default assignee to `@inherit`.
- **D-11:** Placeholder chips show resolved-value hints at preview time (e.g. `@inherit → Alice`); authoritative resolution recomputed at create time.
- **D-12:** `@inherit` on a field the parent has no value for resolves to empty — no error.

### Claude's Discretion
- Exact chip colors/styling (resolved in UI-SPEC).
- "N fields skipped" badge copy (resolved in UI-SPEC).
- Ad-hoc empty state (resolved in UI-SPEC).
- Whether Settings editor reuses same row component as bulk modal preview (recommended).

### Deferred Ideas (OUT OF SCOPE)
- Per-row subtask-type selection (explicitly rejected — D-06).
- Project-scoped template storage (explicitly rejected — D-01).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUBTPL-01 | User can create, edit, and delete named subtask templates in Settings | Settings.tsx SECTIONS pattern + WorkflowSection.tsx shell confirmed |
| SUBTPL-02 | Templates persist across sessions (Tauri Store, mirroring tempo-filters pattern) | `tempo-filters.store.ts` + `tauri-storage.ts` fully read; exact pattern confirmed |
| SUBTPL-03 | Each template line: required title + optional createmeta-derived fields | `fetchCreatemeta()` + `CreatemetaField` type + `wrapCustomFieldValue()` confirmed |
| SUBTPL-04 | Apply template or ad-hoc from parent issue to create multiple subtasks | `IssueDetailContent.tsx` subtask section + `createIssue()` subtask payload confirmed |
| SUBTPL-05 | Preview and inline-edit resolved subtask list before creating | Placeholder chip model + `BulkProgressIndicator` adaptation path confirmed |
| SUBTPL-06 | Creates all subtasks under parent in listed order | Sequential `for` loop (not Promise.all); `parent: { key }` + `issueTypeId` payload confirmed |
| SUBTPL-07 | Partial failure surfaced per-subtask; retry skips already-created subtasks | Per-row status model (pending/creating/created/failed) + key tracking — no existing dedup helper, must implement |
| SUBTPL-08 | Parent-inheritance placeholders resolve at creation time | `jiraUsername` + `jiraUserDisplayName` in `auth.store.ts`; parent fields available via `issue` prop in `IssueDetailContent` |
</phase_requirements>

---

## Summary

Phase 80 builds on a mature pipeline of already-working primitives. Every major building block exists: the store pattern is exactly mirrored in `tempo-filters.store.ts`, the createmeta query chain is in `useCreateEditQueries.ts`, the field rendering is in `CustomFieldsSection.tsx`, the creation call is `createIssue()` with a well-understood Jira DC payload, the progress indicator pattern is `BulkProgressIndicator.tsx`, and the modal shell is `CreateEditIssueModal.tsx`. The primary implementation effort is wiring these together with new components and a new store, not building from scratch.

The three genuine risk areas are: (1) field normalization at apply time — computing the "N fields skipped" count correctly by comparing template field IDs against createmeta; (2) per-row retry state machine guaranteeing no duplicate creation — requires careful per-row `createdKey` tracking independent of React Query; (3) placeholder resolution — `@current` sources `jiraUsername` from `useAuthStore`, `@inherit` reads from the `issue` prop already available in `IssueDetailContent`, but `components` is not currently in the `JiraIssueDetail` fields list returned by `fetchIssueDetail` and will need to be added.

The sequential `for` loop creation model is already the roadmap-mandated pattern and fits naturally with per-row status tracking. Cache invalidation after creation is straightforward: `boardId` is derived via `useBoardId()` (exactly as in `FieldsSection.tsx`), and the three query keys are confirmed with exact shapes.

**Primary recommendation:** Build `SubtaskTemplatesSection.tsx` (Settings) and `BulkCreateSubtasksModal.tsx` as the two primary surfaces, sharing `SubtaskTemplateRow.tsx` and a new `useSubtaskTemplatesStore`. Source `boardId` via the existing `useBoardId()` hook, use `invalidateGhAllData(qc, boardId)` on success, and track per-row `{ status, createdKey }` in local component state to guarantee retry safety.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template persistence (create/rename/reorder/delete) | Frontend store (zustand + Tauri LazyStore) | — | Mirrors tempo-filters pattern; no server-side state |
| Createmeta field discovery | API / Backend (Jira DC REST) | Frontend cache (TanStack Query) | `fetchCreatemeta()` calls Jira DC; results cached with `staleTime: 5min` |
| Field resolution / "N skipped" computation | Browser / Client | — | Pure data transform: compare template field IDs against createmeta `fieldId` set |
| Placeholder resolution at preview | Browser / Client | — | Read-only computation from parent issue fields already in component state |
| Authoritative placeholder resolution at create | Browser / Client | — | Recomputed from parent `issue` prop at create-loop time; no API call |
| Sequential subtask creation | Browser / Client (async loop) | Jira DC REST | `for` loop calling `createIssue()` per row; Jira DC has no batch-create |
| Per-row progress display | Browser / Client | — | Local `useState` status array; `BulkProgressIndicator` for aggregate bar |
| Cache invalidation | Browser / Client | — | Three `queryClient.invalidateQueries()` calls after any creation success |
| Settings UI integration | Browser / Client | — | New section in `Settings.tsx` SECTIONS array |
| Modal trigger | Browser / Client | — | New button in `IssueDetailContent.tsx` subtask section |

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | (project version) | Template store state | Project-wide store pattern |
| `@tauri-apps/plugin-store` (LazyStore) | (project version) | Persistent file-backed storage | `createTauriStorage()` used by all stores |
| `@tanstack/react-query` | (project version) | Createmeta + assignable-users caching | Project-wide data fetching |
| `@dnd-kit/core` + `@dnd-kit/sortable` | `^6.3.1` / `^10.0.0` | Row and template reorder | Already used in BacklogPage (P78), SprintBoard (P79) |
| `@base-ui/react/dialog` | (project version) | Modal shell | Already used by `CreateEditIssueModal` |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn Button, Input, Select, Progress | (project) | Core UI primitives | Standard project UI; no new installs needed |
| lucide-react | (project) | Icons | All icon usage |

**No new packages to install.** All dependencies are present. [VERIFIED: codebase read]

---

## Package Legitimacy Audit

No new packages are installed in this phase. All required dependencies (`zustand`, `@tauri-apps/plugin-store`, `@tanstack/react-query`, `@dnd-kit/*`, `@base-ui/react`, shadcn components, lucide-react) are already present in `taskflow/package.json`. [VERIFIED: codebase read]

---

## Architecture Patterns

### System Architecture Diagram

```
Settings Page
  └─ SubtaskTemplatesSection
       ├─ useSubtaskTemplatesStore (zustand persist → subtask-templates.json)
       └─ SubtaskTemplateRow[] (dnd-kit sortable)

IssueDetailContent
  └─ "Bulk Create Subtasks" button
       └─ BulkCreateSubtasksModal (open, parentKey, parentIssue)
            ├─ useCreateEditQueries (createmeta, assignable-users, issueTypes)
            ├─ SubtaskTemplateRow[] (same component, preview mode)
            └─ sequential createIssue() for-loop
                 ├─ per-row status: pending → creating → created/failed
                 ├─ BulkProgressIndicator (aggregate bar)
                 └─ on any success: invalidate 3 query keys
```

### Recommended Project Structure
```
taskflow/src/
├─ stores/
│   └─ subtask-templates.store.ts          # new — mirrors tempo-filters.store.ts
├─ routes/
│   ├─ settings/
│   │   └─ SubtaskTemplatesSection.tsx     # new — settings section
│   └─ dashboard/
│       ├─ create-edit-issue/
│       │   └─ SubtaskTemplateRow.tsx      # new — shared row component
│       └─ BulkCreateSubtasksModal.tsx     # new — bulk create modal
```

### Pattern 1: Template Store (mirrors tempo-filters.store.ts exactly)

[VERIFIED: codebase read — `taskflow/src/stores/tempo-filters.store.ts`]

```typescript
// src/stores/subtask-templates.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';

export interface SubtaskTemplateRow {
  id: string;           // nanoid or crypto.randomUUID()
  title: string;        // required
  assignee: string | '@inherit' | '@current' | '@unassigned'; // placeholder or username
  priority: string | null;
  labels: string[];
  duedate: string | null;  // ISO date string or null
  timeEstimate: string;    // e.g. "2h" — passed as timetracking.originalEstimate
  storyPoints: number | null;
  // Advanced fields:
  components: string[];    // component IDs
  customFieldValues: Record<string, string>; // fieldId → raw string value
}

export interface SubtaskTemplate {
  id: string;
  name: string;
  subtaskIssueTypeId: string;   // ID from createmeta issuetypes — stored at template-creation time
  subtaskIssueTypeName: string; // Display name — needed for legacy fetchCreatemeta fallback
  rows: SubtaskTemplateRow[];
}

interface SubtaskTemplatesState {
  templates: SubtaskTemplate[];
  addTemplate: (t: SubtaskTemplate) => void;
  removeTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
  updateTemplate: (id: string, patch: Partial<SubtaskTemplate>) => void;
  moveTemplate: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
}

export const useSubtaskTemplatesStore = create<SubtaskTemplatesState>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      renameTemplate: (id, name) =>
        set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, name } : t)) })),
      updateTemplate: (id, patch) =>
        set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      moveTemplate: (id, direction) =>
        set((s) => {
          const idx = s.templates.findIndex((t) => t.id === id);
          if (idx === -1) return s;
          const arr = [...s.templates];
          const [item] = arr.splice(idx, 1);
          if (direction === 'up') arr.splice(Math.max(0, idx - 1), 0, item);
          else if (direction === 'down') arr.splice(Math.min(arr.length, idx + 1), 0, item);
          else if (direction === 'front') arr.unshift(item);
          else arr.push(item);
          return { templates: arr };
        }),
    }),
    {
      name: 'subtask-templates-store',
      storage: createTauriStorage('subtask-templates.json'),
      version: 1,
      migrate: (persisted, _version) => persisted as SubtaskTemplatesState,
    },
  ),
);
```

### Pattern 2: createIssue() Subtask Payload

[VERIFIED: codebase read — `taskflow/src/services/jira.ts` ~L1605 + `useIssueMutations.ts`]

The Jira DC payload for a subtask is built by passing `options` to `createIssue()`. All keys with `undefined` values are stripped automatically inside the function.

```typescript
// Key DC constraints:
// - assignee: { name: username }  — NOT { accountId } (Cloud-only)
// - timetracking: { originalEstimate: "2h" }  — for original estimate
// - parent: { key: parentKey }  — required for subtasks
// - issueTypeId: string  — numeric ID string, sent as { id }
// - storyPoints: via storyPointsFieldKey (dynamic — from settings store)
// - labels: string[]  — passed as labels array directly
// - duedate: "YYYY-MM-DD" string — passed as duedate
// - components: [{ id: componentId }]  — array of objects

const options: Record<string, unknown> = {};
if (row.assignee && row.assignee !== '@unassigned') {
  const resolvedName = resolveAssigneeName(row.assignee, parentIssue, currentUser);
  if (resolvedName) options.assignee = { name: resolvedName };
  // @unassigned → omit assignee field entirely (or send null — omit is safer)
}
if (row.priority) options.priority = { name: row.priority };
if (row.labels.length) options.labels = row.labels;
if (row.duedate) options.duedate = row.duedate;
if (row.timeEstimate.trim()) options.timetracking = { originalEstimate: row.timeEstimate.trim() };
if (row.storyPoints != null && storyPointsFieldKey)
  options[storyPointsFieldKey] = row.storyPoints;
if (row.components.length)
  options.components = row.components.map((id) => ({ id }));
// Custom fields:
for (const [fieldId, rawValue] of Object.entries(row.customFieldValues)) {
  if (!rawValue.trim()) continue;
  const fieldMeta = creatmetaFields?.find((f) => f.fieldId === fieldId);
  options[fieldId] = fieldMeta ? wrapCustomFieldValue(fieldMeta, rawValue) : rawValue;
}

await createIssue(jiraBaseUrl, token, projectKey, row.title, {
  issueTypeId,           // template's stored subtask type ID
  parent: { key: parentKey },
  ...options,
});
```

**CRITICAL — DC-specific:**
- Never send ADF for description — DC accepts wiki markup strings only.
- `@unassigned`: omit the `assignee` key entirely rather than sending `null` (DC behavior safer than Cloud null-clear).
- `storyPointsFieldKey` is dynamic from `useSettingsStore()` — never hardcode `customfield_10016`.

[VERIFIED: jira.ts L1592–1596 comment, L1614 assignee format, L1626–1629 issuetype logic]

### Pattern 3: Createmeta Query Chain for Subtask Types

[VERIFIED: codebase read — `useCreateEditQueries.ts` L58–81]

The existing `useCreateEditQueries` hook provides the exact pattern. For the bulk modal, the query chain needs to:

1. Query `['createmeta-issuetypes', projectKey]` → GET `.../issue/createmeta/{projectKey}/issuetypes` → returns `{ id, name, subtask: boolean }[]`
2. Filter by `t.subtask === true` → these are the available subtask types (D-05)
3. Query `['createmeta', projectKey, selectedIssueTypeId, 'Subtask']` → `fetchCreatemeta(baseUrl, token, projectKey, issueTypeId, issueTypeName)` → returns `CreatemetaField[]`

The `useCreateEditQueries` hook already handles the two-step chain, the Jira version adaptive fallback (8.4+ paginated vs legacy flat endpoint), and the `staleTime: 5 * 60 * 1000` cache. The bulk modal should reuse this hook directly or extract the subtask-specific portion.

### Pattern 4: Field Resolution / "N Fields Skipped" Computation

[VERIFIED: codebase read — `useCreateEditQueries.ts` CORE_FIELD_IDS, `CustomFieldsSection.tsx`]

At apply-template time, the modal has:
- `templateRows[]` — each row's field IDs (assignee, priority, labels, duedate, timetracking, storyPoints key, components, plus any `customFieldValues` keys)
- `creatmetaFields[]` — `CreatemetaField[]` for the currently selected subtask issue type

The "fields skipped" count is computed per template row as:
```typescript
// Fields in the template row that are NOT in createmeta:
const creatmetaFieldIds = new Set(creatmetaFields.map((f) => f.fieldId));
// Core fields always allowed (they're standard Jira fields regardless of createmeta):
const ALWAYS_ALLOWED = new Set(['summary', 'assignee', 'priority', 'labels', 'duedate',
  'timetracking', 'parent', storyPointsFieldKey]);
const skippedCount = Object.keys(row.customFieldValues).filter(
  (fid) => !creatmetaFieldIds.has(fid) && !ALWAYS_ALLOWED.has(fid)
).length;
// Add components if row.components.length > 0 and 'components' not in creatmetaFieldIds
```

Only custom fields in the template's `customFieldValues` map need checking — the seven curated core fields (title, assignee, priority, labels, duedate, estimate, story points) are standard Jira DC subtask fields and will always be accepted. Components (`fieldId: 'components'`) may or may not appear in subtask createmeta depending on the project configuration.

### Pattern 5: Placeholder Resolution

[VERIFIED: codebase read — `auth.store.ts` + `IssueDetailContent.tsx` + `JiraIssueDetail` type]

`@current` assignee resolution:
```typescript
// useAuthStore provides:
const { jiraUsername, jiraUserDisplayName } = useAuthStore();
// For display hint: jiraUserDisplayName
// For createIssue payload: { name: jiraUsername }
```

`@inherit` resolution — available fields on `JiraIssueDetail.fields`:
```typescript
// Available directly on issue.fields (confirmed from JiraIssueDetail type):
issue.fields.assignee?.name          // @inherit assignee
issue.fields.assignee?.displayName   // display hint
issue.fields.priority?.name          // @inherit priority
issue.fields.labels                  // string[] — @inherit labels
issue.fields.duedate                 // string | null — @inherit due date
// Components: NOT currently in JiraIssueDetail.fields — needs addition
// See Pitfall 2 below.
```

`@unassigned` resolution: produces no assignee field in the payload (explicit cleared state).

**At preview time:** compute hints from the `issue` prop already in scope in `IssueDetailContent`. No additional API calls needed.

**At create time:** re-read the same `issue` prop state (which may have been refreshed by the time the user clicks Create). This is the "authoritative resolution" from D-11.

### Pattern 6: Sequential Creation + Retry State Machine

[VERIFIED: analysis of BulkProgressIndicator.tsx + createIssue() contract]

Per-row state stored in local component state (not a store — ephemeral creation state):

```typescript
type RowStatus = 'pending' | 'creating' | 'created' | 'failed';

interface RowState {
  status: RowStatus;
  createdKey?: string;  // Set on success — used to skip on retry
  error?: string;       // Error message on failure
}

// Sequential creation:
async function createAll(rows: ResolvedRow[], rowStates: RowState[]) {
  const newStates = [...rowStates];
  for (let i = 0; i < rows.length; i++) {
    if (newStates[i].status === 'created') continue; // SUBTPL-07: skip already-created
    newStates[i] = { ...newStates[i], status: 'creating' };
    setRowStates([...newStates]);  // trigger render
    try {
      const result = await createIssue(baseUrl, token, projectKey, rows[i].title, rows[i].options);
      newStates[i] = { status: 'created', createdKey: result.key };
    } catch (e) {
      newStates[i] = { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
    }
    setRowStates([...newStates]);
  }
  // After loop: invalidate queries if any succeeded
  if (newStates.some((s) => s.status === 'created')) {
    await invalidateQueries();
  }
}

// Retry: call createAll with same rows array — already-created rows are skipped by status check
```

**Retry-no-duplicate guarantee (SUBTPL-07):** The `if (status === 'created') continue` guard at the top of the loop is the complete mechanism. No server-side dedup needed. The `createdKey` field provides visible confirmation of what was already created.

**BulkProgressIndicator adaptation:** The existing component takes `{ total, completed, succeeded, failed, failures: Array<{key, error}> }`. Derive these from the `RowState[]` array:
```typescript
const total = rows.length;
const completed = rowStates.filter(s => s.status === 'created' || s.status === 'failed').length;
const succeeded = rowStates.filter(s => s.status === 'created').length;
const failed = rowStates.filter(s => s.status === 'failed').length;
const failures = rowStates
  .filter(s => s.status === 'failed')
  .map((s, i) => ({ key: rows[i].title, error: s.error ?? 'Unknown error' }));
```

Note: `failures[].key` in `BulkProgressIndicator` is used as a display label. Use `rows[i].title` for pending rows (no issue key yet) and `rowStates[i].createdKey` only for created rows. On failure the row has no created key, so title is the appropriate identifier.

### Pattern 7: Cache Invalidation

[VERIFIED: codebase read — `useGhAllData.ts`, `useFieldMutation.ts`, `IssueDetailView.tsx` L153]

Three invalidations required after any successful creation:

```typescript
// 1. Sprint board (gh-all-data)
import { invalidateGhAllData } from '@/services/jira/greenhopper/useGhAllData';
invalidateGhAllData(queryClient, boardId ?? undefined);

// 2. Parent issue detail
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', parentKey, jiraBaseUrl] });

// 3. Subtask enrichment — the key shape confirmed from IssueDetailView.tsx L153:
//    ['jira-subtask-enrichment', issueKey, jiraBaseUrl, subtaskSignature]
//    subtaskSignature changes after new subtasks exist — invalidate by prefix
queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment', parentKey] });
```

**boardId source:** Use `useBoardId(jiraBaseUrl, jiraToken, activeJiraProject)` hook — exactly as in `FieldsSection.tsx`. This prefers the user-chosen board from `jiraBoardIds` store map, falling back to `fetchBoardId()` discovery. Pass as optional to `invalidateGhAllData(qc, boardId ?? undefined)`.

**subtaskSignature invalidation:** The enrichment query key includes `subtaskSignature` (the joined subtask keys). After creating new subtasks, the parent's `subtasks` array changes, so the signature changes, producing a new cache key. Invalidating by prefix `['jira-subtask-enrichment', parentKey]` hits the old key regardless of signature. [VERIFIED: IssueDetailView.tsx L149, L153]

### Pattern 8: Settings Integration

[VERIFIED: codebase read — `Settings.tsx` L44–54, L84–97]

```typescript
// In Settings.tsx:
// 1. Add to SettingsSection type union:
type SettingsSection = ... | 'subtask-templates';

// 2. Add to SECTIONS array:
{ id: 'subtask-templates', label: 'Subtask Templates', icon: <LayoutTemplate className="h-4 w-4" /> }

// 3. Add to render block:
{activeSection === 'subtask-templates' && <SubtaskTemplatesSection />}
```

The content area has `max-w-2xl` constraint — the template editor fits within this. The bulk modal at 860px is rendered as a dialog overlay, not inside the settings panel.

### Anti-Patterns to Avoid

- **Promise.all for creation:** Must use sequential `for` loop (roadmap mandate). `Promise.all` prevents per-row status tracking and makes partial failure recovery harder.
- **Storing createdKey in the template store:** `createdKey` is ephemeral per-creation-session state — keep it in component state only, never persist to the store.
- **issuetype name comparison for subtask detection:** Always use `issuetype.subtask === true` flag. Admins can rename issue types. [VERIFIED: jira.ts L159 comment]
- **Hardcoding `customfield_10016` for story points:** Always read `storyPointsFieldKey` from `useSettingsStore()`. [VERIFIED: useIssueMutations.ts L60–61]
- **Sending ADF for description:** DC REST only accepts wiki markup strings. [VERIFIED: createIssue() L1594]
- **Re-using BulkProgressIndicator without adapting text:** Current component says "Updating N issues..." — text must be customized to "Creating N subtasks..." for the bulk create context. The component is stateless about text (see `statusText` derivation at L45–57) — either pass a prop or fork the text locally.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent file-backed store | Custom file I/O | `createTauriStorage('subtask-templates.json')` + zustand persist | Already battle-tested in the project; handles LazyStore lifecycle |
| Createmeta field discovery | Custom field fetch | `fetchCreatemeta()` (Jira version adaptive 8.4+/legacy) | Handles both Jira DC endpoint strategies; already in jira.ts |
| Custom field autocomplete | Roll your own search | `CustomFieldsSection.tsx` pattern | Handles user/autocomplete/allowedValues cases with established UX |
| Jira field value wrapping | Custom serialization | `wrapCustomFieldValue()` | Handles user/id-keyed/string cases; DC format nuances |
| Row/template drag reorder | Custom DnD | `@dnd-kit/core` + `@dnd-kit/sortable` | Project standard since P78; Pointer Events API (no Tauri drag-drop conflict) |
| Progress tracking | Custom progress UI | `BulkProgressIndicator.tsx` (adapt) | Auto-dismiss, View Details expand, failure list already implemented |
| Board ID resolution | Direct store read | `useBoardId()` hook | Handles stored preference + discovery fallback; used by FieldsSection already |

**Key insight:** The creation pipeline (field discovery → normalization → submission → progress → invalidation) already exists for the single-issue case in `CreateEditIssueModal`. Phase 80 is effectively a batch orchestration layer over these proven primitives.

---

## Common Pitfalls

### Pitfall 1: `components` field not in JiraIssueDetail
**What goes wrong:** `@inherit → components` resolved to empty at preview/create time even when the parent has components set.
**Why it happens:** `JiraIssueDetail.fields` does not currently include `components` in its type definition — it's not in the `fetchIssueDetail` fields list at jira.ts L1360–1382. The field is accessible via `issue.fields.components` via the `[key: string]: unknown` index signature at L1245, but it's not typed.
**How to avoid:** Two options — (a) add `components` to the `fetchIssueDetail` fields list and type it in `JiraIssueDetail`, or (b) at resolve time, read `(issue.fields as Record<string, unknown>).components` and cast. Option (a) is cleaner and doesn't break existing callers (additive field).
**Warning signs:** `@inherit` chip shows `→ (none)` for components even on issues with components set.
[VERIFIED: jira.ts L1360–1382, JiraIssueDetail type L1206–1246]

### Pitfall 2: `BulkProgressIndicator` status text mismatch
**What goes wrong:** Progress bar shows "Updating N issues..." instead of "Creating N subtasks..."
**Why it happens:** `BulkProgressIndicator.tsx` hardcodes "Updating" in its status text (L46–57). The component has no text customization props.
**How to avoid:** Either (a) add optional `actionVerb` / `noun` props to `BulkProgressIndicator` (the cleaner approach that benefits future bulk operations too), or (b) replicate the progress display inline in the bulk modal with the correct copy. The UI-SPEC copy contract specifies exact strings like "Creating {N} subtasks..." — verify the component renders those.
[VERIFIED: BulkProgressIndicator.tsx L46–57]

### Pitfall 3: Store `version`/`migrate` omission
**What goes wrong:** Stale persisted data causes runtime errors when the store schema evolves.
**Why it happens:** `tempo-filters.store.ts` includes `version: 1` and a `migrate` passthrough — omitting this from the new store means schema changes during development will silently produce corrupted state.
**How to avoid:** Include `version: 1` and `migrate: (persisted, _version) => persisted as SubtaskTemplatesState` from day one. If the schema changes between releases, increment version and handle migration.
[VERIFIED: tempo-filters.store.ts L48–51]

### Pitfall 4: Subtask type ID stale at create time
**What goes wrong:** Template stores `subtaskIssueTypeId` at save time, but the Jira admin changes the issue type configuration — the stored ID no longer exists in the project's createmeta at apply time.
**Why it happens:** Template is global and long-lived; Jira issue type IDs are stable (numeric), but the type may be removed from a project.
**How to avoid:** At apply time, verify the stored `subtaskIssueTypeId` exists in the current project's `issueTypes` (from `['createmeta-issuetypes', projectKey]`). If not found, fall back to the first available subtask type and show an advisory note. Do not hard-fail.
**Warning signs:** `selectedIssueTypeId` resolves to `''` for a template, causing the createmeta query to not fire.

### Pitfall 5: dnd-kit reflowing ghost causes crash (lesson from P78)
**What goes wrong:** Reflowing the ghost item during drag causes a crash.
**Why it happens:** From the P78 dnd-kit lessons in project memory (`project_dndkit_drag_patterns.md`): "reflowing ghost = crash".
**How to avoid:** Use a fixed-height drag overlay, not a live-rendered row clone. Follow the same overlay pattern established in P78/P79.
[ASSUMED — from project memory; verify exact implementation when reading P79 code]

### Pitfall 6: `createAll()` mutation state closure over stale rows
**What goes wrong:** Rows edited inline after the creation loop starts may not be reflected in the payload.
**Why it happens:** If `createAll` closes over the `rows` array at click time, concurrent inline edits during creation would be ignored — but this is actually desired behavior (snapshot at click).
**How to avoid:** Explicitly snapshot the resolved rows array at the moment "Create Subtasks" is clicked. Do NOT allow row edits once creation is in progress (disable row fields during creation — UI-SPEC already specifies this via the per-row status icons replacing the remove button).

### Pitfall 7: `@unassigned` vs omit-assignee for DC
**What goes wrong:** Sending `assignee: null` may not clear the assignee on DC in all versions; omitting the field entirely is safer.
**Why it happens:** Jira DC vs Cloud have different null-field behavior. The project's `useIssueMutations.ts` omits `assignee` when `selectedAssigneeName` is falsy (L58: `if (state.selectedAssigneeName)`) — consistent with this approach.
**How to avoid:** For `@unassigned`, omit the `assignee` key from the `options` object entirely.
[VERIFIED: useIssueMutations.ts L58]

---

## Code Examples

### Subtask type discovery (confirmed pattern)

```typescript
// Source: useCreateEditQueries.ts L58–81
// Get all issue types for project, filter to subtask types:
const subtaskTypes = issueTypes?.filter(t => t.subtask === true) ?? [];
// Default selection: first subtask type (D-05 for ad-hoc)
const defaultSubtaskTypeId = subtaskTypes[0]?.id ?? '';
```

### `wrapCustomFieldValue` usage

```typescript
// Source: jira.ts L1683–1691
// For user fields: { name: value }
// For autoCompleteUrl non-string fields: { id: value }
// For everything else: raw string
import { wrapCustomFieldValue } from '@/services/jira';
const wrapped = wrapCustomFieldValue(fieldMeta, rawStringValue);
options[fieldMeta.fieldId] = wrapped;
```

### Invalidation sequence (confirmed)

```typescript
// Source: analysis of useFieldMutation.ts + IssueDetailView.tsx L153
import { invalidateGhAllData } from '@/services/jira/greenhopper/useGhAllData';

// Called after sequential creation loop when ≥1 row succeeded:
invalidateGhAllData(queryClient, boardId ?? undefined);
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', parentKey, jiraBaseUrl] });
queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment', parentKey] });
```

### Auth store current user for @current resolution

```typescript
// Source: auth.store.ts L24–26, L44–47
const { jiraUsername, jiraUserDisplayName } = useAuthStore();
// Preview hint: `@current → ${jiraUserDisplayName}`
// createIssue payload: assignee: { name: jiraUsername }
```

---

## Runtime State Inventory

This is a greenfield feature — no rename/refactor. No runtime state inventory needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Promise.all` for batch creates | Sequential `for` loop | Roadmap P80 mandate | Per-row status tracking becomes trivial |
| Global invalidation `['jira-subtask-enrichment']` | Prefix invalidation `['jira-subtask-enrichment', parentKey]` | WR-04 (P75-era) | Invalidate only the relevant parent's enrichment, not all |
| Board ID hardcoded | `useBoardId()` hook with stored preference fallback | P73+ | Multi-board support; must use hook not direct store read |

**No deprecated APIs used in this phase.** All patterns are current.

---

## Validation Architecture

> `nyquist_validation: true` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm run test -- --reporter=verbose <testfile>` |
| Full suite command | `cd taskflow && npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUBTPL-02 | Template store persists add/remove/rename/move actions | unit | `npm run test -- src/stores/subtask-templates.store.test.ts` | ❌ Wave 0 |
| SUBTPL-03 | Field resolution: "N fields skipped" count is correct for a given template + createmeta combo | unit | `npm run test -- src/routes/dashboard/resolveTemplateFields.test.ts` | ❌ Wave 0 |
| SUBTPL-07 | Retry loop skips rows with `status === 'created'`; no duplicate createIssue calls | unit | `npm run test -- src/routes/dashboard/BulkCreateSubtasksModal.test.ts` | ❌ Wave 0 |
| SUBTPL-08 | `@inherit` resolves to parent fields at create time; `@current` resolves to jiraUsername; `@unassigned` omits assignee | unit | `npm run test -- src/routes/dashboard/resolveRowPlaceholders.test.ts` | ❌ Wave 0 |
| SUBTPL-06 | createIssue() called in listed order (index 0 before index 1 before index 2) | unit | included in BulkCreateSubtasksModal.test.ts | ❌ Wave 0 |
| SUBTPL-05 | "N fields skipped" badge count matches actual dropped fields | unit | included in resolveTemplateFields.test.ts | ❌ Wave 0 |

**Riskiest behaviors to validate (Nyquist priorities):**

1. **Retry-no-duplicate guarantee (SUBTPL-07):** The `status === 'created'` skip guard is the only mechanism preventing duplicate creation on retry. A missing or misplaced check would silently create duplicates. Test: mock `createIssue`, start a run, simulate partial failure on row 2, verify rows 0 and 1 (created/failed) are never re-called on retry.

2. **Placeholder resolution correctness (SUBTPL-08):** `@inherit` on a field the parent lacks must produce empty (D-12), not an error or stale value. `@current` must use `jiraUsername` (the DC `name` field), not `jiraUserDisplayName`. Test: unit-test the resolver function in isolation with mock parent issue data and mock auth store values.

3. **Createmeta drop logic (SUBTPL-03 / D-02):** The "N fields skipped" count must correctly count custom field IDs in the template row that are absent from the current project's createmeta. Core fields (assignee, priority, labels, duedate, timetracking, storyPoints) must NOT be counted as skipped regardless of createmeta. Test: unit-test with a template containing known custom field IDs, a createmeta that includes some but not others, and verify exact count.

4. **Sequential ordering (SUBTPL-06):** createIssue calls must fire in array order (0, 1, 2…). While a `for` loop naturally guarantees this, the test verifies no accidental parallelization was introduced. Test: mock createIssue with a delay, verify call order.

### Sampling Rate
- **Per task commit:** `npm run test -- <relevant-test-file>`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/stores/subtask-templates.store.test.ts` — covers SUBTPL-02
- [ ] `taskflow/src/routes/dashboard/resolveTemplateFields.test.ts` — covers SUBTPL-03, SUBTPL-05 (field drop computation; pure function, easy to unit test)
- [ ] `taskflow/src/routes/dashboard/resolveRowPlaceholders.test.ts` — covers SUBTPL-08 (placeholder resolver; pure function extractable from modal)
- [ ] `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.test.ts` — covers SUBTPL-06, SUBTPL-07 (retry loop, ordering)

---

## Security Domain

This phase does not introduce authentication, session management, or cryptographic operations. Applicable ASVS categories:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Title field required (enforced in store + UI); custom field values are strings passed through `wrapCustomFieldValue()` before submission — no SQL/XSS risk (server-side Jira validates) |
| V6 Cryptography | no | — |

**V5 note:** Template row titles are user-freeform strings passed as `summary` to `createIssue()`. Jira DC server-side validates and sanitizes. No additional client-side validation beyond "title must not be empty" is required.

---

## Open Questions

1. **`components` field in `@inherit`**
   - What we know: `JiraIssueDetail.fields.components` is not typed (accessible only via `[key: string]: unknown`); `fetchIssueDetail` does not currently request `components` in its fields list.
   - What's unclear: Whether the field is returned by default (it typically is in Jira DC full issue response) or needs to be explicitly added to the fields= parameter.
   - Recommendation: In Wave 0, add `'components'` to the `fetchIssueDetail` fields list and add `components?: Array<{ id: string; name: string }>` to `JiraIssueDetail.fields`. Verify via a quick check against the Jira DC API response shape.

2. **`storyPointsFieldKey` for subtasks**
   - What we know: `useIssueMutations.ts` L60–61 explicitly guards `if (!isSubtask && ...)` — story points are NOT sent on subtask creation in the existing single-subtask flow.
   - What's unclear: Whether this is a DC restriction (subtasks don't support story points) or a UX choice. D-07 lists story points as an inline core field for the bulk modal.
   - Recommendation: The roadmap explicitly includes story points as a creatable field (SUBTPL-03). The guard in `useIssueMutations` is UX-level, not an API constraint. Include `storyPoints` in the bulk create payload for subtasks and let createmeta determine if it's supported for the target project. If the project's subtask createmeta does not include the story points field, D-02's drop logic handles it silently.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend code/store changes. No new external dependencies, services, or CLI tools are required beyond the existing Tauri dev environment.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | dnd-kit ghost-reflow crash prevention pattern from P78/P79 — use fixed-height overlay | Pitfall 5 | Drag interaction crashes during template/row reorder; use overlay pattern regardless |
| A2 | `components` field is returned by Jira DC fetchIssueDetail even without explicit fields= param | Pitfall 1 | `@inherit → components` always resolves empty; needs explicit field addition |

**All other claims in this research are VERIFIED from codebase source reads.**

---

## Sources

### Primary (HIGH confidence — codebase verified)
- `taskflow/src/stores/tempo-filters.store.ts` — exact store pattern mirrored
- `taskflow/src/lib/tauri-storage.ts` — `createTauriStorage()` implementation
- `taskflow/src/services/jira.ts` L1561–1735 — `CreatemetaField`, `createIssue()`, `fetchCreatemeta()`, `wrapCustomFieldValue()`
- `taskflow/src/services/jira/fields.ts` — field typing and normalization
- `taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts` — createmeta query chain, `CORE_FIELD_IDS`, subtask type selection
- `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` — subtask creation payload, invalidation pattern
- `taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx` — custom field rendering (allowedValues, autocomplete, plain input)
- `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx` — progress component props, status text, auto-dismiss behavior
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — subtask section, parentKey sourcing, "Add subtask" button location
- `taskflow/src/routes/dashboard/IssueDetailView.tsx` L149–168 — subtaskSignature computation, enrichment query key shape
- `taskflow/src/services/jira/greenhopper/useGhAllData.ts` — `['gh-all-data', boardId]` key, `invalidateGhAllData()`
- `taskflow/src/hooks/useBoardId.ts` — boardId sourcing pattern
- `taskflow/src/stores/auth.store.ts` — `jiraUsername`, `jiraUserDisplayName` for `@current` resolution
- `taskflow/src/routes/settings/Settings.tsx` — SECTIONS array, section render pattern
- `taskflow/src/routes/settings/WorkflowSection.tsx` — section component shell pattern
- `taskflow/package.json` — `@dnd-kit/*` versions confirmed installed

### Secondary (MEDIUM confidence)
- Project memory `project_dndkit_drag_patterns.md` — P78 dnd-kit pitfalls (ghost reflow crash, no-onDragOver-reorder)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; no new installs
- Architecture: HIGH — all integration points read from actual source files
- Pitfalls: HIGH (pitfalls 1–4, 6–7) / MEDIUM (pitfall 5 — from project memory, not source read)
- Createmeta field resolution: HIGH — exact types and query chain confirmed
- Cache invalidation: HIGH — all three query keys confirmed with exact shapes

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable codebase; only invalidated by changes to jira.ts createIssue signature or store infrastructure)
