import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftsStore } from '@/stores/drafts.store';
import { DRAFT_DEBOUNCE_MS, useEditorDraft } from './useEditorDraft';

const KEY = 'comment:new:PROJ-1';
const args = { key: KEY, kind: 'comment-new' as const, issueKey: 'PROJ-1' };

let hydratedSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  useDraftsStore.setState({ drafts: {}, owner: null });
  hydratedSpy = vi.spyOn(useDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
});

afterEach(() => {
  hydratedSpy.mockRestore();
  vi.useRealTimers();
});

const stored = () => useDraftsStore.getState().drafts[KEY];

describe('useEditorDraft', () => {
  it('is inert with a null key', () => {
    const { result } = renderHook(() => useEditorDraft({ ...args, key: null }));
    act(() => {
      result.current.schedule('hello');
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2);
      result.current.flush();
    });
    expect(useDraftsStore.getState().drafts).toEqual({});
    expect(result.current.draft).toBeUndefined();
    expect(result.current.state).toBeNull();
  });

  it('debounces writes by 500 ms', () => {
    const { result } = renderHook(() => useEditorDraft(args));
    act(() => result.current.schedule('a'));
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 1));
    expect(stored()).toBeUndefined();
    act(() => result.current.schedule('ab'));
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS - 1));
    expect(stored()).toBeUndefined();
    act(() => vi.advanceTimersByTime(1));
    expect(stored()?.text).toBe('ab');
    expect(result.current.state).toBe('draft');
  });

  it('flush writes immediately and cancels the timer; no-op when nothing pending', () => {
    const { result } = renderHook(() => useEditorDraft(args));
    act(() => result.current.flush());
    expect(stored()).toBeUndefined();
    act(() => {
      result.current.schedule('now');
      result.current.flush();
    });
    expect(stored()?.text).toBe('now');
    const writes = vi.fn();
    const unsub = useDraftsStore.subscribe(writes);
    act(() => vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2));
    unsub();
    expect(writes).not.toHaveBeenCalled();
  });

  it('flushes a pending write on unmount', () => {
    const { result, unmount } = renderHook(() => useEditorDraft(args));
    act(() => result.current.schedule('bye'));
    unmount();
    expect(stored()?.text).toBe('bye');
  });

  it('flushes on visibilitychange hidden', () => {
    const { result } = renderHook(() => useEditorDraft(args));
    act(() => result.current.schedule('hidden'));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(stored()?.text).toBe('hidden');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('never writes before hydration, then writes after', () => {
    useDraftsStore.setState({
      drafts: { [KEY]: { kind: 'comment-new', issueKey: 'PROJ-1', text: 'old', updatedAt: 1 } },
    });
    hydratedSpy.mockReturnValue(false);
    const { result } = renderHook(() => useEditorDraft(args));
    act(() => {
      result.current.schedule('');
      result.current.flush();
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2);
    });
    expect(stored()?.text).toBe('old');
    hydratedSpy.mockReturnValue(true);
    act(() => {
      result.current.schedule('new');
      result.current.flush();
    });
    expect(stored()?.text).toBe('new');
  });

  it('reports stale when live Jira text differs from the draft base', () => {
    const editKey = 'comment:edit:1';
    useDraftsStore.setState({
      drafts: {
        [editKey]: {
          kind: 'comment-edit',
          issueKey: 'PROJ-1',
          text: 'mine',
          base: 'orig',
          updatedAt: 1,
        },
      },
    });
    const edit = { key: editKey, kind: 'comment-edit' as const, issueKey: 'PROJ-1', base: 'orig' };
    const same = renderHook(() => useEditorDraft({ ...edit, liveBase: 'orig' }));
    expect(same.result.current.state).toBe('draft');
    const changed = renderHook(() => useEditorDraft({ ...edit, liveBase: 'edited elsewhere' }));
    expect(changed.result.current.state).toBe('stale');
    const unknown = renderHook(() => useEditorDraft({ ...edit, liveBase: null }));
    expect(unknown.result.current.state).toBe('draft');
  });

  it('discard cancels a pending write and removes the draft', () => {
    const { result } = renderHook(() => useEditorDraft(args));
    act(() => {
      result.current.schedule('keep');
      result.current.flush();
    });
    expect(stored()).toBeDefined();
    act(() => {
      result.current.schedule('later');
      result.current.discard();
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2);
    });
    expect(stored()).toBeUndefined();
  });

  it('does not write when the text equals the stored draft', () => {
    const { result } = renderHook(() => useEditorDraft(args));
    act(() => {
      result.current.schedule('same');
      result.current.flush();
    });
    const writes = vi.fn();
    const unsub = useDraftsStore.subscribe(writes);
    act(() => {
      result.current.schedule('same');
      result.current.flush();
    });
    unsub();
    expect(writes).not.toHaveBeenCalled();
  });
});
