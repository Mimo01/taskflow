import { fireEvent, render, screen, within } from '@testing-library/react';
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
