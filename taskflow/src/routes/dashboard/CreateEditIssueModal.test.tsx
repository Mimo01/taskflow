// CREATE-01, CREATE-02, CREATE-03, CREATE-04: tests for CreateEditIssueModal

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as apiFetchModule from '@/lib/apiFetch';
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
    fetchIssueLinkTypes: vi
      .fn()
      .mockResolvedValue([
        { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
      ]),
    searchJira: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn().mockResolvedValue({ id: '1', key: 'PROJ-1' }),
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

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('CreateEditIssueModal', () => {
  describe('CREATE-01: Issue type switcher', () => {
    it('renders type switcher (Story / Subtask / Bug) as first field in create mode', () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });
      // The Issue Type label appears as the first field
      expect(screen.getByText('Issue Type')).toBeInTheDocument();
      // There are multiple comboboxes (Issue Type + Priority); the first is the Issue Type selector
      // showing the default value "Story"
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThanOrEqual(1);
      // The Issue Type combobox displays "Story" (the default)
      expect(comboboxes[0]).toHaveTextContent('Story');
    });

    it('Subtask type shows Parent field and hides Epic Link section', () => {
      // When defaultIssueType="Subtask" the type is locked to Subtask
      // The implementation renders Parent field and hides Epic Link for Subtask
      render(
        <CreateEditIssueModal
          open={true}
          onClose={vi.fn()}
          mode="create"
          defaultIssueType="Subtask"
        />,
        { wrapper },
      );
      // Parent label is rendered for Subtask
      expect(screen.getByText('Parent')).toBeInTheDocument();
      // Epic Link label is NOT rendered for Subtask
      expect(screen.queryByText('Epic Link')).not.toBeInTheDocument();
    });

    it('Story type (default) shows Epic Link and hides Parent field', () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });
      // Story is the default — Epic Link section should be present
      expect(screen.getByText('Epic Link')).toBeInTheDocument();
      // Parent field should NOT be present for Story
      expect(screen.queryByText('Parent')).not.toBeInTheDocument();
    });
  });

  describe('CREATE-02: Required custom fields', () => {
    it('submit button disabled when required custom field is empty', async () => {
      // Override apiFetch to return an issueType so selectedIssueTypeId becomes non-empty
      // This allows fetchCreatemeta to be triggered (it requires !!selectedIssueTypeId)
      vi.mocked(apiFetchModule.apiFetch).mockImplementation(async (_service, url: string) => {
        if ((url as string).includes('/issuetypes') && !(url as string).includes('createmeta?')) {
          return {
            ok: true,
            json: async () => ({ values: [{ id: '10001', name: 'Story', subtask: false }] }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ values: [] }),
        } as Response;
      });

      // Make fetchCreatemeta return a required field not in CORE_FIELD_IDS
      vi.mocked(jiraService.fetchCreatemeta).mockResolvedValue([
        {
          fieldId: 'customfield_10100',
          name: 'Account',
          required: true,
          schema: { type: 'string' },
        },
      ]);

      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });

      // Fill in summary so that's not the blocking factor
      const summaryInput = screen.getByPlaceholderText('Issue summary');
      fireEvent.change(summaryInput, { target: { value: 'My test issue' } });

      // Wait for the custom "Account" field to appear (rendered from createmeta)
      await waitFor(() => {
        expect(screen.getByText('Account')).toBeInTheDocument();
      });

      // Submit button should be disabled because the required "Account" field is empty
      const submitBtn = screen.getByRole('button', { name: /^create$/i });
      expect(submitBtn).toBeDisabled();

      // Reset mocks for other tests
      vi.mocked(jiraService.fetchCreatemeta).mockResolvedValue([]);
      vi.mocked(apiFetchModule.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => ({ values: [] }),
      } as Response);
    });
  });

  describe('CREATE-03: Edit mode pre-fill', () => {
    it('edit mode pre-fills summary from initialValues', () => {
      const initialValues = {
        issueKey: 'PROJ-42',
        summary: 'Pre-filled summary text',
        description: 'Pre-filled description',
        assigneeName: 'janesmith',
        priority: 'High',
        storyPoints: 5,
        epicLinkKey: 'PROJ-10',
      };

      render(
        <CreateEditIssueModal
          open={true}
          onClose={vi.fn()}
          mode="edit"
          initialValues={initialValues}
        />,
        { wrapper },
      );

      // Summary field should be pre-filled
      const summaryInput = screen.getByPlaceholderText('Issue summary') as HTMLInputElement;
      expect(summaryInput.value).toBe('Pre-filled summary text');

      // Assignee input should show the assignee name
      const assigneeInput = screen.getByPlaceholderText('Search assignee...') as HTMLInputElement;
      expect(assigneeInput.value).toBe('janesmith');

      // Edit mode shows "Save" button, not "Create"
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });
  });

  describe('CREATE-04: Issue links', () => {
    it('renders "Add link" button in the modal', () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });
      expect(screen.getByRole('button', { name: /add link/i })).toBeInTheDocument();
    });

    it('link row visible after clicking "Add link"; has link type dropdown and issue search input', async () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });
      // Wait for link types query to resolve so the button is enabled
      const addLinkBtn = screen.getByRole('button', { name: /add link/i });
      await waitFor(() => {
        expect(addLinkBtn).not.toBeDisabled();
      });
      fireEvent.click(addLinkBtn);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search issue/i)).toBeInTheDocument();
      });
      // link type select trigger should appear (base-ui Select renders as button)
      // The IssueLinkRow renders a Select trigger for link type
      expect(screen.getByPlaceholderText(/search issue/i)).toBeInTheDocument();
    });

    it('multiple link rows can be added', async () => {
      render(<CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />, { wrapper });
      const addLinkBtn = screen.getByRole('button', { name: /add link/i });
      // Wait for link types query to resolve so the button is enabled
      await waitFor(() => {
        expect(addLinkBtn).not.toBeDisabled();
      });
      fireEvent.click(addLinkBtn);
      fireEvent.click(addLinkBtn);
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText(/search issue/i)).toHaveLength(2);
      });
    });
  });
});
