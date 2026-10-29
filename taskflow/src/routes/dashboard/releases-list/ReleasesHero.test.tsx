import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReleasesHero } from './ReleasesHero';

const base = { updatedAt: undefined, refreshing: false, onRefresh: () => {} };

describe('ReleasesHero', () => {
  it('renders the title and 8 ambient curves', () => {
    const { container } = render(
      <ReleasesHero {...base} summary={{ planned: 1, overdue: 0, undated: 0 }} />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Releases');
    const svg = container.querySelector('svg[aria-hidden="true"]');
    expect(svg?.querySelectorAll('path')).toHaveLength(8);
  });

  it('renders the summary with emphasised count and red overdue', () => {
    render(<ReleasesHero {...base} summary={{ planned: 17, overdue: 1, undated: 1 }} />);
    expect(screen.getByTestId('releases-summary').textContent).toBe(
      '17 planned · 1 overdue · 1 without date',
    );
    expect(screen.getByText('17').className).toContain('font-semibold');
    expect(screen.getByText('1 overdue').className).toContain('text-red-600');
  });

  it('omits zero clauses', () => {
    render(<ReleasesHero {...base} summary={{ planned: 17, overdue: 0, undated: 0 }} />);
    expect(screen.getByTestId('releases-summary').textContent).toBe('17 planned');
  });

  it('says no planned releases when planned is 0', () => {
    render(<ReleasesHero {...base} summary={{ planned: 0, overdue: 0, undated: 0 }} />);
    expect(screen.getByTestId('releases-summary').textContent).toBe('No planned releases');
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
