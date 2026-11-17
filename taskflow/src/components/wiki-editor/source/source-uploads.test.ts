import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { editorExtensions } from '../extensions';
import { getUploadFailures, recordUploadFailure, WikiUpload } from '../media/upload-plugin';
import { makeEditor } from '../test-utils';
import type { WikiEditorHost } from '../types';
import { uploadIntoSource } from './source-uploads';

function setup(host: WikiEditorHost) {
  const made = makeEditor('', [...editorExtensions, WikiUpload]);
  made.editor.storage.wikiHost.set(host, undefined);
  return made.editor;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const att = (filename: string, mimeType: string): JiraAttachment => ({
  id: filename,
  filename,
  mimeType,
  content: `https://j/${filename}`,
});

describe('recordUploadFailure', () => {
  it('adds the name to the failure list without changing the doc', () => {
    const editor = setup({});
    const before = editor.state.doc;
    recordUploadFailure(editor, 'a.png');
    expect(getUploadFailures(editor.state)).toEqual(['a.png']);
    expect(editor.state.doc.eq(before)).toBe(true);
  });
});

describe('uploadIntoSource', () => {
  it('inserts image markup using the uploaded filename', async () => {
    const editor = setup({
      uploadFile: vi.fn().mockResolvedValue(att('a(1).png', 'image/png')),
    });
    const insert = vi.fn();
    expect(
      uploadIntoSource(editor, [new File(['x'], 'a.png', { type: 'image/png' })], insert),
    ).toBe(true);
    await flush();
    expect(insert).toHaveBeenCalledWith('!a(1).png!');
  });

  it('WR-03: an upload named like an existing attachment gets a unique name', async () => {
    const uploadFile = vi.fn(async (f: File) => att(f.name, f.type));
    const editor = setup({ uploadFile, attachments: [att('screenshot.png', 'image/png')] });
    const insert = vi.fn();
    uploadIntoSource(
      editor,
      [
        new File(['x'], 'screenshot.png', { type: 'image/png' }),
        new File(['x'], 'r.pdf', { type: 'application/pdf' }),
        new File(['x'], 'r.pdf', { type: 'application/pdf' }),
      ],
      insert,
    );
    await flush();
    const names = uploadFile.mock.calls.map(([f]) => f.name);
    expect(names).toHaveLength(3);
    expect(new Set([...names, 'screenshot.png']).size).toBe(4);
  });

  it('inserts a file link for non-images', async () => {
    const editor = setup({
      uploadFile: vi.fn().mockResolvedValue(att('report.pdf', 'application/pdf')),
    });
    const insert = vi.fn();
    uploadIntoSource(editor, [new File(['x'], 'report.pdf', { type: 'application/pdf' })], insert);
    await flush();
    expect(insert).toHaveBeenCalledWith('[^report.pdf]');
  });

  it('renames nameless clipboard images before upload', async () => {
    const uploadFile = vi.fn().mockResolvedValue(att('x.png', 'image/png'));
    const editor = setup({ uploadFile });
    uploadIntoSource(editor, [new File(['x'], 'image.png', { type: 'image/png' })], vi.fn());
    await flush();
    expect(uploadFile.mock.calls[0][0].name).toMatch(/^image-.+\.png$/);
    expect(uploadFile.mock.calls[0][0].name).not.toBe('image.png');
  });

  it('stages synchronously in staged hosts', () => {
    const stageFile = vi.fn();
    const editor = setup({ staged: true, stageFile });
    const insert = vi.fn();
    uploadIntoSource(editor, [new File(['x'], 'p|ic.png', { type: 'image/png' })], insert);
    expect(stageFile).toHaveBeenCalledTimes(1);
    expect(stageFile.mock.calls[0][0].name).toBe('pic.png');
    expect(insert).toHaveBeenCalledWith('!pic.png!');
  });

  it('records failures with the original name and does not insert', async () => {
    const editor = setup({ uploadFile: vi.fn().mockRejectedValue(new Error('no')) });
    const insert = vi.fn();
    uploadIntoSource(editor, [new File(['x'], 'bad.pdf', { type: 'application/pdf' })], insert);
    await flush();
    expect(insert).not.toHaveBeenCalled();
    expect(getUploadFailures(editor.state)).toEqual(['bad.pdf']);
  });

  it('returns false when there is no way to upload or stage', () => {
    const editor = setup({});
    const insert = vi.fn();
    expect(
      uploadIntoSource(editor, [new File(['x'], 'a.png', { type: 'image/png' })], insert),
    ).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
