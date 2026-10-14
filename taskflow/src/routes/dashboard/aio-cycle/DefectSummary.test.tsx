import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResolvedDefect } from './useCycleDefects';
import { CycleDefectDonuts } from './DefectSummary';

const defect = (i: number, priority: string): ResolvedDefect =>
  ({
    defectKey: String(i),
    triggeredByRuns: [],
    isLoading: false,
    issue: {
      key: `P-${i}`,
      fields: {
        status: { name: 'To Do', statusCategory: { key: 'new' } },
        priority: { name: priority },
      },
    },
  }) as unknown as ResolvedDefect;

const priorityKey = () => {
  const block = screen
    .getByTestId('defect-priority-donut')
    .closest('[data-testid="defect-donut-block"]');
  return within(block as HTMLElement);
};

describe('defect donut key', () => {
  it('lists up to 3 entries in full', () => {
    const names = ['Blocker', 'Must', 'High'];
    render(<CycleDefectDonuts defects={names.map((n, i) => defect(i, n))} loading={false} />);
    for (const n of names) expect(priorityKey().getByText(n)).toBeDefined();
    expect(priorityKey().queryByText(/more/)).toBeNull();
  });

  it('shows 2 entries and "+N more" beyond 3 (keeps the key short)', () => {
    const names = ['Blocker', 'Must', 'High', 'Medium', 'Low'];
    render(<CycleDefectDonuts defects={names.map((n, i) => defect(i, n))} loading={false} />);
    expect(priorityKey().getAllByText(/^(Blocker|Must|High|Medium|Low)$/)).toHaveLength(2);
    expect(priorityKey().getByText('+3 more')).toBeDefined();
  });
});
