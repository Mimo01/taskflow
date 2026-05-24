import { render, screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { GitLabCommit, GitLabUserMREvent } from '@/services/gitlab';
import type { JiraActivityItem } from '@/services/jira';
import type { TempoWorklog } from '@/services/tempo';
import YesterdayColumn from './YesterdayColumn';

// ─── Minimal UseQueryResult mock helpers ──────────────────────────────────────

function emptyQuery<T>(): UseQueryResult<T, Error> {
  return {
    data: [] as unknown as T,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<T, Error>;
}

const BASE_PROPS = {
  yesterdayDate: '2026-05-22',
  dateLabel: 'Thursday, May 22',
  tempoQuery: emptyQuery<TempoWorklog[]>(),
  jiraActivityQuery: emptyQuery<JiraActivityItem[]>(),
  commitsQuery: emptyQuery<GitLabCommit[]>(),
  mrEventsQuery: emptyQuery<GitLabUserMREvent[]>(),
  issueMeta: {},
  onIssueClick: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('YesterdayColumn — Tempo disabled branch (STAND-03)', () => {
  it('shows the Tempo-disabled notice when tempoEnabled=false', () => {
    render(<YesterdayColumn {...BASE_PROPS} tempoEnabled={false} />);
    expect(screen.getByText(/Tempo is disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable it in Settings/i)).toBeInTheDocument();
  });

  it('does NOT show the Tempo-disabled notice when tempoEnabled=true', () => {
    render(<YesterdayColumn {...BASE_PROPS} tempoEnabled={true} />);
    expect(screen.queryByText(/Tempo is disabled/i)).not.toBeInTheDocument();
  });
});
