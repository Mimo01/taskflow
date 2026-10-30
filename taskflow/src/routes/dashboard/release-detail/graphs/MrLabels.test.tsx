import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import { labelRowPlan, type MrLabelCount, MrLabels } from './MrLabels';
import { ReleaseMrDonut } from './ReleaseMrDonut';

const mr = (i: number) =>
  ({ id: i, iid: 1000 + i, title: `Fix thing ${i}`, labels: [] }) as unknown as GitLabMR;
const lab = (name: string, count: number, color = '#428BCA'): MrLabelCount => ({
  label: { name, color, text_color: '#fff' },
  count,
});
const labels = [lab('backend', 4), lab('frontend', 4), lab('hotfix', 3)];
const missing = (n: number) => ({
  total: 10,
  labeled: 10 - n,
  unlabeled: Array.from({ length: n }, (_, i) => mr(i + 1)),
  allLabeled: n === 0,
});

describe('MrLabels (second legend column)', () => {
  it('renders nothing without labels and nothing missing', () => {
    const { container } = render(<MrLabels labelSummary={[]} coverage={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists each label as a legend-style row: colour dot, count, then the truncating name', () => {
    render(<MrLabels labelSummary={labels} coverage={null} />);
    const rows = screen.getAllByTestId('mr-label-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('4backend');
    const dot = rows[0].querySelector('span[aria-hidden]') as HTMLElement;
    expect(dot.style.backgroundColor).not.toBe('');
    expect(dot.className).toContain('size-2');
    expect(rows[0].querySelector('.truncate')).not.toBeNull();
    expect(rows[0].className).toContain('items-center');
  });

  it('ends with an orange "unlabelled N" and a hover list of 3 MRs plus "+2 more"', async () => {
    const user = userEvent.setup();
    render(<MrLabels labelSummary={labels} coverage={missing(5)} />);
    const el = screen.getByTestId('mr-labels-unlabeled');
    expect(el).toHaveTextContent('unlabelled');
    expect(el).toHaveTextContent('5');
    expect(el.className).toContain('text-orange-600');
    // last entry of the list
    const list = screen.getByTestId('mr-labels');
    expect(list.lastElementChild).toBe(el);
    await user.hover(el);
    const tip = await screen.findByTestId('mr-labels-unlabeled-tooltip');
    expect(tip).toHaveTextContent('!1001');
    expect(tip).not.toHaveTextContent('!1004');
    expect(tip).toHaveTextContent('+2 more');
  });

  it('omits the unlabelled entry when nothing is missing', () => {
    render(<MrLabels labelSummary={labels} coverage={missing(0)} />);
    expect(screen.queryByTestId('mr-labels-unlabeled')).toBeNull();
    expect(screen.getAllByTestId('mr-label-row')).toHaveLength(3);
  });

  it('caps at 5 rows: labels beyond that collapse into "+N more" with a tooltip', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 8 }, (_, i) => lab(`label-${i}`, i + 1));
    render(<MrLabels labelSummary={many} coverage={missing(2)} />);
    // 5 rows = 3 labels + "+5 more" + unlabelled
    expect(screen.getAllByTestId('mr-label-row')).toHaveLength(3);
    const more = screen.getByTestId('mr-labels-more');
    expect(more).toHaveTextContent('+5 more');
    expect(screen.getByTestId('mr-labels-unlabeled')).toBeInTheDocument();
    await user.hover(more);
    expect((await screen.findAllByText('label-3')).length).toBeGreaterThan(0);
  });
});

describe('labelRowPlan', () => {
  const many = Array.from({ length: 8 }, (_, i) => lab(`l${i}`, 1));
  it('shows all labels when they fit and reserves a row for the warning', () => {
    expect(labelRowPlan(many.slice(0, 5), 0).rest).toHaveLength(0);
    expect(labelRowPlan(many.slice(0, 5), 3).rest.length).toBeGreaterThan(0);
    expect(labelRowPlan(many.slice(0, 4), 3).rest).toHaveLength(0);
  });
  it('never exceeds 5 rows including the overflow and warning rows', () => {
    for (const miss of [0, 4]) {
      const { shown, rest } = labelRowPlan(many, miss);
      const rows = shown.length + (rest.length > 0 ? 1 : 0) + (miss > 0 ? 1 : 0);
      expect(rows).toBeLessThanOrEqual(5);
      expect(shown.length + rest.length).toBe(many.length);
    }
  });
});

describe('ReleaseMrDonut labels column', () => {
  const counts = { merged: 3, open: 0, draft: 0, closed: 0 };
  it('sits inside the MR cell next to the state legend', () => {
    render(
      <ReleaseMrDonut
        counts={counts}
        state="ready"
        labelSummary={labels}
        labelCoverage={missing(2)}
      />,
    );
    const cell = screen.getByTestId('release-graph-mrs');
    expect(cell.contains(screen.getByTestId('mr-labels'))).toBe(true);
    expect(screen.getByTestId('mr-labels-unlabeled')).toBeInTheDocument();
  });
});
