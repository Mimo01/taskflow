---
status: diagnosed
trigger: "the cursor is not pointer on the epic/issue text, only the cell"
created: 2026-05-23T00:30:00Z
updated: 2026-05-23T00:35:00Z
---

## Current Focus

hypothesis: CONFIRMED — title buttons in epic/story/subtask rows lack `cursor-pointer`; Tailwind v4 Preflight's `button { cursor: default }` overrides the inherited pointer from the parent `<tr>`.
test: Compared row buttons (lines 960, 995, 1022) to other intentionally-clickable buttons in the same file (lines 726, 857).
expecting: Other clickable buttons have `cursor-pointer` explicit; row buttons do not.
next_action: Return diagnosis (find_root_cause_only mode — no fix applied).

## Symptoms

expected: When hovering an epic, story, or subtask row in the WorklogsPage hierarchy table, the mouse cursor should be `pointer` over the entire clickable area — including the issue title/summary text in the sticky first column.
actual: "the cursor is not pointer on the epic/issue text, only the cell"
errors: None
reproduction: UAT Test 3 — open Worklogs page, hover over the issue title text in any epic/story/subtask row
started: Discovered in UAT 2026-05-23 against commits 16b75990 (Plan 01 hierarchy table) and 7c4b111f (Plan 02 cell popover wiring)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-23T00:30:00Z
  checked: WorklogsPage.tsx lines 947–1043 (the three row types)
  found: |
    Epic row (line 947–984):
      <tr className="bg-purple-100 dark:bg-purple-900 cursor-pointer group/row">
        <td className="sticky left-0 z-10 ${epicRowBg} px-3 py-1.5 ... overflow-hidden">
          <button type="button" aria-label={`Open ${epicKey}`} onClick={...}
                  className="flex items-center gap-1 w-full text-left min-w-0">
            <Layers ... />
            <span ...>{epicNode.summary}</span>
          </button>
        </td>
        ... (other 2 sticky tds: Key and Time — NOT wrapped in buttons)
        ... day cells wrap WorklogCellPopover (own click handlers)

    Story row (line 993–1014):
      <tr className="cursor-pointer group/row">
        <td className="sticky left-0 z-10 bg-background px-3 py-1.5 ... overflow-hidden">
          <button type="button" aria-label={`Open ${storyKey}`} onClick={...}
                  className="flex items-center gap-1 w-full text-left pl-3 min-w-0">
            <StoryIcon ... />
            <span ...>{storyNode.summary}</span>
          </button>
        </td>
        ...

    Subtask row (line 1020–1042):
      <tr className="cursor-pointer group/row">
        <td className="sticky left-0 z-10 bg-background px-3 py-1.5 ... overflow-hidden">
          <button type="button" aria-label={`Open ${subtaskKey}`} onClick={...}
                  className="flex items-center gap-1 w-full text-left pl-6 min-w-0">
            <CornerDownRight ... />
            <span ...>{subtaskNode.summary}</span>
          </button>
        </td>
        ...

  implication: |
    All three clickable row types have `cursor-pointer` on the `<tr>` but use an inner
    `<button>` element to wrap the icon+title in the FIRST (sticky title) column. The
    other sticky cells (Key, Time) are plain text inside `<td>` and DO inherit the
    parent tr's `cursor-pointer`.

    The button has no explicit cursor class. In Tailwind v3+ Preflight (which this
    project uses — see `taskflow/src/index.css` / shadcn/ui base), `button` elements
    have `cursor: default` reset applied. This OVERRIDES the inherited `cursor: pointer`
    from the parent `<tr>` because the rule is more specific to the element.

    Result: cursor is pointer over the Key and Time cells (no button child) but reverts
    to default arrow over the Title cell where the button wraps the icon + summary text.
    This precisely matches the user's report: "cursor is not pointer on the epic/issue
    text, only the cell".

- timestamp: 2026-05-23T00:30:00Z
  checked: Tailwind v3+ Preflight `button` cursor reset behavior
  found: |
    Tailwind Preflight (preflight.css) sets:
      button, [role="button"] { cursor: default; }
    This is intentional — it matches the W3C spec default and Chrome's current
    behavior (since 2023). To get a pointer cursor on a button, you MUST add
    `cursor-pointer` explicitly. This is a well-known Tailwind v3+ gotcha.
  implication: |
    The `cursor-pointer` on `<tr>` is being overridden by `button { cursor: default }`
    from Preflight. The fix is to add `cursor-pointer` to the button className in
    all three row types.

- timestamp: 2026-05-23T00:30:00Z
  checked: Compare to non-buggy Key/Time td cells in the same rows
  found: |
    The Key cell (e.g. line 1002 for story) is:
      <td className="sticky left-52 z-10 bg-background ... text-muted-foreground">{storyKey}</td>
    The Time cell (line 1003) is similar — plain text in td.
    These cells have NO button descendant, so the inherited cursor-pointer from <tr>
    applies normally. The user confirms cursor IS pointer over "the cell" (key/time
    cells) but NOT over "the epic/issue text" (the title in the button).
  implication: Confirms the diagnosis — the button is the boundary where cursor-pointer
    inheritance is broken.

- timestamp: 2026-05-23T00:35:00Z
  checked: Tailwind version and global CSS overrides in this project
  found: |
    package.json: tailwindcss ^4.2.1 (Tailwind v4).
    src/index.css: no `button` cursor override; only `@import "tailwindcss"` at top.
    Tailwind v4 Preflight default: `button { cursor: default }` (unchanged from v3+).
  implication: No project-level escape hatch exists; Preflight rule is active and
    overrides inherited cursor on every <button> in the app.

- timestamp: 2026-05-23T00:35:00Z
  checked: Established pattern for clickable buttons elsewhere in WorklogsPage.tsx
  found: |
    grep -n "cursor-pointer" WorklogsPage.tsx:
      Line 726: saved filter pill button — INCLUDES `cursor-pointer`
      Line 857: "Save filter" button — INCLUDES `cursor-pointer`
      Lines 951, 993, 1020: the three <tr> elements with cursor-pointer
    All intentionally-clickable buttons in this same file already include
    `cursor-pointer` explicitly. The three row title buttons (960, 995, 1022)
    are the only clickable buttons that DO NOT — clear oversight in the
    implementation.
  implication: Final confirmation — the fix is to add `cursor-pointer` to the
    className of the three title buttons (lines 960, 995, 1022), matching the
    established convention used by every other clickable button in this file.

## Resolution

root_cause: |
  In WorklogsPage.tsx, the three clickable row types (epic, story, subtask) place
  `cursor-pointer` on the parent `<tr>` element, but wrap the icon + title text
  in the sticky first column inside a `<button type="button">` element. Tailwind
  Preflight sets `button { cursor: default }` which OVERRIDES the inherited
  `cursor: pointer` from the row. Result: pointer cursor only shows over cells
  that have no button descendant (Key column, Time column, day cells via
  popover) — but the title text area, which is the most visually prominent
  "clickable" target, shows the default arrow cursor.

  Affected button elements:
    • WorklogsPage.tsx:960 — epic row title button
    • WorklogsPage.tsx:995 — story row title button
    • WorklogsPage.tsx:1022 — subtask row title button

fix: |
  Add `cursor-pointer` to the className of each of the three inner title buttons.
  Minimal one-token-per-line change at WorklogsPage.tsx:960, 995, 1022.
  (Plan-phase will turn this into the actual edit.)

verification: (not yet — diagnose-only mode)

files_changed: []
