import type { JSONContent } from '@tiptap/core';

/**
 * Engine contract types for the wiki round-trip engine (Phase 97) and the
 * editor that consumes it (Phase 98). Pure types, no runtime code.
 */

/** Line-ending style detected on load (D-06). A new, empty text uses 'lf'. */
export type WikiEol = 'lf' | 'crlf';

/** A ProseMirror document in TipTap JSON form, valid against `wikiSchema`. */
export type WikiDocJSON = JSONContent;

/**
 * Result of parsing wiki source. `slices[i]` is the exact LF-normalised source
 * of top-level block `i`, including its leading gap, so `slices.join('')`
 * equals the LF-normalised input. The D-11 fallback ladder uses the slices to
 * demote single blocks to raw atoms.
 */
export type WikiParse = { doc: WikiDocJSON; slices: string[] };

/**
 * Result of loading a text for editing (D-11). Phase 98 decides rich vs source
 * mode from `kind`:
 * - `rich`: whole text round-trips, edit in the rich editor.
 * - `rich-demoted`: some top-level blocks (indexes in `demoted`) were
 *   replaced by raw atoms to make the round-trip equivalent.
 * - `failed`: no equivalent rich form exists, open in source mode (SAFE-05).
 */
export type WikiLoad =
  | { kind: 'rich'; original: string; doc: WikiDocJSON }
  | { kind: 'rich-demoted'; original: string; doc: WikiDocJSON; demoted: number[] }
  | { kind: 'failed'; original: string; reason: string };

/**
 * Result of saving an edited doc (SAFE-03, SAFE-06, WR-01). Phase 98 acts on `kind`:
 * - `unchanged`: nothing changed; `text` is the original, byte-identical.
 * - `saved`: edited and verified by re-parsing; `text` is safe to write.
 * - `failed`: the edit cannot be written safely (no wiki spelling for it, or
 *   the emitted text would not read back as typed). Keep the doc and offer
 *   source mode (SAFE-05); `reason` names the token and any workaround.
 */
export type WikiSave =
  | { kind: 'unchanged'; text: string }
  | { kind: 'saved'; text: string }
  | { kind: 'failed'; reason: string };
