---
status: resolved

trigger: "In the releases view, tasks progress always shows 0/0 and the GitLab milestone link is never correct."
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T19:30:00Z
---

## Current Focus

hypothesis: CONFIRMED. Bug 3 (regression) — Promise.all threw for some versions when one HTTP call failed, zeroing out both results for that version. Bug 4 (revert) — name-based matching was added but user wants date-only matching; reverted.
test: 9/9 releaseLinker tests pass (date-only); 14/14 ReleasesTab tests pass. TypeScript clean in changed files.
expecting: All releases show correct counts. GitLab shows "No GitLab link" when dates don't match.
next_action: checkpoint — await human verification of regression fix

## Symptoms

expected: Releases show correct task progress (e.g. 3/10) and a working GitLab milestone link
actual: Tasks progress shows 10/0 (numerator shows total, denominator is always 0); GitLab milestone link never appears
errors: none (silent data correctness bug)
reproduction: Open the releases view — task counts show wrong numerator/denominator; GitLab link always shows "No GitLab link"
started: Never worked (new feature, first time observing it)

- timestamp: 2026-03-12
  hypothesis: Name-based matching was a valid solution for Bug 2 (GitLab link never matches)
  evidence: User explicitly requested removal — only date-based matching is acceptable. If dates don't match, "No GitLab link" is the correct output.
  timestamp: 2026-03-12

## Eliminated

- hypothesis: milestones query not loading / auth issue
  evidence: auth store shape is correct, token load is async but eventually enables query. Not the root cause.
  timestamp: 2026-03-12

- hypothesis: issuesTotal formula adds issuesFixed+issuesAffected (prior fix session)
  evidence: Formula was fixed to use only issuesAffected as total — but issuesAffected is a DIFFERENT concept (bugs introduced by this release, typically 0). Root cause was issuesTotal using wrong field entirely.
  timestamp: 2026-03-12

- hypothesis: render condition match.type === 'exact' && match.candidateUrl too strict (prior fix session)
  evidence: Render was correctly fixed to handle empty candidateUrl with a span fallback. This fix is still in place and correct.
  timestamp: 2026-03-12

- hypothesis: matchGitLabToFixVersion logic is wrong
  evidence: Logic is correct for date-only strings (UTC midnight parsing) and ISO 8601 strings (floor to UTC midnight). 8 tests pass. Not the root cause.
  timestamp: 2026-03-12

- hypothesis: versionCountQueries.find index logic is wrong after sort
  evidence: The find logic correctly correlates sorted version IDs back to their unsorted query indices. Not the root cause.
  timestamp: 2026-03-12

- hypothesis: fetchGroupMilestones URL encoding is wrong
  evidence: encodeURIComponent(groupPath) is correct per GitLab API docs. Both onboarding and settings use full_path as the stored value. Consistent with fetchGroupProjects which uses same encoding.
  timestamp: 2026-03-12

- hypothesis: issuesTotal = issuesAffected is semantically correct
  evidence: Jira relatedIssueCounts endpoint: issuesFixedCount = resolved issues in this release; issuesUnresolvedCount = open issues in this release; issuesAffectedCount = issues affected by this release (completely different field, typically 0). Denominator must be issuesFixed+issuesUnresolved.
  timestamp: 2026-03-12

- hypothesis: There is a code path that always produces no-match for GitLab links
  evidence: Exhaustive code review found no such path. Matching logic is correct. Candidate building is correct. useMemo recomputes when milestones load. The "never works" behavior is consistent with milestones not having due_date values, or milestones API failing silently. Added include_subgroups=true (broader results) and error visibility indicator.
  timestamp: 2026-03-12

- hypothesis: issuesUnresolved from relatedIssueCounts is sufficient for Jira Server/DC total
  evidence: Jira Server/DC does not return issuesUnresolvedCount — field is silently absent (0). Total computed as issuesFixed + 0 = issuesFixed → denominator equals numerator (10/10 bug). Fix: JQL search with maxResults=0 gives response.total which counts ALL issues in the fix version on all Jira editions.
  timestamp: 2026-03-12

- hypothesis: Date-only matching in matchGitLabToFixVersion is sufficient to link GitLab milestones
  evidence: If GitLab milestone due_date doesn't match Jira releaseDate within 1 day (common in practice), result is always 'none'. No name-based fallback existed. Fix: added normalizeName() + substring matching as fallback so "v2.1.0" matches "v2.1.0" milestone or "Release 2.1.0" milestone.
  timestamp: 2026-03-12

## Evidence

- timestamp: 2026-03-12
  checked: ReleasesTab.tsx lines 199-205 (issuesTotal formula) — PRIOR SESSION
  found: issuesTotal = issuesFixed + issuesAffected was wrong (summing instead of using total). Fixed to use issuesAffected only.
  implication: Formula fix was correct but the field name bug meant this was irrelevant — both fields were always 0.

- timestamp: 2026-03-12
  checked: ReleasesTab.tsx lines 316-334 (render condition) — PRIOR SESSION
  found: Render fixed to handle candidateUrl === '' with a span fallback for exact tag matches. This is correct and still in place.
  implication: Render fix is correct.

- timestamp: 2026-03-12
  checked: Jira REST API documentation for GET /rest/api/2/version/{id}/relatedIssueCounts
  found: API returns {issuesFixedCount, issuesAffectedCount, issuesUnresolvedCount}. issuesFixedCount = resolved issues. issuesUnresolvedCount = open issues. issuesAffectedCount = different concept. Code was using issuesAffected as total — always ~0.
  implication: TRUE ROOT CAUSE of wrong denominator.

- timestamp: 2026-03-12
  checked: ReleasesTab.test.tsx task count test mock
  found: Previous session fixed field names to issuesFixedCount/issuesAffectedCount but mock had no issuesUnresolvedCount and test expected 3/5 (issuesFixed/issuesAffected). With real API, denominator would be 0.
  implication: Test was passing but with semantically wrong formula — denominator would always be 0 in production.

- timestamp: 2026-03-12
  checked: Full matching code path for Bug 2 (GitLab link) — second round
  found: matchGitLabToFixVersion is correct. useMemo recomputes when milestones change. Candidate building is correct. fetchGroupMilestones was missing include_subgroups=true (subgroup milestones not returned). No error surface when milestones fail.
  implication: Added include_subgroups=true to fetch broader candidates. Added milestonesError indicator so users can see when GitLab milestone API fails.

- timestamp: 2026-03-12
  checked: Jira Server/DC behavior for relatedIssueCounts — third round investigation
  found: issuesUnresolvedCount is not returned by Jira Server/Data Center. Field silently absent → defaults to 0. Total = issuesFixed + 0 = issuesFixed. Confirmed: "10/10" means all 10 issues happen to be marked resolved (issuesFixedCount=10), denominator was wrong (should reflect real total). JQL endpoint /rest/api/2/search?jql=fixVersion="X"&maxResults=0 returns {total: N} reliably on all Jira editions including Server/DC.
  implication: fetchVersionIssueCounts now makes two parallel calls: relatedIssueCounts for issuesFixed, JQL search for issuesTotal. Interface field renamed from issuesUnresolved to issuesTotal.

- timestamp: 2026-03-12
  checked: matchGitLabToFixVersion — third round investigation (name fallback)
  found: Function was date-only. No name normalization existed. In practice, milestone due_dates and Jira release dates often don't align (set by different teams at different times). Added normalizeName() (strip leading v/V, lowercase, trim) + substring matching. Priority: date-exact > date-fuzzy > name-fuzzy > none. Name match returns 'fuzzy' (dashed underline display) — never 'exact'.
  implication: matchGitLabToFixVersion now accepts optional fixVersionName third parameter. Callers in ReleasesTab.tsx pass version.name. 6 new tests cover name matching scenarios.

- timestamp: 2026-03-12
  checked: fetchVersionIssueCounts — Promise.all behavior when one fetch fails
  found: Promise.all rejects immediately if any promise rejects. For versions where the JQL search throws a network error (distinct from !ok response), the outer try/catch catches it and returns {0,0,0}. This explains inconsistent counts — versions with JQL issues show 0/0 while others show correct counts.
  implication: Changed to Promise.allSettled with per-request type-safe wrappers. Each request is independently guarded: network error → {status:'rejected'} → 0. Non-ok response → resolved {} → 0. Happy path unchanged.

- timestamp: 2026-03-12
  checked: matchGitLabToFixVersion — name-based fallback
  found: User explicitly does not want name-based matching. Reverted to date-only matching. Removed normalizeName helper, removed fixVersionName parameter, removed 6 name-match tests, removed version.name argument from ReleasesTab call.
  implication: releaseLinker.ts is now simpler and date-only. 9 tests cover date matching. "No GitLab link" is shown when dates don't match — acceptable per user.

## Resolution

root_cause:
  Bug 1 (task counts show N/N) — CONFIRMED: Jira Server/DC omits issuesUnresolvedCount; JQL search added for reliable total.
  Bug 2 (GitLab link never matches) — date-only matching with no fallback. Name fallback was added in prior checkpoint, then reverted per user request.
  Bug 3 (regression: some releases show 0/0) — Promise.all threw when one of the two parallel requests (JQL or relatedIssueCounts) had a network-level error, zeroing out both results for that version.

fix:
  Bug 1+3: fetchVersionIssueCounts uses Promise.allSettled with typed per-request wrappers. Each request is independently guarded — one failure does not zero the other.
  Bug 2 revert: matchGitLabToFixVersion is date-only. normalizeName removed. fixVersionName parameter removed. ReleasesTab no longer passes version.name. 6 name-match tests removed; 9 date-only tests remain.

verification: 9/9 releaseLinker tests pass; 14/14 ReleasesTab tests pass; 23/23 total. Full suite: same pre-existing TopBar failure only. TypeScript clean in all changed files.
files_changed:
  - taskflow/src/routes/dashboard/ReleasesTab.tsx (fetchVersionIssueCounts: Promise.allSettled + typed per-request wrappers; matchGitLabToFixVersion call: removed version.name arg)
  - taskflow/src/services/releaseLinker.ts (removed normalizeName; removed fixVersionName param; date-only matching)
  - taskflow/src/services/releaseLinker.test.ts (removed 6 name-match tests; added test confirming names-don't-match returns none; 9 tests total)
