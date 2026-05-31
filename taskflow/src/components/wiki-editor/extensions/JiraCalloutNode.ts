/**
 * JiraCalloutNode — TipTap block node for Jira panel/info/warning/note callouts.
 *
 * attrs:
 *   kind  — 'panel' | 'info' | 'warning' | 'note' (default 'panel')
 *   title — optional title string
 *
 * parseHTML: matches <div data-callout="..."> (emitted by preprocessJiraMarkup)
 * renderHTML: emits <div data-callout="..." data-title="..."> for display
 * Serializer maps this to {panel:title=T}...{panel} / {info}...{info} etc.
 * Body is editable (content: 'block+').
 */

import { Node } from '@tiptap/core';

export type CalloutKind = 'panel' | 'info' | 'warning' | 'note';

export const JiraCalloutNode = Node.create({
  name: 'jiraCallout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      kind: {
        default: 'panel' as CalloutKind,
        parseHTML: (element) =>
          (element.getAttribute('data-callout') as CalloutKind | null) ?? 'panel',
        renderHTML: (attributes) => ({
          'data-callout': attributes.kind as string,
        }),
      },
      title: {
        default: null as string | null,
        parseHTML: (element) => element.getAttribute('data-title') ?? null,
        renderHTML: (attributes) =>
          attributes.title ? { 'data-title': attributes.title as string } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },
});
