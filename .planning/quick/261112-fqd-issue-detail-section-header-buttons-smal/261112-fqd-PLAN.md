---
phase: quick-261112-fqd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
  - taskflow/src/routes/dashboard/issue-detail/SectionHeader.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx
  - taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx
autonomous: true
requirements: [QUICK-261112-fqd]

must_haves:
  truths:
    - "Attachments 'Attach file', Subtasks 'Bulk create' and 'Add subtask' header buttons render as ghost, size xs (h-6), no border (per D-01)"
    - "The three buttons show muted text that turns foreground on hover, with ghost hover bg (per D-01)"
    - "Each button keeps its icon (size-3) + text label (per D-02)"
    - "All three buttons share one className source so they cannot drift apart (D-03, Claude's discretion)"
    - "SectionHeader row height stays h-7"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx"
      provides: "SECTION_ACTION_BUTTON_CLASS + SECTION_ACTION_ICON_CLASS exports"
      contains: "SECTION_ACTION_BUTTON_CLASS"
    - path: "taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx"
      provides: "Bulk create / Add subtask using ghost xs + shared class"
      contains: "variant=\"ghost\""
    - path: "taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx"
      provides: "Attach file using ghost xs + shared class"
      contains: "variant=\"ghost\""
  key_links:
    - from: "SubtaskCreateControl.tsx, AttachmentUpload.tsx"
      to: "SectionHeader.tsx"
      via: "import { SECTION_ACTION_BUTTON_CLASS, SECTION_ACTION_ICON_CLASS } from './SectionHeader'"
      pattern: "SECTION_ACTION_BUTTON_CLASS"
---

<objective>
Restyle the issue-detail section header action buttons (Attachments "Attach file"; Subtasks "Bulk create" + "Add subtask") from `variant="outline" size="sm"` to a smaller, quieter ghost xs style, identical across all three, per the user's locked decisions in 261112-fqd-CONTEXT.md.

Purpose: section header actions currently look like primary-weight outline buttons; the user chose (via preview) a quiet ghost look.
Output: shared class constants in SectionHeader.tsx, both consumers switched, a guard test.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261112-fqd-issue-detail-section-header-buttons-smal/261112-fqd-CONTEXT.md
@taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
@taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx
@taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx
@taskflow/src/components/ui/button.tsx

Facts gathered during planning:
- button.tsx `ghost` variant = `hover:bg-muted hover:text-foreground ...`, no border styling beyond base `border-transparent`. `xs` size = `h-6 gap-1 px-2 text-xs ... [&_svg:not([class*='size-'])]:size-3`.
- Current consumers all use `variant="outline" size="sm" className="gap-1.5 text-xs"` with `size-3.5` icons.
- No existing test asserts on these buttons' classes (SectionHeader.test.tsx, SubtaskCreateControl.test.tsx, AttachmentsSection.test.tsx only query by role/name), so existing tests should keep passing unchanged.
- App code lives in the inner `taskflow/` dir: run npm/vitest/biome/tsc from `/Users/mimo/Documents/Projects/taskflow/taskflow`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared section-action class constants + switch all three buttons to ghost xs</name>
  <files>taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx, taskflow/src/routes/dashboard/issue-detail/SectionHeader.test.tsx, taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx, taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx</files>
  <behavior>
    - SubtaskCreateControl: both "Bulk create" and "Add subtask" buttons have classes `h-6` (from xs), `text-muted-foreground`, `hover:text-foreground`, and do NOT have `border-border` (outline variant marker).
    - AttachmentUpload "Attach file" button: same assertions as above (render inside a QueryClientProvider; mock `@/services/stronghold` / attachments service only if the existing AttachmentsSection.test.tsx pattern requires it — reuse its setup).
    - Each of the three buttons' svg icon has class `size-3`.
  </behavior>
  <action>
    Per D-03 (Claude's discretion — centralise): in SectionHeader.tsx export two constants next to LABEL_CLASS: `SECTION_ACTION_BUTTON_CLASS = 'gap-1 text-muted-foreground hover:text-foreground'` and `SECTION_ACTION_ICON_CLASS = 'size-3'`, with a short JSDoc saying they are for buttons passed via `actions` and must be used with `<Button variant="ghost" size="xs">`. Update the component's header comment ("actions right-aligned with gap-2") to mention the shared ghost xs action style. If biome flags exporting a non-component from a component module, move the two constants to a new sibling file `section-header-styles.ts` instead and import from there (add it to files touched).
    Per D-01/D-02: in SubtaskCreateControl.tsx change both Buttons to `variant="ghost" size="xs" className={SECTION_ACTION_BUTTON_CLASS}` and icons (LayoutList, Plus) to `className={SECTION_ACTION_ICON_CLASS}`; keep the text labels, onClick handlers and `type="button"`; update the JSDoc ("two separate outline buttons") to say ghost xs, same as Attach file. In AttachmentUpload.tsx do the same for the "Attach file" Button and its Upload icon; keep `disabled`, the stopPropagation onClick, and the progress/error blocks untouched. Do not change SectionHeader's h-7 row or the Activity filter chips / Epic Progress toggle (out of scope per CONTEXT).
    Write the behavior tests first: add a `describe('section action buttons')` block in SectionHeader.test.tsx (or a new case in SubtaskCreateControl.test.tsx + AttachmentsSection.test.tsx, whichever reuses existing render setup with less scaffolding). Per project memory, the pre-commit hook runs full vitest, so commit test + implementation together in one commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/SectionHeader.test.tsx src/routes/dashboard/issue-detail/SubtaskCreateControl.test.tsx src/routes/dashboard/issue-detail/AttachmentsSection.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail/SectionHeader.tsx src/routes/dashboard/issue-detail/SectionHeader.test.tsx src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx src/routes/dashboard/issue-detail/AttachmentUpload.tsx && ! grep -n 'variant="outline"' src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx src/routes/dashboard/issue-detail/AttachmentUpload.tsx</automated>
  </verify>
  <done>All three header buttons render ghost/xs with muted-to-foreground text, size-3 icons, labels intact, sourced from one shared class constant; new tests pass; existing issue-detail tests, tsc and biome (touched files only) pass; no `variant="outline"` left in the two consumer files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Pure styling change; no new input, data flow or network calls |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fqd-01 | Tampering | SectionHeader action buttons | accept | className-only change, behaviour (onClick/disabled) preserved and covered by existing tests |
</threat_model>

<verification>
- Targeted vitest files pass; `npx tsc --noEmit` clean; `npx biome check` on touched files only (never `biome --write` on all of src).
- grep confirms no outline variant remains in SubtaskCreateControl.tsx / AttachmentUpload.tsx.
- Visual (UAT by user): open an issue with subtasks and attachments — the three buttons are identical, borderless, h-6, muted, and the header row height is unchanged.
</verification>

<success_criteria>
- D-01: ghost, xs (h-6), muted text → foreground on hover, no border — on all three buttons.
- D-02: icon (size-3) + label kept.
- D-03: one shared class source in SectionHeader.tsx (or sibling styles file).
- Out-of-scope controls untouched.
</success_criteria>

<output>
Create `.planning/quick/261112-fqd-issue-detail-section-header-buttons-smal/261112-fqd-SUMMARY.md` when done
</output>
