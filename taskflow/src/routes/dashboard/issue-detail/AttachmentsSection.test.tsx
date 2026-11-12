import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
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
});
