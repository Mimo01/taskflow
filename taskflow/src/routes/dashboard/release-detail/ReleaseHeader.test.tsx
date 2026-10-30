// UAT test 2 regression (Phase 91.1): opening the peek panel seeds this
// release's own breadcrumb entry, but the peek never changes the pathname — so
// the seeded entry is self-referential while the user is still on the release
// page. ReleaseDetailPage filters it out before rendering; these tests pin the
// header's contract that the trail it receives is rendered verbatim ahead of
// the static trailing release name, so a self-entry would visibly duplicate.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReleasePill } from '@/lib/release-list';
import { ReleaseBreadcrumbHeader, ReleaseDetailHeader } from './ReleaseHeader';

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
    breakdown: { done: 4, indeterminate: 1, new: 1 } as
      | { done: number; indeterminate: number; new: number }
      | undefined,
    breakdownLoading: false,
    breakdownError: false,
    pinned: false,
    onTogglePin: vi.fn(),
    onEdit: vi.fn(),
    jiraVersionUrl: null as string | null,
    onOpenInJira: vi.fn(),
  };
  const renderHeader = (over: Partial<typeof base> = {}) =>
    render(<ReleaseDetailHeader {...base} {...over} />);

  it('renders the name heading, one pill and the date', () => {
    renderHeader();
    const h = screen.getByRole('heading', { level: 2, name: '33.5.0' });
    expect(h).toHaveClass('text-xl', 'font-semibold');
    expect(screen.getAllByTestId('release-status-pill')).toHaveLength(1);
    expect(screen.getByText('In 3 days')).toBeInTheDocument();
    // Same stamp as the list row.
    expect(screen.getByText('Mon 02 Nov')).toBeInTheDocument();
    expect(screen.getByTestId('release-detail-header')).toBeInTheDocument();
  });

  it('omits the date text when there is no release date', () => {
    renderHeader({ releaseDate: undefined, pill: { tone: 'amber', label: 'No date' } });
    expect(screen.queryByText('Mon 02 Nov')).not.toBeInTheDocument();
  });

  it('toggles the package cell with showPackage', () => {
    const { unmount } = renderHeader({ showPackage: false });
    expect(screen.queryByTestId('row-deployment-package')).not.toBeInTheDocument();
    unmount();
    renderHeader({ showPackage: true });
    expect(screen.getByTestId('row-deployment-package')).toBeInTheDocument();
  });

  it('shows the done figure and graph label', () => {
    renderHeader();
    expect(screen.getByText('4 / 6 done')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '4 of 6 issues done' })).toBeInTheDocument();
  });

  it('pin button reflects state and fires onTogglePin', () => {
    const onTogglePin = vi.fn();
    const { unmount } = renderHeader({ onTogglePin });
    const pin = screen.getByRole('button', { name: 'Pin release' });
    expect(pin).toHaveTextContent('Pin');
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    unmount();
    renderHeader({ pinned: true });
    expect(screen.getByRole('button', { name: 'Unpin release' })).toHaveTextContent('Unpin');
  });

  it('Edit and Open in Jira buttons fire their callbacks', () => {
    const onEdit = vi.fn();
    const onOpenInJira = vi.fn();
    renderHeader({ onEdit, onOpenInJira, jiraVersionUrl: 'https://jira.example.com/v/1' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open in Jira' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onOpenInJira).toHaveBeenCalledTimes(1);
  });

  it('renders no v{id} line and no rocket icon', () => {
    const { container } = renderHeader();
    expect(screen.queryByText(/^v\d+$/)).not.toBeInTheDocument();
    expect(container.querySelector('.lucide-rocket')).toBeNull();
  });
});
