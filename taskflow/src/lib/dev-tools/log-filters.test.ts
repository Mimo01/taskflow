import { describe, expect, it } from 'vitest';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { facetOptions, filterLogs, searchHaystack, statusClass } from './log-filters';

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

const none = {
  search: '',
  sources: new Set<string>(),
  statuses: new Set<string>(),
  methods: new Set<string>(),
  operations: new Set<string>(),
};

describe('statusClass', () => {
  it('classifies statuses', () => {
    expect(statusClass(null)).toBe('error');
    expect(statusClass(204)).toBe('2xx');
    expect(statusClass(302)).toBe('3xx');
    expect(statusClass(404)).toBe('4xx');
    expect(statusClass(503)).toBe('5xx');
  });
});

describe('filterLogs', () => {
  const list = [
    e({ id: '1', operation: 'Load Issue' }),
    e({ id: '2', source: 'gitlab', method: 'POST', status: 500, requestBody: '{"Needle":1}' }),
    e({ id: '3', status: null, error: 'timeout', responseBody: 'hay needle hay' }),
  ];

  it('empty facets return everything', () => {
    expect(filterLogs(list, none)).toHaveLength(3);
  });

  it('search matches url, request body and response body case-insensitively', () => {
    expect(filterLogs(list, { ...none, search: 'abc-1' })).toHaveLength(3);
    expect(filterLogs(list, { ...none, search: 'NEEDLE' }).map((x) => x.id)).toEqual(['2', '3']);
  });

  it('does not build a regex from the search text', () => {
    expect(filterLogs(list, { ...none, search: '(' })).toEqual([]);
  });

  it('source, method and status facets', () => {
    expect(filterLogs(list, { ...none, sources: new Set(['gitlab']) }).map((x) => x.id)).toEqual([
      '2',
    ]);
    expect(filterLogs(list, { ...none, methods: new Set(['POST']) })).toHaveLength(1);
    expect(filterLogs(list, { ...none, statuses: new Set(['2xx']) }).map((x) => x.id)).toEqual([
      '1',
    ]);
  });

  it("status facet 'errors' matches null and >= 400", () => {
    expect(filterLogs(list, { ...none, statuses: new Set(['errors']) }).map((x) => x.id)).toEqual([
      '2',
      '3',
    ]);
  });

  it("operation facet supports '(none)'", () => {
    expect(filterLogs(list, { ...none, operations: new Set(['(none)']) }).map((x) => x.id)).toEqual(
      ['2', '3'],
    );
    expect(filterLogs(list, { ...none, operations: new Set(['Load Issue']) })).toHaveLength(1);
  });
});

describe('facetOptions', () => {
  it('returns sorted unique values with (none) when needed', () => {
    const opts = facetOptions([
      e({ source: 'jira', method: 'POST', operation: 'B' }),
      e({ source: 'aio', method: 'GET', operation: 'A' }),
      e({ source: 'jira', method: 'GET' }),
    ]);
    expect(opts.sources).toEqual(['aio', 'jira']);
    expect(opts.methods).toEqual(['GET', 'POST']);
    expect(opts.operations).toEqual(['(none)', 'A', 'B']);
  });

  it('omits (none) when every entry has an operation', () => {
    expect(facetOptions([e({ operation: 'A' })]).operations).toEqual(['A']);
  });
});

describe('searchHaystack', () => {
  it('is lowercase and cached per entry', () => {
    const entry = e({ url: 'https://J/Rest', requestBody: 'ReqBody', responseBody: 'RespBody' });
    const hay = searchHaystack(entry);
    expect(hay).toBe('https://j/rest\nreqbody\nrespbody');
    expect(searchHaystack(entry)).toBe(hay);
  });
});
