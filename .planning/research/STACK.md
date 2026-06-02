# Stack Research

**Domain:** Jira desktop client — drag-and-drop interaction features, non-blocking slideover, bulk issue creation
**Researched:** 2026-06-02
**Confidence:** HIGH (verified against npm, Context7, official Atlassian docs, Tauri issue tracker)

---

## Scope

v1.12 adds interaction features to an existing Tauri 2 + React 19 + TypeScript codebase. This file covers only the **new dependencies** the new features require. The existing validated stack (Tauri 2, React 19, TypeScript, Zustand, TanStack Query, shadcn/ui, @base-ui/react, Tailwind v4, Vitest, Biome, @tanstack/react-virtual, react-hotkeys-hook, cmdk) is **not re-researched**.

---

## Recommended Stack

### Core Technologies (additions only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @dnd-kit/core | 6.3.1 | DnD primitive layer — sensors, context, collision detection | Uses Pointer Events API (not HTML5 DnD API), so zero conflict with Tauri's `dragDropEnabled` interceptor on any platform. Active maintenance. React 19-compatible. |
| @dnd-kit/sortable | 10.0.0 | Vertical list rank reordering | Provides `useSortable` + `SortableContext` — covers the Backlog active-sprint list rank use-case directly with minimal boilerplate. |
| @dnd-kit/utilities | 3.2.2 | CSS transform helpers | `CSS.Transform.toString()` needed for smooth drag-item visual transform. Ships separately from core. |
| @dnd-kit/modifiers | 9.0.0 | Constrain drag axis | `restrictToVerticalAxis` for the backlog list; `restrictToWindowEdges` as a safety net. Prevents accidental horizontal drift on a vertical-only list. |

**Note on React version:** `package.json` shows `react: ^19.1.0` (not React 18 as the milestone context states). All @dnd-kit packages are compatible with React 19. No issue.

### Supporting Libraries (no new installs needed)

| Library | Already Installed | Why it covers v1.12 needs |
|---------|------------------|--------------------------|
| @base-ui/react ^1.2.0 | YES | `Dialog` supports `modal={false}` since v1.0.0-alpha.8 — this is the non-blocking slideover primitive. The existing `Sheet` component wraps `@base-ui/react/dialog`; passing `modal={false}` (or `modal="trap-focus"`) to the `Sheet` root unlocks the non-blocking peek without installing anything new. |
| shadcn/ui (Sheet) | YES | SheetContent already handles right-side slide-in animation, close button, and portal. The `IssueDetailSheet` component exists and can be adapted or duplicated for the peek use-case. |
| Tailwind v4 | YES | Left-edge color stripes = single `border-l-4` utility with a dynamic `style` prop for the color value. Zero new library needed. |
| Zustand + createTauriStorage | YES | Peek state (open issue key, history stack) is ephemeral session state — plain Zustand store, same pattern as pinned-tabs.store.ts and tempo-filters.store.ts. |
| TanStack Query | YES | `useQuery` for createmeta fetch on the template builder. Existing `discoverCustomFields()` + createmeta infrastructure reused as-is. |

### Development Tools (no changes needed)

Biome, Vitest, TypeScript 5.9 — all remain unchanged. The absence guard test in `src/test/package-deps.guard.test.ts` (Phase 67 / SETUI-02) **must be removed or updated** when @dnd-kit is reintroduced — the guard explicitly prevents the packages from coming back. This is a mandatory pre-install step.

---

## Installation

```bash
# Remove the @dnd-kit absence guard before installing (the guard will immediately fail otherwise).
# Edit src/test/package-deps.guard.test.ts — remove the Phase 67 @dnd-kit describe block.

# Install @dnd-kit packages
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers
```

No other packages required for v1.12 features.

---

## GreenHopper Rank Mutation API

**Endpoint:** `PUT /rest/agile/1.0/issue/rank`
**Auth:** Bearer PAT (same `Authorization: Bearer <token>` header used throughout Taskflow)
**Base path:** Uses `rest/agile/1.0/` — not the GreenHopper `greenhopper/1.0/` path. This is the Jira Agile REST API, available on Data Center 10.x.

**Request body:**
```json
{
  "issues": ["PROJ-123"],
  "rankBeforeIssue": "PROJ-124",
  "rankCustomFieldId": 10020
}
```
- Use `rankBeforeIssue` when the dragged item is dropped above the target.
- Use `rankAfterIssue` when dropped below.
- `rankCustomFieldId` is optional — if omitted, the server uses the board's default rank field. However, it is safer to supply it.

**Getting `rankCustomFieldId`:**
```
GET /rest/agile/1.0/board/{boardId}/configuration
→ response.ranking.rankCustomFieldId (integer)
```
The board configuration is already fetched by GreenHopper adapters in `services/jira/greenhopper/`. Cache `rankCustomFieldId` alongside the board config — it never changes.

**Response codes:**
- `204` — success
- `207` — partial success (some issues failed; per-issue detail in body)
- `403` — user lacks Schedule Issue permission

**Optimistic update pattern:** On drag-end, reorder the local list immediately (optimistic), fire the PUT, and roll back on error — same pattern as the existing `StatusPopover` transition mutation.

**Constraint:** At most 50 issues per request. For Taskflow's use-case (one item dragged at a time), this is never a concern.

---

## DnD Library Decision: @dnd-kit vs Alternatives

### Requirement

Two distinct drag-and-drop scenarios must be satisfied:
1. **Vertical list rank reordering** — Backlog active-sprint list, one item at a time, fire `PUT /rest/agile/1.0/issue/rank`.
2. **Board column transition with dynamic drop zones** — Sprint board, card dragged across columns; during drag each column that spans multiple statuses splits into per-transition sub-zones (one drop zone per workflow transition in that column).

### Options Evaluated

| Library | HTML5 DnD API? | Tauri Windows compat | Custom drop zones | Complexity | Bundle |
|---------|---------------|---------------------|-------------------|------------|--------|
| @dnd-kit/core + sortable | NO (Pointer Events) | Native, no config | First-class via `useDroppable` | Medium | ~6 KB core |
| @atlaskit/pragmatic-drag-and-drop | YES (HTML5 DnD) | Requires `dragDropEnabled: false` in tauri.conf.json | Low-level, manual | High | <4 KB |
| react-aria/react-stately DnD | YES (HTML5 DnD) | Same Windows caveat | Medium | High | Large (full system) |
| Native HTML5 DnD | YES | Broken on Tauri Windows by default | DIY | Very high | 0 |
| @hello-pangea/dnd | NO (Pointer Events) | Compatible | No — lists only | Low | ~30 KB |

### Verdict: @dnd-kit

**Use @dnd-kit/core + @dnd-kit/sortable.**

Rationale:

1. **Tauri compatibility is automatic.** @dnd-kit uses Pointer Events, not the HTML5 Drag API. Tauri's `dragDropEnabled: true` default intercepts the HTML5 `ondragstart`/`ondrop` events at the native window layer on Windows — pragmatic-drag-and-drop would require setting `dragDropEnabled: false` in `tauri.conf.json`, which would silently break the existing file attachment drag-drop upload in `AttachmentsSection.tsx`. @dnd-kit avoids this entirely.

2. **Both use-cases are natively covered.** `@dnd-kit/sortable` (vertical list) and `@dnd-kit/core` with custom `useDroppable` targets (kanban board with dynamic per-transition drop zones) are both supported primitives. The board scenario — dynamically registering drop zones that appear only during a drag — is handled with `DndContext` + `useDroppable` per transition zone, with `active` state controlling zone visibility.

3. **Previous codebase history.** @dnd-kit was installed and used in v1.5 (sidebar drag reorder, dashboard grid). The team already has pattern experience with it. It was removed in Phase 67 only because it was overkill for a checkbox-only sidebar settings list — the absence guard reflects that removal, not a quality concern.

4. **React 19 compatible.** All four packages (core 6.3.1, sortable 10.0.0, utilities 3.2.2, modifiers 9.0.0) are compatible with React 19.

5. **Collision detection is built-in.** `closestCenter` and `closestCorners` cover both scenarios without custom implementation. Pragmatic-drag-and-drop offloads collision detection entirely to the consumer.

**Why NOT pragmatic-drag-and-drop:**
- Built on HTML5 DnD API → requires disabling Tauri's `dragDropEnabled` on Windows → breaks existing file attachment drop upload in `AttachmentsSection.tsx`.
- No built-in collision detection — the board's dynamic drop-zone split would require bespoke hitbox code.
- No built-in animations or drag overlay — more implementation work.
- @atlaskit/pragmatic-drag-and-drop v1.8.1 is the current version, but its React-specific integration layer adds dependency surface.

**Why NOT react-aria DnD:**
- Also HTML5 DnD API based → same Tauri Windows problem.
- Large bundle (pulls in react-stately + full aria system).
- Overkill for this scope; accessibility is already handled by @dnd-kit's built-in keyboard sensor and ARIA live regions.

**Why NOT @hello-pangea/dnd:**
- Fork of deprecated react-beautiful-dnd. Limited to vertical/horizontal list reordering. Custom drop zones (the per-transition board zones) are not supported.

---

## Non-Blocking Slideover: Sheet + `modal={false}`

**Conclusion: No new library needed.**

The existing `Sheet` component (`src/components/ui/sheet.tsx`) is built on `@base-ui/react/dialog`. As of @base-ui/react v1.0.0-alpha.8, the `Dialog` component accepts a `modal` prop:

- `modal={true}` (default) — focus trapped, scroll locked, pointer events on underlying content disabled.
- `modal={false}` — focus NOT trapped, scroll NOT locked, pointer interactions on the rest of the document are **allowed**. This is the non-blocking peek behavior needed for v1.12.
- `modal="trap-focus"` — middle option: focus trapped but scroll and pointer events outside remain live.

For the universal issue peek, pass `modal={false}` to `<Sheet>` (which passes it through to `<SheetPrimitive.Root>`). The underlying view (board, backlog, etc.) stays fully interactive — clicking an issue in the board while the peek is open triggers a peek-swap (update the open issue key in the peek store).

The current `IssueDetailSheet` (used for epic detail and search results) already exists and can be adapted. A new `IssuePeekSheet` component — styled narrower and without the dimming overlay — is the recommended approach to avoid conflating peek with the existing full-detail sheet.

**Key implementation note:** `SheetOverlay` (the backdrop) should be omitted or rendered as transparent/zero-pointer-events for the peek, since the overlay's `bg-black/10` tint would visually obscure the underlying view in non-modal mode.

---

## Card Color Stripes

No new library. Tailwind utility + inline style:

```tsx
<div
  className="border-l-4"
  style={{ borderColor: priorityColor(issue.priority) }}
>
```

Priority and issue-type color maps are a plain TypeScript constant — no dependency.

---

## Subtask Templates & Bulk Create

No new library. Uses:
- Existing `discoverCustomFields()` / createmeta infrastructure.
- Zustand for ephemeral template-builder state.
- TanStack Query `useQuery` for createmeta fetch (already cached).
- Sequential `createIssue` mutations in a loop (one at a time, preserving order). The Jira bulk-create REST endpoint does not guarantee order and is not available on all DC versions — the loop approach is correct per the PROJECT.md decision.
- Settings persistence via `createTauriStorage` (same LazyStore pattern as pinned-tabs).

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| @dnd-kit (Pointer Events) | pragmatic-drag-and-drop (HTML5 DnD) | HTML5 DnD conflicts with Tauri `dragDropEnabled` on Windows; breaks existing file attachment drop upload |
| @dnd-kit (Pointer Events) | react-aria DnD | Also HTML5 DnD; large bundle; same Tauri incompatibility |
| @base-ui/react Dialog modal={false} | New slideover library (e.g., vaul) | @base-ui/react is already installed and supports modal={false} natively; vaul is a third dependency with no benefit |
| Tailwind border-l-4 + inline style | CSS-in-JS color library | Zero dependency needed; Tailwind v4 handles the utility class; color is a runtime value from priority map |
| Sequential createIssue loop | Jira bulk-create endpoint | DC bulk endpoint availability is inconsistent; does not preserve order; existing createIssue mutation is proven and tested |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| pragmatic-drag-and-drop (@atlaskit/pragmatic-drag-and-drop) | HTML5 DnD API → breaks Tauri Windows `dragDropEnabled` and the existing file attachment drop upload in `AttachmentsSection.tsx` | @dnd-kit (Pointer Events) |
| react-beautiful-dnd / @hello-pangea/dnd | Deprecated / fork; no custom drop zone support | @dnd-kit |
| vaul (drawer/slideover) | Not needed — @base-ui/react Dialog already supports modal={false} | Sheet with modal={false} |
| Framer Motion | Not needed for DnD animations; @dnd-kit transform+transition covers it; Framer Motion conflicts with React Compiler auto-memo | @dnd-kit CSS.Transform + Tailwind transitions |
| react-dnd (HTML5 backend) | HTML5 DnD API → Tauri Windows incompatibility | @dnd-kit |
| Any global drag state manager / external store for DnD | DndContext is the correct boundary; lifting drag state into Zustand causes unnecessary re-renders | DndContext + local drag-end handler calling Zustand |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| @dnd-kit/core | 6.3.1 | React 19.1.0, TypeScript 5.9 | Pointer Events API; no HTML5 DnD |
| @dnd-kit/sortable | 10.0.0 | @dnd-kit/core 6.3.1 | Peer-dep aligned; verified on npm |
| @dnd-kit/utilities | 3.2.2 | @dnd-kit/core 6.3.1 | CSS.Transform.toString() helper |
| @dnd-kit/modifiers | 9.0.0 | @dnd-kit/core 6.3.1 | restrictToVerticalAxis, restrictToWindowEdges |
| @base-ui/react | ^1.2.0 (installed) | React 19 | modal={false} available since alpha.8; current 1.2.0 confirmed |

---

## Guard Test Update (mandatory)

`src/test/package-deps.guard.test.ts` contains a `describe` block (lines 52-80) titled `@dnd-kit absence guard (Phase 67 / SETUI-02)` that will cause the test suite to fail immediately after install. The guard must be **removed** (not just commented) before the packages are installed. Document the removal in the commit message with a reference to v1.12 Phase (whichever phase performs the install).

---

## Sources

- @dnd-kit npm versions — verified via `npm view @dnd-kit/core version` etc. (2026-06-02)
- Context7 /clauderic/dnd-kit — PointerSensor, DragDropProvider, useSortable patterns
- Context7 /atlassian/pragmatic-drag-and-drop — drop target API shape
- Context7 /mui/base-ui — Dialog `modal` prop documentation (v1.2.0)
- Tauri drag-drop issue tracker — github.com/tauri-apps/tauri/issues/8581, #6695, #14373 — `dragDropEnabled` HTML5 DnD conflict on Windows
- Atlassian Jira Agile Server REST API 7.3.1 — `PUT /rest/agile/1.0/issue/rank` endpoint, `rankBeforeIssue`/`rankAfterIssue`/`rankCustomFieldId`
- Atlassian Jira Agile REST API Cloud reference — api-group-issue rank endpoint
- Taskflow `tauri.conf.json` — dragDropEnabled not set (defaults to true); AttachmentsSection.tsx uses onDrop (HTML5 events active)
- Taskflow `src/test/package-deps.guard.test.ts` — @dnd-kit absence guard location (lines 52-80)
- pkgpulse.com dnd-kit vs pragmatic-drag-and-drop 2026 comparison

---
*Stack research for: Taskflow v1.12 Jira Experience Improvements*
*Researched: 2026-06-02*
