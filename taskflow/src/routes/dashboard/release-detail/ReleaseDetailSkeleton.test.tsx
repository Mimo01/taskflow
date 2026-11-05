import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ASSIGNEE_SKELETON_ROWS, WAFFLE_SKELETON_ROWS } from './graphs/GraphSlot';
import { ReleaseDetailSkeleton } from './ReleaseDetailSkeleton';

describe('ReleaseDetailSkeleton', () => {
  it('keeps its root testid and mirrors header, done bar, graphs and table', () => {
    const { container } = render(<ReleaseDetailSkeleton />);
    expect(screen.getByTestId('release-detail-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.border-b.px-6.pb-4')).not.toBeNull();
    // no hairline above the done bar (261103-bfx UAT)
    expect(container.querySelector('.border-y')).toBeNull();
    expect(container.querySelector('.border-t.px-6.pt-4')).toBeNull();
    expect(screen.getByTestId('skeleton-graphs')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton-table-row').length).toBeGreaterThan(0);
  });

  it('graphs mirror the grid order: progress, status over type, assignees, MR ring last', () => {
    render(<ReleaseDetailSkeleton />);
    const graphs = screen.getByTestId('skeleton-graphs');
    expect(graphs.children).toHaveLength(4);
    const lists = screen.getByTestId('skeleton-lists');
    expect(graphs.children[1]).toBe(lists);
    // two slots (status, type), each a title + rows: 3 status rows, then type rows
    expect(lists.children).toHaveLength(2);
    expect(lists.children[0].children[1].children).toHaveLength(3);
    expect(lists.children[1].children[1].children).toHaveLength(WAFFLE_SKELETON_ROWS);
    expect(graphs.children[2]).toBe(screen.getByTestId('skeleton-assignees'));
    expect(screen.getByTestId('skeleton-assignees').children[1].children).toHaveLength(
      ASSIGNEE_SKELETON_ROWS,
    );
    expect(graphs.children[3]).toContainElement(screen.getByTestId('skeleton-donut'));
  });

  it('MR slot is ring-only: title and ring, no legend', () => {
    render(<ReleaseDetailSkeleton />);
    const ringBox = screen.getByTestId('skeleton-donut').parentElement;
    expect(ringBox?.children).toHaveLength(1);
  });

  it('has no fixed sidebar width and no resizer', () => {
    const { container } = render(<ReleaseDetailSkeleton />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/288|256|w-72/);
    expect(container.querySelector('[role="separator"]')).toBeNull();
  });

  // 94-REVIEW WR-05: the skeleton renders in place of the @container/page
  // scroll wrapper, so it must be that container itself for its /page queries
  // to match, and it must mirror the real layout: header with property strip,
  // then the band (>= 1180px) or the 2x2 grid — no side column.
  it('is its own @container/page and mirrors the band / 2x2 graph layout', () => {
    render(<ReleaseDetailSkeleton />);
    expect(screen.getByTestId('release-detail-skeleton').className).toContain('@container/page');
    expect(screen.queryByTestId('skeleton-side')).toBeNull();
    expect(screen.queryByTestId('skeleton-quad')).toBeNull();
    const graphs = screen.getByTestId('skeleton-graphs').className;
    expect(graphs).toContain('grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]');
    expect(graphs).toContain(
      '@min-[1180px]/page:grid-cols-[minmax(200px,1fr)_minmax(300px,1.1fr)_minmax(270px,1.1fr)_minmax(190px,0.8fr)]',
    );
    expect(graphs).toContain('@max-[640px]/page:grid-cols-[minmax(0,1fr)_auto]');
    expect(graphs).toContain('@max-[440px]/page:grid-cols-1');
    expect(screen.getByTestId('skeleton-property-strip')).toBeInTheDocument();
  });
});
