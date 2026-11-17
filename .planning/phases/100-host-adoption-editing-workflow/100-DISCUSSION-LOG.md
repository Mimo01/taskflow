# Phase 100: Host Adoption & Editing Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-11-17
**Phase:** 100-host-adoption-editing-workflow
**Areas discussed:** Inline description edit, Local drafts, Discard warnings, Keys & cleanup

---

## Inline description edit

| Option | Description | Selected |
|--------|-------------|----------|
| Pencil + click text | Header Edit action plus click-to-edit on text | |
| Pencil button only | Only the header action opens the editor | ✓ (later withdrawn) |
| Click text only | Jira-style click anywhere | |

Save row: "Below editor, right" was selected, then made moot.

Modal description: the user answered "only in edit". Asked to clarify between (1) Edit Issue modal only, with the pencil opening the modal, and (2) inline edit mode only. They chose **1**.

Amend requirements: the user answered "edit just from the edit modal, no pencil".

**User's choice:** the description is edited only in the Edit Issue modal. Detail and peek stay read-only with no pencil. HOST-02 and UI-04 are dropped.

---

## Local drafts

| Question | Options | Selected |
|----------|---------|----------|
| Draft hosts | Composer + comment edit + Edit modal / Composer + comment edit / Composer only | Composer + comment edit + Edit modal |
| Restore | Prefilled + quiet note / Prefilled silently / Offer to restore | Prefilled + quiet note |
| Conflict | Keep draft + note / Drop stale draft / Ignore | Keep draft + note |
| Lifetime | Until sent or discarded / Expire after 30 days | Until sent or discarded |

---

## Discard warnings

| Question | Options | Selected |
|----------|---------|----------|
| Warn when | Explicit cancel only / Cancel + close/navigate | Explicit cancel only |
| Warn style | AlertDialog / Inline confirm row | AlertDialog |

---

## Keys & cleanup

| Question | Options | Selected |
|----------|---------|----------|
| Esc in composer | Blur, keep text / Clear with warning | Blur, keep text |
| Cmd+Enter in Edit modal | Submits whole form / Nothing | Submits whole form |
| Cleanup scope | Delete dead files too / Textarea code only | Delete dead files too |
| Adoption order | Epic → Edit modal → comments / You decide | You decide |

## Claude's Discretion

- Adoption order, draft store shape and keys, host wiring, focus after send, composer sizing (left for Phase 102).

## Deferred Ideas

- None.
