import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupLoads } from '../../lib/dev-tools/timeline-loads';
import { type ApiLogEntry, useDebugLogStore } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import DevToolsPage from './DevToolsPage';
import { LOG_FACETS, useDevToolsViewStore } from './dev-tools-view.store';
import LogsTimeline from './LogsTimeline';

vi.mock('../../lib/save-attachment', () => ({ saveBytes: vi.fn() }));
vi.mock('@tauri-apps/plugin-opener', () => ({ revealItemInDir: vi.fn() }));

const T0 = 1_700_000_000_000;

function mk(
  id: string,
  startOffset: number,
  ms: number,
  over: Partial<ApiLogEntry> = {},
): ApiLogEntry {
  const startedAt = T0 + startOffset;
  return {
    id,
    timestamp: new Date(startedAt).toISOString(),
    source: 'jira',
    method: 'GET',
    url: `https://jira.example.com/rest/api/2/${id}`,
    requestHeaders: {},
    status: 200,
    durationMs: ms,
    responseBody: '{}',
    state: 'done',
    startedAt,
    endedAt: startedAt + ms,
    route: '/backlog',
    ...over,
  };
}

const pending = (id: string, startOffset: number, over: Partial<ApiLogEntry> = {}) =>
  mk(id, startOffset, 0, { state: 'pending', status: null, endedAt: undefined, ...over });

const widthOf = (el: HTMLElement) => Number.parseFloat(el.style.width);

function renderTimeline(entries: ApiLogEntry[], now = T0 + 10_000) {
  const onSelect = vi.fn();
  const utils = render(
    <LogsTimeline loads={groupLoads(entries)} selectedId={null} onSelect={onSelect} now={now} />,
  );
  return { ...utils, onSelect };
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DevToolsPage />
    </QueryClientProvider>,
  );
}

function seed(entries: ApiLogEntry[]) {
  act(() => {
    for (const e of entries) useDebugLogStore.getState().append(e);
  });
}

const twoLoads = () => [
  mk('a', 0, 100),
  mk('b', 50, 100),
  mk('c', 100, 100),
  mk('d', 2000, 100, { route: '/issue/PROJ-1' }),
  mk('e', 2050, 100, { route: '/issue/PROJ-1' }),
];

beforeEach(() => {
  act(() => {
    useSettingsStore.setState({ devToolsEnabled: true, requestLogging: true });
    useDebugLogStore.getState().clear();
    const v = useDevToolsViewStore.getState();
    v.setPausedEntries(null);
    v.setSelected('logs', null);
    v.setSearch('logs', '');
    v.resetFacets(LOG_FACETS);
    v.setLogView('timeline');
    v.resetLoadOpen();
  });
});

describe('LogsTimeline loads', () => {
  it('groups by page, newest first, and only the newest load is open', () => {
    renderTimeline(twoLoads());
    const headers = screen.getAllByTestId('timeline-load');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toContain('Issue PROJ-1');
    expect(headers[0].textContent).toContain('2 requests');
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    expect(headers[1].getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(2);
    expect(headers[0].textContent).toContain('150 ms');
    expect(within(headers[1]).queryByText('0')).toBeNull();
    expect(within(headers[0]).getByText('0')).toBeTruthy();
  });

  it('header click toggles a load', () => {
    renderTimeline(twoLoads());
    const [, older] = screen.getAllByTestId('timeline-load');
    fireEvent.click(older);
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(5);
    const [newest] = screen.getAllByTestId('timeline-load');
    fireEvent.click(newest);
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(3);
  });

  it('keeps open choices across List/Timeline and tab switches, and Clear resets them', () => {
    seed(twoLoads());
    renderPage();
    const [, older] = screen.getAllByTestId('timeline-load');
    fireEvent.click(older);
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', { name: /Cache/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Logs/ }));
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(useDevToolsViewStore.getState().loadOpen).toEqual({});
  });

  it('renders rows in start order with id tie-break regardless of input order', () => {
    renderTimeline([mk('b', 10, 50), mk('c', 0, 50), mk('a', 10, 50)]);
    const labels = screen.getAllByTestId('devtools-row').map((r) => r.getAttribute('aria-label'));
    expect(labels).toEqual(['GET /rest/api/2/c', 'GET /rest/api/2/a', 'GET /rest/api/2/b']);
  });
});

describe('LogsTimeline rows', () => {
  it('shows status text only when not OK, with a loading placeholder duration', () => {
    renderTimeline([
      mk('ok', 0, 100),
      mk('nf', 10, 100, { status: 404 }),
      mk('boom', 20, 100, { status: 500 }),
      mk('net', 30, 100, { status: null, state: 'error' }),
      pending('wait', 40),
    ]);
    expect(screen.queryByText('200')).toBeNull();
    expect(screen.getByText('404').className).toContain('amber');
    expect(screen.getByText('500').className).toContain('red');
    expect(screen.getByText('error').className).toContain('red');
    expect(screen.getByText('loading').className).toContain('muted');
    expect(screen.getByText('…')).toBeTruthy();
  });

  it('shows a queued lead-in only when queuedAt precedes the start', () => {
    renderTimeline([mk('q', 300, 100, { queuedAt: T0 + 100 }), mk('n', 0, 100)]);
    expect(screen.getAllByTestId('timeline-queued')).toHaveLength(1);
  });

  it('grows a pending bar as now advances', () => {
    const entries = [mk('a', 0, 100), pending('p', 50)];
    const { rerender } = render(
      <LogsTimeline
        loads={groupLoads(entries)}
        selectedId={null}
        onSelect={vi.fn()}
        now={T0 + 500}
      />,
    );
    const bars = () => screen.getAllByTestId('timeline-bar');
    const before = widthOf(bars()[1]);
    rerender(
      <LogsTimeline
        loads={groupLoads(entries)}
        selectedId={null}
        onSelect={vi.fn()}
        now={T0 + 900}
      />,
    );
    expect(widthOf(bars()[1])).toBeGreaterThan(0);
    expect(widthOf(bars()[1])).not.toBe(before);
  });

  it('shows a three-line tooltip on hover', () => {
    renderTimeline([mk('plain', 0, 100), mk('queued', 200, 100, { queuedAt: T0 + 50 })]);
    const rows = document.querySelectorAll('[data-timeline-row]');
    fireEvent.pointerOver(rows[1], { clientX: 10, clientY: 10 });
    let tip = screen.getByRole('tooltip');
    expect(tip.children).toHaveLength(3);
    expect(tip.textContent).toContain('after waiting');
    expect(tip.textContent).toContain('for a Jira slot');
    expect(tip.children[2].textContent).toMatch(/^Started/);
    fireEvent.pointerOver(rows[0], { clientX: 10, clientY: 10 });
    tip = screen.getByRole('tooltip');
    expect(tip.children).toHaveLength(3);
    expect(tip.textContent).not.toContain('after waiting');
    fireEvent.pointerLeave(screen.getByTestId('logs-timeline'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders 1000 requests in one load and re-renders with a new now', () => {
    const entries = Array.from({ length: 1000 }, (_, i) => mk(`r${i}`, i, 50));
    const loads = groupLoads(entries);
    const { rerender } = render(
      <LogsTimeline loads={loads} selectedId={null} onSelect={vi.fn()} now={T0 + 5000} />,
    );
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(1000);
    rerender(<LogsTimeline loads={loads} selectedId={null} onSelect={vi.fn()} now={T0 + 5250} />);
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(1000);
  });
});

describe('LogsTimeline page integration', () => {
  it('click opens the inspector; arrows move through visible rows; Escape clears', () => {
    seed(twoLoads());
    renderPage();
    const rows = () => screen.getAllByTestId('devtools-row');
    fireEvent.click(rows()[0]);
    expect(screen.getByTestId('log-inspector')).toBeTruthy();
    expect(useDevToolsViewStore.getState().tabs.logs.selectedId).toBe('d');
    const root = screen.getByTestId('logs-timeline');
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    expect(useDevToolsViewStore.getState().tabs.logs.selectedId).toBe('e');
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    // Older load is closed: selection stays on the last visible row.
    expect(useDevToolsViewStore.getState().tabs.logs.selectedId).toBe('e');
    fireEvent.keyDown(root, { key: 'ArrowUp' });
    expect(useDevToolsViewStore.getState().tabs.logs.selectedId).toBe('d');
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(useDevToolsViewStore.getState().tabs.logs.selectedId).toBeNull();
  });

  it('arrows continue into an opened older load in visual order', () => {
    seed(twoLoads());
    renderPage();
    fireEvent.click(screen.getAllByTestId('timeline-load')[1]);
    fireEvent.click(screen.getAllByTestId('devtools-row')[1]);
    fireEvent.keyDown(screen.getByTestId('logs-timeline'), { key: 'ArrowDown' });
    expect(useDevToolsViewStore.getState().tabs.logs.selectedId).toBe('a');
  });

  it('search still filters the timeline', () => {
    seed(twoLoads());
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Search URL or body'), {
      target: { value: '/b' },
    });
    expect(screen.getAllByTestId('timeline-load')).toHaveLength(1);
    expect(screen.getAllByTestId('devtools-row')).toHaveLength(1);
  });

  it('Pause freezes new requests out of the timeline', () => {
    seed([mk('a', 0, 100)]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    seed([mk('z', 5000, 100, { route: '/epics' })]);
    expect(screen.getAllByTestId('timeline-load')).toHaveLength(1);
  });
});
