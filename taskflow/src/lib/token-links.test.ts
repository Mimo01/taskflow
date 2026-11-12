import { describe, expect, it } from 'vitest';
import { gitlabTokenUrl, jiraTokenUrl } from './token-links';

const GL = '/-/user_settings/personal_access_tokens/granular/new';

describe('gitlabTokenUrl', () => {
  it('opens the fine-grained token form', () => {
    expect(gitlabTokenUrl('https://gitlab.example.com')).toBe(`https://gitlab.example.com${GL}`);
  });
  it('normalises trailing slashes', () => {
    expect(gitlabTokenUrl('https://gitlab.example.com///')).toBe(
      gitlabTokenUrl('https://gitlab.example.com'),
    );
    expect(gitlabTokenUrl('https://gitlab.example.com///')).not.toContain('//-/');
  });
  it('keeps a context path', () => {
    expect(gitlabTokenUrl('https://host.example.com/gitlab/')).toContain(
      `https://host.example.com/gitlab${GL}`,
    );
  });
  it('drops query and fragment, trims whitespace', () => {
    const r = gitlabTokenUrl('  https://gitlab.example.com/?x=1#y ') as string;
    expect(r).not.toContain('x=1');
    expect(r).not.toContain('#y');
    expect(r.startsWith(`https://gitlab.example.com${GL}`)).toBe(true);
  });
  it('accepts localhost over http', () => {
    expect(gitlabTokenUrl('http://localhost:8080')).toContain(`http://localhost:8080${GL}`);
  });
  it('allows atlassian.net hosts (rule is Jira only)', () => {
    expect(gitlabTokenUrl('https://acme.atlassian.net')).not.toBeNull();
  });
});

describe('jiraTokenUrl', () => {
  it('opens the PAT tab with a literal colon and keeps context path', () => {
    expect(jiraTokenUrl('https://host.example.com/jira')).toBe(
      'https://host.example.com/jira/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens',
    );
  });
  it('returns null for Cloud hosts', () => {
    expect(jiraTokenUrl('https://acme.atlassian.net')).toBeNull();
    expect(jiraTokenUrl('https://ACME.Atlassian.net/')).toBeNull();
  });
});

describe.each([
  ['gitlab', gitlabTokenUrl],
  ['jira', jiraTokenUrl],
])('%s invalid input', (_n, fn) => {
  it.each([
    '',
    '   ',
    'not a url',
    'https://ji',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://gitlab.example.com',
  ])('returns null for %j', (input) => {
    expect(fn(input)).toBeNull();
  });
});
