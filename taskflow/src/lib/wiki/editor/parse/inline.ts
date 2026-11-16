import type { JSONContent } from '@tiptap/core';

/**
 * Inline parser for a block's LF text. Currently models only text and line
 * breaks (`hardBreak` with its source spelling); later plans extend this
 * function with marks and inline atoms. Never throws.
 */
export function parseInline(src: string): JSONContent[] {
  const out: JSONContent[] = [];
  const parts = src.split('\n');
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) out.push({ type: 'hardBreak', attrs: { src: '\n' } });
    const part = parts[i] ?? '';
    if (part !== '') out.push({ type: 'text', text: part });
  }
  return out;
}
