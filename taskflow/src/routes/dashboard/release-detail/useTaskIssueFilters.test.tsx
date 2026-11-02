import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTaskIssueFilters } from './useTaskIssueFilters';

describe('useTaskIssueFilters', () => {
  it('toggle adds then removes a value', () => {
    const { result } = renderHook(() => useTaskIssueFilters('v1'));
    act(() => result.current.toggle('statuses', ['In Review']));
    expect([...result.current.statuses]).toEqual(['In Review']);
    act(() => result.current.toggle('statuses', ['In Review']));
    expect(result.current.statuses.size).toBe(0);
  });

  it('setters accept values and functional updates', () => {
    const { result } = renderHook(() => useTaskIssueFilters('v1'));
    act(() => result.current.setTypes(new Set(['Bug'])));
    act(() => result.current.setTypes((prev) => new Set([...prev, 'Task'])));
    expect([...result.current.types].sort()).toEqual(['Bug', 'Task']);
    act(() => result.current.setAssignees(new Set(['Alice'])));
    expect([...result.current.assignees]).toEqual(['Alice']);
  });

  it('a different scope starts empty', () => {
    const { result, rerender } = renderHook(({ s }) => useTaskIssueFilters(s), {
      initialProps: { s: 'v1' },
    });
    act(() => result.current.toggle('statuses', ['Open']));
    expect(result.current.statuses.size).toBe(1);
    rerender({ s: 'v2' });
    expect(result.current.statuses.size).toBe(0);
    act(() => result.current.toggle('types', ['Bug']));
    expect([...result.current.types]).toEqual(['Bug']);
    expect(result.current.statuses.size).toBe(0);
  });
});
