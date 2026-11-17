import { undo, undoDepth } from '@tiptap/pm/history';
import { describe, expect, it, vi } from 'vitest';
import type { WikiLoad } from '@/lib/wiki/editor';
import * as engine from '@/lib/wiki/editor';
import {
  canLoadRich,
  evaluateSave,
  initialMode,
  replaceDoc,
  resetDoc,
  richToSource,
  sourceToRich,
  WIKI_TOGGLE_META,
} from './editor-session';
import { makeEditor, typeText } from './test-utils';

vi.mock('@/lib/wiki/editor', async (orig) => {
  const actual = await orig<typeof import('@/lib/wiki/editor')>();
  return { ...actual, loadWiki: vi.fn(actual.loadWiki) };
});

const FAILED: WikiLoad = { kind: 'failed', original: 'bad', reason: 'no round trip' };

function undoOnce(editor: ReturnType<typeof makeEditor>['editor']) {
  undo(editor.state, editor.view.dispatch);
}

describe('replaceDoc (EDIT-08)', () => {
  it('is one undo step, isolated from typing before and after, restoring doc attrs', () => {
    const { editor } = makeEditor('Hello *bold* text');
    const preJSON = editor.getJSON();
    typeText(editor, 'X');
    const afterX = editor.getJSON();
    const res = sourceToRich('plain\r\n\r\nsecond', 'other');
    if (res.kind !== 'load') throw new Error('expected load');
    replaceDoc(editor, res.load.doc);
    expect(editor.state.doc.attrs.eol).toBe('crlf');
    typeText(editor, 'Y');
    const afterY = editor.getJSON();
    expect(JSON.stringify(afterY)).toContain('Y');

    undoOnce(editor); // removes Y
    expect(JSON.stringify(editor.getJSON())).not.toContain('Y');
    expect(JSON.stringify(editor.getJSON())).toContain('second');
    undoOnce(editor); // restores pre-toggle doc
    expect(editor.getJSON()).toEqual(afterX);
    expect(editor.state.doc.attrs.eol).toBe('lf');
    undoOnce(editor); // removes X
    expect(editor.getJSON()).toEqual(preJSON);
    editor.destroy();
  });

  it('tags the transaction with WIKI_TOGGLE_META', () => {
    const { editor } = makeEditor('a');
    const metas: unknown[] = [];
    editor.on('transaction', ({ transaction }) =>
      metas.push(transaction.getMeta(WIKI_TOGGLE_META)),
    );
    replaceDoc(editor, editor.getJSON());
    expect(metas).toContain(true);
    editor.destroy();
  });
});

describe('resetDoc', () => {
  it('does not grow history and cannot be undone', () => {
    const { editor } = makeEditor('one');
    const depth = undoDepth(editor.state);
    const res = sourceToRich('two', 'one');
    if (res.kind !== 'load') throw new Error('expected load');
    resetDoc(editor, res.load.doc);
    expect(undoDepth(editor.state)).toBe(depth);
    undoOnce(editor);
    expect(JSON.stringify(editor.getJSON())).toContain('two');
    editor.destroy();
  });
});

describe('sourceToRich', () => {
  it('returns same for unchanged text and nothing dispatches', () => {
    const { editor } = makeEditor('a');
    const depth = undoDepth(editor.state);
    expect(sourceToRich('a', 'a')).toEqual({ kind: 'same' });
    expect(undoDepth(editor.state)).toBe(depth);
    editor.destroy();
  });

  it('is forced when the load failed', () => {
    vi.mocked(engine.loadWiki).mockReturnValueOnce(FAILED);
    expect(sourceToRich('bad', 'x')).toEqual({ kind: 'forced', reason: 'no round trip' });
  });

  it('canLoadRich reflects the load kind', () => {
    expect(canLoadRich('fine')).toBe(true);
    vi.mocked(engine.loadWiki).mockReturnValueOnce(FAILED);
    expect(canLoadRich('bad')).toBe(false);
  });
});

describe('initialMode', () => {
  const rich = engine.loadWiki('x');
  it('applies the preference unless the load failed', () => {
    expect(initialMode(rich, 'rich')).toEqual({ mode: 'rich', forced: false });
    expect(initialMode(rich, 'source')).toEqual({ mode: 'source', forced: false });
    expect(initialMode(FAILED, 'rich')).toEqual({ mode: 'source', forced: true });
  });
});

describe('evaluateSave and richToSource', () => {
  function edited(text: string, insert: string) {
    const { editor, load } = makeEditor(text);
    typeText(editor, insert);
    return { editor, load };
  }

  it('unchanged / saved / failed verdicts', () => {
    const a = makeEditor('Hello');
    expect(evaluateSave(a.load, a.editor.state.doc, 'Hello')).toEqual({
      kind: 'unchanged',
      emit: null,
      error: null,
    });
    const b = edited('Hello', 'X');
    const saved = evaluateSave(b.load, b.editor.state.doc, 'Hello');
    expect(saved.kind).toBe('saved');
    expect(saved.emit).toBe('XHello');
    expect(saved.error).toBeNull();
    const c = makeEditor('seed');
    c.editor.commands.insertContentAt(1, 'h1. hi');
    const failed = evaluateSave(c.load, c.editor.state.doc, 'seed');
    expect(failed.kind).toBe('failed');
    expect(failed.emit).toBeNull();
    expect(failed.error).toContain('h1. hi');
  });

  it('richToSource: unchanged and saved carry no note', () => {
    const a = makeEditor('Hello');
    expect(richToSource(a.load, a.editor.state.doc, 'Hello')).toEqual({
      text: 'Hello',
      note: null,
      error: null,
    });
    const b = edited('Hello', 'X');
    expect(richToSource(b.load, b.editor.state.doc, 'Hello')).toEqual({
      text: 'XHello',
      note: null,
      error: null,
    });
  });

  it('richToSource: failed save shows the unchecked emit with the reason', () => {
    const c = makeEditor('seed');
    c.editor.commands.insertContentAt(1, 'h1. hi');
    const r = richToSource(c.load, c.editor.state.doc, 'seed');
    expect(r.text).toContain('h1. hi');
    expect(r.note).toBeNull();
    expect(r.error).toContain('h1. hi');
  });

  it('richToSource: emit throwing falls back to the last safe text with a note', () => {
    const c = makeEditor('seed');
    c.editor.commands.insertContentAt(1, 'h1. hi');
    const r = richToSource(c.load, c.editor.state.doc, 'seed', {
      emit: () => {
        throw new Error('boom');
      },
    });
    expect(r.text).toBe('seed');
    expect(r.note).toBe("The latest edit couldn't be carried over.");
    expect(r.error).toContain('h1. hi');
  });
});
