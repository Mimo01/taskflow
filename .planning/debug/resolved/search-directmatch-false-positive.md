---
slug: search-directmatch-false-positive
status: resolved
trigger: "In search of the application, direct match result sometimes shows incorrect issue, even if the issue is not matched directly"
created: 2026-06-18
updated: 2026-06-18
---

# Debug Session: search-directmatch-false-positive

## Symptoms

- **Expected:** The global/command search "direct match" result only appears when the
  current query actually matches an issue (by key or text).
- **Actual:** The direct-match result row shows a match when none exists for the current
  query — i.e. a false-positive / incorrect issue is surfaced as the direct match.
- **Location:** Global/command search (CommandPalette — `taskflow/src/components/app/CommandPalette.tsx`).
- **Manifestation:** "Shows match when none exists" — a direct-match row appears even
  though nothing actually matches the typed query.
- **Reproduction:** Not reliably pinned down by user ("sometimes"). Suspect a timing/race
  between async issue lookup and the rendered query, or stale state retained across
  keystrokes (previous match leaking into the current render).

## Current Focus

hypothesis: "keepPreviousData on the key-lookup useQuery causes stale keyMatchResult to
  persist when resolvedKeyLookup becomes '' (query disabled), making the Direct Match
  group render with the prior match result."

reasoning_checkpoint:
  hypothesis: "placeholderData: keepPreviousData on ['search','key',resolvedKeyLookup]
    retains the last non-null result when the query is disabled (resolvedKeyLookup='').
    The render guard {keyMatchResult && ...} shows the Direct Match row with stale data."
  confirming_evidence:
    - "Line 195: placeholderData: keepPreviousData present on keyMatchResult query."
    - "Line 191-193: enabled only when resolvedKeyLookup.length > 0; becomes disabled
      when user types plain text (no key pattern match). React Query does not clear data
      when a query is disabled — it holds the previous value."
    - "Line 341: render guard is simply {keyMatchResult && ...} — no check that the
      current query actually produced this result."
  falsification_test: "If removing keepPreviousData fixes it: a query-key change to a
    disabled state would return undefined from useQuery. If keyMatchResult becomes
    undefined when disabled, no false-positive can render."
  fix_rationale: "Remove keepPreviousData from the key-lookup query. When disabled,
    React Query returns undefined for data, so keyMatchResult will be undefined and
    the Direct Match group will not render. Alternatively (belt+suspenders): also gate
    the render on resolvedKeyLookup being non-empty, so even with stale data the row
    is hidden when the current query doesn't match a key pattern."
  blind_spots: "There is a second race: while a new key fetch is in-flight (for a
    different key), keepPreviousData would hold the OLD key's result. Removing
    keepPreviousData addresses both the disabled-state case and the in-flight case."

next_action: apply fix — remove keepPreviousData from keyMatchResult query AND add
  resolvedKeyLookup guard to the render condition

## Evidence

- timestamp: 2026-06-18
  checked: CommandPalette.tsx lines 185-195, 341
  found: "placeholderData: keepPreviousData on the ['search','key',resolvedKeyLookup]
    useQuery. When resolvedKeyLookup becomes '' (user types non-key text), the query
    is disabled but data is NOT cleared — holds the prior JiraIssue."
  implication: "Any previous successful key lookup leaks into the current render,
    showing an incorrect Direct Match result."

- timestamp: 2026-06-18
  checked: fetchJiraIssueByKey (jira.ts line 1706)
  found: "Returns null on 404/network error, JiraIssue on success. No issue with the
    fetcher itself."
  implication: "Bug is entirely in how the caller retains and renders the result."

## Eliminated

## Resolution

root_cause: "placeholderData: keepPreviousData on the key-lookup useQuery
  (['search','key',resolvedKeyLookup]) causes React Query to retain the previous
  JiraIssue result when the query becomes disabled (resolvedKeyLookup='', i.e. user
  types text that doesn't match a Jira key pattern). The Direct Match render guard
  {keyMatchResult && ...} has no check that the current query warranted the lookup,
  so the stale result is displayed as a false-positive match."
fix: "1. Removed `placeholderData: keepPreviousData` from the key-lookup useQuery in
  CommandPalette.tsx. Without it, React Query returns undefined for data when the
  query is disabled (resolvedKeyLookup=''), so no stale result leaks into render.
  2. Added `resolvedKeyLookup &&` guard to the Direct Match render condition as a
  belt-and-suspenders check — even if React Query somehow retained a stale value,
  the row cannot render when the current query has no key pattern."
verification: "TypeScript check (tsc --noEmit) passes clean. Logic verified: when
  resolvedKeyLookup is '', query is disabled and data is undefined; when
  resolvedKeyLookup is non-empty but fetch is in-flight, data is also undefined
  (no keepPreviousData bridge to prior key's result)."
files_changed:
  - taskflow/src/components/app/CommandPalette.tsx
