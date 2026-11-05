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
    expect(screen.getByText('No merge requests yet')).toBeInTheDocument();
  });

  it('renders the donut with an aria-label omitting zero states', () => {
    render(<ReleaseMrDonut counts={counts} state="ready" />);
    expect(screen.getByTestId('release-mr-donut')).toHaveAttribute(
      'aria-label',
      'Merge requests: 2 merged, 1 open, 1 draft',
    );
    expect(screen.getByText('Merge requests')).toBeInTheDocument();
  });

  it('shows total and MRs in the centre with no legend', () => {
    render(<ReleaseMrDonut counts={counts} state="ready" />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('MRs')).toBeInTheDocument();
    expect(screen.queryByTestId('release-mr-legend')).toBeNull();
    expect(screen.queryByText(/^merged$/i)).toBeNull();
  });

  it('shows task coverage and MRs not on a task under the ring', () => {
    render(
      <ReleaseMrDonut
        counts={counts}
        state="ready"
        coverage={{ tasksWithMr: 17, tasks: 21, uncoveredMrs: 3 }}
      />,
    );
    expect(screen.getByTestId('release-mr-coverage')).toHaveTextContent(
      '17 of 21 tasks have an MR',
    );
    expect(screen.getByTestId('release-mr-uncovered')).toHaveTextContent('3 MRs not on a task');
  });

  it('singular wording, no warning line when every MR is on a task', () => {
    render(
      <ReleaseMrDonut
        counts={counts}
        state="ready"
        coverage={{ tasksWithMr: 1, tasks: 1, uncoveredMrs: 0 }}
      />,
    );
    expect(screen.getByTestId('release-mr-coverage')).toHaveTextContent('1 of 1 task has an MR');
    expect(screen.queryByTestId('release-mr-uncovered')).toBeNull();
  });

  it('singular MR warning', () => {
    render(
      <ReleaseMrDonut
        counts={counts}
        state="ready"
        coverage={{ tasksWithMr: 0, tasks: 2, uncoveredMrs: 1 }}
      />,
    );
    expect(screen.getByTestId('release-mr-uncovered')).toHaveTextContent('1 MR not on a task');
  });
});
