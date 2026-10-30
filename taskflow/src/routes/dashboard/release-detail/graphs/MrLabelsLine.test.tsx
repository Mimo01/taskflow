import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import { MrLabelsLine } from './MrLabelsLine';
import { ReleaseMrDonut } from './ReleaseMrDonut';

const mr = (i: number) =>
  ({ id: i, iid: 1000 + i, title: `Fix thing ${i}`, labels: [] }) as unknown as GitLabMR;

describe('MrLabelsLine', () => {
  it('renders nothing without coverage (no MRs, never a perpetual Loading)', () => {
    const { container } = render(<MrLabelsLine coverage={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a muted check line when every MR is labelled', () => {
    render(<MrLabelsLine coverage={{ total: 23, labeled: 23, unlabeled: [], allLabeled: true }} />);
    const el = screen.getByTestId('mr-labels-line');
    expect(el).toHaveTextContent('All MRs labelled');
    expect(el.className).toContain('text-muted-foreground');
  });

  it('shows "N of M MRs missing a label" in orange with a tooltip of 3 MRs plus "+2 more"', async () => {
    const user = userEvent.setup();
    render(
      <MrLabelsLine
        coverage={{ total: 8, labeled: 3, unlabeled: [1, 2, 3, 4, 5].map(mr), allLabeled: false }}
      />,
    );
    const el = screen.getByTestId('mr-labels-line');
    expect(el).toHaveTextContent('5 of 8 MRs missing a label');
    expect(el.className).toContain('text-orange-600');
    await user.hover(el);
    const tip = await screen.findByTestId('mr-labels-unlabeled-tooltip');
    expect(tip).toHaveTextContent('!1001');
    expect(tip).not.toHaveTextContent('!1004');
    expect(tip).toHaveTextContent('+2 more');
    expect(tip.querySelectorAll('a')).toHaveLength(0);
  });
});

describe('ReleaseMrDonut label footer', () => {
  const counts = { merged: 3, open: 0, draft: 0, closed: 0 };
  it('is shown under the donut when coverage is given and omitted otherwise', () => {
    const { rerender } = render(
      <ReleaseMrDonut
        counts={counts}
        state="ready"
        labelCoverage={{ total: 3, labeled: 1, unlabeled: [mr(1), mr(2)], allLabeled: false }}
      />,
    );
    expect(screen.getByTestId('mr-labels-line')).toHaveTextContent('2 of 3 MRs missing a label');
    rerender(<ReleaseMrDonut counts={counts} state="ready" labelCoverage={null} />);
    expect(screen.queryByTestId('mr-labels-line')).toBeNull();
  });
});
