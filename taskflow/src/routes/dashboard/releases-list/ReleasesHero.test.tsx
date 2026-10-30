import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReleasesHero } from './ReleasesHero';

const base = { updatedAt: undefined, refreshing: false, onRefresh: () => {} };
const NO_HISTORY = { cadenceDays: null, lastShippedDays: null };
const stats = () =>
  screen
    .getAllByTestId('releases-stat')
    .map((el) => el.textContent)
    .join(' · ');

describe('ReleasesHero', () => {
  it('renders the title in the standard page header bar', () => {
    const { container } = render(
      <ReleasesHero {...base} summary={{ planned: 1, overdue: 0, undated: 0, ...NO_HISTORY }} />,
    );
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent).toBe('Releases');
    expect(title.className).toBe('text-3xl font-semibold');
    const header = container.querySelector('header');
    expect(header?.className).toContain('border-b');
    expect(header?.className).toContain('px-6 py-4');
  });

  it('renders the summary with emphasised count and red overdue', () => {
    render(
      <ReleasesHero {...base} summary={{ planned: 17, overdue: 1, undated: 1, ...NO_HISTORY }} />,
    );
    expect(stats()).toBe('17 planned · 1 overdue · 1 without date');
    const stat = (text: string) =>
      screen.getByText(text).closest('[data-testid="releases-stat"]') as HTMLElement;
    expect(stat('17 planned').className).toContain('text-foreground');
    expect(stat('1 overdue').className).toContain('text-red-600');
    expect(stat('1 without date').className).toContain('text-amber-600');
    expect(stat('17 planned').querySelector('svg')).not.toBeNull();
  });

  it('omits zero clauses', () => {
    render(
      <ReleasesHero {...base} summary={{ planned: 17, overdue: 0, undated: 0, ...NO_HISTORY }} />,
    );
    expect(stats()).toBe('17 planned');
  });

  it('adds release cadence and last shipped when there is history', () => {
    render(
      <ReleasesHero
        {...base}
        summary={{ planned: 9, overdue: 0, undated: 0, cadenceDays: 7, lastShippedDays: 16 }}
      />,
    );
    expect(stats()).toBe('9 planned · ships every ~7 days · last shipped 2 weeks ago');
  });

  it('says today / yesterday for a recent ship and skips a zero cadence', () => {
    const { rerender } = render(
      <ReleasesHero
        {...base}
        summary={{ planned: 2, overdue: 0, undated: 0, cadenceDays: 0, lastShippedDays: 0 }}
      />,
    );
    expect(stats()).toBe('2 planned · last shipped today');
    rerender(
      <ReleasesHero
        {...base}
        summary={{ planned: 2, overdue: 0, undated: 0, cadenceDays: 3, lastShippedDays: 1 }}
      />,
    );
    expect(stats()).toBe('2 planned · ships every ~3 days · last shipped yesterday');
  });

  it('says no planned releases when planned is 0', () => {
    render(
      <ReleasesHero {...base} summary={{ planned: 0, overdue: 0, undated: 0, ...NO_HISTORY }} />,
    );
    expect(stats()).toBe('No planned releases');
  });

  it('renders no summary while loading', () => {
    render(<ReleasesHero {...base} summary={null} />);
    expect(screen.queryByTestId('releases-summary')).toBeNull();
  });

  it('shows Updated text when updatedAt is set', () => {
    render(<ReleasesHero {...base} summary={null} updatedAt={Date.now() - 120_000} />);
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });

  it('refresh button calls onRefresh', () => {
    const onRefresh = vi.fn();
    render(<ReleasesHero {...base} summary={null} onRefresh={onRefresh} />);
    const btn = screen.getByRole('button', { name: 'Refresh releases' });
    expect(btn.textContent).toBe('Refresh');
    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('disables and spins while refreshing', () => {
    render(<ReleasesHero {...base} summary={null} refreshing />);
    const btn = screen.getByRole('button', { name: 'Refresh releases' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.querySelector('svg')?.getAttribute('class')).toContain('animate-spin');
  });
});
