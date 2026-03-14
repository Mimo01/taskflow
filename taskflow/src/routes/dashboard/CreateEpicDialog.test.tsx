import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    jiraToken: 'tok',
    epicNameFieldKey: 'customfield_10015',
  }),
}))
vi.mock('@/services/jira', () => ({
  createIssue: vi.fn(),
}))

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('CreateEpicDialog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('EPIC-04: submits createIssue with issuetype Epic, summary, and epicNameFieldKey', async () => {
    const { createIssue } = await import('@/services/jira')
    ;(createIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '99', key: 'PROJ-99' })
    const { CreateEpicDialog } = await import('./CreateEpicDialog')
    const onClose = vi.fn()
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={onClose} />
      </QueryClientProvider>
    )
    fireEvent.change(screen.getByRole('textbox', { name: /epic name/i }), { target: { value: 'My New Epic' } })
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }))
    await waitFor(() => expect(createIssue).toHaveBeenCalledWith(
      'https://jira.example.com', 'tok', 'PROJ', 'My New Epic',
      expect.objectContaining({ issuetype: 'Epic', customfield_10015: 'My New Epic' })
    ))
  })

  it('EPIC-04: does not submit when epic name is empty', async () => {
    const { createIssue } = await import('@/services/jira')
    const { CreateEpicDialog } = await import('./CreateEpicDialog')
    render(
      <QueryClientProvider client={makeClient()}>
        <CreateEpicDialog open={true} onClose={vi.fn()} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /create epic/i }))
    await waitFor(() => expect(createIssue).not.toHaveBeenCalled())
  })
})
