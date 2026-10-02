const mockStatuses = vi.hoisted(() => ({
  data: undefined as unknown,
}));

vi.mock('./useEpicProgressQueries', () => ({
  useJiraStatusList: () => ({ data: mockStatuses.data }),
}));

vi.mock('../IssueDetailContent', () => ({
  relativeTime: () => '2m ago',
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { statusPillClass } from '@/lib/statusStyles';
import type { ChangelogHistory } from '@/services/jira';
import { ChangelogEntry } from './ChangelogEntry';

type Item = Record<string, string | null>;

function hist(id: string, items: Item[], created = '2026-01-01T10:00:00.000Z'): ChangelogHistory {
  return {
    id,
    created,
    author: { displayName: 'Alice', name: 'alice' },
    items,
  } as never;
}

beforeEach(() => {
  mockStatuses.data = [
    { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
    { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
  ];
});

describe('ChangelogEntry', () => {
  it('renders empty old side as ∅ and strikes through old values', () => {
    render(
      <ChangelogEntry
        histories={[hist('1', [{ field: 'assignee', fromString: null, toString: 'Bob' }])]}
      />,
    );
    expect(screen.getByText('∅')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    render(
      <ChangelogEntry
        histories={[hist('2', [{ field: 'priority', fromString: 'Low', toString: 'High' }])]}
      />,
    );
    expect(screen.getByText('Low').className).toContain('line-through');
  });

  it('renders status pills inside a flex parent', () => {
    render(
      <ChangelogEntry
        histories={[
          hist('1', [
            { field: 'status', from: '1', to: '3', fromString: 'To Do', toString: 'In Progress' },
          ]),
        ]}
      />,
    );
    const to = screen.getByText('In Progress');
    expect(to.className).toContain(statusPillClass('indeterminate'));
    expect(to.parentElement?.className).toContain('flex');
    const from = screen.getByText('To Do');
    expect(from.className).toContain(statusPillClass('new'));
    expect(from.parentElement?.className).toContain('flex');
  });

  it('falls back to the gray pill when the status list is unknown', () => {
    mockStatuses.data = undefined;
    render(
      <ChangelogEntry
        histories={[hist('1', [{ field: 'status', fromString: 'A', toString: 'B' }])]}
      />,
    );
    expect(screen.getByText('B').className).toContain(statusPillClass(undefined));
  });

  it('collapses long text behind a toggle and expands to Before/After', () => {
    render(
      <ChangelogEntry
        histories={[
          hist('1', [
            {
              field: 'description',
              fromString: 'Login fails when token expires',
              toString: 'Login fails when session expires',
            },
          ]),
        ]}
      />,
    );
    const btn = screen.getByRole('button', { name: /Show changes \(\+1 \/ −1 words\)/ });
    expect(screen.queryByText('Before')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText('token').className).toContain('red');
    expect(screen.getByText('session').className).toContain('green');
  });

  it('shows a note instead of a toggle for whitespace-only changes', () => {
    render(
      <ChangelogEntry
        histories={[hist('1', [{ field: 'description', fromString: 'a b', toString: 'a  b' }])]}
      />,
    );
    expect(screen.getByText('Whitespace / formatting only')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders +/- tokens for multi-value fields', () => {
    render(
      <ChangelogEntry
        histories={[hist('1', [{ field: 'labels', fromString: 'a b', toString: 'b c' }])]}
      />,
    );
    expect(screen.getByText('+c')).toBeInTheDocument();
    expect(screen.getByText('−a')).toBeInTheDocument();
  });

  it('renders the author once for a grouped burst', () => {
    render(
      <ChangelogEntry
        histories={[
          hist('1', [{ field: 'priority', fromString: 'A', toString: 'B' }]),
          hist('2', [{ field: 'assignee', fromString: null, toString: 'Bob' }]),
        ]}
      />,
    );
    expect(screen.getAllByText('Alice')).toHaveLength(1);
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
  });

  it('does not throw on unknown shapes', () => {
    render(
      <ChangelogEntry
        histories={[
          hist('1', [
            { field: 'Weird Field', fromString: null, toString: null },
            { field: 'Other', fromString: '42', toString: '43' },
          ]),
        ]}
      />,
    );
    expect(screen.getByText('Weird Field')).toBeInTheDocument();
    expect(screen.getByText('43')).toBeInTheDocument();
  });

  it('shows the latest edit time regardless of sort order', () => {
    const older = hist(
      '1',
      [{ field: 'priority', fromString: 'A', toString: 'B' }],
      '2026-01-01T10:00:00.000Z',
    );
    const newer = hist(
      '2',
      [{ field: 'assignee', fromString: null, toString: 'Bob' }],
      '2026-01-01T10:03:00.000Z',
    );
    const expected = new Date(newer.created).toLocaleString();
    for (const order of [
      [older, newer],
      [newer, older],
    ]) {
      const { unmount } = render(<ChangelogEntry histories={order} />);
      expect(screen.getByText('2m ago')).toHaveAttribute('title', expected);
      unmount();
    }
  });

  it('renders Unknown instead of crashing when the author is missing', () => {
    const anon = {
      id: '9',
      created: '2026-01-01T10:00:00.000Z',
      items: [{ field: 'priority', fromString: 'A', toString: 'B' }],
    } as never;
    render(<ChangelogEntry histories={[anon]} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
