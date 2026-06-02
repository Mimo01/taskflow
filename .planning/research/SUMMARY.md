# Project Research Summary

**Project:** Taskflow v1.12 Jira Experience Improvements
**Domain:** Desktop Jira client — drag-and-drop interactions, non-blocking peek panel, bulk issue creation
**Researched:** 2026-06-02
**Confidence:** HIGH

## Executive Summary

v1.12 adds seven interaction features to an existing, stable Tauri 2 + React 19 + TypeScript codebase. The domain is well-understood — all four research agents drew from live source files and official Atlassian/dnd-kit docs, so confidence is uniformly high. The recommended approach is additive: four new `@dnd-kit/*` packages (the only new dependencies), two new Zustand stores, six new components, and focused modifications to roughly 14 existing files. No architectural rewrites are needed; every feature integrates via established codebase patterns (optimistic update + rollback, Outlet context prop-threading, TanStack Query cache mutation, createTauriStorage Zustand persist).

The central risk is the interaction between drag-and-drop and the existing infrastructure: TanStack Query polling can overwrite optimistic rank reorders (flicker on drop), `@dnd-kit/sortable`'s strategies do not work over virtualized rows, and the wrong `rankCustomFieldId` value causes silent mis-ranking. The second risk is the peek slideover: using the wrong primitive (shadcn Sheet/Radix Dialog) imposes a focus trap that blocks the underlying view entirely, defeating the non-blocking requirement. Both risks have concrete, validated mitigations documented below and must be locked in at design time, not retrofitted.

The dependency-aware build order runs: shared display utilities → done strikethrough and card colors → peek slideover infrastructure → drag-to-rank (backlog) → drag-to-transition (board) → issue-detail refinements → subtask templates and bulk creation. This order ensures that click-handler disambiguation (peek vs full-page, click vs drag) is established before any DnD feature ships, and that `@dnd-kit` is installed once for both drag features.

---

## Key Findings

### Recommended Stack

The only new dependencies required for v1.12 are four `@dnd-kit` packages, all React 19-compatible. All other feature needs (non-blocking panel, card color stripes, subtask template persistence) are covered by already-installed libraries. The package-deps guard test added in Phase 67 (`src/test/package-deps.guard.test.ts` lines 52-80) explicitly asserts `@dnd-kit` absence and must be removed before installation — this is a mandatory pre-step.

Do NOT add: `@atlaskit/pragmatic-drag-and-drop` (uses HTML5 DnD API, which conflicts with Tauri's `dragDropEnabled` and would break the existing file attachment drop in `AttachmentsSection.tsx`), any new slideover library (vaul etc.), or Framer Motion.

**New packages:**

| Package | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | 6.3.1 | DnD primitive layer — Pointer Events API, no HTML5 DnD conflict with Tauri |
| `@dnd-kit/sortable` | 10.0.0 | Vertical list rank reordering via `useSortable` + `SortableContext` |
| `@dnd-kit/utilities` | 3.2.2 | `CSS.Transform.toString()` for drag-item visual transforms |
| `@dnd-kit/modifiers` | 9.0.0 | `restrictToVerticalAxis` for backlog; `restrictToWindowEdges` safety net |

**Existing libraries covering v1.12 needs (no new installs):**

- `@base-ui/react` (^1.2.0 installed) — `Dialog modal={false}` for non-blocking peek; confirmed available since alpha.8
- shadcn Sheet + `IssueDetailSheet.tsx` — existing component to adapt for peek; do not create a duplicate
- Tailwind `border-l-4` + inline `style` — card color stripes; zero new dependency
- Zustand + `createTauriStorage` — subtask-templates store and peek state; same pattern as `tempo-filters.store.ts`
- TanStack Query — createmeta fetch for template builder; already cached

**GreenHopper rank API (confirmed against DC):**

Endpoint: `PUT /rest/agile/1.0/issue/rank`
Body: `{ "issues": ["PROJ-123"], "rankBeforeIssue": "PROJ-124", "rankCustomFieldId": 10105 }`

- `rankCustomFieldId` must be read from `GhBacklogResponse.rankCustomFieldId` in the TanStack Query cache — never hardcoded (silent mis-ranking if wrong field ID).
- `rankCustomFieldId` is already present in the live `data.real.json` fixture at value `10105`.
- `GET /rest/agile/1.0/board/{boardId}/configuration → response.ranking.rankCustomFieldId` is the fallback discovery path; cache alongside board config.
- HTTP 204 = success; HTTP 207 = partial success; HTTP 403 = lacks Schedule Issue permission.

---

### Expected Features

**Table stakes (absence feels like regression or bug):**

- **Done-state strikethrough** — board already does this for the issue key; missing it on BacklogRow and standup rows is a visible inconsistency. Apply `line-through opacity-60` to summary text wherever `status.statusCategory.key === 'done'`. DashboardSprintCard renders aggregate stats only — no per-row strikethrough needed there (the card does not list individual stories).
- **Drag-to-transition on the board** — users who drag on any kanban expect drag-to-move to work. The multi-status column split into per-transition drop zones is the correct implementation: a single full-column drop zone is ambiguous when a column spans multiple workflow statuses.
- **Issue-detail parent placement + cursor fixes** — burying a subtask's parent in the sidebar metadata is a UX regression; moving it to main content above the description is a correctness fix.

**Differentiators (high-value, set this client apart):**

- **Drag-to-rank on the backlog active-sprint list** — only within active-sprint sections; dragging unassigned backlog items is an anti-feature (semantically ambiguous).
- **Universal non-blocking peek slideover** — Linear model: click any issue card/row body opens right-edge panel; underlying view stays fully interactive; swap by clicking another issue; issue-key click navigates to full page.
- **Card color stripes** — 3-4px left-edge stripe by priority on `TaskCard`. Static priority-to-color mapping. Do not apply to backlog rows. Do not make configurable in v1.12.
- **Subtask templates and bulk creation** — Settings-managed named templates with createmeta-driven optional fields and parent-inheritance placeholders (`{parent.summary}`, `{parent.key}`); preview + inline-edit before creating; sequential `createIssue` loop (not `Promise.all`) with per-row status tracking and retry-failed-only on partial failure.

**Anti-features (explicitly do not build):**

- Rank reorder for the backlog unassigned-issues section
- In-column card reorder on the board (board order is status-based, not rank-based)
- Blocking backdrop/overlay on the peek panel
- Per-user configurable card colors in v1.12
- Subtask template clone-from-existing-issue pattern
- Template-level parent field override
- Field sync after subtask creation (one-shot create only)
- Jira bulk-create REST endpoint (sequential loop is correct; DC endpoint availability is inconsistent)

---

### Architecture Approach

All seven features integrate into the existing AppLayout + Outlet context + TanStack Query + Zustand persist architecture without structural changes. The dominant patterns are: (1) optimistic GH cache mutation with snapshot-based rollback for drag operations; (2) Outlet context prop-threading for new handlers (`onIssuePeek`) alongside existing ones; (3) `createTauriStorage` Zustand persist for the subtask-templates store; (4) `DndContext` scoped narrowly to each feature surface, not at AppLayout level.

**New components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `lib/issueDisplayUtils.ts` | `lib/` | `isDoneStatus()`, `doneSummaryClass()`, `priorityStripeClass()` |
| `services/jira/rank.ts` | `services/jira/` | `rankIssue()` — PUT /rest/agile/1.0/issue/rank |
| `stores/subtask-templates.store.ts` | `stores/` | Persisted Zustand store for named templates; mirrors `tempo-filters.store.ts` |
| `routes/settings/SubtaskTemplatesSection.tsx` | `routes/settings/` | CRUD UI for named templates |
| `BulkCreateSubtasksModal.tsx` | `routes/dashboard/` | Template pick + preview + sequential create with per-row status tracking |

**Key modifications (highest-impact):**

- `main.tsx` AppLayout — add `peekIssueKey` state (`useState<string | null>`), `handleIssuePeek`, mount `IssueDetailSheet` as global peek, add `onIssuePeek` to Outlet context
- `IssueDetailSheet.tsx` — add thin peek-header (close + "Open full page"); add `modal={false}` on Sheet; omit SheetOverlay for peek mode
- `SprintBoardTab.tsx` — `DndContext` wrapping board scroll area, `DragOverlay` for drag ghost, per-status drop zones visible only during drag, `onIssuePeek` on card body
- `BacklogPage.tsx` — `DndContext` + `SortableContext` for active-sprint section only; rank optimistic update via `queryClient.setQueryData` + `cancelQueries` + rollback
- `stores/settings.store.ts` — add `rankFieldKey`; bump persist version to 24
- `TaskCard.tsx` — `useDraggable`, split card-body click (peek) vs issue-key click (full page), `priorityStripeClass` left border

**Anti-patterns to avoid:**

- `DndContext` at AppLayout or `<main>` level — interferes with sticky header z-index and pointer events
- Peek state in Zustand — `useState` in AppLayout threaded via Outlet context is the codebase pattern
- `Promise.all` for bulk create — use sequential `for` loop with per-item status tracking
- Creating a new `IssuePeekSlideOver` component — `IssueDetailSheet.tsx` is functional on disk; add the peek-header and `modal={false}` to it

---

### Critical Pitfalls

**Cross-cutting "Watch Out For" list (must be addressed at design time, not retrofitted):**

1. **Drag flicker vs TanStack poll** — The 60s backlog poll can fire between the optimistic `setQueryData` and the `rankIssue` mutation response, overwriting the optimistic order. Fix: call `queryClient.cancelQueries({ queryKey: ['gh-backlog', boardId] })` inside mutation `onMutate`; maintain a separate `localItems` state gated by `isDraggingRef` as the single rendered source of truth during drag.

2. **Non-blocking peek focus trap** — shadcn Sheet / Radix Dialog applies `aria-hidden="true"` to the document and traps focus, making the underlying board/backlog inaccessible. Fix: pass `modal={false}` to `<Sheet>` (passes through to `@base-ui/react Dialog`); omit SheetOverlay; verify no `aria-hidden` on document root when peek is open. (See Open Questions — this is the single most important architectural decision for the peek.)

3. **`hasScreen` transition filtering on drag drop zones** — Dragging onto a transition with a required screen returns HTTP 400; card snaps back with no explanation. Fix: propagate `hasScreen` and `hasValidators` through to `JiraTransition` type; filter `hasScreen: true` transitions out of drop zone targets at render time (they remain accessible via the right-click StatusPopover).

4. **Bulk-create partial-failure status array** — Sequential `createIssue` calls have no batch atomicity. Retrying the full batch creates duplicates. Fix: track per-subtask `{ status: 'pending' | 'creating' | 'created' | 'failed'; issueKey?: string; error?: string }` from the start; on partial failure show per-row status with "Retry failed only" action; never auto-close the dialog on failure.

5. **Drag vs click disambiguation** — After drag-end, both `onDragEnd` and the click handler fire, opening the peek after every drag-drop. Fix: use `PointerSensor` activation constraint `{ delay: 150, tolerance: 5 }` (not distance — distance has a known edge case leaving drag stuck); set `justDragged = true` ref in `onDragEnd`, cleared after `requestAnimationFrame`, guard `onIssuePeek` with it.

6. **Dark-mode color contrast on card stripe** — Yellow/orange priority colors (Medium, High) fail WCAG 3:1 as thin stripes against the dark surface (`hsl(240 3.7% 15.9%)`). Fix: define `priorityToStripeColor` map with dark-mode-adjusted HSL values via Tailwind `dark:` variant; supplement with a priority icon (not color alone per WCAG 1.4.1).

7. **`rankCustomFieldId` silent mis-ranking** — Wrong or hardcoded field ID causes rank API to return 200 but update the wrong LexoRank field; issue reappears at original position on next `data.json` fetch. Fix: always read from cached `GhBacklogResponse`; write a unit test asserting the mutation passes the field ID from the `data.real.json` fixture.

---

## Implications for Roadmap

### Phase 1: Visual Polish and Shared Primitives
**Rationale:** Zero new dependencies, zero risk, delivers immediate visible value. Establishes `lib/issueDisplayUtils.ts` and `services/jira/rank.ts` that later phases depend on. Handles `settings.store.ts` version bump (persist v24, `rankFieldKey`) so DnD phases install cleanly.
**Delivers:** Done-state strikethrough on BacklogRow and standup rows; card color left-edge stripes on `TaskCard`; `isDoneStatus`, `doneSummaryClass`, `priorityStripeClass` in `lib/issueDisplayUtils.ts`; `rankIssue()` service stub; settings store v24 with `rankFieldKey`.
**Addresses:** Feature 1 (done strikethrough), Feature 6 (card colors)
**Avoids:** Dark-mode contrast pitfall — define dark-mode-aware color map before implementing the stripe

### Phase 2: Universal Peek Slideover
**Rationale:** Must precede both drag phases because all three features split the `onClick` handler on cards and rows (issue-key → full page, body → peek or drag). The click/drag disambiguation contract established here is consumed by Phases 3 and 4.
**Delivers:** `IssueDetailSheet` adapted with `modal={false}` and peek-header; `peekIssueKey` state + `handleIssuePeek` in AppLayout; `onIssuePeek` in Outlet context; all issue-list surfaces split to peek on body-click and full-page on key-click.
**Addresses:** Feature 4 (universal peek)
**Avoids:** Focus trap pitfall (`modal={false}`, omit overlay); stale query pitfall (`staleTime: 0` on issue-detail query inside peek); issue-key click vs row-click disambiguation (use `<button>` not `<Link>` for issue key, `stopPropagation`)
**Research flag:** Resolve before writing plans — Sheet `modal={false}` vs CSS `position:fixed` panel (see Open Questions). Also: peek close-on-route behavior.

### Phase 3: Drag-to-Rank (Backlog)
**Rationale:** Simpler DnD scenario (vertical list, one axis, no dynamic drop zones). Install `@dnd-kit` once here; Phase 4 reuses the same install. `useVirtual = false` stays — no virtualizer interaction. Click/drag disambiguation already established by Phase 2.
**Delivers:** Remove `@dnd-kit` absence guard from `package-deps.guard.test.ts`; install all four `@dnd-kit` packages; drag handle on `BacklogRow`; `DndContext` + `SortableContext` scoped to active-sprint section; optimistic reorder with `cancelQueries` + snapshot rollback; `rankIssue()` call with field ID from cache.
**Addresses:** Feature 2 (drag-to-rank)
**Avoids:** Flicker pitfall (`cancelQueries` in `onMutate`, `localItems` gated by `isDraggingRef`); wrong `rankCustomFieldId` (read from cache, unit test asserts fixture value); `rectSortingStrategy` + virtual rows (do not re-enable `useVirtual`); `justDragged` ref guard from Phase 2

### Phase 4: Drag-to-Transition (Board)
**Rationale:** Highest DnD complexity. Depends on `@dnd-kit` from Phase 3 and click/drag contract from Phase 2. Uses existing `postTransition` + `filterTransitionsForStatus` + `invalidateGhAllData` infrastructure. Must be designed with droppable/sortable split architecture from the start.
**Delivers:** `DndContext` wrapping board scroll area; `DragOverlay` card ghost; per-status drop zones with `hasScreen` filtering; `handleTransition()` called on drop; right-click menu remains valid.
**Addresses:** Feature 3 (drag-to-transition)
**Avoids:** Mixed vertical/horizontal DnD context (column `Droppable` vs card `Sortable` split); `hasScreen` transitions in drop zones (filter at render); stale `peekGhTransitions` (pre-warm envelope with `useGhTransitions` at board mount); Tauri Windows `mouseup` loss (`touch-action: none` on all draggable elements, explicit Windows UAT)
**Research flag:** Confirm `hasScreen` field propagation through `__adaptToJiraTransition` before writing plans.

### Phase 5: Issue-Detail Refinements
**Rationale:** Isolated to `IssueDetailContent.tsx` and `FieldsSection.tsx`. No new dependencies. Parent link click model already established by Phase 2.
**Delivers:** Subtask parent link moved from `FieldsSection` sidebar to `IssueDetailContent` main content (above description); `cursor-pointer` sweep across `issue-detail/` interactive elements; parent link triggers `onIssuePeek` consistent with overall click model.
**Addresses:** Feature 5 (parent placement + cursor fixes)

### Phase 6: Subtask Templates and Bulk Creation
**Rationale:** Most complex feature, most independent. All infrastructure (createIssue, createmeta, createTauriStorage) already exists.
**Delivers:** `stores/subtask-templates.store.ts`; `SubtaskTemplatesSection.tsx`; `BulkCreateSubtasksModal.tsx` with template pick, preview, sequential create loop, per-row status array, retry-failed-only; Settings sidebar "Subtask Templates" entry; "Bulk Create Subtasks" button on `IssueDetailContent`.
**Addresses:** Feature 7 (subtask templates + bulk creation)
**Avoids:** Parallel `createIssue` calls (sequential `for` loop); full-batch retry on partial failure (retry failed items only, deduplicate by title+parent); stale createmeta (call fresh on wizard open, diff required fields before create)

---

### Phase Ordering Rationale

Three dependency chains drive the ordering:

1. **Click-handler contract before DnD.** Phase 2 (peek) establishes the `onIssuePeek` / `onIssueClick` split on every issue-list surface. Phases 3 and 4 add drag handles to the same components. Building DnD first would require revisiting every card/row click handler a second time.

2. **Single `@dnd-kit` install for both drag features.** Phase 3 removes the absence guard and installs the packages; Phase 4 uses them at no additional install cost. The `justDragged` disambiguation ref (Phase 3) is automatically available when Phase 4 ships.

3. **Shared utilities before consumers.** Phase 1 creates `lib/issueDisplayUtils.ts` and bumps `settings.store.ts` to v24. All downstream phases import from these without circular timing dependencies.

Phases 5 and 6 are independent of each other and can be sequenced or parallelized after Phase 4 ships.

---

### Research Flags

**Needs plan-phase research:**

- **Phase 2 (Peek):** Resolve `Sheet modal={false}` vs CSS `position:fixed` panel tension. STACK.md and PITFALLS.md differ on whether `@base-ui/react Dialog modal={false}` fully suppresses `aria-hidden` and focus trapping. Must verify before writing implementation plans.
- **Phase 4 (Drag-to-transition):** `hasScreen` propagation — verify whether `GhTransition.hasScreen` already flows through `__adaptToJiraTransition` into `JiraTransition` or requires a type addition.

**Standard patterns (skip research-phase):**

- **Phase 1:** Pure CSS/utility work on known components with known data.
- **Phase 3:** `@dnd-kit/sortable` vertical list pattern is well-documented; optimistic update pattern is established in the codebase.
- **Phase 5:** Move a field between components; cursor sweep. No API changes.
- **Phase 6:** `createTauriStorage` Zustand persist, `useCreateEditQueries`, sequential `createIssue` loop — all established codebase patterns.

---

## Open Questions (Resolve at Plan-Phase)

| Question | Phase | How to Resolve |
|----------|-------|----------------|
| **Peek primitive: Sheet `modal={false}` vs CSS `position:fixed` panel** | Phase 2 | Inspect `@base-ui/react` Dialog `modal={false}`: does it suppress `aria-hidden` on document root? If yes, use `IssueDetailSheet` with `modal={false}`. If no, build a thin `position:fixed` wrapper with `role="complementary"`. |
| **`rankCustomFieldId` probe against the live DC instance** | Phase 3 | Run `GET /rest/agile/1.0/board/{boardId}/configuration` against the Orange DC instance; confirm `rankCustomFieldId` matches fixture value `10105` or document the actual value. |
| **Does `GhAllData` adapter pass `fields.priority` through?** | Phase 1 | Read the `services/jira/greenhopper/` adapter output. If the priority field is absent, the adapter needs to pass it from the raw GH issue data. |
| **`hasScreen` in `GhTransition` → `JiraTransition` propagation** | Phase 4 | Read `__adaptToJiraTransition` in `services/jira/greenhopper/transitions.ts` — confirm whether `hasScreen` and `hasValidators` are mapped or silently dropped. |
| **Peek close-on-route behavior** | Phase 2 | Decide: close peek on route change (Linear behavior, simpler) or persist across navigation? Linear's model is recommended. |
| **DashboardSprintCard strikethrough: confirmed N/A?** | Phase 1 | Read `DashboardSprintCard.tsx` — if it renders individual story rows, add strikethrough. The research finding is that it renders aggregate stats only; confirm before skipping. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All four `@dnd-kit` versions npm-verified; `@base-ui/react modal={false}` confirmed against Context7 v1.2.0; absence guard location line-verified in codebase |
| Features | HIGH | All seven features researched against live source files; `rankCustomFieldId` confirmed in `data.real.json` fixture; classification against Jira official docs |
| Architecture | HIGH | All integration points drawn from direct source file reads; component locations and modification scope are exact, not estimated |
| Pitfalls | HIGH (code) / MEDIUM (Tauri Windows) | Code pitfalls verified from codebase + official dnd-kit issue tracker; Windows WebView2 `mouseup` loss is platform-specific and requires hands-on validation |

**Overall confidence:** HIGH

### Gaps to Address

- **`modal={false}` focus trap behavior in practice** — STACK.md and PITFALLS.md differ. Resolve at Phase 2 plan step by testing `aria-hidden` behavior before writing the implementation plan.
- **Tauri Windows drag behavior** — All research agents flag Windows as untested. Add "test on Windows Tauri build" as an explicit UAT requirement for Phases 3 and 4.
- **`GhAllData` priority field passthrough** — Not confirmed in the adapter research. One-file read to resolve before Phase 1 ships.
- **`peekGhTransitions` pre-warming cost** — Adding `useGhTransitions` at board mount may add a redundant fetch if the envelope is already populated. Verify cache hit rate at Phase 4 plan step.

---

## Sources

### Primary (HIGH confidence)
- Live source files: `main.tsx`, `SprintBoardTab.tsx`, `BacklogPage.tsx`, `BacklogRow.tsx`, `TaskCard.tsx`, `IssueDetailSheet.tsx`, `IssueDetailContent.tsx`, `FieldsSection.tsx`, `DashboardSprintCard.tsx`, `TodayInProgressSection.tsx`, `tempo-filters.store.ts`, `services/jira/greenhopper/transitions.ts`, `types.ts`, `package.json`, `src/test/package-deps.guard.test.ts`
- npm registry: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`, `@dnd-kit/modifiers@9.0.0` (verified 2026-06-02)
- Context7 /clauderic/dnd-kit — `PointerSensor`, `useSortable`, `DragOverlay`, activation constraints
- Context7 /mui/base-ui — `Dialog modal` prop (v1.2.0)
- Atlassian Jira Agile REST API 7.3.1 — `PUT /rest/agile/1.0/issue/rank`, `rankBeforeIssue`/`rankAfterIssue`/`rankCustomFieldId`
- Tauri issue tracker — #6695 (HTML5 DnD conflict), #10767 (Windows mouseup loss), #8581, #14373

### Secondary (MEDIUM confidence)
- dnd-kit issue tracker — #495 (distance-constraint edge case), #476, #591 (drag vs click), #1522 (TanStack Query flicker), #1720, #1674, #411 (virtual list)
- pkgpulse.com dnd-kit vs pragmatic-drag-and-drop 2026 comparison
- Jira Software Confluence — card color customization, priority color mapping
- Linear Concepts docs — peek panel model
- Elements Copy & Sync, Smart Checklist, Easy Issue Templates — subtask template UX patterns

### Tertiary (LOW confidence, needs validation)
- WCAG 3:1 contrast for card stripes in dark mode — computed from app's dark surface color vs Jira priority hex values; validate with DevTools contrast checker during implementation
- Tauri Windows `mouseup` event loss — reported in issue #10767 but platform-specific; requires hands-on test on Windows build before Phase 3 ships

---
*Research completed: 2026-06-02*
*Ready for roadmap: yes*
