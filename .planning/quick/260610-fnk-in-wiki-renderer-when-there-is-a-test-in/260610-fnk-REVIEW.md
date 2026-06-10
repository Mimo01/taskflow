---
phase: 260610-fnk-wiki-renderer-issue-key-linking
reviewed: 2026-06-10T00:00:00Z
depth: quick
files_reviewed: 2
files_reviewed_list:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 260610-fnk: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** quick (scoped to the 260610-fnk issue-key-linking changes)
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the new active-project issue-key linking added to `WikiRenderer.tsx`: the
`rehypeIssueKeys` plugin, the `IssueKeyLink` component + `useQuery`, the
`wikiSanitizeSchema` allowlist for `<issuekeylink>`, and the `a` override that
single-owns full browse URLs.

No BLOCKER-class defects were found. The XSS surface is well contained: the
synthetic element carries only a plain string `dataKey` re-escaped through React,
sanitize runs after the plugin, and no `href`/raw-HTML is emitted. The regex is
linear (no ReDoS). However there are several correctness and robustness WARNINGs —
chiefly a `null`/error-state divergence in the strikethrough query, unnecessary
text-node fragmentation in the rehype walker, an unstable returned `visit` index,
and a project-key pattern that silently excludes single-letter projects.

## Warnings

### WR-01: `useQuery` error path throws → React Query retries/error-logs on every uncredentialed key

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:1097-1110`
**Issue:** The `queryFn` does `throw new Error('No credentials')` when the PAT read
fails or `jiraBaseUrl` is falsy. The `enabled` guard already requires
`!!jiraBaseUrl`, so the `!jiraBaseUrl` branch is dead, but the `!token` branch is
live: a transient stronghold miss (or any key where `readSecret('jira-pat')`
rejects — caught to `null`) turns the query into an *error* state. With React
Query defaults (`retry: 3`, exponential backoff) each such `IssueKeyLink` will
retry three times and surface a rejected query / console error. A description with
many keys multiplies this. The component renders fine without status, so a thrown
error is the wrong signal — it should resolve to "no status" instead.
**Fix:**
```ts
queryFn: async () => {
  const token = await readSecret('jira-pat').catch(() => null);
  if (!token || !jiraBaseUrl) return null; // no status, not an error
  return fetchIssueDetail(jiraBaseUrl, token, issueKey, { /* ...fields */ });
},
retry: false, // status is best-effort; never churn the network for strikethrough
```
(Note: `data?.fields?.status?.…` already tolerates a `null` data value, so
returning `null` is safe.)

### WR-02: Non-matching keys still fragment the text node (wasteful re-splice, possible double render)

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:1031-1054`
**Issue:** The loop pushes a segment for *every* regex match, including keys that
fail `isKnownPrefix` (pushed back as a plain `text` node — line 1045). So a text
node containing a foreign-project key like `OTHER-9` (which should be left
completely untouched) is still spliced apart into `[text, text, text]`. `segments`
is non-empty (line 1050 guard passes), the parent's single text node is replaced
by three equivalent text nodes, and `visit` is told to resume past them. This is
not a correctness break, but it needlessly mutates the tree, defeats the
"leave untouched" fast path the comment claims (line 1049), and produces extra
sibling text nodes that React must key/diff.
**Fix:** Track whether any segment was *actually linkified* and bail when none were:
```ts
let replaced = false;
// ... in the matched branch: replaced = true;
if (!replaced) return; // no linkified keys — leave the original text node intact
```

### WR-03: Returned `visit` index can point past the spliced array / skips adjacent matches

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:1054-1056`
**Issue:** After `parent.children.splice(index, 1, ...segments)` the visitor returns
`index + segments.length`, i.e. the position immediately after the last inserted
segment. The trailing-text segment (line 1052) is itself a fresh text node that may
*still contain another key* if `value` had content after the last match boundary —
but it cannot, because `matchAll` is global and consumes to end; the trailing slice
is by definition keyless. That part is fine. The real fragility is relying on
`index + segments.length` as an absolute index into a freshly-spliced array: it is
correct only because every inserted node is non-`text` or keyless, an invariant
that is easy to break in future edits (e.g. if `issuekeylink` ever gained text
children). Returning `[SKIP, index + segments.length]` is the documented form for
"skip and jump"; returning a bare number works today but is brittle.
**Fix:** Make the intent explicit and robust:
```ts
return [SKIP, index + segments.length];
```
and add a comment that inserted segments must never contain further linkifiable text.

### WR-04: Issue-key regex silently excludes single-letter project prefixes

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:980-981`
**Issue:** `ISSUE_KEY_GLOBAL_RE = /\b[A-Z][A-Z0-9_]+-\d+\b/g` requires at least two
characters before the `-` (`[A-Z]` + `[A-Z0-9_]+`). Jira permits single-letter
project keys (e.g. `X-1234`). Such keys are never linkified in prose, and
`isKnownPrefix('X-1','X')` would pass but is unreachable because the regex never
emits the key. If the active project is single-letter this feature is silently
dead. (The comment claims the pattern is "mirrored from internalLinks.ts" — it is
consistent with that file, so the limitation is shared, but it is still a real
gap.)
**Fix:** Allow a 1+ char prefix: `/\b[A-Z][A-Z0-9_]*-\d+\b/g` (and matching
`/^[A-Z][A-Z0-9_]*-\d+$/` for the exact pattern). Verify against
`internalLinks.ts` so both stay aligned.

### WR-05: `\b` word boundary lets underscore-adjacent text suppress valid keys

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:980`
**Issue:** `_` is a word character in JS regex, so `\b` does not fire between `_`
and `A`. A key written as part of `release_PROD-123` will not be matched (no
boundary before `PROD`), while `(PROD-123)` matches. This is mostly desirable
(avoids matching mid-token), but combined with the trailing `\b` it also means a
key immediately followed by `_` (`PROD-123_v2`) fails the trailing boundary and is
dropped, and `PROD-12.3` keeps only `PROD-12` (the `.` is a boundary). Worth a
conscious decision + a test fixture documenting the boundary behavior rather than
leaving it implicit.
**Fix:** No code change required if current behavior is intended, but add explicit
test cases for `_`-adjacent and punctuation-adjacent keys so the boundary contract
is pinned, and document it next to the regex.

## Info

### IN-01: `enabled` reads `jiraConnected` from store but query key omits it

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:1096,1109`
**Issue:** `queryKey` is `['jira-issue-detail', issueKey, jiraBaseUrl]` while
`enabled` additionally depends on `jiraConnected`. This matches PeekPanel by
design (cache sharing), so it is acceptable, but note that toggling
`jiraConnected` will not invalidate or refetch on its own — the gate only stops
*new* fetches. Low impact; flagged for awareness.

### IN-02: `IssueKeyLink` reads five settings-store fields solely to forward to `fetchIssueDetail`

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:1085-1106`
**Issue:** The five `*FieldKey` values are pulled from `useSettingsStore()` and
passed to `fetchIssueDetail`, but `IssueKeyLink` only consumes `statusCategory`.
This subscribes every linkified key to settings-store changes it does not care
about, and couples a tiny status probe to the full issue-detail field contract.
Harmless functionally; consider a lighter status-only fetch or a selector that
subscribes to nothing it does not use.

### IN-03: `a`-override path fires the status query for keys outside the active project

**File:** `taskflow/src/routes/dashboard/WikiRenderer.tsx:1306-1310`
**Issue:** When a full browse URL resolves via `tryInternalPath` to `/issue/KEY`,
the override renders `IssueKeyLink` unconditionally — without the `isKnownPrefix`
gate the prose path uses. This is intentional per the comment (single-owning the
anchor to avoid nested `<a>`), but it means foreign-project browse links also fire
the deduped status query and may show strikethrough. Confirm this is the desired
product behavior; the prose vs. anchor paths apply different linkification rules.

---

_Reviewed: 2026-06-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
