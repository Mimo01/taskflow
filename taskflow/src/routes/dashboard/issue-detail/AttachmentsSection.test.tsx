import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { AttachmentsSection } from './AttachmentsSection';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn() }));
vi.mock('@/lib/save-attachment', () => ({
  assertOk: vi.fn(),
  openSavedFile: vi.fn(),
  saveBytes: vi.fn(),
}));
vi.mock('@/services/jira/attachments', () => ({ uploadAttachment: vi.fn() }));
vi.mock('./AttachmentUpload', () => ({ AttachmentUpload: () => null }));
vi.mock('./AttachmentPreviewModal', () => ({ AttachmentPreviewModal: () => null }));
vi.mock('../AuthImage', () => ({
  AuthImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function att(id: string, filename: string, mimeType: string): JiraAttachment {
  return {
    id,
    filename,
    mimeType,
    size: 100,
    content: `https://example.com/${filename}`,
  } as unknown as JiraAttachment;
}

describe('AttachmentsSection', () => {
  it('renders all attachments in one grid in original order', () => {
    const items = [
      att('1', 'a.pdf', 'application/pdf'),
      att('2', 'b.png', 'image/png'),
      att('3', 'c.zip', 'application/zip'),
    ];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AttachmentsSection
          attachments={items}
          issueKey="ABC-1"
          jiraBaseUrl="https://example.com"
        />
      </QueryClientProvider>,
    );
    const tiles = screen.getAllByTestId('attachment-tile');
    expect(tiles).toHaveLength(3);
    expect(new Set(tiles.map((t) => t.parentElement)).size).toBe(1);
    expect(tiles.map((t) => t.textContent)).toEqual([
      expect.stringContaining('a.pdf'),
      expect.stringContaining('b.png'),
      expect.stringContaining('c.zip'),
    ]);
    expect(screen.getByRole('button', { name: 'Preview a.pdf' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview b.png' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview c.zip' })).toBeNull();
  });

  it('labels unsupported and oversized tiles and makes only them non-clickable', () => {
    const big = { ...att('2', 'big.xml', 'application/xml'), size: 3 * 1024 * 1024 };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AttachmentsSection
          attachments={[
            att('1', 'a.xml', 'application/xml'),
            big,
            att('3', 'c.zip', 'application/zip'),
          ]}
          issueKey="ABC-1"
          jiraBaseUrl="https://example.com"
        />
      </QueryClientProvider>,
    );
    const [ok, large, zip] = screen.getAllByTestId('attachment-tile').map((t) => t.textContent);
    expect(ok).not.toMatch(/No preview|Too large/);
    expect(large).toContain('Too large to preview');
    expect(zip).toContain('No preview');
    expect(screen.getByRole('button', { name: 'Preview a.xml' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview big.xml' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Preview c.zip' })).toBeNull();
  });

  function renderSection(items: JiraAttachment[]) {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <AttachmentsSection
          attachments={items}
          issueKey="ABC-1"
          jiraBaseUrl="https://example.com"
        />
      </QueryClientProvider>,
    );
  }

  const fileDrag = { dataTransfer: { types: ['Files'] } };

  it('empty: shows the empty state with a browse link', () => {
    renderSection([]);
    expect(screen.getByText('No attachments')).toBeTruthy();
    expect(screen.getByText(/Drop files here or/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'browse' })).toBeTruthy();
  });

  it('populated: no drop box or empty copy, just the tiles', () => {
    renderSection([att('1', 'a.pdf', 'application/pdf'), att('2', 'b.png', 'image/png')]);
    expect(screen.queryByText('No attachments')).toBeNull();
    expect(screen.queryByText(/Drop files here/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'browse' })).toBeNull();
  });

  it('clicking browse opens the file picker', () => {
    renderSection([]);
    const spy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'browse' }));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('a picked file uploads', async () => {
    vi.mocked(readSecret).mockResolvedValue('tok');
    vi.mocked(uploadAttachment).mockResolvedValue(undefined as never);
    renderSection([]);
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('attachment-file-input'), { target: { files: [file] } });
    await waitFor(() =>
      expect(uploadAttachment).toHaveBeenCalledWith('https://example.com', 'tok', 'ABC-1', file),
    );
  });

  it('a file dropped anywhere on the populated section uploads', async () => {
    vi.mocked(readSecret).mockResolvedValue('tok');
    vi.mocked(uploadAttachment).mockResolvedValue(undefined as never);
    renderSection([att('1', 'a.pdf', 'application/pdf')]);
    const file = new File(['y'], 'y.txt', { type: 'text/plain' });
    fireEvent.drop(screen.getAllByTestId('attachment-tile')[0], {
      dataTransfer: { files: [file], types: ['Files'] },
    });
    await waitFor(() =>
      expect(uploadAttachment).toHaveBeenCalledWith('https://example.com', 'tok', 'ABC-1', file),
    );
  });

  it('file drag-over shows the section overlay; leaving removes it', () => {
    const { container } = renderSection([att('1', 'a.pdf', 'application/pdf')]);
    const section = container.querySelector('section') as HTMLElement;
    expect(screen.queryByTestId('attachment-drop-overlay')).toBeNull();
    fireEvent.dragOver(section, fileDrag);
    expect(screen.getByTestId('attachment-drop-overlay').textContent).toContain(
      'Drop to attach to ABC-1',
    );
    fireEvent.dragLeave(section, { relatedTarget: document.body });
    expect(screen.queryByTestId('attachment-drop-overlay')).toBeNull();
  });

  it('non-file drags (text, links) do not show the overlay', () => {
    const { container } = renderSection([]);
    fireEvent.dragOver(container.querySelector('section') as HTMLElement, {
      dataTransfer: { types: ['text/plain'] },
    });
    expect(screen.queryByTestId('attachment-drop-overlay')).toBeNull();
  });
});
