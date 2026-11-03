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

describe('MrLabels (full-width strip)', () => {
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
    expect(pill.className).not.toContain('self-start');
    expect(pill.className).not.toContain('flex-1');
    expect(pill.querySelector('.truncate')).not.toBeNull();
  });

  it('puts the pills in a wrapping flex row with no dots and no column hairline', () => {
    render(<MrLabels labelSummary={labels} coverage={missing(2)} />);
    const col = screen.getByTestId('mr-labels');
    expect(col.className).not.toContain('border-l');
    expect(col.className).toContain('flex-wrap');
    expect(screen.queryByTestId('mr-labels-grid')).toBeNull();
    // no colour dots on the pills
    for (const pill of screen.getAllByTestId('mr-label-pill')) {
      expect(pill.querySelectorAll('.rounded-full')).toHaveLength(0);
    }
    expect(col.querySelectorAll('.size-2')).toHaveLength(0);
    expect(col.innerHTML).not.toContain('rounded-sm');
    expect(col.innerHTML).not.toContain('gridTemplateRows');
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

  it('ends the row with a small bare orange warning icon + count, unlike a pill', () => {
    render(<MrLabels labelSummary={labels} coverage={missing(5)} onToggleLabel={vi.fn()} />);
    const el = screen.getByTestId('mr-labels-unlabeled');
    expect(el).toHaveAccessibleName('5 MRs without label');
    expect(el).toHaveAttribute('title', '5 MRs without label — click to filter tasks');
    expect(el).toHaveTextContent('5');
    // different style from the pills: no fill, no border, orange text
    expect(el.className).toContain('text-orange-600');
    expect(el.className).not.toMatch(/(^|\s)bg-/);
    expect(el.className).not.toContain('border');
    expect(el.style.backgroundColor).toBe('');
    // inline in the one row, after every pill
    const strip = screen.getByTestId('mr-labels');
    expect(el.parentElement).toBe(strip);
    expect(strip.lastElementChild).toBe(el);
    const pills = screen.getAllByTestId('mr-label-pill');
    expect(
      pills[pills.length - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    const many = Array.from({ length: 12 }, (_, i) => lab(`label-${i}`, i + 1));
    render(<MrLabels labelSummary={many} coverage={missing(2)} />);
    expect(screen.getAllByTestId('mr-label-pill')).toHaveLength(12);
    expect(screen.queryByTestId('mr-labels-more')).toBeNull();
    expect(screen.getByTestId('mr-labels-unlabeled')).toBeInTheDocument();
  });

  it('renders only the warning when no MR has a label', () => {
    render(<MrLabels labelSummary={[]} coverage={missing(3)} />);
    expect(screen.getByTestId('mr-labels-unlabeled')).toBeInTheDocument();
    expect(screen.queryAllByTestId('mr-label-pill')).toHaveLength(0);
  });
});

describe('ReleaseMrDonut is ring-only', () => {
  const counts = { merged: 3, open: 0, draft: 0, closed: 0 };
  it('renders no labels inside the MR cell', () => {
    render(<ReleaseMrDonut counts={counts} state="ready" />);
    expect(screen.getByTestId('release-graph-mrs')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-labels')).toBeNull();
  });

  it('loading state shows just the ring skeleton', () => {
    render(<ReleaseMrDonut counts={counts} state="loading" />);
    const cell = screen.getByTestId('release-graph-mrs');
    expect(cell).toContainElement(screen.getByTestId('release-mr-donut-skeleton'));
    expect(cell.querySelectorAll('.h-3')).toHaveLength(0);
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
