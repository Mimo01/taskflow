# Quick Task 260617-e3z: Issue Text Search — Research

**Researched:** 2026-06-17
**Domain:** CommandPalette + Jira REST search
**Confidence:** HIGH — all findings from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Debounced keystroke trigger (~300ms after user stops typing)
- Match against issue title + description
- Scoped to the current/active project only
- Result count: top 5–10 issues max
- Results inline with existing results — no separate section header or tab

### Claude's Discretion
- Exact debounce delay (300ms recommended)
- Result count cap
- How "current project" is determined from app state
- How to render issue results vs existing result types in the shared list
</user_constraints>

---

## Summary

The in-app search is `CommandPalette.tsx`. It already has a working live Jira text search (`searchJira`) and a `searchJiraClosed` variant, but both are **opt-in** — the user must click a "Search Jira for …" tail item to trigger them. The task is to make issue text search **automatic** (debounced keystroke), and merge the results inline into the existing "Issues" group rather than adding a new section.

The existing `searchJira` function already uses `project = ${projectKey} AND text ~ "${query}"` JQL, which searches both summary and description. The active project comes from `useAuthStore().activeJiraProject`. The codebase has a well-established 300ms debounce pattern (`useEffect` + `clearTimeout`). The only changes needed are in `CommandPalette.tsx` — no service-layer work required.

**Primary recommendation:** Wire a debounced `useQuery` that calls the existing `searchJira` into the existing "Issues" `CommandGroup`, merging live results with cached sprint-board issues in a single deduplicated list, capped at 10.

---

## Architecture Patterns

### How the Current Issues Group Works

The "Issues" group in `CommandPalette.tsx` renders from `allIssues` — a list built exclusively from the **sprint-board cache** (`queryClient.getQueryData(['jira-issues', 'sprint-board', …])`). This is a `getQueryData` read (non-reactive, snapshot at render time). The cmdk `value` prop on each `CommandItem` includes the issue key + summary, which is what cmdk uses for its internal fuzzy filter as the user types.

So currently:
- The "Issues" group shows sprint-board cached issues
- cmdk filters them client-side by substring match on key+summary
- No API call fires automatically as the user types

### What Needs to Change

Replace the static cache-only "Issues" group with a **merged list**:
1. Sprint-board cache issues (existing — no change)
2. + Live API search results from `searchJira` (new — debounced, deduplicated by key)

Deduplication: build a `Map<string, JiraIssue>` keyed by issue key; push cache issues first, then add live results only if key not already present.

Cap total rendered items at 10.

### Debounce Pattern — Established in This Codebase

Two patterns exist, both valid:

**Pattern A: `useEffect` + `clearTimeout` (MergeRequestListPage.tsx line 64–67)**
```typescript
// Simple, no extra hook needed
const [debouncedQuery, setDebouncedQuery] = useState('');
useEffect(() => {
  const timer = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(timer);
}, [query]);
```

**Pattern B: `useRef`-based `useDebounce` hook (IssueLinkRow.tsx line 26–34)**
```typescript
function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return (...args: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delay);
  };
}
```

**Recommendation:** Use Pattern A (the `useEffect` style) — it's simpler, idiomatic for this use case, and matches what the MR search page already does. No need to extract a separate hook.

### `searchJira` — Already Does What We Need

Located in `src/services/jira.ts` at line 1231:

```typescript
export async function searchJira(
  baseUrl: string,
  token: string,
  projectKey: string,
  query: string,
): Promise<JiraIssue[]>
```

JQL used: `project = ${projectKey} AND text ~ "${query}" ORDER BY updated DESC`

- `text ~` searches summary, description, and comments (Jira full-text index)
- Scoped to `projectKey` — satisfies the "current project only" constraint
- `maxResults=20` currently — can tighten to `maxResults=10` by adjusting the URL, or just slice the result after the API call

The function already returns `[]` on error (non-throwing), so it's safe to use in a background query.

### How "Current Project" Is Determined

`useAuthStore().activeJiraProject` — already used throughout `CommandPalette.tsx`. No additional plumbing needed.

### `useQuery` Key for the New Search

The live Jira search already has a query at line 127 of `CommandPalette.tsx` with key `['search', 'live', query]`. The new debounced search should use a **different key** (e.g. `['search', 'text', debouncedQuery]`) to avoid colliding with the existing manual-trigger query.

Alternatively, if the liveSearch query is being replaced by the automatic one, reuse the same key — but the cleanest approach is to rename to a dedicated key for the auto-debounced path.

---

## Key Files

| File | Role |
|------|------|
| `src/components/app/CommandPalette.tsx` | The entire search UI — this is the only file to edit |
| `src/services/jira.ts` line 1231 | `searchJira()` — no changes needed |
| `src/stores/auth.store.ts` | `activeJiraProject` + `jiraBaseUrl` — already read in CommandPalette |

---

## Implementation Sketch

In `CommandPalette.tsx`:

1. Add debounced query state:
```typescript
const [debouncedQuery, setDebouncedQuery] = useState('');
useEffect(() => {
  if (trimmed.length < 2) { setDebouncedQuery(''); return; }
  const timer = setTimeout(() => setDebouncedQuery(trimmed), 300);
  return () => clearTimeout(timer);
}, [trimmed]);
```

2. Add `useQuery` for automatic text search (fires without user clicking anything):
```typescript
const { data: textSearchResults } = useQuery({
  queryKey: ['search', 'text', debouncedQuery, activeJiraProject],
  queryFn: async () => {
    const token = await readSecret('jira-pat');
    return searchJira(jiraBaseUrl ?? '', token, activeJiraProject ?? '', debouncedQuery);
  },
  enabled: debouncedQuery.length >= 2 && !!jiraBaseUrl && !!activeJiraProject,
  staleTime: 30_000,
  placeholderData: keepPreviousData,
});
```

3. Merge into the existing `issuesMap` before rendering the "Issues" group:
```typescript
// After building issuesMap from sprint board cache:
for (const issue of textSearchResults ?? []) {
  if (!issuesMap.has(issue.key)) issuesMap.set(issue.key, issue);
}
const allIssues = Array.from(issuesMap.values()).slice(0, 10);
```

4. No changes to the render — the "Issues" `CommandGroup` already iterates `allIssues`. The cmdk `value` prop (key + summary) is already correct.

---

## Pitfalls

### Pitfall 1: Colliding with the Existing Manual `liveSearchTriggered` Path
The existing "Search Jira for …" tail item triggers `liveSearchTriggered = true` and fires a query with key `['search', 'live', query]`. The new auto-debounced path should NOT overwrite or conflict with this. Keep both: auto-search merges into the "Issues" group; the manual tail item continues to show in "Jira Search Results". This gives the user inline results automatically AND the manual deep-search escape hatch.

### Pitfall 2: cmdk Value Collision
If a live result and a cache result have the same key, having two `CommandItem`s with the same `value` prop causes cmdk duplication bugs. The deduplication Map ensures this never happens — add live results to the map only if the key isn't already present.

### Pitfall 3: `getQueryData` Is Non-Reactive
The existing `cachedSprintBoard` read via `queryClient.getQueryData()` is a snapshot — it doesn't cause re-renders when the cache updates. This is the existing code's behavior. For the new text search, `useQuery` IS reactive, so live results will update correctly. No change needed to the sprint board cache read pattern.

### Pitfall 4: Empty Query Guard
`searchJira` should not fire when `debouncedQuery` is empty. The `enabled: debouncedQuery.length >= 2` guard handles this. Also reset `debouncedQuery` to `''` when the palette closes (the existing `useEffect` on `open` already resets `query`; add `setDebouncedQuery('')` there too).

---

## Performance

- `staleTime: 30_000` — same as the existing live search; avoids refetch on re-opens within 30s
- `maxResults=20` in the service is fine; `slice(0, 10)` caps the rendered list
- The debounce (300ms) prevents API calls on every keystroke
- `keepPreviousData` avoids flicker between query changes — already imported in the file

---

## Sources

- `[VERIFIED: codebase]` — `src/components/app/CommandPalette.tsx` read directly
- `[VERIFIED: codebase]` — `src/services/jira.ts` line 1231–1264 read directly
- `[VERIFIED: codebase]` — `src/routes/dashboard/IssueLinkRow.tsx` debounce pattern read directly
- `[VERIFIED: codebase]` — `src/routes/dashboard/MergeRequestListPage.tsx` debounce pattern read directly
- `[VERIFIED: codebase]` — `src/stores/auth.store.ts` activeJiraProject confirmed
