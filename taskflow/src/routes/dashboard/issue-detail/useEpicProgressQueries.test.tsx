import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUserSchedule } from '@/services/tempo';
import { useEpicWorkCalendar } from './useEpicProgressQueries';

const authState = {
  jiraBaseUrl: 'https://jira.test',
  jiraConnected: true,
  jiraUserKey: 'u1' as string | null,
};
const settingsState = { tempoEnabled: true };

vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => authState }));
vi.mock('@/stores/settings.store', () => ({ useSettingsStore: () => settingsState }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));
vi.mock('@/services/tempo', () => ({ fetchUserSchedule: vi.fn() }));

const mockSchedule = vi.mocked(fetchUserSchedule);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockSchedule.mockReset();
  authState.jiraUserKey = 'u1';
  settingsState.tempoEnabled = true;
});

describe('useEpicWorkCalendar (261001-qvu)', () => {
  it('fetches the schedule once and exposes Tempo holidays as non-working', async () => {
    mockSchedule.mockResolvedValue(new Map([['2026-10-02', 'HOLIDAY']]));
    const { result } = renderHook(() => useEpicWorkCalendar('2026-10-01'), { wrapper });
    await waitFor(() => expect(result.current.holidaysAvailable).toBe(true));
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith(
      'https://jira.test',
      'tok',
      '2026-06-03',
      '2027-04-01',
      'u1',
    );
    expect(result.current.calendar.source).toBe('tempo');
    expect(result.current.calendar.isWorkingDay('2026-10-02')).toBe(false);
    expect(result.current.calendar.isWorkingDay('2026-10-01')).toBe(true);
  });

  it('never fetches when Tempo is disabled', async () => {
    settingsState.tempoEnabled = false;
    const { result } = renderHook(() => useEpicWorkCalendar('2026-10-01'), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(result.current.calendar.source).toBe('weekends');
    expect(result.current.holidaysAvailable).toBe(false);
  });

  it('never fetches without a Jira user key', async () => {
    authState.jiraUserKey = null;
    const { result } = renderHook(() => useEpicWorkCalendar('2026-10-01'), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(result.current.calendar.source).toBe('weekends');
  });

  it('falls back to Mon-Fri when the fetch rejects', async () => {
    mockSchedule.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useEpicWorkCalendar('2026-10-01'), { wrapper });
    await waitFor(() => expect(mockSchedule).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.calendar.source).toBe('weekends');
    expect(result.current.calendar.isWorkingDay('2026-10-02')).toBe(true);
  });
});
