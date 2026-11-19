import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Root } from 'hast';
import { highlightWikiCode } from '@/lib/wiki/highlight';

const KEY = new PluginKey<DecorationSet>('wikiCodeHighlight');

type Span = { from: number; to: number; cls: string };

/** Per-block token spans relative to the block content start. PM nodes are persistent, so
 * unchanged blocks keep identity and skip re-tokenising. Not read during React render. */
const CACHE = new WeakMap<PMNode, Span[]>();

/**
 * One span per hast element (outer before inner), each later rendered as its own nested <span>
 * via `nodeName`, so the editor DOM nests exactly like the renderer's and descendant selectors
 * (`.hljs-meta .hljs-string`) plus specificity behave identically — merging nested classes onto
 * one element let e.g. `hljs-string hljs-subst` take the string colour.
 */
function collect(nodes: Root['children'], state: { offset: number }, out: Span[]) {
  for (const n of nodes) {
    if (n.type === 'text') {
      state.offset += n.value.length;
    } else if (n.type === 'element') {
      const cls = n.properties?.className;
      // Pushed before its children so the outer decoration wraps the inner ones.
      const span: Span | null =
        Array.isArray(cls) && cls.length > 0
          ? { from: state.offset, to: state.offset, cls: cls.join(' ') }
          : null;
      if (span) out.push(span);
      collect(n.children, state, out);
      if (span) span.to = state.offset;
    }
  }
}

function spansFor(node: PMNode): Span[] {
  const cached = CACHE.get(node);
  if (cached) return cached;
  const spans: Span[] = [];
  // {noformat} and bare/unmapped languages stay plain: no auto-detect (highlightWikiCode -> null).
  if (node.attrs.open !== '{noformat}') {
    const tree = highlightWikiCode(
      typeof node.attrs.language === 'string' ? node.attrs.language : null,
      node.textContent,
    );
    if (tree) collect(tree, { offset: 0 }, spans);
  }
  CACHE.set(node, spans);
  return spans;
}

function build(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true;
    for (const s of spansFor(node)) {
      if (s.to <= s.from) continue;
      decos.push(
        Decoration.inline(pos + 1 + s.from, pos + 1 + s.to, { nodeName: 'span', class: s.cls }),
      );
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/** Highlights codeBlock text via inline decorations. Document model / emit are untouched. */
export function codeHighlightPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: KEY,
    state: {
      init: (_, { doc }) => build(doc),
      apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old.map(tr.mapping, tr.doc)),
    },
    props: {
      decorations(state) {
        return KEY.getState(state);
      },
    },
  });
}
