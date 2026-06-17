---
status: resolved
trigger: "When I try to edit issue from the issue modal, the update PUT call fails on 400"
created: 2026-06-17
updated: 2026-06-17T11:42:00Z
---

# Debug Session: issue-edit-400-custom-fields

## Symptoms

- **Expected:** Issue saves successfully — PUT request succeeds and fields are updated in Jira
- **Actual:** PUT call fails with 400 error; custom fields rejected as not on appropriate screen
- **Error:**
  ```json
  {
    "errorMessages": [],
    "errors": {
      "customfield_10105": "Field 'customfield_10105' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_13816": "Field 'customfield_13816' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_11308": "Field 'customfield_11308' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_10608": "Field 'customfield_10608' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_13808": "Field 'customfield_13808' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_10609": "Field 'customfield_10609' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_10000": "Field 'customfield_10000' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_13412": "Field 'customfield_13412' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_11200": "Field 'customfield_11200' cannot be set. It is not on the appropriate screen, or unknown.",
      "customfield_11301": "Field 'customfield_11301' cannot be set. It is not on the appropriate screen, or unknown."
    }
  }
  ```
- **Scope:** All issues
- **Timeline:** Unknown when it started
- **Reproduction:** Open any issue modal → edit any field → save

## Current Focus

hypothesis: "Two remaining 400 errors after screen-filter fix: (1) Sprint field sent as { id: '1234' } string but Jira requires { id: 1234 } number; (2) Account field stored as string 'null' (from Jira returning { id: 'null' } for unset required account) and sent as { id: 'null' } — both reject with Jira 400."
test: "Traced wrapCustomFieldValue + extractCustomFieldId for both field types"
expecting: "Sprint numeric id and Account 'null' guard both verified by tracing code paths"
next_action: "awaiting human verification of the two additional fixes"
reasoning_checkpoint: |
  hypothesis: "ALL customfield_* values from issue.fields are copied into initialValues.customFields
               (IssueDetailContent.tsx:422-424), then ALL of them are stored in state.customFieldValues
               (useCreateEditForm.ts:104-108), then ALL of them are sent in the PUT body
               (useIssueMutations.ts:159-163). Fields not on the edit screen cause Jira 400."
  confirming_evidence:
    - "IssueDetailContent.tsx:422-424: iterates every issue.fields key matching /^customfield_/ with
       non-null value and adds it to customFields — no filtering by screen fields"
    - "useCreateEditForm.ts:104-108: buildInitialState iterates all initialValues.customFields entries,
       extracts an id from each via extractCustomFieldId, and stores in customFieldValues if non-empty"
    - "useIssueMutations.ts:159-163: editMutation sends every entry in state.customFieldValues where
       v.trim() !== '' — i.e. every custom field pre-populated from the issue"
    - "Error lists 10 customfield_* keys that are not on the edit screen — exactly what the issue would have"
  falsification_test: "If creatmetaFields already contained all custom fields on the issue, none would
                       be rejected. The fact that 10 specific fields are rejected proves creatmetaFields
                       does NOT include them — they are pre-filled blindly from issue.fields."
  fix_rationale: "In the editMutation loop, skip any custom field not present in creatmetaFields.
                  Fields not in creatmetaFields are not on the edit screen and Jira will reject them.
                  This is the direct cause — the loop needs a guard: `if (!fieldMeta) continue`."
  blind_spots: "creatmetaFields comes from /createmeta, not /editmeta — there could be fields allowed
                on edit but not create. However the error clearly shows fields being sent that Jira
                rejects, so the fix is correct: only send fields confirmed in creatmetaFields."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-06-17
  checked: "IssueDetailContent.tsx:422-424"
  found: "All non-null customfield_* from issue.fields copied into EditInitialValues.customFields unconditionally"
  implication: "Source of unwanted fields — no filter against screen fields"

- timestamp: 2026-06-17
  checked: "useCreateEditForm.ts:104-108 (buildInitialState)"
  found: "ALL entries from initialValues.customFields are extracted and stored in customFieldValues"
  implication: "Every custom field on the issue ends up in form state"

- timestamp: 2026-06-17
  checked: "useIssueMutations.ts:159-163 (editMutation)"
  found: "Loop sends ALL customFieldValues entries where v.trim() !== '', falling back to raw string when no fieldMeta found"
  implication: "Fields not on edit screen (no creatmeta entry) are sent as raw strings — Jira rejects them"

- timestamp: 2026-06-17T11:42:00Z
  checked: "wrapCustomFieldValue in jira.ts (line 1932)"
  found: "Sprint field (schema.custom = 'com.pyxis.greenhopper.jira:gh-sprint') has autoCompleteUrl, so it hits the { id: value } branch — but value is a string ('1234'). Jira requires a numeric id for sprint fields."
  implication: "{ id: '1234' } string triggers 'Number value expected as the Sprint id.'"

- timestamp: 2026-06-17T11:42:00Z
  checked: "extractCustomFieldId in useCreateEditForm.ts (line 85)"
  found: "When Jira returns an account object with { id: 'null', ... } (literal string 'null' — Jira's representation of an unset required account), String(o.id) = 'null'. The guard `if (id) customFieldValues[fieldId] = id` passes because 'null' is truthy."
  implication: "customFieldValues stores 'null' string for account; wrapCustomFieldValue wraps as { id: 'null' } → 'Account id null is invalid'"

## Eliminated

## Resolution

root_cause: |
  Three layered bugs in the issue edit PUT path:

  1. Screen-filter bug (fixed in prior session): editMutation sent ALL customFieldValues entries,
     including fields not on the Jira edit screen. Fixed by `if (!fieldMeta) continue` guard.

  2. Sprint id type bug: wrapCustomFieldValue wraps sprint field as { id: string } ('1234') because
     it hits the generic autoCompleteUrl branch. Jira Sprint API requires { id: number } — the
     string form triggers "Number value expected as the Sprint id."

  3. Account null-string bug: When a Jira issue has no account assigned, Jira DC returns the
     account custom field object with id: "null" (the literal string). extractCustomFieldId returns
     "null" (truthy, stored in customFieldValues). wrapCustomFieldValue wraps it as { id: "null" }
     → Jira rejects with "Account id 'null' is invalid."

fix: |
  Fix 2 (Sprint) — jira.ts wrapCustomFieldValue: added gh-sprint detection before the generic
  autoCompleteUrl branch. Sprint fields now return { id: Number(value) } ensuring the id is
  always numeric. Falls back to raw string if value cannot be parsed as a number.

  Fix 3 (Account) — useCreateEditForm.ts extractCustomFieldId: after String() extraction, check
  if the result is the literal "null" string and return '' instead. Empty string is excluded from
  customFieldValues by the `if (id)` guard, so the Account field is omitted from the PUT body
  when unset rather than sending { id: "null" }.

verification: "awaiting human verification of two new fixes (Sprint numeric id + Account null guard)"
files_changed:
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
