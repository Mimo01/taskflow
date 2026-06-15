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
import { Card, CardContent } from '@/components/ui/card';
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
    <Card size="sm" role="region" aria-label={label} className="min-h-[80px] gap-2">
      <CardContent className="flex flex-col gap-3">
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
      </CardContent>
    </Card>
  );
}
