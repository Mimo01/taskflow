import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { useDraftsStore } from '@/stores/drafts.store';
import { useIssueDraftsStore } from '@/stores/issue-drafts.store';
import { draftOwnerFrom, useDraftsAccountGuard } from './useDraftsAccountGuard';

vi.mock('@/lib/issue-draft-files', () => ({
  purgeAllDraftFiles: vi.fn(() => Promise.resolve()),
  purgeOrphanDraftFiles: vi.fn(() => Promise.resolve()),
}));

function setAuth(jiraBaseUrl: string | null, jiraUsername: string | null) {
  act(() => {
    useAuthStore.setState({ jiraBaseUrl, jiraUsername, _hasHydrated: true });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useDraftsStore.setState({ drafts: {}, owner: null });
  useIssueDraftsStore.setState({ drafts: {}, owner: null });
  useAuthStore.setState({ jiraBaseUrl: null, jiraUsername: null, _hasHydrated: true });
});

describe('draftOwnerFrom', () => {
  it('is null unless both parts exist', () => {
    expect(draftOwnerFrom({ jiraBaseUrl: 'u', jiraUsername: null })).toBeNull();
    expect(draftOwnerFrom({ jiraBaseUrl: null, jiraUsername: 'a' })).toBeNull();
    expect(draftOwnerFrom({ jiraBaseUrl: 'u', jiraUsername: 'a' })).toBe('u|a');
  });
});

describe('useDraftsAccountGuard', () => {
  it('does nothing without credentials', () => {
    renderHook(() => useDraftsAccountGuard());
    expect(useDraftsStore.getState().owner).toBeNull();
  });

  it('clears on account change and keeps on same-account refresh', () => {
    renderHook(() => useDraftsAccountGuard());
    setAuth('https://j', 'alice');
    expect(useDraftsStore.getState().owner).toBe('https://j|alice');
    act(() => {
      useDraftsStore.getState().setDraft('description:P-1', {
        kind: 'description',
        issueKey: 'P-1',
        text: 'x',
      });
    });
    // token refresh: same account, auth state touched again
    setAuth('https://j', 'alice');
    expect(Object.keys(useDraftsStore.getState().drafts)).toHaveLength(1);
    setAuth('https://j', 'bob');
    expect(useDraftsStore.getState().drafts).toEqual({});
    expect(useDraftsStore.getState().owner).toBe('https://j|bob');
  });
});

describe('useDraftsAccountGuard issue drafts', () => {
  it('purges files on account change, not on same owner, orphans once', async () => {
    const files = await import('@/lib/issue-draft-files');
    renderHook(() => useDraftsAccountGuard());
    setAuth('https://j', 'alice');
    expect(files.purgeAllDraftFiles).not.toHaveBeenCalled();
    expect(files.purgeOrphanDraftFiles).toHaveBeenCalledTimes(1);
    expect(files.purgeOrphanDraftFiles).toHaveBeenCalledWith(new Set());
    setAuth('https://j', 'alice');
    expect(files.purgeAllDraftFiles).not.toHaveBeenCalled();
    setAuth('https://j', 'bob');
    expect(files.purgeAllDraftFiles).toHaveBeenCalledTimes(1);
    expect(files.purgeOrphanDraftFiles).toHaveBeenCalledTimes(1);
    expect(useIssueDraftsStore.getState().owner).toBe('https://j|bob');
  });

  it('does nothing before auth hydration', async () => {
    const files = await import('@/lib/issue-draft-files');
    useAuthStore.setState({ jiraBaseUrl: 'https://j', jiraUsername: 'a', _hasHydrated: false });
    renderHook(() => useDraftsAccountGuard());
    expect(files.purgeOrphanDraftFiles).not.toHaveBeenCalled();
    expect(useIssueDraftsStore.getState().owner).toBeNull();
  });
});
