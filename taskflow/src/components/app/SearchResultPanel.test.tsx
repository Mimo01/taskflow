// SRCH-02: Search result panel display for Jira tasks and GitLab MRs
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock @tauri-apps/plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

// Mock @tauri-apps/plugin-store (LazyStore) — class constructor syntax
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import SearchResultPanel from './SearchResultPanel';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { JiraIssue } from '@/services/jira';
import type { GitLabMR } from '@/services/gitlab';

const JIRA_BASE = 'https://jira.example.com';

function makeJiraIssue(overrides: Partial<JiraIssue['fields']> = {}): JiraIssue {
  return {
    id: 'PROJ-42',
    key: 'PROJ-42',
    fields: {
      summary: 'Implement search overlay',
      status: { id: '3', name: 'In Progress' },
      assignee: { displayName: 'Jane Doe', avatarUrls: { '48x48': '' } },
      customfield_10016: 8,
      issuetype: { name: 'Story' },
      description: 'This is a description of the issue that contains important information.',
      ...overrides,
    },
  };
}

function makeMR(overrides: Partial<GitLabMR> = {}): GitLabMR {
  return {
    id: 101,
    iid: 5,
    project_id: 10,
    title: 'feat: my merge request',
    state: 'opened',
    author: { id: 1, name: 'John Smith', username: 'john', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-03-11T10:00:00Z',
    web_url: 'https://gitlab.example.com/project/merge_requests/5',
    ...overrides,
  };
}

describe('SearchResultPanel — Jira', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders issue key and summary', () => {
    render(
      <SearchResultPanel
        result={makeJiraIssue()}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('PROJ-42')).toBeInTheDocument();
    expect(screen.getByText('Implement search overlay')).toBeInTheDocument();
  });

  it('renders status name', () => {
    render(
      <SearchResultPanel
        result={makeJiraIssue()}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders assignee displayName', () => {
    render(
      <SearchResultPanel
        result={makeJiraIssue()}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders story points when set', () => {
    render(
      <SearchResultPanel
        result={makeJiraIssue()}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('8 pts')).toBeInTheDocument();
  });

  it('renders description excerpt (first 200 chars)', () => {
    const longDesc = 'A'.repeat(300);
    render(
      <SearchResultPanel
        result={makeJiraIssue({ description: longDesc })}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
  });

  it('renders "Unassigned" when assignee is null', () => {
    render(
      <SearchResultPanel
        result={makeJiraIssue({ assignee: null })}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('does not render description section when description is null', () => {
    render(
      <SearchResultPanel
        result={makeJiraIssue({ description: null })}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    // The description text "null" should not appear
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    // The description paragraph element should not exist
    expect(document.querySelector('p.text-xs.text-muted-foreground.line-clamp-3')).toBeNull();
  });

  it('calls openUrl with browse URL when "Open in Jira" button is clicked', () => {
    render(
      <SearchResultPanel
        result={makeJiraIssue()}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open in Jira' }));
    expect(openUrl).toHaveBeenCalledWith(`${JIRA_BASE}/browse/PROJ-42`);
  });

  it('calls onBack when Back button is clicked', () => {
    const onBack = vi.fn();
    render(
      <SearchResultPanel
        result={makeJiraIssue()}
        type="jira"
        jiraBaseUrl={JIRA_BASE}
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('SearchResultPanel — GitLab MR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders MR iid and title', () => {
    render(
      <SearchResultPanel
        result={makeMR()}
        type="gitlab"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('!5')).toBeInTheDocument();
    expect(screen.getByText('feat: my merge request')).toBeInTheDocument();
  });

  it('renders MR state badge', () => {
    render(
      <SearchResultPanel
        result={makeMR({ state: 'merged' })}
        type="gitlab"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('merged')).toBeInTheDocument();
  });

  it('renders author name', () => {
    render(
      <SearchResultPanel
        result={makeMR()}
        type="gitlab"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('renders linked task key chip when title contains a ticket key', () => {
    render(
      <SearchResultPanel
        result={makeMR({ title: 'PROJ-123 feat: add auth' })}
        type="gitlab"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('PROJ-123')).toBeInTheDocument();
  });

  it('does not render a ticket key chip when title has no ticket key', () => {
    render(
      <SearchResultPanel
        result={makeMR({ title: 'feat: no ticket here' })}
        type="gitlab"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    // chip would be inside an orange badge, not just text
    const badges = document.querySelectorAll('.bg-orange-100');
    expect(badges.length).toBe(0);
  });

  it('calls openUrl with mr.web_url when "Open in GitLab" is clicked', () => {
    const mr = makeMR();
    render(
      <SearchResultPanel
        result={mr}
        type="gitlab"
        jiraBaseUrl={JIRA_BASE}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open in GitLab' }));
    expect(openUrl).toHaveBeenCalledWith(mr.web_url);
  });

  it('calls onBack when Back button is clicked', () => {
    const onBack = vi.fn();
    render(
      <SearchResultPanel
        result={makeMR()}
        type="gitlab"
        jiraBaseUrl={JIRA_BASE}
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
