# Feature Research

**Domain:** Desktop Jira client — v1.12 Jira Experience Improvements
**Researched:** 2026-06-02
**Confidence:** HIGH (codebase read directly; Jira API and UX patterns verified via official docs and community sources)

---

## Scope

Seven discrete features are in scope. Each section below is self-contained: behavior description, table-stakes vs differentiator vs anti-feature classification, implementation surface, and dependencies on existing code.

---

## Feature 1: Done-State Strikethrough Consistency

### How It Works

Jira's board already strikes through the issue key (mono text) for done cards in `TaskCard.tsx` (line 114–116 — `line-through` on `statusCategory.key === 'done'`). The summary text itself is NOT struck through on the board — only the key. The three surfaces that currently lack any done-state visual treatment are:

- **BacklogRow** — the active-sprint section in `BacklogPage`. Status category is available on the `JiraIssue` object (`fields.status.statusCategory.key`). Currently no line-through applied.
- **DashboardSprintCard** — renders a progress bar and text caption; no per-issue rows are displayed, so strikethrough on individual issues is not applicable here. The card shows aggregate "done pts / total pts" — done items are already expressed numerically. What IS missing: when the sprint card lists stories (it currently does not list them individually), there is no strikethrough. Given that `DashboardSprintCard` only shows aggregate stats and does not render per-issue rows, the strikethrough for this surface means: if a story list is added to the sprint card (which is a separate design decision), done rows should have struck-through summaries.
- **Standup Today** — `TodayInProgressSection` and `TodayUpNextSection` show issue rows. These are pre-filtered to non-done statuses (In Progress / Up Next), so done stories would not normally appear there. HOWEVER `TodayParticipatingSection` and `TodayMrsSection` may surface done items. The correct interpretation for Standup Today strikethrough is: any issue row rendered with `statusCategory.key === 'done'` should display a struck-through summary.

### Concrete User Expectation

Users who see the board's strikethrough treatment for done cards expect the same visual cue wherever issues are listed. On the backlog active-sprint section this is particularly important: when a story is done before sprint close, it should look visually "finished" in the list just like on the board. Done = struck-through summary text (not just the key). The key-only strikethrough on the board is a slightly under-done implementation; the standard Jira treatment strikes through the summary.

### Table Stakes vs Differentiator

**Table stakes.** Users have already seen the board apply this treatment. Missing it on backlog and standup creates visual inconsistency that feels like a bug.

### Complexity

LOW. The `statusCategory.key` is already available on `JiraIssue` in all three surfaces. It is a CSS class addition (`line-through text-muted-foreground`) conditional on `status.statusCategory?.key === 'done'`. No new API calls required.

### Surfaces and Components

| Surface | Component | Current state | Change needed |
|---------|-----------|---------------|---------------|
| Sprint board card | `TaskCard.tsx` | Key struck through (done) | Extend to summary text |
| Backlog active-sprint row | `BacklogRow.tsx` | No strikethrough | Add `line-through` to summary `<span>` |
| Dashboard sprint card | `DashboardSprintCard.tsx` | Aggregate only — no per-row | N/A unless issue rows added |
| Standup Today | `TodayInProgressSection`, `TodayUpNextSection`, `TodayParticipatingSection` | No strikethrough | Add `line-through` on done rows |

### Dependencies

- Existing: `JiraIssue.fields.status.statusCategory.key` already present on all surfaces.
- No new data fetching.

---

## Feature 2: Drag-to-Rank on Backlog Active-Sprint List

### How It Works

Jira's rank is a LexoRank custom field stored on each issue. Jira Software exposes a dedicated REST endpoint to update rank:

```
PUT /rest/agile/1.0/issue/rank
Body: { "issues": ["PROJ-1"], "rankBeforeIssue": "PROJ-2", "rankCustomFieldId": 10020 }
```

The `rankCustomFieldId` is already available in `GhBacklogResponse.rankCustomFieldId` (confirmed in real fixture: `"rankCustomFieldId": 10105`).

The GreenHopper `data.json` response already returns issues ordered by rank. When a user drags a row up or down in the backlog, the app must:

1. Re-order the in-memory list optimistically.
2. Call `PUT /rest/agile/1.0/issue/rank` with the dragged issue key and either `rankBeforeIssue` (the issue now above it) or `rankAfterIssue` (the issue now below it).
3. On error, roll back the optimistic reorder and show an inline error.

Importantly, rank applies per-sprint section: dragging within the active sprint section changes rank within that sprint. Dragging between sections (sprint to backlog) is move-to-sprint/move-to-backlog, not a rank change.

### Visual Feedback Users Expect

- Drag handle visible on row hover (grip icon, left edge).
- Row "lifts" visually during drag (slight shadow, opacity change, scale).
- A drop indicator line shows the target position as the row is dragged over.
- Rows shift smoothly to fill the gap (animation).
- Optimistic reorder is instant; a rollback snaps back with a subtle error notification if the API call fails.
- No drag handle on the backlog section (unassigned issues) — Jira's rank only applies within sprint context; ranking unassigned backlog items is an edge case users do not expect.

### Table Stakes vs Differentiator

**Differentiator** for this desktop client (Jira's own UI has drag-to-rank on the backlog, but it requires the browser and its full app). For a power-user desktop client, drag-to-rank on the sprint list is expected by developers who are used to Jira's backlog. Absence would be noticed but it is not a "broken" feeling — the right-click context menu provides move-to-sprint as the workaround. Classify as **differentiator / P1** because the feature is explicitly scoped to v1.12.

### Anti-Feature

Drag-to-rank in the **backlog section** (unassigned issues): Users do not intuitively understand how ranking unassigned issues maps to board order. More importantly, there is no sprint context — the rank endpoint would need a `rankBeforeIssue` from a different sprint section, which makes ordering semantics confusing. Anti-feature: do not implement rank changes for the backlog section in v1.12.

### Complexity

MEDIUM-HIGH.

- `@dnd-kit/core` and `@dnd-kit/sortable` must be reinstalled (they were removed in Phase 67 — a guard test in `package-deps.guard.test.ts` explicitly asserts their absence). The guard test must be updated or removed.
- The existing `VirtualizedBacklogTable` uses `@tanstack/react-virtual` — integrating drag-to-rank with a virtualized list requires careful coordination. Virtualized rows are not all in the DOM, so standard sortable-over-container patterns need `DragOverlay` (portal-rendered clone) rather than in-place element transformation.
- New service function: `rankIssue(baseUrl, token, issueKey, rankBeforeIssue | rankAfterIssue, rankCustomFieldId)` calling `PUT /rest/agile/1.0/issue/rank`.
- Optimistic update + rollback pattern (same as status transitions in `StatusPopover`).

### Dependencies

- `GhBacklogResponse.rankCustomFieldId` (already typed and available).
- `useGhBacklogData` provides the ordered issue list.
- Reinstall `@dnd-kit/core`, `@dnd-kit/sortable` — remove/update the guard test.
- Must NOT break the existing `useVirtualizer` scroll behaviour.

---

## Feature 3: Drag-to-Transition with Multi-Status Column Split

### How It Works

The sprint board has exactly three category columns (ACTIVE/FUTURE/DONE mapped to `new`/`indeterminate`/`done`). Each category maps to multiple workflow statuses (e.g., "In Progress" category might contain "In Development", "In Review", "QA"). Currently, right-click context menu is the only way to pick a specific target status.

The drag-to-transition pattern works as follows:

1. While a card is being dragged, the three columns remain in place.
2. When the dragged card enters a column that maps to more than one workflow status, that column **splits into per-status drop boxes** — horizontal or vertical sub-sections labelled with the exact status names (e.g., "In Development" | "In Review" | "QA" within the "In Progress" column).
3. Each sub-box is a distinct drop zone with a dashed border to signal it is a drop target.
4. The user drops onto the desired sub-zone to trigger that specific transition.
5. If the column maps to only one status (e.g., "Done" = only "Done"), no split occurs — the full column is the drop zone.
6. On drop, the app calls `POST /rest/api/2/issue/{key}/transitions` (already implemented via `postTransition`) with the transition ID corresponding to the target status.

The transition IDs per column are already available via the cached `transitions.json` per `projectId × issueTypeId`. The split sub-boxes derive from `filterTransitionsForStatus(transitions, currentStatusId)` already used by the context menu.

### Visual Feedback

- During drag-over a multi-status column: column visually splits with labelled sub-zones.
- Sub-zones highlight (bg change + dashed border glow) when the card is hovered over them.
- Column transitions back to normal after drop or drag-exit.
- The existing `DragOverlay` pattern (card ghost follows cursor) applies.
- Invalid drop (dragging back to the card's current status): no-op or subtle "not allowed" cursor.

### Table Stakes vs Differentiator

**Table stakes** for a kanban board drag interaction. Users who drag on any kanban expect drag-to-move to work. The twist (multi-status split) is standard behaviour for boards with multi-status columns — Syncfusion Kanban implements exactly this. Without it, dropping a card into a multi-status column would be ambiguous. The right-click menu provides a workaround but drag is the primary expected interaction.

### Anti-Feature

Do not implement drag-to-reorder cards WITHIN a column (rank reordering on the board). The board's column order is status-based, not rank-based. Intra-column rank reordering is a complex separate feature with unclear value on the board (the backlog handles rank). Anti-feature: in-column drag reorder on the board.

### Complexity

HIGH.

- `@dnd-kit/core` required (same dependency as Feature 2 — install once for both).
- The current `SprintBoardTab` is highly complex (virtualized swimlanes, sticky headers, collapsed story state, query client). Adding drag state on top requires careful isolation.
- The split-column UI needs to appear only during an active drag and only over the correct column, requiring global drag context state.
- Board columns are rendered in a flex/grid layout with virtualized rows inside — the DragOverlay approach is mandatory (card is portalled to body during drag).
- Transition target discovery: need to know which transitions are available from the card's current status into the target category column's statuses. This is already handled by the cached transitions + `filterTransitionsForStatus`.
- The `DragOverlay` card must mirror the TaskCard appearance (with content, not a placeholder).

### Dependencies

- Existing: `postTransition`, `filterTransitionsForStatus`, cached `transitions.json`.
- `invalidateGhAllData` for board refresh after transition (same as context menu path — already wired at `FieldsSection.transitionMutation.onSettled`).
- `@dnd-kit/core` (same install as Feature 2).
- Must co-exist with existing right-click context menu transitions (both paths remain valid).

---

## Feature 4: Universal Issue Peek Slideover

### How It Works

A non-blocking right-edge panel that opens when any issue is clicked anywhere in the app (board card, backlog row, standup row, search result, linked issue reference) — EXCEPT when the issue key link itself is clicked, which navigates to the full-page `/issue/:key` route.

**Behavioural spec:**

- Slides in from the right, covering roughly 40–45% of viewport width.
- The underlying view remains **fully interactive** — the user can click, scroll, use keyboard shortcuts on the board/backlog while the peek is open.
- Clicking a different issue in the underlying view **swaps** the peeked issue (no close animation between issues — direct swap).
- An explicit "Open full page" affordance (icon button, top-right of the panel) navigates to `/issue/:key` and closes the panel.
- The issue key in the peek header is a link that also navigates to full page.
- Clicking anywhere on the dark/empty area behind the panel (NOT the underlying view, just the panel's overlay area) closes the peek.
- ESC closes the peek.
- The underlying view scrolls independently from the peek panel.
- The peek displays the same content as `IssueDetailContent` + `IssueDetailSidebar` (re-using existing progressive-loading issue detail components).
- The peek is app-wide (lifted to AppLayout or a global store), not route-local.

**Linear's model (confirmed):** Linear opens a right-side panel when clicking issues in list views, keeps the list interactive, swaps content on subsequent clicks, and provides an explicit "open full view" button. This is the industry standard for high-density list + detail workflows.

### Click Model Clarification

"Click-anywhere opens peek, except the issue key which opens full page" means:
- Clicking the issue card/row body → opens peek
- Clicking the issue key text/badge (the `PROJ-123` monospace identifier) → navigates to full page
- Clicking "Open full page" button in the peek → navigates to full page

This is the inverse of the current model (where all issue clicks navigate to full page). The issue key as a "escape hatch to full page" is a standard Linear/Notion/Linear-family pattern.

### Table Stakes vs Differentiator

**Differentiator.** The current app navigates to full page for every issue click. A peek panel is not expected by users of the current app (it has no precedent), but it is a major workflow acceleration for users who spend time scanning boards and backlogs. Linear's adoption of this pattern has made it table stakes in modern project management tools. For this team's workflow (reviewing the board, quickly checking an issue without losing board context) this is high value.

### Anti-Feature

Do not block the underlying view while the peek is open. If the panel covers the board or backlog with a full-screen overlay that requires dismissal, it degrades to a worse version of the existing full-page navigation. Anti-feature: blocking backdrop/overlay.

Do not re-fetch issue data on every open. The peek should share the TanStack Query cache with the issue detail page — same query key `['jira-issue-detail', key]`.

### Complexity

HIGH.

- The existing `IssueDetailSheet.tsx` (75vw slide-out panel) is close in concept but was replaced by the full-page route. It needs to be re-purposed or a new component built on the same `shadcn Sheet` primitive.
- Global state for "currently peeked issue key" — Zustand store or a context at AppLayout level. The store must support `peek(key)`, `swap(key)`, and `close()`.
- The peek must not interfere with route transitions (navigating to a route should close the peek or allow it to persist during navigation — decision needed; Linear closes the peek on navigation).
- The current `onIssueClick` prop threading pattern (noted in PROJECT.md as the deliberate no-context pattern) feeds into all issue-clickable surfaces. This prop must be changed to open the peek instead of navigating directly. The issue key click (the `PROJ-123` badge) must route to full page instead.
- Progressive loading in the peek panel: use the same per-section skeleton approach from `IssueDetailPage.tsx` Phase 75 implementation.
- Accessibility: focus trap within the panel OR allow focus to stay in the underlying view (Linear allows the latter — peek is inspective, not a modal workflow). Recommend: focus on peek header on open, allow tab to exit into underlying view.

### Dependencies

- Existing: `IssueDetailContent`, `IssueDetailSidebar`, Phase 75 progressive loading skeleton pattern.
- `onIssueClick` prop threading across `SprintBoardTab`, `BacklogPage`, `StandupNotesPage`, `DashboardInProgressCard`, search results, notifications.
- `shadcn Sheet` component (already installed, used by `IssueDetailSheet`).
- New Zustand peek store or AppLayout-level state.

---

## Feature 5: Issue-Detail Parent Placement and Cursor Fixes

### How It Works

**Parent field placement:** A subtask's `fields.parent` (key + summary) is currently rendered inside `FieldsSection` within `IssueDetailSidebar` — the right-side column. The desired change moves the parent breadcrumb into the **main content area**, above the description, similar to how story headers appear above their subtask groups on the sprint board.

Concrete placement: immediately below the issue header (key + type + summary) and above the description block, as a "breadcrumb-style" parent link: `[ParentKey] — Parent Summary`. Clicking navigates to the parent issue (via peek or full page, consistent with overall click model).

This mirrors the visual hierarchy: subtask belongs to story belongs to sprint — the parent is part of the issue's identity, not a metadata sidebar field.

**Cursor fixes:** Several clickable elements in the issue detail currently lack `cursor-pointer`. Based on the code, the `MetaRow` parent button already has `cursor-pointer` (FieldsSection line 643), but investigation during v1.12 may surface additional areas. Any interactive element (button, link, clickable badge) must use `cursor-pointer`. Read-only labels use `cursor-default`.

### Table Stakes vs Differentiator

**Table stakes.** Placement of the parent in the sidebar is a UX regression — it buries the most important navigational context (where this subtask lives) in metadata. Moving it to main content is a correctness fix. Similarly, missing `cursor-pointer` on clickable elements is a basic usability expectation.

### Complexity

LOW-MEDIUM.

- Remove the parent `MetaRow` from `FieldsSection` (sidebar).
- Add parent display to `IssueDetailContent` (main content) — this component renders the header section.
- The `IssueDetailContent` already receives the `issue` object which includes `fields.parent`.
- `cursor-pointer` audit: scan all clickable elements in `issue-detail/` for missing cursor class. Pure CSS fix per element.

### Dependencies

- `IssueDetailContent.tsx` (main content component).
- `FieldsSection.tsx` (remove parent MetaRow).
- Peek panel (Feature 4) — the parent link should open the peek, not navigate to full page, when the peek feature is active.

---

## Feature 6: Card Color Stripes by Priority / Issue Type

### How It Works

A 3–4px vertical stripe on the **left edge** of each `TaskCard` on the sprint board, driven by either priority or issue type. This matches Jira's native card color feature.

**Standard priority color mapping** (Jira default, HIGH confidence — used universally):

| Priority | Color | Hex |
|----------|-------|-----|
| Highest / Critical | Red | `#FF0000` or `#D04437` |
| High | Orange-red | `#FF7452` or `#F15C00` |
| Medium | Yellow/Amber | `#FFAB00` |
| Low | Blue | `#2684FF` or `#0065FF` |
| Lowest | Gray-blue | `#8993A4` |

**Standard issue type color mapping** (common convention):

| Issue Type | Color |
|------------|-------|
| Bug | Red |
| Story | Green |
| Task | Blue |
| Epic | Purple |
| Sub-task | Teal/Cyan |
| Spike / Research | Orange |

**Implementation:** The stripe is a `border-l-4` with a Tailwind color class OR an inline `style={{ borderLeftColor: hex }}`. Using inline style is more flexible (allows runtime-resolved hex from Jira's own priority/type color data if available via API).

**Accessibility:** Color-only distinction is insufficient for accessibility. The color stripe is a supplementary visual aid — issue type name and priority name are already rendered as text on cards. The stripe adds at-a-glance density, not primary information. No ARIA changes required. Users with color blindness retain full information from the text labels.

### Table Stakes vs Differentiator

**Differentiator.** Cards already show issue type name (text) and priority is inferred from context. The color stripe adds visual density for experienced users who can scan colors at a glance. It is not table stakes (the app works without it) but it is a genuine quality-of-life improvement that Jira's own board offers.

### Anti-Feature

Do not make color stripes configurable per-user in v1.12. Configurable card colors (JQL-based rules, per-board toggle) is Jira admin-level configuration. The correct scope for v1.12 is: fixed static mapping of priority → color, with a fallback to issue type if priority is not set. Settings-level configuration is out of scope.

Do not apply color stripes to backlog rows — the list format makes stripes less valuable and they would visually conflict with the focused/flagged row highlight styles.

### Complexity

LOW-MEDIUM.

- `TaskCard.tsx` already has a conditional `border-l-2 border-l-muted` for subtasks (line 97). The priority/type stripe replaces or co-exists with this.
- Priority field: `issue.fields.priority?.name` (standard Jira field, already returned).
- Issue type: `issue.fields.issuetype?.name` (already used for the top-right label).
- A pure lookup function `priorityToColor(priorityName)` returning a Tailwind class or hex string.
- Must not conflict with the flagged card background (`bg-yellow-100` treatment).

### Dependencies

- `TaskCard.tsx` — add `borderLeftColor` stripe.
- The priority field is available on `JiraIssue.fields.priority` — verify it is included in the GreenHopper `allData.json` adapter output. If not, the adapter may need to pass it through from the raw GH issue.

---

## Feature 7: Subtask Templates and Bulk Creation

### How It Works

This is the most complex feature. It has two surfaces:

**A. Template management (Settings)**

A new Settings section (e.g., Settings → Templates) where users can create, edit, and delete named subtask templates. Each template has:
- Template name (required, e.g., "Standard Story", "Bug Fix Workflow")
- An ordered list of subtask definitions. Each definition has:
  - Summary / title (required, supports `{parent.summary}` and `{parent.key}` placeholder tokens)
  - Optional fields driven by `createmeta` (the same API already used by `CreateEditIssueModal`): description, assignee, priority, labels, original estimate, story points, due date, components, custom fields
  - An "inherit from parent" flag per field (so due date can inherit from the parent issue)

Templates are stored in a `LazyStore` JSON file (e.g., `subtask-templates.json`) — same persistence pattern as pinned tabs and Tempo saved filters.

**B. Bulk creation flow (from a parent issue)**

From a story or task issue detail page, a "Create subtasks from template" button/action opens a creation panel. The flow:

1. User picks a saved template OR builds an ad-hoc list.
2. The selected template populates a preview list of subtasks with their field values resolved (placeholders substituted, inherited fields shown).
3. User can inline-edit any field in the preview list (adjust summary, assignee, priority per subtask).
4. User can reorder, add, or remove subtask definitions from the preview before creating.
5. "Create all" button fires sequential `createIssue` calls (one per subtask in order — the existing `CreateEditIssueModal` mutation path). No bulk endpoint needed — Jira Data Center lacks a true bulk-create for subtasks; the loop pattern is correct.
6. A progress indicator shows "Creating 3 of 5 subtasks…" during the loop.
7. On completion (all succeed, or partial failure), the subtask list on the issue refreshes and a summary is shown.

**The sequential loop approach** is correct per PROJECT.md: "batch-create REST endpoint (bulk creation loops `createIssue` in order)". Each subtask inherits `parent: { key: parentIssueKey }` in the create payload.

### User Expectations from Market Research

- Subtask templates are a massive pain point in native Jira — no native support exists.
- Users expect: name templates, have multiple fields, preview before creating, create all at once.
- Key behaviours from third-party tools that set user expectations:
  - Template preview with the ability to make one-time edits before creating (Elements Copy & Sync, Easy Issue Templates).
  - Parent field inheritance (priority, due date, assignee can default to parent's values).
  - Placeholders for parent key/summary in subtask titles.
  - Maximum approximately 10–25 subtasks in a template (practical limit for this team; 25 is Elements' cap).
  - Progress feedback during sequential creation.

### Table Stakes vs Differentiator

The Settings management UI is a **differentiator** (no native Jira equivalent). The bulk creation flow from a parent issue is a **differentiator** that becomes near-table-stakes for the team once templates exist.

The one-at-a-time subtask creation via `CreateEditIssueModal` is table stakes and already exists. Templates are the differentiator layer on top.

### Anti-Feature

Do not implement subtask templates as a copy-from-existing-issue pattern (cloning). Cloning requires selecting a source issue and produces an exact duplicate including status/assignee noise. The template-based approach (named, reusable, field-controlled) is strictly superior for this use case.

Do not allow templates to set the **parent** field — the parent is always the issue the user is creating from. Allowing a template to override the parent leads to subtasks orphaned under the wrong story.

Do not implement synchronization of fields after creation (Elements Copy & Sync's sync feature). One-shot create is the correct scope for v1.12.

### Complexity

HIGH.

- New Settings page section (Settings → Templates): requires a new route segment and settings sidebar entry.
- Template schema definition and `LazyStore` persistence.
- `createmeta` integration for optional fields — already done in `CreateEditIssueModal` / `CustomFieldsSection`. The template editor reuses the same discovered field set.
- Placeholder token resolution (`{parent.summary}`, `{parent.key}`) — simple string replace at preview time.
- Inline-editable preview list: a mini-form per subtask row, ideally collapsible.
- Sequential `createIssue` loop with progress state.
- Cache invalidation after all creates: `invalidateGhAllData` to refresh the board, `invalidateGhBacklogData` for the backlog, and re-fetch the parent issue's subtask list.

### Dependencies

- `CreateEditIssueModal` / `createIssue` service function (already built).
- `createmeta` API integration (already built in `CustomFieldsSection`).
- `LazyStore` persistence pattern (already used for pinned tabs, Tempo filters).
- Settings sidebar — adding a new "Templates" section.
- Issue detail `SubtasksSection` for the "Create from template" entry point.
- Parent issue detail must provide the parent key/summary/fields for placeholder resolution and field inheritance.

---

## Feature Dependencies Map

```
Feature 1: Done strikethrough
    requires: existing JiraIssue.fields.status.statusCategory (already present)
    no new dependencies

Feature 2: Drag-to-rank (Backlog)
    requires: @dnd-kit/core + @dnd-kit/sortable (reinstall — removed in Phase 67)
    requires: GhBacklogResponse.rankCustomFieldId (already in adapter)
    requires: new rankIssue() service function
    conflicts: package-deps.guard.test.ts (must update to allow @dnd-kit)
    must-not-break: useVirtualizer scroll in BacklogPage

Feature 3: Drag-to-transition (Board)
    requires: @dnd-kit/core (same install as Feature 2)
    requires: existing postTransition, filterTransitionsForStatus, cached transitions
    enhances: existing right-click context menu (both remain valid)

Feature 4: Universal peek slideover
    requires: shadcn Sheet (already installed)
    requires: existing IssueDetailContent + IssueDetailSidebar
    requires: new Zustand peek store
    changes: onIssueClick behaviour app-wide (board, backlog, standup, search, notifications)
    depends-on-decision-before-Feature-5: parent link in peek should open peek or full page

Feature 5: Issue-detail parent placement + cursor fixes
    requires: IssueDetailContent (move parent there from FieldsSection sidebar)
    enhances: Feature 4 (parent link in peek uses same click model)

Feature 6: Card color stripes
    requires: TaskCard.tsx (minor addition)
    requires: priority field present in GH allData adapter output (verify)
    no new APIs

Feature 7: Subtask templates + bulk creation
    requires: createIssue service function (exists)
    requires: createmeta API (exists in CreateEditIssueModal)
    requires: LazyStore persistence (exists)
    requires: new Settings Templates section
    requires: SubtasksSection entry point on issue detail
```

---

## Feature Categorization Table

| Feature | Category | User Value | Impl Cost | Priority |
|---------|----------|------------|-----------|----------|
| 1. Done strikethrough consistency | Table stakes | MEDIUM | LOW | P1 |
| 2. Drag-to-rank (backlog) | Differentiator | HIGH | HIGH | P1 |
| 3. Drag-to-transition with split zones | Table stakes | HIGH | HIGH | P1 |
| 4. Universal peek slideover | Differentiator | HIGH | HIGH | P1 |
| 5. Parent in main content + cursor | Table stakes | MEDIUM | LOW | P1 |
| 6. Card color stripes | Differentiator | MEDIUM | LOW | P2 |
| 7. Subtask templates + bulk create | Differentiator | HIGH | HIGH | P1 |

---

## Anti-Features Summary

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Rank in backlog section (unassigned) | Semantically ambiguous; users don't understand unassigned rank order | Rank only within sprint sections |
| In-column card reorder on board | Board order is status-based, not rank-based; confusion with drag-to-transition | Drag-to-transition only |
| Blocking peek overlay | Degrades to worse full-page nav | Non-blocking: underlying view stays interactive |
| Configurable card colors (Settings) | Admin-level concern; adds UX complexity for minimal gain | Static priority/type mapping |
| Subtask template clone-from-existing | Noisy, requires source issue selection, produces stale data | Named templates with clean field control |
| Subtask template parent override | Creates orphaned subtasks | Parent always = current issue |
| Field sync after subtask create | Out of scope; one-shot create is correct v1.12 scope | Defer sync to future |

---

## Implementation Phase Ordering Recommendation

Based on dependencies and risk:

1. **Done strikethrough + parent placement + cursor fixes** — low complexity, high consistency value, no dependencies. Suitable for Phase 1 of v1.12.
2. **Card color stripes** — low complexity, no new deps, isolated to TaskCard. Can combine with Phase 1.
3. **Reinstall @dnd-kit, drag-to-rank (backlog)** — reinstalling @dnd-kit is a one-time cost that unblocks both drag features. Do this before drag-to-transition because the board is more complex. New service function (`rankIssue`). Update package-deps guard test.
4. **Drag-to-transition (board)** — builds on @dnd-kit already installed. Board complexity is higher than backlog but uses existing transition infrastructure.
5. **Universal peek slideover** — new Zustand store, wires into all `onIssueClick` surfaces. Biggest surface area change but isolated to navigation layer.
6. **Subtask templates** — most complex, most independent. Can run in parallel with peek or after.

---

## Sources

- Jira Software REST API rank endpoint: [JIRA Agile REST API 7.3.1](https://docs.atlassian.com/jira-software/REST/7.3.1/)
- Jira card color configuration: [Customizing cards | Jira DC 11.3](https://confluence.atlassian.com/jirasoftwareserver/customizing-cards-938845307.html)
- Jira priority card colors: [Assign card colour by priority | JSWSERVER-308](https://jira.atlassian.com/browse/JSWSERVER-308)
- Multi-status split drop zones: [Syncfusion Kanban drag-and-drop docs](https://www.syncfusion.com/jquery/php-ui-controls/kanban-board/drag-and-drop)
- Linear peek/slideover: [Linear Concepts docs](https://linear.app/docs/conceptual-model)
- Bulk subtask template UX patterns: [Smart Checklist: Multiple Subtasks in Jira](https://titanapps.io/blog/jira-multiple-subtasks), [Elements Copy & Sync subtask templates](https://elements-apps.com/subtask-templates-elements-copy-sync/)
- Codebase: `TaskCard.tsx`, `BacklogRow.tsx`, `FieldsSection.tsx`, `SprintBoardTab.tsx`, `IssueDetailSidebar.tsx`, `DashboardSprintCard.tsx`, `TodayInProgressSection.tsx`, GreenHopper types fixture

---

*Feature research for: Taskflow v1.12 Jira Experience Improvements*
*Researched: 2026-06-02*
