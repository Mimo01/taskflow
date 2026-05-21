import { tempoFetch } from './client';

const TEMPO_CORE_API_PATH = '/rest/tempo-core/2';

export type ScheduleDayType = 'WORKING_DAY' | 'NON_WORKING_DAY' | 'HOLIDAY';

/**
 * Fetch the authenticated user's work schedule for the given date range.
 * Returns a map of YYYY-MM-DD → ScheduleDayType.
 *
 * Uses tempo-core/2 (not tempo-timesheets/3) — a separate Jira plugin endpoint.
 * Silently returns an empty map on any API failure so callers degrade gracefully.
 */
export async function fetchUserSchedule(
  baseUrl: string,
  token: string,
  from: string,
  to: string,
  userKey: string,
): Promise<Map<string, ScheduleDayType>> {
  const res = await tempoFetch(
    baseUrl,
    token,
    '/user/schedule/search',
    'Load Tempo Schedule',
    TEMPO_CORE_API_PATH,
    { method: 'POST', body: JSON.stringify({ from, to, userKeys: [userKey] }) },
  );

  if (!res.ok) return new Map();

  const data = (await res.json()) as Array<{
    schedule: { days: Array<{ date: string; type: ScheduleDayType }> };
  }>;

  const map = new Map<string, ScheduleDayType>();
  for (const entry of data) {
    for (const day of entry.schedule.days) {
      map.set(day.date, day.type);
    }
  }
  return map;
}
