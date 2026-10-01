import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTIMATE_FORMULA_NOTE } from '@/lib/epic-progress';
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
    expect(screen.getByText('Too early to tell')).toBeInTheDocument();
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
    expect(screen.getByText(/No story points estimated/)).toBeTruthy();
    expect(screen.queryByTestId('epic-status-bar')).toBeNull();
  });
});

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
    expect(within(hero).getByText('1h of 3h done · 0m in progress')).toBeInTheDocument();
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
    expect(within(row).getByLabelText('done 1h')).toBeInTheDocument();
    expect(within(row).getByLabelText('in progress 0m')).toBeInTheDocument();
    expect(within(row).getByLabelText('to do 2h')).toBeInTheDocument();
    expect(within(row).queryByLabelText('logged 1h 30m')).toBeNull();
  });

  it('Time mode with no estimates explains instead of drawing bars', () => {
    renderTimed([story('N-1', { cat: 'new', status: 'To Do', created: daysAgo(3) })]);
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(screen.getByText(/No time estimated/)).toBeTruthy();
    expect(screen.queryByTestId('epic-status-bar')).toBeNull();
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
    await waitFor(() => expect(rowTexts()).toEqual(['Done150%', 'In progress00%', 'To do150%']));
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
    expect(rowTexts()).toEqual([
      'Done1h',
      'In progress0m',
      'To do2h',
      'Logged1h 30m',
      'Estimate3h',
    ]);
  });

  it('hovering the assignee name or chips opens the row tooltip', async () => {
    const user = userEvent.setup();
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    const expected = ['Done1h', 'In progress0m', 'To do2h', 'Logged1h 30m', 'Estimate3h'];
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

  it('hero uses the subtask-sum estimate and its tooltip explains the formula', async () => {
    const user = userEvent.setup();
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const hero = screen.getByTestId('epic-hero');
    // T-1: no subtask estimates -> own 1h; T-2: subtasks 3h - 1h own... agg 3h, own 1h -> 2h. Total 3h.
    expect(hero.textContent).toContain('1h of 3h done');
    await user.hover(hero);
    expect(await screen.findByText(ESTIMATE_FORMULA_NOTE)).toBeInTheDocument();
  });

  it('Remaining tile tooltip says it replaces the Jira remaining estimate', async () => {
    const user = userEvent.setup();
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await user.hover(screen.getAllByTestId('epic-stat-tile')[1]);
    expect(await screen.findByText(/Replaces Jira's remaining estimate/)).toBeInTheDocument();
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
    expect(within(hero).getByText('1 of 4 done · 1 in progress')).toBeInTheDocument();
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
    expect(within(hero).getByText('1 SP of 10 SP done · 5 SP in progress')).toBeInTheDocument();
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
    expect(screen.getAllByTestId('epic-stat-tile')[0].textContent).toBe('FinishToo early to tell');
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
    expect(screen.getAllByTestId('epic-stat-tile')[0].textContent).toBe('FinishComplete');
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

  it('Risks shows severity chips for unestimated and unassigned, or No risks when clean', () => {
    const { unmount } = renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    const risks = screen.getAllByTestId('epic-stat-tile')[2];
    expect(within(risks).getByText('1 unestimated')).toBeInTheDocument();
    expect(within(risks).getByText('1 unassigned')).toBeInTheDocument();
    for (const chip of within(risks).getAllByTestId('epic-risk-chip')) {
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
    expect(within(bob).getByLabelText('done 0').className).toContain('opacity-40');
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
      'Approximate — loading status history',
    );
    pending.unmount();

    // rejected
    mockHistory.mockReset();
    mockHistory.mockRejectedValue(new Error('boom'));
    const failed = renderSection(sectionFor(stories, daysAgo(12)));
    await waitFor(() =>
      expect(screen.getByTestId('epic-source-flag')).toHaveAttribute(
        'aria-label',
        'Approximate — status history unavailable',
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
    await waitFor(() =>
      expect(
        [...document.querySelectorAll('[data-slot="tooltip-source"]')].map((r) => r.textContent),
      ).toContain('From Jira status history'),
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
    expect(rowTexts()).toContain('Story pointsno estimates');
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
    await waitFor(() => expect(rowTexts().some((t) => t?.startsWith('Items'))).toBe(true));
    const rows = rowTexts();
    expect(rows.some((t) => t?.startsWith('Story points') && t.includes('no estimates'))).toBe(
      true,
    );
    expect(rows.some((t) => t?.startsWith('Time'))).toBe(true);
    await user.hover(screen.getByTestId('epic-hero'));
    await waitFor(() =>
      expect(document.body.textContent).toContain('Excludes weekends (holidays unavailable)'),
    );
  });

  it('a past due date shows a warning overdue chip', () => {
    renderSection(
      <EpicProgressSection
        epicKey="E-1"
        stories={[story('O-1', { cat: 'new', status: 'To Do', sp: 1, assignee: 'Amy' })]}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
        epicDueDate={daysAgo(3)}
      />,
    );
    const chip = screen.getByText('overdue').closest('[data-testid="epic-risk-chip"]');
    expect(chip).toHaveAttribute('data-severity', 'warning');
  });

  it('opening Risks lists one row per risk with the affected issue keys', async () => {
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
    await user.click(screen.getAllByTestId('epic-stat-tile')[2]);
    await waitFor(() => expect(rowTexts()).toContain('Unestimated1'));
    expect(rowTexts()).toContain('Unassigned1');
    expect(screen.getAllByRole('button', { name: 'A-4' }).length).toBeGreaterThan(0);
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
    expect(screen.getByTestId('epic-hero-caption').className).toContain('mt-1.5');
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
    expect(screen.getByTestId('epic-forecast-state').textContent).toBe(
      'Forecast: Too early to tell',
    );
    expect(screen.getAllByTestId('epic-stat-tile')[0].textContent).toContain('Too early to tell');
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

  it('Time hero tooltip lists the three bands in hours with share, then Logged / Estimate icons', async () => {
    const user = userEvent.setup();
    renderSection(timedSection());
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await user.hover(screen.getByTestId('epic-hero'));
    await screen.findByText(ESTIMATE_FORMULA_NOTE);
    expect(rowTexts()).toEqual([
      'Done1h33%',
      'In progress0m0%',
      'To do2h67%',
      'Logged1h 30m',
      'Estimate3h',
    ]);
    expect(markers()).toEqual(['status', 'status', 'status', 'icon', 'icon']);
  });

  it('Count hero tooltip keeps the three band rows', async () => {
    const user = userEvent.setup();
    renderSection(timedSection());
    await user.hover(screen.getByTestId('epic-hero'));
    await waitFor(() => expect(rowTexts()).toEqual(['Done150%', 'In progress00%', 'To do150%']));
  });

  it('the Remaining tooltip has the same rows and note in every tab', async () => {
    const user = userEvent.setup();
    renderSection(timedSection());
    const tile = () => screen.getAllByTestId('epic-stat-tile')[1];
    await user.hover(tile());
    await waitFor(() => expect(rowTexts()).toHaveLength(3));
    expect(rowTexts()).toEqual(['Items1 item', 'Story points0 SP', 'Time2h']);
    expect(markers()).toEqual(['icon', 'icon', 'icon']);
    expect(document.body.textContent).toContain("Replaces Jira's remaining estimate");
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
    await user.hover(tiles[2]);
    await waitFor(() => expect(rowTexts().some((t) => t?.startsWith('Unassigned'))).toBe(true));
    for (const r of document.querySelectorAll('[data-slot="tooltip-row"]')) {
      const m = r.children[0] as HTMLElement;
      expect(m.getAttribute('data-marker')).toBe('icon');
      expect(m.style.color).toBe('');
    }
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
  const sourceTexts = () =>
    [...document.querySelectorAll('[data-slot="tooltip-source"]')].map((r) => r.textContent);

  it('hero tooltip lists Data sources in the same slots per tab, and no chart notes remain', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T12:00:00'));
    mockHistory.mockResolvedValue(
      new Map(okList().map((s) => [s.key, { transitions: [], joinedAt: null }])),
    );
    const user = userEvent.setup();
    renderSection(sectionOf(okList()));
    await user.hover(screen.getByTestId('epic-hero'));
    await waitFor(() => expect(sourceTexts().length).toBe(3));
    expect(document.body.textContent).toContain('Data sources');
    expect(sourceTexts()).toEqual([
      'From Jira status history',
      'Scope from when each item joined the epic',
      'Excludes weekends (holidays unavailable)',
    ]);
    await user.unhover(screen.getByTestId('epic-hero'));
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(screen.queryByTestId('epic-cfd-note')).toBeNull();
    expect(screen.queryByText(/Done stories collapse/)).toBeNull();
    await user.hover(screen.getByTestId('epic-hero'));
    await waitFor(() =>
      expect(sourceTexts()).toEqual([
        'Logged from Jira worklogs',
        ESTIMATE_FORMULA_NOTE,
        'Done stories collapse to their logged time.',
        'Excludes weekends (holidays unavailable)',
      ]),
    );
  });

  it('shows the source flag only while history is approximate', async () => {
    mockHistory.mockReturnValue(new Promise(() => {}));
    renderSection(sectionOf(stories));
    expect(screen.getByTestId('epic-source-flag')).toHaveAttribute('role', 'img');
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
    expect(reasons[0].previousElementSibling?.textContent).toMatch(/^Confidence/);
    expect(reasons[0].previousElementSibling).toHaveAttribute('data-slot', 'tooltip-row');
    const tip = document.querySelector('[data-slot="tooltip-content"]') as HTMLElement;
    expect(tip.querySelectorAll('[data-testid="confidence-meter"]')).toHaveLength(1);
    // The tile sub-line keeps the range and meter on one non-wrapping row.
    const meter = within(finish).getByTestId('confidence-meter');
    expect(meter.parentElement?.className).toContain('whitespace-nowrap');
  });

  it('Risks popover: keys are buttons that open the issue (click and Enter)', async () => {
    const onOpenIssue = vi.fn();
    const user = userEvent.setup();
    renderSection(
      sectionOf(
        [
          story('A-1', { cat: 'done', status: 'Done', sp: 2, assignee: 'Amy', res: daysAgo(1) }),
          story('A-4', { cat: 'new', status: 'To Do', sp: null, assignee: null }),
          story('A-5', { cat: 'new', status: 'To Do', sp: null, assignee: null }),
        ],
        { onOpenIssue },
      ),
    );
    expect(screen.queryByRole('button', { name: 'A-4' })).toBeNull();
    await user.click(screen.getAllByTestId('epic-stat-tile')[2]);
    await user.click((await screen.findAllByRole('button', { name: 'A-4' }))[0]);
    expect(onOpenIssue).toHaveBeenCalledWith('A-4');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'A-4' })).toBeNull());

    await user.click(screen.getAllByTestId('epic-stat-tile')[2]);
    const a5 = (await screen.findAllByRole('button', { name: 'A-5' }))[0];
    a5.focus();
    await user.keyboard('{Enter}');
    expect(onOpenIssue).toHaveBeenCalledWith('A-5');
  });

  it('Risks popover shows 5 keys and expands the rest with +N more; warnings come first', async () => {
    const user = userEvent.setup();
    const seven = Array.from({ length: 7 }, (_, i) =>
      story(`K-${i + 1}`, { cat: 'new', status: 'To Do', sp: 1, assignee: 'Amy' }),
    );
    renderSection(sectionOf(seven, { epicDueDate: daysAgo(3), onOpenIssue: vi.fn() }));
    await user.click(screen.getAllByTestId('epic-stat-tile')[2]);
    const popover = await screen.findByTestId('epic-risks-popover');
    const rows = within(popover).getAllByTestId('epic-risk-row');
    expect(rows[0].textContent).toContain('Overdue');
    const keyButtons = () => within(popover).getAllByRole('button', { name: /^K-\d+$/ });
    expect(keyButtons()).toHaveLength(5);
    const more = within(popover).getByRole('button', { name: '+2 more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(keyButtons()).toHaveLength(7);
    expect(within(popover).queryByRole('button', { name: /more$/ })).toBeNull();
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
    const tiles = screen.getAllByTestId('epic-stat-tile');
    await user.click(tiles[2]);
    await screen.findAllByText('N-4');
    expect(screen.queryByRole('button', { name: 'N-4' })).toBeNull();
  });
});
