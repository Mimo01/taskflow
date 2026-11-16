import type { Node as PMNode } from '@tiptap/pm/model';
import { type EquivalenceMaps, isEquivalent } from '../equivalence';
import { emitBlockNode, emitWiki } from './emit';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';
import type { WikiDocJSON, WikiLoad } from './types';

/**
 * Round-trip engine (Phase 97): pure, no React, no module state.
 * `loadWiki` proves a text round-trips before the editor may use rich mode;
 * `saveWiki` returns the original string byte-for-byte when nothing changed.
 */

export type EngineDeps = {
  parse: typeof parseWiki;
  emit: typeof emitWiki;
  /** Per-block emitter used by the D-11 ladder; defaults to `emitBlockNode`. */
  emitBlock?: (node: WikiDocJSON) => string;
};

/** Test seam for the D-11 fallback ladder. */
const DEFAULT_DEPS: EngineDeps = Object.freeze({ parse: parseWiki, emit: emitWiki });

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function loadWiki(
  text: string,
  maps?: EquivalenceMaps,
  deps: EngineDeps = DEFAULT_DEPS,
): WikiLoad {
  try {
    const { doc, slices } = deps.parse(text);
    wikiSchema.nodeFromJSON(doc).check();
    const once = deps.emit(doc);
    const equivalent = isEquivalent(text, once, maps);
    if (equivalent && deps.emit(deps.parse(once).doc) === once) {
      return { kind: 'rich', original: text, doc };
    }
    return demote(
      text,
      doc,
      slices,
      equivalent ? 'emit is not idempotent' : 'emitted text is not render-equivalent',
      maps,
      deps,
    );
  } catch (err) {
    return { kind: 'failed', original: text, reason: errorMessage(err) };
  }
}

/** Source of one top-level block: its slice without separator, gap and tail blank lines. */
const blockSource = (slice: string): string =>
  slice.replace(/^(?:[^\S\n]*\n)*/, '').replace(/(?:\n[ \t]*)+$/, '');

/**
 * D-11 ladder: replace each top-level block whose own emit is not equivalent
 * to its source with a raw atom, then re-check the whole text (the authority;
 * per-block comparison is only a heuristic). Idempotence of a demoted doc is
 * not re-checked through parse, since re-parsing would rebuild the blocks that
 * were demoted; loading the text again demotes them again.
 */
function demote(
  text: string,
  doc: WikiDocJSON,
  slices: readonly string[],
  firstReason: string,
  maps: EquivalenceMaps | undefined,
  deps: EngineDeps,
): WikiLoad {
  const emitBlock = deps.emitBlock ?? ((n: WikiDocJSON) => emitBlockNode(n));
  const blocks = doc.content ?? [];
  const demoted: number[] = [];
  const content = blocks.map((block, i) => {
    const source = blockSource(slices[i] ?? '');
    if (block.type === 'rawBlock' || isEquivalent(source, emitBlock(block), maps)) return block;
    demoted.push(i);
    return { type: 'rawBlock', attrs: { raw: source, gap: block.attrs?.gap ?? 0 } };
  });
  const fail = (why: string): WikiLoad => ({
    kind: 'failed',
    original: text,
    reason: `whole-text recheck failed after demoting blocks (${firstReason}): ${why}`,
  });
  if (demoted.length === 0) return fail('no block could be demoted');
  const next: WikiDocJSON = { ...doc, content };
  wikiSchema.nodeFromJSON(next).check();
  if (!isEquivalent(text, deps.emit(next), maps)) return fail('still not equivalent');
  return { kind: 'rich-demoted', original: text, doc: next, demoted };
}

/** D-04: structural equality decides no-op, never a dirty flag. */
export function saveWiki(loaded: Extract<WikiLoad, { doc: unknown }>, current: PMNode): string {
  return current.eq(wikiSchema.nodeFromJSON(loaded.doc)) ? loaded.original : emitWiki(current);
}
