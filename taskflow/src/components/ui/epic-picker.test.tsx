import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EpicPicker, type EpicPickerProps } from './epic-picker';

vi.mock('@/stores/auth.store', () => {
  const state = { jiraBaseUrl: 'https://jira.example.com' };
  const useAuthStore = vi.fn((selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state,
  );
  return { useAuthStore };
});

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@/services/jira/epics', () => ({
  searchOpenEpics: vi.fn(),
  fetchEpicSummary: vi.fn(),
}));

import { fetchEpicSummary, searchOpenEpics } from '@/services/jira/epics';

const mockSearch = vi.mocked(searchOpenEpics);
const mockSummary = vi.mocked(fetchEpicSummary);

const EPICS = [
  { key: 'PROJ-9', name: 'Payments', summary: 'Payments rev', color: 'ghx-label-4' },
  { key: 'PROJ-7', name: 'Onboarding', summary: 'Onboarding v2', color: null },
];

function renderPicker(props: Partial<EpicPickerProps> = {}) {
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <EpicPicker
      variant="inline"
      triggerTestId="trigger"
      projectKey="PROJ"
      value={null}
      onChange={onChange}
      {...props}
    />,
    { wrapper },
  );
  return { onChange };
}

async function open() {
  fireEvent.click(screen.getByTestId('trigger'));
  return screen.findByPlaceholderText('Search epics…');
}

beforeEach(() => {
  mockSearch.mockReset();
  mockSummary.mockReset();
  mockSearch.mockResolvedValue(EPICS);
  mockSummary.mockResolvedValue(null);
});

describe('EpicPicker', () => {
  it('debounces typing and searches server-side with the typed term', async () => {
    renderPicker();
    const input = await open();
    await screen.findByText('Payments');
    mockSearch.mockClear();
    fireEvent.change(input, { target: { value: 'p' } });
    fireEvent.change(input, { target: { value: 'pay' } });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(1));
    expect(mockSearch.mock.calls[0][3]).toBe('pay');
  });

  it('renders pill name, muted key, No epic first, and a check on the selected row', async () => {
    renderPicker({ value: 'PROJ-9' });
    await open();
    await screen.findByText('Onboarding');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('No epic');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveTextContent('PROJ-9');
    expect(options[1].querySelector('[data-testid="epic-check"]')).not.toBeNull();
    expect(options[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('checks No epic when value is null', async () => {
    renderPicker({ value: null });
    await open();
    await screen.findByText('Payments');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking an epic row calls onChange with it and closes', async () => {
    const { onChange } = renderPicker();
    await open();
    fireEvent.click(await screen.findByText('Payments'));
    expect(onChange).toHaveBeenCalledWith(EPICS[0]);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search epics…')).not.toBeInTheDocument(),
    );
  });

  it('clicking No epic calls onChange(null)', async () => {
    const { onChange } = renderPicker({ value: 'PROJ-9' });
    await open();
    await screen.findByText('Onboarding');
    fireEvent.click(screen.getByRole('option', { name: 'No epic' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('keyboard: index 0 is No epic, ArrowDown x2 + Enter selects the first epic', async () => {
    const { onChange } = renderPicker();
    const input = await open();
    await screen.findByText('Payments');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(EPICS[0]);
  });

  it('keyboard: typing a search then Enter with nothing highlighted picks the top hit', async () => {
    const { onChange } = renderPicker();
    const input = await open();
    await screen.findByText('Payments');
    mockSearch.mockResolvedValue([EPICS[1]]);
    fireEvent.change(input, { target: { value: 'onb' } });
    await waitFor(() => expect(screen.queryByText('Payments')).not.toBeInTheDocument());
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(EPICS[1]);
  });

  it('keyboard: arrow highlight is exposed via aria-activedescendant', async () => {
    renderPicker();
    const input = await open();
    await screen.findByText('Payments');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const id = input.getAttribute('aria-activedescendant');
    expect(id).toBe(screen.getAllByRole('option')[0].id);
  });

  it('Escape closes without calling onChange', async () => {
    const { onChange } = renderPicker();
    const input = await open();
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search epics…')).not.toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows loading then empty states', async () => {
    mockSearch.mockResolvedValue([]);
    renderPicker();
    await open();
    expect(screen.getByText('Searching…')).toBeInTheDocument();
    expect(await screen.findByText('No open epics match')).toBeInTheDocument();
  });

  it('trigger renders the resolved name for an epic missing from the results', async () => {
    mockSearch.mockResolvedValue([]);
    mockSummary.mockResolvedValue({
      fields: { summary: 'Old summary', customfield_10015: 'Retired epic' },
    });
    renderPicker({ value: 'PROJ-1' });
    expect(await screen.findByText('Retired epic')).toBeInTheDocument();
    expect(mockSummary).toHaveBeenCalled();
  });

  it('renders the openAction footer and fires it, closing the popover', async () => {
    const onSelect = vi.fn();
    renderPicker({ value: 'PROJ-9', openAction: { label: 'Open PROJ-9', onSelect } });
    await open();
    fireEvent.click(screen.getByText('Open PROJ-9'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search epics…')).not.toBeInTheDocument(),
    );
  });
});
