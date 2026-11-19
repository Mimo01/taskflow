import { describe, expect, it } from 'vitest';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { buildCurl } from './curl';

const e = (p: Partial<ApiLogEntry>): ApiLogEntry => ({
  id: 'x',
  timestamp: '2026-11-19T10:00:00.000Z',
  source: 'jira',
  method: 'GET',
  url: 'https://j/rest/api/2/issue/ABC-1',
  requestHeaders: {},
  status: 200,
  durationMs: 10,
  responseBody: '',
  ...p,
});

describe('buildCurl', () => {
  it('plain GET has no -X', () => {
    const c = buildCurl(e({}));
    expect(c).toContain("'https://j/rest/api/2/issue/ABC-1'");
    expect(c).not.toContain('-X');
    expect(c.startsWith('curl')).toBe(true);
  });

  it('emits -X for non-GET', () => {
    expect(buildCurl(e({ method: 'PUT' }))).toContain("-X 'PUT'");
  });

  it('replaces Authorization with a source-specific placeholder', () => {
    for (const source of ['jira', 'aio', 'tempo'] as const) {
      const c = buildCurl(e({ source, requestHeaders: { Authorization: '[REDACTED]' } }));
      expect(c).toContain("-H 'Authorization: Bearer $JIRA_TOKEN'");
      expect(c).not.toContain('[REDACTED]');
    }
  });

  it('replaces PRIVATE-TOKEN with $GITLAB_TOKEN', () => {
    const c = buildCurl(e({ source: 'gitlab', requestHeaders: { 'private-token': '[REDACTED]' } }));
    expect(c).toContain("-H 'PRIVATE-TOKEN: $GITLAB_TOKEN'");
  });

  it('drops secret headers case-insensitively and keeps others', () => {
    const c = buildCurl(
      e({
        requestHeaders: {
          Cookie: 'a=b',
          'Set-Cookie': 'a=b',
          'X-Api-Key': 'k',
          'X-AUTH-TOKEN': 'k',
          'Proxy-Authorization': 'k',
          Accept: 'application/json',
        },
      }),
    );
    expect(c).not.toMatch(/cookie|x-api-key|x-auth-token|proxy-authorization/i);
    expect(c).toContain("-H 'Accept: application/json'");
  });

  it('scrubs token URL params', () => {
    const c = buildCurl(
      e({ url: 'https://g/api?private_token=abc&x=1&access_token=z&token=t&api_key=k' }),
    );
    expect(c).not.toMatch(/=(abc|z|t|k)(&|')/);
    expect(c).toContain('private_token=REDACTED');
    expect(c).toContain('x=1');
  });

  it('single-quotes and escapes embedded quotes in the body', () => {
    const c = buildCurl(e({ method: 'POST', requestBody: "it's" }));
    expect(c).toContain("--data-raw 'it'\\''s'");
  });

  it('omits a truncated body and prepends a comment', () => {
    const c = buildCurl(e({ method: 'POST', requestBody: '{"a":1\n[truncated]' }));
    expect(c).not.toContain('--data-raw');
    expect(c.startsWith('# request body truncated in log\n')).toBe(true);
  });
});
