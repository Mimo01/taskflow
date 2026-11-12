---
phase: quick-261112-jfj
verified: 2026-11-12T14:35:00Z
status: passed
score: 6/6 must-haves verified (code level); 2 live-Jira items pending
human_verification:
  - test: "On a story detail sidebar, open the Epic picker, choose a different epic, then choose 'No epic'."
    expected: "Jira accepts the Epic Link PUT (customfield epicLinkFieldKey) on this instance; the pill updates, the epic's Stories section refreshes, and no 'Save failed' footer appears. If the PUT is rejected (field not on edit screen), the Agile POST /epic/{key}/issue fallback is needed."
    why_human: "Requires live Jira; the field PUT path (updateIssueField) is unit-mocked only. Research assumption A1."
  - test: "In the picker search, type a key (PROJ-12), a bare number, and a text term on the live project."
    expected: "Server-side results appear; the key clause does not make Jira reject the JQL (otherwise it silently retries without the key)."
    why_human: "JQL acceptance and result quality depend on the live instance (assumption A2). Visual polish (pill colours, right-aligned key, check slot) is also a visual judgment."
---

# Quick 261112-jfj Verification Report

**Goal:** Shared server-searching EpicPicker in the create/edit modal plus an editable epic picker in the story sidebar.
**Status:** human_needed (all automated checks pass; live-Jira behaviours remain)

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Modal Epic Link is a Popover picker with "Search epics…", "No epic" first, pill rows, key right-aligned, check on the selected row | VERIFIED | `epic-picker.tsx` panel: Input placeholder, `No epic` option at index 0, `EpicPill` + `ml-auto` key span, fixed-width Check slot. `CreateEditIssueModal.tsx` renders `<EpicPicker variant="field" id="modal-epic-link">`; old combobox removed. |
| 2 | Debounced server-side search, open epics only, empty query = recent updated | VERIFIED | `use-epic-search.ts` (200ms debounce, key `['jira-epic-search', …]`, token read inside queryFn). `buildEpicSearchJql` scopes to `statusCategory != Done`, `ORDER BY updated DESC`, escapes tokens, with key clause and retry without it. No client-side filtering remains. |
| 3 | Trigger shows the correct pill for a Done or off-list epic | VERIFIED | `EpicPicker` resolves via `useQuery(['jira-issue-name', value, base])` with `fetchEpicSummary`, falling back to search rows, then the key. |
| 4 | Sidebar Epic row opens the same picker; set/clear goes through useFieldMutation, optimistic; "Open KEY" footer | VERIFIED | `FieldsSection.tsx` calls `mutation.mutate({ fieldName: epicLinkFieldKey, value: epic?.key ?? null })` and seeds the pill cache first. `useFieldMutation.onMutate` patches `jira-issue-detail` optimistically for any field and rolls back on error. `openAction` is `Open ${epicLink}` only when set. Always mounted, with no `epicLink ? … : '—'` branch. |
| 5 | Epic row for stories only | VERIFIED | The `isStory` gate is kept. The tests cover Story vs Epic vs Sub-task and pass. |
| 6 | After a change, `jira-epic-stories` and epic progress queries refresh | VERIFIED | `useFieldMutation.onSettled` invalidates `jira-epic-stories`, `jira-epic-worklogs` and `jira-epic-status-history`. `useIssueMutations` invalidates `jira-epic-stories` on create and edit. |

## Constraints and Checks

- `git diff 6b29db60^..1f6fc321 -- src/services/jira.ts` is empty, so `fetchEpicsBasic` is untouched.
- The dead `['epics', projectKey]` query and the `epicOpen`/`epicFilter` fields are removed (grep is empty).
- `IssueDetailSidebar` uses the shared `fetchEpicSummary`, with the same key and shape.
- `tsc --noEmit` is clean.
- vitest on `epics`, `epic-picker`, `issue-detail`, `CreateEditIssueModal` and `create-edit-issue`: 31 files, 450 passed, 2 skipped.
- biome on the 4 main touched files is clean.
- No TODO/FIXME/XXX/TBD markers in the new files.
- Threat mitigation T-jfj-01/02 is in place: escaped tokens and project key; PAT read only inside the queryFn.

## Anti-patterns

None blocking. The `epicIssue` prop is still passed to FieldsSection but its epicName/epicColor derivations were removed. tsc and biome are clean, so this is harmless.

## Human Verification Required

1. **Epic Link PUT on the live instance.** Set, change and clear the epic from a story's sidebar. If Jira rejects the field PUT, an Agile API fallback is required (not pre-built, by plan).
2. **Live JQL and visual check.** Search by key, number and text. Confirm pill colours, key alignment and the check slot look right.

---
_Verified: 2026-11-12_
_Verifier: Claude (gsd-verifier)_

## UAT (2026-11-12)

The user approved the result after testing it against live Jira, which settles the human_needed items. Changing and clearing the epic from the sidebar works through the Epic Link field PUT, so no Agile API fallback is needed. Search works.

Changes made during UAT:
- **77089ed9:** rows aligned on a shared column grid, "No epic" shown as a dashed pill, a borderless search header, and the list pills lined up with the trigger pill. Keyboard handling was also polished.
- **c5956f2e:** the check mark moved to the front of the row, as in the Fix Versions picker.
- **eeb17e65:** a flaky Enter-picks-top-hit test was fixed.

Open, non-blocking warnings from REVIEW.md (none fixed here):
- WR-01: search errors are shown as an empty result.
- WR-02: the selected pill can briefly show the raw key in the create modal.
- WR-04: the optimistic name seed is not rolled back on a failed save.
- WR-05: `fetchEpicSummary` interpolates URL values unencoded.
- WR-06: the epic search cache is not invalidated after a link change.
