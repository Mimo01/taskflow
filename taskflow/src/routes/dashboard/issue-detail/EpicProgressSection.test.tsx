import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { toLocalDateString } from '@/lib/local-date';
import type { JiraIssue } from '@/services/jira';
import { EpicProgressSection } from './EpicProgressSection';

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
      <EpicProgressSection stories={undefined} storyPointsFieldKey={SP} epicCreated={undefined} />,
    );
    expect(screen.getByTestId('epic-progress-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('renders nothing for an epic with no stories', () => {
    const { container } = render(
      <EpicProgressSection stories={[]} storyPointsFieldKey={SP} epicCreated={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all panels', () => {
    render(
      <EpicProgressSection stories={stories} storyPointsFieldKey={SP} epicCreated={daysAgo(12)} />,
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
      <EpicProgressSection stories={stories} storyPointsFieldKey={SP} epicCreated={daysAgo(12)} />,
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
      <EpicProgressSection stories={stories} storyPointsFieldKey={SP} epicCreated={daysAgo(12)} />,
    );
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
  });

  it('shows Complete and no projected date at 100%', () => {
    const done = [
      story('D-1', { cat: 'done', status: 'Done', created: daysAgo(3), res: daysAgo(1) }),
    ];
    render(<EpicProgressSection stories={done} storyPointsFieldKey={SP} epicCreated={undefined} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText('Not enough data')).not.toBeInTheDocument();
  });

  it('shows "No timeline data" when no story has a created date', () => {
    const undated = [story('U-1', { cat: 'new', status: 'To Do' })];
    render(
      <EpicProgressSection stories={undated} storyPointsFieldKey={SP} epicCreated={undefined} />,
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
      rem: 7200,
    }),
  ];

  function renderTimed(list = timed) {
    render(<EpicProgressSection stories={list} storyPointsFieldKey={SP} epicCreated={undefined} />);
  }

  it('wraps the section and skeleton in a Card', () => {
    const { container, unmount } = render(
      <EpicProgressSection stories={timed} storyPointsFieldKey={SP} epicCreated={undefined} />,
    );
    const region = screen.getByRole('region', { name: 'Epic progress' });
    expect(region.querySelector('[data-slot="card"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="card"]')).not.toBeNull();
    unmount();
    render(
      <EpicProgressSection stories={undefined} storyPointsFieldKey={SP} epicCreated={undefined} />,
    );
    expect(screen.getByTestId('epic-progress-skeleton')).toHaveAttribute('data-slot', 'card');
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

  it('hovering a status segment shows name, counts and percent of total', async () => {
    const user = userEvent.setup();
    renderTimed();
    const seg = within(screen.getByTestId('epic-status-bar')).getAllByTestId(
      'epic-status-segment',
    )[0];
    await user.hover(seg);
    expect(await screen.findByText('1 items · 0 SP · 1h est')).toBeInTheDocument();
    expect(screen.getByText('50% of total')).toBeInTheDocument();
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

  it('hovering an assignee name shows the breakdown in the active metric', async () => {
    const user = userEvent.setup();
    renderTimed();
    fireEvent.click(screen.getByRole('button', { name: 'Time' }));
    const row = screen.getByTestId('epic-assignee-row');
    await user.hover(within(row).getByRole('button', { name: 'Amy' }));
    expect(await screen.findByText('done: 1h')).toBeInTheDocument();
    expect(screen.getByText('to do: 2h')).toBeInTheDocument();
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
      <EpicProgressSection stories={mixed} storyPointsFieldKey={SP} epicCreated={undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'SP' }));
    expect(screen.getAllByTestId('epic-status-segment')).toHaveLength(1);
    expect(screen.getByText(/Backlog ·/)).toBeTruthy();
  });

  it('renders tiles without block <p> inside the button and gives each assignee row one tab stop', () => {
    const { container } = render(
      <EpicProgressSection stories={mixed} storyPointsFieldKey={SP} epicCreated={undefined} />,
    );
    expect(container.querySelector('[data-testid="epic-stat-tile"] p')).toBeNull();
    const row = screen.getAllByTestId('epic-assignee-row')[0];
    expect(row.querySelectorAll('button')).toHaveLength(1);
  });
});
