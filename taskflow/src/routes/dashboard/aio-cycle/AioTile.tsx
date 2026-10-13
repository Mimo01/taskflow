import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { STAT_CARD_CLASS, StatCardBody } from '../issue-detail/EpicStatCard';

/** Home-dashboard card title, at the lighter weight used on work pages. */
export const TITLE_CLASS = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';
/** Faint ambient icon top-right (home-dashboard MyIssuesCard pattern, quieter). */
export const AMBIENT_CLASS = 'pointer-events-none absolute -top-3 -right-2';

export const AMBIENT_TINT = {
  blue: 'text-blue-500/[0.07] dark:text-blue-400/10',
  red: 'text-red-500/[0.07] dark:text-red-400/10',
  amber: 'text-amber-500/[0.07] dark:text-amber-400/10',
  green: 'text-green-500/[0.07] dark:text-green-400/10',
} as const;
export type Tint = keyof typeof AMBIENT_TINT;

export function TileShell({
  icon: Icon,
  tint,
  children,
}: {
  icon: LucideIcon;
  tint: Tint;
  children: ReactNode;
}) {
  return (
    <Card size="sm" className="relative overflow-hidden">
      <Icon className={cn(AMBIENT_CLASS, 'size-12', AMBIENT_TINT[tint])} aria-hidden />
      <CardContent className="relative">{children}</CardContent>
    </Card>
  );
}

export function TileLabel({ children }: { children: ReactNode }) {
  return <span className={TITLE_CLASS}>{children}</span>;
}

export function TileSkeleton({
  testId,
  icon,
  tint,
}: {
  testId: string;
  icon: LucideIcon;
  tint: Tint;
}) {
  return (
    <TileShell icon={icon} tint={tint}>
      <div data-testid={testId} className={cn(STAT_CARD_CLASS, 'items-center')}>
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-7 w-14 self-center" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </TileShell>
  );
}

export function Tile({
  testId,
  label,
  value,
  sub,
  tip,
  icon,
  tint,
}: {
  testId: string;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  tip: ReactNode;
  icon: LucideIcon;
  tint: Tint;
}) {
  return (
    <TileShell icon={icon} tint={tint}>
      <Tooltip>
        <TooltipTrigger
          delay={0}
          render={<div />}
          data-testid={testId}
          className={cn(STAT_CARD_CLASS, 'relative')}
        >
          <StatCardBody label={<TileLabel>{label}</TileLabel>} value={value} sub={sub} />
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TileShell>
  );
}

export const VALUE_CLASS =
  'truncate text-xl font-semibold leading-none tracking-tight tabular-nums';
