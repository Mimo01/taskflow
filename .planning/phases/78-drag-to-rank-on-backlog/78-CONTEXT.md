# Phase 78: Drag-to-Rank on Backlog - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can drag story rows on the Backlog page to reorder them. Drag changes the
Jira rank; the lists render in rank order and survive the 60s background poll
without snap-back flicker. A failed rank write rolls back the optimistic reorder
and surfaces an inline error.

**In scope:** intra-list reorder in *every* section (active sprint, future
sprints, unassigned backlog bucket); cross-section moves gated behind a
confirmation dialog (changes sprint membership in addition to rank); optimistic
update + rollback; flicker mitigation; fixing the known-broken `rank.ts`
LexoRank calculator as a hard prerequisite.

**Out of scope:** drag-to-transition on the sprint board (Phase 79); keyboard
drag/accessibility sensor (not requested); bulk multi-row drag.

</domain>

<decisions>
## Implementation Decisions

### Drag Scope
- **D-01:** Drag-to-rank is enabled in **every** Backlog section — the ACTIVE
  sprint, all FUTURE sprint sections, and the unassigned backlog bucket. Each
  section reorders within itself. (Goes beyond the goal's "active-sprint list"
  wording — user explicitly widened it.)
- **D-02:** **Intra-list reorder works directly** (rank PUT only, no
  confirmation). **Cross-section moves are allowed but gated** — see D-03.

### Cross-Section Moves
- **D-03:** Dropping a row into a *different* section triggers a
  **confirmation dialog** on drop (e.g. "Move STORY-123 to Sprint 24?"
  Confirm / Cancel). **Cancel rolls back** the optimistic move to the original
  position. This is a scope expansion beyond RANK-01..05 (which were intra-list
  only) — now in scope by user decision.
- **D-04:** A confirmed cross-section move fires a **sprint-membership API call**
  (assign to target sprint, or remove to backlog) **in addition to** the rank
  PUT. If either call fails, roll back to original position using the same
  surface as a failed rank (D-09).
- **D-05:** While dragging over a section, the **target section is highlighted**
  (subtle border/background) to signal where the row will land — reinforces the
  pending sprint-membership change before the confirm dialog appears.

### Drag Initiation
- **D-06:** **Whole row is draggable** — no explicit grip handle. Rely on the
  `PointerSensor` activation constraint `{ delay: 150, tolerance: 5 }` +
  `justDragged` ref guard to disambiguate drag from the existing click-to-peek
  (row body) and issue-key click (opens full page). (Locked by ROADMAP notes.)

### Drag Visual Feedback
- **D-07:** During drag, render a **`DragOverlay` ghost** clone of the row
  following the cursor (semi-transparent / elevated) **plus a clear insertion
  line** showing the drop position. Remaining rows shift via dnd-kit sortable
  transforms.

### Flicker & Persistence (locked by ROADMAP notes)
- **D-08:** Hold optimistic order during the drag window: `cancelQueries` in
  `onMutate` + an `isDraggingRef`-gated local state as the rendered source of
  truth so the 60s background poll cannot snap the list back mid-drag.

### Error Surface
- **D-09:** On rank-PUT (or cross-section move) failure → roll back to pre-drag
  order and show an **inline banner** at the top of the list (e.g. "Couldn't
  save new order — reverted"). Reuse the existing inline-banner convention
  (`StaleDataBanner` / `alert.tsx`), not a transient toast (toasts are easy to
  miss during the poll window). *User said "you decide" — Claude's discretion,
  defaulting to inline banner per RANK-04's "inline error" wording.*

### Prerequisite — fix known-broken rank.ts
- **D-10:** `taskflow/src/services/jira/rank.ts` (`rankIssue`) is **KNOWN-BROKEN**
  and MUST be fixed before being consumed (CR-01 cross-bucket midpoint wrong;
  CR-02 float64 precision loss via `parseInt`). Fix = correct cross-bucket
  handling + true arbitrary-precision base-36 BigInt math; strengthen
  `rank.test.ts` to assert `rankLt(before, result) && rankLt(result, after)` on
  EVERY case; remove the ⚠️ KNOWN-BROKEN header once fixed. Tracked in
  `.planning/todos/pending/rank-ts-blockers-phase78-prereq.md`.
- **D-11:** Read `rankCustomFieldId` from the cached `GhBacklogResponse`
  (`backlog.rankCustomFieldId` → `customfield_${id}`, already populated into
  `settings.store.rankFieldKey`). NEVER hardcode. Unit-test that the rank
  mutation passes the fixture value, not a constant.
- **D-12:** Pre-step — remove the `@dnd-kit` absence guard in
  `src/test/package-deps.guard.test.ts`, then install all four `@dnd-kit`
  packages (`core`, `sortable`, `modifiers`, `utilities`) — reused by Phase 79.

### Claude's Discretion
- Error surface styling (D-09) — defaulted to inline banner reusing existing
  primitives.
- Exact confirmation-dialog component (D-03) — reuse the app's existing
  dialog/modal primitive; planner picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 78: Drag-to-Rank on Backlog" — goal, success
  criteria, and the locked technical notes (dnd-kit setup, flicker mitigation,
  sensor disambiguation, rankCustomFieldId sourcing).
- `.planning/REQUIREMENTS.md` § RANK-01..RANK-05 — the five rank requirements.

### Known-broken prerequisite
- `.planning/todos/pending/rank-ts-blockers-phase78-prereq.md` — the blocking
  fix list for `rank.ts` (CR-01, CR-02, test strengthening). MUST resolve first.
- `.planning/phases/76-visual-polish-and-shared-primitives/76-REVIEW.md` —
  original CR-01 / CR-02 findings.
- `taskflow/src/services/jira/rank.ts` — the LexoRank calculator to fix.
- `taskflow/src/services/jira/rank.test.ts` — the test to strengthen.

### Backlog rendering & data
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — list composition, sprint
  sections vs backlog bucket partition, `rankFieldKey` discovery (D-11 effect),
  background-poll query (`useGhBacklogData`).
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — row component; existing
  click-to-peek (body) + issue-key full-page click to disambiguate against.
- `taskflow/src/services/jira/greenhopper/types.ts` § `rankCustomFieldId` —
  source of the rank field id.
- `taskflow/src/stores/settings.store.ts` § `rankFieldKey` — persisted field key.

### Reusable UI primitives
- `taskflow/src/components/ui/stale-data-banner.tsx` and
  `taskflow/src/components/ui/alert.tsx` — inline-banner convention for D-09.
- `taskflow/src/test/package-deps.guard.test.ts` — @dnd-kit absence guard to
  remove (D-12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGhBacklogData(boardId)` — single cached backlog query (60s poll); its
  cache holds `rankCustomFieldId` and is the query to `cancelQueries` against in
  `onMutate`.
- `settings.store.rankFieldKey` — already discovered/persisted from the backlog
  response; mutation reads it (no hardcode).
- `StaleDataBanner` / `alert.tsx` — established inline error/banner pattern to
  reuse for rollback errors.
- The existing `BacklogPage` already surfaces errors inline via `ErrorState` and
  a dismissible banner (`bannerDismissed` state) — follow that idiom.

### Established Patterns
- Optimistic-update + rollback is the app's standard for Jira write actions
  (status transitions since v1.0) — mirror it (`onMutate` snapshot →
  `onError` rollback → `onSettled` invalidate).
- Backlog list partitions into sprint sections (ACTIVE/FUTURE) + backlog bucket
  via the adapter useMemo chain; each becomes an independent dnd-kit sortable
  context.

### Integration Points
- New rank mutation calls `PUT /rest/agile/1.0/issue/rank` with
  `rankCustomFieldId` + `rankBeforeIssue`/`rankAfterIssue`; cross-section moves
  add the sprint-membership endpoint (`POST /rest/agile/1.0/sprint/{id}/issue`
  or `/rest/agile/1.0/backlog/issue`).
- `isDraggingRef`-gated local order state replaces the query data as the rendered
  source of truth during the drag window.

</code_context>

<specifics>
## Specific Ideas

- Confirmation copy for cross-section: name the issue and target, e.g.
  "Move STORY-123 to Sprint 24?" with Confirm / Cancel.
- Rollback error copy: "Couldn't save new order — reverted" (or similar inline,
  in the banner).

</specifics>

<deferred>
## Deferred Ideas

- Explicit grip-handle affordance — rejected in favor of whole-row drag (D-06);
  revisit only if accidental drags prove a problem in UAT.
- Keyboard-accessible drag (dnd-kit `KeyboardSensor`) — not requested this phase.
- Drag-to-transition on the sprint board — Phase 79 (TRAN-01..05).

</deferred>

---

*Phase: 78-drag-to-rank-on-backlog*
*Context gathered: 2026-06-03*
