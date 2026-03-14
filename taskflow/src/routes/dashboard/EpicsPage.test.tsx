import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    jiraToken: 'tok',
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
  }),
}))
vi.mock('@/services/jira', () => ({
  fetchEpicsWithEnrichment: vi.fn(),
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('EpicsPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('EPIC-01: renders epic name, status badge, story count, story points, and progress bar for each epic', async () => {
    const { fetchEpicsWithEnrichment } = await import('@/services/jira')
    ;(fetchEpicsWithEnrichment as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        key: 'PROJ-10', epicName: 'Epic Alpha', summary: 'Epic Alpha',
        status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
        assignee: null, totalStories: 4, doneStories: 2, totalPoints: 8,
      },
    ])
    const { default: EpicsPage } = await import('./EpicsPage')
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<EpicsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(await screen.findByText('Epic Alpha')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()   // story count
    expect(screen.getByText('8')).toBeInTheDocument()   // total points
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('EPIC-01: shows empty state when no epics returned', async () => {
    const { fetchEpicsWithEnrichment } = await import('@/services/jira')
    ;(fetchEpicsWithEnrichment as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const { default: EpicsPage } = await import('./EpicsPage')
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter>
          <Routes><Route path="/" element={<EpicsPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(await screen.findByText(/no epics/i)).toBeInTheDocument()
  })
})
