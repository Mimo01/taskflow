# Quick Task 261116-cv2: Worklogs page — others' worklogs read-only, "copy as mine" - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Task Boundary

On the Worklogs page (taskflow/src/routes/worklogs/), only my own worklog entries are editable/deletable.
Entries authored by another person are read-only, but each offers a "Copy as mine" action that opens an
editable, prefilled form which creates a NEW worklog for me on the same issue.

</domain>

<decisions>
## Implementation Decisions

### Ownership check
- Per entry author, NOT per selected person filter. An entry is "mine" when `entry.author.name` (or `entry.author.key`)
  matches the current user (`useAuthStore`: `jiraUsername` / `jiraUserKey`). Works for the mixed "no person selected" view too.
- Not mine → no pencil, no trash, no EditWorklogForm reachable.

### Copy as mine flow
- Prefilled form: clicking "Copy as mine" on someone else's entry swaps the row (like edit does) for a create form
  prefilled with their duration, date and comment. User can edit any field, then Save creates a new worklog for me
  (createWorklog on the same issueKey). Cancel/discard returns to the read-only row. On success invalidate ['tempo','worklogs'].

### Logging on another person's view (Add New Entry / empty "+" cells)
- Keep the ability to log (empty cells stay clickable, "Add New Entry" stays), BUT it must be clearly stated the worklog
  is for ME, not the person being viewed — e.g. button label "Log as me" / form shows "Logging as {my display name}"
  (avatar optional) whenever the viewed person (or the entry being copied) is not me.
- The copy form carries the same "Logging as {me}" indicator.

### Claude's Discretion
- Exact wording/iconography (Copy icon from lucide), placement of the indicator, whether to reuse LogWorkPopover's
  form internals vs a small inline CopyWorklogForm mirroring EditWorklogForm.
- Note: viewing another person's worklogs means my newly created/copied worklog will NOT appear in the current table
  (it filters by that person) — a brief success hint is fine but not required.

</decisions>

<specifics>
## Specific Ideas

- Follow local row style: hover-revealed icon buttons in WorklogEntryRow (Copy replaces Pencil/Trash for others' entries).
- Memory rules: match the local button row style; no new card panels.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
