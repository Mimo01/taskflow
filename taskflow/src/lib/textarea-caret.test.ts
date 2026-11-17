import { describe, expect, it } from 'vitest';
import { getTextareaCaretRect } from './textarea-caret';

describe('getTextareaCaretRect', () => {
  it('returns a zero-width rect and removes its mirror element', () => {
    const ta = document.createElement('textarea');
    ta.value = 'hello @ja';
    document.body.appendChild(ta);
    const before = document.body.childElementCount;
    const rect = getTextareaCaretRect(ta, 9);
    expect(document.body.childElementCount).toBe(before);
    expect(rect.width).toBe(0);
    for (const k of ['left', 'top', 'bottom', 'height'] as const) {
      expect(Number.isFinite(rect[k])).toBe(true);
    }
    expect(rect.bottom).toBeGreaterThanOrEqual(rect.top);
    ta.remove();
  });
});
