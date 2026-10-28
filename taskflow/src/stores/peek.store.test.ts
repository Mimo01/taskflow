import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useIsPeeked, usePeekStore } from './peek.store';

describe('peek store', () => {
  beforeEach(() => {
    usePeekStore.setState({ peekIssueKey: null });
  });

  it('sets and clears the peek key', () => {
    act(() => usePeekStore.getState().setPeekIssueKey('ABC-1'));
    expect(usePeekStore.getState().peekIssueKey).toBe('ABC-1');
    act(() => usePeekStore.getState().setPeekIssueKey(null));
    expect(usePeekStore.getState().peekIssueKey).toBeNull();
  });

  it('useIsPeeked tracks the store', () => {
    const { result } = renderHook(() => useIsPeeked('ABC-1'));
    const other = renderHook(() => useIsPeeked('ABC-2'));
    expect(result.current).toBe(false);
    act(() => usePeekStore.getState().setPeekIssueKey('ABC-1'));
    expect(result.current).toBe(true);
    expect(other.result.current).toBe(false);
    act(() => usePeekStore.getState().setPeekIssueKey(null));
    expect(result.current).toBe(false);
  });
});
