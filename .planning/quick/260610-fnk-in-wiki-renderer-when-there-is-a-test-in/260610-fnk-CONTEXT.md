# Quick Task 260610-fnk: Issue-key linking in wiki renderer - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Task Boundary

In the wiki renderer, when there is an issue key in the format `PROD-123`, it should
become a clickable link to that issue. If the referenced issue is in a "done" status,
its rendered text should be crossed out (strikethrough).

</domain>

<decisions>
## Implementation Decisions

### Status data source — how we know if a key is "done"
- **Fetch on demand.** Resolve each detected key's status to drive strikethrough.
- Cache-first: check the React Query cache (`findJiraIssueInCache` / `getQueryData`)
  before issuing any request — only fetch statuses for keys not already cached.
- Deduplicate keys within a document so each unique key is resolved at most once.
- Resolution is async and must NOT block the initial render; strikethrough is applied
  when status arrives (link renders immediately, strikethrough may appear a beat later).

### Which keys to linkify — false-positive avoidance
- **Known prefixes only — and "known" = the active Jira project only.**
  There is no persisted app-wide project list (research Q1); the only persisted
  project state is `auth.store.activeJiraProject` (a single key). So linkify ONLY
  keys whose prefix equals `activeJiraProject`. No new fetch path is introduced.
- Keys for any other prefix stay as plain text. This also avoids false positives
  like `COVID-19`, `UTF-8`, `ISO-8601`.
- Use the app's canonical issue-key pattern (`\b[A-Z][A-Z0-9_]+-\d+\b`) for matching,
  then filter by `prefix === activeJiraProject`.
- Isolate the decision behind an `isKnownPrefix(key)` helper so it can be widened
  later (e.g. to a cached `['jira-projects']` query) without touching call sites.

### Unknown / unresolved keys
- **Clickable link, no strikethrough.** Always render a working link to `/issue/KEY`
  for keys with a known prefix; apply strikethrough only when we positively know the
  issue's status category is `done`. Clicking navigates and loads the issue normally.

### Claude's Discretion
- Exact integration point in the WikiRenderer pipeline (preprocessing regex vs.
  react-markdown text/component override) — pick the cleanest hook that does not
  break existing URL/mention linkification.
- Where the project-prefix list comes from (existing projects store / query) — reuse
  whatever canonical source already exists; do not introduce a new fetch path if one exists.
- How statuses are fetched on demand (existing issue-detail query hook vs. a light
  status query) — prefer reusing the existing issue-detail query/cache key so results
  are shared with the rest of the app.
- Whether matching runs inside code blocks/inline-code — should NOT linkify inside
  code spans/blocks (treat as literal text).

</decisions>

<specifics>
## Specific Ideas

Existing infrastructure to reuse (from codebase scouting):
- `WikiRenderer.tsx` (`src/routes/dashboard/WikiRenderer.tsx`) — preprocessing +
  jira2md + react-markdown with custom `<a>` component override (lines ~1091-1142).
- Canonical issue-key pattern: `[A-Z][A-Z0-9_]+-\d+` (see `internalLinks.ts` `tryInternalPath`).
- Navigation: `navigate('/issue/{KEY}')`, route `/issue/:key` (routes.tsx). Existing
  `<a>` handler already does `breadcrumbPush(deriveSourceCrumb(...))` before navigating.
- `isDoneStatus(statusCategory)` and `doneSummaryClass(...)` (`src/lib/issueDisplayUtils.ts`)
  — returns `'line-through'` when `statusCategory.key === 'done'`.
- Issue cache: React Query keys `['jira-issue-detail', issueKey, jiraBaseUrl]` and
  `['jira-issues']`; cache lookup helper `findJiraIssueInCache()`.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Reuse in-repo
helpers (`isDoneStatus`, `doneSummaryClass`, `tryInternalPath`, issue-detail query).

</canonical_refs>
