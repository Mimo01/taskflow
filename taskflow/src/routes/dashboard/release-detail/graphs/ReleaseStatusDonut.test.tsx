import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReleaseStatusRow } from '../releaseBuckets';
import { ReleaseStatusDonut } from './ReleaseStatusDonut';

const rows: ReleaseStatusRow[] = [
  { name: 'Done', cat: 'done', count: 3, filterValues: ['Done'] },
  { name: 'In Progress', cat: 'indeterminate', count: 2, filterValues: ['In Progress'] },
  { name: 'To Do', cat: 'new', count: 5, filterValues: ['To Do'] },
];

describe('ReleaseStatusDonut', () => {
  it('renders the total, the issues caption and an aria-label', () => {
    render(<ReleaseStatusDonut rows={rows} state="ready" />);
    expect(screen.getByText('By status')).toBeInTheDocument();
    expect(screen.getByTestId('release-graph-status')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('issues')).toBeInTheDocument();
    expect(screen.getByTestId('release-status-donut')).toHaveAttribute(
      'aria-label',
      'Issues by status: 3 done, 2 in progress, 5 to do',
    );
  });

  it('omits empty categories from the aria-label', () => {
    render(<ReleaseStatusDonut rows={[rows[0]]} state="ready" />);
    expect(screen.getByTestId('release-status-donut')).toHaveAttribute(
      'aria-label',
      'Issues by status: 3 done',
    );
  });

  it('shows a skeleton while loading', () => {
    render(<ReleaseStatusDonut rows={[]} state="loading" />);
    expect(screen.getByTestId('release-status-donut-skeleton')).toBeInTheDocument();
  });

  it('shows the empty copy', () => {
    render(<ReleaseStatusDonut rows={[]} state="empty" />);
    expect(screen.getByText('No issues')).toBeInTheDocument();
  });
});
