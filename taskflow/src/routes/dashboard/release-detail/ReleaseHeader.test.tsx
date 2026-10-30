// UAT test 2 regression (Phase 91.1): opening the peek panel seeds this
// release's own breadcrumb entry, but the peek never changes the pathname — so
// the seeded entry is self-referential while the user is still on the release
// page. ReleaseDetailPage filters it out before rendering; these tests pin the
// header's contract that the trail it receives is rendered verbatim ahead of
// the static trailing release name, so a self-entry would visibly duplicate.

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ReleasePill } from '@/lib/release-list';
import { ReleaseBreadcrumbHeader, ReleaseDetailHeader, ReleaseDoneBar } from './ReleaseHeader';

vi.mock('@/lib/useDetectedBrowsers', () => ({ useDetectedBrowsers: () => [] }));

describe('ReleaseBreadcrumbHeader', () => {
  it('renders nothing when the trail is empty', () => {
    const { container } = render(
      <ReleaseBreadcrumbHeader
        trail={[]}
        versionName="33.5.0"
        onBack={vi.fn()}
        onBreadcrumbClick={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the release exactly once when the trail carries a real source page', () => {
    render(
      <ReleaseBreadcrumbHeader
        trail={[{ path: '/releases', label: 'Releases' }]}
        versionName="33.5.0"
        onBack={vi.fn()}
        onBreadcrumbClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Releases')).toBeInTheDocument();
    expect(screen.getAllByText('33.5.0')).toHaveLength(1);
  });

  it('would print the release twice if a self-referential entry reached it — hence the caller filters', () => {
    // Documents the failure mode the ReleaseDetailPage-side fix prevents.
    render(
      <ReleaseBreadcrumbHeader
        trail={[{ path: '/release/10001', label: '33.5.0' }]}
        versionName="33.5.0"
        onBack={vi.fn()}
        onBreadcrumbClick={vi.fn()}
      />,
    );
    expect(screen.getAllByText('33.5.0')).toHaveLength(2);
  });
});

describe('ReleaseDetailHeader', () => {
  const base = {
    name: '33.5.0',
    pill: { tone: 'muted', label: 'In 3 days' } as ReleasePill,
    releaseDate: '2026-11-02' as string | undefined,
    showPackage: false,
    pkg: null,
    pkgLoading: false,
    factItems: [] as { id: string; node: ReactNode }[],
    jiraDescription: null as string | null,
    milestoneDescription: null as string | null,
    pinned: false,
    onTogglePin: vi.fn(),
    onEdit: vi.fn(),
    jiraVersionUrl: null as string | null,
    onOpenInJira: vi.fn(),
    lastRefreshed: null as string | null,
    refreshing: false,
    onRefresh: vi.fn(),
  };
  const renderHeader = (over: Partial<typeof base> = {}) =>
    render(<ReleaseDetailHeader {...base} {...over} />);

  it('renders the name h1, one pill and the date', () => {
    renderHeader();
    const h = screen.getByRole('heading', { level: 1, name: '33.5.0' });
    expect(h).toHaveClass('text-lg', 'font-semibold');
    expect(h).toHaveAttribute('title', '33.5.0');
    expect(screen.getAllByTestId('release-status-pill')).toHaveLength(1);
    expect(screen.getByText('In 3 days')).toBeInTheDocument();
    expect(screen.getByText('Mon 02 Nov')).toBeInTheDocument();
    expect(screen.getByTestId('release-detail-header')).not.toHaveClass('border-b');
  });

  it('overdue date is red', () => {
    renderHeader({ pill: { tone: 'red', label: 'Overdue' } });
    expect(screen.getByTestId('release-header-date').className).toContain('text-red-600');
  });

  it('shows No release date in amber when undated', () => {
    renderHeader({ releaseDate: undefined, pill: { tone: 'amber', label: 'No date' } });
    expect(screen.getByTestId('release-header-date').className).toContain('text-amber-600');
    expect(screen.getByTestId('release-header-date')).toHaveTextContent('No release date');
    expect(screen.queryByText('Mon 02 Nov')).not.toBeInTheDocument();
  });

  it('toggles the package cell with showPackage', () => {
    const { unmount } = renderHeader({ showPackage: false });
    expect(screen.queryByTestId('row-deployment-package')).not.toBeInTheDocument();
    unmount();
    renderHeader({ showPackage: true });
    expect(screen.getByTestId('row-deployment-package')).toBeInTheDocument();
  });

  it('orders date, package then facts with n-1 separators', () => {
    renderHeader({
      showPackage: true,
      factItems: [
        { id: 'a', node: <span data-testid="fact-a">A</span> },
        { id: 'b', node: <span data-testid="fact-b">B</span> },
      ],
    });
    const line = screen.getByTestId('release-header-date').parentElement as HTMLElement;
    const order = ['release-header-date', 'row-deployment-package', 'fact-a', 'fact-b'].map((id) =>
      within(line).getByTestId(id),
    );
    for (let i = 0; i < order.length - 1; i++) {
      expect(
        order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    const separators = Array.from(line.children).filter((c) => c.textContent === '·');
    expect(separators).toHaveLength(3);
  });

  it('shows Refreshed text; refresh button fires and is disabled+spinning while refreshing', () => {
    const onRefresh = vi.fn();
    const { unmount } = renderHeader({ lastRefreshed: '10:11:12', onRefresh });
    expect(screen.getByText('Refreshed: 10:11:12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh release' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    unmount();
    const { container } = renderHeader({ refreshing: true });
    expect(screen.getByRole('button', { name: 'Refresh release' })).toBeDisabled();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('pin button reflects state and fires onTogglePin', () => {
    const onTogglePin = vi.fn();
    const { unmount } = renderHeader({ onTogglePin });
    const pin = screen.getByRole('button', { name: 'Pin release' });
    expect(pin).toHaveTextContent('Pin release');
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    unmount();
    renderHeader({ pinned: true });
    expect(screen.getByRole('button', { name: 'Unpin release' })).toHaveTextContent(
      'Unpin release',
    );
  });

  it('Edit release and Open in Jira fire their callbacks; labels collapse when narrow', () => {
    const onEdit = vi.fn();
    const onOpenInJira = vi.fn();
    renderHeader({ onEdit, onOpenInJira, jiraVersionUrl: 'https://jira.example.com/v/1' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit release' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open in Jira' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onOpenInJira).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Edit release').className).toContain('@max-[640px]/page:sr-only');
  });

  it('renders the description under the meta line', () => {
    renderHeader({ jiraDescription: 'Spring hardening release' });
    expect(screen.getByText('Spring hardening release')).toBeInTheDocument();
  });

  it('renders no v{id} line, no rocket icon and no countdown/done figure', () => {
    const { container } = renderHeader();
    expect(screen.queryByText(/^v\d+$/)).not.toBeInTheDocument();
    expect(container.querySelector('.lucide-rocket')).toBeNull();
    expect(screen.queryByText(/ done$/)).not.toBeInTheDocument();
  });
});

describe('ReleaseDoneBar', () => {
  it('shows the done figure and graph label in a border-t wrapper', () => {
    render(
      <ReleaseDoneBar
        breakdown={{ done: 4, indeterminate: 1, new: 1 }}
        loading={false}
        error={false}
        statusNames={null}
      />,
    );
    expect(screen.getByTestId('release-done-bar')).toHaveClass('border-t', 'px-6', 'pt-4');
    expect(screen.getByTestId('release-done-figure')).toHaveTextContent('4 / 6 done');
    expect(screen.getByRole('img', { name: '4 of 6 issues done' })).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    render(<ReleaseDoneBar breakdown={undefined} loading error={false} statusNames={null} />);
    expect(screen.getByTestId('release-graph-skeleton')).toBeInTheDocument();
  });
});
