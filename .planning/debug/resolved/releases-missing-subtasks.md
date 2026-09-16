---
status: resolved
trigger: "in releases, i only see stories and bugs, i dont see subtasks marked with the fix version to be released"
created: 2026-09-16
updated: 2026-09-16
---

## Symptoms

- Expected: Subtasks with a matching fix version should appear in the Releases view alongside Stories and Bugs.
- Actual: Subtasks are completely absent from the Releases view; only Story and Bug issue types show up.
- Errors: None — silent filtering, no console/UI errors.
- Timeline: Always been this way, as far as the user knows (no known regression point).
- Reproduction: Open the Releases page, pick a release/fix-version that has Subtask-type issues assigned to it (not just Stories/Bugs) — the subtasks don't show.

## Current Focus

reasoning_checkpoint:
  hypothesis: "fetchFixVersionIssues and fetchVersionIssueCounts in taskflow/src/services/jira.ts both hardcode `issuetype not in subtaskIssueTypes()` in their JQL, which unconditionally excludes ALL subtask-type issues from the Releases view and its counts, regardless of whether the subtask itself has the fix version set."
  confirming_evidence:
    - "Direct read of taskflow/src/services/jira.ts:1283 — jql = `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes() ORDER BY created ASC, key ASC` in fetchFixVersionIssues (the query that feeds ReleaseDetailPage's issue table)."
    - "Same exclusion clause duplicated in fetchVersionIssueCounts's baseJql (jira.ts ~line 1160), so the release's summary counts also silently omit subtasks."
    - "No downstream consumer (driftDetection.ts, releaseSummaries.ts, UnifiedTaskTable.tsx) has any issuetype-based branching or subtask-nesting logic that would require excluding subtasks — the release table is a flat list of issue+MR rows, unlike Backlog/Sprint views where subtasks nest under a parent story and a parallel exclusion is architecturally justified."
  falsification_test: "If a Jira instance had no subtask ever assigned a fix version independently of its parent, removing the clause would produce zero visible change — but the user explicitly reports subtasks WITH the fix version set are invisible, confirming the exclusion clause is the blocking mechanism, not a downstream renderer that only knows how to draw Story/Bug icons."
  fix_rationale: "Removing `issuetype not in subtaskIssueTypes() AND ` from both JQL clauses lets subtasks bearing the fix version flow through the same query, table, and count logic already used for Stories/Bugs — no other code changes needed since nothing downstream special-cases issuetype."
  blind_spots: "Haven't verified live against a real Jira instance (no credentials in this environment); relying on static JQL/code reading. Also have not confirmed whether removing the clause could inflate issue counts if subtasks are conventionally NOT given their own fix version in this org's workflow (in which case this fix is a no-op, not a regression)."

- hypothesis: fetchFixVersionIssues and fetchVersionIssueCounts JQL excludes all subtask issue types via `issuetype not in subtaskIssueTypes()`, hiding subtasks that have their own fix version set
- test: read taskflow/src/services/jira.ts fetchFixVersionIssues/fetchVersionIssueCounts JQL construction; confirmed via grep for issuetype usage in release-detail consumers (none found)
- expecting: JQL clause is the sole gate; no downstream rendering/logic depends on subtasks being absent
- next_action: remove the subtask exclusion clause from both JQL queries in jira.ts and verify no test asserts the exclusion is intentional

## Evidence

- timestamp: 2026-09-16
- checked: taskflow/src/services/jira.ts fetchFixVersionIssues (line ~1283) and fetchVersionIssueCounts (baseJql)
- found: Both build JQL as `fixVersion = ${versionId} AND issuetype not in subtaskIssueTypes() ...` — subtasks are unconditionally excluded from both the issue list and the total/done counts for a release.
- implication: Subtasks assigned a fix version can never appear in the Releases view or be counted, regardless of state. This is the root cause.

- timestamp: 2026-09-16
- checked: taskflow/src/routes/dashboard/release-detail/driftDetection.ts, releaseSummaries.ts, UnifiedTaskTable.tsx for issuetype-based branching
- found: No issuetype-specific logic anywhere in the release-detail module; the table renders a flat list of issue+MR rows with no parent/subtask nesting concept.
- implication: Unlike Backlog/Sprint views (where the same exclusion pattern exists to avoid double-rendering subtasks nested under parent stories), there is no architectural reason to exclude subtasks here. The exclusion appears to be an unreflective copy of the Backlog/Sprint pattern.

## Eliminated

## Resolution

- root_cause: `fetchFixVersionIssues` and `fetchVersionIssueCounts` in taskflow/src/services/jira.ts both hardcoded `issuetype not in subtaskIssueTypes()` in their JQL, unconditionally excluding subtask-type issues from the Releases view's issue list and summary counts, even when a subtask has the fix version set directly. No downstream consumer (driftDetection.ts, releaseSummaries.ts, UnifiedTaskTable.tsx) has parent/subtask nesting logic that depended on this exclusion — unlike Backlog/Sprint views where the same pattern exists for a real architectural reason (subtasks render nested under their parent story there).
- fix: Removed the `issuetype not in subtaskIssueTypes()` clause from both JQL builders in taskflow/src/services/jira.ts (`fetchFixVersionIssues`'s `jql` and `fetchVersionIssueCounts`'s `baseJql`), and updated their docstrings/comments to explain why the Releases view intentionally includes subtasks (flat table, no nesting) unlike the Backlog/Sprint fetchers that legitimately exclude them.
- verification: Ran full existing test suites for src/services/jira.test.ts, ReleasesTab.test.tsx, ReleasesTab.versionCountsParity.test.tsx, useReleaseDetail.test.tsx, and the whole release-detail directory — 175 + 406 tests pass with no regressions (no test asserted the removed exclusion clause). User confirmed fix live in the app: "yes, fixed — verified in the app."
- files_changed: [taskflow/src/services/jira.ts]
