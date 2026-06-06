# Quick Task 260606-o5y: On sprint board, story rows open issue preview like cards do - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Task Boundary

On the sprint board, clicking a story swimlane header row should open the issue
preview (the peek panel) the same way clicking a card body does. Today story rows
navigate to the full `/issue/KEY` page instead of opening the peek preview.

</domain>

<decisions>
## Implementation Decisions

### Click behavior (mirror cards exactly)
- Clicking the story row body (the summary area) opens the **peek panel** via the
  existing `onOpenIssue` handler (`handleOpenPeek` → `setPeekIssueKey`), identical
  to a card body click (PEEK-01).
- Clicking the **issue key** text still navigates to the full `/issue/KEY` page
  (PEEK-05), using `stopPropagation` so the body's peek handler does not also fire.
- This is strictly additive: no existing behavior is lost — the key keeps full-page
  navigation; the rest of the row gains the peek preview.

### Affordances that stay unchanged (Claude's Discretion)
- Chevron toggle (expand/collapse) — unchanged, already `stopPropagation`-safe.
- Epic pill click — unchanged (`onEpicClick`).
- Right-click context menu (transitions, flag) — unchanged.
- Keyboard parity: the row body should be activatable via Enter/Space (mirror the
  card's `div[role=button]` keyboard handler) for accessibility.
- Nested-button HTML validity: reuse the card's pattern — outer `div[role=button]`
  for the peek target, inner `<button>` for the key link (D-10 / Pitfall 1).

</decisions>

<specifics>
## Specific Ideas

- Card reference implementation: `taskflow/src/routes/dashboard/TaskCard.tsx`
  (lines ~318-390 for the `useKeyBodySplit` div[role=button] + inner key button).
- Story row to change: `taskflow/src/routes/dashboard/StoryHeaderRow.tsx`
  (lines ~100-118, the key+summary button currently calling `onOpenDetail`).
- Wiring sites in `taskflow/src/routes/dashboard/SprintBoardTab.tsx`: three
  `StoryHeaderRow` instantiations (~484, ~655, ~1661) currently pass
  `onOpenDetail={setSelectedIssueKey}`. `onOpenIssue` is already available in
  scope (outlet context, line ~796) and already passed to cards.

</specifics>

<canonical_refs>
## Canonical References

No external specs — Phase 77 PEEK-01/PEEK-05 conventions (documented inline in
TaskCard.tsx) are the canonical pattern to mirror.

</canonical_refs>
