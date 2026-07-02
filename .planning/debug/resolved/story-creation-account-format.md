---
status: awaiting_human_verify
trigger: "story creation fails on account format — additional_fields must use bare values (numeric string for Tempo Account, integer for Sprint, bare issue key for Epic Link), not wrapped in {id:} or {value:} objects"
created: 2026-06-30
updated: 2026-06-30
---

## Current Focus

hypothesis: wrapCustomFieldValue wraps Sprint as { id: number } and Tempo Account as { id: string }, but the Jira DC REST API expects Sprint as a bare integer and Tempo Account as a bare string for issue creation.

reasoning_checkpoint:
  hypothesis: "wrapCustomFieldValue wraps Sprint as { id: numId } and Tempo Account as { id: value } string — both must be bare values"
  confirming_evidence:
    - "Sprint branch in wrapCustomFieldValue: `return { id: numId }` — object wrapper"
    - "Tempo Account falls through to generic autoCompleteUrl branch: `return { id: value }` — object wrapper. deriveAutoCompleteUrl adds an autoCompleteUrl for any field with schema.custom containing 'tempo-accounts', and schema.type is not 'string', so it always hits this branch."
    - "Symptoms explicitly state bare values: numeric string for Tempo Account, integer for Sprint"
  falsification_test: "If Jira DC accepted { id: numId } for Sprint, story creation with Sprint set would succeed — but it fails"
  fix_rationale: "Sprint: return numId (bare integer). Tempo Account: add check for schema.custom includes 'tempo-accounts' before the generic autoCompleteUrl branch to return bare string. Epic Link is set directly in useIssueMutations.ts (not through wrapCustomFieldValue) as a bare string — already correct."
  blind_spots: "Other autoCompleteUrl non-string fields (Jira Fix Versions, Components) still need { id: value } — the generic branch must remain for those."

next_action: patch wrapCustomFieldValue in jira.ts (two changes: Sprint returns bare integer, Tempo Account returns bare string)

## Symptoms

expected: Story creation sends additional_fields as bare values — Tempo Account as bare numeric string (e.g. "8886"), Sprint as single integer (e.g. 7782), Epic Link as bare issue key string (e.g. "PROJ-18643").
actual: Story creation fails on account format — API rejects the payload, likely because fields are wrapped in {"id": ...} or {"value": ...} objects instead of bare values.
reproduction: Create a new story in the app with a Tempo Account, Sprint, and/or Epic Link set.
started:

## Evidence

- timestamp: 2026-06-30
  checked: wrapCustomFieldValue in taskflow/src/services/jira.ts:1947
  found: |
    Sprint (gh-sprint): returns { id: numId } — integer wrapped in object
    Tempo Account (tempo-accounts): falls through to generic autoCompleteUrl branch returning { id: value } — string wrapped in object
    deriveAutoCompleteUrl at line 1968 injects an autoCompleteUrl for any field whose schema.custom includes 'tempo-accounts'
  implication: Both Sprint and Tempo Account values are incorrectly wrapped in { id: } objects on create

- timestamp: 2026-06-30
  checked: useIssueMutations.ts create path (line 70)
  found: Epic Link set via `options[epicLinkFieldKey] = state.epicLinkKey` — bare string, no wrapping — correct
  implication: Epic Link from symptoms is already correctly implemented; only Sprint and Tempo Account need fixing

## Resolution

root_cause: wrapCustomFieldValue wraps Sprint as { id: integer } and Tempo Account as { id: string } when both must be bare values (integer and string respectively) per the Jira DC REST API
fix: |
  In wrapCustomFieldValue (jira.ts:1947):
  1. Sprint branch: changed `return { id: numId }` to `return numId` (bare integer)
  2. Added Tempo Account branch before the generic autoCompleteUrl branch: `if (field.schema.custom?.includes('tempo-accounts')) return value` (bare string)
  3. Updated return type signature to include `number`
  Added 6 regression tests in jira.test.ts covering all branches.
verification: |
  All 6 new wrapCustomFieldValue tests pass. Pre-existing ISSUE-03 failure confirmed unrelated (was failing before this change). Other autoCompleteUrl fields (versions, components) still return { id: value } as expected.
files_changed: [taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts]
