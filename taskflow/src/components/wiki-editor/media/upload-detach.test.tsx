import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { useSettingsStore } from '@/stores/settings.store';
import { installLayoutStubs, liveEditor, renderEditor, textarea } from '../shell-test-utils';
import { startUploads } from './upload-plugin';

installLayoutStubs();

const pdf = () => new File(['x'], 'a.pdf', { type: 'application/pdf' });
const created: JiraAttachment = {
  id: '1',
  filename: 'a.pdf',
  mimeType: 'application/pdf',
  content: 'https://j/a.pdf',
};

function deferredUpload() {
  let resolve: (a: JiraAttachment) => void = () => {};
  const uploadFile = vi.fn(
    () =>
      new Promise<JiraAttachment>((r) => {
        resolve = r;
      }),
  );
  return { uploadFile, resolve: (a: JiraAttachment) => resolve(a) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const failureLine = () => screen.queryByText(/Couldn't upload a\.pdf/);
const embeds = () => {
  const out: string[] = [];
  liveEditor().state.doc.descendants((n) => {
    if (n.type.name === 'attachment' || n.type.name === 'image') out.push(String(n.attrs.name));
  });
  return out;
};

describe('uploads in flight across a mode toggle or value reset (WR-01)', () => {
  it('rich upload resolving after a switch to source is not lost silently', async () => {
    const up = deferredUpload();
    const onChange = vi.fn();
    renderEditor({ value: 'hello', onChange, host: { uploadFile: up.uploadFile } });
    act(() => startUploads(liveEditor(), [pdf()], 3));
    await act(flush);
    expect(up.uploadFile).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: /source/i }));
    expect(textarea()).toBeTruthy();
    await act(async () => {
      up.resolve(created);
      await flush();
    });
    expect(embeds()).toEqual([]);
    expect(failureLine()).not.toBeNull();
  });

  it('an external value reset drops in-flight placeholders instead of misplacing the embed', async () => {
    const up = deferredUpload();
    const onChange = vi.fn();
    const r = renderEditor({ value: 'hello', onChange, host: { uploadFile: up.uploadFile } });
    act(() => startUploads(liveEditor(), [pdf()], 3));
    await act(flush);
    r.rerenderWith({ value: 'other text', onChange, host: { uploadFile: up.uploadFile } });
    await act(async () => {
      up.resolve(created);
      await flush();
    });
    expect(embeds()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    expect(failureLine()).not.toBeNull();
  });

  it('source upload resolving after a switch to rich is not lost silently', async () => {
    useSettingsStore.setState({ wikiEditorMode: 'source' });
    const up = deferredUpload();
    const onChange = vi.fn();
    renderEditor({ value: 'hello', onChange, host: { uploadFile: up.uploadFile } });
    act(() => {
      fireEvent.drop(textarea(), { dataTransfer: { files: [pdf()], types: ['Files'] } });
    });
    expect(up.uploadFile).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: /rich/i }));
    await act(async () => {
      up.resolve(created);
      await flush();
    });
    await waitFor(() => expect(failureLine()).not.toBeNull());
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('[^a.pdf]'));
  });
});
