# Quick Task 261112-fqd: Issue-detail section header buttons — smaller, different style - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

On issue detail, restyle the action buttons on the right of section headers (Attachments "Attach file", Subtasks "Bulk create" / "Add subtask") so they are smaller and quieter.

</domain>

<decisions>
## Implementation Decisions

### Button style (user-chosen via preview)
- Ghost variant, `size="xs"` (h-6), muted text (`text-muted-foreground`) turning `text-foreground` on hover, with hover bg from the ghost variant. No border.
- Keep icon + text label (icons shrink to size-3).
- Applies to: `AttachmentUpload.tsx` ("Attach file") and `SubtaskCreateControl.tsx` (both buttons). All must look identical.

### Claude's Discretion
- Whether to centralise the shared className (e.g. an exported constant near SectionHeader) so the buttons can't drift apart — preferred.
- Out of scope: Activity filter chips and Epic Progress metric toggle (segmented controls, not action buttons).

</decisions>

<specifics>
## Specific Ideas

Current: `variant="outline" size="sm" className="gap-1.5 text-xs"` with `size-3.5` icons.
SectionHeader row is fixed h-7, so h-6 buttons fit without changing row height.

</specifics>
