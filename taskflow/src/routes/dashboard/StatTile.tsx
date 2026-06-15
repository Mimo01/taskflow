'use no memo';

/**
 * StatTile — Phase 83 DASH-02
 *
 * Static, display-only stat tile showing a label, numeric value, and decorative icon.
 *
 * D-06 / UI-SPEC Interaction Contract: do NOT add role="button", cursor-pointer,
 * hover:bg-*, or any click handler — tiles are purely informational regions.
 *
 * Props only — no readSecret, no useAuthStore (D-16).
 * Loading/error/empty state is managed by the parent (index.tsx).
 */
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass?: string;
  valueClass?: string;
}

export default function StatTile({
  label,
  value,
  icon: Icon,
  iconClass,
  valueClass,
}: StatTileProps) {
  return (
    <div
      role="region"
      aria-label={label}
      className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[80px]"
    >
      {/* Header: icon + label */}
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', iconClass)} aria-hidden />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>

      {/* Value */}
      <p
        className={cn('text-3xl font-semibold text-primary', valueClass)}
        aria-label={`${value} ${label}`}
      >
        {value}
      </p>
    </div>
  );
}
