import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReleaseIssueGraph } from './ReleaseIssueGraph';
import { ReleaseStatusPill } from './ReleaseStatusPill';

const data = { done: 3, indeterminate: 1, new: 2 };

describe('ReleaseStatusPill', () => {
  it('renders the label in a pill whose parent is flex', () => {
    render(<ReleaseStatusPill pill={{ tone: 'red', label: 'Overdue' }} />);
    const pill = screen.getByTestId('release-status-pill');
    expect(pill).toHaveTextContent('Overdue');
    expect(pill.parentElement).toHaveClass('flex');
    expect(pill.className).toContain('min-w-[5.5rem]');
    expect(pill.className).toContain('bg-red-500/15');
  });
});

describe('ReleaseIssueGraph', () => {
  it('shows segments, the done / total figure and accessible name', () => {
    render(<ReleaseIssueGraph breakdown={data} loading={false} error={false} />);
    expect(screen.getByRole('img', { name: '3 of 6 issues done' })).toBeInTheDocument();
    expect(screen.getByText('3 / 6 done')).toBeInTheDocument();
    const done = screen.getByTestId('release-segment-done');
    const prog = screen.getByTestId('release-segment-indeterminate');
    const todo = screen.getByTestId('release-segment-new');
    expect(done.style.width).toBe('50%');
    expect(Number.parseFloat(prog.style.width)).toBeCloseTo(16.67, 1);
    expect(Number.parseFloat(todo.style.width)).toBeCloseTo(33.33, 1);
    expect(done.compareDocumentPosition(prog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(prog.compareDocumentPosition(todo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('zero issues renders No issues, never 0/0', () => {
    render(
      <ReleaseIssueGraph
        breakdown={{ done: 0, indeterminate: 0, new: 0 }}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText('No issues')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'No issues' })).toBeInTheDocument();
    expect(screen.queryByText('0/0')).toBeNull();
  });

  it('loading shows a skeleton and no empty text', () => {
    render(<ReleaseIssueGraph breakdown={undefined} loading error={false} />);
    expect(screen.getByTestId('release-graph-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('No issues')).toBeNull();
  });

  it('error shows a muted dash with a failure tooltip and no skeleton', () => {
    render(<ReleaseIssueGraph breakdown={undefined} loading={false} error />);
    const dash = screen.getByTestId('release-issues-error');
    expect(dash).toHaveTextContent('–');
    expect(dash).toHaveAttribute('title', "Couldn't load issue counts");
    expect(dash.className).toContain('text-muted-foreground');
    expect(screen.queryByTestId('release-graph-skeleton')).toBeNull();
  });

  it('idle (not loading, no error) shows the plain dash without a failure tooltip', () => {
    render(<ReleaseIssueGraph breakdown={undefined} loading={false} error={false} />);
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.queryByTestId('release-issues-error')).toBeNull();
  });

  it('fullWidth drops the max-w-xl cap; default keeps it', () => {
    const { unmount } = render(
      <ReleaseIssueGraph breakdown={data} loading={false} error={false} />,
    );
    expect(screen.getByTestId('release-graph').className).toContain('max-w-xl');
    unmount();
    render(<ReleaseIssueGraph breakdown={data} loading={false} error={false} fullWidth />);
    expect(screen.getByTestId('release-graph').className).not.toContain('max-w-xl');
  });

  it('tooltip carries a 4th Statuses row only when statusNames is given', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ReleaseIssueGraph
        breakdown={data}
        loading={false}
        error={false}
        statusNames="In Review 3"
      />,
    );
    await user.hover(screen.getByRole('img', { name: '3 of 6 issues done' }));
    expect(await screen.findByText('Statuses')).toBeInTheDocument();
    expect(screen.getByText('In Review 3')).toBeInTheDocument();
    unmount();
    render(<ReleaseIssueGraph breakdown={data} loading={false} error={false} statusNames={null} />);
    await user.hover(screen.getByRole('img', { name: '3 of 6 issues done' }));
    expect(await screen.findByText('6 issues')).toBeInTheDocument();
    expect(screen.queryByText('Statuses')).toBeNull();
  });

  it('keeps the same outer width class across states', () => {
    const states = [
      { breakdown: undefined, loading: true, error: false },
      { breakdown: undefined, loading: false, error: true },
      { breakdown: { done: 0, indeterminate: 0, new: 0 }, loading: false, error: false },
      { breakdown: data, loading: false, error: false },
    ];
    const classes = states.map((s) => {
      const { unmount } = render(<ReleaseIssueGraph {...s} />);
      const cls = screen.getByTestId('release-graph').className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain('w-full');
  });
});
