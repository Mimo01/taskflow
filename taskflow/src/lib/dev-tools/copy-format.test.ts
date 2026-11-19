import { describe, expect, it } from 'vitest';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { entriesToJson, entryToJson, entryToMarkdown } from './copy-format';

function entry(over: Partial<ApiLogEntry> = {}): ApiLogEntry {
  return {
    id: 'e1',
    timestamp: '2026-11-19T10:00:00.000Z',
    source: 'jira',
    method: 'GET',
    url: 'https://jira.example.com/rest/api/2/issue/ABC-1?private_token=sekret&x=1',
    requestHeaders: { Authorization: 'Bearer sekret', Accept: 'application/json' },
    status: 200,
    durationMs: 42,
    responseBody: '{"key":"ABC-1"}',
    operation: 'Get Issue',
    ...over,
  };
}

describe('entryToJson', () => {
  it('produces parseable, redacted JSON with structured bodies', () => {
    const out = entryToJson(
      entry({ requestHeaders: { Authorization: 'Bearer secret', 'X-Session-Id': 'abc' } }),
    );
    const parsed = JSON.parse(out);
    expect(parsed.requestHeaders.Authorization).toBe('[REDACTED]');
    expect(parsed.requestHeaders['X-Session-Id']).toBe('[REDACTED]');
    expect(parsed.url).toContain('private_token=REDACTED');
    expect(parsed.responseBody).toEqual({ key: 'ABC-1' });
    expect(out).not.toContain('sekret');
    expect(out).not.toContain('Bearer secret');
  });

  it('keeps non-JSON bodies as strings and redacts response headers', () => {
    const parsed = JSON.parse(
      entryToJson(entry({ responseBody: 'plain', responseHeaders: { 'set-cookie': 'sid=1' } })),
    );
    expect(parsed.responseBody).toBe('plain');
    expect(parsed.responseHeaders['set-cookie']).toBe('[REDACTED]');
  });

  it('entriesToJson is an array of the same shape', () => {
    const parsed = JSON.parse(entriesToJson([entry(), entry({ id: 'e2' })]));
    expect(parsed).toHaveLength(2);
    expect(parsed[1].id).toBe('e2');
  });
});

describe('entryToMarkdown', () => {
  it('has the heading, meta lines and a fenced response', () => {
    const md = entryToMarkdown(entry());
    expect(md.startsWith('### GET /rest/api/2/issue/ABC-1 → 200')).toBe(true);
    expect(md).toContain('42 ms');
    expect(md).toContain('- Operation: Get Issue');
    expect(md).toContain('```json');
    expect(md).not.toContain('sekret');
  });

  it('caps a large response with a truncated line', () => {
    const md = entryToMarkdown(entry({ responseBody: 'x'.repeat(10 * 1024) }));
    expect(md).toContain('… truncated (10.0 KB total)');
    expect(md.length).toBeLessThan(6000);
  });

  it('uses a longer fence when the body contains backticks', () => {
    const md = entryToMarkdown(entry({ responseBody: 'a ``` b' }));
    expect(md).toContain('````json');
  });

  it('notes an uncaptured response', () => {
    expect(entryToMarkdown(entry({ responseBody: '' }))).toContain('_Response body not captured_');
  });

  it('includes request body and error, and shows ERR for network failures', () => {
    const md = entryToMarkdown(
      entry({ method: 'POST', status: null, requestBody: '{"a":1}', error: 'timeout' }),
    );
    expect(md).toContain('→ ERR');
    expect(md).toContain('**Request body**');
    expect(md).toContain('- Error: timeout');
  });
});
