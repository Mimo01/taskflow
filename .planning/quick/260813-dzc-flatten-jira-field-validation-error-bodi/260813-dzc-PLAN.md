---
phase: quick-260813-dzc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/errors.ts
  - taskflow/src/services/jira/errors.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/versions.ts
  - taskflow/src/services/jira.test.ts
  - taskflow/src/services/jira/versions.test.ts
  - taskflow/src/services/jira/rank-api.ts
  - taskflow/src/services/jira/rank-api.test.ts
autonomous: true
requirements: [QUICK-260813-dzc]

must_haves:
  truths:
    - "A Jira field-validation rejection ({errorMessages:[], errors:{fixVersions:'...'}}) surfaces the field reason in the thrown Error message instead of a generic fallback"
    - "A body with a populated errorMessages array still surfaces the same message it does today (no regression)"
    - "A body with neither key still falls back to the caller's existing literal (no empty-colon message)"
    - "A rank failure surfaces Jira's reason instead of a bare `status N`"
    - "No thrown message ever contains the PAT, the Authorization header, or the request URL"
  artifacts:
    - path: "taskflow/src/services/jira/errors.ts"
      provides: "flattenJiraError helper — errorMessages preferred, errors object fallback"
      exports: ["flattenJiraError"]
    - path: "taskflow/src/services/jira/errors.test.ts"
      provides: "Shape-coverage table for every Jira error-body shape"
  key_links:
    - from: "taskflow/src/services/jira.ts"
      to: "flattenJiraError"
      via: "import from './jira/errors'"
      pattern: "flattenJiraError\\("
    - from: "taskflow/src/services/jira/versions.ts"
      to: "flattenJiraError"
      via: "import from './errors'"
      pattern: "flattenJiraError\\("
    - from: "taskflow/src/services/jira/rank-api.ts"
      to: "flattenJiraError"
      via: "import from './errors'"
      pattern: "flattenJiraError\\("
---

<objective>
Jira splits API error bodies across two keys: top-level failures in `errorMessages: string[]`,
field-validation failures in a separate `errors` object with `errorMessages` left empty. Every
error path in the Jira service layer reads only `errorMessages?.[0]`, so the real reason for a
field-validation rejection is silently discarded and the user sees a generic fallback.

This is the Jira sibling of the GitLab WR-01 fix (quick task 260813-dbf, `flattenGitLabError`).

Purpose: users editing a release or ranking an issue see Jira's actual field-level reason.
Output: a `flattenJiraError` helper, wired into all 4 existing `errorMessages` read sites plus a
new body read in `rank-api.ts`, with a shape-coverage test table.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260813-dzc-flatten-jira-field-validation-error-bodi/260813-dzc-CONTEXT.md
@taskflow/src/services/gitlab.ts
@taskflow/src/services/jira/versions.ts
@taskflow/src/services/jira/rank-api.ts
</context>

<interfaces>
## Reference implementation (mirror, do not import)

`taskflow/src/services/gitlab.ts:1123-1191` — private `flattenErrorCandidate` +
exported `flattenGitLabError(body: unknown): string | undefined`. Conventions to carry over:
`unknown` input, `string | undefined` output, empty flattens to `undefined` (never `''`) so each
caller's existing `?? 'literal'` fallback still fires, and objects are serialised via
`JSON.stringify` rather than `String()` so `[object Object]` can never appear.

Do NOT refactor `flattenGitLabError` or extract a shared generic — the separator conventions
differ (GitLab uses `field detail`, Jira uses `field: detail` per the locked CONTEXT example) and
`gitlab.ts` is out of scope for this task.

## New contract

```
// taskflow/src/services/jira/errors.ts
export function flattenJiraError(body: unknown): string | undefined
```

Behaviour (locked by CONTEXT `### Error shape: joined string`):
- `body` null / non-object → `undefined`
- Prefer `errorMessages`: `string[]` joined with `'; '`; a bare `string` used as-is
- Fall back to `errors` when `errorMessages` is missing, null, or flattens to empty
- `errors` object → entries mapped to `` `${field}: ${detail}` `` joined with `'; '`, where
  `detail` is the value for a string, `value.join(', ')` for an array, `JSON.stringify(value)`
  otherwise
- Empty flatten (`[]`, `{}`, `''`) → `undefined`, never `''`

## Existing call sites (all keep their current `?? 'literal'` fallback and ApiError branching)

| File | Line | Current expression |
|------|------|--------------------|
| `taskflow/src/services/jira.ts` | ~1202 | `(data as {errorMessages?: string[]}).errorMessages?.[0] ?? 'Failed to fetch fix versions'` |
| `taskflow/src/services/jira.ts` | ~1351 | `... ?? 'Failed to update fix version'` |
| `taskflow/src/services/jira.ts` | ~2392 | `... ?? \`Failed to update ${issueKey}: ${response.status}\`` |
| `taskflow/src/services/jira/versions.ts` | ~45 | `... ?? 'Failed to fetch fix versions'` |
| `taskflow/src/services/jira/rank-api.ts` | ~63 | `throw new Error(\`Failed to rank issue: ${response.status}\`)` — no body read at all |

Confirmed by grep: these are the only `errorMessages` reads in `src/`. `services/jira.ts` is the
live path for all imports (dual-file gotcha); `services/jira/versions.ts` is duplicated dead-ish
logic — fix both.

Sole downstream consumer: `taskflow/src/routes/dashboard/release-detail/useEditRelease.ts:151`
collapses the rejection to `(reason as Error).message`. No consumer change needed.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add flattenJiraError helper with shape-coverage tests</name>
  <files>taskflow/src/services/jira/errors.ts, taskflow/src/services/jira/errors.test.ts</files>
  <behavior>
    Mirror the `describe('flattenGitLabError')` table in `taskflow/src/services/gitlab.test.ts:2681`.
    - `{errorMessages: ['Permission denied']}` → `'Permission denied'`
    - `{errorMessages: ['a', 'b']}` → `'a; b'`
    - `{errorMessages: 'a bare string'}` → `'a bare string'` (defensive non-array)
    - `{errorMessages: [], errors: {fixVersions: "Field 'fixVersions' cannot be set"}}`
      → `"fixVersions: Field 'fixVersions' cannot be set"` (the locked CONTEXT example)
    - `{errors: {a: 'x', b: 'y'}}` → `'a: x; b: y'`
    - `{errors: {fixVersions: ['too long', 'archived']}}` → `'fixVersions: too long, archived'`
    - `{errors: {f: {nested: {deeper: 1}}}}` → contains the serialised value, does NOT match `/\[object Object\]/`
    - `{errorMessages: ['primary'], errors: {f: 'secondary'}}` → `'primary'` (errorMessages wins)
    - empty-flattens-to-undefined: `{errorMessages: []}`, `{errorMessages: {}}`, `{errorMessages: ''}`,
      `{errors: {}}`, `{errorMessages: [], errors: {}}` → all `undefined`
    - both keys missing: `{status: 400}` → `undefined`
    - non-objects: `null`, `undefined`, `'a string'`, `42` → `undefined`
    - a loop asserting no case in the table ever returns a string matching `/\[object Object\]/`
  </behavior>
  <action>Create `taskflow/src/services/jira/errors.ts` exporting `flattenJiraError(body: unknown): string | undefined`, plus a module-private `flattenErrorCandidate`-style helper, following the `taskflow/src/services/gitlab.ts` reference structure and its `unknown`-in / `string | undefined`-out convention. Implement exactly the contract in `<interfaces>`: `errorMessages` preferred with `'; '` join, `errors` object as the fallback formatted `field: detail` joined by `'; '`, array details joined by `', '`, non-string non-array details via `JSON.stringify`, and an empty flatten normalised to `undefined` rather than `''` — carry over the GitLab WR-01 comment explaining why (an empty string is falsy but not nullish, so it sails through every caller's `??` fallback and produces a message ending in a bare colon). Add a TSDoc block naming this as the Jira sibling of `flattenGitLabError` and warning against reinventing a narrower widening. Do not export the private candidate helper. Write `errors.test.ts` first covering every `<behavior>` case; the pre-commit hook runs the full vitest suite, so land RED and GREEN in a single commit.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira/errors.test.ts</automated>
  </verify>
  <done>`flattenJiraError` exists and every shape in `<behavior>` passes; `grep -c 'flattenJiraError' src/services/jira/errors.ts` is non-zero.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire flattenJiraError into the four existing errorMessages sites</name>
  <files>taskflow/src/services/jira.ts, taskflow/src/services/jira/versions.ts, taskflow/src/services/jira.test.ts, taskflow/src/services/jira/versions.test.ts</files>
  <behavior>
    New tests, added alongside the existing ones (which must keep passing unchanged):
    - `fetchFixVersions` (jira.ts): a 400 body `{errorMessages: [], errors: {fixVersions: "Field 'fixVersions' cannot be set"}}`
      rejects with a message containing `"fixVersions: Field 'fixVersions' cannot be set"`, not `'Failed to fetch fix versions'`
    - `fetchFixVersions` 403 with the same body: rejects with an `ApiError` whose `message` carries the field reason
    - `updateFixVersion` (jira.ts:~1351): same field-validation body surfaces the field reason
    - `bulkUpdateIssue` (jira.ts:~2392): same field-validation body surfaces the field reason
    - each of the three: body `{}` still yields the pre-existing literal fallback, and the message never ends in a bare colon
    - `fetchFixVersions` in `services/jira/versions.ts`: same field-validation assertion
    - security: for one write path, the rejection message contains neither the token value nor the string `Authorization`
  </behavior>
  <action>Replace the `(data as { errorMessages?: string[] }).errorMessages?.[0]` expression at all four sites with `flattenJiraError(data)` / `flattenJiraError(body)`, keeping each site's existing `?? 'literal'` fallback and its 401/403 `ApiError` branching byte-identical in structure. Import from `'./jira/errors'` in `jira.ts` and `'./errors'` in `jira/versions.ts`. Update the `@throws Error with Jira's errorMessages[0]` TSDoc on `bulkUpdateIssue` (jira.ts:~2367) to describe the widened behaviour. Do not change the fallback literals, the ApiError source tag, or any success path. Note that a single-element `errorMessages` array produces output identical to today's `[0]` read, so the two existing tests at jira.test.ts:629 and :1250 must pass untouched — do not edit them. Land RED and GREEN in one commit (pre-commit runs the full suite).</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira.test.ts src/services/jira/versions.test.ts</automated>
  </verify>
  <done>All four sites call `flattenJiraError`; `grep -v '^\s*[*/]' src/services/jira.ts src/services/jira/versions.ts | grep -c 'errorMessages?.\[0\]'` returns 0; existing error-path tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Read and flatten the rank-api error body</name>
  <files>taskflow/src/services/jira/rank-api.ts, taskflow/src/services/jira/rank-api.test.ts</files>
  <behavior>
    - `rankIssueApi` on a 400 whose `json()` resolves `{errorMessages: [], errors: {rankCustomFieldId: 'is not a rank field'}}`
      rejects with a message containing `'rankCustomFieldId: is not a rank field'`
    - on a 400 whose `json()` resolves `{errorMessages: ['Issue does not exist']}` → message contains `'Issue does not exist'`
    - on a 500 whose `json()` rejects (non-JSON body) → message still contains `'status 500'` and does not end in a bare colon
    - the thrown message never contains the token value, the string `Authorization`, or the request URL
    - existing 204, 207-partial-failure, and 401/403 ApiError tests continue to pass unchanged
  </behavior>
  <action>In the final `if (!response.ok)` block of `rankIssueApi` (~line 63), read the body with `await response.json().catch(() => null)` and throw `` new Error(`Failed to rank issue: ${flattenJiraError(body) ?? `status ${response.status}`}`) ``, importing `flattenJiraError` from `'./errors'`. Touch only this error path — the 204 fast path, the 207 multi-status WR-01 block, and the 401/403 `ApiError` branch stay byte-unchanged, and `rank.ts` ranking logic is explicitly out of scope (known-broken for P78). T-dzc-02: compose the message only from `flattenJiraError(body)` or the fixed status literal — never the token, the `Authorization` header, or the URL. Land RED and GREEN in one commit.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira/rank-api.test.ts</automated>
  </verify>
  <done>Rank failures surface Jira's reason; `grep -c 'flattenJiraError' src/services/jira/rank-api.ts` is non-zero; the 207 and 401/403 branches are unchanged in `git diff`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira DC API → service layer | Server-controlled JSON error bodies of arbitrary shape are parsed and interpolated into user-visible strings |
| Service layer → UI | Thrown `Error.message` is rendered verbatim in the release-edit error slot |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dzc-01 | Information disclosure | `rankIssueApi` / `fetchFixVersions` / `updateFixVersion` / `bulkUpdateIssue` error paths | mitigate | Thrown messages compose only from `flattenJiraError(body)` or a fixed literal — never the PAT, the `Authorization` header, the request URL, or the configured base URL. Carries the GitLab WR-11 Test E rule (`gitlab.test.ts:2661`) to the Jira side; Task 2 and Task 3 each assert it. |
| T-dzc-02 | Tampering | Server-controlled `errors` object values reaching the UI string | mitigate | Values are flattened via `JSON.stringify` for non-string/non-array details, never `String()` — no `[object Object]`, no prototype traversal. Output is a plain string rendered as text by React (no `dangerouslySetInnerHTML` on the consumer path), so no injection vector. |
| T-dzc-03 | Denial of service | Pathologically large / deeply nested `errors` object | accept | Body already fully buffered by `response.json()`; flattening adds bounded work over an already-parsed object. Jira DC is a trusted first-party server. |
| T-dzc-SC | Tampering | npm/pip/cargo installs | mitigate | No new dependencies introduced by this task — no install step, no package-legitimacy gate needed. |
</threat_model>

<verification>
```
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm test
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx biome check ./src/services/jira ./src/services/jira.ts
```
Biome: gate on "no NEW files flagged" versus the drifting baseline, not an absolute diagnostic count.
</verification>

<success_criteria>
- `flattenJiraError` exists in `taskflow/src/services/jira/errors.ts` with the locked joined-string contract
- All 5 error paths (4 existing + rank-api) route their body through it
- Zero remaining `errorMessages?.[0]` reads in non-comment source
- Full vitest suite green; `tsc --noEmit` clean; no new Biome diagnostics in touched files
- No thrown message contains the token, `Authorization`, or a request URL
</success_criteria>

<output>
Create `.planning/quick/260813-dzc-flatten-jira-field-validation-error-bodi/260813-dzc-SUMMARY.md` when done
</output>
