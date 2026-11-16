# Phase 97: Round-Trip Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives that were considered.

**Date:** 2026-11-16
**Phase:** 97-round-trip-engine
**Areas discussed:** Mixed-nesting renderer fix, Spelling kept after an edit, Modelled vs raw atom, Doc model & TipTap deps

---

## Mixed-nesting renderer fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fix renderer in 97 | Preprocess turns `*#` and `#*` into nested lists like Jira. The display changes across the app | ✓ |
| Leave renderer as is | Only the parser models it. Editor and read-only view are inconsistent | |
| Separate quick task | Fix it outside the phase | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fix both | Also remove the injected empty header row for header-less tables | ✓ |
| Only mixed nesting | Keep the empty header row and use the doc attribute only | |

| Option | Description | Selected |
|--------|-------------|----------|
| First plan, own commit | Renderer fixes land before the parser | |
| You decide | Leave the plan order to the planner | ✓ |

**User's choice:** Fix both divergences in 97. The planner decides the sequencing.

---

## Spelling kept after an edit

| Option | Description | Selected |
|--------|-------------|----------|
| Every variant, as node attrs | Keep all source spellings, so edited texts diff minimally | ✓ |
| Only the SAFE-06 set | Keep emoticons, mentions, escapes, breaks and line endings, and make the rest canonical | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dominant style of the original | Detect CRLF or LF and emit every line that way | ✓ |
| Per-line, exactly | Each line keeps its own ending | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it | Carry trailing whitespace on nodes | |
| Strip it on edit | Strip trailing whitespace once the text is edited | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Exempt code/noformat | Strip prose lines only | ✓ |
| Strip everywhere | Also strip inside code and noformat | |

| Option | Description | Selected |
|--------|-------------|----------|
| Match today's toolbar output | Use the current toolbar and CommentComposer forms | ✓ |
| Follow the text's own style | New nodes copy the text's existing style | |
| You decide | | |

**User's choice:** Keep every variant as attributes and use the dominant line ending. Strip trailing whitespace on edit, except in code and noformat. New nodes use the toolbar's forms.

---

## Modelled vs raw atom

| Option (multi) | Description | Selected |
|--------|-------------|----------|
| Panels inside table cells | Model as nested panel nodes | ✓ |
| Lists/panels in panels | Model lists in panels and panels in list items | ✓ |
| {color} across blocks | A mark per block, merged on emit | ✓ |
| Image attributes | An image atom keeping its parameter string | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Smallest span | Inline raw atom; a block atom for multi-line spans or broken structure | ✓ |
| Whole top-level block | Any unknown span makes its whole block raw | |

| Option | Description | Selected |
|--------|-------------|----------|
| Demote blocks, then fail | Compare per block, demote the mismatching blocks, check again | ✓ |
| All-or-nothing | Any mismatch sends the text to source mode | |

| Option | Description | Selected |
|--------|-------------|----------|
| Raw atom, add fixtures | Raw from the opener to the end of its block or text | |
| You decide | Research checks the renderer's and Jira's behaviour | ✓ |

**User's choice:** Model all four hard constructs (still subject to corpus proof). Use smallest-span atoms and the demote-then-fail ladder. Malformed macros are left to Claude.

---

## Doc model & TipTap deps

| Option | Description | Selected |
|--------|-------------|----------|
| ProseMirror JSON + real schema | Add `@tiptap/core` and `@tiptap/pm` in 97 and validate docs against the schema | |
| Editor-agnostic AST | No deps; Phase 98 maps the AST to TipTap | |

| Option | Description | Selected |
|--------|-------------|----------|
| Separate module, not in barrel | Keep it out of `lib/wiki/index.ts`, with a guard test | |
| You decide | | |

**User's choice:** "You decide" on both. Recorded as Claude's discretion: the default is ProseMirror JSON and a separate module kept out of the main bundle.

---

## Claude's Discretion

- Doc model and dependencies
- Module placement
- Sequencing of the renderer-fix plan
- Handling of unclosed or mismatched macros
- Escaping module, attribute names, engine API shape and normaliser additions

## Deferred Ideas

- SAFE-F1 per-block re-emit (future requirement)
- Jira-HTML golden files for lists (still deferred)
