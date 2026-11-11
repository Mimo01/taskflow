import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAssignableUsers = vi.fn();
const fetchGitLabUserAvatar = vi.fn();
vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: (...a: unknown[]) => fetchAssignableUsers(...a),
}));
vi.mock('@/services/gitlab', () => ({
  fetchGitLabUserAvatar: (...a: unknown[]) => fetchGitLabUserAvatar(...a),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: async () => 'pat' }));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (sel: (s: object) => unknown) =>
    sel({ jiraBaseUrl: 'https://jira.example', gitlabBaseUrl: 'https://gl.example' }),
}));

import { usePersonAvatar } from './usePersonAvatar';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePersonAvatar', () => {
  beforeEach(() => {
    fetchAssignableUsers.mockReset();
    fetchGitLabUserAvatar.mockReset();
  });

  it('Jira: searches by first word scoped to the issue and takes the EXACT display-name match', async () => {
    fetchAssignableUsers.mockResolvedValue([
      { displayName: 'ROHAL Jaroslava OSK', name: 'x', avatarUrls: { '48x48': 'wrong' } },
      { displayName: 'ROHAL Jaroslav OSK (ext.)', name: 'y', avatarUrls: { '48x48': 'right' } },
    ]);
    const { result } = renderHook(
      () => usePersonAvatar('ROHAL Jaroslav OSK (ext.)', 'jira', 'ESHOP-1', undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe('right'));
    expect(fetchAssignableUsers).toHaveBeenCalledWith('https://jira.example', 'pat', '', 'ROHAL', {
      issueKey: 'ESHOP-1',
      maxResults: 50,
    });
  });

  it('Jira: no exact match -> null (initials)', async () => {
    fetchAssignableUsers.mockResolvedValue([{ displayName: 'Someone Else', name: 'z' }]);
    const { result } = renderHook(() => usePersonAvatar('Ann Lee', 'jira', 'P-1', undefined), {
      wrapper,
    });
    await waitFor(() => expect(fetchAssignableUsers).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('a captured URL wins and skips the lookup', () => {
    const { result } = renderHook(() => usePersonAvatar('Ann Lee', 'jira', 'P-1', 'cap'), {
      wrapper,
    });
    expect(result.current).toBe('cap');
    expect(fetchAssignableUsers).not.toHaveBeenCalled();
  });

  it('GitLab: exact username lookup', async () => {
    fetchGitLabUserAvatar.mockResolvedValue('gl-url');
    const { result } = renderHook(() => usePersonAvatar('alice', 'gitlab', null, undefined), {
      wrapper,
    });
    await waitFor(() => expect(result.current).toBe('gl-url'));
    expect(fetchGitLabUserAvatar).toHaveBeenCalledWith('https://gl.example', 'pat', 'alice');
  });
});
