---
status: partial
phase: 88-release-branch-milestone-creation
source: [88-01-SUMMARY.md, 88-02-SUMMARY.md, 88-03-SUMMARY.md, 88-04-SUMMARY.md, 88-05-SUMMARY.md, 88-06-SUMMARY.md, 88-07-SUMMARY.md, 88-08-SUMMARY.md, 88-09-SUMMARY.md, 88-10-SUMMARY.md, 88-11-SUMMARY.md, 88-VERIFICATION.md, 88-HUMAN-UAT.md]
started: 2026-08-12T07:26:22Z
updated: 2026-08-12T07:40:00Z
---

## Current Test

[testing paused — 7 items outstanding]

## Tests

### 1. Release Branch row appears in the release detail sidebar
expected: Sidebar shows a "Release Branch" row directly below "GitLab Milestone", with the derived `release/X.Y.Z` name and either a green check (exists) or orange warning (missing).
result: pass

### 2. Branch row edge states (no milestone / underivable / invalid name)
expected: For a release with no matched milestone the row says the branch is blocked until the milestone exists; for a milestone title with no X.Y.Z version token (e.g. "Sprint 42") it reports the name can't be derived — it never invents a guessed branch name.
result: pass

### 3. Create-branch dialog opens with correct copy and gating
expected: On a "missing" branch row, a "Create branch" button appears. Clicking it opens a confirm dialog titled "Create release branch" with Cancel and "Create branch" buttons. In the blocked/underivable states the button is present but disabled with an explanatory tooltip ("Create the milestone first", "Branch name can't be derived from this milestone title").
result: pass

### 4. Live create-branch against real GitLab (RELBR-04)
expected: Confirming the dialog creates the branch off the project's real default branch (not a hardcoded "main"), the dialog closes, and the sidebar row flips from "missing" to "exists" without a manual refresh. If GitLab rejects it (protected branch / missing api scope), the dialog stays open and shows GitLab's own message text.
why_human: 88-11 Task 2 waived — no createBranch call has ever run against live GitLab; coverage is mocked-fetch unit tests only.
result: skipped

### 5. Create-milestone dialog: prefill, format hint, recent list, duplicate block
expected: On a release with no matched milestone, a "Create milestone" button appears next to "No milestone matched". The dialog prefills the title as `X.Y.Z (DD.MM.YYYY)` from the version name and Jira release date, shows "Format: X.Y.Z (DD.MM.YYYY)", lists recent milestones newest-first, and refuses to submit a title that duplicates an existing milestone or breaks the format. If the version has no release date the button is disabled with "Set a release date on this version first".
result: skipped

### 6. Live create-milestone + Releases-list propagation (RELMS-02)
expected: Confirming creates the milestone in GitLab with the right title and due date; the dialog closes; the detail sidebar shows the match; navigating back to the Releases list shows the release as linked without a manual refresh/restart.
why_human: 88-11 Task 3 waived — the project-granular cache invalidation fix is verified only by unit test, never observed against a real GitLab response.
result: skipped

### 7. Releases-list drift indicators
expected: In the Releases list, rows whose release branch or GitLab milestone is missing show a small orange warning icon with a hover tooltip explaining which is missing. No warning appears while the data is still loading, on versions with no release date, or on already-released versions. If the branch fetch fails, a "GitLab unavailable" chip appears in the header instead of false "missing" warnings on every row.
result: skipped

### 8. Branch-check failure shows Retry, not "missing"
expected: If the branch-existence check fails (e.g. GitLab briefly unreachable), the sidebar row reads "Couldn't check the release branch" with a working Retry button — it does not claim the branch is missing and offers no "Create branch" button. Retry re-runs the check and resolves the row.
result: skipped

### 9. Dialogs lock while the write is in flight
expected: After confirming in either create dialog, the button reads "Creating…", Cancel is disabled, and pressing Escape or clicking the backdrop does not close the dialog until the write finishes. On failure the dialog stays open with the error; on success it closes.
result: skipped

### 10. Restricted-PAT error surfacing in both dialogs
expected: With a PAT lacking write scope, a 401/403 renders GitLab's explanatory message inside the dialog (not a generic "request failed"), and never leaks the token. A duplicate-title rejection renders readable text, not the literal `[object Object]`.
why_human: 88-11 Task 4 waived — no scope-restricted PAT was tested. WR-01 in gitlab.ts is a known open code-level gap: the error-body cast flattens only `string` and `string[]` message shapes, not GitLab's object-keyed validation-error shape.
result: skipped

## Summary

total: 10
passed: 3
issues: 0
pending: 0
skipped: 7
blocked: 0

## Gaps

[none yet]
