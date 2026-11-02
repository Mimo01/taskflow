---
phase: quick-261102-gqt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/hooks/useResizable.ts
  - taskflow/src/hooks/useResizable.test.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/settings.store.test.ts
  - taskflow/src/routes/standup-notes/StandupSplit.tsx
  - taskflow/src/routes/standup-notes/StandupSplit.test.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
autonomous: true
requirements: [QUICK-261102-gqt]

must_haves:
  truths:
    - "On /standup-notes the vertical divider between Yesterday (left) and Today (right) can be dragged left/right to resize both columns"
    - "Neither column can be dragged narrower than 320px (left floor wins in a very narrow window)"
    - "The chosen split survives navigating away and restarting the app (persisted in the settings store)"
    - "Before the user ever drags, the split is 50/50 exactly as today"
    - "The divider is keyboard operable: focusable, ArrowLeft/ArrowRight nudge it, and it exposes role=separator with aria-orientation=vertical and aria-valuenow"
    - "Double-clicking the divider resets the split to 50/50"
  artifacts:
    - path: "taskflow/src/hooks/useResizable.ts"
      provides: "Shared drag hook, now also returns handleKeyDown"
      contains: "handleKeyDown"
    - path: "taskflow/src/routes/standup-notes/StandupSplit.tsx"
      provides: "Two-pane resizable shell for the standup page"
      exports: ["default"]
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "standupYesterdayWidth persisted field + setter, v33 migration"
      contains: "standupYesterdayWidth"
  key_links:
    - from: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      to: "StandupSplit"
      via: "replaces the two w-1/2 column divs"
      pattern: "<StandupSplit"
    - from: "taskflow/src/routes/standup-notes/StandupSplit.tsx"
      to: "useResizable + useSettingsStore"
      via: "onCommit: setStandupYesterdayWidth"
      pattern: "setStandupYesterdayWidth"
---

<objective>
Make the vertical divider between the Yesterday and Today columns on the Standup Notes page draggable, persisted, bounded and keyboard accessible. Reuse the existing `useResizable` hook and the settings-store panel-width pattern. Do not add a dependency: react-resizable-panels and a shadcn Resizable are NOT installed, and every resizable pane in the app (sidebar, PeekPanel, IssueDetailView right panel, MR / AIO run detail) uses `src/hooks/useResizable.ts` together with a `*Width` field in `settings.store.ts`.

Output: a keyboard-capable `useResizable`, a `standupYesterdayWidth` setting, a `StandupSplit` component, and StandupNotesPage wired to use it.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

Repo layout: `.planning` and git live at the outer `taskflow/`. Source, npm, vitest and biome live in the inner `taskflow/taskflow/`. Run every command below from `/Users/mimo/Documents/Projects/taskflow/taskflow`.

Existing code (read before editing):
@taskflow/src/hooks/useResizable.ts            — returns { width, isDragging, handleMouseDown }. min/max can be functions (read through refs). It has a clamp() helper, getStartWidth, direction 'right'|'left', and onCommit called on mouseup. It has NO keyboard support.
@taskflow/src/hooks/useResizable.test.ts       — renderHook + act tests. Add the new cases here.
@taskflow/src/routes/standup-notes/StandupNotesPage.tsx — lines ~695-731: body is `<div className="flex flex-1 min-h-0 overflow-hidden">` holding `<div className="w-1/2 overflow-auto border-r border-border px-6 py-4"><YesterdayColumn …/></div>` and `<div className="w-1/2 overflow-auto"><TodayColumn …/></div>`.
@taskflow/src/routes/dashboard/IssueDetailView.tsx — lines ~350-365 and ~690-705 are the closest analogue: a containerRef, max as a function of containerRef.offsetWidth, and a handle styled `absolute … w-3 cursor-ew-resize z-20 border-l border-border` that recolours its border to var(--ring) on hover or drag.
@taskflow/src/stores/settings.store.ts         — panel widths around lines 52-56 (defaults), 146-160 (types), 266-270 (setters). Persist `version: 32` at ~line 371; migrations run through `if (version < 32)` at ~line 497. There is no partialize, so the whole state persists.
@taskflow/src/stores/settings.store.test.ts    — the "resize panel widths (Phase 50)" describe block at ~line 75 is the pattern to copy.

Interfaces to add:
- useResizable return: `{ width, isDragging, handleMouseDown, handleKeyDown }` where `handleKeyDown: (e: React.KeyboardEvent) => void`.
- settings store: `standupYesterdayWidth: number | null` (default null = 50/50) and `setStandupYesterdayWidth: (w: number | null) => void`.
- `StandupSplit` default export, props `{ left: React.ReactNode; right: React.ReactNode }`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Keyboard resize in useResizable + standupYesterdayWidth setting</name>
  <files>taskflow/src/hooks/useResizable.ts, taskflow/src/hooks/useResizable.test.ts, taskflow/src/stores/settings.store.ts, taskflow/src/stores/settings.store.test.ts</files>
  <behavior>
    - handleKeyDown ArrowRight with direction 'right' raises width by 16 and calls onCommit once with the new width. ArrowLeft lowers it by 16.
    - Shift+ArrowRight / Shift+ArrowLeft step by 64.
    - direction 'left' reverses the arrows (ArrowLeft grows the width), matching the mouse delta negation.
    - Keyboard steps are clamped to min/max, and min/max given as functions are evaluated on each key press.
    - When getStartWidth is provided, a key step starts from getStartWidth() rather than the stored width (same rule as mousedown).
    - Any other key (e.g. 'a', Enter) does nothing: no width change, no onCommit, no preventDefault.
    - Arrow keys call e.preventDefault() so the scroll container does not also scroll.
    - Settings: standupYesterdayWidth defaults to null. setStandupYesterdayWidth(500) stores 500, and setStandupYesterdayWidth(null) resets it to null.
  </behavior>
  <action>
    In useResizable.ts, add a `handleKeyDown` useCallback that handles only ArrowLeft and ArrowRight. Step size is 16, or 64 when shiftKey is held. Positive sign for ArrowRight; negate when direction is 'left'. Compute next as clamp((getStartWidthRef.current?.() ?? widthRef.current) + delta), then call preventDefault, setWidth(next), set widthRef.current = next, and call onCommit(next). Read onCommit through a ref (add onCommitRef, like minRef/maxRef) so the callback identity stays stable. Leave the mouse code path unchanged. Return handleKeyDown next to the existing fields. Update the JSDoc to mention keyboard support. The hook is shared by Sidebar, PeekPanel, IssueDetailView and the MR / AIO detail views. The change is purely additive, so existing callers that ignore handleKeyDown keep working.

    Add the behavior cases to useResizable.test.ts by calling result.current.handleKeyDown inside act() with a minimal synthetic event object: `{ key, shiftKey, preventDefault: vi.fn() } as unknown as React.KeyboardEvent`. Assert preventDefault was called for arrow keys and not for other keys.

    In settings.store.ts:
    - Add `standupYesterdayWidth: null as number | null` to the defaults beside peekPanelWidth.
    - Add the typed field to the interface, with a doc comment: "Standup Notes Yesterday (left) column width in px. Null = 50/50 split until first drag/keyboard resize."
    - Add `setStandupYesterdayWidth: (w) => set({ standupYesterdayWidth: w })`.
    - Bump persist `version` from 32 to 33 and add `if (version < 33) { if (s.standupYesterdayWidth === undefined) s.standupYesterdayWidth = null; }` after the version-32 block.

    Add tests inside the existing "resize panel widths" describe block. RED and GREEN go in ONE commit, because the pre-commit hook runs the full vitest suite.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/hooks/useResizable.test.ts src/stores/settings.store.test.ts</automated>
  </verify>
  <done>All existing and new useResizable and settings.store tests pass. Persist version is 33 with a v33 migration guard. handleKeyDown is exported from the hook's return value.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: StandupSplit component and wiring into StandupNotesPage</name>
  <files>taskflow/src/routes/standup-notes/StandupSplit.tsx, taskflow/src/routes/standup-notes/StandupSplit.test.tsx, taskflow/src/routes/standup-notes/StandupNotesPage.tsx</files>
  <behavior>
    - With standupYesterdayWidth null, the left pane renders with inline style width '50%'.
    - With standupYesterdayWidth 500, the left pane renders width 500px.
    - The divider has role="separator", aria-orientation="vertical", tabIndex 0, an aria-label of "Resize Yesterday and Today columns", and aria-valuenow equal to the left width in px (rounded).
    - Pressing ArrowRight on the focused divider (fireEvent.keyDown) commits a new width to the store, so useSettingsStore.getState().standupYesterdayWidth is a number.
    - Double-clicking the divider sets standupYesterdayWidth back to null.
    - Both `left` and `right` children are rendered.
  </behavior>
  <action>
    Create StandupSplit.tsx (default export, props `left` and `right`). It owns a containerRef (outer flex row) and a leftRef (left pane). Read `standupYesterdayWidth` and `setStandupYesterdayWidth` with fine-grained selectors; per the page's IN-01 rule, never destructure the whole store.

    Call useResizable with:
    - initialWidth: standupYesterdayWidth ?? 480
    - min: 320
    - max: `() => (containerRef.current?.offsetWidth ?? 960) - 320`, so the Today pane also keeps at least 320px. The hook's clamp already lets min win in very narrow windows.
    - onCommit: setStandupYesterdayWidth
    - direction: 'right'
    - getStartWidth: `() => leftRef.current?.offsetWidth ?? width`. This way the first drag or key press from the unset 50/50 state, or from a CSS-capped state, starts at the rendered width with no dead zone.

    Layout:
    - Outer: `flex flex-1 min-h-0 overflow-hidden`. This is the same class string the page uses now, so it moves here.
    - Left pane: `relative shrink-0 overflow-auto px-6 py-4` with style `{ width: standupYesterdayWidth === null && !isDragging ? '50%' : width, maxWidth: 'calc(100% - 320px)', minWidth: 320 }`. Moving the left border onto the handle is fine.
    - Handle: a sibling div placed between the panes, not nested inside a scroll container. It is `shrink-0 w-1 cursor-ew-resize border-l border-border transition-colors duration-100 focus-visible:outline-none focus-visible:border-ring`, with its border recoloured to var(--ring) on hover or drag, following IssueDetailView's handleHovered pattern. Give it a wider invisible hit area with an `relative` + `before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-['']` pseudo-element; do not use negative margins (see the Tailwind v4 space-y negative-margin memory).
    - Handle props: onMouseDown={handleMouseDown}, onKeyDown={handleKeyDown}, onDoubleClick={() => setStandupYesterdayWidth(null)}, role="separator", aria-orientation="vertical", aria-label="Resize Yesterday and Today columns", tabIndex={0}, aria-valuenow={Math.round(leftRef.current?.offsetWidth ?? width)}, aria-valuemin={320}.
    - Right pane: `flex-1 min-w-0 overflow-auto`.

    Use plain flex and explicit widths only. No CSS grid fr tricks and no container queries on the pane itself, so it stays WebKit/Tauri-safe.

    The rule against negative margins in the bullet above refers to the handle's hit area, not the panes.

    In StandupNotesPage.tsx, replace the body block (the outer flex div and both `w-1/2` column divs) with `<StandupSplit left={<YesterdayColumn …same props…/>} right={<TodayColumn …same props…/>} />`. Keep every prop identical and update the "two-column body" comment. Change nothing else on the page.

    Tests (StandupSplit.test.tsx): render with simple `<div>Left</div>` / `<div>Right</div>` children. Reset the store in beforeEach with `useSettingsStore.setState({ standupYesterdayWidth: null })`. jsdom offsetWidth is 0, so give `max` a fallback-safe path or stub HTMLElement.prototype.offsetWidth via vi.spyOn on the getter in the keyboard test (e.g. container 1200). That makes the clamp produce a sensible number; assert only that the stored value is a number at least 320. For the inline style width assertions, query the left pane via its parent of the "Left" text. RED and GREEN go in one commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/standup-notes src/hooks/useResizable.test.ts && npx tsc --noEmit && npx biome check src/routes/standup-notes src/hooks/useResizable.ts src/hooks/useResizable.test.ts src/stores/settings.store.ts src/stores/settings.store.test.ts</automated>
    <human-check>Run the app and open Standup Notes:
      1. The split starts at 50/50.
      2. Drag the divider both ways. Each column stops at about 320px.
      3. Navigate away and back. The width persists.
      4. Tab to the divider and use the arrow keys (Shift for bigger steps).
      5. Double-click the divider. It resets to 50/50.</human-check>
  </verify>
  <done>StandupSplit tests pass. StandupNotesPage renders through StandupSplit, and no `w-1/2` classes remain in it. tsc is clean, and biome reports nothing new on the touched files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| persisted settings.json → store | A locally persisted px number is read back on startup |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gqt-01 | Tampering | standupYesterdayWidth in settings.json | mitigate | The hook clamps initialWidth to min/max on init and sync, and CSS maxWidth/minWidth cap the rendered width, so a corrupt value cannot collapse a pane |
| T-gqt-02 | Denial of Service | document-level mousemove listeners | accept | Reuses the existing hook's add/remove-on-drag lifecycle; nothing new |
</threat_model>

<verification>
- `npx vitest run src/hooks/useResizable.test.ts src/stores/settings.store.test.ts src/routes/standup-notes` passes
- `npx tsc --noEmit` is clean
- `grep -c "w-1/2" src/routes/standup-notes/StandupNotesPage.tsx` returns 0
- `grep -n "version: 33" src/stores/settings.store.ts` matches
</verification>

<success_criteria>
- The Standup Notes divider is draggable and keyboard resizable, bounded at 320px per side, and persisted across sessions. It defaults to 50/50 and resets on double-click.
- No new npm dependency. The shared useResizable gained handleKeyDown additively, and existing callers are unaffected.
</success_criteria>

<output>
Create `.planning/quick/261102-gqt-make-the-divider-in-standup-notes-page-r/261102-gqt-SUMMARY.md` when done
</output>
