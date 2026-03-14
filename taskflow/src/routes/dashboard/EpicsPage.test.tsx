import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
  }),
}))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
  }),
}))
vi.mock('@/services/jira', () => ({
  fetchEpicsBasic: vi.fn(),
}))
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('EpicsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { readSecret } = await import('@/services/stronghold')
    ;(readSecret as ReturnType<typeof vi.fn>).mockResolvedValue('test-jira-token')
  })

  it('EPIC-01: renders epic name and status badge for each epic', async () => {
    const { fetchEpicsBasic } = await import('@/services/jira')
    ;(fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        key: 'PROJ-10', epicName: 'Epic Alpha', summary: 'Epic Alpha',
        status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
        assignee: null, totalStories: 0, doneStories: 0, totalPoints: 0,
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
    expect(screen.getByText('PROJ-10')).toBeInTheDocument()
  })

  it('EPIC-01: shows empty state when no epics returned', async () => {
    const { fetchEpicsBasic } = await import('@/services/jira')
    ;(fetchEpicsBasic as ReturnType<typeof vi.fn>).mockResolvedValue([])
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
