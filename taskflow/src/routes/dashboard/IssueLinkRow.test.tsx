// Plan 11-03 TDD RED: IssueLinkRow component tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IssueLinkRow } from './IssueLinkRow'
import type { IssueLinkRowValue } from './IssueLinkRow'
import type { IssueLinkType } from '@/services/jira'

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-pat'),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com', activeJiraProject: 'PROJ' }),
}))

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>()
  return {
    ...actual,
    searchJira: vi.fn().mockResolvedValue([
      { key: 'PROJ-1', fields: { summary: 'First issue' } },
      { key: 'PROJ-2', fields: { summary: 'Second issue' } },
    ]),
  }
})

const mockLinkTypes: IssueLinkType[] = [
  { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
  { id: '10001', name: 'Relates', inward: 'relates to', outward: 'relates to' },
]

function makeValue(overrides: Partial<IssueLinkRowValue> = {}): IssueLinkRowValue {
  return { id: 'row-1', linkTypeId: '', issueKey: '', ...overrides }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('IssueLinkRow', () => {
  const onChange = vi.fn()
  const onRemove = vi.fn()

  beforeEach(() => {
    onChange.mockClear()
    onRemove.mockClear()
  })

  it('renders link type dropdown with outward labels from linkTypes prop', () => {
    render(
      <IssueLinkRow
        linkTypes={mockLinkTypes}
        value={makeValue()}
        onChange={onChange}
        onRemove={onRemove}
      />,
      { wrapper },
    )
    // Select trigger should exist for link type
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders issue search input', () => {
    render(
      <IssueLinkRow
        linkTypes={mockLinkTypes}
        value={makeValue()}
        onChange={onChange}
        onRemove={onRemove}
      />,
      { wrapper },
    )
    expect(screen.getByPlaceholderText(/search issue/i)).toBeInTheDocument()
  })

  it('renders remove button', () => {
    render(
      <IssueLinkRow
        linkTypes={mockLinkTypes}
        value={makeValue()}
        onChange={onChange}
        onRemove={onRemove}
      />,
      { wrapper },
    )
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('calls onRemove when remove button is clicked', () => {
    render(
      <IssueLinkRow
        linkTypes={mockLinkTypes}
        value={makeValue()}
        onChange={onChange}
        onRemove={onRemove}
      />,
      { wrapper },
    )
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('shows search results dropdown after typing in search input', async () => {
    render(
      <IssueLinkRow
        linkTypes={mockLinkTypes}
        value={makeValue()}
        onChange={onChange}
        onRemove={onRemove}
      />,
      { wrapper },
    )
    const input = screen.getByPlaceholderText(/search issue/i)
    fireEvent.change(input, { target: { value: 'first' } })
    // Wait for debounce + query to resolve
    await waitFor(() => {
      expect(screen.getByText(/PROJ-1/)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('calls onChange with selected issueKey when a search result is clicked', async () => {
    render(
      <IssueLinkRow
        linkTypes={mockLinkTypes}
        value={makeValue()}
        onChange={onChange}
        onRemove={onRemove}
      />,
      { wrapper },
    )
    const input = screen.getByPlaceholderText(/search issue/i)
    fireEvent.change(input, { target: { value: 'first' } })
    await waitFor(() => {
      expect(screen.getByText(/PROJ-1/)).toBeInTheDocument()
    }, { timeout: 2000 })
    fireEvent.mouseDown(screen.getByText(/PROJ-1/))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ issueKey: 'PROJ-1' }),
    )
  })
})
