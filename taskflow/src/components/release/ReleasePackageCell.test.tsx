import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatWeekLabel, type RmWeek } from '@/lib/deployment-package';
import { PACKAGE_ERROR_TEXT, ReleasePackageCell } from './ReleasePackageCell';

const week: RmWeek = {
  key: 'RM-1',
  summary: 'WEEK43 (19.10.2026 - 25.10.2026)',
  weekNo: 43,
  start: '2026-10-19',
  end: '2026-10-25',
  children: [{ key: 'RM-11', summary: 'Core deployment' }],
};

describe('ReleasePackageCell', () => {
  it('loading shows a skeleton inside the wrapper', () => {
    render(<ReleasePackageCell pkg={null} loading />);
    expect(screen.getByTestId('package-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('row-deployment-package')).toBeInTheDocument();
  });

  it('child state shows the week label and a mono child key', () => {
    render(<ReleasePackageCell pkg={{ week, child: week.children[0] }} loading={false} />);
    expect(screen.getByText(formatWeekLabel(week.summary))).toBeInTheDocument();
    const key = screen.getByText('RM-11');
    expect(key).toHaveClass('font-mono');
  });

  it('week-only state is muted with no mono key', () => {
    const { container } = render(
      <ReleasePackageCell pkg={{ week, child: null }} loading={false} />,
    );
    expect(screen.getByText(formatWeekLabel(week.summary))).toHaveClass('text-muted-foreground');
    expect(container.querySelector('.font-mono')).toBeNull();
  });

  it('loading with a week but no child yet shows the skeleton, not the week-only state', () => {
    render(<ReleasePackageCell pkg={{ week, child: null }} loading />);
    expect(screen.getByTestId('package-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(formatWeekLabel(week.summary))).toBeNull();
  });

  it('loading keeps a resolved child visible', () => {
    render(<ReleasePackageCell pkg={{ week, child: week.children[0] }} loading />);
    expect(screen.getByText('RM-11')).toBeInTheDocument();
    expect(screen.queryByTestId('package-skeleton')).toBeNull();
  });

  it('a failed lookup titles the week-only and dash states', () => {
    const { unmount } = render(
      <ReleasePackageCell pkg={{ week, child: null }} loading={false} error />,
    );
    const label = screen.getByText(formatWeekLabel(week.summary));
    expect(label).toHaveAttribute('title', PACKAGE_ERROR_TEXT);
    expect(label).toHaveClass('pointer-events-auto');
    unmount();
    render(<ReleasePackageCell pkg={null} loading={false} error />);
    expect(screen.getByText('–')).toHaveAttribute('title', PACKAGE_ERROR_TEXT);
  });

  it('a failed lookup does not title a resolved child', () => {
    render(<ReleasePackageCell pkg={{ week, child: week.children[0] }} loading={false} error />);
    expect(screen.getByText(formatWeekLabel(week.summary))).not.toHaveAttribute('title');
  });

  it('no package shows a muted dash', () => {
    render(<ReleasePackageCell pkg={null} loading={false} />);
    expect(screen.getByText('–')).toHaveClass('text-muted-foreground');
  });

  it('keeps the same wrapper class in all states', () => {
    const states: [Parameters<typeof ReleasePackageCell>[0]][] = [
      [{ pkg: null, loading: true }],
      [{ pkg: null, loading: false }],
      [{ pkg: { week, child: null }, loading: false }],
      [{ pkg: { week, child: week.children[0] }, loading: false }],
    ];
    const classes = states.map(([props]) => {
      const { unmount } = render(<ReleasePackageCell {...props} />);
      const cls = screen.getByTestId('row-deployment-package').className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain('w-full');
  });
});
