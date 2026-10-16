# Phase 92: Advanced Global Search - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the existing global search (CommandPalette) into a ranked, cache-backed issue search:
results ordered by sprint tier (current > upcoming > backlog > closed), then matched field
(title > description > comment), with subtasks grouped under their parent story. Rows show
epic badge, status, and assignee, with match highlighting. The search must feel instant and
put minimal load on Jira. Dialog gets larger. No new search *capabilities* beyond this
(no saved searches, no filters UI, no JQL mode).

</domain>

<decisions>
## Implementation Decisions

### Index scope & Jira load
- **D-01:** Searchable set = current (active) sprint + upcoming (future) sprints + backlog. Done/closed
  issues are only searched on demand via an explicit "Include closed" item; those results merge into
  a "Closed" tier at the bottom.
- **D-02:** Hybrid index (Claude's discretion; user priority: "fast, but think of performance"):
  - **Title tier is local and instant** — built from the GreenHopper backlog cache
    `['gh-backlog', boardId]` (it already contains active + future sprints + backlog with summary,
    assignee, avatar, epic key, parentKey, status, type). No request, no debounce for title hits.
  - **Body tiers (description/comment) from ONE debounced Jira `text ~` request per query**, JQL scoped
    to the same set (open sprints + future sprints + backlog, statusCategory != Done unless "Include
    closed"), requesting minimal fields incl. `description`. Cached per query (react-query,
    keepPreviousData). Results merge into the already-rendered list as they arrive — the list never
    waits on Jira.
  - Do NOT bulk-prefetch descriptions/comments for all issues.
- **D-03:** Cold cache: if `['gh-backlog', boardId]` is empty when the palette opens, search fetches it
  via the shared `useGhBacklogData` hook / `getGhBacklogData` (same key + fetcher as BacklogPage), so
  the cache is shared. Search must not depend on BacklogPage having mounted first.
- **D-04:** Field tier for body hits is inferred locally: if the fetched `description` contains the
  query (same matcher as titles) → description hit; otherwise the `text ~` hit is assumed to be a
  comment hit. No extra per-issue comment fetches.

### Ranking model
- **D-05:** Strict ordering: sprint tier first, then field tier. Sprint tiers: Current sprint >
  next upcoming sprint > later upcoming sprints (in sprint order) > Backlog > Closed. Within a tier:
  title > description > comment. A comment hit in the current sprint beats a title hit in the backlog.
- **D-06:** Result list shows section headers per sprint tier ("Current sprint", "<Sprint name>",
  "Backlog", "Closed").
- **D-07:** Story > subtask via grouping: a group (story + its matching subtasks) ranks by the
  parent's own best match. If only children match, the group ranks as though the parent matched one
  field-step lower than the best child match (so a story's own title hit beats a story surfaced via a
  subtask title hit). Subtasks are ranked under the sprint tier of their parent.
- **D-08:** Local title matching is fuzzy / typo-tolerant (user choice). Within the same field tier,
  exact-phrase and word-start matches must still score above loose fuzzy/subsequence matches so
  precise hits aren't buried; tune a minimum score threshold to suppress noisy matches on long titles.

### Result row & grouping
- **D-09:** Dialog ~`max-w-3xl` (upper bound, not larger), results list grows up to ~70vh (replaces
  fixed `max-h-[300px]`). Still a centred overlay.
- **D-10:** Row (one line, never wraps — drop columns rather than stack): type icon · key · title
  (truncates) · epic badge (stories only) · status pill · assignee avatar. User note: **compact** —
  small avatar, compact status pill, xs epic badge, tight row padding.
- **D-11:** Description/comment matches: a trailing muted snippet on the same line ("…matched
  phrase…" with the term highlighted) plus a small `desc` / `comment` tag; title truncates first.
- **D-12:** Match highlighting on titles (and snippets) for the matched terms/characters.
- **D-13:** Only-subtask-matched groups: parent row shown dimmed as a context header (no highlight,
  still clickable), matching subtasks indented below with ↳; non-matching siblings hidden.

### Existing palette pieces
- **D-14:** Upgrade `CommandPalette` in place — same shortcut, single entry point. The "Issues" group
  is replaced by the ranked/grouped tiers.
- **D-15:** Drop the "Search Jira for …" tail item (live search is automatic per D-02). Keep closed as
  an "Include closed" item; results go to the Closed tier.
- **D-16:** Merge Requests, Navigation, Actions render below the issue tiers and only when they match
  the query (fixes current behaviour where cached MRs are listed regardless of the query).
- **D-17:** Key lookup ("SHOP-412" / bare "412" → active project) keeps a pinned "Direct match" row
  at the top; resolve from the local index first, fetch from Jira only if not cached.
- **D-18:** Default state (<2 chars) unchanged: Recent Items + Navigation.

### Claude's Discretion
- Exact hybrid mechanics (D-02): debounce length, JQL shape, fields list, maxResults, how cache
  vs. Jira results are merged/de-duplicated.
- Fuzzy matcher choice/implementation and scoring weights (D-08), as long as the ordering rules hold.
- Per-tier result caps, keyboard behaviour, loading/empty-state visuals.
- Whether ranking/index logic lives in a pure `lib/` module (preferred for unit testing).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above. Key code references:

### Search surface
- `taskflow/src/components/app/CommandPalette.tsx` — current palette (cmdk), the component being upgraded
- `taskflow/src/components/ui/command.tsx` — cmdk primitives (note: not CommandDialog — Radix/base-ui conflict)
- `taskflow/src/services/jira.ts` §`searchJira`, `searchJiraClosed`, `fetchJiraIssueByKey` (~L1495–1616) — current Jira text search (hardcodes `customfield_10016`, maxResults=20)

### Index data source
- `taskflow/src/services/jira/greenhopper/useGhBacklogData.ts` — shared hook + imperative `getGhBacklogData` (ensureQueryData) for `['gh-backlog', boardId]`
- `taskflow/src/services/jira/greenhopper/types.ts` — GhBacklog issue shape (key, summary, done, assignee/assigneeName/avatarUrl, epic, parentKey, status, typeName) and sprints
- `taskflow/src/services/jira/greenhopper/data.ts` — `/plan/backlog/data.json` fetcher

### Row rendering
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — one-line row with epic badge + avatar (closest analog)
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` — parent story header pattern
- `taskflow/src/lib/epicColors.ts` — epic badge colour classes
- `taskflow/src/components/ui/cached-avatar.tsx` — avatar (explicit px sizing)
- `taskflow/src/components/ui/issue-type-icon.tsx` — type icon

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGhBacklogData` / `getGhBacklogData`: cache source for the local title index; already shared with BacklogPage and Sidebar prefetch.
- `epicColors.ts`, `CachedAvatar`, `IssueTypeIcon`, status pill helpers (`statusPillClass`): row building blocks.
- `useRecentItemsStore`, `NAV_SHORTCUTS`: default state and navigation group stay as-is.

### Established Patterns
- One row = one line at every density; drop columns rather than wrap (user preference).
- Colour = status only; epic badge colours come from Jira epic colour.
- `statusPillClass` needs a flex parent (collapses on bare inline span).
- Italic text clipped by `truncate` — add `pr-0.5` if snippets are italic.
- Imperative `getQueryData()` in render is non-reactive — the current palette reads caches this way; the new index should subscribe via `useQuery` so it updates when the cache fills.
- Edit legacy `services/jira.ts`, not `services/jira/` modules, for Jira fetchers (all imports use jira.ts). Don't change the JQL of a shared fetcher in place — add a scoped one.
- Pre-commit hook runs full vitest suite — combine RED/GREEN per TDD task.

### Integration Points
- `CommandPalette` is mounted from `src/main.tsx` (open/close, onIssueClick, onNavigate props).
- Board id for `['gh-backlog', boardId]` — same resolution BacklogPage/Sidebar use.

</code_context>

<specifics>
## Specific Ideas

Row preview the user approved:
```
▣ SHOP-412  Checkout fails when cart empty   [Payments]  (In Progress)  ●MM
   ↳ SHOP-415  Fix null cart guard                         (To Do)        ●JK
```
…rendered compactly. Tier layout approved:
```
CURRENT SPRINT
  SHOP-412  title match
  SHOP-398  description match
  SHOP-377  comment match
SPRINT 43 (next)
  SHOP-455  title match
BACKLOG
  SHOP-120  title match
```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
- "Priority stripe: color by Jira priority-scheme rank" (`priority-stripe-rest-rank.md`) — keyword match only; sprint-board stripe colouring, unrelated to search.

</deferred>

---

*Phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up*
*Context gathered: 2026-10-16*
