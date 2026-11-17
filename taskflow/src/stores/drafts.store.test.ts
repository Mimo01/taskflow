import { LazyStore } from '@tauri-apps/plugin-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { draftKey } from '@/lib/draft-keys';
import { commentEditDraftsFor, useDraftsStore } from './drafts.store';

const get = () => useDraftsStore.getState();

beforeEach(() => {
  useDraftsStore.setState({ drafts: {}, owner: null });
});

describe('draftKey', () => {
  it('builds exact key strings', () => {
    expect(draftKey.commentNew('PROJ-1')).toBe('comment:new:PROJ-1');
    expect(draftKey.commentEdit('10042')).toBe('comment:edit:10042');
    expect(draftKey.description('PROJ-1')).toBe('description:PROJ-1');
  });
});

describe('setDraft', () => {
  it('stores nothing for a blank new comment and removes an existing entry', () => {
    const k = draftKey.commentNew('PROJ-1');
    get().setDraft(k, { kind: 'comment-new', issueKey: 'PROJ-1', text: 'hi' });
    expect(get().drafts[k]).toBeDefined();
    get().setDraft(k, { kind: 'comment-new', issueKey: 'PROJ-1', text: '  ' });
    expect(get().drafts[k]).toBeUndefined();
  });

  it('drops a draft equal to its base and stores a changed one', () => {
    const k = draftKey.commentEdit('1');
    get().setDraft(k, { kind: 'comment-edit', issueKey: 'PROJ-1', text: 'ab', base: 'a' });
    expect(get().drafts[k]).toMatchObject({
      text: 'ab',
      base: 'a',
      issueKey: 'PROJ-1',
      kind: 'comment-edit',
    });
    expect(typeof get().drafts[k].updatedAt).toBe('number');
    get().setDraft(k, { kind: 'comment-edit', issueKey: 'PROJ-1', text: 'a', base: 'a' });
    expect(get().drafts[k]).toBeUndefined();
  });
});

describe('clearing', () => {
  const seed = () => {
    get().setDraft('comment:new:PROJ-1', { kind: 'comment-new', issueKey: 'PROJ-1', text: 'x' });
    get().setDraft('description:PROJ-1', { kind: 'description', issueKey: 'PROJ-1', text: 'x' });
    get().setDraft('description:PROJ-2', { kind: 'description', issueKey: 'PROJ-2', text: 'x' });
    for (const id of ['1', '2', '3']) {
      get().setDraft(`comment:edit:${id}`, {
        kind: 'comment-edit',
        issueKey: 'PROJ-1',
        text: 'new',
        base: 'old',
      });
    }
  };

  it('clearDraft removes one entry', () => {
    seed();
    get().clearDraft('comment:new:PROJ-1');
    expect(get().drafts['comment:new:PROJ-1']).toBeUndefined();
    expect(get().drafts['description:PROJ-1']).toBeDefined();
  });

  it('clearIssue removes every entry of that issue', () => {
    seed();
    get().clearIssue('PROJ-1');
    expect(Object.keys(get().drafts)).toEqual(['description:PROJ-2']);
  });

  it('pruneCommentEdits drops edits of vanished comments only', () => {
    seed();
    get().pruneCommentEdits('PROJ-1', ['1', '2']);
    expect(get().drafts['comment:edit:3']).toBeUndefined();
    expect(get().drafts['comment:edit:1']).toBeDefined();
    expect(get().drafts['description:PROJ-2']).toBeDefined();
    expect(get().drafts['comment:new:PROJ-1']).toBeDefined();
  });

  it('commentEditDraftsFor lists edits of one issue', () => {
    seed();
    const res = commentEditDraftsFor(get().drafts, 'PROJ-1');
    expect(res.map(([id]) => id).sort()).toEqual(['1', '2', '3']);
    expect(commentEditDraftsFor(get().drafts, 'PROJ-2')).toEqual([]);
  });
});

describe('reconcileOwner', () => {
  const addDraft = () =>
    get().setDraft('description:PROJ-1', { kind: 'description', issueKey: 'PROJ-1', text: 'x' });

  it('sets owner when null and keeps drafts', () => {
    addDraft();
    get().reconcileOwner('url|alice');
    expect(get().owner).toBe('url|alice');
    expect(Object.keys(get().drafts)).toHaveLength(1);
  });

  it('keeps drafts for the same owner', () => {
    get().reconcileOwner('url|alice');
    addDraft();
    get().reconcileOwner('url|alice');
    expect(Object.keys(get().drafts)).toHaveLength(1);
  });

  it('clears drafts for a different owner', () => {
    get().reconcileOwner('url|alice');
    addDraft();
    get().reconcileOwner('url|bob');
    expect(get().drafts).toEqual({});
    expect(get().owner).toBe('url|bob');
  });
});

describe('persistence', () => {
  it('rehydrates drafts and owner from the Tauri store', async () => {
    const raw = {
      state: {
        drafts: {
          'description:PROJ-1': {
            kind: 'description',
            issueKey: 'PROJ-1',
            text: 'keep',
            updatedAt: 1,
          },
        },
        owner: 'url|alice',
      },
      version: 1,
    };
    await new LazyStore('drafts.json').set('drafts-store', JSON.stringify(raw));
    await useDraftsStore.persist.rehydrate();
    expect(get().drafts['description:PROJ-1']?.text).toBe('keep');
    expect(get().owner).toBe('url|alice');
  });

  it('persists only drafts and owner', async () => {
    get().reconcileOwner('url|alice');
    await new Promise((r) => setTimeout(r, 0));
    const stored = await new LazyStore('drafts.json').get<string>('drafts-store');
    expect(Object.keys(JSON.parse(stored as string).state).sort()).toEqual(['drafts', 'owner']);
  });
});
