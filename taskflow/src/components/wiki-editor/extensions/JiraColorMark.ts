/**
 * JiraColorMark — TipTap inline mark for Jira {color:#hex}...{color} syntax.
 *
 * parseHTML: matches <span data-color="..."> (emitted by preprocessJiraMarkup)
 * renderHTML: emits <span data-color="..." style="color:..."> for display
 * Serializer (jiraWikiSerializer) maps this mark to {color:#hex}...{color}
 */

import { Mark } from '@tiptap/core';

export const JiraColorMark = Mark.create({
  name: 'jiraColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-color') ?? element.style?.color ?? null,
        renderHTML: (attributes) =>
          attributes.color
            ? {
                'data-color': attributes.color as string,
                style: `color:${attributes.color}`,
              }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-color]',
      },
      {
        tag: 'strong[data-color]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
