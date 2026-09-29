import { toLocalDateString } from './local-date';

export interface DateRange {
  from: string;
  to: string;
}

/** This Week: ISO Monday → Sunday of the current week. */
export function getThisWeekRange(today: Date = new Date()): DateRange {
  const dow = today.getDay(); // 0=Sun
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toLocalDateString(monday), to: toLocalDateString(sunday) };
}

/** This Month: 1st of current month → today. */
export function getThisMonthRange(today: Date = new Date()): DateRange {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: toLocalDateString(first), to: toLocalDateString(today) };
}

/** Last 7 Days: today minus 6 → today (7 days inclusive). */
export function getLast7DaysRange(today: Date = new Date()): DateRange {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  return { from: toLocalDateString(from), to: toLocalDateString(today) };
}

/** Last Month: same day-of-month one month ago → today, clamped to the previous month's last day. */
export function getLastMonthToDateRange(today: Date = new Date()): DateRange {
  const y = today.getFullYear();
  const m = today.getMonth();
  // Clamp: setMonth-style math would overflow (31 Mar -> 3 Mar); cap at prev month's last day.
  const lastDayPrevMonth = new Date(y, m, 0).getDate();
  const from = new Date(y, m - 1, Math.min(today.getDate(), lastDayPrevMonth));
  return { from: toLocalDateString(from), to: toLocalDateString(today) };
}
