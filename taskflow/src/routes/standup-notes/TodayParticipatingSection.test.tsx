/**
 * TodayParticipatingSection tests
 *
 * Tests:
 *   1. Renders both titles + the count header when 2 items provided
 *   2. Returns null (section hidden) when items list is empty and not loading
 *   3. Count label shows "1 comment" (singular) vs "2 comments" (plural)
 *   4. Section header shows count when items are present
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParticipatedMR } from '@/services/gitlab';
import TodayParticipatingSection from './TodayParticipatingSection';

// ─── Fixture builder ──────────────────────────────────────────────────────────

function makeParticipatedMR(
  mrIid: number,
  title: string,
  commentCount = 1,
): ParticipatedMR {
  return {
    projectId: 99,
    mrIid,
    title,
    commentCount,
    lastCommentedAt: '2026-05-25T08:00:00Z',
  };
}

// ─── Base props ───────────────────────────────────────────────────────────────

const BASE_PROPS = {
  isLoading: false,
  isError: false,
  error: null,
  onRetry: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodayParticipatingSection', () => {
  it('renders both MR titles and the count in the header when 2 items are provided', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[
          makeParticipatedMR(101, 'Add login page'),
          makeParticipatedMR(202, 'Fix auth bug'),
        ]}
      />,
    );

    expect(screen.getByText('Add login page')).toBeInTheDocument();
    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
    expect(screen.getByText('PARTICIPATING (2)')).toBeInTheDocument();
  });

  it('returns null (no DOM output) when items list is empty and not loading', () => {
    const { container } = render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[]}
      />,
    );

    expect(screen.queryByText(/PARTICIPATING/)).not.toBeInTheDocument();
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

  it('shows singular "1 comment" for commentCount=1', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(10, 'Some MR', 1)]}
      />,
    );

    expect(screen.getByText('1 comment')).toBeInTheDocument();
  });

  it('shows plural "3 comments" for commentCount=3', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(10, 'Some MR', 3)]}
      />,
    );

    expect(screen.getByText('3 comments')).toBeInTheDocument();
  });

  it('renders the header without count when items.length is 0 but isLoading=true', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        isLoading={true}
        items={[]}
      />,
    );

    // Section should still render (loading state), header without count
    expect(screen.getByText('PARTICIPATING')).toBeInTheDocument();
  });

  it('renders section header with count=1 for single item', () => {
    render(
      <TodayParticipatingSection
        {...BASE_PROPS}
        items={[makeParticipatedMR(77, 'Single MR')]}
      />,
    );

    expect(screen.getByText('PARTICIPATING (1)')).toBeInTheDocument();
  });
});
