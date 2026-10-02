import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { SERIES } from './epic-markers';
import { toLocalDateString } from '@/lib/local-date';
import { fetchEpicStatusHistory, fetchEpicWorklogs, type JiraIssue } from '@/services/jira';
import { CHART_HEIGHT, PLOT_HEIGHT } from './EpicChartZoom';
import { EpicProgressSection } from './EpicProgressSection';

vi.mock('@/services/jira', async (orig) => ({
  ...(await orig<typeof import('@/services/jira')>()),
  fetchEpicWorklogs: vi.fn(),
  fetchEpicStatusHistory: vi.fn().mockResolvedValue(new Map()),
  fetchAllJiraStatuses: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/stores/auth.store', () => {
  const state = { jiraBaseUrl: 'https://jira.test', jiraConnected: true };
  const useAuthStore = (sel?: (s: typeof state) => unknown) => (sel ? sel(state) : state);
  return { useAuthStore };
});

const mockWorklogs = vi.mocked(fetchEpicWorklogs);
const mockHistory = vi.mocked(fetchEpicStatusHistory);
beforeEach(() => {
  mockWorklogs.mockReset();
  mockWorklogs.mockResolvedValue(new Map());
  mockHistory.mockReset();
  mockHistory.mockResolvedValue(new Map());
});

const SP = 'customfield_10016';

/** Every render goes through a QueryClientProvider: the section owns lazy queries. */
function renderSection(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const rowTexts = () =>
  [...document.querySelectorAll('[data-slot="tooltip-row"]')].map((r) => r.textContent);

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateString(d);
}

interface Opts {
  cat: 'new' | 'indeterminate' | 'done';
  status: string;
  sp?: number | null;
  assignee?: string | null;
  created?: string;
  res?: string;
  est?: number;
  own?: number;
  spent?: number;
  rem?: number;
}
function story(key: string, o: Opts): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: key,
      status: { id: '1', name: o.status, statusCategory: { key: o.cat } },
      assignee: o.assignee ? { displayName: o.assignee, avatarUrls: { '48x48': '' } } : null,
      customfield_10016: o.sp ?? null,
      issuetype: { name: 'Story', subtask: false },
      created: o.created,
      resolutiondate: o.res ?? null,
      aggregatetimeoriginalestimate: o.est,
      timeoriginalestimate: o.own,
      aggregatetimespent: o.spent,
      aggregatetimeestimate: o.rem,
    },
  };
}

// Count: 1 of 4 done = 25%. SP: 1 of 10 = 10%.
const stories = [
  story('A-1', {
    cat: 'done',
    status: 'Done',
    sp: 1,
    assignee: 'Amy',
    created: daysAgo(10),
    res: daysAgo(2),
  }),
  story('A-2', {
    cat: 'indeterminate',
    status: 'In Review',
    sp: 5,
    assignee: 'Bob',
    created: daysAgo(9),
  }),
  story('A-3', { cat: 'new', status: 'To Do', sp: 4, assignee: null, created: daysAgo(8) }),
  story('A-4', { cat: 'new', status: 'Backlog', sp: null, assignee: 'Bob', created: daysAgo(8) }),
];

describe('EpicProgressSection', () => {
  it('shows a skeleton while stories load', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={undefined}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(screen.getByTestId('epic-progress-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders nothing for an epic with no stories', () => {
    const { container } = renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all panels', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    expect(screen.getByRole('region', { name: 'Epic progress' })).toBeInTheDocument();
    expect(screen.getByTestId('epic-burnup')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('epic-status-bar')).getAllByTestId('epic-status-segment'),
    ).toHaveLength(4);
    const rows = screen.getAllByTestId('epic-assignee-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Bob')).toBeInTheDocument();
    expect(screen.getAllByText('Unassigned').length).toBe(1);
    expect(screen.getAllByTestId('epic-stat-tile')).toHaveLength(3);
    expect(screen.getByTestId('epic-hero')).toBeInTheDocument();
    expect(screen.queryByTestId('epic-cfd-note')).toBeNull();
    expect(
      within(screen.getByTestId('epic-cfd-legend')).getByText('Completed'),
    ).toBeInTheDocument();
    expect(screen.getByText('In Review · 1')).toBeInTheDocument();
  });

  it('toggles Count / SP and updates % done', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    const count = screen.getByRole('button', { name: 'Count' });
    const sp = screen.getByRole('button', { name: 'SP' });
    expect(count).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('25%')).toBeInTheDocument();
    fireEvent.click(sp);
    expect(sp).toHaveAttribute('aria-pressed', 'true');
    expect(count).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('shows "Too early to tell" for insufficient throughput', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    expect(screen.getByText('Too early')).toBeInTheDocument();
  });

  it('shows Complete and no projected date at 100%', () => {
    const done = [
      story('D-1', { cat: 'done', status: 'Done', created: daysAgo(3), res: daysAgo(1) }),
    ];
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={done}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText('Too early to tell')).not.toBeInTheDocument();
  });

  it('shows "No timeline data" when no story has a created date', () => {
    const undated = [story('U-1', { cat: 'new', status: 'To Do' })];
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={undated}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(screen.getByText('No timeline data')).toBeInTheDocument();
  });
});

describe('EpicProgressSection review fixes (261001-fmk)', () => {
  it('explains SP mode instead of blank bars when nothing is estimated', () => {
    const unestimated = [
      story('U-1', { cat: 'new', status: 'To Do', sp: null, created: daysAgo(5) }),
      story('U-2', { cat: 'done', status: 'Done', sp: null, created: daysAgo(5), res: daysAgo(1) }),
    ];
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={unestimated}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    // 261002-0xf: a calm in-place message keeps the chart slot; the status block still renders.
    const empty = screen.getByTestId('epic-empty-estimate');
    expect(within(empty).getByText(/No story points estimated/)).toBeTruthy();
    expect(screen.getByTestId('epic-status-bar')).toBeInTheDocument();
    fireEvent.click(within(empty).getByRole('button', { name: 'Switch to Count' }));
    expect(screen.getByRole('button', { name: 'Count' })).toHaveAttribute('aria-pressed', 'true');
  });
});

const ASSIGNEE_TIME_ROWS = ['Completed33%', 'In progress0%', 'To do67%', 'Logged1h 30m'];

describe('EpicProgressSection time metric, card and tooltips (261001-g5q)', () => {
  const timed = [
    story('T-1', {
      cat: 'done',
      status: 'Done',
      assignee: 'Amy',
      created: daysAgo(5),
      res: daysAgo(1),
      est: 3600,
      spent: 5400,
      rem: 0,
    }),
    story('T-2', {
      cat: 'new',
      status: 'To Do',
      assignee: 'Amy',
      created: daysAgo(4),
      est: 7200,
      rem: 3600,
    }),
  ];

  function renderTimed(list = timed) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <EpicProgressSection
          epicKey="E-1"
          stories={list}
          storyPointsFieldKey={SP}
          epicCreated={undefined}
        />
      </QueryClientProvider>,
    );
  }

  it('is a full-width divider section with no Card, skeleton included', () => {
    const { container, unmount } = renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={timed}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    const region = screen.getByRole('region', { name: 'Epic progress' });
    expect(region.querySelector('[data-slot="card"]')).toBeNull();
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
    expect(region.className).toContain('border-t');
    expect(region.className).toContain('border-b');
    unmount();
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={undefined}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    const sk = screen.getByTestId('epic-progress-skeleton');
    expect(sk.querySelector('[data-slot="card"]')).toBeNull();
    expect(sk).not.toHaveAttribute('data-slot', 'card');
    expect(sk.className).toContain('border-t');
  });

  it('offers Count / SP / Time with Count default', () => {
    renderTimed();
    expect(screen.getByRole('button', { name: 'Count' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'SP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Time' })).toBeInTheDocument();
  });

  it('Time mode hero shows the done share of the estimate; strip shows Finish / Remaining / Risks', () => {
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const hero = screen.getByTestId('epic-hero');
    expect(hero.textContent).toContain('33%');
    expect(within(hero).getByTestId('epic-hero-caption').textContent).toBe('1h of 3h');
    const tiles = screen.getAllByTestId('epic-stat-tile');
    expect(tiles).toHaveLength(3);
    expect(tiles[0].textContent).toMatch(/^Finish/);
    // Remaining = open max(est - logged, 0) = 7200, NOT Jira's remaining (3600).
    expect(tiles[1].textContent).toMatch(/^Remaining2h/);
    expect(tiles[2].textContent).toMatch(/^Risks/);
  });

  it('Time mode assignee chips show done / in progress / to do estimate', () => {
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    expect(within(row).getByLabelText('completed 1h')).toBeInTheDocument();
    expect(within(row).getByLabelText('in progress 0m')).toBeInTheDocument();
    expect(within(row).getByLabelText('to do 2h')).toBeInTheDocument();
    expect(within(row).queryByLabelText('logged 1h 30m')).toBeNull();
  });

  it('Time mode with no estimates explains instead of drawing bars', () => {
    renderTimed([story('N-1', { cat: 'new', status: 'To Do', created: daysAgo(3) })]);
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const empty = screen.getByTestId('epic-empty-estimate');
    expect(within(empty).getByText(/No time estimated/)).toBeTruthy();
    expect(screen.getByTestId('epic-status-bar')).toBeInTheDocument();
  });

  it('hovering the whole status bar shows every non-zero status with value and percent', async () => {
    const user = userEvent.setup();
    renderTimed();
    await user.hover(screen.getByTestId('epic-status-bar'));
    const done = (await screen.findByText('Done')).parentElement as HTMLElement;
    expect(within(done).getByText('50%')).toBeInTheDocument();
    const todo = screen.getByText('To Do').parentElement as HTMLElement;
    expect(within(todo).getByText('50%')).toBeInTheDocument();
  });

  it('keyboard focus on the hero shows the category rows', async () => {
    const user = userEvent.setup();
    renderTimed();
    await user.tab(); // Count
    await user.tab(); // SP
    await user.tab(); // Time
    await user.tab(); // hero
    expect(document.activeElement).toBe(screen.getByTestId('epic-hero'));
    await waitFor(() =>
      expect(rowTexts()).toEqual(['Completed150%', 'In progress00%', 'To do150%']),
    );
  });

  it('hovering the assignee bar shows the breakdown in the active metric', async () => {
    const user = userEvent.setup();
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    expect(within(row).getByText('Amy')).toBeInTheDocument();
    await user.hover(within(row).getByTestId('epic-assignee-bar'));
    const tip = await waitFor(() => {
      const el = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement;
      expect(el).not.toBeNull();
      return el;
    });
    expect(within(tip).getByText('Amy')).toBeInTheDocument();
    // 261002-0xf: shares only (chips already show values), Logged for Time, no Estimate row.
    expect(rowTexts()).toEqual(ASSIGNEE_TIME_ROWS);
  });

  it('hovering the assignee name or chips opens the row tooltip', async () => {
    const user = userEvent.setup();
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    const expected = ASSIGNEE_TIME_ROWS;
    await user.hover(within(row).getByText('Amy'));
    await waitFor(() => expect(rowTexts()).toEqual(expected));
    await user.unhover(within(row).getByText('Amy'));
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull());
    await user.hover(within(row).getByLabelText('to do 2h'));
    await waitFor(() => expect(rowTexts()).toEqual(expected));
    expect(row.querySelectorAll('button')).toHaveLength(0);
    expect(row.querySelectorAll('button, [tabindex="0"]')).toHaveLength(1);
  });
});

describe('EpicProgressSection review fixes (261001-g5q)', () => {
  const mixed = [
    story('M-1', {
      cat: 'done',
      status: 'Done',
      sp: 3,
      assignee: 'Amy',
      created: daysAgo(5),
      res: daysAgo(1),
    }),
    story('M-2', { cat: 'new', status: 'Backlog', sp: null, assignee: 'Amy', created: daysAgo(5) }),
  ];

  it('omits zero-value statuses from the status bar but keeps them in the legend', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={mixed}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    expect(screen.getAllByTestId('epic-status-segment')).toHaveLength(1);
    expect(screen.getByText(/Backlog ·/)).toBeTruthy();
  });

  it('renders tiles without block <p> inside the button and gives each assignee row one tab stop', () => {
    const { container } = renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={mixed}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(container.querySelector('[data-testid="epic-stat-tile"] p')).toBeNull();
    const row = screen.getAllByTestId('epic-assignee-row')[0];
    expect(row.querySelectorAll('button, [tabindex="0"]')).toHaveLength(1);
    expect(row.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('EpicProgressSection time burnup, formulas (261001-hsz)', () => {
  const timed = [
    story('T-1', {
      cat: 'done',
      status: 'Done',
      assignee: 'Amy',
      created: daysAgo(5),
      res: daysAgo(1),
      own: 3600,
      est: 3600,
      spent: 5400,
    }),
    story('T-2', {
      cat: 'new',
      status: 'To Do',
      assignee: 'Amy',
      created: daysAgo(4),
      own: 3600,
      est: 10800,
      spent: 1800,
    }),
  ];

  function renderIt(list = timed) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <EpicProgressSection
          epicKey="E-1"
          stories={list}
          storyPointsFieldKey={SP}
          epicCreated={undefined}
        />
      </QueryClientProvider>,
    );
  }

  it('worklogs load once in every mode for the averaged Finish', async () => {
    renderIt();
    await waitFor(() => expect(mockWorklogs).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(mockWorklogs).toHaveBeenCalledTimes(1);
  });

  it('Time mode shows a loading skeleton then the chart, fetching with story keys', async () => {
    let resolve: (m: Map<string, never[]>) => void = () => {};
    mockWorklogs.mockReturnValue(new Promise((r) => (resolve = r)));
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(await screen.findByTestId('epic-time-burnup-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('epic-stat-tile')).toHaveLength(3);
    resolve(new Map());
    expect(await screen.findByTestId('epic-time-burnup')).toBeInTheDocument();
    expect(mockWorklogs).toHaveBeenCalledWith('https://jira.test', 'tok', ['T-1', 'T-2']);
  });

  it('shows an error with Retry that refetches, tiles still render', async () => {
    const user = userEvent.setup();
    mockWorklogs.mockRejectedValueOnce(new Error('boom'));
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(await screen.findByText("Couldn't load worklogs")).toBeInTheDocument();
    expect(screen.getAllByTestId('epic-stat-tile')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockWorklogs).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('epic-time-burnup')).toBeInTheDocument();
  });

  it('hero uses the subtask-sum estimate (no formula note in the tooltip)', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const hero = screen.getByTestId('epic-hero');
    // T-1: no subtask estimates -> own 1h; T-2: subtasks 3h - 1h own... agg 3h, own 1h -> 2h. Total 3h.
    expect(within(hero).getByTestId('epic-hero-caption').textContent).toBe('1h of 3h');
  });

  it('Remaining tile tooltip is a single explanatory line', async () => {
    const user = userEvent.setup();
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await user.hover(screen.getAllByTestId('epic-stat-tile')[1]);
    expect(await screen.findByText('Open items · Time = estimate − logged')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="tooltip-row"]')).toHaveLength(0);
  });

  it('legend items are plain non-focusable text', () => {
    renderIt();
    const bar = screen.getByTestId('epic-status-bar');
    const legend = screen.getByText(/Done · 1/).closest('span')?.parentElement;
    expect(legend?.querySelectorAll('button, [tabindex]')).toHaveLength(0);
    expect(bar).toHaveAttribute('tabindex', '0');
  });
});

describe('EpicProgressSection hero, strip and assignee rows (261001-ilq)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Working days (Mon-Fri) ending 2026-09-30 (a Wednesday), newest first. */
  function workingDaysBack(n: number): string[] {
    const out: string[] = [];
    let d = new Date(Date.UTC(2026, 8, 30));
    while (out.length < n) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() - 86_400_000);
    }
    return out;
  }

  it('hero shows the % as its own node, a segmented bar and one summary line (Count)', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    const hero = screen.getByTestId('epic-hero');
    expect(within(hero).getByText('25%')).toBeInTheDocument();
    expect(within(hero).getByTestId('epic-hero-caption').textContent).toBe('1 of 4');
    const bar = within(hero).getByTestId('epic-hero-bar');
    expect(bar.querySelectorAll('[data-segment]')).toHaveLength(3);
    expect(hero.querySelector('p, div')).toBeNull();
  });

  it('hero uses the SP metric in SP mode', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    const hero = screen.getByTestId('epic-hero');
    expect(within(hero).getByText('10%')).toBeInTheDocument();
    expect(within(hero).getByTestId('epic-hero-caption').textContent).toBe('1 of 10 SP');
  });

  it('Finish shows a date, range and confidence for an ok forecast', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    const list = [
      ...workingDaysBack(15).map((d, i) =>
        story(`S-${i + 1}`, {
          cat: 'done',
          status: 'Done',
          assignee: 'Amy',
          created: '2026-01-01',
          res: `${d}T12:00:00.000+0000`,
        }),
      ),
      ...[0, 1, 2, 3, 4].map((i) =>
        story(`S-${100 + i}`, {
          cat: 'new',
          status: 'To Do',
          assignee: 'Amy',
          created: '2026-01-01',
        }),
      ),
    ];
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={list}
        storyPointsFieldKey={SP}
        epicCreated="2026-01-01"
      />,
    );
    const finish = screen.getAllByTestId('epic-stat-tile')[0];
    expect(finish.textContent).toContain('Oct 7');
    expect(within(finish).getByTestId('confidence-meter')).toHaveAttribute('data-level', 'medium');
    expect(finish.textContent).toContain('Medium');
  });

  it('Finish shows the state text for too-early and done', () => {
    const { unmount } = renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    expect(screen.getAllByTestId('epic-stat-tile')[0].textContent).toBe(
      'FinishToo earlyNeeds more completed work',
    );
    unmount();
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[
          story('D-1', { cat: 'done', status: 'Done', created: daysAgo(3), res: daysAgo(1) }),
        ]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(screen.getAllByTestId('epic-stat-tile')[0].textContent).toBe(
      'FinishCompleteAll work done',
    );
  });

  it('Remaining shows the active metric with the other metrics as a muted sub line', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    const remaining = screen.getAllByTestId('epic-stat-tile')[1];
    expect(within(remaining).getByText('3 items')).toBeInTheDocument();
    expect(within(remaining).getByText('9 SP · 0m')).toBeInTheDocument();
  });

  it('Risks lists one button per risk for unestimated and unassigned, or No risks when clean', () => {
    const { unmount } = renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    const risks = screen.getAllByTestId('epic-stat-tile')[2];
    // 261002-0xf: chips carry the full text as their accessible name.
    expect(within(risks).getByRole('button', { name: '1 unestimated' })).toBeInTheDocument();
    expect(within(risks).getByRole('button', { name: '1 unassigned' })).toBeInTheDocument();
    for (const chip of within(risks).getAllByTestId('epic-risk-item')) {
      expect(chip).toHaveAttribute('data-severity', 'info');
    }
    expect(within(risks).queryByText('No risks')).toBeNull();
    unmount();
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[
          story('C-1', {
            cat: 'done',
            status: 'Done',
            sp: 2,
            assignee: 'Amy',
            created: daysAgo(3),
            res: daysAgo(1),
          }),
        ]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(
      within(screen.getAllByTestId('epic-stat-tile')[2]).getByText('No risks'),
    ).toBeInTheDocument();
  });

  it('assignee rows show an avatar and status-coloured numeric chips, dimming zeros', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    const rows = screen.getAllByTestId('epic-assignee-row');
    const bob = rows[0];
    expect(within(bob).getByRole('img', { name: 'Bob' })).toBeInTheDocument();
    const chips = within(bob).getAllByTestId('epic-assignee-chip');
    expect(chips.map((c) => c.getAttribute('data-cat'))).toEqual(['done', 'indeterminate', 'new']);
    expect(chips.map((c) => c.textContent)).toEqual(['0', '1', '1']);
    expect(within(bob).getByLabelText('completed 0').className).toContain('opacity-40');
    expect(within(bob).getByLabelText('in progress 1').className).not.toContain('opacity-40');
    expect(within(bob).getByLabelText('to do 1')).toBeInTheDocument();
    const unassigned = rows.find((r) => within(r).queryByRole('img', { name: 'Unassigned' }));
    expect(unassigned).toBeDefined();
  });

  it('keeps one tab stop per assignee row despite avatar and chips', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    for (const row of screen.getAllByTestId('epic-assignee-row')) {
      expect(row.querySelectorAll('button, [tabindex="0"]')).toHaveLength(1);
    }
  });

  it('worklogs load once in every mode for the averaged Finish', async () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    await waitFor(() => expect(mockWorklogs).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(mockWorklogs).toHaveBeenCalledTimes(1);
  });
});

describe('EpicProgressSection cumulative flow + time chart (261001-ilq)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Working days (Mon-Fri) ending 2026-09-30 (a Wednesday), newest first. */
  function workingDaysBack(n: number): string[] {
    const out: string[] = [];
    let d = new Date(Date.UTC(2026, 8, 30));
    while (out.length < n) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() - 86_400_000);
    }
    return out;
  }

  const sectionFor = (list: JiraIssue[], epicCreated: string | undefined) => (
    <EpicProgressSection
      epicKey="E-1"
      stories={list}
      storyPointsFieldKey={SP}
      epicCreated={epicCreated}
    />
  );

  const okFixture = () => [
    ...workingDaysBack(15).map((d, i) =>
      story(`S-${i + 1}`, {
        cat: 'done',
        status: 'Done',
        assignee: 'Amy',
        created: '2026-01-01',
        res: `${d}T12:00:00.000+0000`,
      }),
    ),
    ...[0, 1, 2, 3, 4].map((i) =>
      story(`S-${100 + i}`, {
        cat: 'new',
        status: 'To Do',
        assignee: 'Amy',
        created: '2026-01-01',
      }),
    ),
  ];

  it('fetches status history once in Count mode (sorted keys + epic key) and not again in Time mode', async () => {
    renderSection(sectionFor([stories[2], stories[0], stories[1]], daysAgo(12)));
    await waitFor(() => expect(mockHistory).toHaveBeenCalledTimes(1));
    expect(mockHistory).toHaveBeenCalledWith(
      'https://jira.test',
      'tok',
      ['A-1', 'A-2', 'A-3'],
      'E-1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await waitFor(() => expect(mockWorklogs).toHaveBeenCalledTimes(1));
    expect(mockHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps the chart wrapper in every history state, with the matching data source', async () => {
    // pending
    mockHistory.mockReturnValue(new Promise(() => {}));
    const pending = renderSection(sectionFor(stories, daysAgo(12)));
    expect(screen.getByTestId('epic-burnup')).toHaveAttribute('data-history', 'approx');
    expect(screen.getByTestId('epic-source-flag')).toHaveAttribute(
      'aria-label',
      'Approximate: status history loading',
    );
    pending.unmount();

    // rejected
    mockHistory.mockReset();
    mockHistory.mockRejectedValue(new Error('boom'));
    const failed = renderSection(sectionFor(stories, daysAgo(12)));
    await waitFor(() =>
      expect(screen.getByTestId('epic-source-flag')).toHaveAttribute(
        'aria-label',
        'Approximate: no status history',
      ),
    );
    expect(screen.getByTestId('epic-burnup')).toHaveAttribute('data-history', 'approx');
    failed.unmount();

    // resolved, real (an entry per story)
    mockHistory.mockReset();
    mockHistory.mockResolvedValue(
      new Map(stories.map((s) => [s.key, { transitions: [], joinedAt: null }])),
    );
    const real = renderSection(sectionFor(stories, daysAgo(12)));
    await waitFor(() =>
      expect(screen.getByTestId('epic-burnup')).toHaveAttribute('data-history', 'real'),
    );
    expect(screen.queryByTestId('epic-source-flag')).toBeNull();
    const realUser = userEvent.setup();
    await realUser.hover(screen.getByTestId('epic-hero'));
    // 261002-0xf: the hero note names only non-default sources — real history adds nothing.
    await waitFor(() =>
      expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull(),
    );
    expect(screen.queryByTestId('hero-source-note')?.textContent ?? '').not.toMatch(
      /status history/,
    );
    real.unmount();

    // resolved, approximate for some items (one story missing)
    mockHistory.mockReset();
    mockHistory.mockResolvedValue(
      new Map(stories.slice(1).map((s) => [s.key, { transitions: [], joinedAt: null }])),
    );
    renderSection(sectionFor(stories, daysAgo(12)));
    await waitFor(() =>
      expect(screen.getByTestId('epic-source-flag')).toHaveAttribute(
        'aria-label',
        'Approximate for some items',
      ),
    );
  });

  it('legend lists Completed / In progress / To do / Remaining, plus Forecast only when ok', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    const ok = renderSection(sectionFor(okFixture(), '2026-01-01'));
    const legend = within(screen.getByTestId('epic-cfd-legend'));
    for (const label of ['Completed', 'In progress', 'To do', 'Remaining', 'Forecast']) {
      expect(legend.getByText(label)).toBeInTheDocument();
    }
    ok.unmount();

    // too early: a single completion on a brand-new epic
    renderSection(
      sectionFor(
        [
          story('F-1', {
            cat: 'done',
            status: 'Done',
            created: '2026-09-30',
            res: '2026-09-30T08:00:00.000+0000',
          }),
          story('F-2', { cat: 'new', status: 'To Do', created: '2026-09-30' }),
        ],
        '2026-09-30',
      ),
    );
    const tooEarly = within(screen.getByTestId('epic-cfd-legend'));
    expect(tooEarly.getByText('Remaining')).toBeInTheDocument();
    expect(tooEarly.queryByText('Forecast')).toBeNull();
  });

  it('shows "No timeline data" for the CFD with no dates, without a skeleton', () => {
    renderSection(sectionFor([story('U-1', { cat: 'new', status: 'To Do' })], undefined));
    expect(screen.getByTestId('epic-burnup')).toBeInTheDocument();
    expect(screen.getByText('No timeline data')).toBeInTheDocument();
  });

  it('Time mode renders the chart with Estimate / Logged / Remaining in its legend', async () => {
    renderSection(
      sectionFor(
        [
          story('T-1', {
            cat: 'done',
            status: 'Done',
            assignee: 'Amy',
            created: daysAgo(5),
            res: daysAgo(1),
            own: 3600,
            est: 3600,
            spent: 5400,
          }),
          story('T-2', {
            cat: 'new',
            status: 'To Do',
            assignee: 'Amy',
            created: daysAgo(4),
            own: 3600,
            est: 10800,
            spent: 1800,
          }),
        ],
        undefined,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(await screen.findByTestId('epic-time-burnup')).toBeInTheDocument();
    const legend = within(screen.getByTestId('epic-time-legend'));
    for (const label of ['Estimate', 'Logged', 'Remaining']) {
      expect(legend.getByText(label)).toBeInTheDocument();
    }
  });
});

describe('EpicProgressSection review fixes (261001-ilq)', () => {
  it('Finish is toggle-independent and never today when only unestimated work remains', async () => {
    const user = userEvent.setup();
    const s = [
      story('F-1', {
        cat: 'done',
        status: 'Done',
        sp: 3,
        created: '2026-09-01',
        res: '2026-09-10',
      }),
      story('F-2', { cat: 'new', status: 'To Do', sp: null, created: '2026-09-01' }),
    ];
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={s}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    const finishTile = () =>
      screen.getAllByTestId('epic-stat-tile').find((t) => t.textContent?.includes('Finish'));
    const countText = finishTile()?.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    const finish = finishTile();
    expect(finish?.textContent).toContain('Stalled');
    expect(finish?.textContent).not.toMatch(/Today/i);
    expect(finish?.textContent).toBe(countText);
    await user.hover(finish as HTMLElement);
    await waitFor(() => expect(rowTexts().length).toBeGreaterThan(0));
    expect(rowTexts()).toContain('SPno estimates');
  });
});

describe('EpicProgressSection averaged Finish and risks (261001-qvu)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function workingDaysBack(n: number): string[] {
    const out: string[] = [];
    let d = new Date(Date.UTC(2026, 8, 30));
    while (out.length < n) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() - 86_400_000);
    }
    return out;
  }
  const okList = () => [
    ...workingDaysBack(15).map((d, i) =>
      story(`S-${i + 1}`, {
        cat: 'done',
        status: 'Done',
        assignee: 'Amy',
        created: '2026-01-01',
        res: `${d}T12:00:00.000+0000`,
      }),
    ),
    ...[0, 1, 2, 3, 4].map((i) =>
      story(`S-${100 + i}`, {
        cat: 'new',
        status: 'To Do',
        assignee: 'Amy',
        created: '2026-01-01',
      }),
    ),
  ];

  it('shows the same averaged Finish in Count and SP mode, with per-metric rows and the calendar note', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    const user = userEvent.setup();
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={okList()}
        storyPointsFieldKey={SP}
        epicCreated="2026-01-01"
      />,
    );
    const finishTile = () => screen.getAllByTestId('epic-stat-tile')[0];
    expect(finishTile().textContent).toContain('Oct 7');
    expect(within(finishTile()).getByTestId('confidence-meter')).toHaveAttribute(
      'data-level',
      'medium',
    );
    expect(finishTile().textContent).toContain('Medium');
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    expect(finishTile().textContent).toContain('Oct 7');
    expect(within(finishTile()).getByTestId('confidence-meter')).toHaveAttribute(
      'data-level',
      'medium',
    );
    expect(finishTile().textContent).toContain('Medium');
    await user.hover(finishTile());
    // 261002-0xf: an ok Finish lists which views it is based on, not one row per view.
    await waitFor(() => expect(rowTexts().some((t) => t?.startsWith('Based on'))).toBe(true));
    expect(rowTexts().find((t) => t?.startsWith('Based on'))).toContain('Items');
    await user.unhover(finishTile());
    await user.hover(screen.getByTestId('epic-hero'));
    // No Tempo calendar -> the hero note says so (one short token).
    await waitFor(() =>
      expect(screen.getByTestId('hero-source-note').textContent).toContain('No holiday calendar'),
    );
  });

  it('a past due date shows a warning overdue item', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[story('O-1', { cat: 'new', status: 'To Do', sp: 1, assignee: 'Amy' })]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
        epicDueDate={daysAgo(3)}
      />,
    );
    const chip = screen.getByRole('button', { name: 'Overdue 3 days' });
    expect(chip).toHaveAttribute('data-severity', 'warning');
  });

  it('opening a risk lists its affected issues', async () => {
    const user = userEvent.setup();
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[
          story('A-1', { cat: 'done', status: 'Done', sp: 2, assignee: 'Amy', res: daysAgo(1) }),
          story('A-4', { cat: 'new', status: 'To Do', sp: null, assignee: null }),
        ]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
        onOpenIssue={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: '1 unassigned' }));
    const rows = await screen.findAllByTestId('epic-risk-issue');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('A-4');
  });

  it('bar-to-legend spacing uses no negative margins', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={okList()}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    const block = screen.getByTestId('epic-status-block');
    expect(block.className).toContain('flex-col');
    expect(block.className).toContain('gap-1.5');
    const negMargin = (el: HTMLElement) => el.className.split(/\s+/).some((c) => /^-m/.test(c));
    expect(negMargin(screen.getByTestId('epic-status-bar'))).toBe(false);
    for (const t of screen.getAllByTestId('epic-assignee-trigger')) {
      expect(negMargin(t)).toBe(false);
    }
  });
});

describe('EpicProgressSection one forecast (261001-rtw)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function workingDaysBack(n: number): string[] {
    const out: string[] = [];
    let d = new Date(Date.UTC(2026, 8, 30));
    while (out.length < n) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() - 86_400_000);
    }
    return out;
  }
  const okList = () => [
    ...workingDaysBack(15).map((d, i) =>
      story(`S-${i + 1}`, {
        cat: 'done',
        status: 'Done',
        assignee: 'Amy',
        created: '2026-01-01',
        res: `${d}T12:00:00.000+0000`,
      }),
    ),
    ...[0, 1, 2, 3, 4].map((i) =>
      story(`S-${100 + i}`, {
        cat: 'new',
        status: 'To Do',
        assignee: 'Amy',
        created: '2026-01-01',
        est: 3600,
      }),
    ),
  ];
  const section = (list: JiraIssue[], created: string | undefined) => (
    <EpicProgressSection
      epicKey="E-1"
      stories={list}
      storyPointsFieldKey={SP}
      epicCreated={created}
    />
  );

  it('draws the shared Forecast in the CFD (Count) and in the Time chart', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    renderSection(section(okList(), '2026-01-01'));
    expect(within(screen.getByTestId('epic-cfd-legend')).getByText('Forecast')).toBeInTheDocument();
    expect(screen.queryByTestId('epic-forecast-state')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const legend = await screen.findByTestId('epic-time-legend');
    expect(within(legend).getByText('Forecast')).toBeInTheDocument();
    expect(screen.queryByTestId('epic-forecast-state')).toBeNull();
  });

  it('shows the same state text in the legend and Finish tile when not ok', () => {
    renderSection(
      section(
        [
          story('F-1', {
            cat: 'done',
            status: 'Done',
            created: daysAgo(1),
            res: daysAgo(0),
          }),
          story('F-2', { cat: 'new', status: 'To Do', created: daysAgo(1) }),
        ],
        daysAgo(1),
      ),
    );
    const legend = within(screen.getByTestId('epic-cfd-legend'));
    expect(legend.queryByText('Forecast')).toBeNull();
    expect(screen.getByTestId('epic-forecast-state').textContent).toBe('Forecast: Too early');
    expect(screen.getAllByTestId('epic-stat-tile')[0].textContent).toContain('Too early');
  });
});

describe('EpicProgressSection unified tabs (261001-rtw)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const timed = [
    story('T-1', {
      cat: 'done',
      status: 'Done',
      assignee: 'Amy',
      created: daysAgo(5),
      res: daysAgo(1),
      est: 3600,
      spent: 5400,
      rem: 0,
    }),
    story('T-2', {
      cat: 'new',
      status: 'To Do',
      assignee: 'Amy',
      created: daysAgo(4),
      est: 7200,
      rem: 3600,
    }),
  ];
  const timedSection = () => (
    <EpicProgressSection
      epicKey="E-1"
      stories={timed}
      storyPointsFieldKey={SP}
      epicCreated={daysAgo(6)}
    />
  );
  const markers = () =>
    [...document.querySelectorAll('[data-slot="tooltip-row"]')].map((r) =>
      r.children[0].getAttribute('data-marker'),
    );

  it('Time mode person bar segments agree with the chips (same three estimate values)', () => {
    renderSection(timedSection());
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    const chips = within(row).getAllByTestId('epic-assignee-chip');
    expect(chips.map((c) => c.textContent)).toEqual(['1h', '0m', '2h']);
    expect(chips.map((c) => c.getAttribute('data-cat'))).toEqual(['done', 'indeterminate', 'new']);
    const segs = [...row.querySelectorAll('[data-segment]')] as HTMLElement[];
    expect(segs.map((s) => s.getAttribute('data-segment'))).toEqual(['done', 'new']);
    // Scale = the largest assignee total (3h): 1h -> 33.3%, 2h -> 66.7%.
    expect(Number.parseFloat(segs[0].style.width)).toBeCloseTo(100 / 3, 3);
    expect(Number.parseFloat(segs[1].style.width)).toBeCloseTo(200 / 3, 3);
    expect(within(row).queryByLabelText(/^logged/)).toBeNull();
  });

  it('Time hero tooltip lists the three bands in hours with share, then a Logged icon row', async () => {
    const user = userEvent.setup();
    renderSection(timedSection());
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await user.hover(screen.getByTestId('epic-hero'));
    // 261002-0xf: no Estimate row (caption shows it) and no formula note.
    await waitFor(() =>
      expect(rowTexts()).toEqual([
        'Completed1h33%',
        'In progress0m0%',
        'To do2h67%',
        'Logged1h 30m',
      ]),
    );
    expect(markers()).toEqual(['status', 'status', 'status', 'icon']);
  });

  it('Count hero tooltip keeps the three band rows', async () => {
    const user = userEvent.setup();
    renderSection(timedSection());
    await user.hover(screen.getByTestId('epic-hero'));
    await waitFor(() =>
      expect(rowTexts()).toEqual(['Completed150%', 'In progress00%', 'To do150%']),
    );
  });

  it('the Remaining tooltip is the same single line in every tab', async () => {
    const user = userEvent.setup();
    renderSection(timedSection());
    const tile = () => screen.getAllByTestId('epic-stat-tile')[1];
    for (const tab of ['Count', 'SP', 'Time']) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      await user.hover(tile());
      expect(await screen.findByText('Open items · Time = estimate − logged')).toBeInTheDocument();
      expect(rowTexts()).toHaveLength(0);
      await user.unhover(tile());
      await waitFor(() =>
        expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull(),
      );
    }
  });

  it('Finish and Risks tooltip rows use icon markers with no inline colour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    const user = userEvent.setup();
    const days: string[] = [];
    let d = new Date(Date.UTC(2026, 8, 30));
    while (days.length < 15) {
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() - 86_400_000);
    }
    const list = [
      ...days.map((day, i) =>
        story(`S-${i + 1}`, {
          cat: 'done',
          status: 'Done',
          assignee: 'Amy',
          created: '2026-01-01',
          res: `${day}T12:00:00.000+0000`,
        }),
      ),
      ...[0, 1, 2, 3, 4].map((i) =>
        story(`S-${100 + i}`, { cat: 'new', status: 'To Do', created: '2026-01-01' }),
      ),
    ];
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={list}
        storyPointsFieldKey={SP}
        epicCreated="2026-01-01"
      />,
    );
    const tiles = screen.getAllByTestId('epic-stat-tile');
    await user.hover(tiles[0]);
    await waitFor(() => expect(rowTexts().some((t) => t?.startsWith('Likely'))).toBe(true));
    const finishRows = [...document.querySelectorAll('[data-slot="tooltip-row"]')];
    expect(finishRows.length).toBeGreaterThan(3);
    for (const r of finishRows) {
      expect((r.children[0] as HTMLElement).getAttribute('data-marker')).toBe('icon');
    }
    await user.unhover(tiles[0]);
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull());
    expect(tiles[2].querySelector('[data-slot="tooltip-row"]')).toBeNull();
    const riskIcons = tiles[2].querySelectorAll('[data-testid="epic-risk-item"] svg');
    expect(riskIcons.length).toBeGreaterThan(0);
    for (const svg of riskIcons) expect((svg as SVGElement).style.color).toBe('');
  });
});

describe('EpicProgressSection a11y review fix (261001-rtw)', () => {
  it('assignee row trigger is a labelled group, so its img chips are not nested images', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[
          story('R-1', { cat: 'new', status: 'To Do', assignee: 'Amy', created: '2026-09-01' }),
        ]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    const trigger = screen.getByTestId('epic-assignee-trigger');
    expect(trigger.getAttribute('role')).toBe('group');
    expect(trigger.closest('[role="img"]')).toBeNull();
  });
});

describe('EpicProgressSection risks, sources, confidence (261001-sqm)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function workingDaysBack(n: number): string[] {
    const out: string[] = [];
    let d = new Date(Date.UTC(2026, 8, 30));
    while (out.length < n) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() - 86_400_000);
    }
    return out;
  }
  const okList = () => [
    ...workingDaysBack(15).map((d, i) =>
      story(`S-${i + 1}`, {
        cat: 'done',
        status: 'Done',
        assignee: 'Amy',
        created: '2026-01-01',
        res: `${d}T12:00:00.000+0000`,
      }),
    ),
    ...[0, 1, 2, 3, 4].map((i) =>
      story(`S-${100 + i}`, {
        cat: 'new',
        status: 'To Do',
        assignee: 'Amy',
        created: '2026-01-01',
      }),
    ),
  ];
  const sectionOf = (list: JiraIssue[], extra: Record<string, unknown> = {}) => (
    <EpicProgressSection
      epicKey="E-1"
      stories={list}
      storyPointsFieldKey={SP}
      epicCreated="2026-01-01"
      {...extra}
    />
  );

  it('hero tooltip names only non-default data sources in one short note, and no chart notes remain', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    mockHistory.mockResolvedValue(
      new Map(okList().map((s) => [s.key, { transitions: [], joinedAt: null }])),
    );
    const user = userEvent.setup();
    renderSection(sectionOf(okList()));
    // Real history + no Tempo calendar -> only the calendar token.
    await waitFor(() =>
      expect(screen.getByTestId('epic-burnup')).toHaveAttribute('data-history', 'real'),
    );
    await user.hover(screen.getByTestId('epic-hero'));
    await waitFor(() =>
      expect(screen.getByTestId('hero-source-note').textContent).toBe('No holiday calendar'),
    );
    await user.unhover(screen.getByTestId('epic-hero'));
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(screen.queryByTestId('epic-cfd-note')).toBeNull();
    expect(screen.queryByText(/Done stories collapse/)).toBeNull();
    await user.hover(screen.getByTestId('epic-hero'));
    // Time never mentions status history; the note stays within the 8-word budget.
    await waitFor(() =>
      expect(screen.getByTestId('hero-source-note').textContent).toContain('No holiday calendar'),
    );
    const note = screen.getByTestId('hero-source-note').textContent ?? '';
    expect(note).not.toMatch(/status history/);
    expect(note.split(/\s+/).filter((w) => /\w/.test(w)).length).toBeLessThanOrEqual(8);
  });

  it('shows the source flag only while history is approximate', async () => {
    mockHistory.mockReturnValue(new Promise(() => {}));
    renderSection(sectionOf(stories));
    // A focusable button trigger (was role=img + tabIndex, flagged by biome noNoninteractiveTabindex).
    expect(screen.getByTestId('epic-source-flag').tagName).toBe('BUTTON');
  });

  it('Finish pairs the range with a confidence meter; the tooltip adds a Confidence row and reason', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    const user = userEvent.setup();
    renderSection(sectionOf(okList()));
    const finish = screen.getAllByTestId('epic-stat-tile')[0];
    expect(within(finish).getByTestId('confidence-meter')).toHaveAttribute('data-level', 'medium');
    await user.hover(finish);
    await waitFor(() => expect(rowTexts().some((t) => t?.startsWith('Confidence'))).toBe(true));
    expect(rowTexts().some((t) => t?.startsWith('Confidence') && t.includes('Medium'))).toBe(true);
    const reasons = document.querySelectorAll('[data-testid="confidence-reason"]');
    expect(reasons).toHaveLength(1);
    expect(reasons[0].textContent).toMatch(
      /Only \d+ (working days|completions)|Wide range|Steady|disagree/,
    );
    expect((reasons[0].textContent ?? '').length).toBeLessThanOrEqual(60);
    // 261002-0xf: the reason is the tooltip note; ok Finish also says which views it's based on.
    expect(rowTexts().some((t) => t?.startsWith('Based on'))).toBe(true);
    const tip = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement;
    expect(tip.querySelectorAll('[data-testid="confidence-meter"]')).toHaveLength(1);
    // The tile sub-line keeps the range and meter on one non-wrapping row.
    const meter = within(finish).getByTestId('confidence-meter');
    expect(meter.parentElement?.className).toContain('whitespace-nowrap');
  });

  it('Risks popover: rows are buttons that open the issue (click, arrows, Enter, Escape)', async () => {
    const onOpenIssue = vi.fn();
    const user = userEvent.setup();
    renderSection(
      sectionOf(
        [
          story('A-1', { cat: 'done', status: 'Done', sp: 2, assignee: 'Amy', res: daysAgo(1) }),
          story('A-4', { cat: 'new', status: 'To Do', sp: 2, assignee: null }),
          story('A-5', { cat: 'new', status: 'To Do', sp: 2, assignee: null }),
        ],
        { onOpenIssue },
      ),
    );
    expect(screen.queryByText('A-4')).toBeNull();
    await user.click(screen.getByRole('button', { name: '2 unassigned' }));
    await user.click(await screen.findByRole('button', { name: /^A-4/ }));
    expect(onOpenIssue).toHaveBeenCalledWith('A-4');
    await waitFor(() => expect(screen.queryByTestId('epic-risk-popover')).toBeNull());

    await user.click(screen.getByRole('button', { name: '2 unassigned' }));
    const rows = await screen.findAllByTestId('epic-risk-issue');
    rows[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[1]);
    await user.keyboard('{Enter}');
    expect(onOpenIssue).toHaveBeenCalledWith('A-5');
    await waitFor(() => expect(screen.queryByTestId('epic-risk-popover')).toBeNull());

    await user.click(screen.getByRole('button', { name: '2 unassigned' }));
    await screen.findByTestId('epic-risk-popover');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('epic-risk-popover')).toBeNull());
  });

  it('opening a risk popover by click puts focus on the first issue row', async () => {
    const user = userEvent.setup();
    renderSection(
      sectionOf(
        [
          story('F-1', { cat: 'new', status: 'To Do', sp: 2, assignee: null }),
          story('F-2', { cat: 'new', status: 'To Do', sp: 2, assignee: null }),
        ],
        { onOpenIssue: vi.fn() },
      ),
    );
    await user.click(screen.getByRole('button', { name: '2 unassigned' }));
    const rows = await screen.findAllByTestId('epic-risk-issue');
    await waitFor(() => expect(document.activeElement).toBe(rows[0]));
  });

  it('risk popover lists every issue in a scrollable list; warnings come first', async () => {
    const user = userEvent.setup();
    const ten = Array.from({ length: 10 }, (_, i) =>
      story(`K-${i + 1}`, { cat: 'new', status: 'To Do', sp: 1, assignee: null }),
    );
    renderSection(sectionOf(ten, { epicDueDate: daysAgo(3), onOpenIssue: vi.fn() }));
    const items = screen.getAllByTestId('epic-risk-item');
    // 261002-0xf: chips show a short token; the full text is the accessible name.
    expect(items[0]).toHaveAccessibleName('Overdue 3 days');
    expect(items[0].textContent).toBe('3d');
    await user.click(screen.getByRole('button', { name: '10 unassigned' }));
    const popover = await screen.findByTestId('epic-risk-popover');
    expect(within(popover).getAllByTestId('epic-risk-issue')).toHaveLength(10);
    const list = within(popover).getByTestId('epic-risk-issues');
    expect(list.className).toContain('max-h-48');
    expect(list.className).toContain('overflow-y-auto');
    expect(within(popover).queryByRole('button', { name: /more$/ })).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('epic-risk-popover')).toBeNull());
    await user.click(items[0]);
    const overdue = await screen.findByTestId('epic-risk-popover');
    // 261002-0xf: overdue explains only (the Stories list shows open items); supersedes 0et WR-01.
    expect(within(overdue).queryByTestId('epic-risk-issues')).toBeNull();
    expect(overdue.textContent).toContain('items open');
  });
});

describe('EpicProgressSection shared axis and zoom (261001-sqm)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function workingDaysBack(n: number): string[] {
    const out: string[] = [];
    let d = new Date(Date.UTC(2026, 8, 30));
    while (out.length < n) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() - 86_400_000);
    }
    return out;
  }
  const okList = () => [
    ...workingDaysBack(15).map((d, i) =>
      story(`S-${i + 1}`, {
        cat: 'done',
        status: 'Done',
        assignee: 'Amy',
        created: '2026-01-01',
        est: 3600,
        res: `${d}T12:00:00.000+0000`,
      }),
    ),
    ...[0, 1, 2, 3, 4].map((i) =>
      story(`S-${100 + i}`, {
        cat: 'new',
        status: 'To Do',
        assignee: 'Amy',
        created: '2026-01-01',
        est: 3600,
      }),
    ),
  ];
  const section = (list: JiraIssue[]) => (
    <EpicProgressSection
      epicKey="E-1"
      stories={list}
      storyPointsFieldKey={SP}
      epicCreated="2026-01-01"
    />
  );
  const pressed = () =>
    within(screen.getByTestId('epic-zoom-presets'))
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent);
  const activeChart = () =>
    screen.queryByTestId('epic-burnup') ?? screen.getByTestId('epic-time-burnup');

  it('Count and Time charts share the same x domain', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    renderSection(section(okList()));
    const count = screen.getByTestId('epic-burnup');
    const from = count.getAttribute('data-x-from');
    const to = count.getAttribute('data-x-to');
    expect(from).toBe('2026-01-01');
    expect(to).toBe(count.getAttribute('data-domain-to'));
    expect(to && to > '2026-09-30').toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const time = await screen.findByTestId('epic-time-burnup');
    expect(time.getAttribute('data-x-from')).toBe(from);
    expect(time.getAttribute('data-x-to')).toBe(to);
  });

  it('presets clamp to the domain, persist across tabs, and All restores it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    renderSection(section(okList()));
    const domainTo = screen.getByTestId('epic-burnup').getAttribute('data-domain-to');
    expect(pressed()).toEqual(['All']);
    fireEvent.click(within(screen.getByTestId('epic-zoom-presets')).getByText('1M'));
    expect(pressed()).toEqual(['1M']);
    expect(screen.getByTestId('epic-burnup')).toHaveAttribute('data-x-from', '2026-08-31');
    expect(screen.getByTestId('epic-burnup')).toHaveAttribute('data-x-to', '2026-09-30');
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const time = await screen.findByTestId('epic-time-burnup');
    expect(pressed()).toEqual(['1M']);
    expect(time).toHaveAttribute('data-x-from', '2026-08-31');
    expect(time).toHaveAttribute('data-x-to', '2026-09-30');
    fireEvent.click(within(screen.getByTestId('epic-zoom-presets')).getByText('All'));
    expect(activeChart()).toHaveAttribute('data-x-from', '2026-01-01');
    expect(activeChart()).toHaveAttribute('data-x-to', domainTo ?? '');
  });

  it('Forecast preset is enabled with a forecast and hidden without one', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    const ok = renderSection(section(okList()));
    const forecast = () => within(screen.getByTestId('epic-zoom-presets')).getByText('Forecast');
    expect(forecast()).toBeEnabled();
    fireEvent.click(forecast());
    expect(screen.getByTestId('epic-burnup')).toHaveAttribute('data-x-from', '2026-09-16');
    expect(screen.getByTestId('epic-burnup')).toHaveAttribute(
      'data-x-to',
      screen.getByTestId('epic-burnup').getAttribute('data-domain-to') ?? '',
    );
    ok.unmount();
    renderSection(section(stories));
    const presets = screen.getByTestId('epic-zoom-presets');
    expect(within(presets).queryByText('Forecast')).toBeNull();
    expect(within(presets).getByText('All')).toBeInTheDocument();
  });

  it('short domains hide the zoom strip and presets and use the plot height', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    expect(screen.queryByTestId('epic-zoom-presets')).toBeNull();
    const chart = screen.getByTestId('epic-burnup');
    expect(chart).toHaveAttribute('data-zoomable', 'false');
    expect(chart.style.height).toBe(`${PLOT_HEIGHT}px`);
  });

  it('long domains show presets and the taller chart', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    renderSection(section(okList()));
    expect(screen.getByTestId('epic-zoom-presets')).toBeInTheDocument();
    const chart = screen.getByTestId('epic-burnup');
    expect(chart).toHaveAttribute('data-zoomable', 'true');
    expect(chart.style.height).toBe(`${CHART_HEIGHT}px`);
  });

  it('stored zoom resets to All when the domain drops below the threshold', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrap = (ui: ReactElement) => <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
    const short = (
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />
    );
    const { rerender } = render(wrap(section(okList())));
    fireEvent.click(within(screen.getByTestId('epic-zoom-presets')).getByText('1M'));
    expect(pressed()).toEqual(['1M']);
    rerender(wrap(short));
    expect(screen.queryByTestId('epic-zoom-presets')).toBeNull();
    const chart = screen.getByTestId('epic-burnup');
    expect(chart.getAttribute('data-x-to')).toBe(chart.getAttribute('data-domain-to'));
    rerender(wrap(section(okList())));
    expect(pressed()).toEqual(['All']);
  });

  it('presets sit outside the legend container', () => {
    renderSection(section(stories));
    expect(
      within(screen.getByTestId('epic-cfd-legend')).queryByTestId('epic-zoom-presets'),
    ).toBeNull();
  });

  it('SERIES uses status colours by meaning, forecast and band stay neutral', () => {
    expect(SERIES.logged.stroke).toBe(STATUS_CATEGORY_COLOR.done);
    expect(SERIES.remaining.stroke).toBe(STATUS_CATEGORY_COLOR.indeterminate);
    expect(SERIES.estimate.fill).toBe(STATUS_CATEGORY_COLOR.new);
    expect(SERIES.forecast.stroke).toBe('var(--color-foreground)');
    expect(SERIES.band.fill).toBe('var(--color-muted-foreground)');
  });

  it('legend markers carry the status colours in both charts and the forecast meter appears', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    renderSection(section(okList()));
    const marker = (legend: HTMLElement, label: string) =>
      within(legend).getByText(label).previousElementSibling as HTMLElement | null as HTMLElement;
    const cfd = screen.getByTestId('epic-cfd-legend');
    expect(marker(cfd, 'Remaining')).toHaveAttribute('data-marker', 'status-line');
    expect(marker(cfd, 'Remaining').style.background).toBe(STATUS_CATEGORY_COLOR.indeterminate);
    expect(within(cfd).getByTestId('confidence-meter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const legend = await screen.findByTestId('epic-time-legend');
    expect(marker(legend, 'Estimate')).toHaveAttribute('data-marker', 'status-area');
    expect(marker(legend, 'Estimate').style.background).toBe(STATUS_CATEGORY_COLOR.new);
    expect(marker(legend, 'Logged')).toHaveAttribute('data-marker', 'status-line');
    expect(marker(legend, 'Logged').style.background).toBe(STATUS_CATEGORY_COLOR.done);
    expect(marker(legend, 'Remaining').style.background).toBe(STATUS_CATEGORY_COLOR.indeterminate);
  });
});

describe('Risks keys without an issue opener (261001-sqm review WR-01)', () => {
  it('renders keys as plain text, not dead buttons', async () => {
    const user = userEvent.setup();
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[story('N-4', { cat: 'new', status: 'To Do', sp: null, assignee: null })]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    await user.click(screen.getAllByTestId('epic-risk-item')[0]);
    expect((await screen.findByTestId('epic-risk-issue')).textContent).toContain('N-4');
    expect(screen.queryByRole('button', { name: /^N-4/ })).toBeNull();
  });
});

describe('EpicProgressSection polish contracts (261002-0xf)', () => {
  const states: Array<[string, JiraIssue[], Record<string, unknown>]> = [
    ['too-early', stories, { epicCreated: daysAgo(12) }],
    [
      'no risks',
      [story('C-1', { cat: 'done', status: 'Done', sp: 2, assignee: 'Amy', res: daysAgo(1) })],
      {},
    ],
    [
      'three risks',
      [
        story('R-1', { cat: 'new', status: 'To Do', sp: null, assignee: null }),
        story('R-2', { cat: 'new', status: 'To Do', sp: 1, assignee: 'Amy' }),
      ],
      { epicDueDate: daysAgo(3) },
    ],
  ];
  const render = (list: JiraIssue[], extra: Record<string, unknown>) =>
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={list}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
        {...extra}
      />,
    );
  const cards = () => [...document.querySelectorAll<HTMLElement>('[data-stat-card]')];
  const noteWords = () =>
    [...document.querySelectorAll('[data-slot="tooltip-note"]')].map(
      (n) => (n.textContent ?? '').split(/\s+/).filter((w) => /\w/.test(w)).length,
    );

  it('the four cards share one fixed three-slot shape in every tab and state', () => {
    for (const [, list, extra] of states) {
      const { unmount } = render(list, extra);
      for (const tab of ['Count', 'SP', 'Time']) {
        fireEvent.click(screen.getByRole('button', { name: tab }));
        const all = cards();
        expect(all).toHaveLength(4);
        for (const c of all) {
          for (const cls of ['h-[72px]', 'w-full', 'grid-rows-[1rem_2rem_1rem]']) {
            expect(c.className).toContain(cls);
          }
          expect(c.children).toHaveLength(3);
        }
        const grid = all[0].parentElement as HTMLElement;
        expect(grid.className).toContain('@2xl/epic:grid-cols-4');
        expect(grid.className).not.toMatch(/(^|\s)(sm|lg):/);
      }
      unmount();
    }
  });

  it('the loading skeleton has four cards of the same height', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={undefined}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    const sk = screen.getByTestId('epic-progress-skeleton');
    expect(sk.querySelectorAll('.h-\\[72px\\]')).toHaveLength(4);
  });

  it('section tooltips stay within 4 rows and an 8-word note', async () => {
    const user = userEvent.setup();
    render(stories, { epicCreated: daysAgo(12) });
    const check = async (el: HTMLElement) => {
      await user.hover(el);
      await waitFor(() =>
        expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull(),
      );
      expect(rowTexts().length).toBeLessThanOrEqual(4);
      for (const n of noteWords()) expect(n).toBeLessThanOrEqual(8);
      await user.unhover(el);
      await waitFor(() =>
        expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull(),
      );
    };
    for (const tab of ['Count', 'Time']) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      const [, finish, remaining] = cards();
      await check(screen.getByTestId('epic-hero'));
      await check(finish);
      await check(remaining);
      await check(screen.getAllByTestId('epic-assignee-trigger')[0]);
    }
  });

  it('shows the same risks in Count, SP and Time', () => {
    render(states[2][1], states[2][2]);
    const names = () =>
      screen.getAllByTestId('epic-risk-item').map((c) => c.getAttribute('aria-label'));
    const count = names();
    expect(count.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    expect(names()).toEqual(count);
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(names()).toEqual(count);
  });
});
