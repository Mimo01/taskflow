import { describe, expect, it } from 'vitest';
import { HARNESS_ATTACHMENTS, HARNESS_USERS, WIKI_CORPUS } from '../corpus.fixtures';
import { emitWiki } from './emit';
import { type EngineDeps, loadWiki, saveWiki } from './engine';
import { parseWiki } from './parse/blocks';
import { wikiSchema } from './schema';

const MAPS = { attachments: HARNESS_ATTACHMENTS, users: HARNESS_USERS };

describe('loadWiki / saveWiki', () => {
  it('every corpus fixture loads rich and saves byte-identical when unedited (SAFE-03)', () => {
    expect(WIKI_CORPUS.length).toBeGreaterThanOrEqual(64);
    for (const { path, wiki } of WIKI_CORPUS) {
      const loaded = loadWiki(wiki, MAPS);
      expect(loaded.kind, path).toBe('rich');
      if (loaded.kind !== 'rich') continue;
      expect(saveWiki(loaded, wikiSchema.nodeFromJSON(loaded.doc)), path).toBe(wiki);
      const rebuilt = wikiSchema.nodeFromJSON(wikiSchema.nodeFromJSON(loaded.doc).toJSON());
      expect(saveWiki(loaded, rebuilt), path).toBe(wiki);
    }
  });

  it('an edited doc saves emitted text', () => {
    const loaded = loadWiki('First\n\nSecond', MAPS);
    if (loaded.kind !== 'rich') throw new Error('expected rich');
    const json = structuredClone(loaded.doc);
    json.content?.push({ type: 'paragraph', content: [{ type: 'text', text: 'Added' }] });
    const saved = saveWiki(loaded, wikiSchema.nodeFromJSON(json));
    expect(saved).not.toBe(loaded.original);
    expect(saved).toBe('First\n\nSecond\n\nAdded');
  });

  it('keeps the CRLF style when editing a CRLF document', () => {
    const loaded = loadWiki('First\r\n\r\nSecond', MAPS);
    if (loaded.kind !== 'rich') throw new Error('expected rich');
    const json = structuredClone(loaded.doc);
    json.content?.push({ type: 'paragraph', content: [{ type: 'text', text: 'Added' }] });
    expect(saveWiki(loaded, wikiSchema.nodeFromJSON(json))).toBe(
      'First\r\n\r\nSecond\r\n\r\nAdded',
    );
  });

  it('never throws on degenerate input', () => {
    for (const s of ['', '{', '{code}', 'x'.repeat(20_000), 'a\n'.repeat(2_000)]) {
      expect(loadWiki(s, MAPS)).toHaveProperty('kind');
    }
  }, 30_000);

  it('fails when the emitter is not equivalent or not idempotent', () => {
    const bad: EngineDeps = { parse: parseWiki, emit: (d) => `${emitWiki(d)}X` };
    const r = loadWiki('hello', MAPS, bad);
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') {
      expect(r.original).toBe('hello');
      expect(r.reason.length).toBeGreaterThan(0);
    }
    // Idempotence: equivalent first emit, drifting second emit.
    let calls = 0;
    const drifting: EngineDeps = {
      parse: parseWiki,
      emit: (d) => (calls++ === 0 ? emitWiki(d) : `${emitWiki(d)}\n\n\n`),
    };
    const r2 = loadWiki('hello', MAPS, drifting);
    expect(r2.kind).toBe('failed');
    if (r2.kind === 'failed') expect(r2.reason).toContain('idempotent');
  });

  it('a throwing parser yields failed, not an exception', () => {
    const boom: EngineDeps = {
      parse: () => {
        throw new Error('boom');
      },
      emit: emitWiki,
    };
    expect(loadWiki('x', MAPS, boom)).toEqual({ kind: 'failed', original: 'x', reason: 'boom' });
  });
});
