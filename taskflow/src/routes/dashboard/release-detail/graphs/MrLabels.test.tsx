import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import { type MrLabelCount, MrLabels, UNLABELED_FILTER } from './MrLabels';
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

  it('leads with an orange "N MRs without label" banner, apart from the pill grid', async () => {
    const user = userEvent.setup();
    render(<MrLabels labelSummary={labels} coverage={missing(5)} />);
    const el = screen.getByTestId('mr-labels-unlabeled');
    expect(el).toHaveTextContent('5 MRs without label');
    expect(el.className).toContain('border-l-[3px]');
    expect(el.className).toContain('border-orange-500');
    expect(el.className).toContain('w-full');
    // first entry of the block, outside the label grid
    const list = screen.getByTestId('mr-labels');
    expect(list.firstElementChild).toBe(el);
    expect(screen.getByTestId('mr-labels-grid').contains(el)).toBe(false);
    // a hairline divides the banner from the pills
    expect(el.nextElementSibling).toBe(screen.getByTestId('mr-labels-divider'));
    await user.hover(el);
    expect(screen.queryByTestId('mr-labels-unlabeled-tooltip')).toBeNull();
  });

  it('uses the singular for one unlabelled MR', () => {
    render(<MrLabels labelSummary={labels} coverage={missing(1)} />);
    expect(screen.getByTestId('mr-labels-unlabeled')).toHaveTextContent('1 MR without label');
  });

  it('toggles the unlabeled filter sentinel when the No label pill is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<MrLabels labelSummary={labels} coverage={missing(2)} onToggleLabel={onToggle} />);
    await user.click(screen.getByTestId('mr-labels-unlabeled'));
    expect(onToggle).toHaveBeenCalledWith(UNLABELED_FILTER);
  });

  it('omits the unlabelled entry when nothing is missing', () => {
    render(<MrLabels labelSummary={labels} coverage={missing(0)} />);
    expect(screen.queryByTestId('mr-labels-unlabeled')).toBeNull();
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(3);
  });

  it('shows every label as a pill, never collapsing into "+N more"', () => {
    const many = Array.from({ length: 8 }, (_, i) => lab(`label-${i}`, i + 1));
    render(<MrLabels labelSummary={many} coverage={missing(2)} />);
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(8);
    expect(screen.queryByTestId('mr-labels-more')).toBeNull();
    expect(screen.getByTestId('mr-labels-unlabeled')).toBeInTheDocument();
  });

  it('caps the grid at 5 rows and flows extra pills into columns', () => {
    const many = Array.from({ length: 8 }, (_, i) => lab(`label-${i}`, i + 1));
    render(<MrLabels labelSummary={many} coverage={missing(0)} />);
    const grid = screen.getByTestId('mr-labels-grid');
    expect(grid.style.gridTemplateRows).toBe('repeat(5, auto)');
    expect(grid.className).toContain('grid-flow-col');
    expect(screen.getByTestId('mr-labels').className).toContain('border-l');
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(8);
  });

  it('gives the banner one row of the budget: 4 grid rows when it shows', () => {
    const many = Array.from({ length: 8 }, (_, i) => lab(`label-${i}`, i + 1));
    render(<MrLabels labelSummary={many} coverage={missing(2)} />);
    expect(screen.getByTestId('mr-labels-grid').style.gridTemplateRows).toBe('repeat(4, auto)');
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(8);
  });

  it('uses one row per item when there are fewer than 5', () => {
    render(<MrLabels labelSummary={labels} coverage={missing(0)} />);
    expect(screen.getByTestId('mr-labels-grid').style.gridTemplateRows).toBe('repeat(3, auto)');
  });

  it('renders only the banner when no MR has a label', () => {
    render(<MrLabels labelSummary={[]} coverage={missing(3)} />);
    expect(screen.getByTestId('mr-labels-unlabeled')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-labels-grid')).toBeNull();
    expect(screen.queryByTestId('mr-labels-divider')).toBeNull();
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

describe('MrLabels label filter toggle', () => {
  it('renders pills as pressed-state buttons that report the clicked label', async () => {
    const onToggle = vi.fn();
    render(
      <MrLabels
        labelSummary={labels}
        coverage={null}
        activeLabel="frontend"
        onToggleLabel={onToggle}
      />,
    );
    const pills = screen.getAllByRole('button');
    expect(pills).toHaveLength(3);
    expect(pills[1]).toHaveAttribute('aria-pressed', 'true');
    expect(pills[0]).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(pills[0]);
    expect(onToggle).toHaveBeenCalledWith('backend');
  });

  it('stays non-interactive without a toggle handler', () => {
    render(<MrLabels labelSummary={labels} coverage={null} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
