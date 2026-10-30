import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraFixVersion } from '@/services/jira';
import { ReleasedPanel } from './ReleasedPanel';

const v = (id: string, name: string, releaseDate?: string): JiraFixVersion => ({
  id,
  name,
  released: true,
  releaseDate,
});
const VERSIONS = [
  v('1', 'Alpha shipped release', '2026-10-13'),
  v('2', 'Beta shipped release', '2026-10-06'),
  v('3', 'Gamma shipped release'),
];

function setup(over: Partial<React.ComponentProps<typeof ReleasedPanel>> = {}) {
  const onOpen = vi.fn();
  const onShowMore = vi.fn();
  render(
    <ReleasedPanel
      versions={VERSIONS}
      breakdowns={new Map([['1', { done: 25, indeterminate: 0, new: 0 }]])}
      loadingIds={new Set()}
      errorIds={new Set()}
      hasMore
      onShowMore={onShowMore}
      onOpen={onOpen}
      {...over}
    />,
  );
  return { onOpen, onShowMore };
}

describe('ReleasedPanel', () => {
  it('renders the header, count, rows and show-older button', () => {
    setup();
    const section = screen.getByRole('region', { name: 'Released' });
    expect(section.className).toContain('bg-muted/55');
    expect(screen.getByText('Released', { selector: 'span' }).className).toContain(
      'text-green-600',
    );
    expect(screen.getByText('3 most recent')).toBeInTheDocument();
    expect(screen.getAllByTestId('released-row')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Show older releases/ })).toBeInTheDocument();
  });

  it('shows stamp, full name with title, and the green done figure', () => {
    setup();
    const row = screen.getAllByTestId('released-row')[0];
    expect(row).toHaveTextContent('Tue 13 Oct');
    expect(row).toHaveAttribute('title', 'Alpha shipped release');
    const fig = screen.getByText('✓ 25 done');
    expect(fig.className).toContain('font-medium');
    expect(fig.className).toContain('text-green-600');
  });

  it('shows the muted agenda wording, not a green "✓ 0 done", for a release with no issues', () => {
    setup({ breakdowns: new Map([['1', { done: 0, indeterminate: 0, new: 0 }]]) });
    const row = screen.getAllByTestId('released-row')[0];
    expect(row).not.toHaveTextContent('0 done');
    const empty = screen.getByText('No issues yet');
    expect(empty.className).toContain('text-muted-foreground/75');
    expect(empty.className).not.toContain('text-green-600');
  });

  it('shows a skeleton while loading and no figure when unknown', () => {
    setup({ loadingIds: new Set(['2']) });
    const rows = screen.getAllByTestId('released-row');
    expect(rows[1].querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(rows[2].querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(rows[2]).not.toHaveTextContent('done');
  });

  it('marks a failed counts fetch with a titled dash, not an empty cell', () => {
    setup({ errorIds: new Set(['2']) });
    const rows = screen.getAllByTestId('released-row');
    const err = rows[1].querySelector('[data-testid="release-issues-error"]');
    expect(err).toHaveTextContent('–');
    expect(err).toHaveAttribute('title', "Couldn't load issue counts");
    expect(rows[2].querySelector('[data-testid="release-issues-error"]')).toBeNull();
  });

  it('calls onOpen and onShowMore', () => {
    const { onOpen, onShowMore } = setup();
    fireEvent.click(screen.getAllByTestId('released-row')[1]);
    expect(onOpen).toHaveBeenCalledWith('2');
    fireEvent.click(screen.getByRole('button', { name: /Show older releases/ }));
    expect(onShowMore).toHaveBeenCalledOnce();
  });

  it('hides the show-older button when nothing more exists', () => {
    setup({ hasMore: false });
    expect(screen.queryByRole('button', { name: /Show older releases/ })).toBeNull();
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(
      <ReleasedPanel
        versions={[]}
        breakdowns={new Map()}
        loadingIds={new Set()}
        errorIds={new Set()}
        hasMore={false}
        onShowMore={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
