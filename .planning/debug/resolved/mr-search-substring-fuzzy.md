---
status: resolved
trigger: "On the merge requests page the search is (i think) only matching based on start, i want it better and match in the middle, fuzzy, ... Like a normal search"
created: 2026-11-16
updated: 2026-11-16
---

## Symptoms
- expected: normal search — substring (mid-word), any word order, typo-tolerant
- actual: only word/prefix matches; results ignore the state tab
- errors: none
- timeline: since MR list page was built
- reproduction: Merge Requests page → type part of a word from an MR title

## Evidence
- timestamp: 2026-11-16 — MergeRequestListPage used searchGitLabMRs → global `/api/v4/search?scope=merge_requests&state=opened&per_page=20`: all projects, opened only, 20 cap, word/prefix matching
- timestamp: 2026-11-16 — shared matchText fuzzy cutoff 0.35 rejects dropped-letter typos (fuzzysort: "refactr" 0.345, "wrklog" 0.314)

## Eliminated

## Resolution
root_cause: page searched via GitLab's global search endpoint (word/prefix matching, wrong scope, state tab ignored, 20-result cap)
fix: lib/mr-search.ts ranks the loaded project+state list with shared matchText (title, !iid, branch, author, labels, milestone; fuzzyThreshold 0.25) merged with project+state-scoped `merge_requests?search=` (title+description, older MRs); matchText gained optional fuzzyThreshold; searchGitLabMRs removed
verification: unit tests (mr-search.test.ts, gitlab.test.ts), full suite on commit; user approved 2026-11-16
files_changed: src/lib/mr-search.ts, src/lib/mr-search.test.ts, src/lib/search-text.ts, src/routes/dashboard/MergeRequestListPage.tsx, src/services/gitlab.ts, src/services/gitlab.test.ts
commit: 538904b9
