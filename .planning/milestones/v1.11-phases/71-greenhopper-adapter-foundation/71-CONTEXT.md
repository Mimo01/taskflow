# Phase 71: GreenHopper Adapter Foundation - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the typed GreenHopper API client + adapter layer that every later phase in v1.11 consumes. Ships:

- Typed fetchers for `allData.json`, `data.json`, `details.json`, `transitions.json` against `/rest/greenhopper/1.0/xboard/*`.
- Entity-map resolver helpers turning `statusId` / `priorityId` / `typeId` / `epicId` into the existing app `Status` / `Priority` / `Type` / `Epic` values.
- `adaptIssue(ghIssue, entityMaps)` returning a `JiraIssue`-compatible object so existing sprint-board / backlog / detail consumers keep working.
- Unit tests with both real-capture fixtures and handwritten edge fixtures.

**Out of scope:** No UI changes, no consumer call-site swaps, no cache layer, no caching policy for `transitions.json` (that's Phase 72). No deletion of REST paths in this phase.

</domain>

<decisions>
## Implementation Decisions

### Adapter Target Shape
- **D-01:** `adaptIssue(ghIssue, entityMaps)` returns a **`JiraIssue` superset** — drop-in for the existing `JiraIssue` interface in `src/services/jira.ts:139` (synthesize `fields.status`, `fields.assignee`, `fields.issuetype`, `fields.customfield_10016`, `fields.summary`, `fields.subtasks?`, `fields.parent?` from entity maps) **plus** GH-only props exposed at the top level for new code: `timeInColumn?`, `color`, `flagged`, `done`. Rationale: matches the milestone's hard-cutover-per-surface policy — phases 72-75 become path swaps without touching ~60 callers; GH-only fields stay available natively.
- **D-02:** `customfield_10016` (story points) is synthesized from `estimateStatistic.statFieldValue.value` only when `estimateStatistic.statFieldId` matches the project's story-points field id (resolve via existing field-discovery code in `src/services/jira.ts`); otherwise the field stays `null` (the legacy REST shape's `null` sentinel).
- **D-03:** `fields.status.statusCategory.key` is mapped from `entityData.statuses[id].status.statusCategory.key` to the existing `'new' | 'indeterminate' | 'done'` literal union; if `done === true` on the GH issue and the resolved category disagrees, prefer the GH `done` flag.

### Module Layout & Imports
- **D-04:** New code lives at `src/services/jira/greenhopper/` following the existing module-folder pattern: `client.ts` (private greenhopperFetch over `apiFetch('jira', ...)`), `types.ts` (GH response types), `allData.ts`, `data.ts`, `details.ts`, `transitions.ts`, `entityMaps.ts`, `adapter.ts`, `index.ts` (public barrel), plus colocated `*.test.ts` files and `__fixtures__/`.
- **D-05:** The public surface is re-exported through **`src/services/jira.ts`** (the legacy dual-file) — phases 72-75 import `fetchAllData`, `fetchBacklogData`, `fetchIssueDetails`, `fetchGhTransitions`, `adaptIssue`, `buildEntityMaps` from `services/jira`, matching the existing 60-imports-via-jira.ts convention. Rationale: the dual-file gotcha is real; don't fight it for this phase.
- **D-06:** `client.ts` is **not** re-exported from `jira/greenhopper/index.ts` (private to the folder, matching the `aio/` / `tempo/` convention).

### Entity-Map Resolver Contract
- **D-07:** Required-entity resolvers (`resolveStatus`, `resolvePriority`, `resolveType`) return a **fallback shim** on miss (`{id, name: 'Unknown', statusCategory: {key: 'indeterminate'}}` for status; analogous for priority/type) and emit `console.warn` **once per unique missing id** per session. Rationale: one stale id shouldn't crash the entire board; "Unknown" chips are a self-reporting bug.
- **D-08:** Optional-entity resolvers (`resolveEpic`, `resolveParent`) return `undefined` for both "issue has no id" and "map has no entry" — the existing `JiraIssue.fields.parent?` / epic field is already optional.
- **D-09:** `buildEntityMaps(allDataResponse)` returns a single `EntityMaps` object (`{statuses, priorities, types, epics}`) — pure, no side effects, no in-memory caching at this layer (caching policy is a later-phase decision).

### Fixture Strategy
- **D-10:** **Hybrid fixtures.** One anonymized real-capture per endpoint under `src/services/jira/greenhopper/__fixtures__/` (`allData.real.json`, `data.real.json`, `details.real.json`, `transitions.real.json`). Capture via a one-shot script (`scripts/capture-greenhopper.ts`) that redacts: issue summaries, descriptions, comments, assignee usernames/display names, avatar URLs, issue keys (replace with `PROJ-N`), `epicField.text`. Capture script is committed; outputs are committed.
- **D-11:** Handwritten TS edge fixtures live next to tests for: subtask with `parentId`, issue with `epicId` resolved, issue referencing a missing `statusId` (fallback-shim test), issue with `estimateStatistic.statFieldValue.value` absent, `flagged: true` / `done: true` variants, board with multi-column-per-status mapping.
- **D-12:** Tests use vitest (existing convention). Adapter tests load real captures via `import` (`vitest` handles JSON). Network is never hit in tests.

### Claude's Discretion
The user said "you decide" on all four areas. The decisions above reflect Claude's recommended path, anchored to:
- Existing patterns (`aio/`, `tempo/`, `jira/` folder structure).
- The dual-file `jira.ts` memory note (60 imports — don't fight it this phase).
- The milestone's hard-cutover-per-surface policy (path swaps in 72-75, not consumer rewrites).
- Success criterion #4 requiring real-response fixtures.

The planner has flexibility on:
- Internal naming inside `greenhopper/` (e.g., `entityMaps.ts` vs `resolvers.ts`).
- Whether `greenhopperFetch` takes the rapidViewId explicitly or threads it via an options object.
- Exact `EntityMaps` field names (`statuses` vs `statusById`, etc.) — pick whichever reads best at call sites.
- Whether `console.warn` for D-07 uses a small `warnOnce(key)` helper or a Set guard.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & API surface
- `.planning/research/GREENHOPPER-API.md` — Complete endpoint reference: URL patterns, response shapes for `allData` / `data` / `details` / `transitions`, the `Issue`, `Section`, `Transition` types. This is the source of truth for GH response shapes.
- `.planning/REQUIREMENTS.md` — `GH-ADAPT-01`, `GH-ADAPT-02`, `GH-ADAPT-03` requirement rows.
- `.planning/ROADMAP.md` §"v1.11 GreenHopper API Migration" — Cutover policy and per-phase success criteria.

### Existing code to read
- `src/services/jira.ts:139-173` — `JiraIssue` interface; the adapter output must satisfy this shape.
- `src/services/jira.ts:183-198` — `JiraTransition` interface (compare against GH `Transition` shape; the adapter for `transitions.json` likely produces this REST shape too).
- `src/services/jira/client.ts` — How existing modules call `apiFetch('jira', ...)` with Bearer PAT; greenhopperFetch follows this pattern.
- `src/services/jira/fields.ts` — Story-points field discovery used by D-02.
- `src/services/jira/index.ts` — Existing barrel pattern (no client re-export).

### Project conventions
- Memory: `jira.ts` dual-file gotcha — 60 imports use legacy `jira.ts`, not `jira/` modules. Re-export the GH surface through `jira.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apiFetch('jira', url, init, operation)`** in `src/services/jira/client.ts` — used by every existing jira module + tempo. `greenhopperFetch` is a thin wrapper that prefixes `/rest/greenhopper/1.0/xboard/` and threads `Authorization: Bearer <pat>`.
- **`JiraIssue` / `JiraTransition` types** in `src/services/jira.ts` — adapter outputs target these. Do not redefine.
- **`discoverCustomFields` / story-points field-id resolution** already in `jira.ts` — D-02's adapter uses it to gate `customfield_10016` synthesis.
- **Vitest `*.test.ts` colocated-next-to-source convention** across all 14 existing jira modules.

### Established Patterns
- **Private `client.ts` per service folder** (aio/, tempo/, jira/) — never re-exported from `index.ts`.
- **Bearer PAT shared with REST** — confirmed for Tempo (PITFALLS.md Pattern 1 note); GH uses the same Jira host, same auth.
- **Module-folder pattern** for new services: `client.ts` + `types.ts` + domain files + `index.ts` barrel + colocated tests.

### Integration Points
- `src/services/jira.ts` — re-exports the GH public surface (D-05).
- `src/services/jira/greenhopper/index.ts` — public barrel.
- `scripts/capture-greenhopper.ts` (new) — one-shot capture helper, not bundled into the app.

</code_context>

<specifics>
## Specific Ideas

- Capture script redaction is a hard requirement (committed fixtures must not leak summaries/descriptions/usernames/avatars/issue keys).
- "Unknown" fallback chips for missing entity refs must be visually distinguishable in the existing status/priority/type renderers — but that's a phase 73+ rendering check, not a phase 71 concern (this phase just produces the shape).

</specifics>

<deferred>
## Deferred Ideas

- **Caching policy for `transitions.json`** — belongs in Phase 72 per ROADMAP (GH-TRANS-01: "fetched once per project per session, keyed by `projectId × issueTypeId → workflow → transitions[]`").
- **Caching `allData.json` / `data.json`** — not mentioned in scope; defer to whichever later phase introduces it (likely none for v1.11 — re-fetch on view open is the current pattern).
- **Server-rendered HTML safety / sanitization for `details.json` `Section.html`** — belongs in Phase 75 (issue detail panel rendering).
- **Network-log verification harness** ("exactly one allData.json request") — belongs in Phases 73-75 verification, not this phase.
- **Adapter for `details.json` operations menu / sprint block / tabs** — Phase 71 ships the typed fetcher + base-Issue adapter; the rich details adapter (operations / sprint / tabs) ships in Phase 75 where consumers exist.

</deferred>

---

*Phase: 71-greenhopper-adapter-foundation*
*Context gathered: 2026-05-28*
