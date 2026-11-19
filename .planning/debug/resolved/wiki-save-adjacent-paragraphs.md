---
slug: wiki-save-adjacent-paragraphs
status: resolved
trigger: "In the wiki editor I can trigger an error: Couldn't save safely: the saved text has 1 top-level blocks, the edit has 2. (content: <div> / <p>test</p> / </div>)"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms

- **Expected:** Editing in the wiki editor always saves.
- **Actual:** Banner "Couldn't save safely: the saved text has 1 top-level blocks, the edit has 2."
- **Reproduction:** Load text where a paragraph follows another block with no blank line (gap 0), e.g. `h1. Preview\n<div>...` or `a\nh2. x\nb`. Turn the heading into a paragraph, or delete the middle block.

## Resolution

root_cause: Two adjacent paragraphs where the second has `gap: 0` emit as one line run. The parser reads that back as ONE paragraph, so `checkSaved` refuses the save. `WikiGapKeeper` only repaired gap-0 blocks when the top-level block count grew (the Enter-split case). Edits that keep the count level or shrink it got no repair: heading → paragraph above a gap-0 paragraph, or deleting the block between two gap-0 paragraphs.
fix: WikiGapKeeper rule 3. A paragraph that newly sits right after another paragraph (at any depth) with gap 0 gets gap 1. "Newly" means the pair was not adjacent in the old doc (node identity), so loaded spellings stay byte-identical. An emitter-level fix was tried first and rejected: the parser can legitimately produce adjacent gap-0 paragraphs (lossless fuzz seed 42, a `\\` line after a `{color}` close), so forcing a blank line in emit broke the lossless round-trip.
verification: New adjacent-paragraph-save.test.tsx. Two cases fail on HEAD with the exact banner and pass with the fix; a third proves typing inside a loaded `h1. T\nx` keeps its spelling. The wiki suites (83 files, 1144 tests) pass; tsc is clean.
files_changed:
  - taskflow/src/components/wiki-editor/gap-keeper.ts
  - taskflow/src/components/wiki-editor/adjacent-paragraph-save.test.tsx

## Follow-up (same day): line-break-only paragraph

root_cause: The banner still showed after a `{code:html}` block, with the caret several lines below. Shift+Enter on an empty line makes a paragraph holding only hardBreaks. It emits as blank lines, which re-parse as a gap, not a block. `checkSaved`'s `isEmptyPara` only treated token-less paragraphs as empty, so the break-only paragraph counted as a block that the text had lost.
fix: `isEmptyPara` in save-check.ts counts a paragraph whose tokens are all breaks as empty (filtered on both sides, like blank lines).
verification: 3 new tests (code block + Shift+Enter ×2, a break-only paragraph between paragraphs, a save-check unit test) fail on HEAD with the banner and pass after the fix. The wiki suites pass (83 files, 1147 tests).
files_changed:
  - taskflow/src/lib/wiki/editor/save-check.ts
  - taskflow/src/lib/wiki/editor/save-check.test.ts
  - taskflow/src/components/wiki-editor/adjacent-paragraph-save.test.tsx
