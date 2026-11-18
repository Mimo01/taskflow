// Attachment-specific coverage for CreateEditIssueModal, sibling to
// CreateEditIssueModal.test.tsx (CREATE-01..04) per the established
// CommentComposer / CommentComposer.attachments.test.tsx split.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lastStubProps } from '@/test/wiki-editor-stub';
import * as jiraService from '@/services/jira';
import { CreateEditIssueModal } from './CreateEditIssueModal';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}));

vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);

vi.mock('@/stores/auth.store', () => {
  const state = { jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' };
  // Supports both `useAuthStore()` and `useAuthStore(selector)`.
  return {
    useAuthStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
  };
});

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
    searchJiraForLink: vi.fn().mockResolvedValue([]),
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
  deleteAttachment: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function attachViaInput(...files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

async function fillSummary(value = 'My test issue') {
  const summaryInput = screen.getByPlaceholderText('Issue summary');
  fireEvent.change(summaryInput, { target: { value } });
}

describe('CreateEditIssueModal attachments', () => {
  describe('create mode', () => {
    it('uses the staged host: attaching a file stages a chip and never calls uploadAttachment', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');

      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });

      expect(lastStubProps.current?.host?.staged).toBe(true);
      expect(lastStubProps.current?.host?.projectKey).toBe('PROJ');
      expect(lastStubProps.current?.host?.uploadFile).toBeUndefined();
      expect(lastStubProps.current?.preset).toBe('full');
      attachViaInput(new File(['data'], 'shot.png', { type: 'image/png' }));

      await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());
      expect(uploadAttachment).not.toHaveBeenCalled();
    });

    it('renders no Preview tab and no textarea toolbar', () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });
      expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('clone (create mode with initialValues) stages and never uploads live', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');
      render(
        <CreateEditIssueModal
          open={true}
          onClose={vi.fn()}
          mode="create"
          initialValues={{
            issueKey: 'PROJ-1',
            summary: 'Cloned',
            description: '',
            assigneeName: null,
            priority: null,
            storyPoints: null,
            epicLinkKey: null,
            attachments: [],
          }}
        />,
        { wrapper },
      );
      expect(lastStubProps.current?.host?.staged).toBe(true);
      attachViaInput(new File(['d'], 'c.png', { type: 'image/png' }));
      await waitFor(() => expect(screen.getByText('c.png')).toBeInTheDocument());
      expect(uploadAttachment).not.toHaveBeenCalled();
    });

    it('staged chip is rendered and removing it leaves the description text untouched', async () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });

      const file = new File(['data'], 'shot.png', { type: 'image/png' });
      attachViaInput(file);

      await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());
      const textarea = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'keep me' } });

      fireEvent.click(screen.getByLabelText('Remove shot.png'));

      expect(screen.queryByText('shot.png')).not.toBeInTheDocument();
      expect(textarea.value).toBe('keep me');
    });

    it('after createIssue resolves, uploadAttachment is called once per staged file with the new issue key', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');
      vi.mocked(uploadAttachment).mockResolvedValue([
        { id: '9', filename: 'shot.png', content: 'https://x/shot.png', mimeType: 'image/png' },
      ]);
      const onClose = vi.fn();

      render(<CreateEditIssueModal open={true} onClose={onClose} mode="create" />, { wrapper });

      const file = new File(['data'], 'shot.png', { type: 'image/png' });
      attachViaInput(file);
      await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());

      await fillSummary();
      fireEvent.click(screen.getByRole('button', { name: /^create issue$/i }));

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

      const file = new File(['data'], 'shot.png', { type: 'image/png' });
      attachViaInput(file);
      await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());

      await fillSummary();
      fireEvent.click(screen.getByRole('button', { name: /^create issue$/i }));

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

    it('attaching a file uploads immediately to the issue key (live host)', async () => {
      const { uploadAttachment } = await import('@/services/jira/attachments');
      vi.mocked(uploadAttachment).mockResolvedValue([
        {
          id: '5',
          filename: 'note.pdf',
          content: 'https://x/note.pdf',
          mimeType: 'application/pdf',
        },
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

      expect(lastStubProps.current?.host?.staged).toBeFalsy();
      expect(lastStubProps.current?.host?.issueKey).toBe('PROJ-42');
      const file = new File(['data'], 'note.pdf', { type: 'application/pdf' });
      attachViaInput(file);

      await waitFor(() => {
        expect(uploadAttachment).toHaveBeenCalledWith(
          'https://jira.example.com',
          'test-pat',
          'PROJ-42',
          file,
        );
      });
    });
  });
});
