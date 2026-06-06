# Quick Task 260606-ugr: Redesign subtask parent-issue link - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

On subtasks, the parent-issue link is currently displayed poorly on both the full
issue page and the peek/preview panel. Redesign it so it looks polished AND
reflects that, for a subtask, the parent issue is *important* — give it real
visual weight, not a tiny muted afterthought.

Both surfaces share one component (`IssueDetailContent.tsx`), so a single change
covers the full page and the peek panel.
</domain>

<decisions>
## Implementation Decisions

User direction: "you decide. on subtasks, the parent issue is important, so
reflect that. make it look nice." → Claude has design discretion; the bar is
**prominent + polished**, not minimal.

### Current state (to replace)
`src/routes/dashboard/IssueDetailContent.tsx:225-235` renders a small muted
breadcrumb row above the issue key:
```
↗ PROJ-12 — Build login flow      (mono xs muted key + sm muted summary)
PROJ-45                            (own key)
Sub-task title                     (xl semibold)
```
It reads as a faint afterthought and the em-dash styling is weak.

### Locked design
Replace the breadcrumb row with a **prominent, clickable parent card/banner**
rendered above the issue key + title, with clear "this is the parent" framing:

- **Container:** clickable (`<button>`), full-width, rounded, subtle elevated
  surface (e.g. `bg-muted/50` or `bg-secondary`) with a border, comfortable
  padding (~`px-3 py-2`), and a clear hover state (background shift, not just
  underline). Must read as a distinct, tappable object.
- **Content (left→right):**
  - Parent **issue-type icon** via the existing `IssueTypeIcon` component, using
    the parent's *real* type name (`parent.fields.issuetype.name`).
  - A small **"Parent"** context label (muted, uppercase/xs) so the relationship
    is explicit.
  - Parent **key** in mono.
  - Parent **summary** in foreground weight (not muted), truncating gracefully
    on overflow (peek panel is narrow).
  - A trailing **navigation affordance** (e.g. `ArrowUpRight` / chevron) pinned
    right to signal "open parent".
- **Behavior:** clicking opens the parent via the existing `onOpenIssue(parent.key)`.
  Preserve the existing peek breadcrumb-trail behavior (do not regress recent
  peek breadcrumb fix).
- **Accessibility:** `aria-label` like "Open parent issue PROJ-12".

### Data dependency (key)
`IssueDetailContent` consumes `JiraIssueDetail`. `fetchIssueDetail` already
requests the `parent` field and Jira DC returns the parent's nested `issuetype`
+ `status` + `summary` (see `jira.ts:832` reading `parent.fields.issuetype.name`).
The TS type in `src/services/jira/types.ts` (lines ~46, ~169, ~191, ~1239 and the
inline `JiraIssueDetail` parent) narrows `parent.fields` to `{ summary }` only.
→ **Widen the parent type** to include optional `issuetype?: { name: string;
iconUrl?: string }` (and optionally `status`), so the icon can render without
`any` casts. Render the icon conditionally — if `issuetype` is absent at runtime,
fall back gracefully (no icon, layout still holds).

### Claude's Discretion
- Exact Tailwind tokens (bg/border/radius/spacing) — match app conventions.
- Whether to also show the parent's **status pill** inside the card (nice-to-have;
  include only if it stays clean and parent status is present — use existing
  `statusPillClass`). Lean toward including it since it reinforces parent context.
- Icon set / chevron choice (reuse lucide icons already imported).

### Out of scope
- The simpler inline parent display in `SubtasksPanel.tsx:116` (dashboard widget)
  — leave it unless trivially consistent to touch.
- No backend/API field changes (parent data already arrives).
</decisions>

<specifics>
## Specific Ideas

Reusable building blocks already in the codebase:
- `IssueTypeIcon` — `src/components/ui/issue-type-icon.tsx` (`typeName` prop,
  colored lucide icons per type).
- `statusPillClass` — `src/lib/statusStyles` (already imported in IssueDetailContent).
- Key-link convention — `font-mono text-xs` clickable (see `BacklogRow.tsx:109`).
- `cn` util and `Badge` (`src/components/ui/badge.tsx`) available if useful.

Target file: `src/routes/dashboard/IssueDetailContent.tsx` (lines ~219-238),
shared by full page (`IssueDetailView` two-column) and peek (`PeekPanel` →
`IssueDetailView` single-column).
</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements captured in decisions above. Respect recent
peek breadcrumb fix (commit 943cba44 / quick-260606-ubz).
</canonical_refs>
