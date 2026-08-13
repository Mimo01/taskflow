# Quick Task 260813-dzc: flatten Jira field-validation error bodies (errors object) - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Task Boundary

Jira splits API error bodies across two keys. Top-level failures land in `errorMessages: string[]`;
**field-validation failures land in a separate `errors` object with `errorMessages` left empty** — e.g.

```json
{"errorMessages":[],"errors":{"fixVersions":"Field 'fixVersions' cannot be set..."}}
```

Every error path in the Jira service layer reads only `errorMessages?.[0]`. Nothing in the codebase
reads `errors`. So on a field-validation rejection the real reason is **silently discarded** and the
user sees a generic fallback string.

This is the Jira-side sibling of GitLab WR-01 (quick task 260813-dbf, commits 8bab7327/6a68948d),
which was the same root cause — a narrow widening of a multi-shape error body. GitLab's version
rendered `[object Object]`; Jira's throws the information away entirely.

**In scope — the 5 known sites:**
- `services/jira.ts:1202` — fetch fix versions
- `services/jira.ts:1351` — update fix version
- `services/jira.ts:2392` — update issue
- `services/jira/versions.ts:45` — fetch fix versions (duplicate of the jira.ts:1202 logic)
- `services/jira/rank-api.ts:63` — currently throws a bare `status ${n}` with no body read at all

The planner should re-grep for `errorMessages` rather than trusting this list to be exhaustive.

</domain>

<decisions>
## Implementation Decisions

### Error shape: joined string (LOCKED)

Mirror `flattenGitLabError`. A `flattenJiraError` helper that prefers `errorMessages`, and falls
back to joining the `errors` object as `field: msg; field: msg`.

```ts
flattenJiraError({ errorMessages: [], errors: { fixVersions: "Field 'fixVersions' cannot be set" } })
// => "fixVersions: Field 'fixVersions' cannot be set"
```

**No consumer changes.** The sole consumer, `routes/dashboard/release-detail/useEditRelease.ts:151`,
collapses the rejection to `(reason as Error).message` into a single `jiraError` string slot —
structurally identical to the GitLab side. The joined string drops straight in.

Rejected: a structured `JiraFieldError` carrying a per-field map for per-input form attribution.
More useful long-term, but needs a new error class, a consumer change, and per-field UI rendering —
larger than a quick task. Not foreclosed by this work.

### rank-api.ts: include (LOCKED)

Add the body read + helper call at `services/jira/rank-api.ts:63` so rank failures surface Jira's
reason instead of a bare status. Touch **only** the error path — `rank.ts` is known-broken for P78
and its ranking logic is explicitly out of scope.

### Claude's Discretion

- Helper placement and module path (suggested: `services/jira/errors.ts`), and whether
  `flattenGitLabError`'s internals are worth sharing vs. duplicating a small amount of logic.
- Exact join separators, and how to handle nested/array values inside `errors`.
- Whether `errorMessages` present-but-empty-string should fall through to `errors`
  (GitLab's helper treats empty-flattens-to-`undefined` as a deliberate fall-through rule — match it).

</decisions>

<specifics>
## Specific Ideas

**Follow the GitLab precedent closely.** `flattenGitLabError` (`services/gitlab.ts:1186`) plus its
private `flattenErrorCandidate` are the reference implementation, freshly reviewed. Reuse its
conventions: exported helper, `unknown` input, `string | undefined` output, empty flattens to
`undefined` so the caller's `?? \`status ${n}\`` fallback still fires.

**Watch the empty-string-vs-nullish trap.** The GitLab work uncovered a latent bug where an empty
flattened message (`''`) was falsy but not nullish, so `?? \`status ${n}\`` never fired and users
saw a message ending in a bare colon. Returning `undefined` for empty avoids it.

**jira.ts dual-file gotcha.** All imports resolve to the legacy `services/jira.ts`, not the
`services/jira/` modules — `jira.ts:1202` and `jira/versions.ts:45` are duplicated logic and the
legacy one is the live path. Fix both; do not assume editing `jira/versions.ts` changes behaviour.

</specifics>

<canonical_refs>
## Canonical References

- `services/gitlab.ts:1160-1200` — `flattenErrorCandidate` / `flattenGitLabError`, the pattern to mirror
- `services/gitlab.test.ts` — the shape-coverage test table to mirror (string, array, object-keyed, nested, empty, missing)
- Quick task `260813-dbf` — the GitLab-side sibling fix and its SUMMARY

</canonical_refs>
