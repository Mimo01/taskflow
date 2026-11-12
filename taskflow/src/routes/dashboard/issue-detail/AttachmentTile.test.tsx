import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { AttachmentTile } from './AttachmentTile';

vi.mock('../AuthImage', () => ({
  AuthImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const pdf = {
  id: '1',
  filename: 'report.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  content: 'https://example.com/report.pdf',
} as unknown as JiraAttachment;

const png = {
  id: '2',
  filename: 'diagram.png',
  mimeType: 'image/png',
  size: 1024,
  content: 'https://example.com/diagram.png',
} as unknown as JiraAttachment;

describe('AttachmentTile', () => {
  it('opens preview from the overlay button', () => {
    const onPreview = vi.fn();
    render(
      <AttachmentTile
        attachment={pdf}
        isImage={false}
        onDownload={vi.fn()}
        onPreview={onPreview}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview report.pdf' }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(pdf);
  });

  it('has no preview button without onPreview', () => {
    render(<AttachmentTile attachment={pdf} isImage={false} onDownload={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Preview / })).toBeNull();
  });

  it('download does not trigger preview', () => {
    const onPreview = vi.fn();
    const onDownload = vi.fn();
    render(
      <AttachmentTile
        attachment={pdf}
        isImage={false}
        onDownload={onDownload}
        onPreview={onPreview}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));
    expect(onDownload).toHaveBeenCalledWith(pdf);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('delete does not trigger preview and is absent without onDelete', () => {
    const onPreview = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(
      <AttachmentTile
        attachment={pdf}
        isImage={false}
        onDownload={vi.fn()}
        onDelete={onDelete}
        onPreview={onPreview}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
    expect(onDelete).toHaveBeenCalledWith(pdf);
    expect(onPreview).not.toHaveBeenCalled();

    rerender(<AttachmentTile attachment={pdf} isImage={false} onDownload={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete report.pdf' })).toBeNull();
  });

  it('shows uppercase extension and formatted size for files', () => {
    render(<AttachmentTile attachment={pdf} isImage={false} onDownload={vi.fn()} />);
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('2.0 KB')).toBeTruthy();
  });

  it('falls back to mimeType when size is missing', () => {
    const noSize = { ...pdf, size: undefined } as unknown as JiraAttachment;
    render(<AttachmentTile attachment={noSize} isImage={false} onDownload={vi.fn()} />);
    expect(screen.getByText('application/pdf')).toBeTruthy();
  });

  it('renders an image with the filename as alt for image tiles', () => {
    render(<AttachmentTile attachment={png} isImage onDownload={vi.fn()} />);
    expect(screen.getByAltText('diagram.png')).toBeTruthy();
  });

  it('puts the full filename in the caption title', () => {
    render(<AttachmentTile attachment={pdf} isImage={false} onDownload={vi.fn()} />);
    expect(screen.getByTitle('report.pdf')).toBeTruthy();
  });

  it('explains why a tile has no preview on the meta line', () => {
    const zip = { ...pdf, filename: 'build.zip', mimeType: 'application/zip' } as JiraAttachment;
    render(
      <AttachmentTile
        attachment={zip}
        isImage={false}
        onDownload={vi.fn()}
        previewUnavailable="unsupported"
      />,
    );
    const status = screen.getByText('No preview');
    expect(status.closest('.bg-muted')).toBeTruthy();
    expect(screen.getByText('2.0 KB').textContent).toBe('2.0 KB');
  });

  it('has no unavailable label on previewable tiles', () => {
    render(
      <AttachmentTile attachment={pdf} isImage={false} onDownload={vi.fn()} onPreview={vi.fn()} />,
    );
    expect(screen.queryByText(/No preview|Too large/)).toBeNull();
  });
});
