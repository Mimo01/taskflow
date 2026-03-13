/**
 * MrHealthPanel tests — DASH-02
 *
 * Tests Needs Review / Approved / Changes Requested count display
 * and empty state when no assigned MRs exist.
 *
 * RED state: MrHealthPanel component does not exist yet.
 * These tests will fail at import resolution — that is expected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock @tanstack/react-query (useQuery, useQueryClient)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useQueryClient: vi.fn().mockReturnValue({ getQueryData: vi.fn() }),
  };
});

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    activeJiraProject: 'PROJ',
    gitlabBaseUrl: 'https://gitlab.example.com',
  })),
}));

// Mock settings store
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => ({
    storyPointsFieldKey: 'customfield_10016',
  })),
}));

// Mock gitlab service
vi.mock('@/services/gitlab', () => ({
  validateGitLab: vi.fn().mockResolvedValue({ id: 42, name: 'Test User', username: 'testuser' }),
  fetchAssignedMRs: vi.fn().mockResolvedValue([]),
  fetchMRApprovals: vi.fn().mockResolvedValue({ approved_by: [], approved: false }),
}));

// Mock link engine
vi.mock('@/services/linkEngine', () => ({
  deriveReviewHealth: vi.fn().mockReturnValue('waiting_for_review'),
}));

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-gitlab-token'),
}));

// Helper: build a minimal GitLabMR fixture
function makeMR(iid: number, projectId = 1) {
  return {
    id: iid,
    iid,
    project_id: projectId,
    title: `MR ${iid}`,
    state: 'opened' as const,
    author: { id: 1, name: 'Author', username: 'author', avatar_url: '' },
    reviewers: [],
    updated_at: new Date().toISOString(),
    web_url: `https://gitlab.example.com/mr/${iid}`,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('MrHealthPanel (DASH-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('health bucket counts', () => {
    it.todo('shows correct Needs Review / Approved / Changes Requested counts from mr-health cache');
  });

  describe('empty state', () => {
    it.todo('shows "No open MRs" empty state when assigned MRs list is empty');
  });
});
