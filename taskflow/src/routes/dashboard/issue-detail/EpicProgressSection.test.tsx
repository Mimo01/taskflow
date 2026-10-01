import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTIMATE_FORMULA_NOTE } from '@/lib/epic-progress';
import { toLocalDateString } from '@/lib/local-date';
import { fetchEpicWorklogs, type JiraIssue } from '@/services/jira';
import { EpicProgressSection } from './EpicProgressSection';

vi.mock('@/services/jira', async (orig) => ({
  ...(await orig<typeof import('@/services/jira')>()),
  fetchEpicWorklogs: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/stores/auth.store', () => {
  const state = { jiraBaseUrl: 'https://jira.test', jiraConnected: true };
  const useAuthStore = (sel?: (s: typeof state) => unknown) => (sel ? sel(state) : state);
  return { useAuthStore };
});

const mockWorklogs = vi.mocked(fetchEpicWorklogs);
beforeEach(() => {
  mockWorklogs.mockReset();
  mockWorklogs.mockResolvedValue(new Map());
});

const SP = 'customfield_10016';

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
    render(
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
    const { container } = render(
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
    render(
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
    expect(screen.getAllByTestId('epic-stat-tile')).toHaveLength(4);
    expect(screen.getByText('Scope by story creation date')).toBeInTheDocument();
    expect(screen.getByText('In Review · 1 · 5 SP')).toBeInTheDocument();
  });

  it('toggles Count / SP and updates % done', () => {
    render(
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

  it('shows "Not enough data" for insufficient throughput', () => {
    render(
      <EpicProgressSection
        epicKey="E-1"
        stories={stories}
        storyPointsFieldKey={SP}
        epicCreated={daysAgo(12)}
      />,
    );
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
  });

  it('shows Complete and no projected date at 100%', () => {
    const done = [
      story('D-1', { cat: 'done', status: 'Done', created: daysAgo(3), res: daysAgo(1) }),
    ];
    render(
      <EpicProgressSection
        epicKey="E-1"
        stories={done}
        storyPointsFieldKey={SP}
        epicCreated={undefined}
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText('Not enough data')).not.toBeInTheDocument();
  });

  it('shows "No timeline data" when no story has a created date', () => {
    const undated = [story('U-1', { cat: 'new', status: 'To Do' })];
    render(
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
    render(
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
    const { container, unmount } = render(
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
    render(
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

  it('Time mode shows Estimated / Logged / Remaining / % logged tiles', () => {
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const tiles = screen.getAllByTestId('epic-stat-tile');
    expect(tiles).toHaveLength(4);
    const text = tiles.map((t) => t.textContent);
    expect(text[0]).toBe('Estimated3h');
    expect(text[1]).toBe('Logged1h 30m');
    // Remaining = open max(est - logged, 0) = 7200, NOT Jira's remaining (3600).
    expect(text[2]).toBe('Remaining2h');
    expect(text[3]).toBe('% logged50%');
  });

  it('Time mode assignee row shows logged / estimate', () => {
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    expect(within(row).getByText('1h 30m / 3h')).toBeInTheDocument();
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

  it('keyboard focus on a tile shows the raw counts', async () => {
    const user = userEvent.setup();
    renderTimed();
    await user.tab(); // Count
    await user.tab(); // SP
    await user.tab(); // Time
    await user.tab(); // first tile
    expect(await screen.findByText('1 of 2 done')).toBeInTheDocument();
  });

  it('hovering the assignee bar shows the breakdown in the active metric', async () => {
    const user = userEvent.setup();
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    expect(within(row).getByText('Amy')).toBeInTheDocument();
    await user.hover(within(row).getByTestId('epic-assignee-bar'));
    expect(await screen.findByText('done: 1h')).toBeInTheDocument();
    expect(screen.getByText('to do: 2h')).toBeInTheDocument();
    expect(screen.getByText('1h 30m logged of 3h')).toBeInTheDocument();
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
    render(
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
    const { container } = render(
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

  it('Count and SP never fetch worklogs', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    expect(mockWorklogs).not.toHaveBeenCalled();
  });

  it('Time mode shows a loading skeleton then the chart, fetching with story keys', async () => {
    let resolve: (m: Map<string, never[]>) => void = () => {};
    mockWorklogs.mockReturnValue(new Promise((r) => (resolve = r)));
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(await screen.findByTestId('epic-time-burnup-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('epic-stat-tile')).toHaveLength(4);
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
    expect(screen.getAllByTestId('epic-stat-tile')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockWorklogs).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('epic-time-burnup')).toBeInTheDocument();
  });

  it('Estimated tile uses the subtask-sum formula and its tooltip explains it', async () => {
    const user = userEvent.setup();
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const tiles = screen.getAllByTestId('epic-stat-tile');
    // T-1: no subtask estimates -> own 1h; T-2: subtasks 3h - 1h own... agg 3h, own 1h -> 2h. Total 3h.
    expect(tiles[0].textContent).toBe('Estimated3h');
    await user.hover(tiles[0]);
    expect(await screen.findByText(ESTIMATE_FORMULA_NOTE)).toBeInTheDocument();
  });

  it('Remaining tile tooltip says it replaces the Jira remaining estimate', async () => {
    const user = userEvent.setup();
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    await user.hover(screen.getAllByTestId('epic-stat-tile')[2]);
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
