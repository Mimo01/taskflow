import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nowMs } from '../../lib/dev-tools/log-entry';
import { saveBytes } from '../../lib/save-attachment';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { useDebugLogStore } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import DevToolsPage from './DevToolsPage';
import { LOG_FACETS, useDevToolsViewStore } from './dev-tools-view.store';

vi.mock('../../lib/save-attachment', () => ({
  saveBytes: vi.fn().mockResolvedValue('/Downloads/log.json'),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: vi.fn().mockResolvedValue(undefined),
}));

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

async function openCopyMenu() {
  await userEvent.click(await screen.findByRole('button', { name: /^(Copy|Copied)$/ }));
}

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
      useDevToolsViewStore.getState().setSearch('logs', '');
      useDevToolsViewStore.getState().resetFacets(LOG_FACETS);
      useDevToolsViewStore.getState().setLogView('list');
      useDevToolsViewStore.getState().resetLoadOpen();
      useDevToolsViewStore.getState().setSelected('cache', null);
      useSettingsStore.getState().setDevToolsInspectorWidth(440);
      useDevToolsViewStore.getState().setInspectorMaximized(false);
    });
    vi.mocked(saveBytes).mockClear();
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
    await openCopyMenu();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Copy as cURL' }));
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
    const summary = () => screen.getByTestId('logs-summary').textContent ?? '';
    expect(summary()).toMatch(/Requests\s*2/);
    for (const chip of ['Errors', 'Median', 'p95', 'Slowest']) expect(summary()).toContain(chip);
    fireEvent.change(screen.getByLabelText('Search URL or body'), { target: { value: 'search' } });
    expect(summary()).toMatch(/Requests\s*1/);
    expect(summary()).toMatch(/Errors\s*1/);
  });

  describe('Logs inspector', () => {
    const rich: ApiLogEntry = {
      ...entry,
      id: 'r1',
      method: 'POST',
      url: 'https://jira.example.com/rest/api/2/search?jql=a%20b',
      requestBody: '{"jql":"a b"}',
      responseHeaders: { 'content-type': 'application/json' },
    };

    function seedAndSelect(e: ApiLogEntry = rich) {
      act(() => {
        useDebugLogStore.getState().append(e);
      });
      renderPage();
      fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
    }

    it('shows the summary header with method, status pill, URL and a meta line', () => {
      seedAndSelect();
      const inspector = screen.getByTestId('log-inspector');
      expect(inspector.textContent).toContain('POST');
      expect(inspector.textContent).toContain('200');
      expect(inspector.textContent).toContain('/rest/api/2/search?jql=a b');
      expect(inspector.textContent).toMatch(/42 ms.*jira/);
    });

    it('lists the six copy actions', async () => {
      seedAndSelect();
      await openCopyMenu();
      const labels = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
      expect(labels).toEqual([
        'Copy URL',
        'Copy as cURL',
        'Copy response',
        'Copy request body',
        'Copy log entry as JSON',
        'Copy as Markdown',
      ]);
    });

    it('Copy log entry as JSON is parseable and redacted; Markdown starts with a heading', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
      seedAndSelect();
      await openCopyMenu();
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'Copy log entry as JSON' }),
      );
      const json = JSON.parse(writeText.mock.calls[0][0] as string);
      expect(json.requestHeaders.Authorization).toBe('[REDACTED]');
      await openCopyMenu();
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Copy as Markdown' }));
      expect((writeText.mock.calls[1][0] as string).startsWith('### POST')).toBe(true);
    });

    it('Overview lists parsed query params and response headers', () => {
      seedAndSelect();
      const inspector = screen.getByTestId('log-inspector');
      expect(inspector.textContent).toContain('Query parameters');
      expect(inspector.textContent).toContain('jql');
      expect(inspector.textContent).toContain('content-type');
    });

    it('Body shows Request and Response with the response as a tree', () => {
      seedAndSelect();
      const inspector = screen.getByTestId('log-inspector');
      expect(inspector.textContent).toContain('Request');
      expect(inspector.textContent).toContain('Response');
      expect(screen.getAllByText('"key"').length).toBeGreaterThan(0);
    });

    it('Copy all writes the filtered entries as a JSON array', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
      seedAndSelect();
      fireEvent.click(screen.getByRole('button', { name: 'Copy all' }));
      const parsed = JSON.parse(writeText.mock.calls[0][0] as string);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('r1');
    });

    it('Export saves a .json file', async () => {
      seedAndSelect();
      fireEvent.click(screen.getByRole('button', { name: 'Export' }));
      await waitFor(() => expect(saveBytes).toHaveBeenCalledTimes(1));
      expect(vi.mocked(saveBytes).mock.calls[0][1]).toMatch(/\.json$/);
    });

    it('marks the selected row with aria-current', () => {
      seedAndSelect();
      expect(screen.getAllByTestId('devtools-row')[0].getAttribute('aria-current')).toBe('true');
    });

    it('resize handle is a focusable separator that responds to arrow keys', () => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        value: 1200,
      });
      try {
        seedAndSelect();
        const handle = screen.getByRole('separator', { name: 'Resize inspector' });
        expect(handle.getAttribute('tabindex')).toBe('0');
        const before = Number(handle.getAttribute('aria-valuenow'));
        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
        expect(Number(handle.getAttribute('aria-valuenow'))).toBe(before + 16);
      } finally {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', descriptor);
        else Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
      }
    });

    it('shows an empty state until a row is selected', () => {
      act(() => {
        useDebugLogStore.getState().append(rich);
      });
      renderPage();
      expect(screen.getByText('Select a request')).toBeTruthy();
    });

    it('maximize hides the list and restore brings it back', () => {
      seedAndSelect();
      const list = screen.getByTestId('devtools-list');
      expect(list.className).not.toContain('hidden');
      fireEvent.click(screen.getByRole('button', { name: 'Maximize inspector' }));
      expect(list.className).toContain('hidden');
      fireEvent.click(screen.getByRole('button', { name: 'Restore inspector' }));
      expect(list.className).not.toContain('hidden');
    });
  });

  it("header button reads 'Clear logs' (no 'Clear all') and empties the log store", () => {
    act(() => {
      useDebugLogStore.getState().append(entry);
    });
    renderPage();
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear logs' }));
    expect(useDebugLogStore.getState().entries).toHaveLength(0);
  });

  describe('in-flight requests', () => {
    const pendingEntry = (over: Partial<ApiLogEntry> = {}): ApiLogEntry => ({
      ...entry,
      id: 'p1',
      status: null,
      durationMs: 0,
      responseBody: '',
      state: 'pending',
      startedAt: nowMs(),
      ...over,
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Row text lives in the wrapper; the test-id'd button is an empty overlay. */
    const rowText = () => screen.getByTestId('devtools-row').parentElement?.textContent ?? '';

    it('shows a pending row and an in-flight chip, then the final status after update', () => {
      act(() => {
        useDebugLogStore.getState().append(pendingEntry());
      });
      renderPage();
      expect(rowText()).toContain('pending');
      expect(screen.getByTestId('logs-summary').textContent).toContain('1 in flight');
      act(() => {
        useDebugLogStore.getState().update('p1', {
          state: 'done',
          status: 200,
          durationMs: 12,
          endedAt: nowMs(),
        });
      });
      const row = rowText();
      expect(row).toContain('200');
      expect(row).not.toContain('pending');
      expect(screen.getByTestId('logs-summary').textContent).not.toContain('in flight');
    });

    it('pausing freezes the elapsed text of a pending row', () => {
      vi.useFakeTimers();
      act(() => {
        useDebugLogStore.getState().append(pendingEntry({ startedAt: nowMs() - 100 }));
      });
      renderPage();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const text = rowText;
      const live = text();
      expect(live).toMatch(/\d+ ms/);
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      const frozen = text();
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(text()).toBe(frozen);
    });

    it('inspector Timing shows Queued and Network rows for a queued entry', () => {
      const started = nowMs();
      act(() => {
        useDebugLogStore.getState().append({
          ...entry,
          id: 'q1',
          startedAt: started,
          queuedAt: started - 120,
        });
      });
      renderPage();
      fireEvent.click(screen.getAllByTestId('devtools-row')[0]);
      const inspector = screen.getByTestId('log-inspector');
      expect(inspector.textContent).toContain('Queued');
      expect(inspector.textContent).toContain('120 ms');
      expect(inspector.textContent).toContain('Network');
    });
  });

  describe('waterfall and header', () => {
    it('list rows have no waterfall bar (load order lives in the Timeline view)', () => {
      act(() => {
        useDebugLogStore.getState().append(entry);
      });
      renderPage();
      expect(screen.queryByTestId('waterfall-bar')).toBeNull();
    });

    it('the header has no settings gear (all settings live in Settings → Advanced)', () => {
      renderPage();
      expect(screen.queryByRole('button', { name: 'Developer Tools settings' })).toBeNull();
    });
  });
});
