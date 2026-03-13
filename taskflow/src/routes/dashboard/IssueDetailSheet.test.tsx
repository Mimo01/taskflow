import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}))

// Mock jira service — controlled from each test
vi.mock('@/services/jira', () => ({
  fetchIssueDetail: vi.fn().mockResolvedValue(null),
}))

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    jiraConnected: true,
  })),
}))

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
    storyPointsFieldKey: 'customfield_10016',
  })),
}))

// Mock WikiRenderer — avoids jira2md complexity in unit tests
vi.mock('./WikiRenderer', () => ({
  WikiRenderer: ({ wikiText }: { wikiText: string | null }) => (
    <div data-testid="wiki-renderer">{wikiText}</div>
  ),
}))

// Minimal JiraIssueDetail fixture
function makeIssueDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'PROJ-1',
    key: 'PROJ-1',
    fields: {
      summary: 'Test Issue Summary',
      description: 'Issue description text',
      status: { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      issuetype: { name: 'Story', subtask: false },
      priority: { name: 'High' },
      assignee: { displayName: 'Jane Doe', name: 'jdoe', avatarUrls: { '48x48': '' } },
      reporter: { displayName: 'John Smith', avatarUrls: { '48x48': '' } },
      subtasks: [
        {
          id: 'PROJ-2',
          key: 'PROJ-2',
          fields: { summary: 'Subtask one', status: { name: 'To Do' } },
        },
        {
          id: 'PROJ-3',
          key: 'PROJ-3',
          fields: { summary: 'Subtask two', status: { name: 'Done' } },
        },
      ],
      issuelinks: [
        {
          id: 'link-1',
          type: { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
          outwardIssue: { id: 'PROJ-45', key: 'PROJ-45', fields: { summary: 'Blocking issue', status: { name: 'Open' } } },
        },
        {
          id: 'link-2',
          type: { id: '10001', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
          inwardIssue: { id: 'PROJ-10', key: 'PROJ-10', fields: { summary: 'Blocked by this', status: { name: 'Closed' } } },
        },
      ],
      comment: { comments: [] },
      labels: ['bug', 'frontend'],
      fixVersions: [{ id: 'v1', name: 'v1.0' }],
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-03-01T00:00:00.000Z',
      duedate: null,
      customfield_10016: 5,
      customfield_10014: 'EPIC-1',
      customfield_10015: 'My Epic',
      customfield_10020: [{ id: 1, name: 'Sprint 5', state: 'active' }],
      ...overrides,
    },
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('IssueDetailSheet', () => {
  describe('ISSUE-01: open/close', () => {
    it('renders sheet open when issueKey is a non-null string', async () => {
      const { fetchIssueDetail } = await import('@/services/jira')
      vi.mocked(fetchIssueDetail).mockResolvedValue(makeIssueDetail() as never)

      const { IssueDetailSheet } = await import('./IssueDetailSheet')
      render(
        <IssueDetailSheet issueKey="PROJ-1" onClose={vi.fn()} />,
        { wrapper }
      )

      // Sheet should be open — find the sheet-content by data-slot
      const sheetContent = await screen.findByTestId('sheet-open')
      expect(sheetContent).toBeTruthy()
    })

    it('renders sheet closed when issueKey is null', () => {
      const IssueDetailSheetModule = vi.importActual('./IssueDetailSheet')
      // When issueKey is null, the Sheet's open prop is false
      // We verify by checking that body content is not rendered
      const { IssueDetailSheet } = require('./IssueDetailSheet')
      render(
        <IssueDetailSheet issueKey={null} onClose={vi.fn()} />,
        { wrapper }
      )
      // No sheet content visible when closed
      expect(screen.queryByTestId('issue-detail-body')).toBeNull()
    })

    it('calls onClose when Sheet onOpenChange fires with false', async () => {
      const { fetchIssueDetail } = await import('@/services/jira')
      vi.mocked(fetchIssueDetail).mockResolvedValue(makeIssueDetail() as never)

      const { IssueDetailSheet } = await import('./IssueDetailSheet')
      const onClose = vi.fn()
      render(
        <IssueDetailSheet issueKey="PROJ-1" onClose={onClose} />,
        { wrapper }
      )

      // Find and click the close button (SheetContent renders one by default)
      const closeBtn = await screen.findByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)
      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })
  })

  describe('ISSUE-04: optimistic field update', () => {
    it.todo('applies optimistic update to assignee field immediately')
    it.todo('rolls back assignee to previous value when mutation errors')
    it.todo('applies optimistic update to priority field immediately')
    it.todo('applies optimistic update to story points field immediately')
    it.todo('applies optimistic update to labels field immediately')
  })

  describe('ISSUE-05: subtask list', () => {
    it('renders each subtask with key, summary, and status badge', async () => {
      const { fetchIssueDetail } = await import('@/services/jira')
      vi.mocked(fetchIssueDetail).mockResolvedValue(makeIssueDetail() as never)

      const { IssueDetailContent } = await import('./IssueDetailContent')
      const issue = makeIssueDetail()
      render(
        <IssueDetailContent
          issue={issue as never}
          issueKey="PROJ-1"
          jiraBaseUrl="https://jira.example.com"
          onOpenIssue={vi.fn()}
          storyPointsFieldKey="customfield_10016"
          sprintFieldKey="customfield_10020"
          epicLinkFieldKey="customfield_10014"
        />,
        { wrapper }
      )

      expect(screen.getByText('PROJ-2')).toBeTruthy()
      expect(screen.getByText('Subtask one')).toBeTruthy()
      expect(screen.getByText('To Do')).toBeTruthy()
      expect(screen.getByText('PROJ-3')).toBeTruthy()
      expect(screen.getByText('Subtask two')).toBeTruthy()
      expect(screen.getByText('Done')).toBeTruthy()
    })

    it('clicking a subtask calls onOpenIssue with the subtask key', async () => {
      const { IssueDetailContent } = await import('./IssueDetailContent')
      const onOpenIssue = vi.fn()
      const issue = makeIssueDetail()
      render(
        <IssueDetailContent
          issue={issue as never}
          issueKey="PROJ-1"
          jiraBaseUrl="https://jira.example.com"
          onOpenIssue={onOpenIssue}
          storyPointsFieldKey="customfield_10016"
          sprintFieldKey="customfield_10020"
          epicLinkFieldKey="customfield_10014"
        />,
        { wrapper }
      )

      fireEvent.click(screen.getByText('Subtask one').closest('button')!)
      expect(onOpenIssue).toHaveBeenCalledWith('PROJ-2')
    })
  })

  describe('ISSUE-06: linked issues', () => {
    it('renders inward linked issues with type.inward label', async () => {
      const { IssueDetailSidebar } = await import('./IssueDetailSidebar')
      const issue = makeIssueDetail()
      render(
        <IssueDetailSidebar
          issue={issue as never}
          storyPointsFieldKey="customfield_10016"
          epicLinkFieldKey="customfield_10014"
          epicNameFieldKey="customfield_10015"
          sprintFieldKey="customfield_10020"
        />,
        { wrapper }
      )

      // inward link: type.inward = 'is blocked by' + PROJ-10
      expect(screen.getByText('is blocked by:')).toBeTruthy()
      expect(screen.getByText('PROJ-10')).toBeTruthy()
    })

    it('renders outward linked issues with type.outward label', async () => {
      const { IssueDetailSidebar } = await import('./IssueDetailSidebar')
      const issue = makeIssueDetail()
      render(
        <IssueDetailSidebar
          issue={issue as never}
          storyPointsFieldKey="customfield_10016"
          epicLinkFieldKey="customfield_10014"
          epicNameFieldKey="customfield_10015"
          sprintFieldKey="customfield_10020"
        />,
        { wrapper }
      )

      // outward link: type.outward = 'blocks' + PROJ-45
      expect(screen.getByText('blocks:')).toBeTruthy()
      expect(screen.getByText('PROJ-45')).toBeTruthy()
    })
  })

  describe('ISSUE-07: comment thread', () => {
    it.todo('renders comments ordered newest-first')
    it.todo('each comment shows author displayName and relative timestamp')
    it.todo('renders comment body through WikiRenderer (wiki markup converted)')
  })

  describe('ISSUE-08: post comment', () => {
    it.todo('calls postComment with issueKey and compose box text on submit')
    it.todo('clears compose box after successful submission')
  })

  describe('ISSUE-09: open in Jira deep link', () => {
    it.todo('calls openUrl with ${jiraBaseUrl}/browse/${issueKey} when button clicked')
  })
})
