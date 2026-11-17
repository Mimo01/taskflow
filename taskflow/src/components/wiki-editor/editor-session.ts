import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { WikiDocJSON, WikiLoad, WikiSave } from '@/lib/wiki/editor';
import { emitWiki, loadWiki, saveWiki } from '@/lib/wiki/editor';

type RichLoad = Extract<WikiLoad, { doc: unknown }>;

/** Transaction meta marking a programmatic replace so the shell's onUpdate skips it. */
export const WIKI_TOGGLE_META = 'wikiToggle';

export const CARRY_OVER_NOTE = "The latest edit couldn't be carried over.";

function buildReplace(editor: Editor, nextJSON: WikiDocJSON) {
  const { state } = editor;
  const next = editor.schema.nodeFromJSON(nextJSON);
  const tr = state.tr.replaceWith(0, state.doc.content.size, next.content);
  for (const [key, value] of Object.entries(next.attrs)) {
    if (state.doc.attrs[key] !== value) tr.setDocAttribute(key, value);
  }
  tr.setMeta(WIKI_TOGGLE_META, true);
  return tr;
}

/**
 * Replace the whole document as ONE undo step, isolated from typing before and
 * after (EDIT-08). Doc attrs (eol/tail) are part of the same transaction.
 */
export function replaceDoc(editor: Editor, nextJSON: WikiDocJSON): void {
  const { view } = editor;
  view.dispatch(closeHistory(buildReplace(editor, nextJSON)));
  view.dispatch(closeHistory(editor.state.tr));
}

/** Replace for a true external value change: not undoable back to the old text. */
export function resetDoc(editor: Editor, nextJSON: WikiDocJSON): void {
  const tr = buildReplace(editor, nextJSON);
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}

/** D-06: the preference applies unless the load failed; forced never writes the preference. */
export function initialMode(
  load: WikiLoad,
  preference: 'rich' | 'source',
): { mode: 'rich' | 'source'; forced: boolean } {
  if (load.kind === 'failed') return { mode: 'source', forced: true };
  return { mode: preference, forced: false };
}

export function evaluateSave(
  load: RichLoad,
  doc: PMNode,
  lastEmitted: string,
): { kind: WikiSave['kind']; emit: string | null; error: string | null } {
  const saved = saveWiki(load, doc);
  if (saved.kind === 'failed') return { kind: 'failed', emit: null, error: saved.reason };
  return {
    kind: saved.kind,
    emit: saved.text !== lastEmitted ? saved.text : null,
    error: null,
  };
}

/** D-08: leaving rich never silently drops the user's edit. */
export function richToSource(
  load: RichLoad,
  doc: PMNode,
  lastEmitted: string,
  deps: { emit: (doc: PMNode) => string } = { emit: emitWiki },
): { text: string; note: string | null; error: string | null } {
  const saved = saveWiki(load, doc);
  if (saved.kind === 'unchanged') return { text: load.original, note: null, error: null };
  if (saved.kind === 'saved') return { text: saved.text, note: null, error: null };
  try {
    return { text: deps.emit(doc), note: null, error: saved.reason };
  } catch {
    return { text: lastEmitted, note: CARRY_OVER_NOTE, error: saved.reason };
  }
}

export function sourceToRich(
  text: string,
  textAtToggle: string,
): { kind: 'same' } | { kind: 'forced'; reason: string } | { kind: 'load'; load: RichLoad } {
  if (text === textAtToggle) return { kind: 'same' };
  const load = loadWiki(text);
  if (load.kind === 'failed') return { kind: 'forced', reason: load.reason };
  return { kind: 'load', load };
}

export function canLoadRich(text: string): boolean {
  return loadWiki(text).kind !== 'failed';
}
