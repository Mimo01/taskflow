/**
 * TodayColumn.markdown.test.ts — Unit tests for generateTodayMarkdown MR sentence formatting.
 *
 * Covers:
 *   1. Participating MR nested under an In Progress story → sentence form with mrIid
 *   2. Reviewing MR nested under a story → sentence form
 *   3. Unmatched participating MR in standalone "Participating MRs" section → sentence form
 *   4. Old terse format "Participating: !" never appears in output
 */

import { describe, expect, it } from 'vitest';
import type { GitLabMR, ParticipatedMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import type { TodayMarkdownSources } from './TodayColumn';
import { generateTodayMarkdown } from './TodayColumn';

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makeJiraIssue(key: string): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary of ${key}`,
      status: {
        id: '1',
        name: 'In Progress',
        statusCategory: { key: 'indeterminate' },
      },
      assignee: { displayName: 'Test User' },
      issuetype: { name: 'Story', subtask: false },
      subtasks: [],
      parent: undefined,
      timetracking: {},
    },
  } as unknown as JiraIssue;
}

function makeReviewerMR(iid: number, title: string, key: string): GitLabMR {
  return {
    id: iid * 100,
    iid,
    project_id: 1,
    title: `[${key}] ${title}`,
    source_branch: `feature/${key}`,
    state: 'opened',
    author: { id: 99, name: 'Author', username: 'author', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-05-25T00:00:00Z',
    web_url: `https://gitlab.example.com/mr/${iid}`,
    labels: [],
    milestone: null,
  } as GitLabMR;
}

function makeParticipatingMR(mrIid: number, title: string, key: string): ParticipatedMR {
  return {
    projectId: 1,
    mrIid,
    title: `[${key}] ${title}`,
    commentCount: 1,
    lastCommentedAt: '2026-05-25T00:00:00Z',
    authoredByMe: false,
    approvedByMe: false,
    openThreadCount: 0,
    sourceBranch: `feature/${key}`,
    webUrl: `https://gitlab.example.com/mr/${mrIid}`,
  };
}

function makeUnmatchedParticipatingMR(mrIid: number, title: string): ParticipatedMR {
  return {
    projectId: 1,
    mrIid,
    title,
    commentCount: 2,
    lastCommentedAt: '2026-05-25T00:00:00Z',
    authoredByMe: false,
    approvedByMe: false,
    openThreadCount: 0,
    sourceBranch: 'feature/no-key-branch',
    webUrl: `https://gitlab.example.com/mr/${mrIid}`,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateTodayMarkdown — MR sentence formatting', () => {
  it('1. participating MR nested under In Progress story → sentence form', () => {
    const story = makeJiraIssue('PROJ-1');
    const participatingMR = makeParticipatingMR(3961, 'Fix login redirect', 'PROJ-1');

    const sources: TodayMarkdownSources = {
      sprintData: [story],
      reviewerMrsData: [] as GitLabMR[],
      participatingMrsData: [participatingMR],
      jiraUserDisplayName: 'Test User',
    };

    const output = generateTodayMarkdown(sources, '2026-05-25');

    expect(output).toContain('!3961');
    expect(output).toContain('Fix login redirect');
    // Must read as sentence: "Participated in MR !3961 (…)"
    expect(output).toContain('Participated in MR !3961');
    // Parenthesised title
    expect(output).toContain('(');
    // Old terse form must not appear
    expect(output).not.toContain('Participating: !');
  });

  it('2. reviewing MR nested under In Progress story → sentence form with "Reviewed MR"', () => {
    const story = makeJiraIssue('PROJ-2');
    const reviewerMR = makeReviewerMR(3962, 'Update auth flow', 'PROJ-2');

    const sources: TodayMarkdownSources = {
      sprintData: [story],
      reviewerMrsData: [reviewerMR],
      participatingMrsData: [] as ParticipatedMR[],
      jiraUserDisplayName: 'Test User',
    };

    const output = generateTodayMarkdown(sources, '2026-05-25');

    expect(output).toContain('!3962');
    // Must read as sentence: "Reviewed MR !3962 (…)"
    expect(output).toContain('Reviewed MR !3962');
    // Old terse form must not appear
    expect(output).not.toContain('Reviewing: !');
    expect(output).not.toContain('Participating: !');
  });

  it('3. unmatched participating MR in standalone section → sentence form using mrIid', () => {
    const unmatchedMR = makeUnmatchedParticipatingMR(4012, 'Update docs');

    const sources: TodayMarkdownSources = {
      sprintData: [] as JiraIssue[],
      reviewerMrsData: [] as GitLabMR[],
      participatingMrsData: [unmatchedMR],
      jiraUserDisplayName: 'Test User',
    };

    const output = generateTodayMarkdown(sources, '2026-05-25');

    // Section header preserved
    expect(output).toContain('### Participating MRs');
    // Sentence form with mrIid (4012)
    expect(output).toContain('Participated in MR !4012');
    expect(output).toContain('Update docs');
    // Old terse form "- !4012: title" must not appear
    expect(output).not.toContain('!4012:');
    expect(output).not.toContain('Participating: !');
  });

  it('4. old terse "Participating: !" string never appears in any output scenario', () => {
    const story = makeJiraIssue('PROJ-3');
    const participatingMR = makeParticipatingMR(5000, 'Implement thing', 'PROJ-3');
    const unmatchedMR = makeUnmatchedParticipatingMR(5001, 'Review notes');

    const sources: TodayMarkdownSources = {
      sprintData: [story],
      reviewerMrsData: [] as GitLabMR[],
      participatingMrsData: [participatingMR, unmatchedMR],
      jiraUserDisplayName: 'Test User',
    };

    const output = generateTodayMarkdown(sources, '2026-05-25');

    expect(output).not.toContain('Participating: !');
  });
});
