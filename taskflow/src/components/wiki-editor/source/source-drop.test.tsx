import { act, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { useSettingsStore } from '@/stores/settings.store';
import { installLayoutStubs, renderEditor, textarea } from '../shell-test-utils';

installLayoutStubs();

const files = () => [
  new File(['a'], 'a.pdf', { type: 'application/pdf' }),
  new File(['b'], 'b.pdf', { type: 'application/pdf' }),
  new File(['c'], 'c.pdf', { type: 'application/pdf' }),
];

function drop(list: File[]) {
  act(() => {
    fireEvent.drop(textarea(), { dataTransfer: { files: list, types: ['Files'] } });
  });
}

describe('source-mode multi-file drop (CR-02)', () => {
  it('a staged three-file drop keeps every reference', async () => {
    useSettingsStore.setState({ wikiEditorMode: 'source' });
    const stageFile = vi.fn();
    renderEditor({ value: 'x', onChange: vi.fn(), host: { staged: true, stageFile } });
    drop(files());
    expect(stageFile).toHaveBeenCalledTimes(3);
    await waitFor(() => {
      const v = (textarea() as HTMLTextAreaElement).value;
      expect(v).toContain('[^a.pdf]');
      expect(v).toContain('[^b.pdf]');
      expect(v).toContain('[^c.pdf]');
    });
  });

  it('uploads that resolve together keep every reference', async () => {
    useSettingsStore.setState({ wikiEditorMode: 'source' });
    const uploadFile = vi.fn(
      async (f: File): Promise<JiraAttachment> => ({
        id: f.name,
        filename: f.name,
        mimeType: f.type,
        content: `https://j/${f.name}`,
      }),
    );
    renderEditor({ value: 'x', onChange: vi.fn(), host: { uploadFile } });
    drop(files());
    await waitFor(() => {
      const v = (textarea() as HTMLTextAreaElement).value;
      expect(v).toContain('[^a.pdf]');
      expect(v).toContain('[^b.pdf]');
      expect(v).toContain('[^c.pdf]');
    });
  });
});
