# Quick 261014-eym: Deployment package <-> fix version sync - Research

**Researched:** 2026-10-14
**Domain:** Jira DC custom field (issue picker) read/write, release detail, settings
**Confidence:** MEDIUM. The codebase findings are verified. The field's JSON shape, write format, and how RM children hang off their WEEK parent are still unverified (no live Jira access during research).

<user_constraints>
See `261014-eym-CONTEXT.md`. All its decisions are locked: Stories only, child summary contains the project name (case-insensitive), inclusive `dd.MM.yyyy - dd.MM.yyyy` range parsed from the WEEK parent summary, two-direction one-click fixes, drift shown on release detail only, Releases tab shows the package and has a bulk sync, and a global RM project picker. No new packages.
</user_constraints>

## Summary

The field is typed `customfield_15725?: unknown` on `JiraIssueDetail['fields']` (`taskflow/src/services/jira.ts:1791`). It is read only by `extractDeploymentPackage` (`FieldsSection.tsx:75`), which accepts a string, `{value}`/`{name}`, or an array of those. It does **not** accept `{key}`, which is what an issue-picker field usually returns. Quick task 260804-jhf never recorded the real payload, and no fixture contains it [VERIFIED: grep of src/ and .planning]. Writes would use `updateIssueField` / `bulkUpdateIssue` (`jira.ts:2047`, `:2470`), which both do a plain `PUT /rest/api/2/issue/{key}` with `{fields:{...}}`. Nothing confirms that PUT works for this field. The issue-detail payload uses `fields=*navigable`, so the field is present there. `fetchFixVersionIssues` (`jira.ts:1335`) does **not** request it, and doesn't request `fixVersions` or `project` either.

**Primary recommendation:** Make Task 1 a live probe (checkpoint:human-verify). Run `GET /rest/api/2/issue/{STORY}/editmeta` and read `fields.customfield_15725` (`schema.type`, `schema.custom`, `operations`). Then `GET /rest/api/2/issue/{STORY}?fields=customfield_15725` on a story that has a value, and `GET /rest/api/2/issue/{RM-CHILD}?fields=summary,parent,issuetype,issuelinks,customfield_10014` to see how a child links to its WEEK parent. Everything else is pure logic and UI wiring and can go ahead in parallel.

## Key Findings

### 1. Field shape and write path
- **Read:** Extend `extractDeploymentPackage` to also accept `{key}` (and prefer `key` over `value`/`name`). Add a sibling `extractDeploymentPackageKey(field): string | null` that returns an issue key matching `/^[A-Z][A-Z0-9_]+-\d+$/` from a string, `{key}`, or a one-element array. Keep the existing tests unchanged; they must still pass.
- **Write:** Choose the value shape from editmeta, not by guessing. If `schema.type === 'array'` send `[key]`, otherwise send `key`. For ScriptRunner-style issue pickers the documented REST set format is a bare key string or an array of keys [ASSUMED]. If editmeta doesn't list `customfield_15725` at all, the field isn't on the edit screen, and a PUT will 400 like the flag and resolution fields did (see memory: GreenHopper flag, resolution via transition). In that case the write half is blocked: show a "set in Jira" link-out and keep the warnings read-only. The `bulkUpdateIssue` error flattening (`flattenJiraError`) already surfaces the 400 text.
- **Optimistic cache gotcha:** `useFieldMutation.onMutate` writes the value *as sent* into `['jira-issue-detail', ...]`. The read side then sees the write shape (bare string or `[key]`), not Jira's read shape, so the extractor must accept both. Route the package write through `useFieldMutation` (via `mutation.mutate({fieldName:'customfield_15725', value})`) so the existing invalidation of `jira-issue-detail`, `jira-fixversion-issues` and `gh-*` carries over. Fix versions use `{fieldName:'fixVersions', value:[{id}]}` (`FieldsSection.tsx:563`). For "both" fixes, use one `bulkUpdateIssue` call rather than two PUTs.

### 2. Release detail and Releases tab
- `release-detail/driftDetection.ts` is a pure **MR** drift module (channels A/B/C, D-10/11/12 overrides). **Don't add package logic to it.** Put it in a new pure module next to it (see layout below) and render a separate section on the release detail page that follows the existing detail conventions (h3 and rows, no card panels).
- Release stories come from `useReleaseDetail.ts:462`, key `['jira-fixversion-issues', versionId, storyPointsFieldKey]`. The only consumer is `useReleaseDetail` (FieldsSection and useFieldMutation only invalidate the prefix). Adding `customfield_15725`, `fixVersions` and `project` to its `fields` list is additive and safe; it doesn't change order or JQL. Filter to `issuetype.name === 'Story'` on the client.
- Releases tab (`ReleasesTab.tsx`, 575 lines): versions come from `['jira-fix-versions', activeJiraProject]` (`JiraFixVersion.releaseDate` is `"YYYY-MM-DD"` or absent), with per-row `useQueries` counts. For the per-row package, resolve each version's `releaseDate` to an RM child using **one** shared WEEK-index query, not a query per row. Per memory, drift *counts* are not shown on the Releases list, so show only the package key/summary there. Bulk sync runs from a row action and needs that version's stories (reuse `fetchFixVersionIssues` with the same key so release detail gets a warm cache), computes the plan, confirms ("N stories will be updated"), then runs a sequential/limited loop of `bulkUpdateIssue` with a per-item result summary, and finally invalidates `jira-fixversion-issues` and `jira-issue-detail`.

### 3. Settings
- Store: `taskflow/src/stores/settings.store.ts`. Add `releaseManagementProjectKey: null as string | null` to `initialSettings` with a setter, bump `version: 29 -> 30`, and add a `version < 30` migrate step that defaults it to `null` (precedent: `selectedAioProjectKey`, v17). Update `settings.store.test.ts` migrate tests.
- UI: copy the `components/integrations/AioBlock.tsx` picker (Select with name in trigger, stale-key warning, retry). Put it in `IntegrationsSection.tsx` under a "Release Management" h3. Use `listJiraProjects(baseUrl, token)` from `jira.ts:112` (also used by ConnectionsSection and TokenSection) under its own query key. Per memory (Base UI Select needs items), render the selected name in the trigger explicitly as AioBlock does. When the key is null, the whole feature is silently disabled (no warnings, no column).

### 4. Finding WEEK parents and children
- **Parents:** WEEK parents are few (about 52 per year), so fetch them **all** with full pagination and parse on the client. That isn't the fetch-once page-cap bug, because the set is bounded and fully paginated. Use `fetchAllSearchPages` (`jira.ts:316`, private, so add the new fetcher in `jira.ts`). Suggested JQL: `project = "{RM}" AND summary ~ "WEEK*" ORDER BY created DESC` with `fields=summary,subtasks`. Optionally bound it with `AND created >= startOfYear(-1)`. Filter with the strict parser and ignore non-matching summaries. Don't depend on a `summary ~ "19.10.2026"` text query: Lucene tokenisation of dotted dates is unreliable [ASSUMED].
- **Children:** the parent/child mechanism is unknown, which is why the probe matters:
  - If children are **sub-tasks**, the parent's `fields.subtasks[]` already has `{key, fields.summary}`, so no second query is needed.
  - If they are **Epic children**, use `"Epic Link" = KEY`.
  - If they are **issue links**, use `issue in linkedIssues(KEY)`.
  - Whichever it is, make it one function `fetchRmWeekIndex(baseUrl, token, rmProject)` that returns `RmWeek[] = {key, summary, start, end, children:{key, summary}[]}`. Key: `['rm-week-index', rmProject, baseUrl]`, `staleTime` of a few minutes.
- **Package -> week direction:** look up the story's package key in the index (child key -> week). If it isn't there (an old week outside the bound), fall back to `GET issue/{pkg}?fields=summary,parent`.
- **Project name:** `fields.project` is typed `{id,key}`, but `*navigable` also returns `name`, so extend the type with `name?: string`. For release stories, take the name from the issue's `project` field (add it to the fields list) or from `listJiraProjects`.

### 5. Recommended module layout
```
taskflow/src/lib/deployment-package.ts        # PURE, no React/store
  parseWeekRange(summary) -> {weekNo, start:'YYYY-MM-DD', end} | null   // /WEEK(\d+)\s*\((\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})\)/
  isDateInWeek(ymd, week) -> boolean           // string compare on YYYY-MM-DD, inclusive
  findWeekForDate(weeks, ymd) -> RmWeek | null
  findChildForProject(week, projectName) -> child | null  // case-insensitive includes
  evaluatePackageSync({story, fixVersions, weeks, projectName}) ->
     {state:'ok'|'pkg-only'|'fv-only'|'mismatch'|'none'|'unresolved', fixes: Fix[]}
  planBulkSync(stories, version, weeks, projectName) -> {key, fields}[]
taskflow/src/lib/deployment-package.test.ts   # vitest
taskflow/src/services/jira.ts                 # fetchRmWeekIndex, field additions (NOT jira/ modules)
taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
```
Keep `extractDeploymentPackage(Key)` in FieldsSection, or move it into the lib and re-export it so existing tests keep their import.

## Common Pitfalls
1. **Timezone off-by-one:** `new Date('2026-10-19')` parses as UTC. Compare `YYYY-MM-DD` strings directly (normalise the parsed `dd.MM.yyyy` to that form). Avoid Date math, or use `lib/local-date.ts#parseLocalDate`.
2. **Edit-screen rejection** (flag and resolution precedent): settle it by probing editmeta first, as described above.
3. **Multiple fix versions:** a story can have more than one. Treat it as matched if *any* fix version's date is in the package week. In the "fv-only" direction, offer a fix only when exactly one dated version exists (or let the user pick). Versions without a date are "unresolved", not mismatched.
4. **Ambiguous child match:** project name "Core" also matches "Core Admin". When more than one child matches, prefer an exact token or word-boundary match, otherwise report unresolved and don't auto-fix. No child, or no week for the date, means no fix button and a hint instead.
5. **Matching in the package -> fix version direction:** the target version must be in the story's project with `releaseDate` inside the week. If none or several match, disable the button or let the user pick.
6. **Shared fetcher key** (memory): adding fields to `fetchFixVersionIssues` is safe. Don't change its JQL.
7. **Pre-commit runs the full vitest suite** (memory): put RED and GREEN in one commit per TDD task. Gate biome on "no new files flagged", not on a fixed count.
8. **Bulk sync:** 403 or 400 errors per issue must not abort the loop. Collect and report them. Respect `jiraConcurrencyLimit` (it's already enforced inside `apiFetch`'s Jira limiter [ASSUMED]; keep it sequential if unsure).

## Assumptions Log
| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | Field is an issue picker; it reads as key string, `{key}`, or array, and writes as key or `[key]` | Write fails or the extractor misses the value. Mitigated by the probe and editmeta-driven shape |
| A2 | Field is on the story edit screen (PUT allowed) | One-click fixes and bulk sync become read-only or link-out |
| A3 | RM children are sub-tasks of the WEEK parent | Children lookup needs Epic Link or linkedIssues JQL instead |
| A4 | `summary ~ "WEEK*"` prefix search returns all WEEK parents | Fallback: `project = RM AND issuetype = <parent type>` with full pagination |
| A5 | `fields.project.name` is present in `*navigable` and search results | Fall back to `listJiraProjects` lookup by key |

## Validation
Vitest 4 (`npm test` in `taskflow/`). Unit tests for `deployment-package.ts`: range parse (incl. trailing text and malformed summaries), inclusive boundaries, the 5 states, ambiguity, and bulk plan. Extend `FieldsSection.test.tsx` for `{key}` and `[key]`, plus a warning render with fix buttons calling the mutation with the editmeta-chosen shape. Add a settings migrate test for v30. Manual UAT: the live probe, plus one real PUT on a test story.

## Security
No new auth surface. Issue keys going into JQL or URLs must pass the key regex. The project key is quoted in JQL. Rendering uses React escaping.
