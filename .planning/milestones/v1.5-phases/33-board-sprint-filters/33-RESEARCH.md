# Phase 33: Board, Sprint & Filters - Research

**Researched:** 2026-03-23
**Domain:** Jira Agile REST API (board config, filters), React sprint board UI, bulk operations
**Confidence:** HIGH

## Summary

Phase 33 adds four feature areas to the existing sprint board: (1) sprint goal banner, (2) Jira board quick filters + label filter chips, (3) multi-select bulk operations with parallel API calls, and (4) Jira saved filter management with sidebar and command palette integration.

The codebase already has strong foundations: `fetchActiveSprint` returns the `goal` field, `UnifiedFilterBar` handles local quick filters with a save flow, `DraggableCard`/`TaskCard` provide the card layer to extend with checkboxes, and `CommandPalette` uses cmdk with a clear pattern for adding new action groups. The main new API surface is the Jira Agile `/rest/agile/1.0/board/{boardId}/quickfilter` endpoint for board quick filters and the `/rest/api/2/filter` CRUD endpoints for saved filters.

**Primary recommendation:** Build in four waves: (1) sprint goal banner + quick filter chip row (read-only Jira data), (2) bulk selection and operations on sprint board cards, (3) saved filter CRUD with Jira sync, (4) sidebar + command palette integration for saved filters.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Display sprint goal as a colored accent banner strip below the sprint name header, above the filter area -- always visible when a goal exists
- **D-02:** When no sprint goal is set in Jira (`goal` field is null/empty), hide the banner entirely -- no placeholder text, board looks exactly like today
- **D-03:** Always show the full goal text regardless of length -- banner grows to fit. No truncation or collapsing.
- **D-04:** `JiraActiveSprint.goal` field is already fetched by `fetchActiveSprint` -- just needs rendering
- **D-05:** Jira board quick filters appear as toggle chips in a dedicated row above the existing `UnifiedFilterBar` -- visually distinct from local filter dropdowns
- **D-06:** Quick filters fetched from Jira Agile REST API (`/rest/agile/1.0/board/{boardId}/configuration`) board config
- **D-07:** Label-based filter chips (BOARD-03) appear in the same chip row alongside Jira quick filters -- one unified chip row for toggle-style filters
- **D-08:** Quick filters use AND logic with the existing filter bar -- activating a Jira QF narrows results further on top of any epic/label/assignee/status selections. Both filter layers coexist.
- **D-09:** Multi-select via checkboxes on sprint board cards -- checkbox appears on hover (or always visible in selection mode). Shift+click for range selection.
- **D-10:** Floating bottom bar appears when >=1 issue is selected -- shows selected count + action dropdowns for Status, Assignee, and Priority + close/deselect button
- **D-11:** Bulk operations execute in parallel against Jira API. Progress shown via toast notification: "Updating N issues..." with progress bar. Completion toast: "X succeeded, Y failed" with option to view failures.
- **D-12:** Cards update optimistically during bulk operations -- rollback on individual failures
- **D-13:** Jira saved filters and local quickfilter presets coexist as separate systems -- local quickfilters stay as-is (fast, offline), Jira saved filters are a separate feature synced to server
- **D-14:** "Saved Filters" section in the sidebar lists the user's favourite Jira filters. Click a filter to apply it as a constraint on the current sprint board view.
- **D-15:** "Save as filter" button appears in the `UnifiedFilterBar` when any filter is active. Opens a dialog with name + optional description. Saves to Jira via REST API (`/rest/api/2/filter`). Appears in sidebar immediately.
- **D-16:** Saved filters are also accessible via command palette (Cmd+K) for quick access (FILT-04)
- **D-17:** Users can edit (rename, update JQL) and delete saved filters they own (FILT-03)

### Claude's Discretion
- Quick filter chip styling and active state indicators
- Exact Jira Agile API endpoints for board configuration / quick filter discovery
- Bulk operation concurrency limit (parallel API calls)
- Toast component reuse vs new implementation
- How to translate local filter bar state (epics/labels/assignees/statuses) into JQL for Jira saved filter creation
- Checkbox visibility behavior (always visible vs hover-only)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOARD-01 | User sees sprint goal banner on sprint board header | `JiraActiveSprint.goal` already available; render SprintGoalBanner component per UI-SPEC |
| BOARD-02 | User can toggle board quick filters fetched from Jira board config | New `fetchBoardQuickFilters` service using `/rest/agile/1.0/board/{boardId}/quickfilter` |
| BOARD-03 | User can filter sprint board by label via quick filter chips | Labels already extracted in `filterOptions.labels`; render as chips in QuickFilterChipRow |
| BOARD-04 | User can select multiple issues and bulk-change status | Multi-select state + `postTransition` for each issue in parallel |
| BOARD-05 | User can select multiple issues and bulk-change assignee | Multi-select state + `updateIssueField` with `assignee: { name }` field |
| BOARD-06 | User can select multiple issues and bulk-change priority | Multi-select state + `updateIssueField` with `priority: { name }` field |
| BOARD-07 | User sees progress indicator during bulk operations with success/failure counts | BulkProgressIndicator component with `aria-progressbar` and live status |
| FILT-01 | User can save current search as a named filter (synced to Jira server) | New `createJiraFilter` service using `POST /rest/api/2/filter` with JQL translation |
| FILT-02 | User can view and execute saved/favourite filters from Jira | New `fetchFavouriteFilters` service using `GET /rest/api/2/filter/favourite` |
| FILT-03 | User can edit and delete saved filters | `PUT /rest/api/2/filter/{id}` and `DELETE /rest/api/2/filter/{id}` |
| FILT-04 | User can access saved filters from sidebar and command palette | SavedFilterList in Sidebar + CommandGroup in CommandPalette |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x | UI framework | Already in use |
| zustand | 5.x | State management | filter.store.ts, settings.store.ts patterns |
| @tanstack/react-query | 5.x | Server state / caching | All Jira data fetching uses this |
| @dnd-kit/core | 6.x | Drag-and-drop | Already used in SprintBoardTab |
| cmdk | 1.x | Command palette | Already used via shadcn Command component |
| lucide-react | latest | Icons | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @base-ui/react | latest | Popover, Dialog primitives | All shadcn components use this as base |
| react-hotkeys-hook | 4.x | Keyboard shortcuts | Already used for Cmd+K, Escape |
| @tauri-apps/plugin-http | latest | HTTP fetch (bypasses CORS) | All API calls via apiFetch wrapper |

No new npm packages needed. All required shadcn components (Alert, Badge, Button, Dialog, Input, Label, Popover, Select, Textarea, Skeleton) are already installed.

## Architecture Patterns

### New Service Modules

```
taskflow/src/services/jira/
  board-config.ts      # fetchBoardQuickFilters(baseUrl, token, boardId)
  filters.ts           # CRUD: createFilter, fetchFavourites, updateFilter, deleteFilter
```

Follow Phase 32 pattern: new modules in `jira/` subdirectory, imported directly (NOT re-exported from `jira.ts` barrel -- the barrel is monolithic, new modules use direct imports per Phase 32 decision).

### New Components

```
taskflow/src/routes/dashboard/
  SprintGoalBanner.tsx       # Sprint goal display (BOARD-01)
  QuickFilterChipRow.tsx     # Jira QF + label toggle chips (BOARD-02, BOARD-03)
  BulkActionBar.tsx          # Floating bottom toolbar (BOARD-04-06)
  BulkProgressIndicator.tsx  # Progress display during bulk ops (BOARD-07)

taskflow/src/components/
  SaveFilterDialog.tsx       # Save current filter to Jira (FILT-01)
  SavedFilterList.tsx        # Sidebar filter list (FILT-02, FILT-04)
  EditFilterDialog.tsx       # Edit saved filter (FILT-03)
```

### State Architecture

**Filter store extension** (`filter.store.ts`): Add new state slices:
- `activeJiraQuickFilters: Set<number>` -- toggled Jira QF IDs
- `activeLabelFilters: Set<string>` -- toggled label chips
- `toggleJiraQuickFilter(id: number)` / `toggleLabelFilter(label: string)`

**New saved filter store** (`saved-filter.store.ts`): Separate Zustand store for Jira saved filters (per STATE.md blocker: "Settings store at v8 with 60+ fields -- new features should use dedicated stores"):
- `savedFilters: JiraSavedFilter[]`
- `activeFilterId: number | null`
- `setSavedFilters`, `applyFilter`, `clearActiveFilter`

**Selection store** (`board-selection.store.ts`): Separate store for multi-select state:
- `selectedKeys: Set<string>`
- `lastClickedKey: string | null`
- `toggleSelection(key: string)`, `rangeSelect(fromKey, toKey, allKeys)`, `clearSelection()`

### Pattern 1: Jira Quick Filter Client-Side Evaluation

**What:** Quick filters have a `jql` field (e.g., `"issueType = bug"`). Evaluate these JQL snippets client-side against already-fetched issue data rather than making new API calls per filter toggle.

**When to use:** When the QF JQL uses simple field comparisons (type, priority, label, assignee).

**How:** Parse the QF JQL into field/operator/value triples. For each issue in the sprint, check if it matches all active QF conditions. This avoids network round-trips on every toggle.

**Fallback:** If a QF JQL uses functions or complex JQL (e.g., `updatedDate > startOfDay()`), mark it as "server-side only" and add the JQL as a constraint when re-fetching sprint issues.

```typescript
// Simplified JQL evaluator for common QF patterns
interface JqlCondition {
  field: string;    // e.g., "issuetype", "priority", "labels"
  operator: string; // "=", "!=", "in"
  value: string | string[];
}

function evaluateCondition(issue: JiraIssue, condition: JqlCondition): boolean {
  const fieldVal = resolveField(issue, condition.field);
  switch (condition.operator) {
    case '=': return fieldVal === condition.value;
    case '!=': return fieldVal !== condition.value;
    case 'in': return (condition.value as string[]).includes(fieldVal);
    default: return true; // unknown operator = pass through
  }
}
```

### Pattern 2: Optimistic Bulk Operations with Per-Issue Rollback

**What:** Fire parallel PUT requests for bulk field changes, update cards optimistically, roll back individual failures.

**When to use:** BOARD-04 through BOARD-07.

**How:** Existing pattern from drag-and-drop (`handleDragEnd` in SprintBoardTab). Extend to N issues:

```typescript
async function executeBulkOperation(
  issueKeys: string[],
  field: string,
  value: unknown,
): Promise<{ succeeded: string[]; failed: { key: string; error: string }[] }> {
  const CONCURRENCY_LIMIT = 5; // Avoid overwhelming Jira DC
  const results = { succeeded: [] as string[], failed: [] as { key: string; error: string }[] };

  // Process in batches of CONCURRENCY_LIMIT
  for (let i = 0; i < issueKeys.length; i += CONCURRENCY_LIMIT) {
    const batch = issueKeys.slice(i, i + CONCURRENCY_LIMIT);
    const settled = await Promise.allSettled(
      batch.map(key => updateIssueField(baseUrl, token, key, field, value))
    );
    settled.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.succeeded.push(batch[idx]);
      } else {
        results.failed.push({ key: batch[idx], error: result.reason?.message ?? 'Unknown error' });
      }
    });
    onProgress?.(results.succeeded.length + results.failed.length, issueKeys.length);
  }
  return results;
}
```

**Concurrency recommendation:** 5 parallel calls. Jira DC has no documented rate limit but shared infrastructure can choke on too many simultaneous calls. 5 is conservative enough for reliability while still fast for typical bulk ops (10-20 issues).

### Pattern 3: JQL Translation for Saved Filters

**What:** Translate local filter bar state (epic keys, labels, assignees, statuses) into Jira JQL for saving as a server filter.

**When to use:** FILT-01 (save filter to Jira).

```typescript
function buildJqlFromFilters(
  projectKey: string,
  epics: string[],
  labels: string[],
  assignees: string[],
  statuses: string[],
  epicLinkFieldKey: string,
): string {
  const clauses: string[] = [`project = ${projectKey}`];
  if (epics.length > 0) clauses.push(`"${epicLinkFieldKey}" in (${epics.join(',')})`);
  if (labels.length > 0) clauses.push(`labels in (${labels.map(l => `"${l}"`).join(',')})`);
  if (assignees.length > 0) clauses.push(`assignee in (${assignees.map(a => `"${a}"`).join(',')})`);
  if (statuses.length > 0) clauses.push(`status in (${statuses.map(s => `"${s}"`).join(',')})`);
  return clauses.join(' AND ');
}
```

### Anti-Patterns to Avoid
- **Don't add quick filter state to settings store:** Settings store already has 60+ fields (STATE.md blocker). Use filter.store.ts for session state or a new dedicated store.
- **Don't re-export new jira/ modules from jira.ts barrel:** Phase 32 decision -- import from `@/services/jira/board-config` directly.
- **Don't build a full JQL parser:** Only need to parse simple quick filter conditions for client-side eval. Complex JQL falls back to server-side filtering.
- **Don't use toast/sonner library:** Project has NO toast library installed. Bulk progress uses inline BulkProgressIndicator component replacing the floating bar contents (per UI-SPEC). Status updates use `aria-live="polite"` regions, not external toast system.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command palette search | Custom fuzzy search | cmdk (already installed) | Built-in fuzzy matching, keyboard nav, grouping |
| Dialog/modal management | Custom modal | shadcn Dialog (base-ui) | Focus trap, escape handling, aria |
| Dropdown selections | Custom dropdowns | shadcn Select component | Keyboard nav, scroll, option rendering |
| Drag and drop | Custom DnD | @dnd-kit/core (already installed) | Complex touch/pointer handling |

## Common Pitfalls

### Pitfall 1: Board ID Discovery Race Condition
**What goes wrong:** SprintBoardTab fetches sprint issues directly via JQL, never storing the board ID. Quick filters need the board ID.
**Why it happens:** `fetchActiveSprint` discovers the board ID internally but doesn't expose it. The sprint issues query uses JQL, not the board API.
**How to avoid:** Use the `originBoardId` field from `JiraActiveSprint` (already in the type definition). If null, call `fetchActiveSprint` to discover it. Cache the board ID in the query result.
**Warning signs:** Quick filter fetch fails silently because board ID is undefined.

### Pitfall 2: DnD + Checkbox Click Conflict
**What goes wrong:** Clicking a checkbox on a card initiates a drag operation instead of toggling selection.
**Why it happens:** `@dnd-kit/core` `useDraggable` captures pointer events on the entire card wrapper. The 5px distance threshold helps but checkboxes need explicit event handling.
**How to avoid:** Add `onPointerDown={(e) => e.stopPropagation()}` on the checkbox element to prevent drag activation. When any card is selected, disable `useDraggable` on selected cards (D-09 + UI-SPEC interaction contract point 5).
**Warning signs:** Cannot select cards without accidentally starting a drag.

### Pitfall 3: Bulk Status Change Requires Transitions, Not Field Update
**What goes wrong:** Using `updateIssueField` with `status: { name: 'Done' }` returns a 400 error.
**Why it happens:** Jira status changes require transitions (`POST /rest/api/2/issue/{key}/transitions`), not field updates. The existing `postTransition` function handles this correctly.
**How to avoid:** For bulk status changes, use `fetchTransitions` + `postTransition` per issue (same as drag-and-drop). For assignee and priority, use `updateIssueField`.
**Warning signs:** "Status update failed" errors on every bulk status operation.

### Pitfall 4: Saved Filter JQL Must Include Project Clause
**What goes wrong:** Saving a filter without `project = KEY` makes it return issues from ALL projects.
**Why it happens:** Local filter state (labels, assignees) doesn't implicitly scope to the current project.
**How to avoid:** Always prepend `project = {activeJiraProject}` to the generated JQL when saving.
**Warning signs:** Filter returns thousands of unexpected issues from other projects.

### Pitfall 5: Quick Filter JQL Contains Functions Not Evaluable Client-Side
**What goes wrong:** A quick filter with JQL like `updatedDate > startOfDay()` cannot be evaluated client-side.
**Why it happens:** Jira QF JQL can contain server-side functions, relative dates, etc.
**How to avoid:** Attempt client-side parse; if JQL contains function calls (parentheses in value position), fall back to adding the JQL as an additional `AND` clause on the sprint issue search query and re-fetching.
**Warning signs:** Some quick filters never filter correctly.

### Pitfall 6: Shift+Click Range Selection Across Virtualized Rows
**What goes wrong:** Shift+click range selection misses cards that are not currently rendered by the virtualizer.
**Why it happens:** `@tanstack/react-virtual` only renders visible rows. DOM-order range calculation fails for off-screen cards.
**How to avoid:** Calculate range from the data model (flat list of issue keys), not from DOM nodes. Maintain a stable `allVisibleKeys` array derived from `filteredSwimlanes` and use index-based range.
**Warning signs:** Shift+click selects wrong range or too few issues.

## Code Examples

### Jira Board Quick Filters API

```typescript
// Source: Jira Agile REST API docs
// GET /rest/agile/1.0/board/{boardId}/quickfilter
// Response:
interface JiraBoardQuickFilter {
  id: number;
  boardId: number;
  name: string;
  jql: string;
  description?: string;
  position: number;
}

interface QuickFilterResponse {
  maxResults: number;
  startAt: number;
  total: number;
  isLast: boolean;
  values: JiraBoardQuickFilter[];
}

export async function fetchBoardQuickFilters(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraBoardQuickFilter[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/agile/1.0/board/${boardId}/quickfilter`;
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }, 'Load Quick Filters');
  if (!response.ok) return [];
  const data = await response.json();
  return data?.values ?? [];
}
```

### Jira Filter CRUD API

```typescript
// Source: Jira REST API v2 docs
// POST /rest/api/2/filter -- Create filter
// GET /rest/api/2/filter/favourite -- List favourites
// PUT /rest/api/2/filter/{id} -- Update filter
// DELETE /rest/api/2/filter/{id} -- Delete filter

interface JiraSavedFilter {
  id: string;         // Jira returns as string
  name: string;
  jql: string;
  description?: string;
  owner: { displayName: string; name: string };
  favourite: boolean;
}

export async function createJiraFilter(
  baseUrl: string,
  token: string,
  name: string,
  jql: string,
  description?: string,
): Promise<JiraSavedFilter> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter`;
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, jql, description: description ?? '', favourite: true }),
  }, 'Save Filter');
  if (!response.ok) {
    throw new Error(`Failed to create filter: ${response.status}`);
  }
  return response.json();
}

export async function fetchFavouriteFilters(
  baseUrl: string,
  token: string,
): Promise<JiraSavedFilter[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/filter/favourite`;
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }, 'Load Saved Filters');
  if (!response.ok) return [];
  return response.json();
}
```

### SprintGoalBanner Component

```typescript
// Follows UI-SPEC: bg-muted, border-l-4 border-primary, px-4 py-3
interface SprintGoalBannerProps {
  goal: string | undefined | null;
}

export function SprintGoalBanner({ goal }: SprintGoalBannerProps) {
  if (!goal?.trim()) return null; // D-02: hide when no goal
  return (
    <div
      role="banner"
      aria-label="Sprint goal"
      className="bg-muted border-l-4 border-primary rounded-md px-4 py-3 mx-3 my-2"
    >
      <p className="text-sm text-foreground">{goal}</p>
    </div>
  );
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `taskflow/vite.config.ts` (Vitest config inline) |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOARD-01 | Sprint goal banner renders when goal exists, hidden when null | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintGoalBanner.test.tsx -x` | Wave 0 |
| BOARD-02 | Quick filters fetched and toggle correctly | unit | `cd taskflow && npx vitest run src/services/jira/board-config.test.ts -x` | Wave 0 |
| BOARD-03 | Label filter chips toggle and AND with existing filters | unit | `cd taskflow && npx vitest run src/routes/dashboard/QuickFilterChipRow.test.tsx -x` | Wave 0 |
| BOARD-04 | Bulk status change uses transitions API | unit | `cd taskflow && npx vitest run src/routes/dashboard/BulkActionBar.test.tsx -x` | Wave 0 |
| BOARD-05 | Bulk assignee change calls updateIssueField | unit | covered by BulkActionBar.test.tsx | Wave 0 |
| BOARD-06 | Bulk priority change calls updateIssueField | unit | covered by BulkActionBar.test.tsx | Wave 0 |
| BOARD-07 | Progress indicator shows correct counts | unit | covered by BulkActionBar.test.tsx | Wave 0 |
| FILT-01 | Save filter creates via POST /rest/api/2/filter | unit | `cd taskflow && npx vitest run src/services/jira/filters.test.ts -x` | Wave 0 |
| FILT-02 | Favourite filters fetched and displayed | unit | `cd taskflow && npx vitest run src/components/SavedFilterList.test.tsx -x` | Wave 0 |
| FILT-03 | Edit and delete filters via PUT/DELETE | unit | covered by filters.test.ts | Wave 0 |
| FILT-04 | Saved filters appear in command palette | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | Existing (extend) |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/routes/dashboard/SprintGoalBanner.test.tsx` -- covers BOARD-01
- [ ] `src/services/jira/board-config.test.ts` -- covers BOARD-02
- [ ] `src/routes/dashboard/QuickFilterChipRow.test.tsx` -- covers BOARD-03
- [ ] `src/routes/dashboard/BulkActionBar.test.tsx` -- covers BOARD-04 through BOARD-07
- [ ] `src/services/jira/filters.test.ts` -- covers FILT-01, FILT-03
- [ ] `src/components/SavedFilterList.test.tsx` -- covers FILT-02

## Open Questions

1. **Quick filter JQL complexity**
   - What we know: QF JQL can be simple (`issuetype = Bug`) or complex (`updatedDate > startOfDay()`)
   - What's unclear: What percentage of real-world QFs use server-side functions?
   - Recommendation: Start with client-side eval for simple patterns, fall back to re-fetch for anything unparseable. Log unparseable JQL to help iterate.

2. **Board ID availability**
   - What we know: `JiraActiveSprint` has `originBoardId?: number` which may or may not be populated
   - What's unclear: Whether `originBoardId` is reliably set on all Jira DC versions
   - Recommendation: Use `originBoardId` when available, fall back to board discovery (`GET /rest/agile/1.0/board?projectKeyOrId={key}&type=scrum`) if null. The discovery call is already implemented in `fetchActiveSprint`.

3. **Saved filter permission model**
   - What we know: Jira saved filters use the creating user's default sharing permissions
   - What's unclear: Whether non-owner filters appear in favourites and whether edit/delete throws 403
   - Recommendation: Wrap edit/delete in try/catch, show "permission denied" message if 403. Only show edit/delete in context menu for filters where `owner.name` matches current user.

## Sources

### Primary (HIGH confidence)
- Project codebase: `SprintBoardTab.tsx`, `UnifiedFilterBar.tsx`, `filter.store.ts`, `DraggableCard.tsx`, `CommandPalette.tsx`, `shortcuts.ts` -- all read in full
- Project codebase: `jira/issues.ts` (`updateIssueField`, `bulkUpdateIssue`), `jira/sprints.ts` (`fetchActiveSprint`), `jira/types.ts` -- all read
- UI-SPEC: `33-UI-SPEC.md` -- component inventory, interaction contracts, accessibility
- CONTEXT.md: `33-CONTEXT.md` -- all locked decisions D-01 through D-17

### Secondary (MEDIUM confidence)
- [Jira Agile REST API 7.3.1 docs](https://docs.atlassian.com/jira-software/REST/7.3.1/) -- board configuration endpoint
- [Jira Agile REST API quick filter endpoint](https://community.atlassian.com/forums/Jira-questions/rest-agile-1-0-board-boardID-quickfilter/qaq-p/1093457) -- `/rest/agile/1.0/board/{boardId}/quickfilter` response shape
- [Jira REST API filter endpoints](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-filters/) -- POST/GET/PUT/DELETE /rest/api/2/filter (Cloud docs, same API shape on DC)
- [Atlassian community: saving filters via REST](https://community.atlassian.com/forums/Jira-questions/How-to-Create-Filter-With-Project-Permission-Via-REST/qaq-p/930110) -- filter creation with permissions

### Tertiary (LOW confidence)
- Quick filter JQL complexity distribution -- no data; recommendation based on judgment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new deps
- Architecture: HIGH - follows established patterns (Phase 31/32 decisions, zustand stores, jira/ modules)
- Jira API endpoints: MEDIUM - quick filter endpoint verified via multiple sources but not tested against live DC instance
- Pitfalls: HIGH - derived from direct code reading and understanding of DnD + Jira transition model

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- no fast-moving dependencies)
