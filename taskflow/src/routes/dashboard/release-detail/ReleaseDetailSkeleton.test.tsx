import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ASSIGNEE_SKELETON_ROWS, WAFFLE_SKELETON_ROWS } from './graphs/GraphSlot';
import { ReleaseDetailSkeleton } from './ReleaseDetailSkeleton';

describe('ReleaseDetailSkeleton', () => {
  it('keeps its root testid and mirrors header, done bar, graphs and table', () => {
    const { container } = render(<ReleaseDetailSkeleton />);
    expect(screen.getByTestId('release-detail-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.border-t.px-6.pt-4')).not.toBeNull();
    expect(screen.getByTestId('skeleton-graphs')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton-table-row').length).toBeGreaterThan(0);
  });

  it('graphs have burnup, donut, assignee rows and waffle rows', () => {
    render(<ReleaseDetailSkeleton />);
    const graphs = screen.getByTestId('skeleton-graphs');
    expect(graphs.children).toHaveLength(4);
    expect(within(graphs).getByTestId('skeleton-donut')).toBeInTheDocument();
    expect(graphs.children[2].children).toHaveLength(ASSIGNEE_SKELETON_ROWS);
    expect(graphs.children[3].children).toHaveLength(WAFFLE_SKELETON_ROWS);
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
      '@min-[1180px]/page:grid-cols-[minmax(260px,1.5fr)_auto_minmax(210px,1.1fr)_minmax(230px,1fr)]',
    );
    expect(screen.getByTestId('skeleton-property-strip')).toBeInTheDocument();
  });
});
