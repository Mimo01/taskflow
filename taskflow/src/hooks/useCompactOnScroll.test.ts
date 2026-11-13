import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCompactOnScroll } from './useCompactOnScroll';

function scrollEvent(scrollTop: number, scrollHeight = 2000, clientHeight = 500) {
  return { currentTarget: { scrollTop, scrollHeight, clientHeight } } as never;
}

describe('useCompactOnScroll', () => {
  it('condenses past 16px and only expands again at 4px or less', () => {
    const { result } = renderHook(() => useCompactOnScroll('a'));
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](scrollEvent(16)));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](scrollEvent(17)));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](scrollEvent(5)));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](scrollEvent(4)));
    expect(result.current[0]).toBe(false);
  });

  it('expands when the reset key changes', () => {
    const { result, rerender } = renderHook(({ k }) => useCompactOnScroll(k), {
      initialProps: { k: 'a' },
    });
    act(() => result.current[1](scrollEvent(100)));
    expect(result.current[0]).toBe(true);
    rerender({ k: 'b' });
    expect(result.current[0]).toBe(false);
  });

  it('does not condense when the content overflows by no more than minOverflow', () => {
    const { result } = renderHook(() => useCompactOnScroll('a', { minOverflow: 200 }));
    act(() => result.current[1](scrollEvent(40, 650, 500)));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](scrollEvent(40, 800, 500)));
    expect(result.current[0]).toBe(true);
    // Leaving compact is unaffected by the overflow guard.
    act(() => result.current[1](scrollEvent(2, 650, 500)));
    expect(result.current[0]).toBe(false);
  });
});
