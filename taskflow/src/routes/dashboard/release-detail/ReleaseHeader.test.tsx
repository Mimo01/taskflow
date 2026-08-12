// UAT test 2 regression (Phase 91.1): opening the peek panel seeds this
// release's own breadcrumb entry, but the peek never changes the pathname — so
// the seeded entry is self-referential while the user is still on the release
// page. ReleaseDetailPage filters it out before rendering; these tests pin the
// header's contract that the trail it receives is rendered verbatim ahead of
// the static trailing release name, so a self-entry would visibly duplicate.

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseBreadcrumbHeader } from './ReleaseHeader';

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
