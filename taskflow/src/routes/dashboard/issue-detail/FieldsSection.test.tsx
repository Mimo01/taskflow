/**
 * Tests for FieldsSection — priority icon and Severity MetaRow.
 *
 * These tests use the extractSeverity pure helper directly (for logic coverage)
 * and a minimal render test for the React output.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock all store / hook dependencies so FieldsSection renders without network or Tauri
vi.mock('@/stores/auth.store', () => {
  const state = {
    jiraBaseUrl: 'https://jira.example.com',
    jiraConnected: true,
    jiraUsername: 'testuser',
    jiraUserDisplayName: 'Test User',
    activeJiraProject: 'PROJ',
  };
  const useAuthStore = vi.fn((selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state,
  );
  (useAuthStore as any).getState = () => state;
  return { useAuthStore };
});

vi.mock('@/stores/settings.store', () => {
  const state = {
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
    storyPointsFieldKey: 'customfield_10016',
    epicColorFieldKey: 'customfield_10013',
  };
  return {
    useSettingsStore: vi.fn((selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
    ),
  };
});

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/hooks/useBoardId', () => ({
  useBoardId: vi.fn().mockReturnValue({ boardId: null }),
}));

vi.mock('@/services/jira/backlog', () => ({
  fetchSprintList: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/jira/sprints', () => ({
  addIssuesToSprint: vi.fn(),
  moveIssuesToBacklog: vi.fn(),
}));

vi.mock('@/services/jira/transitions', () => ({
  postTransition: vi.fn(),
}));

vi.mock('@/services/jira/versions', () => ({
  fetchFixVersions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../StatusPopover', () => ({
  default: ({ currentStatus }: { currentStatus: string }) => <span>{currentStatus}</span>,
}));

vi.mock('./WatcherToggle', () => ({
  WatcherToggle: () => null,
}));

vi.mock('./TimeTrackingSummary', () => ({
  TimeTrackingSummary: () => null,
}));

vi.mock('./OverdueBadge', () => ({
  OverdueBadge: () => null,
}));

vi.mock('./useFieldMutation', () => ({
  useFieldMutation: vi.fn().mockReturnValue({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    variables: undefined,
    data: undefined,
  }),
  useDebounce: vi.fn((fn: unknown) => fn),
}));

import type { JiraIssueDetail } from '@/services/jira';
import { extractSeverity } from './FieldsSection';

// --- Pure helper tests ---
describe('extractSeverity', () => {
  it('returns value when customfield_13415 has .value', () => {
    expect(extractSeverity({ value: 'Major' })).toBe('Major');
  });

  it('returns name when customfield_13415 has .name but no .value', () => {
    expect(extractSeverity({ name: 'Minor' })).toBe('Minor');
  });

  it('prefers .value over .name when both present', () => {
    expect(extractSeverity({ value: 'Critical', name: 'SomeName' })).toBe('Critical');
  });

  it('returns null for null input', () => {
    expect(extractSeverity(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(extractSeverity(undefined)).toBeNull();
  });

  it('returns null when both value and name are absent', () => {
    expect(extractSeverity({})).toBeNull();
  });
});

// --- Render tests ---
function makeIssue(overrides: Partial<JiraIssueDetail['fields']> = {}): JiraIssueDetail {
  return {
    id: 'PROJ-1',
    key: 'PROJ-1',
    fields: {
      summary: 'Test issue',
      description: null,
      status: { id: '1', name: 'Open', statusCategory: { key: 'new' } },
      issuetype: { name: 'Story', subtask: false },
      priority: { name: 'High' },
      assignee: { displayName: 'Jane', name: 'jane', avatarUrls: { '48x48': '' } },
      reporter: { displayName: 'John', name: 'john', avatarUrls: { '48x48': '' } },
      subtasks: [],
      issuelinks: [],
      comment: { comments: [] },
      labels: [],
      fixVersions: [],
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-03-01T00:00:00.000Z',
      duedate: null,
      customfield_10016: null,
      customfield_10014: null,
      customfield_10015: null,
      customfield_10020: null,
      ...overrides,
    },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function renderFieldsSection(issue: JiraIssueDetail) {
  const { FieldsSection } = await import('./FieldsSection');
  const mutation = {
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    variables: undefined,
    data: undefined,
  };
  render(
    <FieldsSection
      issue={issue}
      issueKey={issue.key}
      jiraBaseUrl="https://jira.example.com"
      storyPointsFieldKey="customfield_10016"
      epicLinkFieldKey="customfield_10014"
      epicNameFieldKey="customfield_10015"
      sprintFieldKey="customfield_10020"
      epicColorFieldKey="customfield_10013"
      mutation={mutation as any}
      epicIssue={null}
    />,
    { wrapper },
  );
}

describe('FieldsSection', () => {
  describe('Priority row', () => {
    it('renders priority icon img when iconUrl is present', async () => {
      const issue = makeIssue({
        priority: { name: 'High', iconUrl: 'http://example.com/icon.svg' },
      });
      await renderFieldsSection(issue);
      const img = screen.getByTestId('priority-icon');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('http://example.com/icon.svg');
    });

    it('renders priority name text without img when iconUrl is absent', async () => {
      const issue = makeIssue({ priority: { name: 'Low' } });
      await renderFieldsSection(issue);
      expect(screen.queryByTestId('priority-icon')).toBeNull();
      expect(screen.getByText('Low')).toBeTruthy();
    });
  });

  describe('Severity MetaRow', () => {
    it('renders Severity row with value from customfield_13415.value', async () => {
      const issue = makeIssue({ customfield_13415: { value: 'Major' } });
      await renderFieldsSection(issue);
      expect(screen.getByText('Severity')).toBeTruthy();
      expect(screen.getByText('Major')).toBeTruthy();
    });

    it('renders Severity row using .name when .value is absent', async () => {
      const issue = makeIssue({ customfield_13415: { name: 'Minor' } });
      await renderFieldsSection(issue);
      expect(screen.getByText('Severity')).toBeTruthy();
      expect(screen.getByText('Minor')).toBeTruthy();
    });

    it('does NOT render Severity row when customfield_13415 is null', async () => {
      const issue = makeIssue({ customfield_13415: null });
      await renderFieldsSection(issue);
      expect(screen.queryByText('Severity')).toBeNull();
    });

    it('does NOT render Severity row when customfield_13415 is undefined', async () => {
      const issue = makeIssue();
      await renderFieldsSection(issue);
      expect(screen.queryByText('Severity')).toBeNull();
    });
  });
});
