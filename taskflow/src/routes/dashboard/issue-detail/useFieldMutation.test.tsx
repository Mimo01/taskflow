import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import { useFieldMutation } from './useFieldMutation';

const { setIssueFlagged, updateIssueField } = vi.hoisted(() => ({
  setIssueFlagged: vi.fn().mockResolvedValue(undefined),
  updateIssueField: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/jira', () => ({
  setIssueFlagged,
  updateIssueField,
  invalidateGhAllData: vi.fn(),
  invalidateGhBacklogData: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useFieldMutation flagged routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ flaggedFieldKey: 'customfield_10200' });
  });

  it('flags via setIssueFlagged, not a field PUT', async () => {
    const { result } = renderHook(() => useFieldMutation('A-1', 'https://j'), { wrapper });
    result.current.mutate({ fieldName: 'customfield_10200', value: [{ value: 'Impediment' }] });
    await waitFor(() => expect(setIssueFlagged).toHaveBeenCalled());
    expect(setIssueFlagged.mock.calls[0].slice(0, 4)).toEqual(['https://j', 'tok', 'A-1', true]);
    expect(updateIssueField).not.toHaveBeenCalled();
  });

  it('unflags with null and leaves other fields on updateIssueField', async () => {
    const { result } = renderHook(() => useFieldMutation('A-1', 'https://j'), { wrapper });
    result.current.mutate({ fieldName: 'customfield_10200', value: null });
    await waitFor(() => expect(setIssueFlagged).toHaveBeenCalled());
    expect(setIssueFlagged.mock.calls[0][3]).toBe(false);
    result.current.mutate({ fieldName: 'priority', value: { name: 'High' } });
    await waitFor(() => expect(updateIssueField).toHaveBeenCalled());
  });
});
