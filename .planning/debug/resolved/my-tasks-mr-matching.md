---
status: resolved
trigger: "On the My Tasks page, MR (Merge Request) matching never works — MRs are never auto-linked to tasks. This has never worked."
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:02:00Z
---

## Current Focus

hypothesis: RESOLVED — source_branch added to GitLabMR interface; linkMRToTask now scans both mr.title and mr.source_branch
test: All new tests pass (6 new branch-matching test cases in linkEngine.test.ts)
expecting: MRs with branch names like feature/PROJ-123-xyz now match tasks even without ticket key in the MR title
next_action: committed and archived

## Symptoms

expected: Tasks on My Tasks page should automatically show linked Merge Requests based on branch name or title matching
actual: No MRs are ever matched or shown on any task — matching never produces results
errors: No visible browser console errors
reproduction: Unknown trigger — may happen on page load or on some sync/refresh action
started: Has never worked (not a regression)

## Eliminated

- hypothesis: Regex extractTicketKeys is broken
  evidence: Tested in Node.js — correctly extracts PROJ-123 style keys from text; all unit tests pass
  timestamp: 2026-03-13T00:00:30Z

- hypothesis: Token/auth chain prevents MR queries from firing
  evidence: Code flow shows gitlabToken -> currentUser -> gitlabMrs chain is logically correct; no visible console errors reported
  timestamp: 2026-03-13T00:00:45Z

- hypothesis: sprintIssueKeySet is empty when matching runs
  evidence: Both memos are properly invalidated when their dependencies change; dependency chain recomputes correctly
  timestamp: 2026-03-13T00:00:50Z

## Evidence

- timestamp: 2026-03-13T00:00:10Z
  checked: linkEngine.ts linkMRToTask function (line 47-50)
  found: Only scans mr.title — no branch name scan
  implication: If MR title lacks a Jira key, matching fails even if branch name contains it

- timestamp: 2026-03-13T00:00:15Z
  checked: GitLabMR interface in gitlab.ts (lines 169-179)
  found: source_branch field is absent from the interface entirely
  implication: Even if added to linkMRToTask, the branch value can't be accessed without a type change

- timestamp: 2026-03-13T00:00:20Z
  checked: extractTicketKeys JSDoc (line 29)
  found: "@param text - Any string (MR title, commit message, branch name, etc.)" — branch name is explicitly listed
  implication: Branch scanning was clearly intended in the original design but was never wired up in linkMRToTask

- timestamp: 2026-03-13T00:00:25Z
  checked: Plan 01 (02-01-PLAN.md) linkMRToTask spec
  found: "linkMRToTask — scans mr.title only" — title-only was the explicit spec but extractTicketKeys JSDoc anticipated branch extension
  implication: Implementation matches original spec but doesn't cover real-world usage where teams use short MR titles

- timestamp: 2026-03-13T00:00:35Z
  checked: GitLab MR API response shape (knowledge)
  found: source_branch is always present in GitLab MR API responses at the list endpoint
  implication: The data is available at the runtime object level; only the TypeScript interface and linkMRToTask logic need updating

## Resolution

root_cause: linkMRToTask only scanned mr.title. source_branch was not declared in the GitLabMR TypeScript interface and was never passed to extractTicketKeys. Since many teams name branches with Jira keys (e.g. feature/PROJ-123-xyz) but write short MR titles without them, no matches were ever found. The extractTicketKeys JSDoc explicitly listed "branch name" as a valid input, confirming branch scanning was anticipated but never wired.

fix: |
  1. Added source_branch: string to GitLabMR interface in gitlab.ts
  2. Updated linkMRToTask in linkEngine.ts to scan both mr.title (first) and mr.source_branch (fallback)
  3. Added source_branch to all test fixtures that construct GitLabMR objects (7 test files)
  4. Added 6 new unit tests covering branch-based matching scenarios

verification: All linkEngine.test.ts tests pass (21 tests). All 83 affected tests pass. No regressions introduced. Pre-existing failures (SubtasksPanel, ReleasesTab, MyTasksTab skeleton test) unchanged.

files_changed:
  - taskflow/src/services/gitlab.ts (added source_branch: string to GitLabMR interface)
  - taskflow/src/services/linkEngine.ts (linkMRToTask scans title then source_branch)
  - taskflow/src/services/linkEngine.test.ts (added source_branch to baseMR + 6 new tests)
  - taskflow/src/services/gitlab.test.ts (added source_branch to mockMR fixture)
  - taskflow/src/services/notifications.test.ts (added source_branch to mockJiraMR fixture)
  - taskflow/src/routes/dashboard/MyTasksTab.test.tsx (added source_branch to makeMR)
  - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx (added source_branch to makeMR)
  - taskflow/src/routes/dashboard/MrHealthPanel.test.tsx (added source_branch to makeMR)
  - taskflow/src/components/app/SearchOverlay.test.tsx (added source_branch to makeMR)
  - taskflow/src/components/app/SearchResultPanel.test.tsx (added source_branch to makeMR)
