import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { richExtensions } from '../rich-extensions';
import { installLayoutStubs, liveEditor, renderEditor } from '../shell-test-utils';
import type { WikiEditorHost } from '../types';
import { startUploads } from './upload-plugin';

installLayoutStubs();

const png = (name: string) => new File(['x'], name, { type: 'image/png' });
const created = (name: string) => ({
  id: `ID-${name}`,
  filename: name,
  mimeType: 'image/png',
  content: 'https://j/c',
});

afterEach(() => vi.useRealTimers());

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function upload(host: WikiEditorHost, ...names: string[]) {
  renderEditor({ value: '', onChange: vi.fn(), host });
  await act(async () => {
    startUploads(liveEditor(), names.map(png), 1);
  });
  await settle();
}

function removeFirstEmbed() {
  const editor = liveEditor();
  let range: [number, number] | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (!range && (node.type.name === 'image' || node.type.name === 'attachment')) {
      range = [pos, pos + node.nodeSize];
    }
  });
  if (!range) throw new Error('no embed');
  const r: [number, number] = range;
  act(() => {
    editor.view.dispatch(editor.state.tr.delete(r[0], r[1]));
  });
}

describe('EditorMessages', () => {
  it('registers upload and removal plugins in the rich extensions', () => {
    const names = richExtensions.map((e) => e.name);
    expect(names).toContain('wikiUpload');
    expect(names).toContain('wikiEmbedRemoval');
  });

  it('shows a failed upload under the content and dismisses it', async () => {
    await upload({ uploadFile: () => Promise.reject(new Error('no')) }, 'a.png');
    const text = screen.getByText("Couldn't upload a.png. Check your connection and try again.");
    expect(text.closest('div')?.className).toContain('text-destructive');
    const content = document.querySelector('.ProseMirror') as HTMLElement;
    expect(content.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Couldn't upload/)).toBeNull();
  });

  it('summarises more than three failures', async () => {
    await upload(
      { uploadFile: () => Promise.reject(new Error('no')) },
      '1.png',
      '2.png',
      '3.png',
      '4.png',
      '5.png',
    );
    expect(screen.getAllByText(/Couldn't upload/)).toHaveLength(3);
    expect(screen.getByText('and 2 more files failed to upload.')).toBeTruthy();
  });

  it('keeps a failure visible when a success lands in the same batch', async () => {
    await upload(
      {
        uploadFile: (f) =>
          f.name === 'bad.png' ? Promise.reject(new Error('no')) : Promise.resolve(created(f.name)),
      },
      'bad.png',
      'ok.png',
    );
    expect(screen.getByText(/Couldn't upload bad.png/)).toBeTruthy();
  });

  it('offers deletion after a session embed is removed and auto-dismisses after 6s', async () => {
    await upload({ uploadFile: (f) => Promise.resolve(created(f.name)) }, 'a.png');
    vi.useFakeTimers();
    removeFirstEmbed();
    expect(screen.getByText('Also delete attachment?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText('Also delete attachment?')).toBeNull();
  });

  it('Delete calls host.deleteAttachment once and hides the row', async () => {
    const deleteAttachment = vi.fn().mockResolvedValue(undefined);
    await upload(
      { uploadFile: (f) => Promise.resolve(created(f.name)), deleteAttachment },
      'a.png',
    );
    removeFirstEmbed();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await settle();
    expect(deleteAttachment).toHaveBeenCalledTimes(1);
    expect(deleteAttachment).toHaveBeenCalledWith('ID-a.png');
    expect(screen.queryByText('Also delete attachment?')).toBeNull();
  });

  it('shows an error when deletion fails', async () => {
    const deleteAttachment = vi.fn().mockRejectedValue(new Error('403'));
    await upload(
      { uploadFile: (f) => Promise.resolve(created(f.name)), deleteAttachment },
      'a.png',
    );
    removeFirstEmbed();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(screen.getByText("Couldn't delete a.png. Remove it from Attachments.")).toBeTruthy(),
    );
  });
});
