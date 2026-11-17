import { describe, expect, it } from 'vitest';
import { makeEditor, saveText } from './test-utils';

const out = (
  e: ReturnType<typeof makeEditor>['editor'],
  l: ReturnType<typeof makeEditor>['load'],
) => {
  const s = saveText(e, l);
  return s.kind === 'saved' ? s.text : s.kind;
};
function sel(text: string) {
  const m = makeEditor(text);
  m.editor.commands.setTextSelection({ from: 1, to: 1 + text.length });
  return m;
}

describe('commands emit canonical wiki', () => {
  it.each([
    ['toggleBold', (e: ReturnType<typeof sel>['editor']) => e.commands.toggleBold(), '*word*'],
    ['toggleItalic', (e: ReturnType<typeof sel>['editor']) => e.commands.toggleItalic(), '_word_'],
    [
      'toggleUnderline',
      (e: ReturnType<typeof sel>['editor']) => e.commands.toggleUnderline(),
      '+word+',
    ],
    ['toggleStrike', (e: ReturnType<typeof sel>['editor']) => e.commands.toggleStrike(), '-word-'],
    ['mono', (e: ReturnType<typeof sel>['editor']) => e.commands.toggleMark('mono'), '{{word}}'],
    ['sup', (e: ReturnType<typeof sel>['editor']) => e.commands.toggleMark('sup'), '^word^'],
    ['sub', (e: ReturnType<typeof sel>['editor']) => e.commands.toggleMark('sub'), '~word~'],
    [
      'heading',
      (e: ReturnType<typeof sel>['editor']) => e.commands.setHeading({ level: 2 }),
      'h2. word',
    ],
    ['hr', (e: ReturnType<typeof sel>['editor']) => e.commands.setHorizontalRule(), null],
  ])('%s', (_n, run, expected) => {
    const { editor, load } = sel('word');
    run(editor);
    const text = out(editor, load);
    if (expected) expect(text).toBe(expected);
    else expect(text).toContain('----');
  });

  it('nested lists', () => {
    const { editor, load } = makeEditor('');
    editor.commands.focus('end');
    editor.commands.insertContent('a');
    editor.commands.toggleBulletList();
    editor.commands.splitListItem('listItem');
    editor.commands.insertContent('b');
    editor.commands.sinkListItem('listItem');
    editor.commands.toggleOrderedList();
    expect(out(editor, load)).toBe('* a\n*# b');
  });

  it('blockquote', () => {
    const { editor, load } = sel('word');
    editor.commands.toggleBlockquote();
    expect(out(editor, load)).toBe('bq. word');
  });

  it('hard break', () => {
    const { editor, load } = sel('word');
    editor.commands.setTextSelection(2);
    editor.commands.setHardBreak();
    expect(out(editor, load)).toBe('w\nord');
  });

  it('new marks carry canonical open/close', () => {
    const { editor } = sel('word');
    editor.commands.toggleBold();
    const mark = editor.state.doc.firstChild?.firstChild?.marks[0];
    expect(mark?.attrs.open).toBeNull();
    expect(mark?.attrs.close).toBeNull();
  });

  it('Enter in empty list item lifts out', () => {
    const { editor } = sel('a');
    editor.commands.toggleBulletList();
    editor.commands.splitListItem('listItem');
    editor.commands.splitListItem('listItem');
    expect(editor.isActive('bulletList')).toBe(false);
  });
});
