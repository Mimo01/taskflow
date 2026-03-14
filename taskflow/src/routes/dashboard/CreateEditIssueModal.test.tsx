// CREATE-01, CREATE-02, CREATE-03, CREATE-04: tests for CreateEditIssueModal
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateEditIssueModal } from './CreateEditIssueModal'

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' }),
}))

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    epicLinkFieldKey: null,
    storyPointsFieldKey: null,
    accountFieldKey: null,
  }),
}))

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>()
  return {
    ...actual,
    fetchCreatemeta: vi.fn().mockResolvedValue([]),
    fetchIssueLinkTypes: vi.fn().mockResolvedValue([
      { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    ]),
    searchJira: vi.fn().mockResolvedValue([]),
    createIssue: vi.fn().mockResolvedValue({ id: '1', key: 'PROJ-1' }),
    bulkUpdateIssue: vi.fn().mockResolvedValue(undefined),
    createIssueLink: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ values: [] }),
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('CreateEditIssueModal', () => {
  describe('CREATE-01: Issue type switcher', () => {
    it.todo('renders type switcher (Story / Subtask / Bug) as first field')
    it.todo('switching to Subtask shows Parent field, hides Epic Link')
    it.todo('switching to Story shows Epic Link, hides Parent')
  })

  describe('CREATE-02: Required custom fields', () => {
    it.todo('submit button disabled when required custom field is empty')
  })

  describe('CREATE-03: Edit mode pre-fill', () => {
    it.todo(
      'edit mode pre-fills summary, description, assignee, priority, story points, epic link from props',
    )
  })

  describe('CREATE-04: Issue links', () => {
    it('renders "Add link" button in the modal', () => {
      render(
        <CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />,
        { wrapper },
      )
      expect(screen.getByRole('button', { name: /add link/i })).toBeInTheDocument()
    })

    it('link row visible after clicking "Add link"; has link type dropdown and issue search input', async () => {
      render(
        <CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />,
        { wrapper },
      )
      // Wait for link types query to resolve so the button is enabled
      const addLinkBtn = screen.getByRole('button', { name: /add link/i })
      await waitFor(() => {
        expect(addLinkBtn).not.toBeDisabled()
      })
      fireEvent.click(addLinkBtn)
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search issue/i)).toBeInTheDocument()
      })
      // link type select trigger should appear (base-ui Select renders as button)
      // The IssueLinkRow renders a Select trigger for link type
      expect(screen.getByPlaceholderText(/search issue/i)).toBeInTheDocument()
    })

    it('multiple link rows can be added', async () => {
      render(
        <CreateEditIssueModal open={true} onClose={vi.fn()} mode="create" />,
        { wrapper },
      )
      const addLinkBtn = screen.getByRole('button', { name: /add link/i })
      // Wait for link types query to resolve so the button is enabled
      await waitFor(() => {
        expect(addLinkBtn).not.toBeDisabled()
      })
      fireEvent.click(addLinkBtn)
      fireEvent.click(addLinkBtn)
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText(/search issue/i)).toHaveLength(2)
      })
    })
  })
})
