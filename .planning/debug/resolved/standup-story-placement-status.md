---
name: standup-story-placement-status
status: resolved
trigger: On standup notes page in today view, the story placement is determined by parent story status. Instead, it should be determined by the status of highest issue assigned to me (if story is assigned to me, take that; if not and just subtask, take that)
created: 2026-05-26
updated: 2026-05-26
---

## Symptoms

- **Expected:** Story placement in standup Today view should use the status of the highest-priority issue assigned to me — if I'm assigned to the story, use story status; if only assigned to a subtask, use the subtask's status.
- **Actual:** Story placement always uses the parent story's status, even when I'm only assigned to a subtask.
- **Errors:** No console errors — just visually incorrect placement.
- **Timeline:** Always been this way (not a regression — was never implemented correctly).
- **Repro:** Open standup notes → Today tab. Stories appear in wrong placement.

## Current Focus

hypothesis: resolved
test: n/a
expecting: n/a
next_action: complete
reasoning_checkpoint:
tdd_checkpoint:

## Evidence

- timestamp: 2026-05-26
  file: taskflow/src/routes/standup-notes/filterSprintItems.ts
  finding: >
    Lines 96-102: inProgress and upNext buckets both filter on
    r.issue.fields.status.statusCategory?.key — always the parent story's status.
    The STATUS PLACEMENT RULE comment even documented this explicitly as "parent's status
    category governs bucket; subtasks nest regardless." This was the intended design but
    is incorrect per the requirement.

- timestamp: 2026-05-26
  file: taskflow/src/routes/standup-notes/filterSprintItems.test.ts
  finding: >
    Test "section placement uses parent status even when parent is not assigned to me"
    explicitly asserted the wrong behavior (parent status governs even when not assigned
    to me). This test needed to be corrected along with the implementation.

## Eliminated

- Any rendering layer issue — TodayInProgressSection/TodayUpNextSection just consume
  the inProgress/upNext arrays from filterSprintItems; the bug is entirely in the
  classification logic there.

## Resolution

root_cause: >
  filterSprintItems.ts always used the parent story's statusCategory.key to decide
  inProgress vs upNext bucket placement. When the user is only assigned to a subtask
  (not the parent story), the parent's status is irrelevant to the user's actual work
  status — the subtask's status should govern placement instead.

fix: >
  In filterSprintItems.ts, parentRows now compute a _placementStatusKey per row:
  - parent assigned to me → use parent.fields.status.statusCategory.key (unchanged)
  - parent NOT assigned to me (included only via my subtask) → use the first
    my-subtask's statusCategory.key
  The inProgress/upNext filter reads this resolved key via a placementKey() helper.
  Orphan subtask rows are unchanged (always use r.issue.fields.status.statusCategory.key).
  Updated the STATUS PLACEMENT RULE comment to document the new rule.
  Updated filterSprintItems.test.ts: corrected one test that asserted old behavior,
  added two new tests covering both branches of the placement rule explicitly.

verification: All 14 unit tests pass (npx vitest run filterSprintItems.test.ts).

files_changed:
  - taskflow/src/routes/standup-notes/filterSprintItems.ts
  - taskflow/src/routes/standup-notes/filterSprintItems.test.ts
