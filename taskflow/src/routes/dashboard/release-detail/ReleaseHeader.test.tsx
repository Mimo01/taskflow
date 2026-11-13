// Release header on the shared DetailHeader: identity (rocket + pill), 2-line h1 title, the
// meta/description/property strip in the collapsing extra slot, and the toolbar tools.

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleasePill } from '@/lib/release-list';
import { ReleaseDetailHeader, ReleaseDoneBar } from './ReleaseHeader';

vi.mock('@/lib/useDetectedBrowsers', () => ({ useDetectedBrowsers: () => [] }));

// The shared test setup's ResizeObserver mock reports 600px; the shared DetailHeader switches
// to its ⋯-only layout below 720px, so the suite pins a wide header.
function stubWidth(width: number) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as never);
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
}

describe('ReleaseDetailHeader', () => {
  beforeEach(() => stubWidth(1100));
  afterEach(() => vi.unstubAllGlobals());

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
    lastRefreshed: null as string | null,
    refreshing: false,
    onRefresh: vi.fn(),
  };
  const renderHeader = (over: Partial<typeof base> = {}) =>
    render(<ReleaseDetailHeader {...base} {...over} />);

  it('renders the name h1 (2-line clamp), one pill after the rocket, and the date', () => {
    renderHeader();
    const h = screen.getByRole('heading', { level: 1, name: '33.5.0' });
    expect(h).toHaveClass('text-xl', 'font-medium', 'line-clamp-2');
    expect(h).toHaveAttribute('title', '33.5.0');
    expect(screen.getAllByTestId('release-status-pill')).toHaveLength(1);
    expect(screen.getByText('In 3 days')).toBeInTheDocument();
    expect(screen.getByText('Mon 02 Nov')).toBeInTheDocument();
    // One bar: the shared header owns the border.
    expect(screen.getByTestId('release-detail-header')).toHaveClass('border-b');
    // Identity (rocket + pill) sits in the meta row, above the title.
    const rocket = document.querySelector('.lucide-rocket') as Element;
    const pill = screen.getByTestId('release-status-pill');
    expect(rocket.compareDocumentPosition(pill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pill.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows only the identity icon while the release is loading', () => {
    render(<ReleaseDetailHeader />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(document.querySelector('.lucide-rocket')).not.toBeNull();
  });

  it('puts the meta in the collapsing extra slot with the title', () => {
    renderHeader({ jiraDescription: 'Spring hardening release' });
    const grid = screen.getByRole('heading', { level: 1 }).parentElement?.parentElement;
    expect(grid).toContainElement(screen.getByTestId('release-header-date'));
    expect(grid).toContainElement(screen.getByText('Spring hardening release'));
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

  it('subtitle holds only date and package; facts form a separate property strip after the description', () => {
    renderHeader({
      showPackage: true,
      factItems: [
        { id: 'a', node: <span data-testid="fact-a">A</span> },
        { id: 'b', node: <span data-testid="fact-b">B</span> },
      ],
    });
    const line = screen.getByTestId('release-header-date').parentElement as HTMLElement;
    expect(within(line).getByTestId('row-deployment-package')).toBeInTheDocument();
    expect(within(line).queryByTestId('fact-a')).toBeNull();
    const strip = screen.getByTestId('release-property-strip');
    expect(within(strip).getByTestId('fact-a')).toBeInTheDocument();
    expect(within(strip).getByTestId('fact-b')).toBeInTheDocument();
    const separators = Array.from(line.children).filter((c) => c.textContent === '·');
    expect(separators).toHaveLength(1);
    expect(strip.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('renders no property strip without facts', () => {
    renderHeader({ factItems: [] });
    expect(screen.queryByTestId('release-property-strip')).toBeNull();
  });

  it('caps the description so an expanded one cannot swallow the page', () => {
    renderHeader({ jiraDescription: 'Spring hardening release' });
    expect(
      screen.getByText('Spring hardening release').closest('.max-h-\\[40vh\\]'),
    ).not.toBeNull();
  });

  it('Refresh is a secondary tool: the refreshed time lives in its tooltip, not in the row', () => {
    const onRefresh = vi.fn();
    const { unmount } = renderHeader({ lastRefreshed: '10:11:12', onRefresh });
    const refresh = screen.getByRole('button', { name: 'Refresh release' });
    expect(refresh).toHaveAttribute('title', 'Refresh release · Refreshed 10:11:12');
    expect(refresh).toHaveClass('hidden', '@[860px]:inline-flex');
    expect(screen.queryByText(/Refreshed:/)).toBeNull();
    fireEvent.click(refresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    unmount();
    const { container } = renderHeader({ refreshing: true });
    expect(screen.getByRole('button', { name: 'Refresh release' })).toBeDisabled();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('pin tool reflects state, reads Pin / Unpin and fires onTogglePin', () => {
    const onTogglePin = vi.fn();
    const { unmount } = renderHeader({ onTogglePin });
    const pin = screen.getByRole('button', { name: 'Pin release' });
    expect(pin).toHaveTextContent('Pin');
    expect(pin).not.toHaveTextContent('Pin release');
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    unmount();
    renderHeader({ pinned: true });
    expect(screen.getByRole('button', { name: 'Unpin release' })).toHaveTextContent('Unpin');
  });

  it('Edit is a primary tool (label from 860px) and fires onEdit', () => {
    const onEdit = vi.fn();
    renderHeader({ onEdit });
    fireEvent.click(screen.getByRole('button', { name: 'Edit release' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Edit').className).toContain('@[860px]:not-sr-only');
  });

  it('Open in Jira + Copy link appear only with a Jira version URL', () => {
    const { unmount } = renderHeader({ jiraVersionUrl: null });
    expect(screen.queryByRole('button', { name: 'Open in Jira' })).toBeNull();
    unmount();
    renderHeader({ jiraVersionUrl: 'https://jira.example.com/v/1' });
    expect(screen.getByRole('button', { name: 'Open in Jira' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Jira link' })).toBeInTheDocument();
  });

  it('renders no v{id} line and no countdown/done figure', () => {
    renderHeader();
    expect(screen.queryByText(/^v\d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ done$/)).not.toBeInTheDocument();
  });

  // UAT test 2 regression (Phase 91.1): the trail it receives is rendered verbatim, so the
  // caller must filter the seeded self-entry. The release itself is the identity, never a crumb.
  it('renders the trail as crumbs and names the release once', () => {
    render(
      <ReleaseDetailHeader
        {...base}
        nav={{
          trail: [{ path: '/releases', label: 'Releases' }],
          onBack: vi.fn(),
          onNavigate: vi.fn(),
        }}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Releases' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('heading', { name: '33.5.0' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '33.5.0' })).toBeNull();
  });
});

describe('ReleaseDoneBar', () => {
  it('shows the done figure and graph label without its own block chrome', () => {
    render(
      <ReleaseDoneBar
        breakdown={{ done: 4, indeterminate: 1, new: 1 }}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByTestId('release-done-bar')).not.toHaveClass('border-t');
    expect(screen.getByTestId('release-done-bar')).not.toHaveClass('px-6');
    expect(screen.getByTestId('release-done-bar')).not.toHaveClass('pt-4');
    expect(screen.getByTestId('release-done-figure')).toHaveTextContent('4 / 6 done');
    expect(screen.getByRole('img', { name: '4 of 6 issues done' })).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    render(<ReleaseDoneBar breakdown={undefined} loading error={false} />);
    expect(screen.getByTestId('release-graph-skeleton')).toBeInTheDocument();
  });
});
