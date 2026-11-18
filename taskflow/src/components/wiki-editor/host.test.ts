import { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getHost, getLocalPreview, setLocalPreview, useLocalPreview, WIKI_HOST_META } from './host';
import { makeEditor } from './test-utils';

describe('wiki host store', () => {
  it('returns defaults before any host is set', () => {
    const { editor } = makeEditor('');
    const h = getHost(editor);
    expect(h.attachments).toEqual([]);
    expect(h.userMap).toEqual({});
    expect(h.staged).toBe(false);
    expect(h.queryClient).toBeUndefined();
  });

  it('exposes the host and query client after set', () => {
    const { editor } = makeEditor('');
    const qc = new QueryClient();
    editor.storage.wikiHost.set({ projectKey: 'DEMO' }, qc);
    expect(getHost(editor).projectKey).toBe('DEMO');
    expect(getHost(editor).queryClient).toBe(qc);
  });

  it('notifies once per set and keeps a stable snapshot for identical values', () => {
    const { editor } = makeEditor('');
    const store = editor.storage.wikiHost;
    const fn = vi.fn();
    store.subscribe(fn);
    store.set({ projectKey: 'DEMO' }, undefined);
    expect(fn).toHaveBeenCalledTimes(1);
    const snap = store.get();
    store.set({ projectKey: 'DEMO' }, undefined);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(snap);
  });

  it('dispatches WIKI_HOST_META only when the project or issue prefix changes', () => {
    const { editor } = makeEditor('');
    const metas: unknown[] = [];
    editor.on('transaction', ({ transaction }) => {
      if (transaction.getMeta(WIKI_HOST_META)) {
        metas.push(transaction.getMeta('addToHistory'));
      }
    });
    const store = editor.storage.wikiHost;
    store.set({ projectKey: 'DEMO' }, undefined);
    expect(metas).toEqual([false]);
    store.set({ projectKey: 'DEMO', staged: true }, undefined);
    expect(metas).toHaveLength(1);
    store.set({ projectKey: 'OTHER' }, undefined);
    expect(metas).toHaveLength(2);
  });

  it('stores local previews, notifies, and revokes blob urls on destroy', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { editor } = makeEditor('');
    const store = editor.storage.wikiHost;
    const fn = vi.fn();
    store.subscribe(fn);
    const before = store.get();
    setLocalPreview(editor, 'a.png', 'blob:x');
    setLocalPreview(editor, 'b.png', 'https://example.test/b.png');
    expect(getLocalPreview(editor, 'a.png')).toBe('blob:x');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(store.get()).not.toBe(before);
    editor.destroy();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    revoke.mockRestore();
  });

  it('keeps independent stores per editor', () => {
    const a = makeEditor('').editor;
    const b = makeEditor('').editor;
    a.storage.wikiHost.set({ projectKey: 'A' }, undefined);
    expect(getHost(b).projectKey).toBeUndefined();
  });
});

describe('preview lookups', () => {
  it('setLocalPreview reports false on a destroyed editor instead of throwing', () => {
    const { editor } = makeEditor('');
    editor.destroy();
    expect(setLocalPreview(editor, 'a.png', 'blob:x')).toBe(false);
  });

  it('useLocalPreview re-renders when a preview is registered after mount', () => {
    const { editor } = makeEditor('');
    const { result } = renderHook(() => useLocalPreview(editor, 'late.png'));
    expect(result.current).toBeUndefined();
    act(() => {
      setLocalPreview(editor, 'late.png', 'blob:late');
    });
    expect(result.current).toBe('blob:late');
  });
});
