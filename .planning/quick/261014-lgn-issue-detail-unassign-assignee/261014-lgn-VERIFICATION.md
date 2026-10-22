---
phase: quick-261014-lgn
verified: 2026-10-14T15:45:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Live Jira Server/DC: open issue detail, Edit, focus Assignee, pick Unassigned, Save"
    expected: "PUT /rest/api/2/issue/{key}/assignee {name:null} returns 204; the sidebar shows Unassigned after refetch; a parent's subtask row drops the avatar"
    why_human: "Live Jira behaviour cannot be exercised here. The tests mock fetch."
  - test: "Visual check of the Unassigned option in the listbox (italic, muted, first row, no clipping)"
    expected: "Unassigned is the first row and looks right"
    why_human: "Visual appearance"
---

# Quick 261014-lgn: Unassign assignee from Edit Issue modal. Verification

**Goal:** On issue detail, the user can unassign from the Edit Issue modal through an explicit "Unassigned" option that actually unassigns.
**Status:** human_needed. All code-level truths are verified. Only the live-Jira confirmation is left.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The edit modal shows "Unassigned" as the first option (edit mode only) | VERIFIED | `CreateEditIssueModal.tsx` renders `mode === 'edit' &&` an `Unassigned` button with role=option as the first listbox child, above the Loading row and not fuzzy-filtered. The listbox gate includes `mode === 'edit'`, so it shows with an empty or loading list. Tests (a) and (e). |
| 2 | Pick Unassigned + Save sends PUT /issue/{key}/assignee with `{"name":null}` | VERIFIED | `assignIssue` in `jira.ts` builds the `/rest/api/2/issue/${key}/assignee` URL, uses PUT and `JSON.stringify({name})`. `useIssueMutations.ts` calls it after `bulkUpdateIssue`, guarded by `assigneeUnassignPicked && initialValues.assigneeName`. This is the only `assignIssue(` call. Tests (b) and the assignIssue unit tests. |
| 3 | Focus, typing or blur without a pick keeps the assignee: nothing is sent and the label is restored | VERIFIED | `onChange` and `onFocus` no longer clear `selectedAssigneeName`. `onBlur` dispatches `ASSIGNEE_BLUR`, which restores `assigneeCommittedLabel` inside the reducer, so there is no stale closure. Test (c). |
| 4 | Picking another user still reassigns with `fields.assignee = {name}` | VERIFIED | The mutation sets `{name: selectedAssigneeName}` when it differs from the initial value and no unassign was picked. `ASSIGNEE_PICK` resets the unassign flag. Test (d). |
| 5 | After unassign the detail view and the parent's subtask row show Unassigned, with no stale fallback | VERIFIED | The `fetchEnrichedSubtasks` fallback is now `fresh ? (fresh.assignee ?? null) : sub.fields.assignee`. onSuccess invalidates the `jira-subtask-enrichment` and `jira-parent-detail` prefixes. The `jira-issue-detail` invalidation is kept, and both keys match the real `useQuery` keys in `IssueDetailView.tsx`. Unit test "uses a fresh null assignee...". |
| 6 | `fields.assignee = null` is never sent from the edit path | VERIFIED | The diff removed the `: null` branch. The guard `! grep "fields.assignee = .*: null"` finds no match. Tests (b), (c) and (f) assert there is no `assignee` key in the fields. |

**Score:** 6/6

## Behavioral spot-checks

| Check | Result |
|-------|--------|
| `vitest run` on jira.test.ts, CreateEditIssueModal.test.tsx and the create-edit-issue dir | 3 files, 161 tests passed |
| `tsc --noEmit` | clean |
| `biome check` on touched files | no findings |

## Fail-without-fix proof

I copied the project into the scratchpad (rsync, with node_modules symlinked) and overwrote jira.ts, the modal, the form hook and the mutations hook with their pre-change versions from commit a64bf29a. The working tree was not touched. The new tests were kept. Result: **9 failed, 146 passed**.

- Failed without the fix:
  - assignIssue: 4 tests.
  - Enrichment fresh-null: 1 test.
  - Modal cases (a), (b), (c) and (f).
- Passed without the fix, as expected for regression guards: (d) reassign and (e) create mode has no Unassigned option.

The new tests therefore detect the missing behaviour.

## Requirements and anti-patterns

- QUICK-261014-lgn: satisfied.
- No TODO, FIXME or XXX markers were introduced in the diffs.
- No stubs found. The data flow is real: the user pick flows through the reducer, the mutation, the service call and the cache invalidation.
- The create path and the IssueDetailContent sidebar are untouched, as the locked decisions require.

## Human verification required

1. Live Jira: unassign through the modal. Expect 204, then Unassigned in the sidebar and in the parent's subtask row.
2. A quick visual check of the Unassigned row styling.

## Gaps

None. The `{name:null}` payload on the dedicated endpoint comes from research (the Atlassian KB). Only a live Jira run can confirm it.

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
