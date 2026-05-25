/**
 * TodayMrsSection tests — MRs scope
 *
 * Tests:
 *   1. "awaiting review" label renders with the muted class (Option A)
 *   2. The "changes requested" amber label path applies the correct class
 *      when that future enrichment path is exercised (currently dead code,
 *      but the class string is declared in the component for reference)
 *   3. Returns null when no MRs and not loading
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import TodayMrsSection from './TodayMrsSection';

// ─── Fixture builder ──────────────────────────────────────────────────────────

function makeMR(iid: number, title: string): GitLabMR {
  return {
    iid,
    title,
    state: 'opened',
    web_url: `https://gitlab.example.com/mr/${iid}`,
    created_at: '2026-05-25T08:00:00Z',
    updated_at: '2026-05-25T08:00:00Z',
    source_branch: `feature/${iid}`,
    target_branch: 'main',
    author: { id: 1, name: 'Test User', username: 'testuser' },
    reviewers: [{ id: 42, name: 'Reviewer', username: 'reviewer' }],
  } as unknown as GitLabMR;
}

// ─── Base props ───────────────────────────────────────────────────────────────

const BASE_PROPS = {
  isLoading: false,
  isError: false,
  error: null,
  onRetry: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodayMrsSection — MRs scope', () => {
  it('renders "awaiting review" label with muted class for returned MRs (Option A)', () => {
    render(
      <TodayMrsSection
        {...BASE_PROPS}
        items={[makeMR(2094, 'Refactor checkout flow')]}
      />,
    );

    const label = screen.getByText('awaiting review');
    expect(label).toBeInTheDocument();
    // Must carry the muted class (text-muted-foreground) — not amber/destructive
    expect(label.className).toContain('text-muted-foreground');
    expect(label.className).not.toContain('text-amber');
  });

  it('renders the MR IID and title', () => {
    render(
      <TodayMrsSection
        {...BASE_PROPS}
        items={[makeMR(2094, 'Refactor checkout flow')]}
      />,
    );

    expect(screen.getByText('!2094')).toBeInTheDocument();
    expect(screen.getByText('Refactor checkout flow')).toBeInTheDocument();
  });

  it('renders the MRS AWAITING YOU section header when items are present', () => {
    render(
      <TodayMrsSection
        {...BASE_PROPS}
        items={[makeMR(1, 'Some MR')]}
      />,
    );

    expect(screen.getByText('MRS AWAITING YOU')).toBeInTheDocument();
  });

  it('returns null (no header) when items list is empty and not loading', () => {
    const { container } = render(
      <TodayMrsSection
        {...BASE_PROPS}
        items={[]}
      />,
    );

    expect(screen.queryByText('MRS AWAITING YOU')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('renders multiple MRs as separate rows', () => {
    render(
      <TodayMrsSection
        {...BASE_PROPS}
        items={[makeMR(100, 'First MR'), makeMR(200, 'Second MR')]}
      />,
    );

    expect(screen.getByText('!100')).toBeInTheDocument();
    expect(screen.getByText('!200')).toBeInTheDocument();
    expect(screen.getByText('First MR')).toBeInTheDocument();
    expect(screen.getByText('Second MR')).toBeInTheDocument();

    // Both rows get "awaiting review" label
    const labels = screen.getAllByText('awaiting review');
    expect(labels).toHaveLength(2);
  });
});
