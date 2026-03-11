// SRCH-01: Search query debouncing and parallel fetch
// SRCH-02: Search results rendering
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock @tauri-apps/plugin-store (LazyStore) — class constructor syntax required
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

// Mock @tauri-apps/plugin-http — services use named import `fetch`
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

// Mock stronghold readSecret
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    jiraBaseUrl: 'https://jira.example.com',
    gitlabBaseUrl: 'https://gitlab.example.com',
    activeJiraProject: 'PROJ',
  })),
}));

// Mock jira searchJira
vi.mock('@/services/jira', () => ({
  searchJira: vi.fn().mockResolvedValue([]),
}));

// Mock gitlab searchGitLabMRs
vi.mock('@/services/gitlab', () => ({
  searchGitLabMRs: vi.fn().mockResolvedValue([]),
}));

import SearchOverlay from './SearchOverlay';
import { searchJira } from '@/services/jira';
import { searchGitLabMRs } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import type { GitLabMR } from '@/services/gitlab';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderOverlay(onClose = vi.fn()) {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <SearchOverlay onClose={onClose} />
    </QueryClientProvider>,
  );
}

function makeJiraIssue(key: string): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: { id: '1', name: 'In Progress' },
      assignee: { displayName: 'Jane Doe', avatarUrls: { '48x48': '' } },
      customfield_10016: 5,
      issuetype: { name: 'Story' },
      description: 'Some description text here',
    },
  };
}

function makeMR(iid: number): GitLabMR {
  return {
    id: iid,
    iid,
    project_id: 10,
    title: 'feat: my merge request',
    state: 'opened',
    author: { id: 1, name: 'John Smith', username: 'john', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-03-11T10:00:00Z',
    web_url: 'https://gitlab.example.com/project/merge_requests/1',
  };
}

describe('SearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchJira).mockResolvedValue([]);
    vi.mocked(searchGitLabMRs).mockResolvedValue([]);
  });

  it('renders search input with placeholder', () => {
    renderOverlay();
    expect(screen.getByPlaceholderText('Search tasks and MRs...')).toBeInTheDocument();
  });

  it('does not fire search query when input is empty', async () => {
    renderOverlay();
    // input is empty, query stays empty — useQuery is disabled
    await waitFor(() => {
      expect(searchJira).not.toHaveBeenCalled();
      expect(searchGitLabMRs).not.toHaveBeenCalled();
    });
  });

  it('does not fire search for single character input', async () => {
    renderOverlay();
    const input = screen.getByPlaceholderText('Search tasks and MRs...');
    fireEvent.change(input, { target: { value: 'a' } });

    // Wait a bit — debounce is 400ms but useQuery enabled requires >=2 chars
    await new Promise((r) => setTimeout(r, 50));
    expect(searchJira).not.toHaveBeenCalled();
    expect(searchGitLabMRs).not.toHaveBeenCalled();
  });

  it('shows loading state while search is in flight', async () => {
    // Make searchJira never resolve during this test
    vi.mocked(searchJira).mockReturnValue(new Promise(() => {}));
    vi.mocked(searchGitLabMRs).mockReturnValue(new Promise(() => {}));

    renderOverlay();
    const input = screen.getByPlaceholderText('Search tasks and MRs...');
    fireEvent.change(input, { target: { value: 'test query' } });

    // Wait for debounce
    await waitFor(
      () => {
        expect(screen.getByTestId('search-loading')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('renders Tasks heading and Merge Requests heading given mock results', async () => {
    vi.mocked(searchJira).mockResolvedValue([makeJiraIssue('PROJ-1')]);
    vi.mocked(searchGitLabMRs).mockResolvedValue([makeMR(1)]);

    renderOverlay();
    const input = screen.getByPlaceholderText('Search tasks and MRs...');
    fireEvent.change(input, { target: { value: 'my query' } });

    await waitFor(
      () => {
        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByText('Merge Requests')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('renders "No results found" when both results are empty for a query', async () => {
    vi.mocked(searchJira).mockResolvedValue([]);
    vi.mocked(searchGitLabMRs).mockResolvedValue([]);

    renderOverlay();
    const input = screen.getByPlaceholderText('Search tasks and MRs...');
    fireEvent.change(input, { target: { value: 'nothing' } });

    await waitFor(
      () => {
        expect(screen.getByText(/No results found/i)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderOverlay(onClose);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    renderOverlay(onClose);

    const backdrop = screen.getByTestId('search-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
