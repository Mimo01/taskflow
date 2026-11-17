import { type Editor, Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  ISSUE_KEY_EXACT_RE,
  ISSUE_KEY_GLOBAL_RE,
  ISSUE_KEY_LINK_CLASS,
  isKnownPrefix,
} from '@/lib/issue-key';
import { useAuthStore } from '@/stores/auth.store';
import { getHost, WIKI_HOST_META } from './host';

/** Trusted project prefixes: active project, host project, and the host issue's own prefix. */
export function knownPrefixes(editor: Editor): string[] {
  const host = getHost(editor);
  const raw = [
    useAuthStore.getState().activeJiraProject,
    host.projectKey,
    host.issueKey ? host.issueKey.split('-')[0] : null,
  ];
  return [...new Set(raw.filter((p): p is string => !!p))];
}

const KEY = new PluginKey<DecorationSet>('wikiIssueKeyDecoration');

function build(doc: PMNode, prefixes: readonly string[]): DecorationSet {
  if (prefixes.length === 0) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos, parent) => {
    if (node.type.name === 'codeBlock' || node.type.name === 'rawBlock') return false;
    if (!node.isText || !node.text) return;
    if (parent && (parent.type.name === 'codeBlock' || parent.type.name === 'rawInline')) return;
    if (node.marks.some((m) => m.type.name === 'mono' || m.type.name === 'link')) return;
    for (const m of node.text.matchAll(ISSUE_KEY_GLOBAL_RE)) {
      const key = m[0];
      if (!ISSUE_KEY_EXACT_RE.test(key) || !isKnownPrefix(key, prefixes)) continue;
      const from = pos + (m.index ?? 0);
      decos.push(
        Decoration.inline(from, from + key.length, {
          nodeName: 'span',
          class: ISSUE_KEY_LINK_CLASS,
          'data-issue-key': key,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

/** Decorations only (D-04): keys look like links, no mark or markup is ever written. */
export const WikiIssueKeyDecoration = Extension.create({
  name: 'wikiIssueKeyDecoration',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<DecorationSet>({
        key: KEY,
        state: {
          init: (_, state) => build(state.doc, knownPrefixes(editor)),
          apply(tr, old, _o, newState) {
            if (tr.docChanged || tr.getMeta(WIKI_HOST_META)) {
              return build(newState.doc, knownPrefixes(editor));
            }
            return old;
          },
        },
        props: {
          decorations: (state) => KEY.getState(state),
          handleDOMEvents: {
            mousedown(_view, event) {
              if (!(event.metaKey || event.ctrlKey)) return false;
              const el = (event.target as HTMLElement | null)?.closest?.('[data-issue-key]');
              const key = el?.getAttribute('data-issue-key');
              if (!key) return false;
              event.preventDefault();
              getHost(editor).onOpenIssue?.(key);
              return true;
            },
          },
        },
      }),
    ];
  },
});
