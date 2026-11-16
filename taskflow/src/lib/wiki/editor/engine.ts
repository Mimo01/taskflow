import type { Node as PMNode } from '@tiptap/pm/model';
import { type EquivalenceMaps, isEquivalent } from '../equivalence';
import { emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';
import type { WikiLoad } from './types';

/**
 * Round-trip engine (Phase 97): pure, no React, no module state.
 * `loadWiki` proves a text round-trips before the editor may use rich mode;
 * `saveWiki` returns the original string byte-for-byte when nothing changed.
 */

export type EngineDeps = { parse: typeof parseWiki; emit: typeof emitWiki };

/** Test seam for the D-11 fallback ladder (Plan 09). */
const DEFAULT_DEPS: EngineDeps = Object.freeze({ parse: parseWiki, emit: emitWiki });

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function loadWiki(
  text: string,
  maps?: EquivalenceMaps,
  deps: EngineDeps = DEFAULT_DEPS,
): WikiLoad {
  try {
    const { doc } = deps.parse(text);
    wikiSchema.nodeFromJSON(doc).check();
    const once = deps.emit(doc);
    if (!isEquivalent(text, once, maps)) {
      return { kind: 'failed', original: text, reason: 'emitted text is not render-equivalent' };
    }
    if (deps.emit(deps.parse(once).doc) !== once) {
      return { kind: 'failed', original: text, reason: 'emit is not idempotent' };
    }
    return { kind: 'rich', original: text, doc };
  } catch (err) {
    return { kind: 'failed', original: text, reason: errorMessage(err) };
  }
}

/** D-04: structural equality decides no-op, never a dirty flag. */
export function saveWiki(loaded: Extract<WikiLoad, { doc: unknown }>, current: PMNode): string {
  return current.eq(wikiSchema.nodeFromJSON(loaded.doc)) ? loaded.original : emitWiki(current);
}
