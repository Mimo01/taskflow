import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAioCredentials } from './useAioCredentials';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn(),
}));

describe('useAioCredentials', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module so the mock is fresh between tests
    const { readSecret } = await import('@/services/stronghold');
    (readSecret as ReturnType<typeof vi.fn>).mockResolvedValue('test-jira-token');
  });

  it('initial render returns { token: null, isLoading: true }', async () => {
    const { readSecret } = await import('@/services/stronghold');
    // Override to never resolve (so we can observe initial state)
    (readSecret as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useAioCredentials());
    expect(result.current.token).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('after readSecret resolves with a string, returns { token: <value>, isLoading: false }', async () => {
    const { readSecret } = await import('@/services/stronghold');
    (readSecret as ReturnType<typeof vi.fn>).mockResolvedValue('test-jira-token');

    const { result } = renderHook(() => useAioCredentials());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.token).toBe('test-jira-token');
    expect(result.current.isLoading).toBe(false);
  });

  it('after readSecret rejects, returns { token: null, isLoading: false }', async () => {
    const { readSecret } = await import('@/services/stronghold');
    (readSecret as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Stronghold unavailable'));

    const { result } = renderHook(() => useAioCredentials());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('readSecret called exactly once across re-renders', async () => {
    const { readSecret } = await import('@/services/stronghold');
    (readSecret as ReturnType<typeof vi.fn>).mockResolvedValue('test-jira-token');

    const { rerender } = renderHook(() => useAioCredentials());
    rerender();
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect((readSecret as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
