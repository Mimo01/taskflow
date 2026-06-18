---
slug: backlog-flag-customfield-10200
status: resolved
trigger: |
  On backlog view when I flag an issue, it fails with
  {
    "errorMessages": [],
    "errors": {
      "customfield_10200": "Field 'customfield_10200' cannot be set. It is not on the appropriate screen, or unknown."
    }
  }
created: 2026-06-18
updated: 2026-06-18
---

# Debug Session: backlog-flag-customfield-10200

## Symptoms

- **Expected behavior:** Flagging an issue from the Backlog view applies the Flagged flag (impediment) to the issue.
- **Actual behavior:** The flag operation fails.
- **Error messages:**
  ```json
  {
    "errorMessages": [],
    "errors": {
      "customfield_10200": "Field 'customfield_10200' cannot be set. It is not on the appropriate screen, or unknown."
    }
  }
  ```
- **Timeline:** Reported 2026-06-18.
- **Reproduction:** Backlog view → flag an issue.

## Current Focus

```yaml
reasoning_checkpoint:
  hypothesis: "customfield_10200 IS the correct Flagged field on this Jira instance (multicheckboxes). The PUT fails because the field is not on the issue edit screen (Jira admin configuration issue). The code is correct — discoverCustomFields finds the right field; setIssueFlagged sends the right key and value. BacklogPage silently swallows the error with no user feedback."
  confirming_evidence:
    - "settings.json persisted flaggedFieldKey=customfield_10200 AFTER the multicheckboxes guard was applied — proving 10200 passes the guard (it IS multicheckboxes)"
    - "Atlassian KB documents this exact error: field not on edit screen or hidden in field configuration"
    - "No code-level API workaround exists: overrideScreenSecurity requires Connect app admin, update format does not bypass screen security"
    - "BacklogPage catch block had no user-facing error — silent rollback is the only symptom the user experiences"
  falsification_test: "If Jira admin adds the Flagged field to the edit screen, the same PUT succeeds with zero code changes — confirming this is a Jira config issue."
  fix_rationale: "Code fix is limited to surfacing a clear error: BacklogPage now shows a dismissible banner with admin-actionable guidance when setIssueFlagged fails, matching the rankError banner pattern already in place. The Jira configuration must be corrected by an admin independently."
  blind_spots: "SprintBoardTab already shows 'Flag update failed' but without admin guidance — not changed here to keep this fix minimal. The error message cannot be made more specific (e.g. distinguish screen vs other errors) without reading the 400 response body, which updateIssueField does not currently surface."
next_action: "Human verify: flag an issue in Backlog, expect banner with admin-guidance message instead of silent rollback."
```

## Evidence

- timestamp: 2026-06-18
  checked: discoverCustomFields in jira/fields.ts and jira.ts
  found: Loop iterates all fields; sets result.flaggedFieldKey = f.id whenever f.name === 'Flagged', no break, last match wins
  implication: Second "Flagged" field (customfield_10200) overwrites the correct one (customfield_10021)

- timestamp: 2026-06-18
  checked: BacklogPage.tsx handleToggleFlag (line 766)
  found: Passes flaggedFieldKey from useSettingsStore() directly into setIssueFlagged
  implication: Whatever is stored in settings is sent verbatim to the PUT API call

- timestamp: 2026-06-18
  checked: Jira developer documentation
  found: Real impediment/Flagged field schema.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes'
  implication: Can discriminate the real field from any other "Flagged"-named field by schema type

- timestamp: 2026-06-18 (continuation)
  checked: /Users/mimo/Library/Application Support/com.taskflow.app/settings.json — persisted Tauri store
  found: "flaggedFieldKey":"customfield_10200" is stored in the persisted settings file on disk
  implication: The bad key was written before the code fix and survives app restarts. However, since React Query has no cross-session persistence (in-memory only), discoverCustomFields reruns on every app start and should overwrite this. If it still writes 10200 after the code fix, then 10200 IS the multicheckboxes Flagged field (the guard doesn't exclude it).

- timestamp: 2026-06-18 (continuation)
  checked: discoverCustomFields code after the multicheckboxes guard was applied (jira.ts lines 1546-1550, jira/fields.ts lines 62-65)
  found: Guard is present in both files. The fact that flaggedFieldKey is STILL 10200 in the persisted settings after a restart proves customfield_10200 passes the guard — meaning it IS a multicheckboxes field named Flagged.
  implication: The previous hypothesis (two Flagged fields, wrong one wins) was WRONG. customfield_10200 is THE Flagged field on this Jira instance.

- timestamp: 2026-06-18 (continuation)
  checked: Atlassian REST API docs + community research for 'Field cannot be set. It is not on the appropriate screen'
  found: This error means the field exists in Jira's registry (not unknown) but is not on the issue type's Edit screen. overrideScreenSecurity=true would bypass this but requires Connect app admin permissions — not available via PAT. update vs fields format does NOT bypass screen security. No dedicated /flag REST endpoint exists in Jira Server/DC.
  implication: The code is doing the right thing (correct field, correct value format). The error is a Jira CONFIGURATION problem — the Flagged field (customfield_10200) is not added to the Edit screen for the issue types in this project.

- timestamp: 2026-06-18 (continuation)
  checked: useCustomFieldDiscovery in main.tsx — staleTime: Infinity, queryKey: ['jira-custom-fields', jiraBaseUrl]
  found: React Query in-memory cache, not persisted across restarts. discoverCustomFields reruns fresh each app start. setFlaggedFieldKey is called with every fresh discovery result.
  implication: The persisted settings.json value of customfield_10200 gets overwritten each app start by discoverCustomFields result — which is ALSO customfield_10200 because that's the real Flagged field on this Jira instance.

## Eliminated

- hypothesis: "Two Flagged fields — real one (customfield_10021, multicheckboxes) and a wrong one (customfield_10200, different type) — multicheckboxes guard would exclude 10200"
  evidence: "settings.json shows flaggedFieldKey=customfield_10200 AFTER the multicheckboxes guard fix was applied, proving 10200 is itself a multicheckboxes field. There is only one Flagged field on this instance, and it IS customfield_10200."
  timestamp: 2026-06-18 (continuation)

## Resolution

root_cause: setIssueFlagged was performing a direct field PUT (/rest/api/2/issue/{key}, fields.customfield_*). That PUT is subject to Jira Edit-screen security, which rejects the Flagged field when it isn't on the issue type's edit screen — hence "Field 'customfield_10200' cannot be set." Jira's own agile board does NOT use a field PUT; it POSTs to the GreenHopper endpoint /rest/greenhopper/1.0/xboard/issue/flag/flag.json with {"issueKeys":[KEY],"flag":bool}, which resolves the Flagged field server-side and bypasses edit-screen security. FINAL FIX: rewrote setIssueFlagged to POST that endpoint. No Jira admin change required.

prior_root_cause (superseded): customfield_10200 IS the correct Flagged field on this Jira instance (schema multicheckboxes, name Flagged). The PUT to /rest/api/2/issue/{key} fails because the Flagged field is not on the issue's Edit screen (or is hidden in the Field Configuration scheme) in this Jira Server/DC instance. This is a Jira admin configuration issue. The code was correct all along — discoverCustomFields found the right field; setIssueFlagged sent the right key and value. The previous multicheckboxes guard fix had no effect because 10200 already passes the guard.
fix: Rewrote setIssueFlagged (jira.ts:248) to POST /rest/greenhopper/1.0/xboard/issue/flag/flag.json with {issueKeys:[key], flag} instead of a field PUT — bypasses edit-screen security entirely; _fieldKey param kept for call-site compat but unused. ALSO retained: flagError state in BacklogPage with a dismissible inline banner (same pattern as rankError). When setIssueFlagged throws, the banner shows "Couldn't update the flag — the Flagged field may not be on the issue's edit screen. Ask your Jira admin to add it." instead of silently rolling back with no feedback. The Jira admin must separately add customfield_10200 to the Edit screen for the affected issue types to make flagging work.
verification: CONFIRMED by user 2026-06-18 — flagging from Backlog works via the GreenHopper endpoint. tsc + biome clean, SprintBoardTab 25/25 pass.
reverted: The first-pass multicheckboxes schema guard in jira/fields.ts and jira.ts was reverted on 2026-06-18 (per user) — it had no functional effect since customfield_10200 already passes the guard. Only the BacklogPage error banner remains as a code change.
files_changed:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
