import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { AttachmentFileRow } from './AttachmentFileRow';

const attachment = {
  id: '1',
  filename: 'report.pdf',
  mimeType: 'application/pdf',
  size: 2048,
} as unknown as JiraAttachment;

describe('AttachmentFileRow', () => {
  it('opens preview from the overlay button', () => {
    const onPreview = vi.fn();
    render(
      <AttachmentFileRow attachment={attachment} onDownload={vi.fn()} onPreview={onPreview} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview report.pdf' }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(attachment);
  });

  it('renders no preview button when not previewable', () => {
    render(<AttachmentFileRow attachment={attachment} onDownload={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Preview / })).toBeNull();
  });

  it('download does not trigger preview', () => {
    const onPreview = vi.fn();
    const onDownload = vi.fn();
    render(
      <AttachmentFileRow attachment={attachment} onDownload={onDownload} onPreview={onPreview} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));
    expect(onDownload).toHaveBeenCalledWith(attachment);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('delete does not trigger preview', () => {
    const onPreview = vi.fn();
    const onDelete = vi.fn();
    render(
      <AttachmentFileRow
        attachment={attachment}
        onDownload={vi.fn()}
        onDelete={onDelete}
        onPreview={onPreview}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }));
    expect(onDelete).toHaveBeenCalledWith(attachment);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('omits delete button when onDelete missing', () => {
    render(<AttachmentFileRow attachment={attachment} onDownload={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete report.pdf' })).toBeNull();
  });
});
