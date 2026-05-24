import { useMemo, useState } from 'react';
import { resolveYesterdayDate } from '@/lib/standup-date';
import StandupPageHeader from './StandupPageHeader';
import TodayColumnPlaceholder from './TodayColumnPlaceholder';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Formats a YYYY-MM-DD date string as "Weekday, D Month YYYY".
 *
 * Uses explicit array lookups — never toLocaleDateString() — per Phase 62
 * standing rule (TZ-independent date formatting).
 *
 * @param dateStr YYYY-MM-DD
 * @returns e.g. "Monday, 26 May 2026"
 */
function formatDateLabel(dateStr: string): string {
  // Parse the ISO date components directly to avoid TZ shifts.
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  // Build a local date at midnight to get the day-of-week.
  const d = new Date(year, month, day);
  const dayName = DAY_NAMES[d.getDay()];
  const monthName = MONTH_NAMES[month];

  return `${dayName}, ${day} ${monthName} ${year}`;
}

/**
 * StandupNotesPage
 *
 * Top-level page for the /standup-notes route (STAND-01).
 *
 * Layout: full-height flex-col shell with a full-width page header above a
 * 50/50 two-column body. Left column = Yesterday recap region (Plan 04 mounts
 * YesterdayColumn here). Right column = Today placeholder (Phase 70).
 *
 * This plan (03) builds the shell only:
 * - StandupPageHeader with resolved yesterday date label
 * - Left region: labelled container with Plan-04 mount-point comment
 * - Right region: TodayColumnPlaceholder
 *
 * Plan 04 adds the four useQuery hooks + YesterdayColumn data sections.
 */
export default function StandupNotesPage() {
  const [copied, setCopied] = useState(false);

  // Resolve yesterday date once per mount.
  // Plan 04 replaces this with a schedule-aware memo that accepts the Tempo schedule map.
  const yesterdayDate = useMemo(() => resolveYesterdayDate(), []);
  const dateLabel = useMemo(() => formatDateLabel(yesterdayDate), [yesterdayDate]);

  function handleCopyMarkdown() {
    // Plan 04 wires the real markdown string once Yesterday data is available.
    navigator.clipboard.writeText('').catch(() => {
      // Clipboard write failed silently — no PII exposed (placeholder content).
    });
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="flex flex-col h-full">
      <StandupPageHeader
        dateLabel={dateLabel}
        syncedMinutesAgo={null}
        onRefresh={() => {
          // Plan 04 wires refetch() calls for all four useQuery hooks here.
        }}
        onCopyMarkdown={handleCopyMarkdown}
        copied={copied}
      />

      {/* Two-column body: Yesterday (left) | Today (right) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column — Yesterday recap (50%) */}
        <div className="w-1/2 overflow-auto border-r border-border px-6 py-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Yesterday</h2>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          </div>

          {/* Plan 04 mounts YesterdayColumn + four useQuery sections here */}
        </div>

        {/* Right column — Today placeholder (50%) */}
        <div className="w-1/2 overflow-auto">
          <TodayColumnPlaceholder />
        </div>
      </div>
    </div>
  );
}
