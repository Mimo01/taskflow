---
status: resolved
trigger: "On issue detail when I click edit, in the modal window 'account' which is required is not prefilled"
created: 2026-06-17
updated: 2026-06-17
---

## Symptoms

- expected: All fields in the edit modal pre-filled with the issue's current values
- actual: Account field is empty/blank even though the issue has an account set
- errors: No visible errors in UI, console not checked
- timeline: Always — never worked as far as user can tell
- reproduction: Open any issue → click Edit button → modal opens with Account field blank

## Current Focus

hypothesis: "fetchIssueDetail requests only an explicit list of fields via ?fields=... that does NOT include the Account customfield_* key. issue.fields therefore never contains the Account value, so the Edit button onClick loop finds no customfield_* values to pass, and customFields ends up empty."
test: "Read fetchIssueDetail in jira.ts — confirmed the fields list enumerates ~20 known fields but has no mechanism to include project-specific custom fields like the Account field."
expecting: "Confirmed — issue.fields returned by fetchIssueDetail is missing the Account field entirely."
next_action: "Fix fetchIssueDetail to use *navigable so all navigable fields are returned, including project-specific custom fields."
reasoning_checkpoint: |
  hypothesis: "fetchIssueDetail fetches only an explicit named field list; Account customfield is absent from that list; issue.fields has no Account key; the Edit button loop collects nothing; customFields is always empty."
  confirming_evidence:
    - "fetchIssueDetail (jira.ts:1625-1654) builds a fields= query string from ~20 hardcoded names plus epicLinkFieldKey/storyPointsFieldKey/sprintFieldKey/epicNameFieldKey."
    - "The Account custom field has a project-specific fieldId (e.g. customfield_10XXX) that is unknown at fetchIssueDetail call time and is not in the explicit list."
    - "Jira REST API only returns fields that are explicitly requested when ?fields= is used — absent fields are simply not in the response object."
    - "IssueDetailContent.tsx Edit button iterates issue.fields looking for customfield_* keys — finds none because they were never fetched."
    - "Both BulkCreateSubtasksModal.tsx:350 and useCreateEditQueries.ts:167 already use ?fields=*navigable for the same reason (need all custom fields)."
  falsification_test: "If issue.fields contained the Account customfield key, the loop in the Edit onClick would pick it up and customFields would be non-empty — then the pre-existing extraction logic in buildInitialState would seed the input."
  fix_rationale: "Switch fetchIssueDetail to fetch *navigable fields instead of an explicit list. *navigable returns all navigable (and therefore all custom) fields including the Account field. The explicit list is a subset of navigable fields so no existing display data is lost."
  blind_spots: "Performance impact: *navigable returns a larger payload. Acceptable since this is a detail-view fetch and the codebase already uses *navigable in two other issue-fetch places."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-06-17
  checked: "useCreateEditForm.ts — EditInitialValues type and buildInitialState"
  found: "No customFields in EditInitialValues; buildInitialState hardcodes customFieldValues: {} and customFieldInputValues: {}"
  implication: "Custom fields can never be pre-filled from initialValues regardless of what is passed."

- timestamp: 2026-06-17
  checked: "IssueDetailContent.tsx line 420-428 — onEdit call"
  found: "Only passes summary, description, assigneeName, priority, storyPoints, epicLinkKey. No custom fields."
  implication: "Even if buildInitialState supported customFields, nothing is passed to it."

- timestamp: 2026-06-17
  checked: "CustomFieldsSection.tsx — account field rendering"
  found: "Reads state.customFieldInputValues[fid] for the input value; this is always '' on edit open."
  implication: "Account field input is blank every time the edit modal opens."

- timestamp: 2026-06-17
  checked: "fetchIssueDetail in jira.ts (lines 1625-1654) — the ?fields= query parameter"
  found: "fetchIssueDetail builds an explicit field list (~20 known fields + 4 dynamic keys passed by caller). The Account custom field has a project-specific fieldId (e.g. customfield_10XXX) unknown at call time and is NOT in the list. Jira DC REST API only returns fields that are explicitly listed; absent fields are simply missing from response.fields."
  implication: "issue.fields never contains the Account customfield_* key. The Edit button onClick loop that collects customfield_* entries finds nothing, so customFields is always {}. The prior fix correctly extended EditInitialValues and seeded buildInitialState, but the data to seed with was never in issue.fields — so it still produced empty output."

- timestamp: 2026-06-17
  checked: "BulkCreateSubtasksModal.tsx:350 and useCreateEditQueries.ts:167"
  found: "Both already use ?fields=*navigable for exactly this reason — need all navigable/custom fields without knowing their IDs ahead of time."
  implication: "Switching fetchIssueDetail to *navigable is the correct, established pattern in this codebase."

## Eliminated

## Resolution

root_cause: "fetchIssueDetail (jira.ts) fetches an explicit named field list that does not include project-specific custom fields like the Account field. Jira DC REST API omits any field not in the ?fields= list, so issue.fields never contains the Account value. The Edit button onClick loop in IssueDetailContent.tsx iterates issue.fields looking for customfield_* keys but finds none — so customFields is always {}. Even after the prior fix correctly extended EditInitialValues and seeded buildInitialState from customFields, the data pipeline was broken at the source: the API never returned the Account field in the first place."
fix: "Changed fetchIssueDetail to use ?fields=*navigable instead of the explicit field list. *navigable returns all navigable fields including project-specific custom fields. The _customFields parameter was kept for API compatibility (callers unchanged) but renamed with _ prefix since it is no longer used to build the fields query. This is the same pattern already used in BulkCreateSubtasksModal.tsx and useCreateEditQueries.ts."
verification: "npm run check passes. Manually verified by user — Account field now pre-fills correctly in the edit modal."
files_changed:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts (prior fix — kept)
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx (prior fix — kept)
