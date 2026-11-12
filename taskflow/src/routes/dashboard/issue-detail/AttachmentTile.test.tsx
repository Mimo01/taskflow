import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { AttachmentTile, DELETE_CONFIRM_MS } from './AttachmentTile';

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
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: delete report.pdf' }));
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

  describe('delete confirmation', () => {
    const renderTile = (onDelete = vi.fn()) => {
      render(
        <AttachmentTile
          attachment={pdf}
          isImage={false}
          onDownload={vi.fn()}
          onDelete={onDelete}
        />,
      );
      return onDelete;
    };

    it('first click arms a "Delete?" confirm instead of deleting', () => {
      const onDelete = renderTile();
      fireEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByText('Delete?')).toBeTruthy();
    });

    it('Escape disarms without deleting', () => {
      const onDelete = renderTile();
      fireEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
      fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm: delete report.pdf' }), {
        key: 'Escape',
      });
      expect(screen.queryByText('Delete?')).toBeNull();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('clicking elsewhere disarms', () => {
      renderTile();
      fireEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
      fireEvent.pointerDown(document.body);
      expect(screen.queryByText('Delete?')).toBeNull();
    });

    it('reverts on its own after the confirm window', () => {
      vi.useFakeTimers();
      try {
        renderTile();
        fireEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
        act(() => {
          vi.advanceTimersByTime(DELETE_CONFIRM_MS);
        });
        expect(screen.queryByText('Delete?')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('shows the error when the delete fails', async () => {
      renderTile(vi.fn().mockRejectedValue(new Error('Forbidden')));
      fireEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm: delete report.pdf' }));
      expect((await screen.findByRole('alert')).textContent).toBe('Forbidden');
      expect(screen.getByRole('button', { name: 'Delete report.pdf' })).toBeTruthy();
    });
  });

  describe('download feedback', () => {
    it('shows busy, then the confirmation the handler resolves to', async () => {
      let resolve!: (v: string) => void;
      const onDownload = vi.fn(() => new Promise<string>((r) => (resolve = r)));
      render(<AttachmentTile attachment={pdf} isImage={false} onDownload={onDownload} />);
      const button = screen.getByRole('button', { name: 'Download report.pdf' });
      fireEvent.click(button);
      expect(button.getAttribute('aria-busy')).toBe('true');
      await act(async () => resolve('Saved to Downloads'));
      expect(button.getAttribute('aria-busy')).toBe('false');
      expect(screen.getByRole('status').textContent).toBe('Saved to Downloads');
    });

    it('shows the error message when the download fails', async () => {
      const onDownload = vi.fn().mockRejectedValue(new Error("Couldn't download report.pdf"));
      render(<AttachmentTile attachment={pdf} isImage={false} onDownload={onDownload} />);
      fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));
      expect((await screen.findByRole('alert')).textContent).toBe("Couldn't download report.pdf");
    });
  });
});
