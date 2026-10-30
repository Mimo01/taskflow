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

  it('renders each label as a squarish GitLab-style pill: tinted bg, readable text shade, no border, name + count', () => {
    render(<MrLabels labelSummary={[lab('backend', 4, '#428BCA')]} coverage={null} />);
    const pill = screen.getByTestId('mr-label-pill');
    expect(pill).toHaveTextContent('backend');
    expect(pill).toHaveTextContent('4');
    expect(pill.style.backgroundColor).toContain('color-mix');
    expect(pill.style.borderColor).toBe('');
    expect(pill.className).toMatch(/(^|\s)rounded(\s|$)/);
    expect(pill.style.getPropertyValue('--lp-l')).toMatch(/^#[0-9a-f]{6}$/);
    expect(pill.style.getPropertyValue('--lp-d')).toMatch(/^#[0-9a-f]{6}$/);
    expect(pill.className).toContain('dark:text-[color:var(--lp-d)]');
    expect(pill.className).toContain('h-5');
    expect(pill.className).toContain('self-start');
    expect(pill.className).not.toContain('flex-1');
    expect(pill.querySelector('.truncate')).not.toBeNull();
  });

  it('has no dots anywhere in the labels column and a hairline separating it from the legend', () => {
    render(<MrLabels labelSummary={labels} coverage={missing(2)} />);
    const col = screen.getByTestId('mr-labels');
    expect(col.className).toContain('border-l');
    expect(col.querySelectorAll('.rounded-full')).toHaveLength(0);
    expect(col.querySelectorAll('.size-2')).toHaveLength(0);
    expect(col.innerHTML).not.toContain('rounded-sm');
  });

  it('copes with varied label colours (very light and very dark)', () => {
    render(
      <MrLabels
        labelSummary={[lab('light', 1, '#FFECDB'), lab('dark', 2, '#330066')]}
        coverage={null}
      />,
    );
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(2);
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
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(3);
  });

  it('caps at 5 rows: labels beyond that collapse into "+N more" with a tooltip', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 8 }, (_, i) => lab(`label-${i}`, i + 1));
    render(<MrLabels labelSummary={many} coverage={missing(2)} />);
    // 5 rows = 3 pills + "+5 more" + the plain unlabelled line
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(3);
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
    expect(labelRowPlan(many.slice(0, 4), 0).rest).toHaveLength(0);
    expect(labelRowPlan(many.slice(0, 5), 0).rest.length).toBeGreaterThan(0);
    expect(labelRowPlan(many.slice(0, 4), 3).rest).toHaveLength(0);
    expect(labelRowPlan(many.slice(0, 5), 3).rest.length).toBeGreaterThan(0);
  });
  it('never exceeds 4 pills and 5 rows including the overflow and warning rows', () => {
    for (const miss of [0, 4]) {
      const { shown, rest } = labelRowPlan(many, miss);
      const rows = shown.length + (rest.length > 0 ? 1 : 0) + (miss > 0 ? 1 : 0);
      expect(rows).toBeLessThanOrEqual(5);
      expect(shown.length).toBeLessThanOrEqual(4);
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
