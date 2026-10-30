import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import { labelChipWidth, type MrLabelCount, MrLabels, visibleLabelCount } from './MrLabels';
import { ReleaseMrDonut } from './ReleaseMrDonut';

const mr = (i: number) =>
  ({ id: i, iid: 1000 + i, title: `Fix thing ${i}`, labels: [] }) as unknown as GitLabMR;
const lab = (name: string, count: number, color = '#428BCA'): MrLabelCount => ({
  label: { name, color, text_color: '#fff' },
  count,
});
const labels = [lab('backend', 4), lab('frontend', 4), lab('hotfix', 3)];

describe('MrLabels', () => {
  it('renders nothing without labels and coverage', () => {
    const { container } = render(<MrLabels labelSummary={[]} coverage={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows quiet chips: GitLab colour only as a dot, name and a muted count', () => {
    render(<MrLabels labelSummary={labels} coverage={null} />);
    const chips = screen.getAllByTestId('mr-label-chip');
    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveTextContent('backend4');
    const dot = chips[0].querySelector('span[aria-hidden]') as HTMLElement;
    expect(dot.style.backgroundColor).not.toBe('');
    expect(chips[0].className).not.toContain('bg-');
  });

  it('shows an orange "N unlabelled" with a hover list of 3 MRs plus "+2 more"', async () => {
    const user = userEvent.setup();
    render(
      <MrLabels
        labelSummary={labels}
        coverage={{ total: 8, labeled: 3, unlabeled: [1, 2, 3, 4, 5].map(mr), allLabeled: false }}
      />,
    );
    const el = screen.getByTestId('mr-labels-unlabeled');
    expect(el).toHaveTextContent('5 unlabelled');
    expect(el.className).toContain('text-orange-600');
    await user.hover(el);
    const tip = await screen.findByTestId('mr-labels-unlabeled-tooltip');
    expect(tip).toHaveTextContent('!1001');
    expect(tip).not.toHaveTextContent('!1004');
    expect(tip).toHaveTextContent('+2 more');
  });

  it('shows only a tiny check when every MR is labelled', () => {
    render(
      <MrLabels
        labelSummary={labels}
        coverage={{ total: 3, labeled: 3, unlabeled: [], allLabeled: true }}
      />,
    );
    expect(screen.getByTestId('mr-labels-all')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-labels-unlabeled')).toBeNull();
  });

  describe('overflow', () => {
    const real = Element.prototype.getBoundingClientRect;
    afterEach(() => {
      Element.prototype.getBoundingClientRect = real;
    });
    it('shows as many chips as fit, then a muted "+N" with a tooltip of the rest', async () => {
      Element.prototype.getBoundingClientRect = () => ({ width: 120 }) as DOMRect;
      // the test setup's ResizeObserver mock reports 600; override with the measured width
      const RealRO = global.ResizeObserver;
      global.ResizeObserver = class {
        constructor(private cb: ResizeObserverCallback) {}
        observe(t: Element) {
          this.cb(
            [{ target: t, contentRect: { width: 120 } } as ResizeObserverEntry],
            this as never,
          );
        }
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
      const user = userEvent.setup();
      render(<MrLabels labelSummary={labels} coverage={null} />);
      global.ResizeObserver = RealRO;
      expect(screen.getAllByTestId('mr-label-chip').length).toBeLessThan(3);
      const more = screen.getByTestId('mr-labels-more');
      expect(more.textContent).toMatch(/^\+\d$/);
      await user.hover(more);
      expect((await screen.findAllByText('hotfix')).length).toBeGreaterThan(0);
    });
  });
});

describe('visibleLabelCount', () => {
  it('fits all when wide, none+overflow when tiny, reserves room for the warning', () => {
    expect(visibleLabelCount(labels, 800, 0)).toBe(3);
    expect(visibleLabelCount(labels, 20, 0)).toBe(0);
    const w = labels.reduce((n, l) => n + labelChipWidth(l), 0);
    expect(visibleLabelCount(labels, w + 5, 0)).toBe(3);
    expect(visibleLabelCount(labels, w + 5, 112)).toBeLessThan(3);
  });
});

describe('ReleaseMrDonut label line', () => {
  const counts = { merged: 3, open: 0, draft: 0, closed: 0 };
  it('sits inside the MR cell under the donut when labels are given', () => {
    render(
      <ReleaseMrDonut
        counts={counts}
        state="ready"
        labelSummary={labels}
        labelCoverage={{ total: 3, labeled: 1, unlabeled: [mr(1), mr(2)], allLabeled: false }}
      />,
    );
    const cell = screen.getByTestId('release-graph-mrs');
    expect(cell.contains(screen.getByTestId('mr-labels'))).toBe(true);
    expect(screen.getByTestId('mr-labels-unlabeled')).toHaveTextContent('2 unlabelled');
  });
});
