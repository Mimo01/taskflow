# Phase 101: Issue Drafts & Large Create/Edit Modal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-17
**Phase:** 101-issue-drafts-large-create-edit-modal
**Areas discussed:** Layout & subtasks, Create another, Draft lifecycle, Drafts chip & list

---

## Layout & subtasks

| Option | Description | Selected |
|--------|-------------|----------|
| Large, fixed | ~1080×88vh, independent main scroll, ~300px sidebar, sticky footer | ✓ |
| Near full-screen | 32px inset | |
| Grows with content | fixed width, height to 90vh | |

**User's choice:** Large, fixed. Notes: "i want it large an well usable, you decide"

| Subtasks (Create) | Selected |
|---|---|
| Staged rows + templates / Summary-only rows / Template picker only | none: "i dont need subtask creation in create story" |

| Subtasks/Links (Edit) | Selected |
|---|---|
| Existing listed + add new / Hide / Fully editable | none: "i dont need subtasks in edit" |

**Sidebar order:** You decide.

---

## Create another

| Question | Choice |
|---|---|
| Kept fields (Context fields / Everything except text / Type + epic only) | You decide |
| Feedback (Footer line / Running list / None) | You decide |
| Persist checkbox (Remember / Reset each open) | Reset each open |

---

## Draft lifecycle

| Question | Choice |
|---|---|
| Save timing (Continuous / On close only) | Continuous |
| Cancel/Esc (All closes keep it / Cancel/Esc asks / Cancel discards) | All closes keep it |
| What counts as content (User-entered text or files / Any change) | User-entered text or files |
| New vs resume (Blank always / Offer resume) | "blank but maybe offer, whatever feels right, we might change this" |
| Stale draft (Restore + inline notes / Restore as-is) | Restore + inline notes |
| Footer discard on resumed draft (Quiet link / List only) | Quiet link |

---

## Drafts chip & list

| Question | Choice |
|---|---|
| Placement (TopBar left of Search / Start of pinned strip / Icon + badge) | TopBar, left of Search |
| List (Popover newest first / Dropdown menu) | Popover, newest first |
| Discard (Inline undo / Confirm dialog / Immediate) | You decide |

## Claude's Discretion

These were left to Claude:
- exact dialog size and narrow behaviour;
- sidebar field order and the labels input;
- which fields "Create another" keeps;
- the success feedback;
- the resume hint;
- how discard works from the list;
- the draft store shape.

## Deferred Ideas

None. Subtasks in the modal were dropped by decision.
