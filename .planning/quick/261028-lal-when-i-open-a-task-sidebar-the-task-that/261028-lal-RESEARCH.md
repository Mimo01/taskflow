# Quick 261028-lal: Highlight the peeked task on the main page - Research

**Researched:** 2026-10-28 | **Domain:** codebase-only (React 19 + React Compiler, zustand 5, Tailwind v4) | **Confidence:** HIGH (all claims [VERIFIED: codebase grep/read])

<user_constraints>
Locked (CONTEXT.md): highlight on ALL peek-opening surfaces (MyTaskRow, TaskCard, BacklogRow, Release detail rows) via ONE shared mechanism; style = subtle primary tint + 2px leading-edge accent bar, NO layout shift (inset box-shadow / pseudo-element, not border/padding).
Discretion: store/hook `useIsPeeked(key)`; shared class helper; obey gotchas (space-y/negative margin, one row = one line, React Compiler, no `biome --write` on all src).
</user_constraints>

## Summary
`peekIssueKey` is `useState` at `src/main.tsx:144`; written at :395 (`handleOpenPeek`, passed as outlet `onOpenIssue` at :714), :402 (route-change close), :723/724/726 (PeekPanel close/swap/navigate-full). Lift it to a tiny zustand store and keep `main.tsx` call sites unchanged by aliasing `setPeekIssueKey` to the store action. Rows call `useIsPeeked(issue.key)` (boolean selector -> re-render only on flip) and append one shared class.

**Primary recommendation:** `src/stores/peek.store.ts` + `src/lib/peek-highlight.ts` (`peekedRowClass`), wire into 5 row roots, extend 3 existing test files + new store test.

## Surfaces (root element to decorate)

| Component | Root element | Notes |
|---|---|---|
| `routes/my-tasks/MyTaskRow.tsx` parent row | `div[role=button]` :305-316, `cn(...)` :309 (`rounded-md hover:bg-muted/70`, flagged yellow) | body click = `onOpenPeek` (:314). Subtasks render recursively as MyTaskRow (:404-415) so a peeked subtask highlights itself only. |
| `MyTaskRow.tsx` subtask row | `div[role=button]` :250-256, plain string className :253 | must convert to `cn(...)` to add the class. |
| `routes/dashboard/TaskCard.tsx` | `outerClassName = cn(...)` :343-349, used by both `div[role=button]` (:363) and `<button>` (:390) paths | already has `border-l-[3px]` + `issueTypeStripeClass` (type colour) — leading edge is taken, see Pitfall 2. Also rendered as DragOverlay clone (`isOverlay`) — skip highlight when `isOverlay`. |
| `routes/dashboard/StoryHeaderRow.tsx` (Sprint Board story header, swimlane) | `rowClassName = cn(...)` :105; root div :216 | opens peek with `storyKey` (:220). Include for consistency ("Sprint Board" surface). |
| `routes/dashboard/BacklogRow.tsx` | `rowClassName = cn(...)` :295-302, used in both root branches (:315, :337) | existing `isFocused && 'bg-muted border-l-2 border-primary'` (keyboard focus) — DO NOT copy that border approach (shifts layout). DragOverlay clone at BacklogPage.tsx:1497 passes `isOverlay`. |
| `routes/dashboard/release-detail/UnifiedTaskTable.tsx` `TaskRow` | `div[data-testid="task-row"]` :855-858 (`group/row relative flex ... hover:bg-muted/40`) | body is an `absolute inset-0` overlay `<button>` (:859-867) — transparent, so a shadow/tint on the row div shows through. |
| Other peek openers (optional, not in locked scope) | `DeploymentPackageSection.tsx:229` (key button only, no row click), `aio-cycle/DefectsList.tsx:588`, standup `TodayInProgressSection.tsx:107`, `IssueActivityGroup.tsx:285` | Out of locked list; the hook makes them trivial follow-ups. Recommend skipping to stay in scope. |

## Store convention & main.tsx wiring
Stores are `create<State>()((set) => ({...}))`, file `src/stores/<name>.store.ts`, session-only ones don't use `persist` (see `board-selection.store.ts`, `parent-completion.store.ts`). Tests reset via `useXStore.setState({...})` in `beforeEach` (`aio-cycles-selection.store.test.ts:18-20`).

```ts
// src/stores/peek.store.ts
import { create } from 'zustand';
interface PeekState { peekIssueKey: string | null; setPeekIssueKey: (key: string | null) => void }
export const usePeekStore = create<PeekState>()((set) => ({
  peekIssueKey: null,
  setPeekIssueKey: (peekIssueKey) => set({ peekIssueKey }),
}));
/** True only for the row whose key is peeked; boolean selector => re-render on flip only. */
export const useIsPeeked = (key: string) => usePeekStore((s) => s.peekIssueKey === key);
```
`main.tsx:144` becomes `const peekIssueKey = usePeekStore((s) => s.peekIssueKey); const setPeekIssueKey = usePeekStore((s) => s.setPeekIssueKey);` — every existing use (:395, :402, :639/649 effect deps, :718-726) keeps working; the route-change close at :399-405 automatically clears highlights. Remove `useState` import only if unused elsewhere (it is used elsewhere in main.tsx — check).

## Shared style helper
```ts
// src/lib/peek-highlight.ts
export const PEEKED_ROW_CLASS = 'bg-primary/5 shadow-[inset_2px_0_0_var(--color-primary)]';
```
`--color-primary` is defined in `index.css:20` (Tailwind v4 theme var). Apply as `cn(base, isPeeked && PEEKED_ROW_CLASS, isFlagged && yellow...)` — put it BEFORE the flagged classes so tailwind-merge lets flagged yellow bg win while the shadow bar survives.

## Pitfalls
1. **Primary is neutral**: `--primary` = `oklch(0.205 0 0)` light / `oklch(0.922 0 0)` dark (index.css:91,127). `bg-primary/5` is a grey nearly identical to `--muted` (0.97) hover tint — the 2px bar carries the signal. Consider `/8`; verify visually in both themes. Hover classes (`hover:bg-muted/70`) still override on hover — acceptable.
2. **TaskCard leading edge already owned** by 3px type stripe (`border-l-[3px]` + `issueTypeStripeClass`, lib/issueDisplayUtils.ts:42). An inset shadow paints just inside it (two-colour 5px edge). Recommended: on TaskCard use tint + `ring-2 ring-primary/40` (box-shadow, no layout shift) instead of the inset bar, OR accept the inner bar — pick one and note it. Note `ring-*` and `shadow-[...]` both use box-shadow; Tailwind v4 composes them via separate vars, fine.
3. **No layout shift**: never `border-l-*`/`pl-*` (BacklogRow's existing `isFocused` does exactly that — leave it, don't imitate). Inset box-shadow is not clipped by `overflow-hidden` ancestors (it's inside the element), unlike an outside ring on a row inside `overflow-hidden` scroll containers (BacklogPage.tsx:1299) — so rows use the inset bar, not an outer ring.
4. **Backlog virtualization**: rows are `position:absolute` + `translateY` (BacklogPage.tsx:210-218) with inline `style` from dragStyle (`position:'relative'` overridden). Inset shadow/bg on the row div is safe; don't add pseudo-elements needing `relative` (already relative/absolute either way) — shadow is simplest. Virtualized rows mount/unmount on scroll; the store-hook reads current state on mount, so off-screen peeked rows highlight when scrolled in.
5. **DragOverlay clones** (TaskCard `isOverlay`, BacklogRow `isOverlay`) also call the hook — gate `isPeeked && !isOverlay`. Backlog source row is `opacity:0` while dragging; harmless.
6. **Same key in several places**: Sprint Board can show a subtask card and its parent story header; MyTasks shows parent + subtask rows; key-only equality highlights every instance of the same key — that is correct (desired). Context-parent rows (opacity-40, memory "Context parent rows") keep their opacity; highlight composes.
7. **React Compiler**: use the hook in render, never `usePeekStore.getState()` in render (non-reactive, goes stale only in the app — memory "React Compiler vs module reads"). Hook must be called unconditionally before MyTaskRow's `if (isSubtask)` early-return branch (rules of hooks).
8. **Hooks in rows with tests**: zustand store is global — tests must reset `usePeekStore.setState({ peekIssueKey: null })` in `beforeEach` to avoid leakage.
9. **Biome**: run `npx biome check <changed files>` only; pre-commit runs full vitest (combine RED/GREEN into one commit).

## Tests to extend
| File | Add |
|---|---|
| `src/stores/peek.store.test.ts` (new) | set/clear; `useIsPeeked` true only for matching key (renderHook) |
| `src/routes/my-tasks/MyTaskRow.test.tsx` | parent + subtask row (`data-testid my-task-row-KEY`) gets peek class when store key matches; sibling doesn't |
| `src/routes/dashboard/TaskCard.test.tsx` | card highlighted when peeked; not when `isOverlay` |
| `src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx` | `task-row` highlighted for peeked key |
| BacklogRow / StoryHeaderRow | no existing test files (grep for `backlog-row-` / `StoryHeaderRow` in *.test.tsx: none) — add a small render test or rely on helper + store tests |
| `src/components/app/PeekPanel.test.tsx` | unaffected (PeekPanel still receives props) |

Assert via a stable hook rather than class strings where possible, e.g. add `data-peeked={isPeeked ? 'true' : undefined}` on each root — robust to style tweaks and usable in DOM inspection.

Commands (run from inner `taskflow/taskflow/`): quick `npx vitest run src/stores/peek.store.test.ts src/routes/my-tasks/MyTaskRow.test.tsx src/routes/dashboard/TaskCard.test.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx`; full `npm test`.

## Assumptions Log
| # | Claim | Risk |
|---|---|---|
| A1 | `bg-primary/5` is visually distinguishable enough with the bar | low — tune opacity at UAT |
| A2 | TaskCard ring-vs-inner-bar choice is acceptable either way | low — user preference at UAT |
