import { LazyStore } from '@tauri-apps/plugin-store';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type IssueDraft, useIssueDraftsStore, useSortedIssueDrafts } from './issue-drafts.store';

const get = () => useIssueDraftsStore.getState();

function mk(id: string, updatedAt = 1): IssueDraft {
  return {
    id,
    kind: 'epic',
    updatedAt,
    projectKey: 'PROJ',
    files: [],
    snapshot: { epicName: `Epic ${id}`, description: '' },
  };
}

beforeEach(() => {
  useIssueDraftsStore.setState({ drafts: {}, owner: null, saveFailed: false });
});

describe('issue drafts store', () => {
  it('keeps several drafts at once', () => {
    get().upsertDraft(mk('a'));
    get().upsertDraft(mk('b'));
    expect(Object.keys(get().drafts).sort()).toEqual(['a', 'b']);
  });

  it('removeDraft returns the removed draft; unknown id returns undefined', () => {
    get().upsertDraft(mk('a'));
    expect(get().removeDraft('a')?.id).toBe('a');
    expect(get().drafts.a).toBeUndefined();
    expect(get().removeDraft('nope')).toBeUndefined();
  });

  it('restoreDraft puts a removed draft back unchanged', () => {
    const d = mk('a', 5);
    get().upsertDraft(d);
    const removed = get().removeDraft('a') as IssueDraft;
    get().restoreDraft(removed);
    expect(get().drafts.a).toEqual(d);
  });

  it('reconcileOwner adopts, keeps, or clears', () => {
    expect(get().reconcileOwner('u1')).toBe(false);
    expect(get().owner).toBe('u1');
    get().upsertDraft(mk('a'));
    expect(get().reconcileOwner('u1')).toBe(false);
    expect(get().drafts.a).toBeDefined();
    expect(get().reconcileOwner('u2')).toBe(true);
    expect(get().drafts).toEqual({});
    expect(get().owner).toBe('u2');
  });

  it('rehydrates after a restart from the same backing', async () => {
    get().upsertDraft(mk('a', 7));
    await new Promise((r) => setTimeout(r, 0));
    vi.resetModules();
    const mod = await import('./issue-drafts.store');
    await mod.useIssueDraftsStore.persist.rehydrate();
    expect(mod.useIssueDraftsStore.getState().drafts.a?.updatedAt).toBe(7);
  });

  it('drops malformed drafts and unsafe file refs on rehydrate (WR-05)', async () => {
    const good = {
      id: 'ok',
      kind: 'issue',
      updatedAt: 3,
      projectKey: 'PROJ',
      files: [
        { name: 'a.png', size: 1, type: 'image/png', path: 'issue-drafts/ok/1-a.png' },
        { name: 'evil', size: 1, type: '', path: 'issue-drafts/../../secret.txt' },
      ],
      snapshot: {
        selectedIssueType: 'Story',
        summary: 's',
        description: '',
        selectedAssignee: null,
        selectedAssigneeName: null,
        timeEstimate: '',
        priority: null,
        storyPoints: '',
        epicLinkKey: null,
        parentKey: null,
        labels: [],
        fixVersions: [{ id: '1', name: 'v1' }],
        customFieldValues: {},
        customFieldInputValues: {},
        customFieldNames: {},
        linkRows: [],
      },
    };
    const bad = { ...good, id: 'bad', snapshot: { ...good.snapshot, fixVersions: 'nope' } };
    await new LazyStore('issue-drafts.json').set(
      'issue-drafts-store',
      JSON.stringify({ state: { drafts: { ok: good, bad, junk: 42 }, owner: null }, version: 1 }),
    );
    await useIssueDraftsStore.persist.rehydrate();
    expect(Object.keys(get().drafts)).toEqual(['ok']);
    expect(get().drafts.ok.files.map((f) => f.name)).toEqual(['a.png']);
  });

  describe('epic draft sanitizer (D-09)', () => {
    const epic = (id: string, snapshot: Record<string, unknown>) => ({
      id,
      kind: 'epic',
      updatedAt: 1,
      projectKey: 'PROJ',
      files: [],
      snapshot,
    });
    const load = async (drafts: Record<string, unknown>) => {
      await new LazyStore('issue-drafts.json').set(
        'issue-drafts-store',
        JSON.stringify({ state: { drafts, owner: null }, version: 1 }),
      );
      await useIssueDraftsStore.persist.rehydrate();
    };

    it('keeps an old-shape epic draft', async () => {
      await load({ a: epic('a', { epicName: 'E', description: 'D' }) });
      expect(get().drafts.a.snapshot).toEqual({ epicName: 'E', description: 'D' });
    });

    it('keeps valid sidebar fields', async () => {
      const snap = {
        epicName: 'E',
        description: 'D',
        selectedAssignee: { name: 'bob', displayName: 'Bob', avatarUrl: null },
        selectedAssigneeName: 'Bob',
        priority: 'High',
        storyPoints: '3',
        labels: ['x'],
        fixVersions: [{ id: '1', name: 'v1' }],
        customFieldValues: { cf: '1' },
        customFieldInputValues: { cf: 'One' },
        customFieldNames: { cf: 'Field' },
      };
      await load({ a: epic('a', snap) });
      expect(get().drafts.a.snapshot).toEqual(snap);
    });

    it('strips malformed optional fields but keeps the draft', async () => {
      await load({
        a: epic('a', {
          epicName: 'E',
          description: 'D',
          labels: 'x',
          fixVersions: [{ id: 1 }],
          customFieldValues: { a: 2 },
          selectedAssignee: 'bob',
          priority: 3,
        }),
      });
      expect(get().drafts.a.snapshot).toEqual({ epicName: 'E', description: 'D' });
    });

    it('drops an epic draft missing epicName or description', async () => {
      await load({
        a: epic('a', { description: 'D' }),
        b: epic('b', { epicName: 'E' }),
      });
      expect(Object.keys(get().drafts)).toEqual([]);
    });
  });

  it('useSortedIssueDrafts is newest first and referentially stable', () => {
    get().upsertDraft(mk('old', 1));
    get().upsertDraft(mk('new', 9));
    const { result, rerender } = renderHook(() => useSortedIssueDrafts());
    expect(result.current.map((d) => d.id)).toEqual(['new', 'old']);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('a rejected write sets saveFailed, a later success clears it, and it is not persisted', async () => {
    const spy = vi.spyOn(LazyStore.prototype, 'set').mockRejectedValue(new Error('disk'));
    get().upsertDraft(mk('a'));
    await new Promise((r) => setTimeout(r, 0));
    expect(get().saveFailed).toBe(true);
    spy.mockRestore();
    get().upsertDraft(mk('b'));
    await new Promise((r) => setTimeout(r, 0));
    expect(get().saveFailed).toBe(false);
    const raw = await new LazyStore('issue-drafts.json').get<string>('issue-drafts-store');
    expect(raw).not.toContain('saveFailed');
  });
});
