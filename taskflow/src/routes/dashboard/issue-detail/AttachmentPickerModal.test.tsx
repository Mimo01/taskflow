import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { AttachmentPickerModal } from './AttachmentPickerModal';

vi.mock('../AuthImage', () => ({
  AuthImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const IMAGE_ATT: JiraAttachment = {
  id: '1',
  filename: 'diagram.png',
  content: 'https://jira.example.com/secure/attachment/1/diagram.png',
  mimeType: 'image/png',
};

const PDF_ATT: JiraAttachment = {
  id: '2',
  filename: 'report.pdf',
  content: 'https://jira.example.com/secure/attachment/2/report.pdf',
  mimeType: 'application/pdf',
  size: 2048,
};

describe('AttachmentPickerModal', () => {
  it('shows an empty-state message when attachments is empty', () => {
    render(
      <AttachmentPickerModal open attachments={[]} onOpenChange={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/no attachments on this issue/i)).toBeInTheDocument();
  });

  it('renders image attachments in a thumbnail grid and non-images as file rows', () => {
    render(
      <AttachmentPickerModal
        open
        attachments={[IMAGE_ATT, PDF_ATT]}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /diagram\.png/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'report.pdf' })).toBeInTheDocument();
  });

  it('filters both lists by case-insensitive filename substring', () => {
    render(
      <AttachmentPickerModal
        open
        attachments={[IMAGE_ATT, PDF_ATT]}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Filter attachments…'), {
      target: { value: 'REPORT' },
    });
    expect(screen.getByRole('button', { name: 'report.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /diagram\.png/i })).not.toBeInTheDocument();
  });

  it('calls onSelect once and then onOpenChange(false) when an entry is clicked', () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <AttachmentPickerModal
        open
        attachments={[PDF_ATT]}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'report.pdf' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(PDF_ATT);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
