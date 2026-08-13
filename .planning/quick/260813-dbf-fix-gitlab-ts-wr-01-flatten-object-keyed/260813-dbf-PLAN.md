---
phase: quick-260813-dbf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
autonomous: true
requirements: [WR-01]

must_haves:
  truths:
    - "A GitLab 400 with an object-keyed validation body (e.g. {\"message\":{\"title\":[\"has already been taken\"]}}) surfaces readable field text in the create-branch and create-milestone dialogs, never '[object Object]'"
    - "A GitLab error body carrying only an `error` key (e.g. {\"error\":\"branch is missing\"}) surfaces that string instead of falling through to the bare status-code fallback"
    - "A present-but-empty message body ({\"message\":[]} / {\"message\":{}}) falls back to the `status N` text instead of producing a message that stops at the colon"
    - "createBranch, createMilestone, and updateMilestone all derive their error text from the single flattenGitLabError helper — no function retains its own local widening"
    - "npm test and npm run check are green"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "flattenGitLabError extended with `error`-key fallback; three call sites converted"
      contains: "flattenGitLabError"
    - path: "taskflow/src/services/gitlab.test.ts"
      provides: "Coverage for every body shape at the helper and at each of the three converted call sites"
      contains: "flattenGitLabError"
  key_links:
    - from: "taskflow/src/services/gitlab.ts createBranch"
      to: "flattenGitLabError"
      via: "direct call on the non-ok response body"
      pattern: "flattenGitLabError\\(body\\)"
    - from: "taskflow/src/services/gitlab.ts createMilestone"
      to: "flattenGitLabError"
      via: "direct call on the non-ok response body"
      pattern: "flattenGitLabError\\(body\\)"
    - from: "taskflow/src/services/gitlab.ts updateMilestone"
      to: "flattenGitLabError"
      via: "direct call on the non-ok response body"
      pattern: "flattenGitLabError\\(body\\)"
---

<objective>
Close 88-REVIEW **WR-01**, the last open code gap from the v1.14 milestone audit.

`flattenGitLabError` already exists in `gitlab.ts` (added in Phase 90 for `updateMergeRequest`) and
already handles string / `string[]` / field-keyed-object message shapes. The defect is that the three
*other* write paths never adopted it: `createBranch` (gitlab.ts:1358-1377), `createMilestone`
(gitlab.ts:1422-1440), and `updateMilestone` (gitlab.ts:1109-1117) each kept their own narrower
`as { message?: string | string[] }` cast plus an `Array.isArray(...) ? join : raw` widening. When
GitLab's Grape `render_validation_error!` returns `{"message":{"title":["has already been taken"]}}` —
the single most likely failure of a duplicate-title milestone create — `Array.isArray` is false, so the
object flows into the template literal and the user sees `Failed to create milestone: [object Object]`.
Per D-15 there are no toasts, so this string is the only error surface the user ever gets.

Purpose: kill the last `[object Object]` error surface and collapse three divergent widenings to one helper.
Output: extended `flattenGitLabError` (adds an `error`-key fallback), three converted call sites, unit
coverage for every body shape at the helper and at each call site.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Source of truth for the defect (read the WR-01 entry only, it is short):
@.planning/phases/88-release-branch-milestone-creation/88-REVIEW.md

Code under change:
@taskflow/src/services/gitlab.ts
@taskflow/src/services/gitlab.test.ts

**Existing contract you are extending (gitlab.ts:1140-1173).** `flattenGitLabError(body: unknown):
string | undefined` returns `undefined` for a null/non-object body, for a missing/null `message`, and —
deliberately — for a message that flattens to `''` (`{message:[]}`, `{message:{}}`, `{message:''}`), so
that every caller's `?? \`status ${response.status}\`` fallback still fires. Field-keyed objects render
as `field detail` joined by `'; '`; a non-array non-string field value is `JSON.stringify`'d rather than
`String()`'d. Preserve all of that behavior exactly — the existing tests at gitlab.test.ts:2615-2670
assert it.

**Security constraint carried from WR-11 (do not regress).** Error text may be composed ONLY from the
response body or a fixed fallback literal — never the token, the `PRIVATE-TOKEN` header, or the request
URL. gitlab.test.ts:2595 asserts this for `createBranch`.

**Repo layout gotcha.** The npm project root is `taskflow/` (a subdirectory of the git repo root). Run
all npm commands from `taskflow/`.

**Commit gotcha (project memory).** A pre-commit hook runs the full vitest suite, so a RED-only commit
cannot land. For each task, write the tests and the implementation, then make ONE commit containing both.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add an `error`-key fallback to flattenGitLabError</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/services/gitlab.test.ts</files>
  <behavior>
    New behavior (add to the existing `describe('flattenGitLabError')` block at gitlab.test.ts:2615):
    - `{ error: 'branch is missing' }` returns `'branch is missing'`
    - `{ error: ['a', 'b'] }` returns `'a, b'` (same flattening path as `message`)
    - `{ error: { base: ['is invalid'] } }` returns `'base is invalid'`
    - `{ message: 'primary', error: 'secondary' }` returns `'primary'` (message wins)
    - `{ message: [], error: 'fallback' }` returns `'fallback'` (an empty message falls through to error)
    - `{ error: '' }` and `{ error: {} }` return `undefined`
    - `{ something_else: 'x' }` returns `undefined`

    Regression behavior that must stay green (already asserted, do not weaken):
    - string / array / single-field-object / multi-field-object message flattening
    - `{message:[]}`, `{message:{}}`, `{message:''}` return `undefined`
    - nested-object field value is JSON-stringified, not `[object Object]`
    - null, undefined, a bare string, and a number return `undefined`

    The existing test at gitlab.test.ts:2640-2642 (`'returns undefined when there is no message key'`,
    asserting `{ error: 'insufficient_scope' }` is `undefined`) encodes the OLD contract and is
    intentionally superseded. Replace its body with a genuinely key-less case such as
    `{ status: 400 }`, and keep its intent by renaming it to reflect "no message and no error key".
  </behavior>
  <action>
    In `taskflow/src/services/gitlab.ts`, refactor the flattening arms of `flattenGitLabError`
    (lines 1140-1173) into a local helper that takes one `unknown` candidate value and returns the
    flattened string or `undefined`-when-empty, then apply it first to `body.message` and, when that
    yields nothing, to `body.error`. Do not duplicate the string / array / field-keyed-object /
    nested-value logic across two branches — one shared arm, called twice.

    Keep the exported signature `flattenGitLabError(body: unknown): string | undefined` unchanged, keep
    the early `body === null || typeof body !== 'object'` guard, and keep the empty-flattens-to-undefined
    rule for BOTH keys so callers' `?? \`status ${n}\`` fallbacks still fire.

    Update the JSDoc above the function: state that `message` is preferred and `error` is the fallback
    (GitLab returns a bare `error` string on some param-validation and OAuth-ish responses), and keep the
    existing "do not reinvent a fourth narrower widening" warning.

    Write the tests and the implementation, then make a single commit
    (`fix(gitlab): flattenGitLabError falls back to the error key`) — a RED-only commit cannot pass the
    pre-commit hook.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/gitlab.test.ts -t "flattenGitLabError"</automated>
  </verify>
  <done>Every listed behavior passes; the whole `flattenGitLabError` describe block is green; the superseded `{ error: 'insufficient_scope' }` assertion is replaced rather than deleted outright.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Route createBranch, createMilestone, and updateMilestone through flattenGitLabError</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/services/gitlab.test.ts</files>
  <behavior>
    Add to the existing `describe('createBranch')` (gitlab.test.ts:2461), `describe('createMilestone')`,
    and `describe('updateMilestone')` (gitlab.test.ts:2283) blocks. Follow the surrounding mock style:
    `vi.mocked(mockFetch).mockResolvedValue({ ok: false, status: N, json: async () => BODY } as Response)`.

    createMilestone — the headline WR-01 case:
    - 400 with `{ message: { title: ['has already been taken'] } }` rejects with a message containing
      `title has already been taken` and NOT containing `[object Object]`
    - 400 with `{ message: [] }` rejects with `Failed to create milestone: status 400` (previously this
      produced a message ending at the colon)
    - 400 with `{ error: 'title is missing' }` rejects with a message containing `title is missing`
    - 403 with `{ message: { title: ['has already been taken'] } }` rejects with an ApiError whose
      `status` is 403, `source` is `'gitlab'`, and whose `message` contains `title has already been taken`
      and not `[object Object]`

    createBranch:
    - 400 with `{ message: { branch: ['already exists'] } }` rejects containing `branch already exists`,
      not `[object Object]`
    - 403 with the same object-keyed body rejects with `{ status: 403, source: 'gitlab' }` and a message
      containing `branch already exists`
    - 400 with `{ message: {} }` rejects with `Failed to create branch: status 400`

    updateMilestone:
    - 400 with `{ message: { title: ['has already been taken'] } }` rejects containing
      `title has already been taken`, not `[object Object]`

    Regression cases already in the file that must stay green: createBranch string-message 400,
    array-message 400, bare-401/403 ApiError, WR-11 Tests A/B/C/E (including the unparsable-body fallback
    to the literal `'Failed to create branch'` and the token-leak assertion); updateMilestone 401/403
    ApiError, `status 500` fallback, and the `title is missing` 400.
  </behavior>
  <action>
    In `taskflow/src/services/gitlab.ts`, delete the three local widenings and replace each with a
    `flattenGitLabError` call. `flattenGitLabError` is a hoisted function declaration, so `updateMilestone`
    (defined above it) can call it without moving anything.

    1. `createBranch` (lines 1358-1377): replace the `as { message?: string | string[] } | null` cast with
       an `unknown` body and `const msg = flattenGitLabError(body);`. Keep both branches exactly as they
       are otherwise — the 401/403 arm still throws `new ApiError(msg ?? 'Failed to create branch', ...)`
       and the fallthrough still throws ``Failed to create branch: ${msg ?? `status ${response.status}`}``.
       Replace the now-false "widened vs. updateMilestone's narrower typing" comment with a one-line
       pointer to `flattenGitLabError`; keep the WR-11 comment on the 401/403 arm verbatim, it documents a
       live security constraint.
    2. `createMilestone` (lines 1422-1440): identical conversion, fallback literal
       `'Failed to create milestone'`.
    3. `updateMilestone` (lines 1109-1117): replace the `as { message?: string } | null` cast and the
       `body?.message ??` expression with `flattenGitLabError(body) ??`. Leave the 401/403 branch above it
       untouched — it deliberately returns a generic ApiError without reading the body, and changing that
       is out of scope for WR-01.

    After the conversion, no function in the file may retain a local `message?: string | string[]` cast —
    the helper is the only place body shapes are widened.

    Write the tests and the implementation, then make a single commit
    (`fix(gitlab): flatten object-keyed error bodies in the three write paths (WR-01)`).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/gitlab.test.ts && grep -n "message?: string | string\[\]" src/services/gitlab.ts | grep -c . | grep -qx 0 && npm run check</automated>
  </verify>
  <done>All gitlab.test.ts tests pass, no local `message?: string | string[]` cast remains in gitlab.ts, and `npm run check` (biome + tsc) exits 0.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitLab API response → app error string | An attacker-influencable or malformed remote body is flattened and rendered into a dialog |
| App error string → request credentials | The error text must never echo the PAT, the `PRIVATE-TOKEN` header, or the request URL |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dbf-01 | Information Disclosure | `createBranch` / `createMilestone` / `updateMilestone` error composition | mitigate | Error text is composed only from `flattenGitLabError(body)` or a fixed fallback literal; gitlab.test.ts:2595 (WR-11 Test E) asserts the thrown message contains neither the token nor `PRIVATE-TOKEN` and must stay green |
| T-dbf-02 | Denial of Service | `flattenGitLabError` on a hostile/deeply-nested body | accept | Input is a single already-parsed JSON body from the configured GitLab host; flattening is one non-recursive `Object.entries` pass with a `JSON.stringify` leaf — bounded by the response the app already parsed |
| T-dbf-03 | Tampering | npm/pip/cargo installs | mitigate | No new dependencies are added by this plan; no install step exists |
</threat_model>

<verification>
1. `cd taskflow && npm test` — full vitest suite green (also enforced by the pre-commit hook).
2. `cd taskflow && npm run check` — biome + `tsc --noEmit` exit 0.
3. `grep -n "message?: string | string\[\]" taskflow/src/services/gitlab.ts` returns nothing.
4. `grep -c "flattenGitLabError(" taskflow/src/services/gitlab.ts` shows the definition plus at least
   four call sites (`updateMilestone`, `updateMergeRequest`, `createBranch`, `createMilestone`).
</verification>

<success_criteria>
- An object-keyed GitLab validation body renders as readable `field detail` text in the create-branch and
  create-milestone dialogs; `[object Object]` is unreachable from all three write paths.
- An `error`-only body is surfaced instead of being discarded in favour of the bare status code.
- An empty `message` still falls back to `status N` rather than a message that stops at the colon.
- No token, header name, or URL can reach a thrown error message (WR-11 Test E green).
- 88-REVIEW WR-01 is closable: the v1.14 audit's only remaining known code gap is fixed and test-covered.
</success_criteria>

<output>
Create `.planning/quick/260813-dbf-fix-gitlab-ts-wr-01-flatten-object-keyed/260813-dbf-SUMMARY.md` when done.
</output>
