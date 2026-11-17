---
phase: 98-editor-shell
plan: 05
subsystem: wiki-editor
tags: [tiptap, prosemirror, input-rules, keymap, links]
requires: [98-01, 98-03]
provides:
  - "components/wiki-editor/extensions.ts: buildEditorExtensions, editorExtensions, EDITOR_RULE_OPTIONS, EDITOR_ATTRIBUTES"
  - "WikiKeymap, WikiInputRules, WikiLinkPaste, WikiGapKeeper extensions"
  - "link-url.ts isSafeLinkUrl / normalizeLinkUrl"
  - "test-utils.ts makeEditor / typeText / saveText"
affects: [98-06, 98-12]
key-files:
  created:
    - taskflow/src/components/wiki-editor/extensions.ts
    - taskflow/src/components/wiki-editor/keymap.ts
    - taskflow/src/components/wiki-editor/input-rules.ts
    - taskflow/src/components/wiki-editor/link-url.ts
    - taskflow/src/components/wiki-editor/link-paste.ts
    - taskflow/src/components/wiki-editor/gap-keeper.ts
    - taskflow/src/components/wiki-editor/test-utils.ts
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src/lib/wiki/editor/parse/inline.ts
    - taskflow/src/lib/wiki/editor/marks.test.ts
key-decisions:
  - "Wiki wins over markdown: input rules allowlisted by extension name (EDITOR_RULE_OPTIONS), StarterKit marks kept so mark rank is unchanged"
  - "@tiptap/extension-code-block 3.34.0 added as a direct dependency (CodeBlock only reachable through starter-kit transitively); same monorepo, already in lockfile, build-only script"
requirements-completed: [EDIT-04, EDIT-05, EDIT-06, EDIT-07]
completed: 2026-11-17
---

# Phase 98 Plan 05: Headless editor core Summary

Module-scope TipTap extension list schema-identical to `wikiSchema`, with wiki-first input rules (IME-safe), editor keymap, and an http/https/mailto-only link allowlist with paste-over-selection linking. 138 headless tests cover it, including the whole corpus saving as `unchanged`.

## Tasks

The three tasks landed in one commit, `5e21f0d1`, because `extensions.ts` imports the keymap, rules and link-paste modules and the pre-commit hook runs tsc plus the full suite (a split would have needed stub extensions, which the plan forbids).

1. Extension builder, custom node/mark rendering, parity and corpus no-op tests.
2. WikiKeymap and wiki-first input rules.
3. Link URL validation and paste-URL-over-selection.

## Deviations from Plan

**1. [Rule 1 - Bug] `{{word}}` parsed as raw inline when `word` is not a known macro name** (`parse/inline.ts`). The `inMono` guard was only applied to known live macros, so `{{word}}` became `{`, rawInline `{word}`, `}` and every freshly typed or toggled monospace save failed closed. Now `!inMono` gates the whole unknown-macro branch. Regression test added in `marks.test.ts`; all 457 `src/lib/wiki` tests pass.

**2. [Rule 2 - Missing critical] WikiGapKeeper (`gap-keeper.ts`, not in plan).** Wrapping or retyping the first block (quote, list, `# `) created a node with default `gap: 1`, saving a stray leading newline (`\nbq. x`). An appendTransaction carries the old first block's gap onto the replacement when its type changes.

**3. Single-character strike `-x-` fails closed on save** (engine does not read `-x-` back). Tests use `word`. Engine behaviour left as is; it is fail-closed, not data loss.

**4. Keymap tests use `ctrlKey`** (jsdom is non-Mac so `Mod` = Ctrl). Both `Mod-Shift-.` and `Mod->` (and `,`/`<`) are bound, since the produced key name depends on layout.

**5. Commit granularity:** one commit for three tasks, see above.

## Notes for downstream plans

- `makeEditor`, `typeText`, `saveText` live in `test-utils.ts` (test only).
- Hard break canonical form saves as a plain newline (`w\nord`).
- Enter at the start of a first block copies `gap: 0` to the split-off block; not addressed here (out of scope, candidate for a later editing-polish plan).
- The schema-parity "single call site" test expects `buildEditorExtensions(` only in `extensions.ts` and `rich-extensions.ts`.

## Known Stubs

None.

## Self-Check: PASSED

All created files exist; commit 5e21f0d1 present; `npx vitest run src/components/wiki-editor src/lib/wiki`, `tsc --noEmit` and biome clean.
