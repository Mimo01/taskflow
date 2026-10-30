import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ReleaseStatusRow } from '../releaseBuckets';
import { ReleaseStatusRows } from './ReleaseStatusRows';

const rows: ReleaseStatusRow[] = [
  { name: 'Done', cat: 'done', count: 4 },
  { name: 'In Review', cat: 'indeterminate', count: 2 },
  { name: 'To Do', cat: 'new', count: 1 },
];

describe('ReleaseStatusRows', () => {
  it('renders one row per status with its count', () => {
    render(<ReleaseStatusRows rows={rows} state="ready" />);
    expect(screen.getByText('By status')).toBeInTheDocument();
    expect(screen.getByTestId('status-row-Done')).toHaveTextContent('4');
    expect(screen.getByTestId('status-row-In Review')).toHaveTextContent('2');
  });

  it('caps at 6 rows and says how many more', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `S${i}`,
      cat: 'new' as const,
      count: 1,
    }));
    render(<ReleaseStatusRows rows={many} state="ready" />);
    expect(screen.getByText('+2 more statuses')).toBeInTheDocument();
  });

  it('compact caps at 5 rows', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `S${i}`,
      cat: 'new' as const,
      count: 1,
    }));
    render(<ReleaseStatusRows rows={many} state="ready" compact />);
    expect(screen.getByText('+3 more statuses')).toBeInTheDocument();
  });

  // 94-REVIEW WR-08: rows sort done first, so several done statuses used to
  // fill every slot and push the actionable ones into an inert "+N more".
  it('compact: many done statuses collapse into one Done row so open work stays visible', () => {
    const doneHeavy: ReleaseStatusRow[] = [
      { name: 'Closed', cat: 'done', count: 5 },
      { name: 'Deployed', cat: 'done', count: 4 },
      { name: 'Done', cat: 'done', count: 3 },
      { name: 'Released', cat: 'done', count: 2 },
      { name: 'Resolved', cat: 'done', count: 1 },
      { name: 'In Progress', cat: 'indeterminate', count: 2 },
      { name: 'To Do', cat: 'new', count: 1 },
    ];
    render(<ReleaseStatusRows rows={doneHeavy} state="ready" compact />);
    expect(screen.getByTestId('status-row-In Progress')).toHaveTextContent('2');
    expect(screen.getByTestId('status-row-To Do')).toHaveTextContent('1');
    expect(screen.getByTestId('status-row-Done')).toHaveTextContent('15');
    expect(screen.queryByTestId('status-row-Closed')).toBeNull();
    expect(screen.queryByText(/more statuses/)).toBeNull();
  });

  it('the "+N more statuses" line lists the hidden statuses in a tooltip', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `S${i}`,
      cat: 'new' as const,
      count: 1,
    }));
    render(<ReleaseStatusRows rows={many} state="ready" compact />);
    const more = screen.getByTestId('status-more');
    expect(more).toHaveTextContent('+3 more statuses');
    await user.hover(more);
    expect((await screen.findAllByText('S5')).length).toBeGreaterThan(0);
  });

  it('bar width is the share of all issues, not of the largest status', () => {
    const five: ReleaseStatusRow[] = [4, 3, 4, 3, 4].map((count, i) => ({
      name: `S${i}`,
      cat: 'indeterminate' as const,
      count,
    }));
    render(<ReleaseStatusRows rows={five} state="ready" />);
    const fills = ['S0', 'S1'].map(
      (n) => screen.getByTestId(`status-row-${n}`).querySelector('[style*="width"]') as HTMLElement,
    );
    expect(parseFloat(fills[0].style.width)).toBeCloseTo(22.2, 0);
    expect(parseFloat(fills[1].style.width)).toBeCloseTo(16.7, 0);
  });
});
