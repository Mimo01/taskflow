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

  it('empty: shows a single drop strip with the empty copy', () => {
    renderSection([]);
    const strip = screen.getByRole('button', { name: /No attachments/ });
    expect(strip.textContent).toContain('Drop files here or browse');
    expect(screen.getAllByText('No attachments')).toHaveLength(1);
  });

  it('populated: strip sits outside the grid without the empty copy', () => {
    renderSection([att('1', 'a.pdf', 'application/pdf'), att('2', 'b.png', 'image/png')]);
    const strip = screen.getByRole('button', { name: /Drop files here or browse/ });
    expect(strip.textContent).not.toContain('No attachments');
    const grid = screen.getAllByTestId('attachment-tile')[0].parentElement;
    expect(grid?.contains(strip)).toBe(false);
  });

  it('clicking the strip opens the file picker', () => {
    renderSection([]);
    const spy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: /Drop files here or browse/ }));
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

  it('a dropped file uploads', async () => {
    vi.mocked(readSecret).mockResolvedValue('tok');
    vi.mocked(uploadAttachment).mockResolvedValue(undefined as never);
    const { container } = renderSection([]);
    const file = new File(['y'], 'y.txt', { type: 'text/plain' });
    const section = container.querySelector('section') as HTMLElement;
    fireEvent.drop(section, { dataTransfer: { files: [file] } });
    await waitFor(() =>
      expect(uploadAttachment).toHaveBeenCalledWith('https://example.com', 'tok', 'ABC-1', file),
    );
  });

  it('drag-over highlights the strip itself, no separate overlay', () => {
    const { container } = renderSection([]);
    fireEvent.dragOver(container.querySelector('section') as HTMLElement);
    expect(screen.getByRole('button', { name: /Drop file to attach/ })).toBeTruthy();
    expect(screen.queryByText('Drop file here to attach')).toBeNull();
  });
});
