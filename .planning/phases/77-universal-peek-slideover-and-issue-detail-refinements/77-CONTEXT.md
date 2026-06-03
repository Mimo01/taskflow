# Phase 77: Universal Peek Slideover and Issue-Detail Refinements - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Make clicking the **body** of any issue (board, backlog, standup, dashboard, search, notifications) open a non-blocking, universal right-edge peek panel that previews the full issue detail; clicking the issue **key** navigates full-page instead. The underlying view stays fully interactive (the peek is a squeeze/layout sibling, not a floating modal). Plus issue-detail refinements: move the subtask parent link into the main content area, and fix pointer-cursor styling across all clickable detail areas.

**In scope:**
- Universal peek panel triggered from issue body clicks on every surface (PEEK-01/02)
- Non-blocking behavior — underlying view stays scrollable/clickable (PEEK-03)
- Click another issue swaps the peeked issue without closing (PEEK-04)
- Issue key click → full-page detail (PEEK-05)
- Explicit "Open full page" affordance in the peek (PEEK-06)
- Escape + explicit close control dismiss the peek (PEEK-07)
- Subtask parent link relocated to main content above the title (DETAIL-01)
- Pointer-cursor sweep across all clickable issue-detail areas (DETAIL-02)

**Out of scope (future phases):**
- Drag-to-rank / drag-to-transition interactions (Phases 78/79)
- Any new issue-detail data or fields not already rendered today
- A read-only/condensed preview rendering (decided AGAINST — peek reuses the full detail)
</domain>

<decisions>
## Implementation Decisions

### Panel Mechanism & Layout (PEEK-03)
- **D-01:** The peek is a **push/squeeze layout panel**, NOT a floating `@base-ui/react` Dialog. The main content area shrinks to make room; the peek occupies the right edge as a layout sibling. This **eliminates the backdrop/`modal={false}`/`aria-hidden` tension entirely** — there is no Dialog backdrop because there is no Dialog. The roadmap note's "Sheet `modal={false}` vs CSS panel" question is resolved in favor of the CSS layout panel.
- **D-02:** The panel is **mounted at the app/layout level** (around the routed outlet) so it is genuinely universal across every surface — board, backlog, standup, dashboard, search, notifications — without per-route re-implementation. Peek state (current peeked issue key) lives at this shared level, parallel to the existing app-level `onIssueClick` handler (`main.tsx:336`).
- **D-03:** The panel width is **user-resizable via a drag divider** between content and peek. Default **480px**, clamped **min 360 / max 720**. The chosen width is **persisted** (settings store, following the existing versioned-migration pattern).
- **D-04:** Visual separation = **left border + subtle shadow, no dimming** of the underlying content. The underlying view stays at full brightness to reinforce that it remains live/interactive. (Matches existing `border-l` idioms.)

### Peek Content Fidelity (PEEK-02)
- **D-05:** The peek shows the **full interactive detail** — reuse `IssueDetailContent` + `IssueDetailSidebar` exactly. Fully editable (comments, transitions, edit, add subtask). NO separate read-only rendering. "Open full page" is purely for more room / a shareable URL, not for unlocking editing.
- **D-06:** Inside the narrow panel, the detail lays out as a **single column, fields/meta on top**: status/assignee/priority and other sidebar fields first, then description, then comments/subtasks. The existing two-column layout (content ~60% + sidebar ~42%) does NOT fit ~480px, so the peek uses a stacked variant. The full-page `IssueDetailPage` keeps its own (two-column) layout — only the peek stacks.

### Lifecycle & Dismissal (PEEK-04/06/07)
- **D-07:** **Close on navigation to a different route** (e.g. board → backlog, clicking a sidebar nav item). Swapping issues *within the same view* keeps the peek open (that is PEEK-04). A peek does not float over an unrelated page.
- **D-08:** **No click-away dismissal.** Because the underlying view is interactive, clicking it does normal things: clicking another issue swaps the peek; clicking empty space does nothing to the peek. Only **Esc**, the **X close control**, and **"Open full page"** dismiss it.
- **D-09:** Peek **header bar**: issue key / breadcrumb on the left; **"Open full page"** (icon + text label, navigates to `/issue/:key`) and an **X** on the right. Navigating to `/issue/:key` is a different route, so per D-07 it naturally closes the peek — consistent behavior, single mechanism.

### Issue Key Affordance (PEEK-01/05)
- **D-10:** On every surface, the **issue key becomes a distinct inner clickable element** with `stopPropagation()` → `navigate('/issue/:key')` (full page). The surrounding **card/row body** opens the peek. The key gets **hover underline + pointer cursor** to signal it behaves differently from the body. This is a uniform rule applied across TaskCard (currently one big button — key must be split out), BacklogRow (key already in its own cell), Dashboard cards, Standup, CommandPalette, and Notifications.

### Detail Refinements (DETAIL-01/02)
- **D-11:** Subtask **parent link → breadcrumb-style link above the issue title** in the main content area (`↗ PARENT-KEY Parent summary`), mirroring how subtasks render under a story. **Remove** the parent link from the sidebar (`FieldsSection.tsx:641`).
- **D-12:** **Pointer-cursor sweep across ALL clickable issue-detail areas** — audit `IssueDetailContent`, `IssueDetailSidebar`, `FieldsSection`, `LinkedIssuesSection`, the subtask list (currently lacks `cursor-pointer`), the new parent link, field chips, and buttons. Not just the three items DETAIL-02 names.
- **D-13:** **In-detail links (parent, subtask, linked issue) behave context-sensitively:** inside the peek they **swap the peek** to that issue (consistent with clicking issues in the underlying list); on the full-page detail they **navigate full-page** as today. The existing `onOpenIssue` prop is the seam — it routes to "swap peek" when rendered inside the peek, and to full-page navigation when rendered on `/issue/:key`.

### Claude's Discretion
- The exact technical seam for D-13 (how `onOpenIssue` is wired to swap-vs-navigate based on render context) is left to planner/executor.
- Drag-divider implementation details (resize handle component, pointer math, persistence key naming) left to planner — constraint is default 480 / min 360 / max 720 / persisted.
- Skeleton/loading state inside the peek follows the existing `IssueDetailSkeleton` (`IssueDetailSheet.tsx:157`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` § Phase 77 — goal, success criteria, plan-time notes (`modal={false}` vs CSS panel; close-on-route-change — both resolved in decisions above)
- `.planning/REQUIREMENTS.md` — PEEK-01 … PEEK-07, DETAIL-01, DETAIL-02 definitions (lines 36–47)

### Existing components to reuse / adapt
- `taskflow/src/routes/dashboard/IssueDetailSheet.tsx` — existing-but-UNUSED Sheet (base-ui Dialog, 75vw, two-column). The body composition (`IssueDetailBody`, query wiring, skeleton at :157) is the reuse target; the Dialog/backdrop wrapper is replaced by the squeeze panel per D-01.
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — main content (reused in peek; gets parent breadcrumb per D-11; subtask list cursor fix per D-12)
- `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` + `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` (parent link at ~641) — sidebar fields (stacked on top in peek per D-06; parent link removed per D-11)
- `taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx` (~10–68) — linked-issue links (cursor + swap behavior per D-12/D-13)
- `taskflow/src/components/ui/sheet.tsx` — existing Sheet primitive; informs but is NOT the chosen mechanism (D-01)

### Click model & routing
- `taskflow/src/main.tsx` (~336–425) — app-level `onIssueClick` / `handleIssueClick`, breadcrumb store; the shared seam where peek state should live (D-02)
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (route `/issue/:key`, routes.tsx:46) — full-page target for key clicks (D-10) and "Open full page" (D-09)

### Surfaces that need the key-vs-body split (D-10)
- `taskflow/src/routes/dashboard/TaskCard.tsx` (~70–128) — one big button today; key must become a separate inner clickable
- `taskflow/src/routes/dashboard/BacklogRow.tsx` (~79–87 key cell, 213–236 row click)
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` (~132–177)
- Standup notes page (`onIssueClick` context, ~113/407/414)
- `taskflow/src/components/app/CommandPalette.tsx` (~53/167)
- `taskflow/src/components/app/NotificationPopover.tsx` (~178/273–274)

### Library
- `@base-ui/react ^1.2.0` (package.json) — relevant only if any Dialog-based fallback is considered; primary path is the CSS squeeze panel (D-01)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IssueDetailSheet.tsx` already wires the full issue-detail query + skeleton + `IssueDetailContent`/`Sidebar` composition — the body is directly reusable; only the modal wrapper changes to a squeeze panel.
- App-level `onIssueClick` (`main.tsx:336`) is the existing universal click seam — peek state attaches here so all surfaces inherit peek behavior with minimal per-surface change.
- `IssueDetailSkeleton` (`IssueDetailSheet.tsx:157`) for peek loading state.

### Established Patterns
- All surfaces already funnel issue clicks through a single `onIssueClick` from `useOutletContext()` → today it navigates full-page. Phase 77 reroutes **body** clicks to peek while **key** clicks keep navigating (D-10).
- Settings store uses versioned `migrate()` chain — persisted peek width (D-03) follows this (mirrors Phase 76's v25 `rankFieldKey` addition).
- `border-l` / left-edge idioms already used (e.g. subtask markers, Phase 76 priority stripe) — peek border (D-04) is consistent.
- `stopPropagation()` already used for inner clickables (e.g. BacklogRow epic badge) — the pattern D-10 extends.

### Integration Points
- New peek panel mounts at AppLayout/outlet level (around routed content) so squeeze applies app-wide.
- Each surface's card/row needs the key split into its own clickable (stopPropagation → navigate); body click calls the new "open peek" path instead of navigate.
- `onOpenIssue` prop in IssueDetailContent/Sidebar/FieldsSection/LinkedIssuesSection becomes context-sensitive (swap in peek, navigate on full page) per D-13.

</code_context>

<specifics>
## Specific Ideas

- The peek must feel like a **companion panel that shrinks the workspace**, not a modal that takes over — full underlying brightness, no backdrop, resizable.
- Parent breadcrumb should look like the issue is "nested under" its parent (`↗ PARENT-KEY Parent summary` above the title), echoing the subtask-under-story mental model.
- Fast in-peek browsing is a goal: clicking parent/subtask/linked issues should swap the preview in place (D-13), letting users traverse the issue graph without leaving the current view.

</specifics>

<deferred>
## Deferred Ideas

- **Deep-link / URL sync for the open peek** (e.g. `?peek=PROJ-123`) — raised as a possible "explore more" topic but not pursued; peek state is in-memory only for this phase. Could be a future enhancement.
- **Modifier-click (cmd/ctrl-click → full page) as an alternative full-page affordance** — considered for D-10, deferred in favor of the simpler key-only rule. Could revisit if users want it.
- **Keyboard navigation between issues while peek is open** (j/k to move selection + peek follows) — not in scope; future polish.

None of these expand Phase 77 scope — discussion stayed within the peek + detail-refinement domain.

</deferred>

---

*Phase: 77-Universal Peek Slideover and Issue-Detail Refinements*
*Context gathered: 2026-06-03*
