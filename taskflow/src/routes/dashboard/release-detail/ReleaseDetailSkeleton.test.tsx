import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ASSIGNEE_SKELETON_ROWS, WAFFLE_SKELETON_ROWS } from './graphs/GraphSlot';
import { ReleaseDetailSkeleton } from './ReleaseDetailSkeleton';

describe('ReleaseDetailSkeleton', () => {
  it('keeps its root testid and mirrors header, done bar, quad, side and table', () => {
    const { container } = render(<ReleaseDetailSkeleton />);
    expect(screen.getByTestId('release-detail-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.border-t.px-6.pt-4')).not.toBeNull();
    expect(screen.getByTestId('skeleton-side')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton-table-row').length).toBeGreaterThan(0);
  });

  it('quad has burnup, donut, assignee rows and waffle rows', () => {
    render(<ReleaseDetailSkeleton />);
    const quad = screen.getByTestId('skeleton-quad');
    expect(quad.children).toHaveLength(4);
    expect(within(quad).getByTestId('skeleton-donut')).toBeInTheDocument();
    expect(quad.children[2].children).toHaveLength(ASSIGNEE_SKELETON_ROWS);
    expect(quad.children[3].children).toHaveLength(WAFFLE_SKELETON_ROWS);
  });

  it('has no fixed sidebar width and no resizer', () => {
    const { container } = render(<ReleaseDetailSkeleton />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/288|256|w-72/);
    expect(container.querySelector('[role="separator"]')).toBeNull();
  });
});
