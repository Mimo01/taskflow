import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseStatusRow } from '../releaseBuckets';
import { ReleaseStatusRows } from './ReleaseStatusRows';

const rows: ReleaseStatusRow[] = [
  { name: 'Done', cat: 'done', count: 3, filterValues: ['Done'] },
  { name: 'Closed', cat: 'done', count: 1, filterValues: ['Closed'] },
  { name: 'In Review', cat: 'indeterminate', count: 2, filterValues: ['In Review'] },
];

describe('ReleaseStatusRows', () => {
  it('renders to do, in progress and done rows with counts, zero rows included', () => {
    render(<ReleaseStatusRows rows={rows} state="ready" />);
    expect(screen.getByText('By status')).toBeInTheDocument();
    expect(screen.getByTestId('status-row-new')).toHaveTextContent('To do0');
    expect(screen.getByTestId('status-row-indeterminate')).toHaveTextContent('In progress2');
    expect(screen.getByTestId('status-row-done')).toHaveTextContent('Done4');
  });

  it('click toggles the Status filter for every status in the category', async () => {
    const onToggle = vi.fn();
    render(<ReleaseStatusRows rows={rows} state="ready" onToggle={onToggle} />);
    await userEvent.click(screen.getByTestId('status-row-done'));
    expect(onToggle).toHaveBeenCalledWith(['Done', 'Closed']);
  });

  it('marks the row pressed when its statuses are the active filter', () => {
    render(
      <ReleaseStatusRows
        rows={rows}
        state="ready"
        onToggle={() => {}}
        activeValues={new Set(['Done', 'Closed'])}
      />,
    );
    expect(screen.getByTestId('status-row-done')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('status-row-indeterminate')).toHaveAttribute('aria-pressed', 'false');
  });

  it('a zero row is not a button', () => {
    render(<ReleaseStatusRows rows={rows} state="ready" onToggle={() => {}} />);
    expect(screen.getByTestId('status-row-new').tagName).toBe('DIV');
  });

  it('shows skeleton while loading and the empty copy', () => {
    const { rerender } = render(<ReleaseStatusRows rows={[]} state="loading" />);
    expect(screen.getByTestId('release-graph-status-skeleton')).toBeInTheDocument();
    rerender(<ReleaseStatusRows rows={[]} state="empty" />);
    expect(screen.getByText('No issues')).toBeInTheDocument();
  });
});
