/**
 * Dashboard — role-aware overview page with summary cards.
 *
 * Developer role (default when role is null or 'developer'):
 *   Cards: Active Sprint Tasks | Open MRs | MRs Needing Attention
 *
 * PM role:
 *   Cards: Sprint Completion | Team Workload | Next Release
 *
 * Values are static placeholders ("—") — wired to live data in a future task.
 */
import { useSettingsStore } from '@/stores/settings.store';

interface SummaryCard {
  label: string;
  value: string;
}

const DEVELOPER_CARDS: SummaryCard[] = [
  { label: 'Active Sprint Tasks', value: '—' },
  { label: 'Open MRs', value: '—' },
  { label: 'MRs Needing Attention', value: '—' },
];

const PM_CARDS: SummaryCard[] = [
  { label: 'Sprint Completion', value: '—' },
  { label: 'Team Workload', value: '—' },
  { label: 'Next Release', value: '—' },
];

export default function Dashboard() {
  const role = useSettingsStore((s) => s.role);

  const cards = role === 'pm' ? PM_CARDS : DEVELOPER_CARDS;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
