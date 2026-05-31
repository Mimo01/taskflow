/**
 * JiraColorMark — TipTap inline mark for Jira {color:#hex}...{color} syntax.
 *
 * parseHTML: matches <span data-color="..."> (emitted by preprocessJiraMarkup)
 * renderHTML: emits <span data-color="..." style="color:..."> for display
 * Serializer (jiraWikiSerializer) maps this mark to {color:#hex}...{color}
 *
 * Security: renderHTML validates the color value before emitting inline style.
 * Only hex (#rgb / #rrggbb / #rgba / #rrggbbaa), rgb()/rgba(), and CSS named
 * colors (letters-only) are allowed. Anything containing semicolons, parens
 * with unexpected tokens, or other injected CSS is rejected — the data-color
 * attribute is preserved for re-serialization but no style is emitted.
 */

import { Mark } from '@tiptap/core';

/**
 * Return true if the color string is safe to interpolate into a CSS style attribute.
 * Accepts: #rgb, #rrggbb, #rgba, #rrggbbaa, rgb(...), rgba(...), named colors (letters only).
 *
 * Exported for unit testing.
 */
export function isSafeColor(color: string): boolean {
  // Hex: #RGB, #RRGGBB, #RGBA, #RRGGBBAA
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{1}([0-9a-fA-F]{2}([0-9a-fA-F]{2})?)?)?$/.test(color)) {
    return true;
  }
  // rgb() / rgba() with numeric components only
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/.test(color)) {
    return true;
  }
  // CSS named colors: letters only (e.g. "red", "blue", "transparent")
  if (/^[a-zA-Z]+$/.test(color)) {
    return true;
  }
  return false;
}

export const JiraColorMark = Mark.create({
  name: 'jiraColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-color') ?? element.style?.color ?? null,
        renderHTML: (attributes) => {
          const color = attributes.color as string | null;
          if (!color) return {};
          // Only emit style="color:..." when the value is proven safe.
          // data-color is always emitted so the serializer can round-trip the value.
          return isSafeColor(color)
            ? { 'data-color': color, style: `color:${color}` }
            : { 'data-color': color };
        },
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
