# Quick Task 260606-o5y: Story rows open issue peek like cards - Research

**Researched:** 2026-06-06
**Domain:** React component refactor (sprint board swimlane header) — mirror TaskCard PEEK-01/PEEK-05 split
**Confidence:** HIGH (all findings verified by reading the actual source files)

## Summary

The task is to make `StoryHeaderRow`'s body open the peek panel (`onOpenIssue`) while the
issue key keeps full-page navigation (`onOpenDetail`/`setSelectedIssueKey`), mirroring the
exact split already implemented in `TaskCard.tsx`. The card pattern is fully documented and
working; this is a near-mechanical port. All three `StoryHeaderRow` instantiation sites
already have `onOpenIssue` in scope, so wiring is trivial.

**Primary recommendation:** ADD a new optional prop `onOpenIssue?: (key: string) => void` to
`StoryHeaderRow` and KEEP `onOpenDetail`. The current `key+summary <button>` (lines 100-118)
must split into (a) an outer peek target on the **row container** and (b) an inner key
`<button>` that calls `onOpenDetail` with `stopPropagation`. Because the row already contains
nested `<button>`s (chevron, epic pill, key), the outer peek target MUST be a
`div[role=button]` (not a `<button>`) — exactly the card's `useKeyBodySplit` path.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Row body click → peek panel via `onOpenIssue` (PEEK-01), identical to card body.
- Issue key click → full-page `/issue/KEY` (PEEK-05) via `stopPropagation` so body peek
  does not also fire. Strictly additive — no existing behavior lost.

### Claude's Discretion
- Chevron toggle, epic pill, right-click context menu — unchanged.
- Keyboard parity: row body activatable via Enter/Space (mirror card's `div[role=button]`).
- Nested-button HTML validity: reuse the card's outer `div[role=button]` + inner key
  `<button>` pattern (D-10 / Pitfall 1).

### Deferred Ideas
None.

## Finding 1 — The card's PEEK split recipe (exact mechanics)

From `TaskCard.tsx`:

- `const useKeyBodySplit = !!onOpenIssue;` (line 320) is the switch. When `onOpenIssue` is
  present, the outer element is a `div[role=button]`; otherwise it stays a `<button>`.
- **Outer peek target** (lines 365-390) — `div`:
  - `role="button"`, `tabIndex={0}`
  - `onClick={() => { if (justDragged?.current) return; onOpenIssue(issue.key); }}`
  - `onKeyDown` handles `Enter`/`Space`: `e.preventDefault();` then the same guarded
    `onOpenIssue(issue.key)` call.
  - Carries a `biome-ignore lint/a11y/useSemanticElements` comment justifying the
    `div[role=button]` (line 366) — nested `<button>` inside `<button>` is invalid HTML.
- **Inner key button** (CardBody, lines 151-167) — when `useKeyButton` is true:
  - `<button type="button">` whose `onClick` does `e.stopPropagation(); onIssueClick?.(issue.key);`
  - `stopPropagation` is what prevents the outer body's `onOpenIssue` from also firing.
- The legacy path (no `onOpenIssue`) renders the key as a plain `<span>` inside the outer
  `<button>` — no nested buttons. **StoryHeaderRow does not need the legacy path** because all
  three call sites will pass `onOpenIssue` (see Finding 3).

## Finding 2 — StoryHeaderRow restructuring (safe nested-button-free recipe)

Current structure (lines 75-161): `rowContent` is a `<div>` flex container holding, in order:
chevron `<button>`, key+summary `<button>` (lines 101-118, calls `onOpenDetail`), assignee
block, epic pill `<button>`, status `<span>`, subtask `<span>`.

**The row container `<div>` is already a `<div>`, not a `<button>`** — this is the key
simplification vs. the card. We do NOT introduce a wrapping element; we add the peek behavior
**onto the existing outer `<div>`** and demote the key+summary `<button>` to a key `<button>`
+ summary `<span>`.

Recommended restructuring:

1. **Outer row `<div>` (lines 76-87)** gains, when `onOpenIssue` is present:
   - `role="button"`, `tabIndex={0}`
   - `onClick={() => onOpenIssue(storyKey)}`
   - `onKeyDown` for Enter/Space (`e.preventDefault()` then `onOpenIssue(storyKey)`)
   - `cursor-pointer` in className (currently absent on the container)
   - The same `biome-ignore lint/a11y/useSemanticElements` comment as the card.
2. **Key+summary `<button>` (lines 101-118)** splits:
   - The **key** becomes its own inner `<button type="button">` with
     `onClick={(e) => { e.stopPropagation(); onOpenDetail(storyKey); }}` — preserves
     full-page nav (PEEK-05). Keep the existing `group-hover:underline` /
     `line-through` className logic on this button.
   - The **summary** becomes a plain `<span className="text-sm font-medium truncate">` —
     no click handler; clicks bubble to the outer `div` → peek.
   - The flag icon stays adjacent to the key.
   - NOTE: with the summary now a `<span>` outside the key button, wrap key+summary in a
     plain `<div className="flex items-center gap-2 flex-1 min-w-0">` for layout (the old
     `<button>` provided this flex container).

**Nested-button validity:** chevron (`<button>`, line 89) and epic pill (`<button>`, line 132)
remain direct children of the outer element. Because the outer is a `div[role=button]` (NOT a
`<button>`), these nested `<button>`s are valid HTML. The key `<button>` is likewise valid.
This is the entire rationale for D-10 / Pitfall 1.

**Chevron / epic pill propagation:** chevron `onClick={onToggle}` does NOT currently call
`stopPropagation`. Once the outer div becomes a peek target, a chevron click would bubble and
ALSO open the peek. **Add `e.stopPropagation()` to the chevron handler** (mirror the card's
subtask toggle at TaskCard.tsx:247). The epic pill already calls `e.stopPropagation()`
(line 135) — no change needed. The transition/flag context-menu items live in a separate
portal and do not bubble through the row, so they are unaffected.

## Finding 3 — Props change & wiring (all three sites)

**Prop signature change** in `StoryHeaderRowProps` (after line 33):

```ts
onOpenDetail: (key: string) => void;      // KEEP — key → full-page (PEEK-05)
onOpenIssue?: (key: string) => void;      // ADD  — row body → peek (PEEK-01)
```

Keep `onOpenDetail` required (existing). Make `onOpenIssue` optional so the component degrades
gracefully if a future caller omits it (in that case fall back: outer div has no peek handler
and the key button is the only click target — equivalent to today's behavior). Add it to the
destructure (line 54-74).

**Three instantiation sites — all already have `onOpenIssue` in scope:**

| Site | Line | Component | Source of `onOpenIssue` | Change |
|------|------|-----------|--------------------------|--------|
| 1 | 484 | `VirtualizedSwimlanes` | prop (line 212; passed at 1780) | add `onOpenIssue={onOpenIssue}` |
| 2 | 655 | `VirtualizedSwimlanes` | prop (line 212) | add `onOpenIssue={onOpenIssue}` |
| 3 | 1661 | `SprintBoardTab` | outlet context (line 796: `onOpenIssue`) | add `onOpenIssue={onOpenIssue}` |

All three already pass `onOpenDetail={setSelectedIssueKey}` (lines 492, 663, 1669) — leave
that unchanged. Just add the one new line per site. Cards in the same file already use this
exact pairing (`onOpenIssue={onOpenIssue}` + `onIssueClick={setSelectedIssueKey}`, e.g. lines
561-562), confirming both handlers are valid in both scopes.

## Finding 4 — Pitfalls

- **Drag / justDragged:** Story header rows are NOT draggable. Per TaskCard.tsx:90-94, only
  non-story cards register a dnd-kit draggable; story headers are excluded by design (D-04).
  `StoryHeaderRow` has no `useDraggable`, no drag listeners, and is not a drop target itself.
  **Therefore no `justDragged` guard is needed** — do not add one. (The card needs it only
  because the card body is the drag handle; the row is not.)
- **Context menu coexistence:** `rowContent` is wrapped in `ContextMenuTrigger` when
  `onTransition`/`onToggleFlag` are present (lines 163-169). Radix `ContextMenuTrigger`
  intercepts the `contextmenu` (right-click) event and does not interfere with the `onClick`
  (left-click) peek handler. The card uses this identical wrapping with the same peek
  `div[role=button]` and it works — no conflict.
- **Third render path (line 1661):** This is the **sticky header overlay** (the pinned
  swimlane header shown while scrolling), rendered in `SprintBoardTab` (not inside
  `VirtualizedSwimlanes`). It is a real, separate `StoryHeaderRow` instance and MUST also get
  `onOpenIssue` or the sticky header would behave differently from the in-list rows. It is NOT
  a non-virtualized fallback — it is the sticky-pinned duplicate. Confirmed via grep: exactly
  three `StoryHeaderRow` JSX sites (484, 655, 1661).
- **Accessibility:** Adding `role="button"` + `tabIndex={0}` makes the whole row a tab stop.
  This matches the card. The inner key button and chevron remain independently focusable.
  Include the `biome-ignore lint/a11y/useSemanticElements` comment (Biome baseline is GREEN —
  see MEMORY; an un-ignored `div[role=button]` will fail `npm run check`).

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Nested clickable regions (body vs key) | Outer `div[role=button]` + inner `<button>` + `stopPropagation` | Exact card pattern; avoids invalid nested-button HTML (D-10) |
| Keyboard activation of a non-button element | Card's `onKeyDown` Enter/Space + `preventDefault` | Already proven in TaskCard.tsx:379-385 |

## Code Example — target StoryHeaderRow structure (abbreviated)

```tsx
// Source: mirror of TaskCard.tsx:320,365-390 + CardBody:151-167
const useKeyBodySplit = !!onOpenIssue;

const rowContent = (
  // biome-ignore lint/a11y/useSemanticElements: div[role=button] required — inner key/chevron are <button>, nested button is invalid HTML (D-10 / Pitfall 1)
  <div
    {...(useKeyBodySplit
      ? {
          role: 'button',
          tabIndex: 0,
          onClick: () => onOpenIssue?.(storyKey),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenIssue?.(storyKey);
            }
          },
        }
      : {})}
    className={cn('flex items-center gap-2 px-3 py-2 ... border-b', useKeyBodySplit && 'cursor-pointer', /* existing bg/flag logic */)}
  >
    {/* chevron — ADD stopPropagation */}
    <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} ...>
      <ChevronRight ... />
    </button>

    {/* key (button, full-page) + summary (span, bubbles to peek) */}
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {isFlagged && <Flag ... />}
      <button
        type="button"
        className={cn('group font-mono text-xs text-muted-foreground shrink-0', statusCategoryKey === 'done' ? 'line-through hover:[text-decoration-line:underline_line-through]' : 'hover:underline')}
        onClick={(e) => { e.stopPropagation(); onOpenDetail(storyKey); }}
      >
        {storyKey}
      </button>
      <span className="text-sm font-medium truncate">{summary}</span>
    </div>
    {/* assignee / epic pill (already stopPropagation) / status / subtask — unchanged */}
  </div>
);
```

Note the `group` class moves from the old key+summary button onto the key button so its
hover-underline still works (the summary no longer needs group-hover).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Radix `ContextMenuTrigger` does not swallow the outer div's left-click `onClick` | Finding 4 | LOW — the card uses identical wrapping and peek works today |

## Sources

### Primary (HIGH confidence)
- `taskflow/src/routes/dashboard/TaskCard.tsx` — full read; PEEK split at lines 320, 365-390, CardBody 151-167.
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` — full read; structure lines 75-161.
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — three StoryHeaderRow sites (484, 655, 1661), outlet context (796), VirtualizedSwimlanes props (206-273), drag handling (1089-1170), justDragged (833, 1123).
- `260606-o5y-CONTEXT.md` — locked decisions.

## Metadata

**Confidence breakdown:** Mechanics HIGH, wiring HIGH, pitfalls HIGH (all source-verified).
**Research date:** 2026-06-06
**Valid until:** until these three files change.
