import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseAssigneeRow } from '../releaseBuckets';
import { GRAPH_ERROR_TEXT } from './GraphSlot';
import { ReleaseAssigneeRows } from './ReleaseAssigneeRows';

vi.mock('@/components/ui/cached-avatar', () => ({
  CachedAvatar: ({ name, size }: { name: string; size: number }) => (
    <div data-testid="cached-avatar" data-size={size} data-name={name} />
  ),
}));

const rows: ReleaseAssigneeRow[] = [
  {
    id: 'a',
    name: 'Dev A',
    avatarUrl: 'http://x/a.png',
    unassigned: false,
    breakdown: { done: 2, indeterminate: 1, new: 1 },
    total: 4,
    done: 2,
    sp: 8,
  },
  {
    id: 'unassigned',
    name: 'Unassigned',
    avatarUrl: null,
    unassigned: true,
    breakdown: { done: 0, indeterminate: 0, new: 2 },
    total: 2,
    done: 0,
    sp: 3,
  },
];

describe('ReleaseAssigneeRows', () => {
  it('renders skeleton rows when loading', () => {
    render(<ReleaseAssigneeRows rows={[]} state="loading" showStoryPoints={false} />);
    expect(screen.getAllByTestId('assignee-skeleton-row')).toHaveLength(5);
  });

  it('renders error copy and empty label', () => {
    const { rerender } = render(
      <ReleaseAssigneeRows rows={[]} state="error" showStoryPoints={false} />,
    );
    expect(screen.getByText(GRAPH_ERROR_TEXT)).toBeInTheDocument();
    rerender(<ReleaseAssigneeRows rows={[]} state="empty" showStoryPoints={false} />);
    expect(screen.getByText('No issues')).toBeInTheDocument();
  });

  it('renders rows with done/total, heading, a bar each and no interactivity', () => {
    render(<ReleaseAssigneeRows rows={rows} state="ready" showStoryPoints={false} />);
    expect(screen.getByText('By assignee')).toBeInTheDocument();
    const a = screen.getByTestId('assignee-row-a');
    expect(a).toHaveTextContent('2/4');
    expect(a).not.toHaveAttribute('role', 'button');
    expect(screen.getAllByTestId('release-issues-bar')).toHaveLength(2);
    expect(screen.getByTestId('cached-avatar')).toHaveAttribute('data-size', '22');
  });

  it('renders Unassigned with a dashed avatar, no image and a muted name', () => {
    render(<ReleaseAssigneeRows rows={rows} state="ready" showStoryPoints={false} />);
    const row = screen.getByTestId('assignee-row-unassigned');
    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('[data-testid="cached-avatar"]')).toBeNull();
    expect(row.querySelector('.border-dashed')).not.toBeNull();
    expect(screen.getByText('Unassigned').className).toContain('text-muted-foreground');
  });

  it('tooltip omits Story points unless enabled, then shows it', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ReleaseAssigneeRows rows={rows} state="ready" showStoryPoints={false} />,
    );
    await user.hover(screen.getByTestId('assignee-row-a'));
    expect((await screen.findAllByText('In Progress')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Story points')).toBeNull();
    unmount();

    render(<ReleaseAssigneeRows rows={rows} state="ready" showStoryPoints />);
    await user.hover(screen.getByTestId('assignee-row-a'));
    expect((await screen.findAllByText('Story points')).length).toBeGreaterThan(0);
  });

  it('compact: shows at most 5 rows plus a "+K more" with a tooltip of the rest (no scroll)', async () => {
    const many: ReleaseAssigneeRow[] = Array.from({ length: 9 }, (_, i) => ({
      id: `p${i}`,
      name: `Person ${i}`,
      avatarUrl: null,
      unassigned: false,
      breakdown: { done: 1, indeterminate: 0, new: 1 },
      total: 2,
      done: 1,
      sp: 0,
    }));
    const user = userEvent.setup();
    const { container } = render(
      <ReleaseAssigneeRows rows={many} state="ready" showStoryPoints={false} compact />,
    );
    expect(container.querySelectorAll('[data-testid^="assignee-row-"]')).toHaveLength(5);
    const more = screen.getByTestId('assignee-more');
    expect(more).toHaveTextContent('+4 more');
    expect(container.innerHTML).not.toContain('overflow-y');
    await user.hover(more);
    expect((await screen.findAllByText('Person 5')).length).toBeGreaterThan(0);
  });

  it('non-compact shows every row and no "+K more"', () => {
    render(<ReleaseAssigneeRows rows={rows} state="ready" showStoryPoints={false} />);
    expect(screen.queryByTestId('assignee-more')).toBeNull();
  });
});
