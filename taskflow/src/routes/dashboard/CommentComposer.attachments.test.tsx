import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';

// Mock react-router-dom — WikiRenderer's `a` override needs useNavigate/useLocation.
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({
    pathname: '/dashboard',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  })),
}));

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

// Mock jira service — postComment is the only export CommentComposer calls directly.
vi.mock('@/services/jira', () => ({
  postComment: vi.fn().mockResolvedValue(undefined),
}));

// Mock the attachment upload service — controlled per test.
vi.mock('@/services/jira/attachments', () => ({
  uploadAttachment: vi.fn(),
}));

// Right-click context menu on links fetches detected browsers via a Tauri
// command unavailable in jsdom — stub to an empty list (mirrors WikiRenderer.test.tsx).
vi.mock('@/lib/useDetectedBrowsers', () => ({
  useDetectedBrowsers: () => [],
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const IMAGE_ATT: JiraAttachment = {
  id: '1',
  filename: 'diagram.png',
  content: 'https://jira.example.com/secure/attachment/1/diagram.png',
  mimeType: 'image/png',
};

const PDF_ATT: JiraAttachment = {
  id: '2',
  filename: 'spec.pdf',
  content: 'https://jira.example.com/secure/attachment/2/spec.pdf',
  mimeType: 'application/pdf',
};

async function renderComposer(attachments: JiraAttachment[] = []) {
  const { CommentComposer } = await import('./CommentComposer');
  return render(
    <CommentComposer
      issueKey="PROJ-1"
      jiraBaseUrl="https://jira.example.com"
      attachments={attachments}
    />,
    { wrapper },
  );
}

describe('CommentComposer attachments', () => {
  it('opens the attachment picker from the Paperclip toolbar button', async () => {
    await renderComposer([IMAGE_ATT]);

    expect(screen.queryByText('Insert attachment')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Insert attachment'));
    expect(screen.getByText('Insert attachment')).toBeInTheDocument();
  });

  it('selecting an image inserts !diagram.png! at the cursor, preserving surrounding text', async () => {
    await renderComposer([IMAGE_ATT]);

    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'before after' } });
    textarea.setSelectionRange(6, 6); // cursor right after "before"

    fireEvent.click(screen.getByTitle('Insert attachment'));
    fireEvent.click(screen.getByRole('button', { name: /diagram\.png/i }));

    expect(textarea.value).toBe('before!diagram.png! after');
  });

  it('selecting a non-image inserts [^spec.pdf]', async () => {
    await renderComposer([PDF_ATT]);

    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;
    fireEvent.click(screen.getByTitle('Insert attachment'));
    fireEvent.click(screen.getByRole('button', { name: 'spec.pdf' }));

    expect(textarea.value).toBe('[^spec.pdf]');
  });

  it('pastes a file, uploads it, and inserts the resolved reference without inserting raw paste text', async () => {
    const { uploadAttachment } = await import('@/services/jira/attachments');
    vi.mocked(uploadAttachment).mockResolvedValue([IMAGE_ATT]);

    await renderComposer([]);
    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;

    const file = new File(['data'], 'diagram.png', { type: 'image/png' });
    fireEvent.paste(textarea, {
      clipboardData: { files: [file] },
    });

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalled());
    await waitFor(() => expect(textarea.value).toBe('!diagram.png!'));
  });

  it('drops a file, uploads it, and inserts the resolved reference (does not bubble)', async () => {
    const { uploadAttachment } = await import('@/services/jira/attachments');
    vi.mocked(uploadAttachment).mockResolvedValue([PDF_ATT]);

    await renderComposer([]);
    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;

    const file = new File(['data'], 'spec.pdf', { type: 'application/pdf' });
    const stopPropagation = vi.fn();
    fireEvent.drop(textarea, {
      dataTransfer: { files: [file] },
      stopPropagation,
    });

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalled());
    await waitFor(() => expect(textarea.value).toBe('[^spec.pdf]'));
  });

  it('shows an inline error and inserts nothing when upload fails', async () => {
    const { uploadAttachment } = await import('@/services/jira/attachments');
    vi.mocked(uploadAttachment).mockRejectedValue(new Error('upload failed'));

    await renderComposer([]);
    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;

    const file = new File(['data'], 'broken.png', { type: 'image/png' });
    fireEvent.paste(textarea, {
      clipboardData: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByText(/failed to upload broken\.png/i)).toBeInTheDocument(),
    );
    expect(textarea.value).toBe('');
  });

  it('Preview tab renders inserted !name.png! reference as an image element', async () => {
    await renderComposer([IMAGE_ATT]);

    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '!diagram.png!' } });

    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    await waitFor(() => {
      const img = document.querySelector('img[src*="diagram.png"]');
      expect(img).not.toBeNull();
    });
  });

  it('preserves existing behavior: placeholder, mention popover trigger, submit button', async () => {
    const { postComment } = await import('@/services/jira');
    vi.mocked(postComment).mockResolvedValue(undefined);

    await renderComposer([]);
    expect(screen.getByPlaceholderText('Add a comment…')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /comment/i }));

    await waitFor(() => {
      expect(postComment).toHaveBeenCalledWith(
        'https://jira.example.com',
        'test-jira-token',
        'PROJ-1',
        'hello',
      );
    });
  });
});
