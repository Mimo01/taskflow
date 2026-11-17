import { describe, expect, it } from 'vitest';
import { makeEditor, saveText } from './test-utils';
import { applyTextStyle, currentTextStyle, TEXT_STYLES } from './text-style';

const text = (e: ReturnType<typeof makeEditor>) => {
  const s = saveText(e.editor, e.load);
  return 'text' in s ? s.text : '';
};

describe('text styles', () => {
  it('lists paragraph, h1..h6, quote', () => {
    expect(TEXT_STYLES.map((s) => s.id)).toEqual([
      'paragraph',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'quote',
    ]);
    expect(TEXT_STYLES[3]?.label).toBe('Heading 3');
  });

  it('applies and detects heading, quote, paragraph', () => {
    const e = makeEditor('x');
    expect(currentTextStyle(e.editor)).toBe('paragraph');
    applyTextStyle(e.editor, 'h2');
    expect(currentTextStyle(e.editor)).toBe('h2');
    expect(text(e)).toBe('h2. x');
    applyTextStyle(e.editor, 'paragraph');
    expect(currentTextStyle(e.editor)).toBe('paragraph');
    expect(text(e)).toBe('x');
    applyTextStyle(e.editor, 'quote');
    expect(currentTextStyle(e.editor)).toBe('quote');
    expect(text(e)).toMatch(/^(bq\. x|\{quote\})/);
    applyTextStyle(e.editor, 'paragraph');
    expect(currentTextStyle(e.editor)).toBe('paragraph');
    e.editor.destroy();
  });
});
