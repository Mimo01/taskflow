---
phase: quick-260606-oqf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/PeekPanel.tsx
autonomous: false
requirements: [PEEK-DISTINCT-01]
must_haves:
  truths:
    - "The issue peek panel is visually distinct from the main content area (does not blend in)"
    - "The added elevation/separation is consistent with existing app surface conventions (sheet/dialog/dropdown)"
    - "The distinction is visible and legible in both light and dark mode"
  artifacts:
    - path: "taskflow/src/components/app/PeekPanel.tsx"
      provides: "Peek panel root with elevation (shadow) consistent with app conventions"
      contains: "shadow"
  key_links:
    - from: "taskflow/src/components/app/PeekPanel.tsx"
      to: "tailwind shadow + ring tokens"
      via: "className on panel root div"
      pattern: "shadow-(lg|md)"
---

<objective>
Give the issue peek panel more visual distinction so it stops blending into the
main content area, while staying consistent with the app's existing surface
elevation language.

Purpose: The user reports the peek panel (a left-bordered, `bg-card` flex sibling
of `<main>`) reads as part of the page rather than a distinct preview surface.
The fix is to add elevation/separation that matches how the app already treats
floating/secondary surfaces — NOT to invent a new visual style.

Output: Updated `PeekPanel.tsx` root element with a leftward-directional shadow
and subtle ring, matching established conventions.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Target file
@taskflow/src/components/app/PeekPanel.tsx

# Established surface-elevation conventions (read for consistency — do NOT invent a new style):
# - taskflow/src/components/ui/sheet.tsx        -> side slideover uses `shadow-lg` (closest analog: a side panel)
# - taskflow/src/components/ui/popover.tsx      -> `border border-border bg-background ... shadow-lg`
# - taskflow/src/components/ui/dialog.tsx       -> floating surface with `ring-1 ring-foreground/10`
# - taskflow/src/components/ui/dropdown-menu.tsx, select.tsx, context-menu.tsx -> `shadow-md ring-1 ring-foreground/10`
#
# Convention summary:
# - Elevated/floating surfaces use a tailwind shadow utility (`shadow-md` or `shadow-lg`).
# - Subtle edge definition uses `ring-1 ring-foreground/10`, which is theme-token based
#   and therefore adapts to BOTH light and dark mode automatically.
# - There are NO custom CSS shadow theme tokens in index.css — use tailwind shadow utilities.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add consistent leftward elevation to the peek panel root</name>
  <files>taskflow/src/components/app/PeekPanel.tsx</files>
  <action>
    On the panel root `div` (currently
    `relative border-l border-border bg-card overflow-hidden flex flex-col shrink-0` plus the
    conditional transition), add elevation so the panel lifts above the adjacent `<main>` content
    instead of blending in.

    Because the peek panel sits flush against the RIGHT edge of `<main>` and is pushed
    (CSS flex sibling, not a portal/overlay), a default centered/downward shadow renders weakly.
    Use a LEFTWARD-casting shadow so the shadow falls onto the main content to its left, creating
    perceived separation. Implement with a directional arbitrary shadow value rather than the
    default `shadow-lg` direction, e.g. a Tailwind arbitrary shadow like
    `shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.25)]`. Keep intensity in the same ballpark as the
    app's `shadow-lg` surfaces (sheet/popover) — subtle, not heavy.

    ALSO add `ring-1 ring-foreground/10` to match the dialog/dropdown/select/context-menu edge
    convention. The `ring-foreground/10` token is theme-aware and renders correctly in BOTH
    light and dark mode (do not hardcode a color for the ring). Keep the existing
    `border-l border-border` (the ring complements it; it does not replace it).

    Preserve everything else verbatim: `relative`, `bg-card`, `overflow-hidden`, `flex flex-col`,
    `shrink-0`, the conditional `transition-all duration-200` (gated on `!isDragging`), the
    `style={{ width: panelWidth }}`, the resize handle, header, and body. Do NOT change layout,
    width logic, or behavior — this is a purely visual elevation change on the root container.

    Per PEEK-DISTINCT-01: result must be clearly distinct from main content AND visually
    consistent with existing app surfaces.
  </action>
  <verify>
    <automated>cd taskflow && grep -Eq "shadow-\[" src/components/app/PeekPanel.tsx && grep -q "ring-1 ring-foreground/10" src/components/app/PeekPanel.tsx && grep -q "bg-card" src/components/app/PeekPanel.tsx && npm run check</automated>
  </verify>
  <done>
    Panel root has a leftward-casting shadow and `ring-1 ring-foreground/10`; existing classes
    (bg-card, border-l, transition, layout) and behavior are unchanged; `npm run check`
    (biome + tsc) is GREEN.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Added a leftward-casting shadow + subtle `ring-1 ring-foreground/10` to the issue peek
    panel root so it reads as an elevated preview surface distinct from the main content,
    matching the app's existing sheet/dialog/dropdown elevation language.
  </what-built>
  <how-to-verify>
    1. Run the app (`cd taskflow && npm run dev` if not already running).
    2. Open any issue peek panel (e.g. click a card/story body on the Sprint Board or Backlog).
    3. Confirm the panel now visibly stands out from the main content to its left — there is a
       clear soft shadow / edge separation, not a flat seam.
    4. Toggle to DARK mode and repeat — confirm the separation is still visible and the ring/shadow
       does not look harsh, muddy, or invisible.
    5. Toggle back to LIGHT mode — confirm it looks consistent with other elevated surfaces
       (open a dropdown or the command palette for comparison; the elevation feel should match).
    6. Drag-resize the panel from its left edge — confirm the shadow/ring move cleanly with the
       panel and nothing flickers.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what looks off (too strong / too weak / wrong in dark mode / inconsistent)</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` passes (biome + tsc GREEN).
- Panel root retains all prior classes and behavior; only elevation classes added.
- Human confirms distinction is visible and consistent in both light and dark mode.
</verification>

<success_criteria>
- The issue peek panel no longer blends into the main content area.
- The elevation matches existing app surface conventions (shadow + `ring-foreground/10`).
- Distinction holds in both light and dark mode.
- No layout, width, resize, or behavioral regressions.
</success_criteria>

<output>
Create `.planning/quick/260606-oqf-on-issue-peek-panel-add-more-distinction/260606-oqf-SUMMARY.md` when done
</output>
