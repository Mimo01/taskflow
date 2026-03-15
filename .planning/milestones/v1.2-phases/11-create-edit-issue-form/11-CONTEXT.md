# Phase 11: Create/Edit Issue Form - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create new Jira issues (story, subtask, bug) and edit existing ones with all required fields — including dynamically discovered instance-specific custom fields (Account field, etc.) — from a modal form that builds itself from the live Jira createmeta configuration. Issue links (relates to, blocks, is blocked by) are also addable from this form.

</domain>

<decisions>
## Implementation Decisions

### Form surface
- **Modal dialog** (not Sheet, not full-page route) — centered overlay, board/backlog stays mounted underneath
- Same modal component handles both create and edit mode — pre-filled for edit
- Modal is accessible from:
  1. **Sidebar nav** — "Create Issue" as a regular nav item, second position after Dashboard, above role-specific links. Styled as a nav link, opens dialog (not a route).
  2. **Issue detail panel** — "+ Add subtask" in the subtask list section, pre-fills issue type = Subtask and parent = current issue key
- Sprint board "+" (Phase 10 quick-create inline input) stays as summary-only quick-create — full form is the sidebar entry point

### Edit mode
- Issue detail panel gets an **"Edit" button** (alongside "Open in Jira") that opens the same Create/Edit modal pre-filled with current values
- Edit modal includes **all CREATE-03 fields**: summary, description, assignee, story points, priority, epic link
- Existing Phase 9 inline editors (assignee, priority, story points) remain on the detail panel — they coexist; edit modal is the "edit everything at once" path
- Edit modal does NOT include issue type switching (you can't change issue type on an existing Jira issue)

### Description editing
- **Formatting toolbar** above a plain textarea: bold `*text*`, italic `_text_`, inline code `` {code} ``, bullet list `*` — buttons insert wiki markup syntax at cursor position
- **Edit / Preview tab toggle** — "Edit" tab shows textarea with toolbar; "Preview" tab renders the current content through the existing jira2md + react-markdown pipeline (same renderer used in issue detail)
- Jira DC always receives wiki markup strings — no ADF sent

### Issue type & dynamic fields
- **Type switcher is the first field** in the create form — dropdown with Story / Subtask / Bug
- Switching type re-renders the field set dynamically:
  - Subtask: shows Parent field (required), hides Epic link
  - Story: shows Epic link, hides Parent
  - Bug: same fields as Story (no parent, epic optional)
- Values already entered are preserved across type switches where field names match
- **Required custom fields** (Account, etc.) are loaded from createmeta per issue type:
  - Form opens immediately with core fields visible
  - Custom required fields render with a **skeleton placeholder** while createmeta resolves
  - Submit button is blocked until all required fields have values
- Submit only sends fields confirmed present on screen (prevents "field not on screen" 400 errors from Jira)

### Issue links (CREATE-04)
- "Add link" row in the form: link type dropdown (from Jira-discovered `/rest/api/2/issueLinkType`) + issue search input
- **Type-to-search inline** — user types a Jira key or keywords; live search queries Jira and shows dropdown results; same search approach as Global Search
- Multiple link rows can be added before submitting
- Link type names are discovered dynamically — never hardcoded

### Form validation
- Summary is required, all other fields optional unless createmeta marks them required
- Client-side validation before submit (no empty required fields)
- API errors shown inline below the form (not toast) — consistent with existing rollback patterns

### Claude's Discretion
- Exact dialog width and height (reasonable desktop size, scrollable if needed)
- Animation for dialog open/close
- Exact skeleton placeholder implementation for custom fields
- Toolbar button icon choices (lucide-react icons)
- How multiple issue links are displayed in the list (compact rows)

</decisions>

<specifics>
## Specific Ideas

- The form layout mirrors the Jira create dialog — type switcher at top, summary next, description below, then the sidebar-like metadata fields in a two-column grid
- "Edit / Preview" tab toggle for description is the GitHub PR description pattern — familiar to developers on this team
- Sprint board inline quick-create (Phase 10) stays as-is (summary only, press Enter) — the sidebar "Create Issue" is the full-featured path

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createIssue()` in jira.ts: already exists but only sends summary + Story type — needs to be extended to accept full field set
- `updateIssueField()` in jira.ts: exists for single-field updates — Phase 11 likely needs a bulk `updateIssue()` that sends all edited fields in one PUT
- `discoverCustomFields()` in jira.ts: resolves story points, epic link, epic name, Account field IDs — already called during onboarding; results stored in settings store
- `WikiRenderer` component (Phase 9): jira2md + react-markdown pipeline — reuse for the Preview tab in description editing
- `sheet.tsx` (shadcn Sheet via @base-ui/react/dialog): Dialog primitive available — the modal can use the same Dialog primitive without needing a new shadcn install
- `input.tsx`, `textarea.tsx`, `select.tsx`, `button.tsx`, `badge.tsx`: all present in `src/components/ui/` — full form can be built from existing UI primitives
- `Sidebar.tsx`: nav items use `NavLink` from react-router-dom — Create Issue item will be a `button` styled to match `navLinkClass` (not a NavLink since it opens a dialog, not a route)
- Global Search (`SearchOverlay.tsx`): live Jira search pattern to reference for the issue link picker
- `fetchAssignableUsers` (if exists) or `fetchProjectMembers`: needed for assignee dropdown in the form

### Established Patterns
- TanStack Query for data fetching — createmeta, assignable users, epics list, issue link types all fetched via useQuery
- Optimistic updates + rollback — update calls follow existing `updateIssueField` pattern; invalidate sprint board + my tasks caches on success
- Stronghold PAT read pattern (async on mount) — form needs token before any API calls
- `discoverCustomFields()` result already in settings store — no re-discovery needed

### Integration Points
- `Sidebar.tsx`: add Create Issue button item between Dashboard and role-specific links
- `IssueDetailSheet` (Phase 9): add "Edit" button to header, wire to create/edit modal with pre-filled values
- Subtask list in `IssueDetailContent`: add "+ Add subtask" button, wire to create modal with type=Subtask, parent=current key
- On successful create: invalidate sprint board + backlog caches (Phase 12 depends on create being wired)
- On successful edit: invalidate `['jira-issue-detail', key]` cache + sprint board cache

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-create-edit-issue-form*
*Context gathered: 2026-03-14*
