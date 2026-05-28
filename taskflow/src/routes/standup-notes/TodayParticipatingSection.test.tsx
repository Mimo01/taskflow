/**
 * TodayParticipatingSection tests
 *
 * Tests:
 *   1. Renders both titles + the count header when 2 items provided
 *   2. Returns null (section hidden) when items list is empty and not loading
 *   3. Shows "N open thread(s)" caption when openThreadCount > 0
 *   4. Shows "not approved" caption when openThreadCount === 0 and !approvedByMe
 *   5. Section header shows count when items are present
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParticipatedMR } from '@/services/gitlab';
import TodayParticipatingSection from './TodayParticipatingSection';

// ─── Fixture builder ──────────────────────────────────────────────────────────

function makeParticipatedMR(
  mrIid: number,
  title: string,
  overrides: Partial<ParticipatedMR> = {},
): ParticipatedMR {
  return {
    projectId: 99,
    mrIid,
    title,
    commentCount: 1,
    lastCommentedAt: '2026-05-25T08:00:00Z',
    authoredByMe: false,
    approvedByMe: false,
    openThreadCount: 1,
    sourceBranch: `feature/mr-${mrIid}`,
    webUrl: `https://gitlab.example.com/mr/${mrIid}`,
    ...overrides,
  };
}

// ─── Base props ───────────────────────────────────────────────────────────────

const BASE_PROPS = {
  isLoading: false,
  isError: false,
  error: null,
  onRetry: vi.fn(),
  onMRClick: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodayParticipatingSection', () => {
  it('renders both MR titles and the count in the header when 2 items are provided', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(101, 'Add login page'), makeParticipatedMR(202, 'Fix auth bug')]}
      />,
    );

    expect(screen.getByText('Add login page')).toBeInTheDocument();
    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
    expect(screen.getByText('Participating')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('returns null (no DOM output) when items list is empty and not loading', () => {
    const { container } = render(<TodayParticipatingSection {...BASE_PROPS} items={[]} />);

    expect(screen.queryByText(/Participating/)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('renders MR iid in mono format', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(555, 'Some MR title')]}
      />,
    );

    expect(screen.getByText('!555')).toBeInTheDocument();
  });

  it('shows "1 open thread" (singular) when openThreadCount=1', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(10, 'Some MR', { openThreadCount: 1, approvedByMe: false })]}
      />,
    );

    expect(screen.getByText('1 open thread')).toBeInTheDocument();
  });

  it('shows "3 open threads" (plural) when openThreadCount=3', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(10, 'Some MR', { openThreadCount: 3, approvedByMe: true })]}
      />,
    );

    expect(screen.getByText('3 open threads')).toBeInTheDocument();
  });

  it('shows "not approved" label when openThreadCount=0 and approvedByMe=false', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(20, 'Pending MR', { openThreadCount: 0, approvedByMe: false })]}
      />,
    );

    expect(screen.getByText('not approved')).toBeInTheDocument();
  });

  it('renders the header without count when items.length is 0 but isLoading=true', () => {
    render(<TodayParticipatingSection {...BASE_PROPS} isLoading={true} items={[]} />);

    // Section should still render (loading state), header without count
    expect(screen.getByText('Participating')).toBeInTheDocument();
  });

  it('renders section header with count=1 for single item', () => {
    render(
      <TodayParticipatingSection {...BASE_PROPS} items={[makeParticipatedMR(77, 'Single MR')]} />,
    );

    expect(screen.getByText('Participating')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
