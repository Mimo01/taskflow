# Quick Task 261102-fy2: Polish standup notes page — respect display density and text size, show task status in rows - Context

**Gathered:** 2026-11-02
**Status:** Ready for planning

<domain>
## Task Boundary

Polish the /standup-notes page (`taskflow/src/routes/standup-notes/`). Make it respect the app's
display density (settings `density`) and text size (settings `fontScale`) consistently, and show
each task's current Jira status in its row. Must look good (visual quality is part of done).

</domain>

<decisions>
## Implementation Decisions

### Status display style (LOCKED)
- Trailing status pill, right-aligned, using the shared `statusPillClass` from `@/lib/statusStyles`
  (same pill as Backlog / release tables). Summary/title truncates first; the pill never shrinks.
- Pill must sit in a flex parent (see memory: statusPillClass needs flex parent — wrap, don't add geometry to a bare span).
- Colour comes from status category (statusCategory.key), consistent with the rest of the app.

### Where status appears (Claude's discretion — user said "you decide")
- Recommended default: every issue row — Yesterday issue group headers, nested sub-task sub-headers,
  and Today section rows (In progress, Up next, Participating). Skip a row's pill only where the
  status is redundant or unavailable (e.g. MR-only rows, "other commits" group). If a section is
  inherently one status (e.g. "In progress"), still show the pill — actual statuses differ
  (In Progress vs Code Review etc.).
- If status data isn't already in the fetched issue payloads, fetch it efficiently (add `status`
  to existing field lists / batch issue-meta), never one request per row.

### Density / text size scope (LOCKED)
- Full page: row padding/gaps follow density; text sizes AND icon sizes follow text size (fontScale)
  everywhere on the page — rows, sub-items, section headers, page header.
- Use the app's existing mechanisms (density-compact:/density-comfortable: variants already used
  in this folder; whatever fontScale mechanism the rest of the app uses — e.g. rem-based sizing).
  Do not invent a new system. Hard-coded px sizes that ignore fontScale must go.

### Claude's Discretion
- Exact spacing values per density, icon sizing approach, which rows get status (see above).

</decisions>

<specifics>
## Specific Ideas / User preferences (from memory)

- One row = one line at every density; density changes padding/font only — never stack a second line.
- Page header consistency: standard top-left header bar (text-xl, border-b, px-6 py-4).
- Colour = status only; detail pages avoid card panels.
- Italic text clipped by truncate → add pr-0.5.
- Hover affordances must not shift layout.
- For visual verification: screenshot via throwaway vite page + cached Chromium.

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/lib/statusStyles.ts` (statusPillClass)
- `taskflow/src/stores/settings.store.ts` (density, fontScale)
- Pages that already respect density/fontScale well (e.g. Backlog rows) — follow their pattern.

</canonical_refs>
