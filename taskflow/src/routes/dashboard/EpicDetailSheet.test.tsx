import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    jiraToken: 'tok',
    storyPointsFieldKey: 'customfield_10016',
    epicNameFieldKey: 'customfield_10015',
  }),
}))
vi.mock('@/services/jira', () => ({
  fetchEpicStories: vi.fn(),
  fetchIssueDetail: vi.fn(),
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const mockStory = {
  id: '1', key: 'PROJ-5',
  fields: {
    summary: 'Story One', issuetype: { name: 'Story', iconUrl: '' },
    status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
    assignee: { name: 'alice', displayName: 'Alice', avatarUrls: {} },
    priority: null, customfield_10016: 3,
  },
}

describe('EpicDetailSheet', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('EPIC-03: renders stories list with key, summary, status, and story points when open', async () => {
    const { fetchEpicStories } = await import('@/services/jira')
    ;(fetchEpicStories as ReturnType<typeof vi.fn>).mockResolvedValue([mockStory])
    const { EpicDetailSheet } = await import('./EpicDetailSheet')
    const onClose = vi.fn()
    const onOpenIssue = vi.fn()
    render(
      <QueryClientProvider client={makeClient()}>
        <EpicDetailSheet epicKey="PROJ-42" onClose={onClose} onOpenIssue={onOpenIssue} />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Story One')).toBeInTheDocument()
    expect(screen.getByText('PROJ-5')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('EPIC-03: renders nothing when epicKey is null (closed state)', async () => {
    const { EpicDetailSheet } = await import('./EpicDetailSheet')
    const { container } = render(
      <QueryClientProvider client={makeClient()}>
        <EpicDetailSheet epicKey={null} onClose={vi.fn()} onOpenIssue={vi.fn()} />
      </QueryClientProvider>
    )
    expect(container.firstChild).toBeNull()
  })
})
