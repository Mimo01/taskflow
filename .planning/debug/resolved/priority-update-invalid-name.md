---
slug: priority-update-invalid-name
status: resolved
trigger: "Updating priority on issue detail fails with 'Priority name Highest is not valid'"
created: 2026-06-12
updated: 2026-06-12
---

# Debug Session: priority-update-invalid-name

## Symptoms

DATA_START
- **Expected behavior:** Changing an issue's priority on the issue detail view persists the new priority via the Jira REST API.
- **Actual behavior:** The PUT to `/rest/api/2/issue/ESHOP-20523` is rejected with HTTP error; priority is not updated.
- **Error messages:**
  ```
  REQUEST BODY
  { "fields": { "priority": { "name": "Highest" } } }

  RESPONSE BODY
  { "errorMessages": [], "errors": { "priority": "Priority name 'Highest' is not valid" } }
  ```
- **Timeline:** Reported 2026-06-12 on issue detail priority editing.
- **Reproduction:** Open issue detail (ESHOP-20523), change priority to a value the UI labels "Highest", save.
DATA_END

## Context / Hypotheses

This Jira instance uses a **custom 9-level priority scheme** (Blocker > Must > ... > Minor) — there is no priority named "Highest". The code appears to send a hardcoded/standard-Jira priority name ("Highest") rather than a name (or `id`) from the project's actual priority scheme. Prefer sending priority by `id` resolved from the issue's editmeta/priority allowedValues, or map UI labels to real scheme names.

## Current Focus

reasoning_checkpoint:
  hypothesis: "Both the issue-detail FieldsSection and the create-edit modal have a hardcoded PRIORITY_OPTIONS array ['Highest','High','Medium','Low','Lowest'] that is sent verbatim as `{ name: value }` to the Jira PUT endpoint. The instance's custom scheme has no 'Highest' (or 'High'/'Low'/'Lowest') priority — those names don't exist in the custom 9-level scheme, so Jira rejects them."
  confirming_evidence:
    - "FieldsSection.tsx:49 — `const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];`"
    - "FieldsSection.tsx:434 — `mutation.mutate({ fieldName: 'priority', value: { name: value } })` where value comes directly from PRIORITY_OPTIONS"
    - "CreateEditIssueModal.tsx:36 — identical PRIORITY_OPTIONS constant, identical submit path"
    - "Error response: `{ priority: \"Priority name 'Highest' is not valid\" }` confirms name mismatch"
    - "Issue already carries `f.priority.name` (e.g. 'Blocker') from the real scheme — the instance returns real names on read but our Select replaces with standard names on write"
  falsification_test: "If the fetch from /rest/api/2/priority returns 'Highest' as a valid name, the hypothesis is wrong. But the error message directly disproves this — Jira explicitly rejects 'Highest'."
  fix_rationale: "Replace the static PRIORITY_OPTIONS with a dynamic fetch from GET /rest/api/2/priority, which returns all priorities in the configured scheme. Populate the Select options from the API response names. This ensures the option labels and submitted names always match the instance's actual scheme — no hardcoding."
  blind_spots: "The createIssue path also accepts `priority?: { name: string }` — if create fails for priority the same fix applies, but we cannot reproduce create-path failure without testing. The fix covers both paths."

next_action: "Add fetchPriorities to jira.ts, add a usePriorities hook in FieldsSection and CreateEditIssueModal, replace PRIORITY_OPTIONS with fetched names"

## Evidence

- timestamp: 2026-06-12
  checked: FieldsSection.tsx line 49 and 618
  found: `const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest']` — hardcoded standard-Jira names used as Select items; `handlePriorityChange` passes the selected value directly as `{ name: value }` to mutation
  implication: Any instance with a non-standard priority scheme will receive a name it doesn't recognize

- timestamp: 2026-06-12
  checked: CreateEditIssueModal.tsx line 36 and 439
  found: Identical PRIORITY_OPTIONS constant; Select value sent to state.priority which is submitted as `{ name: state.priority }` in useIssueMutations
  implication: Same bug affects the create/edit modal

- timestamp: 2026-06-12
  checked: GET /rest/api/2/priority endpoint availability
  found: Jira DC exposes /rest/api/2/priority — returns array of `{ id, name, iconUrl, self }` for all priorities in the configured scheme
  implication: Can fetch actual scheme names dynamically instead of hardcoding

- timestamp: 2026-06-12
  checked: jira.ts / services/jira.ts for existing fetchPriorities
  found: No existing helper — must add one
  implication: Need to add fetchPriorities function to services/jira.ts

## Eliminated

## Resolution

root_cause: "PRIORITY_OPTIONS is hardcoded with standard Jira names ['Highest','High','Medium','Low','Lowest'] in both FieldsSection.tsx and CreateEditIssueModal.tsx. This instance uses a custom 9-level scheme (Blocker>Must>Should>Could>Won't>Critical>Major>Medium>Minor) that has no overlap with those names, causing every priority PUT to be rejected."
fix: "Added fetchPriorities / JiraPriority to services/jira.ts (calls GET /rest/api/2/priority). Removed PRIORITY_OPTIONS constant from both files. FieldsSection fetches priorities lazily (enabled: priorityEditing) with 10-min staleTime. CreateEditIssueModal fetches on open (enabled: open). Both Selects now render real scheme names from prioritiesQuery.data and submit those names verbatim to the PUT body."
verification: "tsc --noEmit: 0 errors. biome check --write: 0 errors after format fix."
files_changed:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx

## Refinement (human feedback: "a lot of statuses and not all are used")

The global GET /rest/api/2/priority returns EVERY priority on the instance, far more
than any single project's scheme uses — so the picker listed many inapplicable options.
Scoped the option set to what's valid for the actual context:

- jira.ts: added `fetchIssuePriorityOptions(baseUrl, token, issueKey)` → GET
  /rest/api/2/issue/{key}/editmeta, returns `fields.priority.allowedValues` (the
  per-issue scheme-scoped set; same mechanism as resolution allowedValues).
- FieldsSection.tsx: priority picker now fetches editmeta-scoped options for the issue,
  falling back to the global list only if editmeta omits priority. Query key now
  includes issueKey.
- CreateEditIssueModal.tsx: create mode derives scoped options from the already-loaded
  createmeta priority field `allowedValues` (no extra request); edit mode uses
  `fetchIssuePriorityOptions` keyed on initialValues.issueKey. Both fall back to the
  global list. New `priorityOptions` selects the right source by mode.

verification (refinement): "tsc --noEmit: 0 errors. biome check: 3 files clean."
