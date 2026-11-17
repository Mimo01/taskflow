# Phase 98: Editor Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-17
**Phase:** 98-editor-shell
**Areas discussed:** Toolbar & insert controls, Source mode & toggle, Block editing UX, Raw blocks & preview tab

---

## Toolbar & insert controls

| Question | Options | Selected |
|---|---|---|
| Heading/quote picker | Text-style dropdown (rec) / H1-H3 buttons / You decide | You decide |
| Block insertion before slash menu | "+ Insert" dropdown (rec) / Separate buttons / You decide | You decide |
| Narrow toolbar | ⋯ overflow (rec) / Wrap to two rows / Horizontal scroll | ⋯ overflow |
| Presets | Full + compact now (rec) / Full only | Full + compact now |
| Toolbar placement | Sticky inside frame (rec) / Above frame / You decide | Sticky inside frame |
| Tooltips | Label + keycaps (rec) / Label only | Label + keycaps |

## Source mode & toggle

| Question | Options | Selected |
|---|---|---|
| Source preview | On by default, hideable (rec) / Always on / Off by default | On by default, hideable |
| Remember mode | Per user globally (rec) / Never | Per user globally |
| SAFE-05 notice | Quiet inline line (rec) / Allow "try rich anyway" | Quiet inline line |
| saveWiki failed | Block + offer source (rec) / Auto-switch to source | Block + offer source |
| Undo across toggles | Source session = one step (rec) / Fine-grained | You decide |
| Toggle presentation | Segmented Rich/Source (rec) / Icon toggle / You decide | You decide |

## Block editing UX

| Question | Options | Selected |
|---|---|---|
| Table row/col editing | Floating table toolbar (rec) / Hover handles / You decide | You decide |
| New table | Grid size picker (rec) / Fixed 3×3 | You decide |
| Panels | Inline title + type switcher (rec) / Popover form / You decide | You decide |
| Code language + colour palette | Searchable select + Jira palette (rec) / Free text + small palette / You decide | You decide |

## Raw blocks & preview tab

| Question | Options | Selected |
|---|---|---|
| Raw chunk look | Rendered + subtle frame (rec) / Code-like chip / You decide | You decide |
| Demoted notice | Frames only (rec) / Quiet note too | You decide |
| Dev tab contents (multi) | Fixture picker / Emitted wiki + kinds / Preset & width switcher / Paste-your-own | All four + "you decide" on extras |

## Claude's Discretion

Heading picker, insert menu, toggle presentation, undo model, all block-editing UX (tables, panels, code language, colour palette), raw-atom presentation, demoted-load notice, link editing UI, placeholder text, height/autosize values. Recommended defaults are recorded in CONTEXT.md.

## Folded Todos

- wiki-roundtrip-phase97-followups.md (WR-01, table-cell code, WR-02, IN-01): folded because `resolves_phase: 98`.

## Deferred Ideas

None.
