import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
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

  const big = (total: number, done: number, name: string): ReleaseTypeRow => ({
    typeName: name,
    breakdown: { done, indeterminate: 0, new: total - done },
    total,
    done,
    sp: 0,
  });

  it('one square per issue for an 18/18 + 4/4 case, no grouping note', () => {
    render(
      <ReleaseTypeWaffle
        rows={[big(18, 18, 'Story'), big(4, 4, 'Bug')]}
        state="ready"
        showStoryPoints={false}
      />,
    );
    const cellsOf = (n: string) =>
      screen.getByTestId(`type-row-${n}`).querySelectorAll('[data-testid="waffle-cell"]');
    expect(cellsOf('Story')).toHaveLength(18);
    expect(cellsOf('Bug')).toHaveLength(4);
    expect(screen.queryByText(/1 block =/)).toBeNull();
    expect(screen.getByTestId('type-row-Story')).toHaveTextContent('18/18');
  });

  describe('at a measured cell width', () => {
    const real = Element.prototype.getBoundingClientRect;
    afterEach(() => {
      Element.prototype.getBoundingClientRect = real;
    });
    const at = (w: number) => {
      Element.prototype.getBoundingClientRect = () => ({ width: w }) as DOMRect;
    };
    const colsOf = (n: string) => {
      const grid = screen.getByTestId(`type-row-${n}`).querySelector('.grid') as HTMLElement;
      return { grid, cols: grid.style.gridTemplateColumns.match(/repeat\((\d+)/)?.[1] };
    };

    it('40 issues at ~347px: every issue is a square, wrapped inside the same column grid for all rows', () => {
      at(347);
      render(
        <ReleaseTypeWaffle
          rows={[big(40, 10, 'Story'), big(4, 1, 'Bug')]}
          state="ready"
          showStoryPoints={false}
        />,
      );
      const story = colsOf('Story');
      const bug = colsOf('Bug');
      expect(story.grid.querySelectorAll('[data-testid="waffle-cell"]')).toHaveLength(40);
      expect(bug.grid.querySelectorAll('[data-testid="waffle-cell"]')).toHaveLength(4);
      expect(Number(story.cols)).toBeLessThan(40);
      expect(story.cols).toBe(bug.cols);
    });

    it('narrow cell (200px) still renders all squares, one column at minimum', () => {
      at(200);
      render(
        <ReleaseTypeWaffle rows={[big(9, 0, 'Story')]} state="ready" showStoryPoints={false} />,
      );
      const { grid, cols } = colsOf('Story');
      expect(grid.querySelectorAll('[data-testid="waffle-cell"]')).toHaveLength(9);
      expect(Number(cols)).toBeGreaterThanOrEqual(1);
    });
  });

  it('compact: 12px squares, at most 5 types with a "+K more types" line', () => {
    const many = Array.from({ length: 7 }, (_, i) => big(2, 1, `Type${i}`));
    render(<ReleaseTypeWaffle rows={many} state="ready" showStoryPoints={false} compact />);
    expect(screen.getAllByTestId(/^type-row-/)).toHaveLength(5);
    expect(screen.getByTestId('waffle-more')).toHaveTextContent('+2 more types');
    const cell = screen.getAllByTestId('waffle-cell')[0] as HTMLElement;
    expect(cell.style.width).toBe('12px');
  });
});
