/**
 * RawJiraNode — ProseMirror atom node for verbatim Jira markup passthrough.
 *
 * Any Jira macro or construct that cannot be faithfully round-tripped through
 * the WYSIWYG model is captured into a RawJiraNode at load time and emitted
 * verbatim at save time. The node renders as a read-only chip in the editor so
 * the user knows it exists but cannot accidentally corrupt it via typing.
 *
 * Attributes:
 *   raw — the exact Jira wiki markup string to preserve verbatim on save.
 */

import { Node } from '@tiptap/core';

export const RawJiraNode = Node.create({
  name: 'rawJira',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      raw: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-raw-jira') ?? '',
        renderHTML: (attributes) => ({
          'data-raw-jira': attributes.raw as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-raw-jira]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        'data-raw-jira': HTMLAttributes['data-raw-jira'] as string,
        class:
          'inline-flex items-center gap-1.5 px-2 py-0.5 my-1 rounded border border-dashed border-muted-foreground/50 bg-muted/30 text-muted-foreground text-xs font-mono select-none cursor-default',
        contenteditable: 'false',
        title: 'Raw Jira macro — edit in Source view to modify this content',
      },
      ['span', { class: 'opacity-60' }, '⚙'],
      ['span', {}, 'Raw Jira macro — edit in Source'],
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      const raw = node.attrs['raw'] as string;

      dom.setAttribute('data-raw-jira', raw);
      dom.setAttribute('contenteditable', 'false');
      dom.className =
        'inline-flex items-center gap-1.5 px-2 py-0.5 my-1 rounded border border-dashed border-muted-foreground/50 bg-muted/30 text-muted-foreground text-xs font-mono select-none cursor-default';
      dom.title = 'Raw Jira macro — edit in Source view to modify this content';

      const icon = document.createElement('span');
      icon.className = 'opacity-60';
      icon.textContent = '⚙';

      const label = document.createElement('span');
      // Show a truncated snippet of the raw content for identification
      const preview = raw.length > 40 ? `${raw.substring(0, 40)}…` : raw;
      label.textContent = `Raw Jira: ${preview}`;

      dom.appendChild(icon);
      dom.appendChild(label);

      return {
        dom,
        // No contentDOM — atom node is non-editable
      };
    };
  },
});
