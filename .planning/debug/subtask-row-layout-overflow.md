---
status: diagnosed
trigger: "UAT Phase 80 — SubtaskTemplateRow inline-field row layout broken, overflows right, Title squished to 0 width, in both settings and preview modes"
created: 2026-06-07
updated: 2026-06-07
---

## Current Focus

hypothesis: CONFIRMED — sum of fixed-width shrink-0 children + gaps (~784px) exceeds container content width in both consumers, with no flex-wrap. The flex-1 min-w-0 Title is the only flexible child, so it absorbs the entire deficit and collapses toward 0; the date input's intrinsic min-width forces overflow past the right edge.
next_action: return diagnosis (find_root_cause_only)

## Symptoms

expected: Inline-field row lays out within container width; Title readable (non-zero); no horizontal overflow.
actual: Row layout broken, overflows right, Title squished to 0 width. Same in settings (mode=settings) and preview (mode=preview).
errors: none
reproduction: Test 3 and Test 6 in 80-UAT.md
started: discovered in Phase 80 UAT

## Evidence

- checked: SubtaskTemplateRow.tsx line 181-189 row container
  found: `flex items-center gap-2` — no flex-wrap, single horizontal track.
  implication: All children must fit on one line or they overflow / steal from flex children.

- checked: fixed-width children
  found: Assignee div w-32 shrink-0 (128), Priority w-28 shrink-0 (112), Labels w-32 shrink-0 (128), Due date w-32 shrink-0 (128), Estimate w-20 shrink-0 (80), Story points w-16 shrink-0 (64), Advanced toggle icon-sm size-7 shrink-0 (28), far-right icon-sm/w-7 shrink-0 (28), drag handle ~16. Sum ≈ 712px. gap-2 × ~10 gaps ≈ 72px. Total ≈ 784px fixed.
  implication: ~784px is consumed before Title gets any space.

- checked: container content widths
  found: Modal BulkCreateSubtasksModal.tsx:500 Popup w-[860px], row list px-6 (line 564) → ~812px content. Settings TemplateRowEditor px-4 inside a settings card (no fixed width, narrower than modal). 812 − 784 ≈ 28px for Title → squished; settings panel narrower → Title 0/negative → overflow.
  implication: Title flex-1 min-w-0 correctly allows shrink-to-0; that is WHY it collapses instead of forcing the row wider. But buttons/inputs are shrink-0 so the overflow tips past the edge.

- checked: Due date Input type="date" w-32
  found: native date inputs have an intrinsic minimum content width (spinner + placeholder text) that often exceeds 128px and resists w-32 since the element is shrink-0.
  implication: contributes additional overflow beyond the arithmetic sum.

- checked: Title Input already has flex-1 min-w-0 (line 205)
  found: the known zero-width-collapse fix (min-w-0) is ALREADY applied to Title.
  implication: root cause is NOT a missing min-w-0; it is total fixed width budget exceeding container with no wrapping.

## Resolution

root_cause: The row is a single non-wrapping flex track (`flex items-center gap-2`, SubtaskTemplateRow.tsx:182) containing ~7 fixed-width shrink-0 controls plus 2 icon buttons whose combined width + gaps (~784px) meets or exceeds the available content width in both consumers (modal ~812px, settings panel narrower). The only flexible child is the Title (flex-1 min-w-0), so it absorbs the entire deficit and collapses toward 0px; the shrink-0 controls (notably the native date input's intrinsic min-width) cannot shrink, so the row overflows to the right.
fix: (direction) Stop relying on one horizontal track of fixed widths. Options: (a) allow the row to wrap (add flex-wrap and give Title a min-width floor like min-w-[160px]); (b) reduce/relax the fixed widths and/or move less-critical fields (Labels/Estimate/Story points/Due date) into the Advanced expand; (c) constrain via a responsive grid instead of flex so columns share remaining space. Minimal: give Title a min-width floor and let secondary fields shrink (remove some shrink-0 / cap widths), plus widen/adjust the modal or make the row container scroll-x as a fallback.
verification: (not applied — diagnose-only)
files_changed: []
