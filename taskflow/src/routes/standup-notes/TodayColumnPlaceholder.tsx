import { Clock } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
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

function formatTodayDate(): string {
  const today = new Date();
  const dayName = DAYS[today.getDay()];
  const day = today.getDate();
  const month = MONTHS[today.getMonth()];
  const year = today.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * TodayColumnPlaceholder
 *
 * Phase 70 stub for the Today column in the Standup Notes page.
 * Renders the column heading, current date, and an empty state with a
 * "Today section coming soon" message.
 *
 * Replace with the real TodayColumn in Phase 70.
 */
export default function TodayColumnPlaceholder() {
  return (
    <div className="flex flex-col h-full px-6 py-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Today</h2>
        <p className="text-xs text-muted-foreground">{formatTodayDate()}</p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={Clock}
          title="Today section coming soon"
          subtitle="Planned tasks, pinned issues, and worklog targets will appear here."
        />
      </div>
    </div>
  );
}
