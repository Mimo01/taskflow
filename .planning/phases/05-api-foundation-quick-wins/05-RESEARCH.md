# Phase 5: API Foundation + Quick Wins - Research

**Researched:** 2026-03-12
**Domain:** Jira REST API extension, GitLab MR filtering, React/shadcn UI badge rendering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Releases sorting**
- Sort newest to oldest by `releaseDate`
- Undated releases (no `releaseDate`) appear at the bottom of the list, below all dated releases

**Releases status labels**
- "Overdue" badge only (not "X days overdue") — date is already visible in the row
- "In X days" for future unreleased releases (e.g. "In 5 days")
- "Due today" as a special badge for same-day releases (not "Overdue", not "In 0 days")

**Released/unreleased badge design**
- Color-coded shadcn chip badges:
  - Released → green chip
  - Unreleased (future) → amber chip
  - Overdue → red chip
  - Due today → blue chip
- Badge placement: after the release name, before the date
- Status badge (Released/Unreleased) and timing label ("In 5 days" / "Overdue" / "Due today") are separate elements — not merged into one badge

**Story points field discovery**
- `discoverStoryPointsField()` runs once at app startup (when credentials load) and caches result in settings store
- Discovery tries fields in order: `customfield_10016` → `story_points` → `customfield_10028`
- If discovery fails entirely: silent fallback to `customfield_10016` — no user-visible error
- No settings banner or manual override for this phase

**Subtask fetch strategy**
- `fetchSprintIssues` gains a two-query strategy: first query gets sprint parent issues, second query gets `issuetype in subtaskIssueTypes() AND parent in (KEY-1, KEY-2, ...)`
- If the second (subtask) query fails: return parent issues only, silently — no error state shown
- Sprint fetch does NOT request the `description` field for subtasks — description is fetched separately when a task is opened
- JQL chunking threshold for the parent key list: Claude's discretion based on Jira DC URL length limits

### Claude's Discretion
- JQL chunking batch size for the subtask second query
- Exact `discoverStoryPointsField()` API call (likely `GET /rest/api/2/field` + name matching)
- Whether GitLab MR search (`searchGitLabMRs`) needs `state=opened` added (Claude audits all MR calls)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| APIF-01 | Jira `JiraIssue` type extended with `parent?`, `subtasks[]`, `timetracking?`, `issuetype.subtask` boolean | `JiraIssue.fields` uses index-accessible fields; optional fields are non-breaking for all four existing callers |
| APIF-02 | `fetchSprintIssues` uses two-query strategy to include subtasks (second query: `issuetype in subtaskIssueTypes() AND parent in (...)`) | Jira DC `sprint in openSprints()` excludes subtasks; two-query pattern confirmed; chunking required for URL limits |
| APIF-03 | Story points field ID discovered via `discoverStoryPointsField()` with fallback to `customfield_10016` | `GET /rest/api/2/field` returns all fields with `id` and `name`; match by name "Story Points" / "Story points" / "story_points" |
| APIF-04 | GitLab MR fetch calls filter to `state=opened` only | `searchGitLabMRs` at line 422 confirmed missing `state=opened`; `fetchAssignedMRs` and `fetchReviewerMRs` already correct |
| REL-01 | User can see releases ordered newest to oldest by release date | Sort in `useMemo` before `versions.map()`; undated releases sort to bottom |
| REL-02 | User can see released/unreleased status badge on each release | `JiraFixVersion.released: boolean` is already present; shadcn Badge component not yet installed — needs `npx shadcn add badge` |
| REL-03 | User can see overdue badge on past-date unreleased releases and days-until countdown on future unreleased releases | Date diff logic uses `new Date()` vs `releaseDate`; three timing states: past=Overdue, today=Due today, future=In X days |
</phase_requirements>

---

## Summary

Phase 5 is a purely data-layer and display-layer phase with no architectural risk. All changes are additive: the `JiraIssue` type gains optional fields (non-breaking for all four callers), `fetchSprintIssues` gains a second JQL query that silently degrades, the settings store gains one new cached field key, a single GitLab function gets one query parameter added, and `ReleasesTab` gets sort + badge rendering injected into its existing `useMemo`.

The highest-effort work is the two-query subtask strategy. Jira DC's `sprint in openSprints()` JQL function intentionally excludes subtasks (confirmed in project STATE.md from prior research). The second query pattern `issuetype in subtaskIssueTypes() AND parent in (KEY-1, KEY-2, ...)` is the standard workaround for Jira DC. URL length is the key constraint: Jira DC versions around 6.x imposed ~6000 character JQL limits in browser; the REST API endpoint itself is constrained by HTTP server config (commonly 8000–16000 octets). With typical issue keys like `PROJ-123` (8 chars), a safe chunk size of 50 keys produces a ~500 character IN() clause — well within any real limit.

The Releases badge work is clean: `JiraFixVersion.released` and `releaseDate` are already in the type, the sort inserts into the existing `useMemo`, and the only missing dependency is the shadcn `Badge` component which must be installed before implementing.

**Primary recommendation:** Implement in five discrete tasks: (1) add Badge component, (2) extend type + `discoverStoryPointsField`, (3) two-query subtask fetch, (4) fix `searchGitLabMRs`, (5) Releases sort + badges.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 | Server state caching, query deduplication | All existing data fetches use it; `staleTime: Infinity` pattern already used for one-time queries |
| `zustand` | ^5.0.11 | Client state store | `settings.store.ts` already holds persistent config; adding `storyPointsFieldKey` is a one-field extension |
| `@tauri-apps/plugin-http` | ^2.5.7 | HTTP fetch bypassing CORS | All API calls use it; `discoverStoryPointsField` must use it too |
| `shadcn/ui` (Badge) | ^4.0.5 (shadcn CLI) | Chip badge component | Badge not yet installed; must be added via `npx shadcn add badge` before use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.577.0 | Icons | Already in project; no new icons needed for this phase |
| `class-variance-authority` | ^0.7.1 | Variant styling for badge | Already used by shadcn components in project |

**Installation (new dependency):**
```bash
cd /Users/mimo/Desktop/Tasker/taskflow
npx shadcn add badge
```

This generates `src/components/ui/badge.tsx` following the project's `base-nova` style.

---

## Architecture Patterns

### Pattern 1: Two-Query Subtask Fetch Strategy

**What:** `fetchSprintIssues` runs a primary JQL query (existing), then a second JQL query for subtasks whose parents appear in the first result set. The two result arrays are merged. If the second query fails for any reason, the function returns the primary results only.

**When to use:** Always — Jira DC's `sprint in openSprints()` excludes `issuetype in subtaskIssueTypes()` by design.

**JQL chunking:** With 50 keys per chunk, the `parent in (...)` clause stays under 500 characters. Multiple chunks are fetched in parallel via `Promise.all`. Result arrays are flattened and deduplicated by `issue.id`.

**Fields to request in second query:** Same as first query EXCEPT `description` is omitted — description is fetched on demand when a task detail view opens.

```typescript
// Approximate pattern — source: project CONTEXT.md decisions + Jira DC behavior
const CHUNK_SIZE = 50;

async function fetchSubtasks(
  base: string,
  token: string,
  parentKeys: string[],
  fields: string,
): Promise<JiraIssue[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < parentKeys.length; i += CHUNK_SIZE) {
    chunks.push(parentKeys.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) => {
      const jql = `issuetype in subtaskIssueTypes() AND parent in (${chunk.join(',')})`;
      const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields}`;
      // fetch + return issues array...
    }),
  );

  return results.flat();
}
```

**Callers receive the same `JiraIssue[]` type** — subtasks appear as additional items in the array. Callers do not need changes for APIF-02; the new `issuetype.subtask` boolean on the extended type lets them distinguish subtasks from stories.

### Pattern 2: Story Points Field Discovery

**What:** A one-time call to `GET /rest/api/2/field` which returns an array of all field descriptors for the Jira instance. Filter by `name` to find the story points field, return its `id` (e.g. `"customfield_10016"`). Cache result in `settings.store.ts` with `storyPointsFieldKey: string`.

**TanStack integration:** Wrap in a `useQuery` with `staleTime: Infinity` and `queryKey: ['jira-field-discovery']`. Result stored into settings store via `onSuccess` or `select`. On app startup when credentials are present, this query fires once and never again until cache is cleared.

**Discovery field name candidates (in priority order):**
1. Name equals `"Story Points"` (most common on Jira DC)
2. Name equals `"story_points"` (some custom configurations)
3. Key equals `"customfield_10028"` (secondary fallback field key)
4. Hard fallback: `"customfield_10016"` (silent, no error)

**API endpoint shape (HIGH confidence — confirmed by Atlassian community):**
```typescript
// GET /rest/api/2/field returns an array like:
[
  { id: "customfield_10016", name: "Story Points", custom: true, ... },
  { id: "summary", name: "Summary", custom: false, ... },
  ...
]
```

### Pattern 3: Releases Sort + Badge Rendering

**What:** In `ReleasesTab.tsx`, the `useMemo` that builds `matchedVersions` receives a sort step before mapping. Badge rendering is added inline to each row.

**Sort logic:**
```typescript
// Inside the existing useMemo — add before versions.map()
const sorted = [...versions].sort((a, b) => {
  if (!a.releaseDate && !b.releaseDate) return 0;
  if (!a.releaseDate) return 1;   // undated → bottom
  if (!b.releaseDate) return -1;  // undated → bottom
  return b.releaseDate.localeCompare(a.releaseDate); // newest first
});
```

**Timing badge derivation:**
```typescript
function getReleaseTimingLabel(releaseDate: string): 'overdue' | 'due-today' | { daysUntil: number } {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  if (releaseDate < today) return 'overdue';
  if (releaseDate === today) return 'due-today';
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(releaseDate).getTime() - new Date(today).getTime()) / msPerDay);
  return { daysUntil: days };
}
```

**Row layout (target from CONTEXT.md specifics):**
```
v2.1.0  [Released]                2025-12-01  0/12 done
v2.0.0  [Unreleased] [In 5 days]  2026-03-17  5/10 done
v1.9.0  [Unreleased] [Due today]  2026-03-12  8/10 done
v1.8.0  [Unreleased] [Overdue]    2026-03-01  2/10 done
```

### Pattern 4: GitLab MR State Filter Audit

**What:** `searchGitLabMRs` in `gitlab.ts` line 422 is missing `&state=opened`. The fix is a one-line URL change.

**Audit result of all MR fetch functions:**

| Function | Has `state=opened`? | Action |
|----------|---------------------|--------|
| `fetchAssignedMRs` | YES — `&state=opened&per_page=100` | No change |
| `fetchReviewerMRs` | YES — `&state=opened&per_page=100` | No change |
| `searchGitLabMRs` | NO — missing filter | Add `&state=opened` |

### Pattern 5: JiraIssue Type Extension

**What:** Add optional fields to `JiraIssue.fields`. All fields are optional (`?`) so existing callers never break — they receive `undefined` for new fields until the API sends them.

```typescript
// Extension to existing JiraIssue interface
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    // ... existing fields unchanged ...
    summary: string;
    status: { ... };
    assignee: { ... } | null;
    customfield_10016: number | null;
    issuetype: {
      name: string;
      subtask: boolean;         // NEW — use this, not name comparison
    };
    description?: string | null;
    // NEW optional fields:
    parent?: { id: string; key: string; fields: { summary: string } };
    subtasks?: Array<{ id: string; key: string; fields: { summary: string; status: { name: string } } }>;
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    [key: string]: unknown; // index signature for dynamic story points field key
  };
}
```

**Index signature note:** Adding `[key: string]: unknown` enables accessing `issue.fields[storyPointsFieldKey]` dynamically without TypeScript errors. This is the correct approach for a dynamically discovered field key.

### Anti-Patterns to Avoid

- **Comparing issue type by name:** `issuetype.name === 'Sub-task'` — WRONG. Admins can rename issue types. Use `issuetype.subtask === true`.
- **Fetching description in the subtask second query:** Wastes bandwidth. Description is fetched on demand only when a task opens.
- **Single large JQL IN() clause:** A sprint with 200 parent issues would produce a ~1600 char clause plus other JQL overhead. Chunking is required above ~50 keys.
- **Merging status badge and timing badge into one element:** The design spec explicitly requires them to be separate elements.
- **Using `new Date(releaseDate)` without UTC normalization:** `new Date('2026-03-12')` is parsed as UTC midnight; `new Date()` is local time. Use ISO string comparison (`toISOString().slice(0,10)`) for the "today" check to avoid timezone bugs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Badge chip component | Custom `<span>` with hardcoded colors | `shadcn add badge` → `<Badge variant="...">` | Consistent design system, dark mode via CSS vars, accessible |
| Dynamic field access | `(issue.fields as Record<string, unknown>)[key]` everywhere | Index signature on `JiraIssue.fields` | Keeps TypeScript happy without casting at every call site |
| Date comparison strings | Custom date parsing | ISO string `.slice(0,10)` lexicographic compare | "YYYY-MM-DD" strings sort correctly lexicographically; no Date object needed for sort |

**Key insight:** The shadcn Badge component uses `class-variance-authority` (already in project) and CSS variables (already configured). Installing it is one CLI command; rolling a custom chip is unnecessary.

---

## Common Pitfalls

### Pitfall 1: `fetchSprintIssues` callers share TanStack query keys

**What goes wrong:** Four callers use `['jira-issues', 'sprint-board', activeJiraProject]` or `['jira-issues', 'my-tasks', activeJiraProject]`. When `fetchSprintIssues` changes its return shape (adds subtask objects), all four callers immediately see the new shape. If the type change is not additive (e.g. a required field changes type), callers crash.

**How to avoid:** All new fields on `JiraIssue` must be optional (`?`). Never remove or change an existing field's type. Subtasks appear as new array items in the returned `JiraIssue[]`, not as nested objects on existing items — callers that don't care about subtasks simply see more items in the array.

**Warning signs:** TypeScript errors in `WorkloadTab`, `SprintProgressTab`, `SprintBoardTab`, or `MyTasksTab` after the type change.

### Pitfall 2: Timezone bugs in "Due today" detection

**What goes wrong:** `new Date('2026-03-12')` is midnight UTC. `new Date()` is local machine time. In timezones UTC+N, "today" in local time might be "yesterday" in UTC, causing a release dated today to show as "Overdue" instead of "Due today".

**How to avoid:** Compare release dates as ISO strings against `new Date().toISOString().slice(0, 10)`. Both sides are then strings in the same "YYYY-MM-DD" format without any timezone conversion.

### Pitfall 3: `discoverStoryPointsField` fires on every token change

**What goes wrong:** If `discoverStoryPointsField` is triggered by `useEffect` watching the Jira token (rather than as a TanStack query with `staleTime: Infinity`), it re-fires whenever the token reference changes — e.g. on re-renders.

**How to avoid:** Implement as a TanStack `useQuery` with `staleTime: Infinity` and `enabled: !!jiraBaseUrl && !!jiraToken`. TanStack tracks whether the query has ever resolved successfully and will not re-fetch while the data is in cache.

### Pitfall 4: `searchGitLabMRs` returns merged/closed MRs in search results

**What goes wrong:** The GitLab `/api/v4/search?scope=merge_requests` endpoint returns MRs of all states by default. Without `&state=opened`, a search for "feat: login" might surface merged 6-month-old MRs in the search overlay.

**How to avoid:** Add `&state=opened` to the URL in `searchGitLabMRs`. This is a one-character change to a single string at line 422 in `gitlab.ts`.

### Pitfall 5: Undated releases sort position

**What goes wrong:** Calling `b.releaseDate.localeCompare(a.releaseDate)` without null-checking crashes when `releaseDate` is `undefined`. Undated releases must be explicitly sorted to the bottom, not allowed to fall through to `localeCompare`.

**How to avoid:** Explicit null guard before any string comparison in the sort comparator (see sort pattern above).

---

## Code Examples

### shadcn Badge Usage (after `npx shadcn add badge`)

```typescript
// Source: shadcn/ui badge component — installed at src/components/ui/badge.tsx
import { Badge } from '@/components/ui/badge';

// Released row
<Badge variant="default" className="bg-green-600 text-white">Released</Badge>

// Unreleased future row
<Badge variant="default" className="bg-amber-500 text-white">Unreleased</Badge>
<span className="text-xs text-muted-foreground">In 5 days</span>

// Overdue
<Badge variant="destructive">Unreleased</Badge>
<Badge variant="destructive">Overdue</Badge>

// Due today
<Badge variant="default" className="bg-blue-600 text-white">Unreleased</Badge>
<Badge variant="default" className="bg-blue-600 text-white">Due today</Badge>
```

Note: shadcn `base-nova` style uses `variant="default"` and `variant="destructive"` as the two primary variants. Color overrides via className are the correct pattern when neither variant matches the design spec exactly.

### discoverStoryPointsField (service function)

```typescript
// Source: Jira REST API /rest/api/2/field endpoint (confirmed via Atlassian docs)
export async function discoverStoryPointsField(
  baseUrl: string,
  token: string,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return 'customfield_10016';
    const fields: Array<{ id: string; name: string }> = await response.json();
    const match = fields.find(
      (f) =>
        f.name === 'Story Points' ||
        f.name === 'story_points' ||
        f.id === 'customfield_10028',
    );
    return match?.id ?? 'customfield_10016';
  } catch {
    return 'customfield_10016';
  }
}
```

### Settings Store Extension

```typescript
// Extension to settings.store.ts — add to SettingsState interface:
storyPointsFieldKey: string;
setStoryPointsFieldKey: (key: string) => void;

// In create() initial state:
storyPointsFieldKey: 'customfield_10016',
setStoryPointsFieldKey: (key) => set({ storyPointsFieldKey: key }),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `customfield_10016` in field requests | `discoverStoryPointsField()` discovers the correct key | Phase 5 | Future phases (Workload, Sprint Progress) use the discovered key |
| Single JQL query for sprint issues (excludes subtasks) | Two-query strategy — sprint parents + subtask second pass | Phase 5 | Subtasks now available in all consumers; hierarchy phases 7+ depend on this |
| No sort on `fetchFixVersions` result | Client-side sort by `releaseDate` newest-to-oldest | Phase 5 | UI shows most relevant releases at top |
| No status visibility on releases | Released/Unreleased + timing badges | Phase 5 | PM can see at a glance which releases are at risk |

---

## Open Questions

1. **Real Jira DC instance validation for two-query JQL**
   - What we know: `issuetype in subtaskIssueTypes() AND parent in (...)` is documented for Jira DC; works in JQL sandbox
   - What's unclear: Whether Orange Jira DC v10.3.15 has `subtaskIssueTypes()` JQL function enabled (it is a Jira Software function)
   - Recommendation: Flag in implementation plan to validate on real instance; silent fallback already handles failure

2. **`discoverStoryPointsField` result on Orange Jira instance**
   - What we know: Many Jira DC instances use `customfield_10016`; some use different IDs
   - What's unclear: Which field ID Orange Jira DC v10.3.15 uses
   - Recommendation: Implementation is correct regardless; fallback ensures nothing breaks; verification phase will confirm

3. **shadcn `base-nova` style — Badge color variants**
   - What we know: Project uses `base-nova` style, not the default shadcn style; `class-variance-authority` is in deps
   - What's unclear: Whether `base-nova` Badge has additional named variants beyond `default`/`destructive`
   - Recommendation: Use className overrides for the four badge colors as shown in code examples; this is idiomatic shadcn usage for non-standard colors

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + Testing Library React 16.x |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/jira.test.ts src/services/gitlab.test.ts src/routes/dashboard/ReleasesTab.test.tsx` |
| Full suite command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APIF-01 | `JiraIssue` type accepts `parent`, `subtasks`, `timetracking`, `issuetype.subtask` without TS errors | unit (type-level) | `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit` | ✅ (tsc, no new file needed) |
| APIF-02 | `fetchSprintIssues` merges parent + subtask results; subtask query failure returns parents only | unit | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/jira.test.ts` | ❌ Wave 0 — new tests needed in existing file |
| APIF-03 | `discoverStoryPointsField` returns correct field key; falls back to `customfield_10016` on failure | unit | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/jira.test.ts` | ❌ Wave 0 — new tests needed in existing file |
| APIF-04 | `searchGitLabMRs` URL includes `state=opened` | unit | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/gitlab.test.ts` | ❌ Wave 0 — new test needed in existing file |
| REL-01 | `ReleasesTab` renders releases newest-to-oldest; undated releases at bottom | unit (component) | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` | ❌ Wave 0 — new tests needed in existing file |
| REL-02 | Each release row shows a Released or Unreleased badge | unit (component) | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` | ❌ Wave 0 — new tests needed in existing file |
| REL-03 | Overdue/Due today/In X days labels appear correctly based on date | unit (component) | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` | ❌ Wave 0 — new tests needed in existing file |

### Sampling Rate
- **Per task commit:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/jira.test.ts src/services/gitlab.test.ts src/routes/dashboard/ReleasesTab.test.tsx`
- **Per wave merge:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/jira.test.ts` — add tests for APIF-02 (`fetchSprintIssues` two-query strategy) and APIF-03 (`discoverStoryPointsField`)
- [ ] `src/services/gitlab.test.ts` — add test for APIF-04 (`searchGitLabMRs` state filter)
- [ ] `src/routes/dashboard/ReleasesTab.test.tsx` — add tests for REL-01 (sort order), REL-02 (badge presence), REL-03 (timing labels)
- [ ] Badge component: `npx shadcn add badge` — must run before tests that render badges

All test infrastructure (Vitest, jsdom, Testing Library, vi.mock patterns) already exists. No new config files required.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `taskflow/src/services/jira.ts` — full source of existing API functions and types
- Direct codebase read: `taskflow/src/services/gitlab.ts` — confirmed `searchGitLabMRs` is missing `state=opened` at line 422
- Direct codebase read: `taskflow/src/routes/dashboard/ReleasesTab.tsx` — existing `useMemo` insertion point identified
- Direct codebase read: `taskflow/src/stores/settings.store.ts` — extension pattern for `storyPointsFieldKey`
- Direct codebase read: `taskflow/package.json` — confirmed library versions
- Project `.planning/STATE.md` — confirmed two-query subtask strategy is mandatory for Jira DC
- Project `.planning/phases/05-api-foundation-quick-wins/05-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- [Atlassian Community: Story Points field in REST API](https://community.atlassian.com/forums/Jira-questions/Get-Story-points-in-GET-Rest-API-Call/qaq-p/2247723) — confirmed `GET /rest/api/2/field` returns `{id, name}` array; field name matching is the correct discovery approach
- [Jira Atlassian: JQL 6000 character limitation](https://jira.atlassian.com/browse/JRASERVER-41005) — confirmed 6000 char JQL limit exists in Jira DC; chunk size of 50 keys is safe

### Tertiary (LOW confidence)
- None — all key claims verified from codebase or official Atlassian sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in `package.json`; badge component install is standard shadcn flow
- Architecture: HIGH — all patterns derived directly from reading the actual source files
- Pitfalls: HIGH — two-query limitation confirmed from STATE.md prior research; timezone and sort pitfalls are code-reading findings
- Type extension approach: HIGH — TypeScript optional fields and index signatures are language features, not library opinions

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain; Jira REST API v2 is frozen; shadcn badge API is stable)
