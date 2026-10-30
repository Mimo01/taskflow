import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ReleaseTypeRow } from '../releaseBuckets';
import { GRAPH_ERROR_TEXT } from './GraphSlot';
import { ReleaseTypeWaffle } from './ReleaseTypeWaffle';

const rows: ReleaseTypeRow[] = [
  {
    typeName: 'Bug',
    breakdown: { done: 2, indeterminate: 1, new: 3 },
    total: 6,
    done: 2,
    sp: 5,
  },
];

describe('ReleaseTypeWaffle', () => {
  it('renders skeleton rows when loading', () => {
    render(<ReleaseTypeWaffle rows={[]} state="loading" showStoryPoints={false} />);
    expect(screen.getAllByTestId('waffle-skeleton-row')).toHaveLength(3);
  });

  it('renders error and empty states', () => {
    const { rerender } = render(
      <ReleaseTypeWaffle rows={[]} state="error" showStoryPoints={false} />,
    );
    expect(screen.getByText(GRAPH_ERROR_TEXT)).toBeInTheDocument();
    rerender(<ReleaseTypeWaffle rows={[]} state="empty" showStoryPoints={false} />);
    expect(screen.getByText('No issues')).toBeInTheDocument();
  });

  it('renders one cell per issue ordered done, in progress, to do', () => {
    render(<ReleaseTypeWaffle rows={rows} state="ready" showStoryPoints={false} />);
    expect(screen.getByText('By type')).toBeInTheDocument();
    expect(screen.getByTestId('type-row-Bug')).toHaveTextContent('2/6');
    const cells = screen.getAllByTestId('waffle-cell');
    expect(cells.map((c) => c.getAttribute('data-cat'))).toEqual([
      'done',
      'done',
      'indeterminate',
      'new',
      'new',
      'new',
    ]);
    expect(cells[0].className).not.toBe(cells[5].className);
  });

  it('renders the type icon muted', () => {
    render(<ReleaseTypeWaffle rows={rows} state="ready" showStoryPoints={false} />);
    const icon = screen.getByTestId('type-row-Bug').querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('text-muted-foreground');
    expect(icon?.getAttribute('class')).not.toContain('text-red-500');
  });

  it('tooltip shows Story points only when enabled', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ReleaseTypeWaffle rows={rows} state="ready" showStoryPoints={false} />,
    );
    await user.hover(screen.getByTestId('type-row-Bug'));
    expect((await screen.findAllByText('To Do')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Story points')).toBeNull();
    unmount();
    render(<ReleaseTypeWaffle rows={rows} state="ready" showStoryPoints />);
    await user.hover(screen.getByTestId('type-row-Bug'));
    expect((await screen.findAllByText('Story points')).length).toBeGreaterThan(0);
  });
});
