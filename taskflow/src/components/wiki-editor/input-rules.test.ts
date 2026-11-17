import { describe, expect, it } from 'vitest';
import { makeEditor, saveText, typeText } from './test-utils';

function type(text: string, composing = false) {
  const { editor, load } = makeEditor('');
  editor.commands.focus('end');
  if (composing)
    Object.defineProperty(editor.view, 'composing', { value: true, configurable: true });
  typeText(editor, text);
  const s = saveText(editor, load);
  return { editor, text: s.kind === 'saved' ? s.text : s.kind };
}

describe('wiki input rules', () => {
  it.each([
    ['*word* ', 'bold', '*word*'],
    ['_word_ ', 'italic', '_word_'],
    ['-word- ', 'strike', '-word-'],
    ['+word+ ', 'underline', '+word+'],
    ['^word^', 'sup', '^word^'],
    ['~word~', 'sub', '~word~'],
    ['{{word}}', 'mono', '{{word}}'],
  ])('%j makes %s', (typed, mark, saved) => {
    const { editor, text } = type(typed);
    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks?.[0]?.type).toBe(mark);
    expect(text.trimEnd()).toBe(saved.trimEnd());
  });

  it('star is bold, not italic', () => {
    const { editor } = type('*x*');
    expect(editor.getHTML()).toContain('<strong>');
    expect(editor.getHTML()).not.toContain('<em>');
  });

  it.each([
    ['* ', 'bulletList'],
    ['- ', 'bulletList'],
    ['# ', 'orderedList'],
    ['1. ', 'orderedList'],
  ])('%j makes %s (not a heading)', (typed, node) => {
    const { editor } = type(typed);
    expect(editor.getJSON().content?.[0]?.type).toBe(node);
  });

  it.each([
    ['h3. ', 3],
    ['## ', 2],
  ])('%j makes heading', (typed, level) => {
    const { editor } = type(typed);
    const first = editor.getJSON().content?.[0];
    expect(first?.type).toBe('heading');
    expect(first?.attrs?.level).toBe(level);
  });

  it('code blocks', () => {
    expect(type('{code}').editor.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: null },
    });
    expect(type('{code:java}').editor.getJSON().content?.[0]?.attrs?.language).toBe('java');
    expect(type('{noformat}').editor.getJSON().content?.[0]?.attrs).toMatchObject({
      open: '{noformat}',
      close: '{noformat}',
    });
  });

  it('does not strike a-b-c', () => {
    expect(type('a-b-c').editor.getHTML()).not.toContain('<s>');
  });

  it('no rule fires during IME composition', () => {
    expect(type('*x* ', true).editor.getHTML()).not.toContain('<strong>');
    expect(type('h1. ', true).editor.getJSON().content?.[0]?.type).toBe('paragraph');
  });
});
