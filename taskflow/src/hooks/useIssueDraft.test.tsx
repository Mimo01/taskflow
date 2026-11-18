import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIssueDraftsStore } from '@/stores/issue-drafts.store';
import { DRAFT_DEBOUNCE_MS } from './useEditorDraft';
import { type DraftPayload, useIssueDraft } from './useIssueDraft';

let hydratedSpy: ReturnType<typeof vi.spyOn>;
let n = 0;

beforeEach(() => {
  vi.useFakeTimers();
  n = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `id-${++n}` });
  useIssueDraftsStore.setState({ drafts: {}, owner: null, saveFailed: false });
  hydratedSpy = vi.spyOn(useIssueDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
});

afterEach(() => {
  hydratedSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const payload = (name: string, hasContent = true): DraftPayload => ({
  projectKey: 'PROJ',
  snapshot: { epicName: name, description: '' },
  files: [],
  hasContent,
});
const drafts = () => useIssueDraftsStore.getState().drafts;

describe('useIssueDraft', () => {
  it('does not write or allocate an id without content (D-12)', () => {
    const { result } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    act(() => result.current.schedule(payload('', false)));
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2));
    act(() => result.current.flush());
    expect(drafts()).toEqual({});
    expect(result.current.draftId).toBeNull();
  });

  it('writes once after the debounce with a new uuid', () => {
    const { result } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    act(() => result.current.schedule(payload('a')));
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 1));
    expect(drafts()).toEqual({});
    act(() => vi.advanceTimersByTime(1));
    expect(Object.keys(drafts())).toEqual(['id-1']);
    expect(result.current.draftId).toBe('id-1');
    expect(drafts()['id-1'].kind).toBe('epic');
  });

  it('keeps saving empty payloads once an id exists', () => {
    const { result } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    act(() => result.current.schedule(payload('a')));
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS));
    act(() => result.current.schedule(payload('', false)));
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS));
    expect(drafts()['id-1'].snapshot).toEqual({ epicName: '', description: '' });
  });

  it('flush writes immediately and skips an unchanged snapshot', () => {
    const { result } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    const spy = vi.fn();
    const unsub = useIssueDraftsStore.subscribe(spy);
    act(() => {
      result.current.schedule(payload('a'));
      result.current.flush();
    });
    expect(spy).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.schedule(payload('a'));
      result.current.flush();
    });
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('does not write before hydration', () => {
    hydratedSpy.mockReturnValue(false);
    const { result, unmount } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    act(() => {
      result.current.schedule(payload('a'));
      result.current.flush();
    });
    expect(drafts()).toEqual({});
    unmount();
  });

  it('adopt targets an existing id; adopt(null) starts fresh and cancels pending', () => {
    const { result } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    act(() => result.current.adopt('abc'));
    act(() => {
      result.current.schedule(payload('a'));
      result.current.flush();
    });
    expect(Object.keys(drafts())).toEqual(['abc']);
    act(() => result.current.schedule(payload('b')));
    act(() => result.current.adopt(null));
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2));
    expect((drafts().abc.snapshot as { epicName: string }).epicName).toBe('a');
    act(() => {
      result.current.schedule(payload('c'));
      result.current.flush();
    });
    expect(Object.keys(drafts()).sort()).toEqual(['abc', 'id-1']);
  });

  it('discard cancels pending, removes the draft, returns it and resets the id', () => {
    const { result } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    act(() => {
      result.current.schedule(payload('a'));
      result.current.flush();
    });
    act(() => result.current.schedule(payload('b')));
    let removed: unknown;
    act(() => {
      removed = result.current.discard();
    });
    expect((removed as { id: string }).id).toBe('id-1');
    expect(drafts()).toEqual({});
    expect(result.current.draftId).toBeNull();
    act(() => {
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2);
      result.current.flush();
    });
    expect(drafts()).toEqual({});
  });

  it('ensureId allocates without writing', () => {
    const { result } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    let id = '';
    act(() => {
      id = result.current.ensureId();
    });
    expect(id).toBe('id-1');
    expect(result.current.draftId).toBe('id-1');
    expect(drafts()).toEqual({});
  });

  it('flushes on unmount and on visibility hidden', () => {
    const { result, unmount } = renderHook(() => useIssueDraft({ kind: 'epic' }));
    act(() => result.current.schedule(payload('a')));
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    spy.mockRestore();
    expect(Object.keys(drafts())).toEqual(['id-1']);
    act(() => result.current.schedule(payload('b')));
    unmount();
    expect((drafts()['id-1'].snapshot as { epicName: string }).epicName).toBe('b');
  });
});
