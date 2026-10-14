import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RmWeek } from '@/lib/deployment-package';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useRmWeekIndex } from './useRmWeekIndex';

const mocks = vi.hoisted(() => ({
  fetchRmWeekList: vi.fn(),
  fetchRmWeekChildren: vi.fn(),
  fetchRmPackage: vi.fn(),
}));
vi.mock('@/services/jira', () => ({
  ...mocks,
  fetchDeploymentPackageEditShape: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));

const light = (key: string, weekNo: number, start: string, end: string): RmWeek => ({
  key,
  summary: `WEEK${weekNo}`,
  weekNo,
  start,
  end,
  children: [],
});
const w43 = light('RM-1', 43, '2026-10-19', '2026-10-25');
const w44 = light('RM-2', 44, '2026-10-26', '2026-11-01');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useRmWeekIndex (lazy)', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => {
      m.mockReset();
    });
    mocks.fetchRmWeekList.mockResolvedValue([w43, w44]);
    mocks.fetchRmWeekChildren.mockImplementation(async (_b: string, _t: string, key: string) => [
      { key: `${key}-APP`, summary: 'App' },
    ]);
    useAuthStore.setState({ jiraBaseUrl: 'https://jira.test' } as never);
    useSettingsStore.setState({ releaseManagementProjectKey: 'RM' } as never);
  });

  it('is inert without an RM project', () => {
    useSettingsStore.setState({ releaseManagementProjectKey: null } as never);
    const { result } = renderHook(() => useRmWeekIndex({ dates: ['2026-10-22'] }), { wrapper });
    expect(result.current.enabled).toBe(false);
    expect(mocks.fetchRmWeekList).not.toHaveBeenCalled();
  });

  it('loads children only for the week covering the requested date', async () => {
    const { result } = renderHook(() => useRmWeekIndex({ dates: ['2026-10-22'] }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(result.current.weeks.find((w) => w.key === 'RM-1')?.children).toHaveLength(1),
    );
    expect(mocks.fetchRmWeekChildren).toHaveBeenCalledTimes(1);
    expect(mocks.fetchRmWeekChildren.mock.calls[0][2]).toBe('RM-1');
    expect(result.current.weeks.find((w) => w.key === 'RM-2')?.children).toHaveLength(0);
  });

  it('fetches no children without dates', async () => {
    const { result } = renderHook(() => useRmWeekIndex(), { wrapper });
    await waitFor(() => expect(result.current.weeks).toHaveLength(2));
    expect(mocks.fetchRmWeekChildren).not.toHaveBeenCalled();
  });

  it('resolves a package outside the loaded weeks directly and merges its week', async () => {
    mocks.fetchRmPackage.mockResolvedValue({
      child: { key: 'RM-99', summary: 'Other' },
      week: { ...w44, children: [{ key: 'RM-99', summary: 'Other' }] },
    });
    const { result } = renderHook(
      () => useRmWeekIndex({ dates: ['2026-10-22'], pkgKeys: ['RM-99', null] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.childToWeek.get('RM-99')?.key).toBe('RM-2'));
    expect(mocks.fetchRmPackage).toHaveBeenCalledTimes(1);
  });

  it('does not look up a package already covered by the loaded children', async () => {
    mocks.fetchRmWeekChildren.mockResolvedValue([{ key: 'RM-11', summary: 'Core' }]);
    const { result } = renderHook(
      () => useRmWeekIndex({ dates: ['2026-10-22'], pkgKeys: ['RM-11'] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.childToWeek.get('RM-11')?.key).toBe('RM-1'));
    expect(mocks.fetchRmPackage).not.toHaveBeenCalled();
  });
});
