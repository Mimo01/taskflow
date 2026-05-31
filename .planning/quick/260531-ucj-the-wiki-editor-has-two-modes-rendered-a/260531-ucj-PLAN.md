---
phase: quick-260531-ucj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/wiki-editor/SourceView.tsx
autonomous: true
requirements: [UCJ-01]
must_haves:
  truths:
    - "In Source mode the textarea grows to fit its content height (like Rendered mode)"
    - "The Source-mode textarea has no manual resize drag handle"
    - "Both modes share the same minimum height (the WikiEditor wrapper minHeight)"
    - "npm run check stays GREEN (biome + tsc clean)"
  artifacts:
    - path: "taskflow/src/components/wiki-editor/SourceView.tsx"
      provides: "Auto-sizing, non-resizable source textarea"
      contains: "field-sizing-content"
  key_links:
    - from: "taskflow/src/components/wiki-editor/SourceView.tsx"
      to: "textarea className"
      via: "field-sizing-content + resize-none"
      pattern: "field-sizing-content"
---

<objective>
Make the WikiEditor Source mode behave like Rendered mode: auto-grow to fit content
height and remove the manual resize handle. Source mode currently renders a `<textarea>`
with a fixed default height (`style={{ minHeight }}`) plus a native vertical resize handle
(`resize-y`). Rendered mode (TipTap `EditorContent`) naturally fits its content and is not
resizable.

Purpose: Consistent editor sizing between Source and Rendered toggle states.
Output: Updated `SourceView.tsx` using the codebase's existing `field-sizing-content`
auto-grow pattern (already used in `src/components/ui/textarea.tsx`) and `resize-none`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# The file to edit (read before editing):
@taskflow/src/components/wiki-editor/SourceView.tsx

# Why minHeight on the textarea is redundant — WikiEditor already wraps BOTH
# modes in a div with style={{ minHeight: resolvedMinHeight }} (line 369), so the
# parent provides the height floor equally to Source and Rendered. The textarea's
# own minHeight is what forces the fixed default height in Source mode.
@taskflow/src/components/wiki-editor/WikiEditor.tsx

# Canonical auto-grow pattern already in the codebase (Tailwind v4 field-sizing):
@taskflow/src/components/ui/textarea.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make SourceView textarea auto-size and non-resizable</name>
  <files>taskflow/src/components/wiki-editor/SourceView.tsx</files>
  <action>
    Edit the `<textarea>` className and remove its inline fixed-height style so Source
    mode fits content like Rendered mode (per D-UCJ-01).

    Current className (line 38) contains `w-full resize-y ...`.
    - Replace `resize-y` with `resize-none` (removes the manual drag handle).
    - Add `field-sizing-content` (Tailwind v4 utility, already used in
      src/components/ui/textarea.tsx) so the textarea height grows with content.

    Current style (line 39) is `style={{ minHeight }}` — this is what forces the fixed
    default height. Remove the `style={{ minHeight }}` attribute entirely. The parent
    WikiEditor wrapper (`<div ... style={{ minHeight: resolvedMinHeight }}>`, WikiEditor.tsx
    line 369) already supplies the minimum-height floor to BOTH modes, so removing the
    textarea's own minHeight makes Source match Rendered: fit content, with the same
    parent-provided minimum.

    Handle the now-unused `minHeight` prop:
    - Remove `minHeight` from the destructured props and from the `SourceViewProps`
      interface (it is no longer used by this component). Verify WikiEditor.tsx still
      compiles — it currently passes `minHeight={resolvedMinHeight}` to SourceView (line 376);
      remove that prop from the SourceView usage too. Do NOT touch the wrapper div's
      minHeight on line 369 — that is what keeps both modes' minimum height.

    Do not add new dependencies. Do not introduce a `useRef`/`scrollHeight` JS auto-resize —
    the CSS `field-sizing-content` approach is the established codebase pattern and keeps the
    component dependency-free and biome-clean.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "field-sizing-content" src/components/wiki-editor/SourceView.tsx && grep -q "resize-none" src/components/wiki-editor/SourceView.tsx && ! grep -q "resize-y" src/components/wiki-editor/SourceView.tsx && ! grep -q "minHeight" src/components/wiki-editor/SourceView.tsx && echo OK</automated>
  </verify>
  <done>
    SourceView textarea uses `field-sizing-content` + `resize-none`, has no `resize-y`,
    no `style={{ minHeight }}`, and `minHeight` is removed from props/interface and from the
    WikiEditor call site.
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify biome + tsc baseline stays GREEN and tests pass</name>
  <files>taskflow/src/components/wiki-editor/SourceView.tsx, taskflow/src/components/wiki-editor/WikiEditor.tsx</files>
  <action>
    Run the project gate to confirm no regressions after the edit. `npm run check` runs
    biome check + tsc and MUST stay fully clean (Biome baseline GREEN, per project memory).
    Also run the WikiEditor test suite to confirm the Source toggle behavior is intact
    (the existing tests assert the textarea appears/hides via its `aria-label="Source"`,
    not on resize/height, so they should pass unchanged).

    If tsc flags an unused `minHeight` or a removed prop, fix the call site in WikiEditor.tsx
    (remove the `minHeight={resolvedMinHeight}` prop passed to `<SourceView>`).
  </action>
  <verify>
    <automated>cd taskflow && npm run check && npx vitest run src/components/wiki-editor/WikiEditor.test.tsx</automated>
  </verify>
  <done>
    `npm run check` exits 0 (biome + tsc clean) and WikiEditor.test.tsx passes.
  </done>
</task>

</tasks>

<verification>
- Source mode textarea: grows with content, no resize handle, same min-height floor as Rendered.
- `npm run check` GREEN.
- WikiEditor tests pass.
</verification>

<success_criteria>
- Source mode auto-grows to fit content height (matching Rendered mode).
- No manual resize handle in Source mode.
- Both modes share the WikiEditor wrapper's minimum height.
- Biome + tsc baseline remains GREEN.
</success_criteria>

<output>
Create `.planning/quick/260531-ucj-the-wiki-editor-has-two-modes-rendered-a/260531-ucj-SUMMARY.md` when done
</output>
