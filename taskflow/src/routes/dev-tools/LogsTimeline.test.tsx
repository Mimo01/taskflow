import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const startedAt = (over.startedAt ?? T0) + startOffset;
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
    route: '/board',
    ...over,
  };
}

const topOf = (el: HTMLElement) => Number.parseFloat(el.style.top);
const widthOf = (el: HTMLElement) => Number.parseFloat(el.style.width);

function renderTimeline(
  entries: ApiLogEntry[],
  props: { selectedId?: string | null; now?: number } = {},
) {
  const onSelect = vi.fn();
  const utils = render(
    <LogsTimeline
      entries={entries}
      selectedId={props.selectedId ?? null}
      onSelect={onSelect}
      now={props.now ?? T0 + 10_000}
      width={1000}
    />,
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
    v.resetTimeline();
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Opens the burst picker and highlights an option (n steps below 'All') with the keyboard, then confirms it. */
async function pickByKeys(downFromAll: number) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Burst' }));
  await screen.findAllByRole('option');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  await user.keyboard(`{Home}${'{ArrowDown}'.repeat(downFromAll)}`);
  await user.keyboard('{Enter}');
}

async function openPicker() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Burst' }));
  await screen.findAllByRole('option');
}

describe('LogsTimeline', () => {
  it('Logs toolbar toggles between List and Timeline, and filters still apply', () => {
    act(() => useDevToolsViewStore.getState().setLogView('list'));
    seed([mk('alpha', 0, 100), mk('beta', 200, 100)]);
    renderPage();
    expect(screen.queryByTestId('logs-timeline')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByTestId('logs-timeline')).toBeTruthy();
    expect(screen.getAllByTestId('timeline-bar')).toHaveLength(2);
    fireEvent.change(screen.getByPlaceholderText('Search URL or body'), {
      target: { value: 'alpha' },
    });
    const bars = screen.getAllByTestId('timeline-bar');
    expect(bars).toHaveLength(1);
    expect(bars[0].getAttribute('aria-label')).toBe('GET /rest/api/2/alpha');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryByTestId('logs-timeline')).toBeNull();
  });

  it('puts overlapping requests in different lanes and sequential ones in the same lane', () => {
    renderTimeline([mk('a', 0, 100), mk('b', 50, 100), mk('c', 300, 50)]);
    const bar = (n: string) => screen.getByRole('button', { name: `GET /rest/api/2/${n}` });
    expect(topOf(bar('a'))).not.toBe(topOf(bar('b')));
    expect(topOf(bar('c'))).toBe(topOf(bar('a')));
  });

  it('clicking a bar selects it and the inspector renders', () => {
    seed([mk('alpha', 0, 100)]);
    renderPage();
    fireEvent.click(screen.getByTestId('timeline-bar'));
    expect(screen.getByTestId('log-inspector')).toBeTruthy();
  });

  it('ArrowRight / ArrowLeft move by start time and Escape clears', () => {
    seed([mk('a', 0, 50), mk('b', 100, 50), mk('c', 200, 50)]);
    renderPage();
    const bar = (n: string) => screen.getByRole('button', { name: `GET /rest/api/2/${n}` });
    fireEvent.click(bar('a'));
    const selected = () => useDevToolsViewStore.getState().tabs.logs.selectedId;
    expect(selected()).toBe('a');
    fireEvent.keyDown(bar('a'), { key: 'ArrowRight' });
    expect(selected()).toBe('b');
    fireEvent.keyDown(bar('b'), { key: 'ArrowRight' });
    expect(selected()).toBe('c');
    fireEvent.keyDown(bar('c'), { key: 'ArrowLeft' });
    expect(selected()).toBe('b');
    fireEvent.keyDown(bar('b'), { key: 'Escape' });
    expect(selected()).toBeNull();
  });

  describe('bursts', () => {
    const two = () => [mk('old1', 0, 100), mk('old2', 50, 100), mk('new1', 10_000, 100)];

    it('defaults to the latest burst and lists All plus the bursts newest first', async () => {
      renderTimeline(two());
      expect(screen.getAllByTestId('timeline-bar')).toHaveLength(1);
      expect(screen.getByRole('combobox', { name: 'Burst' }).textContent).toContain(
        '/board · 1 request · 100 ms',
      );
      await openPicker();
      const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
      expect(options).toEqual([
        'All',
        '/board · 1 request · 100 ms',
        '/board · 2 requests · 150 ms',
      ]);
    });

    it('All shows both bursts and choosing a burst turns Live off', async () => {
      renderTimeline(two());
      await pickByKeys(0);
      expect(screen.getAllByTestId('timeline-bar')).toHaveLength(3);
      expect(useDevToolsViewStore.getState().timelineLive).toBe(false);
    });

    it('picking the older burst shows only its requests', async () => {
      renderTimeline(two());
      await pickByKeys(2);
      expect(screen.getAllByTestId('timeline-bar')).toHaveLength(2);
    });
  });

  describe('Live follow and zoom', () => {
    const pending = (id: string, startOffset: number): ApiLogEntry => ({
      ...mk(id, startOffset, 0),
      status: null,
      state: 'pending',
      endedAt: undefined,
    });

    it('follows the pending request while Live is on and freezes the window when it is off', () => {
      const entries = [mk('done1', 0, 100), pending('p1', 200)];
      const view = renderTimeline(entries, { now: T0 + 1000 });
      const bar = () => screen.getByRole('button', { name: 'GET /rest/api/2/p1' });
      const w0 = widthOf(bar());
      const rerenderAt = (now: number) =>
        view.rerender(
          <LogsTimeline
            entries={entries}
            selectedId={null}
            onSelect={vi.fn()}
            now={now}
            width={1000}
          />,
        );
      rerenderAt(T0 + 3000);
      expect(widthOf(bar())).not.toBe(w0);
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      expect(screen.getByRole('button', { name: 'Live' }).getAttribute('aria-pressed')).toBe(
        'false',
      );
      const frozen = useDevToolsViewStore.getState().timelineWindow;
      expect(frozen).not.toBeNull();
      const frozenWidth = widthOf(bar());
      rerenderAt(T0 + 3000);
      expect(widthOf(bar())).toBe(frozenWidth);
      expect(useDevToolsViewStore.getState().timelineWindow).toEqual(frozen);
    });

    it('switches to a new latest burst while Live is on', () => {
      seed([mk('old', 0, 100)]);
      renderPage();
      expect(screen.getAllByTestId('timeline-bar')).toHaveLength(1);
      seed([mk('fresh', 20_000, 100)]);
      const bars = screen.getAllByTestId('timeline-bar');
      expect(bars).toHaveLength(1);
      expect(bars[0].getAttribute('aria-label')).toBe('GET /rest/api/2/fresh');
    });

    it('does not switch to a new burst while Live is off', () => {
      seed([mk('old', 0, 100)]);
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Live' }));
      seed([mk('fresh', 20_000, 100)]);
      const bars = screen.getAllByTestId('timeline-bar');
      expect(bars).toHaveLength(1);
      expect(bars[0].getAttribute('aria-label')).toBe('GET /rest/api/2/old');
    });

    it('Ctrl/meta + wheel zooms in and turns Live off; a plain wheel does nothing', () => {
      renderTimeline([mk('a', 0, 400), mk('z', 600, 100)]);
      const plot = screen.getByTestId('timeline-plot');
      const bar = () => screen.getByRole('button', { name: 'GET /rest/api/2/a' });
      const before = widthOf(bar());
      fireEvent.wheel(plot, { deltaY: -100 });
      expect(widthOf(bar())).toBe(before);
      expect(useDevToolsViewStore.getState().timelineLive).toBe(true);
      fireEvent.wheel(plot, { deltaY: -100, ctrlKey: true });
      expect(useDevToolsViewStore.getState().timelineLive).toBe(false);
      expect(widthOf(bar())).toBeGreaterThan(before);
      fireEvent.wheel(plot, { deltaY: -100, metaKey: true });
      expect(widthOf(bar())).toBeGreaterThan(before * 1.4);
    });

    it('Fit resets a zoomed window', () => {
      renderTimeline([mk('a', 0, 400), mk('z', 600, 100)]);
      const plot = screen.getByTestId('timeline-plot');
      const bar = () => screen.getByRole('button', { name: 'GET /rest/api/2/a' });
      const before = widthOf(bar());
      fireEvent.wheel(plot, { deltaY: -100, ctrlKey: true });
      fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
      expect(widthOf(bar())).toBeCloseTo(before, 0);
    });
  });

  it('hover tooltip has at most 4 rows', () => {
    renderTimeline([mk('a', 0, 100)]);
    fireEvent.pointerOver(screen.getByTestId('timeline-bar'));
    const tip = screen.getByTestId('timeline-tooltip');
    expect(tip.children.length).toBeGreaterThan(0);
    expect(tip.children.length).toBeLessThanOrEqual(4);
    expect(within(tip).getByText('/rest/api/2/a')).toBeTruthy();
    expect(tip.textContent).toContain('100 ms');
    expect(tip.textContent).toContain('200');
  });

  it('renders 1000 entries', () => {
    const many = Array.from({ length: 1000 }, (_, i) => mk(`r${i}`, i * 3, 40));
    renderTimeline(many);
    expect(screen.getAllByTestId('timeline-bar').length).toBeGreaterThan(0);
  });
});
