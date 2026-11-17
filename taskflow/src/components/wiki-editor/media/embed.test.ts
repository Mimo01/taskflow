import { describe, expect, it } from 'vitest';
import { attachmentRef } from '@/lib/attachment-markup';
import type { JiraAttachment } from '@/services/jira';
import { makeEditor, saveText } from '../test-utils';
import { embedContentFor, insertEmbed } from './embed';

const att = (filename: string, mimeType: string): JiraAttachment => ({
  id: '1',
  filename,
  mimeType,
  content: 'https://j/content/1',
});

describe('embedContentFor', () => {
  it('image', () =>
    expect(embedContentFor(att('diagram.png', 'image/png'))).toEqual({
      type: 'image',
      attrs: { name: 'diagram.png', params: null, src: null },
    }));
  it('file', () =>
    expect(embedContentFor(att('report.pdf', 'application/pdf')).type).toBe('attachment'));
  it('generic-MIME image by extension', () =>
    expect(embedContentFor(att('scan.png', 'application/octet-stream')).type).toBe('image'));
  it('hazardous image uses content URL', () =>
    expect(embedContentFor(att('a!b.png', 'image/png')).attrs?.name).toBe('https://j/content/1'));
  it('hazardous file is a link', () => {
    const c = embedContentFor(att('a|b.pdf', 'application/pdf'));
    expect(c.text).toBe('ab.pdf');
    expect(c.marks?.[0].attrs?.href).toBe('https://j/content/1');
  });
});

describe('insertEmbed', () => {
  it.each([
    att('diagram.png', 'image/png'),
    att('report.pdf', 'application/pdf'),
    att('a!b.png', 'image/png'),
    att('a|b.pdf', 'application/pdf'),
  ])('saves exactly attachmentRef for $filename', (a) => {
    const { editor, load } = makeEditor('x y');
    editor.commands.setTextSelection(2);
    expect(insertEmbed(editor, a)).toBe(true);
    const saved = saveText(editor, load);
    expect(saved.kind).toBe('saved');
    if (saved.kind === 'saved') expect(saved.text).toContain(attachmentRef(a));
  });
  it('caret ends after node and undo removes it', () => {
    const { editor, load } = makeEditor('x y');
    editor.commands.setTextSelection(2);
    const before = editor.state.doc.content.size;
    insertEmbed(editor, att('d.png', 'image/png'));
    expect(editor.state.selection.from).toBeGreaterThan(2);
    editor.commands.undo();
    expect(editor.state.doc.content.size).toBe(before);
    expect(saveText(editor, load).kind).toBe('unchanged');
  });
});
