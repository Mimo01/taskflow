# Phase 92: Advanced Global Search - Research

**Researched:** 2026-10-16
**Domain:** Cached-index ranked search inside an existing cmdk palette (React 19, TanStack Query 5, GreenHopper cache, Jira Server/DC REST v2)
**Confidence:** MEDIUM-HIGH (codebase facts verified by reading source; Jira `text ~` semantics only partly documented)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Searchable set = current (active) sprint + upcoming (future) sprints + backlog. Done/closed issues are only searched on demand via an explicit "Include closed" item; those results merge into a "Closed" tier at the bottom.
- **D-02:** Hybrid index (Claude's discretion; user priority: "fast, but think of performance"):
  - Title tier is local and instant - built from the GreenHopper backlog cache `['gh-backlog', boardId]` (it already contains active + future sprints + backlog with summary, assignee, avatar, epic key, parentKey, status, type). No request, no debounce for title hits.
  - Body tiers (description/comment) from ONE debounced Jira `text ~` request per query, JQL scoped to the same set (open sprints + future sprints + backlog, statusCategory != Done unless "Include closed"), requesting minimal fields incl. `description`. Cached per query (react-query, keepPreviousData). Results merge into the already-rendered list as they arrive - the list never waits on Jira.
  - Do NOT bulk-prefetch descriptions/comments for all issues.
- **D-03:** Cold cache: if `['gh-backlog', boardId]` is empty when the palette opens, search fetches it via the shared `useGhBacklogData` hook / `getGhBacklogData` (same key + fetcher as BacklogPage), so the cache is shared. Search must not depend on BacklogPage having mounted first.
- **D-04:** Field tier for body hits is inferred locally: if the fetched `description` contains the query (same matcher as titles) -> description hit; otherwise the `text ~` hit is assumed to be a comment hit. No extra per-issue comment fetches.
- **D-05:** Strict ordering: sprint tier first, then field tier. Sprint tiers: Current sprint > next upcoming sprint > later upcoming sprints (in sprint order) > Backlog > Closed. Within a tier: title > description > comment. A comment hit in the current sprint beats a title hit in the backlog.
- **D-06:** Result list shows section headers per sprint tier ("Current sprint", "<Sprint name>", "Backlog", "Closed").
- **D-07:** Story > subtask via grouping: a group (story + its matching subtasks) ranks by the parent's own best match. If only children match, the group ranks as though the parent matched one field-step lower than the best child match (so a story's own title hit beats a story surfaced via a subtask title hit). Subtasks are ranked under the sprint tier of their parent.
- **D-08:** Local title matching is fuzzy / typo-tolerant (user choice). Within the same field tier, exact-phrase and word-start matches must still score above loose fuzzy/subsequence matches so precise hits aren't buried; tune a minimum score threshold to suppress noisy matches on long titles.
- **D-09:** Dialog ~`max-w-3xl` (upper bound, not larger), results list grows up to ~70vh (replaces fixed `max-h-[300px]`). Still a centred overlay.
- **D-10:** Row (one line, never wraps - drop columns rather than stack): type icon, key, title (truncates), epic badge (stories only), status pill, assignee avatar. Compact: small avatar, compact status pill, xs epic badge, tight row padding.
- **D-11:** Description/comment matches: a trailing muted snippet on the same line ("...matched phrase..." with the term highlighted) plus a small `desc` / `comment` tag; title truncates first.
- **D-12:** Match highlighting on titles (and snippets) for the matched terms/characters.
- **D-13:** Only-subtask-matched groups: parent row shown dimmed as a context header (no highlight, still clickable), matching subtasks indented below with the return-arrow glyph; non-matching siblings hidden.
- **D-14:** Upgrade `CommandPalette` in place - same shortcut, single entry point. The "Issues" group is replaced by the ranked/grouped tiers.
- **D-15:** Drop the "Search Jira for ..." tail item. Keep closed as an "Include closed" item; results go to the Closed tier.
- **D-16:** Merge Requests, Navigation, Actions render below the issue tiers and only when they match the query (fixes current behaviour where cached MRs are listed regardless of the query).
- **D-17:** Key lookup ("SHOP-412" / bare "412" -> active project) keeps a pinned "Direct match" row at the top; resolve from the local index first, fetch from Jira only if not cached.
- **D-18:** Default state (<2 chars) unchanged: Recent Items + Navigation.

### Claude's Discretion
- Exact hybrid mechanics (D-02): debounce length, JQL shape, fields list, maxResults, how cache vs. Jira results are merged/de-duplicated.
- Fuzzy matcher choice/implementation and scoring weights (D-08), as long as the ordering rules hold.
- Per-tier result caps, keyboard behaviour, loading/empty-state visuals.
- Whether ranking/index logic lives in a pure `lib/` module (preferred for unit testing).

### Deferred Ideas (OUT OF SCOPE)
None. (Reviewed todo "Priority stripe: color by Jira priority-scheme rank" - unrelated, not folded.) Out of scope per CONTEXT/UI-SPEC: saved searches, filter UI, JQL mode, pagination controls, per-tier colours/legends, dedicated search page.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped (null). The D-01..D-18 decisions above are the contract; the Validation Architecture section maps each D-XX to a test.
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists at repo root or in `taskflow/`; no `.claude/skills` or `.agents/skills`. Constraints come from team memory and the UI-SPEC and are treated as binding:
- Edit legacy `src/services/jira.ts`; do not change JQL of a shared fetcher in place, add a scoped one.
- Biome: never `--write` over all of `src`; gate on "no NEW files flagged". Pre-commit runs the full vitest suite + biome + tsc, so combine RED/GREEN into one commit per task.
- One row = one line at every density (drop columns, never wrap). `statusPillClass` needs a flex parent. Italic + `truncate` clips (UI-SPEC says snippet not italic).
- Imperative `getQueryData()` in render is non-reactive; subscribe via `useQuery`.
- Tailwind v4: container variants never style the container itself; use an inner wrapper.
- Repo layout: `.planning` + git at `/Users/mimo/Documents/Projects/taskflow`; src/npm/vitest/biome in `/Users/mimo/Documents/Projects/taskflow/taskflow`.
- Do NOT use `CommandDialog` (Radix/base-ui conflict).

## Summary

The palette (`taskflow/src/components/app/CommandPalette.tsx`, 580 lines) currently reads the sprint-board cache imperatively, issues two `text ~` requests (`searchJira`, `searchJiraClosed`, both swallow errors and return `[]`, cap 20, hardcode `customfield_10016`), and relies on cmdk's built-in filter/sort. The upgrade is mostly (1) a pure `lib/` module that builds an index from `GhBacklogResponse`, matches, ranks and groups; (2) one new scoped Jira fetcher; (3) a rewritten render section; (4) wiring the backlog cache so it loads without BacklogPage.

Three facts in the code contradict or complicate the CONTEXT assumptions and the planner MUST handle them:
1. **`useGhBacklogData` is route-gated.** It does `enabled: isActive && ...` where `isActive = useIsActiveRoute('/backlog')`. Called from the palette on any other route it never fetches, so D-03 ("use the shared hook") does not work as-is. Needs an additive option or the palette's own `useQuery` on the same key + `fetchBacklogData`.
2. **The backlog envelope contains zero subtasks.** The real fixture `data.real.json` has 226 issues, 0 with `parentKey`; `BacklogPage.tsx` L694 says "the backlog data envelope no longer carries subtask rows". D-02 says the title index "contains ... parentKey" and D-13 needs subtask grouping, but subtask rows are never in `['gh-backlog', boardId]`. Subtasks can only come from (a) the body Jira request, and (b) optionally the passively-cached `['gh-all-data', boardId]` (sprint board; fixture has 103/156 subtasks) for active-sprint subtasks. Subtask title hits are therefore NOT instant unless (b) is used.
3. **Done issues are inside the cache** (4 of 226 in the fixture have `done: true`, in the active sprint). D-01 says closed are on-demand only, so local index must drop `done` issues (or put them in Closed tier) - recommend dropping them from the default set and only rendering them in the Closed tier when "Include closed" is on.

**Primary recommendation:** Build `src/lib/global-search.ts` (pure: `buildSearchIndex`, `matchTitle`, `rankResults`, `groupResults`, `buildSnippet`, `highlightRanges`) using `fuzzysort` for the fuzzy title tier; set cmdk `shouldFilter={false}` and render pre-ranked groups; add `searchJiraBody()` to `jira.ts` (throws on error, `statusCategory != Done` / `= Done` modes); fetch the backlog cache with a palette-owned, `open`-gated `useQuery` on the shared key.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Title index + fuzzy match + ranking + grouping | Browser / Client (pure lib) | - | Data already in React Query cache; must be synchronous per keystroke |
| Index source (sprints, issues, epics, assignees) | Browser cache (`['gh-backlog', boardId]`) | API (GreenHopper `/plan/backlog/data.json`) on cold cache | Shared with BacklogPage; no new request when warm |
| Description/comment search | API / Backend (Jira `text ~`) | Browser (field-tier inference, snippet) | Only Jira indexes comments; D-04 infers tier locally |
| Closed issue search | API / Backend | - | Not in cache by D-01 |
| Direct key lookup | Browser index first | API `fetchJiraIssueByKey` | D-17 |
| Rendering / keyboard / highlight | Browser (cmdk) | - | UI-SPEC |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | 1.1.1 (installed) | Palette list/keyboard/a11y | Already used via `components/ui/command.tsx` |
| @tanstack/react-query | ^5.90.21 (installed) | Index cache subscription, body-search cache, `placeholderData: keepPreviousData` | Project standard |
| fuzzysort | 4.0.2 (latest on registry, modified 2026-08-13) | Typo-tolerant title matching with `indexes` for highlighting | Purpose-built; scores exact/substring/word-start above scattered subsequence, which is what D-08 requires; `highlight(cb)` returns React nodes |

`fuzzysort` is NOT a direct dependency today. `fuzzysort@3.1.0` exists in `package-lock.json` only as a transitive dep of a dev CLI (shadcn tooling, lockfile L9159) - do not import that. Install `fuzzysort@^4` as a direct dependency.

v4 API (from official README, github.com/farzher/fuzzysort): `go(search, targets, {key|keys, limit, threshold, scoreFn})`, `single(search, target)`, `prepare()`, `snapshot()`; result has `score` (1 perfect .. 0 none), `target`, `indexes[]`, `highlight(open, close | cb)`. v4 is ESM-only, removed `options.all` (empty search returns results), added default `threshold`/`limit`. [CITED: github.com/farzher/fuzzysort]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react (installed) | - | `Archive`, `GitMerge`, `SearchX` icons | Include-closed item, empty state |
| `CachedAvatar`, `IssueTypeIcon`, `statusPillClass`, `epicColorToTailwind`, `Skeleton` | in repo | Row building blocks | Per UI-SPEC; do not re-implement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fuzzysort | fuse.js 7.5.0 | Heavier scoring config; no exact/word-start boost without tuning; returns match ranges via option. Pick only if fuzzysort ESM interop with Vite/vitest misbehaves |
| fuzzysort | hand-rolled subsequence scorer | Rejected - D-08 tuning (word-start, threshold, long-title noise) is exactly the deceptively complex part |

**Installation:**
```bash
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm install fuzzysort@^4
```

**Version verification:** `npm view fuzzysort version` -> 4.0.2, no `scripts.postinstall`, repo github.com/farzher/fuzzysort, first published 2017-08-18, 78 KB unpacked. [VERIFIED: npm registry]

## Package Legitimacy Audit

slopcheck could not be run (no `pip` on this machine). Per protocol the package is not tagged VERIFIED by tool; evidence is registry age (9 years), maintainer, source repo, absence of postinstall, and presence (3.1.0) in the project's existing lockfile.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| fuzzysort | npm | ~9 yrs (2017-08) | not checked | github.com/farzher/fuzzysort | unavailable [ASSUMED] | Approved with one `checkpoint:human-verify` before install (planner gate) |

**Packages removed due to slopcheck [SLOP]:** none
**Packages flagged [SUS]:** none (slopcheck unavailable -> planner adds a single human-verify checkpoint before `npm install fuzzysort`)

## Architecture Patterns

### System Architecture Diagram

```
 keystroke ──► query state ─────────────────────────────────────────────┐
     │                                                                   │
     │ (open && boardId)                                                 ▼
     ▼                                                    ┌─────────────────────────┐
 useBoardId ─► useQuery(['gh-backlog',boardId]) ─────────►│ buildSearchIndex()      │ useMemo on data
   (store id    staleTime 5min, enabled:open,             │  entries[]: key,title,  │
    or fetch)   same fetcher as BacklogPage               │  type,status,assignee,  │
                                                          │  epic{key,name,color},  │
 passive useQuery(['gh-all-data',boardId],enabled:false)─►│  tierRank,tierLabel     │
   (active-sprint subtasks, if already cached)            └───────────┬─────────────┘
                                                                      │
 trimmed ≥2 ──► matchTitle(fuzzysort, per-token) ◄────────────────────┘  SYNC, no debounce
     │                    │ title hits (+ indexes for <mark>)
     │ 300ms debounce     ▼
     └──► useQuery(['search','body',q,project,scope]) ──► searchJiraBody (JQL text ~ ...)
              placeholderData: keepPreviousData               │ JiraIssue[] w/ description
                                                              ▼
                              classifyBodyHit(): desc contains q? → 'description' : 'comment'
                                                              │
                         merge/dedupe by key (title hit wins) ▼
                                          groupBySubtasks() → rankGroups() (tier, field, score)
                                                              │
   key pattern ──► index lookup ─miss─► fetchJiraIssueByKey   ▼
        └──────────────────► "Direct match" pinned      <CommandGroup per tier> + MRs/Nav/Actions
                                                         (Command shouldFilter={false})
```

### Recommended Project Structure
```
taskflow/src/
├── lib/global-search.ts            # pure: index, match, rank, group, snippet, highlight ranges
├── lib/global-search.test.ts
├── components/app/CommandPalette.tsx            # orchestration + render (upgraded in place)
├── components/app/CommandPalette.test.tsx       # rewrite/extend
├── components/app/SearchResultRow.tsx           # one-line row + HighlightedText (optional split)
├── hooks/useGlobalSearchIndex.ts   # board id + backlog cache subscription + index memo
└── services/jira.ts                # + searchJiraBody()  (legacy file; add scoped fetcher)
```

### Pattern 1: Index built from the raw envelope (no adapter needed)
Use `buildEntityMaps`, `resolveStatus`, `resolveType`, `resolveEpic` from `services/jira/greenhopper/entityMaps.ts` directly on `GhBacklogResponse`; do not run `createAdapter` (needs `storyPointsFieldKey`, irrelevant here).
- Sprint tier: reverse index `issueId -> sprint` from `sprints[].issuesIds`, restricted to `ACTIVE`/`FUTURE` (same BL-01 rule as BacklogPage L424-436). Tier order = position in `sprints[]` (first ACTIVE = Current; first FUTURE = "(next)"; later FUTURE in array order). Issues with no ACTIVE/FUTURE membership = Backlog tier.
- If an issue is in several open sprints, take the lowest tier rank.
- Epic: `gh.epicId` -> `resolveEpic()` gives `{key,name,color}`; feed `color` to `epicColorToTailwind(color, key)`.
- Status: `resolveStatus(gh.statusId).name` + category key (apply the `gh.done` override as `adaptIssue` does).
- Drop `gh.done` entries from the default set (D-01). Consider also filtering `hidden` only if BacklogPage does (it does not appear to; verify before adding).
- Fixture reality check: FUTURE sprints include planning buckets named "Ready to plan", "Ready to refinement", "Technicky dlh" - they will appear as tier headers. This is per D-05/D-06, but the "(next)" suffix goes to the FIRST FUTURE in array order whatever its name.

### Pattern 2: Cold-cache fetch without BacklogPage
`useGhBacklogData` is gated on `useIsActiveRoute('/backlog')` (also requires Router context). Options (pick A):
- **A (recommended):** add an additive option to the shared hook, e.g. `useGhBacklogData(boardId, { ignoreRoute: true, enabled: open, staleTime })`. Same key, same `fetchBacklogData`; BacklogPage call site unchanged.
- B: palette-local `useQuery({ queryKey:['gh-backlog',boardId], queryFn:()=>fetchBacklogData(...), enabled: open && ... })`. Equivalent, duplicates the token handling.
Token: the hook reads `readSecret('jira-pat')` in an effect keyed on `jiraBaseUrl`; board id via `useBoardId(jiraBaseUrl, jiraToken, activeJiraProject)` (store override first, discovery query `['jira-board-id', project, baseUrl]`).
**Jira-load rule:** the palette observer must use a long `staleTime` (e.g. 5 min) and `refetchOnWindowFocus: false`; the shared default is 30 s (`STALE_TIME_MS`), which would re-download the ~226-issue envelope on nearly every palette open. `enabled: open` ensures nothing runs while closed (the component stays mounted in `main.tsx`; hooks run before the `if (!open) return null`).

### Pattern 3: Field tiers and grouping (pure functions)
```typescript
type FieldTier = 0 | 1 | 2;            // title | description | comment
interface Hit { key: string; field: FieldTier; score: number; indexes?: number[]; }
// Group sort key (ascending): [tierRank(parent), groupField, -score, sequence]
// groupField = parentOwnHit ? parentOwnHit.field : min(childHit.field) + 1   // D-07
```
- Subtask belongs to `parentKey`'s tier. If the parent is not in the index (not cached, e.g. Jira-only hit) -> try parent's tier from `fields.parent.key`; if still unknown, render as standalone row in Backlog tier, no indent (UI-SPEC "parent unknown").
- Unknown-tier issues returned by Jira (epics, issues created since cache, issues in boards not shown): default to **Backlog** tier. Epics are not in the backlog `issues[]`, so they only surface via the body request.
- De-dupe: index entry wins over Jira row for display fields (assignee/status are fresher in neither; Jira row is fresher actually - prefer Jira row for status/assignee when both exist, but keep tier from the index).
- A subtask must never be duplicated across tiers (UI-SPEC).

### Pattern 4: cmdk with externally ranked results
- Set `<Command shouldFilter={false} loop>`; cmdk then does not filter/sort (verified in cmdk source semantics: `filterItems` early-returns when `shouldFilter === false`), so DOM order == rank order. Nav/Actions/MR filtering must be done explicitly (D-16): e.g. `label.toLowerCase().includes(q)` or fuzzysort over label+keywords; MRs on `!iid`/title.
- cmdk still re-selects the first item when the search string changes; for the "no jump on merge" rule control selection: `<Command value={selected} onValueChange={setSelected}>` and give every `CommandItem` a unique `value` (the issue key; prefix `closed:`/`direct:` is NOT needed if keys are de-duplicated across tiers). Reset `selected` to first row on query change only. [ASSUMED: cmdk 1.1.1 controlled value behaviour on item unmount - confirm in a component test]
- `CommandItem` (components/ui/command.tsx L137) always renders a trailing `CheckIcon ml-auto opacity-0` that takes 16px + gap in every row. For one-line compact rows hide it: `className="[&>svg:last-child]:hidden ..."` on issue rows. Also default `py-1.5` -> pass `py-1` (tailwind-merge overrides).
- `CommandList` default `max-h-72` -> pass `max-h-[70vh]`. Panel `max-w-xl` -> `max-w-3xl`.
- `CommandEmpty` only shows when cmdk's own count is 0; with `shouldFilter={false}` cmdk counts mounted items, so it still works, but the empty state must also be suppressed while body request is in flight (UI-SPEC) - render your own empty state conditionally instead of relying on `CommandEmpty`.

### Pattern 5: New scoped Jira fetcher
```typescript
// services/jira.ts - NEW; do not touch searchJira / searchJiraClosed (other consumers)
export async function searchJiraBody(baseUrl, token, opts: {
  projectKey: string; query: string; scope: 'open' | 'closed';
  epicLinkFieldKey: string; maxResults?: number;
}): Promise<JiraIssue[]> /* THROWS on !ok / network so UI can show the error row */
// JQL: project = "KEY" AND statusCategory != Done AND (sprint in openSprints() OR sprint in futureSprints() OR sprint is EMPTY)
//      AND text ~ "<escaped tokens>*"  ORDER BY updated DESC
// fields: summary,status,assignee,issuetype,parent,description,<epicLinkFieldKey>   maxResults: 50
```
- `searchJira`/`searchJiraClosed` swallow all errors and return `[]`, so the UI-SPEC error row ("Couldn't search descriptions and comments...") is impossible with them. The new function must throw; react-query exposes `isError`.
- Whether a subtask carries a Sprint value of its own varies by Jira config. [ASSUMED] To avoid silently losing subtasks, prefer a JQL that does not depend on subtask sprint membership: drop the sprint clause (`project = X AND statusCategory != Done AND text ~ ...`) and tier client-side; unknown-tier issues fall to Backlog. Planner should pick one; recommended = **no sprint clause** (simpler, subtask-safe), accepting that issues in neither cache nor open sprints (rare: not-done issues only in a closed sprint) may appear in Backlog tier. Confirm with a live probe (project's Jira is Server/DC: Bearer PAT, `/rest/api/2/search`).
- Escape/sanitise the user's text: existing code only escapes `"`. Atlassian docs: reserved characters (`* ? + / # @ [ ]` etc.) need quoting or double-backslash escaping in text searches. [CITED: confluence.atlassian.com/jirasoftwareserver/search-syntax-for-text-fields]. Recommended: split query into word tokens, strip/escape reserved chars per token, append `*` to the LAST token only (prefix match; Jira text search is word/stem based so a partial word otherwise misses), join tokens with space inside one quoted-or-AND'd expression. Multi-term default operator (AND vs OR) is not documented on that page [ASSUMED: AND]; to be deterministic emit `text ~ "t1*" AND text ~ "t2*"`. Leading wildcards are not supported - never prefix `*`.
- Key-looking input ("SHOP-412") - hyphen is a Lucene operator; if query matches the key pattern skip the body request or quote it (`text ~ "\"SHOP-412\""`); the Direct-match path handles keys.
- `text ~` covers summary, description, comments, environment, and Free Text custom fields [CITED: same page] - so a hit may be due to a custom field; D-04's "assume comment" is therefore approximate. Accept; document in tag semantics.
- maxResults 50 (default sort `updated DESC`; re-ranked locally). Epic link field is configurable (`useSettingsStore().epicLinkFieldKey`, default `customfield_10014`) - do not hardcode.

### Anti-Patterns to Avoid
- **Fetch-once page-cap + client filter** (recurring bug): do not search a capped server page client-side. Here the split is explicit: the full backlog cache is the local source (not capped: ~226 issues in one envelope, `supportsPages: true` flag exists but BacklogPage consumes a single response), and everything else goes to the server with the query. Never treat the body request's 50 results as "the" body index.
- Reading `queryClient.getQueryData()` in render (current code does for sprint board, MRs): replace the index with `useQuery`; for MRs use a passive `useQuery` with `enabled:false` per key or `useQueries`, or subscribe via `queryClient.getQueryCache().subscribe`. Memory: "Reactive cache-read badge".
- Putting `shouldFilter` default on while also pre-sorting: cmdk will re-sort by its own score and destroy tier order.
- Using `<mark>` default browser yellow style: UI-SPEC requires underline-only (`bg-transparent text-inherit underline decoration-primary/60 underline-offset-2`).
- Hover/selection affordances that take width (CheckIcon above).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy/typo scoring + match indexes | Custom subsequence scorer | `fuzzysort` v4 (`go`/`single`, `indexes`) | Word-start/substring boosts and threshold already tuned |
| Palette keyboard/a11y/listbox | Custom list navigation | cmdk primitives in `components/ui/command.tsx` | Existing; PEEK-05 key-button pattern depends on it |
| Epic colours | New colour map | `epicColorToTailwind(color, key)` | Handles `ghx-label-N`, hex, hash fallback |
| Status pill / avatar / type icon | New components | `statusPillClass` (+flex parent), `CachedAvatar size={20}`, `IssueTypeIcon` | UI-SPEC |
| Board id resolution | New discovery | `useBoardId` | Honours stored per-project board (FB8-3) |
| Entity resolution | Re-deriving status/type/epic | `entityMaps.ts` resolvers | Already warn-once safe |
| Query cache subscription | Manual listeners | `useQuery` / `useQueries` | Memory gotcha |

**Key insight:** ranking/grouping are pure functions over plain arrays - keep every ordering rule in `lib/global-search.ts` so the D-05/D-07/D-08 rules are unit-testable without React.

## Common Pitfalls

### Pitfall 1: Backlog hook never fetches off `/backlog`
**What goes wrong:** Palette shows "Loading issues..." forever on Dashboard/Sprint Board if BacklogPage was never visited (and Sidebar hover-prefetch did not fire).
**Why:** `enabled: isActive && ...` in `useGhBacklogData`; also needs Router context (`useLocation`).
**Avoid:** additive hook option (Pattern 2A). **Warning sign:** palette test passes with `ensureQueryData` mocks but manual test from `/dashboard` is empty.

### Pitfall 2: Subtasks absent from the index
**What goes wrong:** D-13 grouping never triggers locally; subtask title matches only appear after the 300 ms debounce + request.
**Avoid:** treat subtasks as a Jira-sourced (and optionally `['gh-all-data']`-sourced) population; run the same title matcher on their `summary` so they get the correct field tier (title if summary matches, else description/comment via D-04). Make sure the UI shows the parent from the index (dimmed context header) when only a child matched.

### Pitfall 3: Done issues leak into the default set
Cache includes done issues of the active sprint. Filter `gh.done` (or category done) from default tiers; show only in Closed tier when included. Also dedupe: an issue in the Closed (Jira) response that is also in the index (done) must appear once, in Closed.

### Pitfall 4: Rows jumping when body results arrive
Body hits are always lower field-tier than title hits within the same sprint tier (D-05) but can insert in HIGHER sprint tiers than the cursor. Controlled cmdk `value` keyed by issue key keeps selection; don't reset selection when only `bodyResults` changes. Use `keepPreviousData` but clear stale body results when the debounced query differs from the current query by more than the in-flight window, otherwise old-query rows linger (match fields will be re-classified locally so stale rows without local match must be hidden: only render a body hit if `trimmed`-based D-04 classification is consistent, or accept lingering until response - recommend hiding body rows whose request query !== debounced current query via `isPlaceholderData`).

### Pitfall 5: Fuzzy noise on long titles
fuzzysort will match scattered letters across long titles. Set `threshold` (start ~0.3-0.5, tune via fixture titles), require every whitespace token to match, and compute a bonus tier: exact substring > word-start > fuzzy. Unit-test with titles from the real fixture (sanitised titles are "Sample summary N" - build synthetic cases).

### Pitfall 6: cmdk value collisions / case
cmdk derives item identity from `value`. Duplicate values across groups merge selection. Use the issue key (unique, de-duplicated). [ASSUMED: cmdk 1.x does not lowercase `value`; keys are uppercase either way - if lookup by value is used for selection state, compare case-insensitively.]

### Pitfall 7: Existing tests mock narrow stores
`CommandPalette.test.tsx` mocks `@/services/jira` with only `searchJira/searchJiraClosed/fetchJiraIssueByKey`, `settings.store` with only `theme/setTheme/storyPointsFieldKey` and `auth.store` with `jiraBaseUrl/gitlabBaseUrl/activeJiraProject`. New code reads `epicLinkFieldKey`, `jiraBoardIds`, uses `useBoardId`, router hooks (via shared hook) and `readSecret`. Update mocks (or inject index via a mockable hook `useGlobalSearchIndex`) in the same commit as the code, else the pre-commit full suite blocks.

### Pitfall 8: Container query on the container itself
Narrow-width degradation (<560px): put `@container` on an inner wrapper, children use `@[560px]:` variants (memory: Container query not on self).

### Pitfall 9: Flex shrink priority
Title must shrink first; follow memory "BacklogRow flex-shrink priority" (`flex-[0_100_auto]`, no `min()` in WebKit, no max-w caps on badges). Avatar `flex-none w-5` (0-width collapse gotcha).

## Code Examples

### Match + highlight ranges with fuzzysort (verify spike in Wave 0)
```typescript
// Source: github.com/farzher/fuzzysort README (v4)
import fuzzysort from 'fuzzysort';

const prepared = entries.map((e) => ({ ...e, p: fuzzysort.prepare(e.summary) }));
const res = fuzzysort.go(token, prepared, { key: 'p', threshold: 0.3, limit: 200 });
// res[i].score (0..1), res[i].indexes (char positions), res[i].obj (entry)
```
Multi-word queries: README does not document multi-token behaviour for v4 [ASSUMED] - implement per-token matching in `global-search.ts` (all tokens must match; score = mean; indexes = union), covered by unit tests.

### Contiguous index runs -> marks (cap 6)
```typescript
export function runsFromIndexes(idx: number[], max = 6): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (const i of [...idx].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && i <= last[1]) { last[1] = Math.max(last[1], i + 1); continue; }
    if (last && i === last[1]) { last[1] = i + 1; continue; }
    runs.push([i, i + 1]);
  }
  return runs.slice(0, max);
}
```

### Snippet (UI-SPEC: ~48 chars each side, collapse whitespace)
```typescript
export function buildSnippet(text: string, term: string, radius = 48) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = flat.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return null;
  const s = Math.max(0, at - radius), e = Math.min(flat.length, at + term.length + radius);
  return { text: `${s > 0 ? '…' : ''}${flat.slice(s, e)}${e < flat.length ? '…' : ''}`, matchStart: at - s + (s > 0 ? 1 : 0), matchLen: term.length };
}
```
Jira `description` is wiki markup (`h2.`, `{code}`, `[~user]`, `!img!`): strip obvious markup before snippeting, or accept raw. Existing helper candidates: check `WikiRenderer` utilities / `issueDisplayUtils.ts` for a plain-text stripper before writing one [ASSUMED none exists].

### Debounced body query (extends existing pattern)
```typescript
const { data: body, isError: bodyError, isFetching: bodyLoading } = useQuery({
  queryKey: ['search', 'body', debouncedQuery, activeJiraProject, includeClosed],
  queryFn: ({ signal }) => searchJiraBody(jiraBaseUrl!, token!, { projectKey: activeJiraProject!, query: debouncedQuery, scope: 'open', epicLinkFieldKey }),
  enabled: open && debouncedQuery.length >= 2 && !!jiraBaseUrl && !!activeJiraProject && !!token,
  staleTime: 60_000,
  placeholderData: keepPreviousData,
});
```
Separate query key `scope:'closed'` for the Include-closed request (replaces `closedSearchTriggered`). Remove `liveSearch*` state and the `['search','live'|'text'|'closed']` keys.

## State of the Art

| Old (current palette) | New | Impact |
|-----------------------|-----|--------|
| cmdk filter + sort | `shouldFilter={false}` + own ranking | Ordering contract D-05/D-07 |
| Imperative cache reads in render | `useQuery`-subscribed index | Reactive on cold-cache fill |
| Two error-swallowing 20-row searches | One throwing 50-row scoped search + local title index | Error row possible; fewer requests |
| `max-w-xl`, `max-h-[300px]` | `max-w-3xl`, `max-h-[70vh]` | D-09 |
| fuzzysort v3 (UMD, transitive only) | v4 ESM direct dep | Check Vite/vitest import works |

## Runtime State Inventory
Not a rename/refactor/migration phase - omitted. (No stored data, service config, OS state, secrets, or artifacts carry search state; `['search', ...]` query keys are in-memory only.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fuzzysort` passes slopcheck (tool unavailable); trusted on registry age/repo/lockfile presence | Package Legitimacy | Low; human-verify checkpoint gates install |
| A2 | Multi-word `text ~ "a b"` default operator is AND; we emit explicit ANDs anyway | Pattern 5 | Low |
| A3 | Subtasks may not carry their own Sprint value, so recommend no sprint clause in JQL | Pattern 5 | Medium: with sprint clause, subtask hits could be silently missing; probe live |
| A4 | cmdk 1.1.1 controlled `value` keeps selection by item value when other items mount/unmount | Pattern 4 | Medium: rows could jump; test in jsdom + manual |
| A5 | cmdk 1.x does not lowercase item `value` | Pitfall 6 | Low |
| A6 | fuzzysort v4 has no documented multi-token search; implement per-token | Code Examples | Low |
| A7 | No existing wiki-markup-to-plain-text helper | Code Examples | Low (duplicate work only) |
| A8 | Leading wildcards unsupported in Jira text search | Pattern 5 | Low (never emitted) |
| A9 | `text ~` can match custom Free Text fields, so "comment" tag is an approximation (D-04 accepted) | Pattern 5 | Low, user accepted inference |

## Open Questions

1. **Subtask sourcing (D-02 vs D-13).**
   - Known: backlog envelope has 0 subtasks; `['gh-all-data', boardId]` has them for the active sprint if cached.
   - Unclear: whether user accepts non-instant subtask title hits.
   - Recommendation: use both: passive read of `gh-all-data` for instant active-sprint subtasks (no extra fetch), Jira body request for the rest. Flag to user in plan as a deviation from "title tier = backlog cache only".
2. **Done issues in the active sprint** - drop from default tiers (recommended, per D-01) or show in Current sprint? Recommend drop + Closed tier on demand.
3. **JQL sprint clause** - include or omit (A3). Recommend omit and tier client-side; verify with a live probe.
4. **Per-tier cap** - UI-SPEC says 8 per tier + "+N more" row (expands in place) and 40 total. Expansion state must be keyed by tier id and reset on query change.
5. **MR source** - passive `gitlab-mrs` caches only (as today); `queryClient.getQueriesData` imperative read should become reactive (`useQueries`/cache subscription) or at minimum re-read when `open`/`query` change. Low risk but note.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm | install fuzzysort, vitest | yes | npm registry reachable | - |
| fuzzysort | fuzzy title tier | not a direct dep (3.1.0 transitive in lockfile) | 4.0.2 on registry | fuse.js 7.5.0 |
| pip / slopcheck | legitimacy gate | no (`pip` not found) | - | human-verify checkpoint |
| ctx7 / Context7 | docs | not checked (WebFetch of official README used instead) | - | - |
| Live Jira | probing JQL (A3) | not available to research | - | planner adds a manual verification step |

**Missing with fallback:** slopcheck (-> human-verify checkpoint), live Jira (-> manual UAT check of subtask/JQL).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18, jsdom, `@testing-library/react` ^16.3.2, `user-event` ^14.6.1 |
| Config file | `/Users/mimo/Documents/Projects/taskflow/taskflow/vitest.config.ts` (globals, setup `src/test/setup.ts`, `@` alias) |
| Quick run command | `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/global-search.test.ts src/components/app/CommandPalette.test.tsx` |
| Full suite command | `cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm test` (also run by pre-commit with biome + tsc) |

### Phase Requirements -> Test Map
| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| D-01 | Index excludes done issues; Closed tier only when included | unit | `npx vitest run src/lib/global-search.test.ts -t "closed"` | Wave 0 |
| D-02 | Title hits render with no Jira request; body request fires once after debounce | component | `npx vitest run src/components/app/CommandPalette.test.tsx -t "body"` | Wave 0 |
| D-03 | Palette fetches `['gh-backlog']` when cold and not on /backlog route | component/hook | `npx vitest run src/hooks/useGlobalSearchIndex.test.tsx` | Wave 0 |
| D-04 | desc vs comment inference from fetched description | unit | `-t "field tier"` | Wave 0 |
| D-05 | Current-sprint comment beats backlog title; tier order Current > next > later > Backlog > Closed | unit | `-t "tier order"` | Wave 0 |
| D-06 | Tier headers rendered, empty tiers omitted, "(next)" suffix | component | `-t "tier headers"` | Wave 0 |
| D-07 | Group rank: parent own hit vs child-only (+1 field step); subtask under parent's tier; no duplicate | unit | `-t "grouping"` | Wave 0 |
| D-08 | Typo match found; exact/word-start outranks scattered fuzzy; threshold drops noise | unit | `-t "fuzzy"` | Wave 0 |
| D-09 | Panel `max-w-3xl`, list `max-h-[70vh]` | component | `-t "geometry"` | Wave 0 |
| D-10 | Row anatomy: icon, key, title, epic badge (stories only), status pill, avatar; single line | component | `-t "row"` | Wave 0 |
| D-11 | Snippet + `desc`/`comment` tag for body hits; comment hit has tag, no snippet text | unit+component | `-t "snippet"` | Wave 0 |
| D-12 | `<mark>` ranges on title and snippet; max 6 | unit | `-t "highlight"` | Wave 0 |
| D-13 | Dimmed unhighlighted parent + indented matching subtasks, siblings hidden | component | `-t "context header"` | Wave 0 |
| D-14 | Same hotkey / props contract; no CommandDialog | existing tests | `npx vitest run src/components/app/CommandPalette.test.tsx` | exists (must update mocks) |
| D-15 | No "Search Jira for" item; "Include closed issues" item present | component | `-t "include closed"` | Wave 0 |
| D-16 | MRs/Nav/Actions only render when matching query | component | `-t "filters MRs"` | Wave 0 |
| D-17 | Key/bare-number direct match from index first; fetch only on miss | component | `-t "direct match"` | partly exists (key pattern tests) |
| D-18 | <2 chars shows Recent Items + Navigation only | component | existing `default state` tests | exists |
| Jira fetcher | `searchJiraBody` builds JQL (escape, last-token wildcard, scope), throws on !ok | unit | `npx vitest run src/services/jira.test.ts -t "searchJiraBody"` (check actual file name) | Wave 0 |

### Sampling Rate
- **Per task commit:** quick run command above (pre-commit runs full suite anyway).
- **Per wave merge:** `npm test` + `npx biome check` on touched files + `npx tsc --noEmit`.
- **Phase gate:** full suite green, then manual UAT (below) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/global-search.test.ts` - pure ranking/grouping/matching (use synthetic `GhBacklogResponse` built from `__fixtures__/data.real.json` plus hand-added subtasks; real fixture has none)
- [ ] `src/hooks/useGlobalSearchIndex.test.tsx` - cold-cache fetch off-route (needs MemoryRouter if shared hook reused)
- [ ] fuzzysort ESM import spike inside vitest (confirm jsdom + vite resolves v4)
- [ ] Update `CommandPalette.test.tsx` mocks (settings `epicLinkFieldKey`, auth `jiraBoardIds`, `useBoardId`, new fetcher); `scrollIntoView`/`ResizeObserver` polyfills already present
- [ ] Framework install: only `fuzzysort`

Manual-only (justify): live-Jira behaviour of `text ~` wildcard/AND semantics, subtask sprint membership, visual density/one-line at 560px and 768px (WebKit/Tauri), dimmed-row contrast. Put in UAT checklist.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (reuses stored Bearer PAT via `readSecret('jira-pat')`) | existing Stronghold |
| V3 Session Management | no | - |
| V4 Access Control | no | Jira enforces per-user visibility |
| V5 Input Validation | yes | Escape/sanitise query before embedding in JQL (quotes, backslashes, Lucene/JQL reserved chars); project key from store, quoted |
| V6 Cryptography | no | - |
| Output encoding | yes | Render highlights via React nodes/`<mark>` elements built from index ranges - never `dangerouslySetInnerHTML` with description/summary text (Jira description is user-controlled) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JQL injection via search text | Tampering | Tokenise, strip/escape reserved chars, quote; never concatenate raw input (existing code only escapes `"`) |
| XSS via description snippet / `fuzzysort.highlight` HTML string | Tampering | Use callback form returning React elements, not the string form with `innerHTML` |
| Token leakage in logs | Info disclosure | Use `apiFetch` as existing fetchers do; no new logging of Authorization |

## Sources

### Primary (HIGH confidence)
- Codebase (read this session): `CommandPalette.tsx`, `CommandPalette.test.tsx`, `components/ui/command.tsx`, `services/jira.ts` (searchJira/searchJiraClosed/searchJiraForLink/fetchJiraIssueByKey ~L1495-1616, L2030), `useGhBacklogData.ts`, `useGhAllData.ts` (key), `greenhopper/types.ts`, `adapter.ts`, `entityMaps.ts`, `data.ts`, `hooks/useBoardId.ts`, `hooks/useIsActiveRoute.ts`, `lib/epicColors.ts`, `lib/statusStyles.ts`, `lib/query-constants.ts`, `BacklogPage.tsx` (L360-500, L694), `Sidebar.tsx` prefetch, `__fixtures__/data.real.json` + `allData.real.json` (counts computed)
- github.com/farzher/fuzzysort README (v4 API, changelog) via WebFetch
- npm registry: `npm view fuzzysort` (4.0.2, modified 2026-08-13, no postinstall), `npm view fuse.js` (7.5.0)

### Secondary (MEDIUM confidence)
- confluence.atlassian.com/jirasoftwareserver/search-syntax-for-text-fields (reserved characters, text field coverage; does not specify operator default or leading wildcard)

### Tertiary (LOW confidence)
- cmdk 1.1.1 internal behaviour (`shouldFilter=false`, controlled value, value casing) from memory of cmdk source - not re-read this session (A4, A5)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH - fuzzysort API from official README; slopcheck unavailable
- Architecture: HIGH - based on actual source; three CONTEXT contradictions found and resolved with recommendations
- Pitfalls: MEDIUM-HIGH - code-verified except cmdk internals and Jira text semantics

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable stack; re-check fuzzysort version at install)
