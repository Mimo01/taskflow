import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StatusBreakdown } from '@/lib/release-list';
import type { JiraFixVersion } from '@/services/jira';
import { ReleaseTimeline } from './ReleaseTimeline';

const TODAY = '2026-10-29';

const v = (id: string, releaseDate: string | undefined, released = false): JiraFixVersion => ({
  id,
  name: `Rel ${id} - Short ${id}`,
  releaseDate,
  released,
});

// Width 600 (setup mock) => 5 weeks, overdue anchor 2026-10-27 => window 10-24 .. 11-30.
const VERSIONS = [
  v('rel', '2026-10-26', true),
  v('late', '2026-10-27'),
  v('next', '2026-11-03'),
  v('mid', '2026-11-10'),
  v('todo', '2026-11-17'),
  v('empty', '2026-11-24'),
  v('load', '2026-11-27'),
  v('far', '2026-12-15'),
  v('undated', undefined),
];

const BREAKDOWNS = new Map<string, StatusBreakdown>([
  ['next', { done: 15, indeterminate: 5, new: 4 }],
  ['mid', { done: 18, indeterminate: 0, new: 2 }],
  ['todo', { done: 0, indeterminate: 0, new: 8 }],
  ['empty', { done: 0, indeterminate: 0, new: 0 }],
  ['late', { done: 1, indeterminate: 0, new: 1 }],
]);

function setup(onOpen = vi.fn()) {
  const utils = render(
    <ReleaseTimeline
      versions={VERSIONS}
      today={TODAY}
      nextId="next"
      breakdowns={BREAKDOWNS}
      loadingIds={new Set(['load'])}
      onOpen={onOpen}
    />,
  );
  return { ...utils, onOpen };
}

const chip = (id: string) =>
  screen.getByRole('button', { name: new RegExp(`Open release Rel ${id} -`) });

describe('ReleaseTimeline', () => {
  it('renders one chip per dated release in the window with full-name aria-label and title', () => {
    setup();
    expect(screen.getAllByTestId('timeline-chip')).toHaveLength(7);
    expect(chip('mid')).toHaveAttribute('title', 'Rel mid - Short mid');
    expect(screen.queryByText(/No date/i)).toBeNull();
  });

  it('opens a release when its chip is clicked', () => {
    const { onOpen } = setup();
    fireEvent.click(chip('mid'));
    expect(onOpen).toHaveBeenCalledWith('mid');
  });

  it('gives only the next chip a bar, kicker and data-next', () => {
    setup();
    const next = chip('next');
    expect(next).toHaveAttribute('data-next', 'true');
    expect(within(next).getByText('Next')).toBeInTheDocument();
    expect(within(next).getByTestId('timeline-chip-bar')).toBeInTheDocument();
    expect(within(next).getByText('15/24 done')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-chip-bar')).toHaveLength(1);
    expect(screen.getAllByTestId('timeline-chip').filter((c) => c.dataset.next)).toHaveLength(1);
  });

  it('shows the short name, never the full name, in chip text', () => {
    setup();
    expect(within(chip('mid')).getByText('Short mid')).toBeInTheDocument();
    expect(within(chip('mid')).queryByText(/Rel mid/)).toBeNull();
  });

  it('shows one status per non-next chip', () => {
    setup();
    expect(within(chip('mid')).getByText('18/20 done')).toBeInTheDocument();
    expect(within(chip('todo')).getByText('8 to do')).toBeInTheDocument();
    expect(within(chip('empty')).getByText('No issues')).toBeInTheDocument();
    expect(within(chip('rel')).getByText('✓ done')).toBeInTheDocument();
  });

  it('shows a skeleton for a loading chip without breakdown', () => {
    setup();
    const c = chip('load');
    expect(c.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('renders one axis dot per chip with the right state', () => {
    setup();
    const dots = screen.getAllByTestId('timeline-dot');
    expect(dots).toHaveLength(7);
    const states = dots.map((d) => d.dataset.state);
    expect(states).toContain('released');
    expect(states).toContain('overdue');
    expect(states).toContain('next');
    expect(states).toContain('planned');
  });

  it('renders the TODAY marker and the range with later count', () => {
    setup();
    expect(within(screen.getByTestId('timeline-today')).getByText('Today')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-range')).toHaveTextContent('24 Oct – 30 Nov · +1 later');
  });

  it('disables Today and earlier at base, and restores after panning', () => {
    setup();
    const todayBtn = screen.getByRole('button', { name: 'Today' });
    const earlier = screen.getByRole('button', { name: 'Show earlier weeks' });
    const later = screen.getByRole('button', { name: 'Show later weeks' });
    const base = screen.getByTestId('timeline-range').textContent;
    expect(todayBtn).toBeDisabled();
    expect(earlier).toBeDisabled();
    expect(later).toBeEnabled();

    fireEvent.click(later);
    expect(todayBtn).toBeEnabled();
    expect(earlier).toBeEnabled();
    expect(screen.getByTestId('timeline-range').textContent).not.toBe(base);

    fireEvent.click(todayBtn);
    expect(todayBtn).toBeDisabled();
    expect(earlier).toBeDisabled();
    expect(screen.getByTestId('timeline-range').textContent).toBe(base);
  });

  it('disables later when nothing lies beyond the window', () => {
    render(
      <ReleaseTimeline
        versions={[v('only', '2026-11-03')]}
        today={TODAY}
        nextId="only"
        breakdowns={new Map()}
        loadingIds={new Set()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Show later weeks' })).toBeDisabled();
  });

  it('has no orange, no icon on the graph, and no card', () => {
    const { container } = setup();
    for (const el of Array.from(container.querySelectorAll('[class]'))) {
      expect(el.getAttribute('class')).not.toMatch(/orange/);
    }
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
    // Only the two control chevrons are svgs.
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });
});
