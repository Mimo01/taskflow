# Phase 23: Fix J/K Guard When Detail Sheet Open - Context

**Gathered:** 2026-03-19
**Status:** Architecturally resolved — no implementation needed

<domain>
## Phase Boundary

Suppress J/K list navigation whenever the issue detail sheet is open, preventing unintended row changes behind the sheet. Pass selectedIssueKey via Outlet context.

</domain>

<decisions>
## Implementation Decisions

### Architecture Assessment
- Issue detail was migrated from sheet/overlay to **full-page route** (`/issue/:key`) in quick task 260316-r0x
- User confirmed: full-page detail is permanent and will never revert to sheet/overlay
- When navigating to `/issue/:key`, MyTasksTab and BacklogPage **unmount entirely** — `useListNavigation` hooks unmount with them
- J/K literally cannot fire when detail is open because the list view is not in the DOM

### Success Criteria Evaluation
1. **KEYS-04 (My Tasks J/K guard):** Already satisfied — MyTasksTab unmounts on detail navigation
2. **KEYS-06 (Backlog J/K guard):** Already satisfied — BacklogPage unmounts on detail navigation
3. **selectedIssueKey in Outlet context:** Unnecessary — child routes on `/issue/:key` use `useParams()` directly; non-detail routes have no consumer for this value

### Resolution
- All three success criteria are satisfied by the existing full-page route architecture
- No code changes required
- Phase should be marked as resolved/skipped in roadmap

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Related code
- `taskflow/src/hooks/useListNavigation.ts` — The hook that would need guarding (already unmounts with parent)
- `taskflow/src/main.tsx:394` — Outlet context definition (no change needed)
- `taskflow/src/routes/dashboard/MyTasksTab.tsx:311` — useListNavigation call (unmounts on detail nav)
- `taskflow/src/routes/dashboard/BacklogPage.tsx:283` — useListNavigation call (unmounts on detail nav)

</canonical_refs>

<code_context>
## Existing Code Insights

### Key Finding
- `useListNavigation` has an `enabled` prop but no guard is needed — the hook unmounts entirely when the user navigates to issue detail
- `activeIssueKey` is derived from `location.pathname` in main.tsx but is only used for pinned tab highlighting, not for Outlet context
- Child routes already use `useParams()` to access the issue key when on `/issue/:key`

### What Changed Since Phase Was Written
- Quick task 260316-r0x: "Redo issue detail as full page with back/breadcrumb nav" — this eliminated the sheet/overlay pattern that created the J/K conflict

</code_context>

<specifics>
## Specific Ideas

User explicitly stated: "The issues detail were migrated to full page, this is intended and will never change."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-fix-jk-guard-detail-sheet*
*Context gathered: 2026-03-19*
