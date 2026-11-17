import { type Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { createSuggestionExtension } from './create-suggestion';
import { EMOTICONS, type EmoticonEntry } from './emoticon-data';

/**
 * Rank: name-prefix matches first (shortest name first, so "flag" precedes "flag off"),
 * then substring matches on name, keywords and token in table order.
 */
export function filterEmoticons(query: string): EmoticonEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...EMOTICONS];
  const prefix = EMOTICONS.filter((e) => e.name.startsWith(q)).sort(
    (a, b) => a.name.length - b.name.length,
  );
  const rest = EMOTICONS.filter(
    (e) =>
      !e.name.startsWith(q) &&
      (e.name.includes(q) || e.token.includes(q) || e.keywords.some((k) => k.includes(q))),
  );
  return [...prefix, ...rest];
}

interface ForceState {
  pos: number | null;
}

export const emoticonForceKey = new PluginKey<ForceState>('wikiEmoticonForce');

/**
 * Lets the slash row / footer button open the list with an empty query. Normally ":" alone
 * does not open (D-18). The forced position is cleared by any other document change.
 */
export const WikiEmoticonForce = Extension.create({
  name: 'wikiEmoticonForce',
  // Must apply before the suggestion plugin, whose allow() reads this state from the new
  // (partially built) editor state.
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin<ForceState>({
        key: emoticonForceKey,
        state: {
          init: () => ({ pos: null }),
          apply(tr, prev) {
            const meta = tr.getMeta(emoticonForceKey) as ForceState | undefined;
            if (meta) return meta;
            return tr.docChanged ? { pos: null } : prev;
          },
        },
      }),
    ];
  },
});

/** Insert ":" at the caret (space-separated from a preceding word) and open the full list. */
export function openEmoticonSuggestion(editor: Editor): void {
  if (editor.isDestroyed) return;
  const { state, view } = editor;
  const { from, to, $from } = state.selection;
  const before =
    $from.parentOffset > 0
      ? $from.parent.textBetween($from.parentOffset - 1, $from.parentOffset, undefined, '￼')
      : '';
  const needsSpace = before !== '' && !/\s/.test(before);
  const text = needsSpace ? ' :' : ':';
  const tr = state.tr.insertText(text, from, to);
  tr.setMeta(emoticonForceKey, { pos: from + (needsSpace ? 1 : 0) });
  view.dispatch(tr);
  view.focus();
}

// Prefix class keeps "10:30", "http:" and "a:b" from ever matching.
const EMOTICON_RE = /(?:^|[\s([]):([A-Za-z][\w-]*)?$/;

export const WikiEmoticonSuggestion = createSuggestionExtension({
  name: 'wikiEmoticon',
  char: ':',
  maxRows: 6,
  closeOnEmpty: true,
  findSuggestionMatch: ({ $position }) => {
    const before = $position.parent.textBetween(0, $position.parentOffset, undefined, '￼');
    const match = EMOTICON_RE.exec(before);
    if (!match) return null;
    const colon = match.index + match[0].indexOf(':');
    const from = $position.start() + colon;
    return {
      range: { from, to: $position.pos },
      query: match[1] ?? '',
      text: before.slice(colon),
    };
  },
  allow: ({ state, range }) => {
    const query = state.doc.textBetween(range.from + 1, range.to, undefined, '￼');
    if (query.length > 0) return true;
    return emoticonForceKey.getState(state)?.pos === range.from;
  },
  items: ({ query }) =>
    filterEmoticons(query).map((e) => ({
      key: e.token,
      label: e.name,
      detail: e.token,
      mono: true,
      glyph: e.glyph,
      data: e,
    })),
  command: ({ editor, range, row }) => {
    const entry = row.data as EmoticonEntry;
    editor
      .chain()
      .focus()
      .insertContentAt(range, { type: 'emoticon', attrs: { src: entry.token } })
      .run();
  },
});
