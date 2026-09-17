// Attachment-specific coverage for CreateEditIssueModal, sibling to
// CreateEditIssueModal.test.tsx (CREATE-01..04) per the established
// CommentComposer / CommentComposer.attachments.test.tsx split.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as jiraService from '@/services/jira';
import { CreateEditIssueModal } from './CreateEditIssueModal';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' }),
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    epicLinkFieldKey: null,
    storyPointsFieldKey: null,
    accountFieldKey: null,
  }),
}));

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>();
  return {
    ...actual,
    fetchCreatemeta: vi.fn().mockResolvedValue([]),
    fetchIssueLinkTypes: vi.fn().mockResolvedValue([]),
    searchJira: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn().mockResolvedValue({ id: '1', key: 'PROJ-9' }),
    bulkUpdateIssue: vi.fn().mockResolvedValue(undefined),
    createIssueLink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ values: [] }),
  }),
}));

vi.mock('@/services/jira/attachments', () => ({
  uploadAttachment: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function fillSummary(value = 'My test issue') {
  const summaryInput = screen.getByPlaceholderText('Issue summary');
  fireEvent.change(summaryInput, { target: { value } });
}

describe('CreateEditIssueModal attachments', () => {
  describe('create mode', () => {
    it('dropping a file inserts its staged ref into the description and does not call uploadAttachment', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');

      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });

      const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
      const file = new File(['data'], 'shot.png', { type: 'image/png' });
      fireEvent.drop(textarea, { dataTransfer: { files: [file] } });

      await waitFor(() => expect(textarea.value).toBe('!shot.png!'));
      expect(uploadAttachment).not.toHaveBeenCalled();
    });

    it('staged chip is rendered and removing it leaves the description text untouched', async () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });

      const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
      const file = new File(['data'], 'shot.png', { type: 'image/png' });
      fireEvent.drop(textarea, { dataTransfer: { files: [file] } });

      await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());
      const descriptionAfterStage = textarea.value;

      fireEvent.click(screen.getByLabelText('Remove shot.png'));

      expect(screen.queryByText('shot.png')).not.toBeInTheDocument();
      expect(textarea.value).toBe(descriptionAfterStage);
    });

    it('after createIssue resolves, uploadAttachment is called once per staged file with the new issue key', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');
      vi.mocked(uploadAttachment).mockResolvedValue([
        { id: '9', filename: 'shot.png', content: 'https://x/shot.png', mimeType: 'image/png' },
      ]);
      const onClose = vi.fn();

      render(<CreateEditIssueModal open={true} onClose={onClose} mode="create" />, { wrapper });

      const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
      const file = new File(['data'], 'shot.png', { type: 'image/png' });
      fireEvent.drop(textarea, { dataTransfer: { files: [file] } });
      await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());

      await fillSummary();
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(uploadAttachment).toHaveBeenCalledWith(
          'https://jira.example.com',
          'test-pat',
          'PROJ-9',
          file,
        );
      });
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('a rejecting uploadAttachment still closes/succeeds and surfaces an upload-failure message naming the file', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');
      vi.mocked(uploadAttachment).mockRejectedValue(new Error('upload failed'));
      const onClose = vi.fn();

      render(<CreateEditIssueModal open={true} onClose={onClose} mode="create" />, { wrapper });

      const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
      const file = new File(['data'], 'shot.png', { type: 'image/png' });
      fireEvent.drop(textarea, { dataTransfer: { files: [file] } });
      await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());

      await fillSummary();
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(uploadAttachment).toHaveBeenCalled());
      await waitFor(() => {
        expect(screen.getByText(/failed to upload: shot\.png/i)).toBeInTheDocument();
      });
      // Issue creation itself is not rolled back — createIssue already resolved.
      expect(jiraService.createIssue).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const editInitialValues = {
      issueKey: 'PROJ-42',
      summary: 'Existing summary',
      description: '',
      assigneeName: null,
      priority: null,
      storyPoints: null,
      epicLinkKey: null,
      attachments: [],
    };

    it('pasting a file calls uploadAttachment immediately with the issue key and inserts the returned ref', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');
      vi.mocked(uploadAttachment).mockResolvedValue([
        { id: '5', filename: 'note.pdf', content: 'https://x/note.pdf', mimeType: 'application/pdf' },
      ]);

      render(
        <CreateEditIssueModal
          open={true}
          onClose={vi.fn()}
          mode="edit"
          initialValues={editInitialValues}
        />,
        { wrapper },
      );

      const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
      const file = new File(['data'], 'note.pdf', { type: 'application/pdf' });
      fireEvent.paste(textarea, { clipboardData: { files: [file] } });

      await waitFor(() => {
        expect(uploadAttachment).toHaveBeenCalledWith(
          'https://jira.example.com',
          'test-pat',
          'PROJ-42',
          file,
        );
      });
      await waitFor(() => expect(textarea.value).toBe('[^note.pdf]'));
    });

    it('an uploadAttachment rejection shows an inline error and inserts nothing', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');
      vi.mocked(uploadAttachment).mockRejectedValue(new Error('upload failed'));

      render(
        <CreateEditIssueModal
          open={true}
          onClose={vi.fn()}
          mode="edit"
          initialValues={editInitialValues}
        />,
        { wrapper },
      );

      const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
      const file = new File(['data'], 'broken.pdf', { type: 'application/pdf' });
      fireEvent.paste(textarea, { clipboardData: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/failed to upload broken\.pdf/i)).toBeInTheDocument();
      });
      expect(textarea.value).toBe('');
    });
  });
});
