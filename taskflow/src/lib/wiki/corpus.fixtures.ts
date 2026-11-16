import type { AttachmentMap, UserMap } from './preprocess';

/**
 * Test-support only: the placeholder wiki corpus (Phase 96 D-09, D-12).
 * Imported by tests and the editor spike, never by app code. Every fixture is
 * placeholder-only data (D-10): example.com hosts, jdoe/asmith mentions.
 */

const RAW = import.meta.glob<string>('./__fixtures__/**/*.wiki', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** All fixtures, keyed by path relative to __fixtures__/, sorted by path. */
export const WIKI_CORPUS: ReadonlyArray<{ path: string; wiki: string }> = Object.entries(RAW)
  .map(([key, wiki]) => ({ path: key.replace('./__fixtures__/', ''), wiki }))
  .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

/** Placeholder user map matching the mention fixtures. */
export const HARNESS_USERS: UserMap = {
  jdoe: 'Jane Doe',
  asmith: 'Alex Smith',
  'placeholder-0001': 'Pat Placeholder',
};

/** Placeholder attachment map matching the attachment fixtures. */
export const HARNESS_ATTACHMENTS: AttachmentMap = {
  'diagram.png': 'https://jira.example.com/secure/attachment/10001/diagram.png',
  'screenshot.png': 'https://jira.example.com/secure/attachment/10002/screenshot.png',
  'spec.pdf': 'https://jira.example.com/secure/attachment/10003/spec.pdf',
};
