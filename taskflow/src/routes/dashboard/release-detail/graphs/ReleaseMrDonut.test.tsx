import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReleaseMrDonut } from './ReleaseMrDonut';

const counts = { merged: 2, open: 1, draft: 1, closed: 0 };

describe('ReleaseMrDonut', () => {
  it('shows a skeleton while loading', () => {
    render(<ReleaseMrDonut counts={counts} state="loading" />);
    expect(screen.getByTestId('release-graph-mrs-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('release-mr-donut-skeleton')).toBeInTheDocument();
  });

  it('shows the empty copy', () => {
    render(<ReleaseMrDonut counts={{ merged: 0, open: 0, draft: 0, closed: 0 }} state="empty" />);
    expect(screen.getByText('No MRs in this milestone')).toBeInTheDocument();
  });

  it('renders the donut with an aria-label omitting zero states', () => {
    render(<ReleaseMrDonut counts={counts} state="ready" />);
    expect(screen.getByTestId('release-mr-donut')).toHaveAttribute(
      'aria-label',
      'Merge requests: 2 merged, 1 open, 1 draft',
    );
    expect(screen.getByText('Merge requests')).toBeInTheDocument();
  });

  it('shows total and MRs in the centre and non-zero values beside it', () => {
    render(<ReleaseMrDonut counts={counts} state="ready" />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('MRs')).toBeInTheDocument();
    expect(screen.getByText('merged')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.queryByText('closed')).toBeNull();
  });
});
