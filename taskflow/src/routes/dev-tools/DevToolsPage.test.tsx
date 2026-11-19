import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { useDebugLogStore } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import DevToolsPage from './DevToolsPage';
import { useDevToolsViewStore } from './dev-tools-view.store';

const entry: ApiLogEntry = {
  id: 'l1',
  timestamp: '2026-11-19T10:00:00.000Z',
  source: 'jira',
  method: 'GET',
  url: 'https://jira.example.com/rest/api/2/issue/ABC-1',
  requestHeaders: { Authorization: '[REDACTED]', Accept: 'application/json' },
  status: 200,
  durationMs: 42,
  responseBody: '{"key":"ABC-1"}',
  operation: 'Load Issue',
};

function renderPage(client = new QueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <DevToolsPage />
    </QueryClientProvider>,
  );
  return client;
}

describe('DevToolsPage', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: true, requestLogging: true });
      useDebugLogStore.getState().clear();
      useDevToolsViewStore.getState().setPausedEntries(null);
      useDevToolsViewStore.getState().setSelected('logs', null);
      useDevToolsViewStore.getState().setSelected('cache', null);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows Logs, Cache, Notifications and Editor tabs and no Operations/Waterfall', () => {
    renderPage();
    for (const name of ['Logs', 'Cache', 'Notifications', 'Editor']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    }
    expect(screen.queryByRole('tab', { name: /Operations/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Waterfall/ })).toBeNull();
  });

  it('lists seeded cache queries on the Cache tab', async () => {
    const client = new QueryClient();
    client.setQueryData(['issue', 'ABC-1'], { key: 'ABC-1' });
    renderPage(client);
    fireEvent.click(screen.getByRole('tab', { name: 'Cache' }));
    await waitFor(() => expect(screen.getByText('issue › ABC-1')).toBeTruthy());
  });

  it('Copy as cURL uses a token placeholder, never the logged secret', async () => {
    act(() => {
      useDebugLogStore.getState().append(entry);
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderPage();
    fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Copy as cURL' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const curl = writeText.mock.calls[0][0] as string;
    expect(curl).toContain('$JIRA_TOKEN');
    expect(curl).not.toContain('[REDACTED]');
  });

  it('summarises the filtered set and filters by search', () => {
    act(() => {
      useDebugLogStore.getState().append(entry);
      useDebugLogStore.getState().append({
        ...entry,
        id: 'l2',
        url: 'https://jira.example.com/rest/api/2/search',
        status: 500,
      });
    });
    renderPage();
    expect(screen.getByTestId('logs-summary').textContent).toContain('2 requests');
    fireEvent.change(screen.getByLabelText('Search URL or body'), { target: { value: 'search' } });
    expect(screen.getByTestId('logs-summary').textContent).toContain('1 requests');
    expect(screen.getByTestId('logs-summary').textContent).toContain('1 errors');
  });
});
