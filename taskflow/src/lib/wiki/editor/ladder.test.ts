import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from '../corpus.fixtures';
import { emitBlockNode, emitWiki } from './emit';
import { type EngineDeps, loadWiki, saveWiki } from './engine';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };

type Json = ReturnType<typeof parseWiki>['doc'];

/** Corrupts heading nodes only (drops the `h2.` prefix), everywhere. */
const corruptHeadings = (n: Json): Json => ({
  ...n,
  ...(n.type === 'heading' ? { type: 'paragraph', attrs: { gap: n.attrs?.gap ?? 0 } } : {}),
  ...(n.content ? { content: n.content.map(corruptHeadings) } : {}),
});
const headingDeps: EngineDeps = {
  parse: parseWiki,
  emit: (d) => emitWiki(corruptHeadings(d as Json)),
  emitBlock: (b) => emitBlockNode(corruptHeadings(b)),
};

describe('D-11 ladder', () => {
  it('slices tile the input and every fixture loads rich', () => {
    for (const { path, wiki } of WIKI_CORPUS) {
      const lf = wiki.replace(/\r\n/g, '\n');
      expect(parseWiki(wiki).slices.join(''), path).toBe(lf);
      expect(loadWiki(wiki, MAPS).kind, path).toBe('rich');
    }
  });

  it('demotes only the blocks whose emit differs and saves unedited byte-identical', () => {
    const text = 'h2. Title\n\nBody\n\nh2. Two';
    const loaded = loadWiki(text, MAPS, headingDeps);
    expect(loaded.kind).toBe('rich-demoted');
    if (loaded.kind !== 'rich-demoted') return;
    expect(loaded.demoted).toEqual([0, 2]);
    const blocks = loaded.doc.content ?? [];
    expect(blocks[0]?.type).toBe('rawBlock');
    expect(blocks[0]?.attrs?.raw).toBe('h2. Title');
    expect(blocks[1]?.type).toBe('paragraph');
    expect(blocks[2]?.attrs?.raw).toBe('h2. Two');
    const node = wikiSchema.nodeFromJSON(loaded.doc);
    expect(() => node.check()).not.toThrow();
    expect(saveWiki(loaded, node)).toEqual({ kind: 'unchanged', text });
    expect(emitWiki(loaded.doc)).toBe(text);
  });

  it('fails when the whole document is corrupted', () => {
    const deps: EngineDeps = { parse: parseWiki, emit: (d) => `${emitWiki(d)}X` };
    const r = loadWiki('Hello\n\nWorld', MAPS, deps);
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toContain('whole-text recheck');
  });

  it('never throws when the parser throws', () => {
    const deps: EngineDeps = {
      parse: () => {
        throw new Error('boom');
      },
      emit: emitWiki,
    };
    const r = loadWiki('x', MAPS, deps);
    expect(r).toEqual({ kind: 'failed', original: 'x', reason: 'boom' });
  });
});
