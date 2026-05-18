import { describe, expect, it } from 'vitest';
import { tryInternalPath } from './internalLinks';

const JIRA_CTX = {
  jiraBaseUrl: 'https://jira.example.com',
  gitlabBaseUrl: null,
  activeGitlabProject: null,
  activeGitlabProjectPath: null,
};

const GITLAB_CTX = {
  jiraBaseUrl: null,
  gitlabBaseUrl: 'https://gitlab.example.com',
  activeGitlabProject: 99,
  activeGitlabProjectPath: 'group/repo',
};

const BOTH_CTX = {
  jiraBaseUrl: 'https://jira.example.com',
  gitlabBaseUrl: 'https://gitlab.example.com',
  activeGitlabProject: 99,
  activeGitlabProjectPath: 'group/repo',
};

const NULL_CTX = {
  jiraBaseUrl: null,
  gitlabBaseUrl: null,
  activeGitlabProject: null,
  activeGitlabProjectPath: null,
};

describe('tryInternalPath — Jira browse URLs', () => {
  it('returns /issue/PROJ-12345 for a matching Jira browse URL', () => {
    expect(
      tryInternalPath('https://jira.example.com/browse/PROJ-12345', JIRA_CTX),
    ).toBe('/issue/PROJ-12345');
  });

  it('handles trailing slash on jiraBaseUrl', () => {
    expect(
      tryInternalPath('https://jira.example.com/browse/PROJ-12345', {
        ...JIRA_CTX,
        jiraBaseUrl: 'https://jira.example.com/',
      }),
    ).toBe('/issue/PROJ-12345');
  });

  it('handles trailing slash on href', () => {
    expect(
      tryInternalPath('https://jira.example.com/browse/PROJ-1/', JIRA_CTX),
    ).toBe('/issue/PROJ-1');
  });

  it('strips query string from Jira browse URL', () => {
    expect(
      tryInternalPath('https://jira.example.com/browse/PROJ-1?foo=bar', JIRA_CTX),
    ).toBe('/issue/PROJ-1');
  });

  it('returns null for Jira browse URL on wrong host', () => {
    expect(
      tryInternalPath('https://other-jira.example.com/browse/PROJ-12345', JIRA_CTX),
    ).toBeNull();
  });

  it('returns null for Jira non-browse URL (e.g. /secure/attachment)', () => {
    expect(
      tryInternalPath('https://jira.example.com/secure/attachment/123/file.png', JIRA_CTX),
    ).toBeNull();
  });

  it('returns null when jiraBaseUrl is null', () => {
    expect(
      tryInternalPath('https://jira.example.com/browse/PROJ-1', NULL_CTX),
    ).toBeNull();
  });
});

describe('tryInternalPath — GitLab MR URLs', () => {
  it('returns /mr/:projectId/:iid for a matching GitLab MR URL (path form group/repo)', () => {
    expect(
      tryInternalPath(
        'https://gitlab.example.com/group/repo/-/merge_requests/42',
        GITLAB_CTX,
      ),
    ).toBe('/mr/99/42');
  });

  it('normalizes activeGitlabProjectPath with spaces around slashes (display label form)', () => {
    // "Org / My Project" → normalized: "org/my project"
    // URL path segment: "org/my-project" → normalized: "org/my-project"
    // These differ after normalization so the result is null (safer than wrong navigation)
    expect(
      tryInternalPath(
        'https://gitlab.example.com/org/my-project/-/merge_requests/7',
        {
          ...GITLAB_CTX,
          activeGitlabProject: 12,
          activeGitlabProjectPath: 'Org / My Project',
        },
      ),
    ).toBeNull();
  });

  it('returns /mr/:projectId/:iid when normalized paths match exactly (display label with same slugs)', () => {
    // "Group / Repo" normalizes to "group/repo" which matches URL path "group/repo"
    expect(
      tryInternalPath(
        'https://gitlab.example.com/group/repo/-/merge_requests/42',
        {
          ...GITLAB_CTX,
          activeGitlabProjectPath: 'Group / Repo',
        },
      ),
    ).toBe('/mr/99/42');
  });

  it('returns null for GitLab MR URL with different group/project path', () => {
    expect(
      tryInternalPath(
        'https://gitlab.example.com/other/repo/-/merge_requests/1',
        GITLAB_CTX,
      ),
    ).toBeNull();
  });

  it('returns null when gitlabBaseUrl host differs', () => {
    expect(
      tryInternalPath(
        'https://other-gitlab.example.com/group/repo/-/merge_requests/1',
        GITLAB_CTX,
      ),
    ).toBeNull();
  });

  it('returns null when activeGitlabProject is null', () => {
    expect(
      tryInternalPath(
        'https://gitlab.example.com/group/repo/-/merge_requests/42',
        { ...GITLAB_CTX, activeGitlabProject: null },
      ),
    ).toBeNull();
  });

  it('returns null when gitlabBaseUrl is not configured', () => {
    expect(
      tryInternalPath(
        'https://gitlab.example.com/group/repo/-/merge_requests/42',
        NULL_CTX,
      ),
    ).toBeNull();
  });

  it('returns null for GitLab non-MR URL (issues)', () => {
    expect(
      tryInternalPath(
        'https://gitlab.example.com/group/repo/-/issues/5',
        GITLAB_CTX,
      ),
    ).toBeNull();
  });

  it('returns null for GitLab non-MR URL (pipelines)', () => {
    expect(
      tryInternalPath(
        'https://gitlab.example.com/group/repo/-/pipelines/9',
        GITLAB_CTX,
      ),
    ).toBeNull();
  });
});

describe('tryInternalPath — edge cases', () => {
  it('returns null for empty href', () => {
    expect(tryInternalPath('', BOTH_CTX)).toBeNull();
  });

  it('returns null for whitespace-only href', () => {
    expect(tryInternalPath('   ', BOTH_CTX)).toBeNull();
  });

  it('returns null for javascript: protocol (no parse attempt)', () => {
    expect(tryInternalPath('javascript:alert(1)', BOTH_CTX)).toBeNull();
  });

  it('returns null for malformed href that throws in new URL()', () => {
    expect(tryInternalPath('not a url %%invalid', BOTH_CTX)).toBeNull();
  });
});
