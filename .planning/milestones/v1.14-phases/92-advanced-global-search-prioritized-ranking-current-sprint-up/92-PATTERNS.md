# Phase 92: Advanced Global Search - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 9 new/modified
**Analogs found:** 8 / 9

All paths below are relative to `/Users/mimo/Documents/Projects/taskflow/taskflow/` (inner app dir) unless stated.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/global-search.ts` (new) | utility (pure index/match/rank/group) | transform | `src/lib/assignee-filter.ts`, `src/lib/subtask-order.ts` (pure lib + sibling test); data source `services/jira/greenhopper/adapter.ts` + `entityMaps.ts` | role-match |
| `src/lib/global-search.test.ts` (new) | test | transform | `src/lib/subtask-order.test.ts` | role-match |
| `src/hooks/useGlobalSearchIndex.ts` (new) | hook | request-response (cache subscription) | `src/services/jira/greenhopper/useGhBacklogData.ts` + `src/hooks/useBoardId.ts` | exact (same key/fetcher) |
| `src/services/jira/greenhopper/useGhBacklogData.ts` (modify, additive option) | hook | request-response | itself (D-21 option A) | exact |
| `src/services/jira.ts` (modify: add `searchJiraBody`) | service | request-response | `searchJira` / `searchJiraClosed` (L1495-1616) | exact (but must THROW) |
| `src/components/app/CommandPalette.tsx` (modify in place) | component | request-response + event-driven | itself (580 lines) | exact |
| `src/components/app/SearchResultRow.tsx` (new, optional split) | component | transform (render) | `src/routes/dashboard/BacklogRow.tsx` (RowCells) | role-match |
| `src/components/app/CommandPalette.test.tsx` (modify) | test | request-response | itself (mock block L24-110) | exact |
| `src/hooks/useGlobalSearchIndex.test.tsx` (new) | test | request-response | `src/services/jira/greenhopper/useGhAllData.test.ts` | role-match |
| `src/services/jira.test.ts` addition for `searchJiraBody` | test | request-response | existing jira service tests (verify file name) | role-match |

## Pattern Assignments

### `src/hooks/useGlobalSearchIndex.ts` (hook, cache subscription)

**Analog:** `src/services/jira/greenhopper/useGhBacklogData.ts` and `src/hooks/useBoardId.ts`

**Board id resolution** (mirror `routes/dashboard/BacklogPage.tsx` L360-372; the palette also needs the token in state):
```typescript
useEffect(() => {
  readSecret('jira-pat').then(setJiraToken).catch(() => setJiraToken(null));
}, []);
const { boardId, isLoading: boardIdLoading } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);
```
`useBoardId` (hooks/useBoardId.ts L12-36) prefers `useAuthStore(s => s.jiraBoardIds?.[projectKey])`, else discovery query `['jira-board-id', projectKey, jiraBaseUrl]`.

**Route-gate problem (D-21)** - `useGhBacklogData.ts` L74-81:
```typescript
const isActive = useIsActiveRoute('/backlog');
return useQuery<GhBacklogResponse>({
  queryKey: ['gh-backlog', boardId],
  queryFn: () => fetchBacklogData(jiraBaseUrl as string, token as string, boardId as number),
  staleTime: STALE_TIME_MS,
  enabled: isActive && !!boardId && !!jiraBaseUrl && !!token,
});
```
Plan: either add `opts?: { ignoreRoute?: boolean; enabled?: boolean; staleTime?: number }` here (BacklogPage call site stays `useGhBacklogData(boardId)`), or in the new hook do a palette-owned `useQuery` with the SAME key `['gh-backlog', boardId]` and `fetchBacklogData` from `services/jira/greenhopper/data`. Palette values: `enabled: open && !!boardId && !!jiraBaseUrl && !!token`, `staleTime: 5 * 60_000`, `refetchOnWindowFocus: false`. Note `useIsActiveRoute` uses Router hooks; the palette is mounted from `main.tsx` so avoid calling it when `ignoreRoute` (hooks must stay unconditional, so branch inside the `enabled` expression, not around the hook).

**Passive gh-all-data read (D-19)** - key is `['gh-all-data', boardId]` (useGhAllData.ts L69). Use a fetch-disabled `useQuery({ queryKey: ['gh-all-data', boardId], enabled: false })` so it re-renders reactively when the cache fills (memory: "Reactive cache-read badge"); never triggers a fetch. Do NOT use `queryClient.getQueryData` in render (current palette L107-112 does; that is the anti-pattern).

### `src/lib/global-search.ts` (utility, transform)

**Analog for data shaping:** `routes/dashboard/BacklogPage.tsx` L420-436 (sprint reverse index) and `services/jira/greenhopper/entityMaps.ts`.

**Sprint reverse index to copy** (BacklogPage L424-436):
```typescript
const m = new Map<number, number>();
for (const s of backlog?.sprints ?? []) {
  // BL-01: restrict reverse index to ACTIVE/FUTURE sprints so issues whose only sprint
  // membership is a CLOSED sprint fall through to the backlog bucket
  if (s.state !== 'ACTIVE' && s.state !== 'FUTURE') continue;
  for (const id of s.issuesIds) m.set(id, s.id);
}
```
Extend to keep sprint order (tier rank = position in `sprints[]`; first ACTIVE = Current, first FUTURE gets " (next)"); if an issue is in several open sprints take the lowest rank.

**Entity resolvers** (entityMaps.ts, call directly on `GhBacklogResponse`, no `createAdapter`):
```typescript
const maps = buildEntityMaps(backlog);           // L34
resolveStatus(gh.statusId, maps)  // -> { id, name, statusCategory:{key} } L56
resolveType(gh.typeId, maps)      // -> { id, name } L92
resolveEpic(gh.epicId, maps)      // -> { id, key, name, color } | undefined L105
```
Apply the `gh.done` override to the status category (as `adaptIssue` does) and drop `gh.done` from default tiers, except done issues in the ACTIVE sprint stay in Current sprint (D-20; this supersedes the research recommendation to drop them).

**GhIssue fields available** (`greenhopper/types.ts` L26-56): `id, key, summary, typeId, statusId, done, assignee, assigneeName, avatarUrl, epicId, epic, parentKey, hidden`. Sprint: `GhSprintBacklog` L170-190 (`id, name, state: 'ACTIVE'|'CLOSED'|'FUTURE', issuesIds`).

**Pure-function style:** keep every ordering rule (tier > field > score; D-07 child-only = parent field +1) here so it is testable without React. Fuzzy matching via `fuzzysort@^4` (new direct dep; planner adds a `checkpoint:human-verify` before install; ESM import spike in vitest). Highlights must be React nodes built from index ranges, never `dangerouslySetInnerHTML`. Research gives `runsFromIndexes` and `buildSnippet` drafts (92-RESEARCH.md L288-310).

### `src/services/jira.ts` - `searchJiraBody` (service, request-response)

**Analog:** `searchJiraClosed` L1583-1616 (same file, same `apiFetch` call shape).

**Copy the request shape:**
```typescript
const base = baseUrl.replace(/\/$/, '');
const jql = `project = ${projectKey} AND statusCategory = Done AND text ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,customfield_10016,description&maxResults=20`;
response = await apiFetch('jira', url,
  { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
  'Search Closed Issues');
```
**Deviations required:**
- Do NOT copy the `try { } catch { return [] }` and `if (!response.ok) return []` (L1505-1524); the new fetcher must THROW so react-query `isError` drives the UI-SPEC error row.
- Reuse the `esc` helper from `searchJiraForLink` L1547: `const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');`
- Quote project key (`project = "${esc(projectKey)}"`, as `searchJiraForLink` L1550 does).
- `fields`: `summary,status,assignee,issuetype,parent,description,${epicLinkFieldKey}` (do not hardcode `customfield_10016`; epic field from `useSettingsStore().epicLinkFieldKey`, default `customfield_10014`); `maxResults=50`.
- `scope: 'open' | 'closed'` -> `statusCategory != Done` / `= Done`. Recommended no sprint clause (subtask-safe). Tokenise query, strip/escape JQL/Lucene reserved chars, `*` on last token only, emit `text ~ "t1" AND text ~ "t2*"`. Skip body request for key-looking input.
- Add as NEW export; do not alter `searchJira` / `searchJiraClosed` (shared consumers; memory "Shared fetcher cache key" / "jira.ts dual-file gotcha": edit `services/jira.ts`, not `services/jira/`).

### `src/components/app/CommandPalette.tsx` (component, modified in place)

**Analog:** itself.

**Keep as is:**
- Props interface L42-52, `useHotkeys('escape', onClose, { enableOnFormTags: true, enabled: open })` L93, reset-on-close effect L96-103, handlers `handleIssueSelect` / `handleIssueKeyClick` / `handleMRSelect` / theme / mark-read / create L199-237, `navActionHandlers` L266-271, backdrop/panel wrappers L281-307 (change only `max-w-xl` -> `max-w-3xl`), default-state Recent Items + Navigation (D-18) L324-367, Navigation group L529-548, Actions group L551-573.
- Debounce effect L74-81 (300 ms, >=2 chars) - reuse for the body query key.
- Key lookup logic L83-87 and `['search','key', resolvedKeyLookup]` query L186-195; per D-17 consult the local index first and only enable the fetch on miss.

**PEEK-05 key button pattern (reuse verbatim in every issue row)** L383-389 / L408-414:
```tsx
<button type="button"
  className="text-muted-foreground font-mono text-xs cursor-pointer hover:underline shrink-0"
  onClick={(e) => handleIssueKeyClick(e, issue.key)}>
  {issue.key}
</button>
```

**Remove:** `liveSearchTriggered`/`closedSearchTriggered` state, `['search','live'|'text'|'closed']` queries L134-182, imperative `getQueryData`/`getQueriesData` L107-130 (replace with `useQuery` subscriptions; MRs via `useQueries`/passive queries over `['gitlab-mrs']`), the "Issues", "Jira Search Results", "Closed Jira Tasks" groups and both tail items L395-524.

**Change:**
- `<Command className="rounded-lg border shadow-lg bg-popover">` L308 -> add `shouldFilter={false} loop` and controlled `value`/`onValueChange` keyed by issue key (selection stability when body hits merge; confirm cmdk behaviour in a component test).
- `CommandList className="max-h-[300px]"` L315 -> `max-h-[70vh]`.
- `CommandEmpty` L316-322: render own empty state conditionally (suppressed while body request in flight); copy per UI-SPEC.
- D-16: explicitly filter MR/Nav/Actions by query when `shouldFilter={false}` (`label.toLowerCase().includes(q)`, MR on `!iid`/title); current MR group L421-433 lists every cached MR.
- `CommandItem` (components/ui/command.tsx L137) always renders trailing `CheckIcon ml-auto opacity-0`; hide with `[&>svg:last-child]:hidden` and pass `py-1` for compact rows.
- Include-closed: `CommandItem forceMount value="include-closed"` modelled on existing tail items L438-444 (`forceMount`, fixed `value`), with `Archive` icon.
- Body query pattern (from existing L147-156 + research L316-322): `useQuery({ queryKey: ['search','body', debouncedQuery, activeJiraProject, scope], queryFn: async () => { const token = await readSecret('jira-pat'); return searchJiraBody(...) }, enabled: open && debouncedQuery.length >= 2 && ..., staleTime: 60_000, placeholderData: keepPreviousData })`. Hide placeholder rows via `isPlaceholderData`.
- Hooks must all run before the `if (!open) return null` at L275; gate fetching with `open`.

### `src/components/app/SearchResultRow.tsx` (component, render)

**Analog:** `src/routes/dashboard/BacklogRow.tsx` RowCells (L71-223), plus palette row markup.

**Epic badge chip (copy classes; palette variant is a non-interactive span, not a button)** L180-194:
```tsx
<span className={cn('inline-flex min-w-14 shrink items-center overflow-hidden rounded border px-1.5 py-0.5 text-xs font-medium', epicColorResult.className)}
  style={epicColorResult.style} title={`${epicKey}: ${epicName}`}>
  <span className="truncate">{epicName}</span>
</span>
```
with `const epicColorResult = epicColorToTailwind(epic.color, epic.key)` (`lib/epicColors.ts` L71; returns `{ className, style? }`).

**Avatar:** `<CachedAvatar url={...} name={assigneeName || 'Unassigned'} size={20} />` (BacklogRow L215-219 uses 24; 20 is allowed, `SIZE_MAP` has 20). Wrap in `flex-none w-5` (0-width collapse gotcha).

**Status pill:** `statusPillClass(categoryKey)` from `lib/statusStyles.ts` L92, must sit in a flex parent: `<div className="flex shrink-0"><span className={statusPillClass(key)}>{status.name}</span></div>`. Add no geometry.

**Type icon:** `<IssueTypeIcon typeName={...} className="w-3.5 h-3.5 shrink-0" />` (palette L378-381).

**Flex shrink priority:** BacklogRow L138 (`flex-[1_1_auto] min-w-0`) and L152 (`flex-[0_100_auto] min-w-0`, fixed min-w floors like `min-w-32`, never `min(x,max-content)` in WebKit). Title `truncate` shrinks first; snippet region `flex-[0_1_auto] min-w-0 min-w-24`.

**Tag chip** (copy BacklogRow L203 style family): `shrink-0 rounded border border-border bg-muted px-1 py-0 text-xs font-medium text-muted-foreground`.

**Highlight:** `<mark className="bg-transparent text-inherit underline decoration-primary/60 underline-offset-2">` built from index runs, max 6.

**Narrow degradation:** put `@container` on an inner wrapper, children use `@[560px]:` variants (memory: container query not on self).

### Tests

**`CommandPalette.test.tsx` mock block to extend** (L41-80): current mocks provide only `readSecret`, `@/services/jira` (`searchJira, searchJiraClosed, fetchJiraIssueByKey`), auth store (`jiraBaseUrl, gitlabBaseUrl, activeJiraProject`), settings store (`theme, setTheme, storyPointsFieldKey`). Must add: `searchJiraBody`, `epicLinkFieldKey`, `jiraBoardIds` (or mock `useBoardId` / `useGlobalSearchIndex` and inject a prepared index - simplest). Retain polyfills L11-22 (ResizeObserver, scrollIntoView). Update mocks in the same commit as code (pre-commit runs full vitest; combine RED/GREEN).

**`global-search.test.ts`:** build synthetic `GhBacklogResponse` from `src/services/jira/greenhopper/__fixtures__/data.real.json` (226 issues, 0 subtasks, 4 done in active sprint) and hand-add subtasks / sprints; fixture titles are sanitised ("Sample summary N") so write synthetic titles for fuzzy cases.

## Shared Patterns

### Token + base URL access
**Source:** `useGhBacklogData.ts` L53-72 (effect re-reading `readSecret('jira-pat')` keyed on `jiraBaseUrl`) and the palette's per-query `const token = await readSecret('jira-pat')` (CommandPalette L137, L150).
**Apply to:** `useGlobalSearchIndex`, body query, Include-closed query.

### Jira HTTP
**Source:** `apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}`, ... } }, '<label>')` in `services/jira.ts` L1507-1517. No extra logging of auth headers.
**Apply to:** `searchJiraBody`.

### Reactive cache reads
**Source:** memory "Reactive cache-read badge" - fetch-disabled `useQuery` (`enabled:false`) on the shared key re-renders on `setQueryData`. **Apply to:** `gh-all-data` passive read, `gitlab-mrs` caches.

### Cache sharing / Jira-load
**Source:** `useGhBacklogData.ts` L91-102 (`getGhBacklogData` uses `ensureQueryData` with the same key) - the palette observer must use the identical key `['gh-backlog', boardId]`; long `staleTime` (5 min) so opening the palette does not refetch; `STALE_TIME_MS` default is 30 s (`lib/query-constants`).

### Output encoding
Render summary/description text only through React nodes. Never `dangerouslySetInnerHTML`; use callback/ranges form of fuzzysort highlight.

### Lint/commit gate
Biome per touched file only (never `--write` over all of `src`); `npx tsc --noEmit`; full vitest on commit.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Fuzzy matcher / snippet / highlight-range logic inside `global-search.ts` | utility | transform | No existing fuzzy search or text-highlighting in the repo (`lib/internalLinks.ts`, `assignee-filter.ts` are plain predicates). Use RESEARCH.md drafts + `fuzzysort@^4`. |

## Metadata

**Analog search scope:** `src/components/app`, `src/components/ui`, `src/hooks`, `src/lib`, `src/routes/dashboard`, `src/services/jira.ts`, `src/services/jira/greenhopper`
**Files read:** CommandPalette.tsx, CommandPalette.test.tsx (L1-110), useGhBacklogData.ts, useGhAllData.ts (partial), BacklogRow.tsx, BacklogPage.tsx (L360-440, partial), jira.ts (L1485-1625), entityMaps.ts, greenhopper/types.ts (partial), useBoardId.ts, statusStyles.ts / epicColors.ts (partial)
**Pattern extraction date:** 2026-10-16
