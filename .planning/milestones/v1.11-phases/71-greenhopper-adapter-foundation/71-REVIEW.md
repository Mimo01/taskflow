---
phase: 71-greenhopper-adapter-foundation
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - taskflow/scripts/capture-greenhopper.mjs
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/greenhopper/__fixtures__/allData.real.json
  - taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json
  - taskflow/src/services/jira/greenhopper/__fixtures__/details.real.json
  - taskflow/src/services/jira/greenhopper/__fixtures__/transitions.real.json
  - taskflow/src/services/jira/greenhopper/adapter.test.ts
  - taskflow/src/services/jira/greenhopper/adapter.ts
  - taskflow/src/services/jira/greenhopper/allData.test.ts
  - taskflow/src/services/jira/greenhopper/allData.ts
  - taskflow/src/services/jira/greenhopper/client.test.ts
  - taskflow/src/services/jira/greenhopper/client.ts
  - taskflow/src/services/jira/greenhopper/data.test.ts
  - taskflow/src/services/jira/greenhopper/data.ts
  - taskflow/src/services/jira/greenhopper/details.test.ts
  - taskflow/src/services/jira/greenhopper/details.ts
  - taskflow/src/services/jira/greenhopper/entityMaps.test.ts
  - taskflow/src/services/jira/greenhopper/entityMaps.ts
  - taskflow/src/services/jira/greenhopper/index.ts
  - taskflow/src/services/jira/greenhopper/transitions.test.ts
  - taskflow/src/services/jira/greenhopper/transitions.ts
  - taskflow/src/services/jira/greenhopper/types.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 71: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The greenhopper foundation is well-structured: types are centralized, fetchers
follow the legacy `services/jira/transitions.ts` envelope, the adapter is pure
and well-documented against locked decisions (D-01/02/03/07/08/09/11), and tests
exercise both real-capture fixtures and edge variants. The capture script is
appropriately paranoid about not logging the PAT.

Adversarial review surfaced one **BLOCKER** in the fetcher error envelope (`try`
block catches and re-wraps `ApiError` thrown from the response-handling code
path through a separate but related defect), six **WARNINGs** (mostly around
adapter correctness against the declared `JiraIssue` shape, redaction gaps in
the capture script, and a test that breaks the declared `AdaptedIssue` type
contract), and four informational items.

## Structural Findings (fallow)

No `<structural_findings>` block was provided with this review request.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Adapter never sets `parent.fields.summary` from the parent issue, returning `''` is fine, but `parent.key` defaults to `''` while `JiraIssue.fields.parent.key` is declared as required `string` — silently corrupts downstream consumers

**Severity:** BLOCKER
**File:** `taskflow/src/services/jira/greenhopper/adapter.ts:107-114`

```ts
const parent: JiraIssue['fields']['parent'] | undefined =
  gh.parentId !== undefined
    ? {
        id: String(gh.parentId),
        key: gh.parentKey ?? '',
        fields: { summary: '' },
      }
    : undefined;
```

**Issue:** When `gh.parentId` is present but `gh.parentKey` is `undefined`
(which the type allows — both are independently optional in `GhIssue`), the
adapter synthesises a parent object with `key: ''`. Every downstream consumer of
`JiraIssue` (the ~60 callers cited in the adapter header) treats
`fields.parent.key` as the join key for hierarchy lookups, breadcrumb
construction, deep-linking (`navigate('/issues/' + parent.key)`), and Atlassian
URL building. An empty string silently routes to wrong URLs / breaks navigation
without an error path.

`resolveParent()` in `entityMaps.ts:138-144` already enforces "both present or
undefined" — but the adapter ignores it (the call at `adapter.ts:124` is
discarded via `void`). The synthesis path bypasses the very invariant
`resolveParent` was written to guarantee.

**Fix:** Use `resolveParent`'s contract — only synthesise `parent` when **both**
fields are present:

```ts
const parent: JiraIssue['fields']['parent'] | undefined =
  gh.parentId !== undefined && gh.parentKey !== undefined
    ? {
        id: String(gh.parentId),
        key: gh.parentKey,
        fields: { summary: '' },
      }
    : undefined;
```

Then derive `issuetype.subtask` consistently — either from `parent !==
undefined` (preferred, since the JiraIssue invariant is "subtask iff parent"),
or document the divergence. As written, an issue with `parentId` but no
`parentKey` becomes `{ subtask: true, parent: { key: '' } }`, which is the
worst of both worlds.

---

## Warnings

### WR-01: Adapter `void resolveEpic / resolvePriority / resolveParent` is dead computation that defeats tree-shaking and confuses readers

**Severity:** WARNING
**File:** `taskflow/src/services/jira/greenhopper/adapter.ts:122-124`

```ts
void resolveEpic(gh.epicId, entityMaps);
void resolvePriority(gh.priorityId, entityMaps);
void resolveParent(gh.parentId, gh.parentKey);
```

**Issue:** The comment says "keep imports live for static analysers". This is
the wrong tool — `void` calls still execute the resolvers per-issue. For 156
issues on a real board, the test fixture full-iteration runs all three
resolvers 156 times solely to keep imports live. Worse: `resolvePriority`
hitting `priorityId='unknown'` will fire `warnOnce('priority', 'unknown')` even
though the result is discarded — the adapter produces a `console.warn` for a
resolution it does not use. That contradicts D-08's "never warn" contract by
proxy through the required `resolvePriority`.

**Fix:** Remove the `void` calls. If you genuinely need the imports kept
referenced for Phase 73 wiring, either (a) re-export them from this file so
they remain referenced (`export { resolveEpic, resolvePriority, resolveParent }`),
or (b) leave them imported but unused and silence the lint with a single
`biome-ignore` comment.

---

### WR-02: `fetchAllData` / `fetchBacklogData` / `fetchIssueDetails` / `fetchGhTransitions` swallow `ApiError` thrown synchronously by `apiFetch` and replace it with the generic "Cannot reach" message

**Severity:** WARNING
**File:** `taskflow/src/services/jira/greenhopper/allData.ts:27-36` (and identical pattern in `data.ts:27-36`, `details.ts:34-43`, `transitions.ts:32-41`)

```ts
try {
  response = await greenhopperFetch(...);
} catch {
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
```

**Issue:** The bare `catch {}` discards everything `apiFetch` may have thrown,
including `ApiError` instances (some callers/wrappers throw `ApiError` directly
on auth failures rather than returning a `!ok` Response). Any future change to
`apiFetch` that elects to throw on a structured error will be silently
rewritten as "Cannot reach", masking 401/403 and breaking
`setJiraConnected(false)` semantics that D-04 explicitly preserves.

This also blocks debugging: timeouts, DNS failures, and TLS errors all collapse
to the same message with no diagnostic path.

**Fix:** Only catch network-class errors; re-throw `ApiError`. Either:

```ts
} catch (err) {
  if (err instanceof ApiError) throw err;
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
```

Or attach the cause: `new Error('Cannot reach …', { cause: err })` so devtools
keeps the original stack.

---

### WR-03: `adapter.test.ts` `edge()` helper casts an arbitrary partial to `GhBoardIssue` with `as GhBoardIssue`, defeating the type safety being claimed in the test header

**Severity:** WARNING
**File:** `taskflow/src/services/jira/greenhopper/adapter.test.ts:32-46`, also `216-235`

The Group G test constructs a `GhIssue` by enumerating 14 specific fields from
`base` (an edge-built `GhBoardIssue`). If `GhIssue` gains a new field in
`types.ts`, the manual enumeration silently drops it but tsc cannot detect this
because `GhIssue` here is the *result* type, not the input. The test then
asserts `out.timeInColumn === undefined` — but if the next added required field
on `GhIssue` is named close to `timeInColumn` or if `edge({})` produces a
`timeInColumn` key, this passes vacuously.

**Fix:** Use object-rest to strip `timeInColumn`:

```ts
const { timeInColumn: _drop, ...ghIssue } = edge({}) as GhBoardIssue;
const out = adaptIssue(ghIssue as GhIssue, maps, 'customfield_10016');
```

This stays exhaustive when `GhIssue` evolves.

---

### WR-04: Capture script's `redactTransitions` regex `/^[A-Z][A-Z0-9_]+-\d+$/` against `key` fields is too lax and may rewrite project codes that aren't issue keys

**Severity:** WARNING
**File:** `taskflow/scripts/capture-greenhopper.mjs:257-260`

```js
if (k === 'key' && typeof v === 'string' && /^[A-Z][A-Z0-9_]+-\d+$/.test(v)) {
  node[k] = redactIssueKey(v);
  continue;
}
```

**Issue:** This walks every nested object and rewrites *any* property named
`key` that matches `<ALLCAPS>-<digits>`. In a transitions payload this is fine
today but is brittle: if the GH server adds e.g. a workflow step keyed
`STEP-1` or a fixVersion field keyed `REL-12`, capture will rewrite it to
`PROJ-N` and the resulting fixture will silently misrepresent the API shape.
The same script also does not redact `name` fields on transitions, but the
header comment claims "workflow names are configuration metadata, not PII" —
that's a project decision, not a fact (workflow names in some orgs encode
client/customer initials).

**Fix:** Narrow to known issue-key carriers (e.g. only `issueKey`, or only
within known sub-paths) rather than walking every `key`. Document the
workflow-name exception in `71-RESEARCH.md` rather than only in the script.

---

### WR-05: `capture-greenhopper.mjs` does not redact `description`, `comment.body`, or `issuesData.issues[*].epic` (string epic key) consistently — Pitfall 7 surface gap

**Severity:** WARNING
**File:** `taskflow/scripts/capture-greenhopper.mjs:113-125, 190-237`

`redactIssueLike` remaps `issue.epic` (the issue-key string) via `redactIssueKey`,
which is correct. But the `redactDetails` walker only strips `html`/`editHtml`
fields; it does not redact plain-text `description`, comment `body`, or
`summary` *inside* nested operations. Real GreenHopper details payloads can
embed customer names, ticket bodies, and PR titles in operation `label`/`title`
fields and in `defaultTabs[*]` arbitrary entries. The defensive walker passes
those straight through.

Since `defaultTabs` is typed as `[key: string]: unknown` (`types.ts:249`), the
shape is unknowable, so the safer default is **deny-by-default redaction** for
unknown string fields in the details payload OR a CI/precommit check that the
committed `details.real.json` contains none of a known PII-allowlist. Today
neither exists.

**Fix:** Either:
1. Walk `defaultTabs` and redact every string-valued leaf except a whitelist
   (`tabId`, ids, booleans), or
2. Add a unit test that scans the committed fixture for a forbidden-string list
   sourced from a private allowlist, or
3. Document the trust boundary explicitly and require human review at capture
   time (currently implicit).

---

### WR-06: `AdaptedIssue` declares `flagged: boolean` (required) but `adaptIssue` reads `gh.flagged ?? false` — input is `boolean | undefined`; this is fine, but tests at adapter.test.ts:188-205 only assert behavior at the JS level, not the type contract

**Severity:** WARNING
**File:** `taskflow/src/services/jira/greenhopper/adapter.ts:47-52, 146`

The `AdaptedIssue` type adds `flagged: boolean` but `GhIssue.flagged` is
`boolean | undefined`. The runtime fallback (`gh.flagged ?? false`) is correct,
but downstream consumers that destructure or spread `AdaptedIssue` will pass
through the (now-required) `flagged` field with possible `false` values that
the source data never specified. For "show flagged badge if flagged" UI, this
is correct. For "count issues that have been flagged at any point" telemetry,
this conflates "not flagged" with "no flag info present". The decision is
defensible but undocumented — the D-01 list in the header says only "four
GH-only top-level props" without specifying the `undefined → false` collapse.

**Fix:** Document the collapse in the adapter header (D-01 description) and add
a test that explicitly verifies `gh.flagged === false` and `gh.flagged ===
undefined` both produce `out.flagged === false` (currently only `undefined` is
tested).

---

## Info

### IN-01: `entityMaps.ts` `seenMissing` is a module-level `Set` — leaks across tests if `__resetWarnOnce` is not called

**File:** `taskflow/src/services/jira/greenhopper/entityMaps.ts:39, 54`

The `__resetWarnOnce` escape hatch exists, but is not registered in a top-level
`beforeEach` for the whole `greenhopper/` test suite — it's repeated in each
spec. If a new test file is added that calls a resolver in module scope (like
adapter.test.ts already does at line 23 via `buildEntityMaps(typed)`), and
forgets the reset, test order will affect warn-counting assertions.

**Fix:** Either move `__resetWarnOnce` into a vitest setup file
(`setupFiles: ['./greenhopper/test-setup.ts']`), or make `warnOnce` accept an
injectable guard.

---

### IN-02: Five identical fetcher error-envelope blocks could be lifted into a single helper

**File:** `taskflow/src/services/jira/greenhopper/{allData,data,details,transitions}.ts`

The 4 fetchers each repeat: try/catch wrap → `if (!response.ok)` → 401/403 →
status. Refactor into:

```ts
async function ghRequest<T>(
  baseUrl: string, token: string, path: string, label: string, errorContext: string,
): Promise<T> { ... }
```

The DRY win is small (~25 lines saved), but combined with the WR-02 fix it
becomes a single place to evolve the error envelope.

---

### IN-03: `adapter.ts:83` widens `gh.estimateStatistic` via `as` cast to work around a type-vs-runtime mismatch — fix the type instead

**File:** `taskflow/src/services/jira/greenhopper/adapter.ts:83`

```ts
const estimate = gh.estimateStatistic as GhIssue['estimateStatistic'] | undefined;
```

The comment correctly notes "real-capture fixture shows 103/156 issues with
`estimateStatistic` absent — type declares it required but the API can omit
it". The right fix is in `types.ts:45` — make `estimateStatistic?:` optional —
not a runtime cast everywhere consumers exist. The cast is a band-aid that
moves with the bug.

**Fix:** Mark `GhIssue.estimateStatistic` and `GhIssue.trackingStatistic`
optional in `types.ts`, then drop the cast in `adapter.ts:83`. Update any
fixture-touching test that depends on the current required shape (the
`edge()` helper in adapter.test.ts already populates defaults — no change
there).

---

### IN-04: `index.ts` `export *` re-exports everything including `__resetWarnOnce` (an underscore-prefixed test-only API)

**File:** `taskflow/src/services/jira/greenhopper/index.ts:12`

`export * from './entityMaps'` will export `__resetWarnOnce` through the
package barrel and onward to `services/jira.ts`. The `__` prefix is a
convention, not enforcement — TS will happily let any consumer call it.

**Fix:** Switch to explicit named re-exports in `index.ts`, omitting
`__resetWarnOnce`. Same for any future test-only escape hatches.

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
