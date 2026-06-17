---
status: resolved
trigger: "attachments in issues are not loading at all"
created: 2026-06-17
updated: 2026-06-17
---

## Symptoms

- **Expected:** Attachments section shows thumbnails/file list when opening an issue with attachments
- **Actual:** Section is blank / empty — renders but shows nothing
- **Errors:** No console errors visible (UI is silent)
- **Scope:** All issues with attachments — consistently broken across every issue
- **Timeline:** Was working, broke recently
- **Reproduction:** Open any issue that has attachments in Jira → issue detail page → attachments section is blank

## Current Focus

```yaml
hypothesis: "?fields=*navigable omits `attachment` (non-navigable field in Jira DC); commit 7b8d3b92 switched from explicit field list (which included 'attachment') to *navigable, silently dropping it from the response"
test: "Examined git diff of 7b8d3b92 — original code explicitly listed 'attachment' in fields array; new code uses fields=*navigable which excludes non-navigable fields"
expecting: "Adding ,attachment to the query string restores issue.fields.attachment in the response"
next_action: "Request human verification that attachments now display"
reasoning_checkpoint:
  hypothesis: "fetchIssueDetail switched from explicit fields=...attachment... to fields=*navigable; attachment is not a navigable field in Jira DC so it is absent from the response; issue.fields.attachment is undefined; AttachmentsSection receives [] and renders blank"
  confirming_evidence:
    - "git show 7b8d3b92 shows 'attachment' was in the explicit field list before the commit, then removed when switching to *navigable"
    - "AttachmentsSection receives issue.fields.attachment ?? [] — undefined ?? [] = [] → empty render"
    - "No console error because [] is a valid empty array, not an error state"
    - "Symptom is 'was working, broke recently' which matches the exact commit date (2026-06-17)"
  falsification_test: "If attachment were a navigable field, adding it explicitly would change nothing. The fix would not restore data if root cause were elsewhere (network, auth, etc.)"
  fix_rationale: "Adding ,attachment to the fields query parameter explicitly requests the non-navigable field alongside *navigable — the API then returns it as before"
  blind_spots: "Cannot confirm Jira DC field navigability from source code alone — relying on known Jira behavior that attachment is non-navigable"
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-06-17
  checked: "git log + git show 7b8d3b92 on taskflow/src/services/jira.ts"
  found: "Commit 7b8d3b92 (2026-06-17) switched fetchIssueDetail from explicit fields list (included 'attachment') to ?fields=*navigable. The 'attachment' field was explicitly present in the old list and was silently dropped."
  implication: "Jira's *navigable expansion does not include the attachment field. issue.fields.attachment becomes undefined on every issue detail load since that commit."

- timestamp: 2026-06-17
  checked: "IssueDetailContent.tsx line 259 — AttachmentsSection prop"
  found: "attachments={issue.fields.attachment ?? []}"
  implication: "When attachment is absent from API response, this evaluates to [] — blank section with no error, matching symptom exactly."

- timestamp: 2026-06-17
  checked: "AttachmentsSection.tsx initialization — useState(attachments.length > 0)"
  found: "isExpanded initializes to false when attachments is empty — section header shows 'Attachments (0)' and content is collapsed, consistent with 'blank' appearance"
  implication: "No visual error state, just empty count and collapsed body."

## Eliminated

## Resolution

```yaml
root_cause: "commit 7b8d3b92 switched fetchIssueDetail from an explicit Jira fields list (which included 'attachment') to ?fields=*navigable. The `attachment` field is not navigable in Jira DC and is therefore excluded from *navigable responses. issue.fields.attachment became undefined on every fetch, falling back to [] in the UI."
fix: "Changed ?fields=*navigable to ?fields=*navigable,attachment in fetchIssueDetail URL (jira.ts line ~1631). This explicitly requests the non-navigable attachment field alongside all navigable fields."
verification: "confirmed by user — attachments now display correctly"
files_changed:
  - taskflow/src/services/jira.ts
```
