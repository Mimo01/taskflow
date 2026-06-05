---
phase: quick-260605-hx2
plan: rework
verified: 2026-06-05T14:25:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open ESHOP-20308 (a done-category issue) in the sidebar and click the Resolution row to edit."
    expected: "If the ESHOP workflow exposes an in-place (loop) resolution-capable transition, the Select becomes editable and shows the transition's allowedValues plus an Unresolved option; selecting a value executes the loop transition (POST /issue/{key}/transitions with fields.resolution) WITHOUT visibly changing status. If no such loop exists, the row stays read-only with the 'can only be changed via a status transition' note."
    why_human: "Whether the live ESHOP workflow actually publishes an in-place resolution-capable loop transition (to.id === currentStatusId with fields.resolution) cannot be determined from the codebase — it depends on the live Jira workflow configuration. The runtime probe is the expand=transitions.fields fetch itself."
  - test: "On ESHOP-20308, open the Status popover and pick the Resolve/Done transition; choose a resolution in the picker step that appears."
    expected: "A 'Select resolution' step renders with the transition's allowedValues; choosing one executes the transition with fields.resolution and moves the issue to the new status. Clearing to Unresolved via the sidebar (resolution: null) succeeds when offered."
    why_human: "Confirms the live transition screen accepts fields.resolution and that the Resolve transition is detected as resolution-capable by the REST expand fetch — only observable against the live ESHOP instance."
---

# Quick Task 260605-hx2 (REWORK) Verification Report

**Phase Goal:** Make issue resolution changeable via the UI by executing a Jira workflow TRANSITION (direct field PUT is rejected by this Jira). Two entry points: (1) in-place sidebar edit via FieldsSection, and (2) a resolution picker step in StatusPopover during a status change. Clearing to "Unresolved" (resolution: null) must be reachable.
**Verified:** 2026-06-05T14:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification of the rework plan

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Setting a resolution from the sidebar executes a workflow transition (POST .../transitions with fields.resolution), never a direct field PUT | ✓ VERIFIED | `resolutionTransitionMutation` calls `postTransition(..., { resolution })` (FieldsSection.tsx:351); `handleResolutionSelect` builds `{ id }` or `null` (375). Grep for any `fieldName: 'resolution'` / `updateIssueField('resolution'` across `taskflow/src` returns nothing (exit 1). |
| 2 | Sidebar Resolution row editable only when an in-place (to.id === currentStatusId) resolution-capable transition exists; read-only with explanation otherwise | ✓ VERIFIED | `inPlaceResolutionTransition = ...find(t => t.to.id === f.status.id && t.fields?.resolution)` (178-180); Select rendered only when present (551); read-only branch with note "Resolution can only be changed via a status transition." (590-600). Test: read-only + explanation case (FieldsSection.test.tsx:412). |
| 3 | Selecting a resolution uses an id from the transition's allowedValues and keeps visible status unchanged | ✓ VERIFIED | Options sourced from `inPlaceResolutionTransition.fields.resolution.allowedValues` (181-182, 579); `resolutionTransitionMutation` has NO optimistic `status.name` update (comment 338-340). Test asserts `postTransition` called with transition id + `{ resolution: { id: '1' } }` (FieldsSection.test.tsx:428-456). |
| 4 | In StatusPopover, picking a resolution-capable transition presents a resolution picker and sends the chosen resolution in that transition's fields | ✓ VERIFIED | `handleSelect` branches to `pendingResolutionTransition` when allowedValues present (StatusPopover.tsx:123-128); "Select resolution" step renders (163-178); `handleResolutionPick` → `onSelect(id, toName, { resolution: { id } })` (141-148). FieldsSection `handleTransition` forwards into `postTransition` fields (325-336). Test: capable transition surfaces picker, `onSelect` called with `{ resolution: { id: '1' } }` (StatusPopover.test.tsx:151-197). |
| 5 | The dead updateIssueField('resolution', …) path is removed from the sidebar | ✓ VERIFIED | Grep `fieldName: 'resolution'` / `updateIssueField('resolution'` over `taskflow/src` = no matches (exit 1). No `resolutionsQuery`/direct-PUT Select remains in FieldsSection.tsx. |
| 6 | postTransition includes fields only when provided; existing no-field callers send unchanged `{ transition: { id } }` | ✓ VERIFIED | Presence check `...(fields !== undefined ? { fields } : {})` (transitions.ts:51). Tests: omits fields key when no arg (transitions.test.ts:73-81), nests provided fields (52-62), preserves `{ resolution: null }` (64-71), and original `{ transition: { id: 'txn-1' } }` body test still passes (29-39). |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `taskflow/src/services/jira/transitions.ts` | postTransition optional fields + fetchIssueTransitionsWithFields + shared status-keyed key helper | ✓ VERIFIED | `fetchIssueTransitionsWithFields` GETs `expand=transitions.fields` with resolutions-style 401/403 ApiError envelope (92-114); `transitionsWithFieldsKey(issueKey, baseUrl, statusId)` factory (22-28). |
| `taskflow/src/services/jira/types.ts` | Transition field-metadata type w/ allowedValues | ✓ VERIFIED | `JiraTransitionFieldMeta` (allowedValues) + `JiraTransitionWithFields` (to.id/name/statusCategory, fields map) at 118-133; `JiraTransition` left untouched. |
| `taskflow/src/services/jira.ts` | re-exports | ✓ VERIFIED | `fetchIssueTransitionsWithFields`, `postTransition`, `transitionsWithFieldsKey` re-exported (610-614); types re-exported (615). |
| `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` | Transition-based sidebar Resolution control | ✓ VERIFIED | See truths 1-3, 5. |
| `taskflow/src/routes/dashboard/StatusPopover.tsx` | Resolution picker step during resolution-capable transitions | ✓ VERIFIED | See truth 4; plus WR-05 doomed-request block (133-136, 181-186). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| FieldsSection resolution control | postTransition(..., fields) | in-place transition mutation | ✓ WIRED | transitions.ts:351 via resolutionTransitionMutation |
| FieldsSection | GET transitions?expand=transitions.fields | fetchIssueTransitionsWithFields on-demand query | ✓ WIRED | FieldsSection.tsx:162-174, `enabled: resolutionEditing` |
| StatusPopover | onSelect(id, toName, { resolution }) | resolution-during-transition payload | ✓ WIRED | StatusPopover.tsx:143; consumed by FieldsSection handleTransition (325-336) |
| FieldsSection ↔ StatusPopover | shared cache key | transitionsWithFieldsKey(issueKey, baseUrl, statusId) | ✓ WIRED | Both use the same factory (FieldsSection:166, StatusPopover:100) — status-id-keyed per the rework requirement |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| FieldsSection Resolution Select | `resolutionAllowedValues` | `fetchIssueTransitionsWithFields` REST GET | Yes (live REST fetch, gated on edit) | ⚠️ Live-dependent — flows from real fetch; presence of in-place loop is workflow-dependent (see human_needed) |
| StatusPopover resolution step | `transitionsWithFields` | same shared REST query | Yes (live REST fetch, gated on open) | ⚠️ Live-dependent — same caveat |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Three target test files pass | `npx vitest run transitions.test.ts FieldsSection.test.tsx StatusPopover.test.tsx` | 3 files / 36 tests passed | ✓ PASS |
| Repo baseline GREEN | `npm run check` (biome check + tsc --noEmit) | Checked 460 files, no errors | ✓ PASS |
| No surviving direct-PUT resolution path | `grep -rn "fieldName: 'resolution'\|updateIssueField('resolution'" taskflow/src` | no matches (exit 1) | ✓ PASS |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/PLACEHOLDER markers in the modified files. The `?? ''` fallbacks in `transitionsWithFieldsKey(issueKey ?? '', ...)` (StatusPopover.tsx:100) are guarded — the query is `enabled` only when `issueKey`/`jiraBaseUrl` are truthy, and the comment documents this. Read-only fallback and error surfaces are intentional UX, not stubs.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| HX2-REWORK | 260605-hx2-PLAN-rework | Resolution set exclusively via transitions; both entry points; clearing reachable; backward-compatible postTransition | ✓ SATISFIED | Truths 1-6 verified; clearing offered independent of `required` (FieldsSection.tsx:565-568, test 461) |

### Human Verification Required

1. **Sidebar in-place resolution edit on live ESHOP** — Click the Resolution row on ESHOP-20308. Expected: editable Select with the transition allowedValues + Unresolved when an in-place loop exists; otherwise read-only with the explanation note. Selecting executes the loop transition without changing status. Why human: presence of an in-place resolution-capable loop transition depends on the live ESHOP workflow config, not the codebase.

2. **Resolution-during-status-change on live ESHOP** — Open the Status popover, pick Resolve/Done, choose a resolution. Expected: a resolution picker step appears and the transition executes with fields.resolution; clearing to Unresolved (resolution: null) succeeds when offered. Why human: confirms the live transition screen accepts fields.resolution and that the Resolve transition is detected as resolution-capable by the expand fetch.

### Gaps Summary

No code-level gaps. All six must-have truths are implemented with substantive, behavior-asserting tests; the three required test files pass (36 tests) and `npm run check` is GREEN. The direct-PUT path is fully removed. The only outstanding items are live-Jira UAT confirmations that the ESHOP workflow actually exposes an in-place resolution loop and accepts `fields.resolution` on its transition screens — these are inherently unverifiable from the codebase (the expand=transitions.fields fetch is the runtime probe) and are correctly surfaced as `human_needed` rather than gaps, consistent with the plan's own post-build validation step against ESHOP-20308.

---

_Verified: 2026-06-05T14:25:00Z_
_Verifier: Claude (gsd-verifier)_
