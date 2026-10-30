import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LABEL_CLASS, RAIL_LINE, ROW_GRID } from './releases-list/ReleaseAgenda';
import { AgendaDot } from './releases-list/ReleaseAgendaParts';

// First-load skeleton mirroring the F5 agenda + Released panel DOM; shares ROW_GRID/RAIL_LINE/LABEL_CLASS with ReleaseAgenda.

function Bar({ className }: { className: string }) {
  return <Skeleton className={cn('inline-block align-middle', className)} />;
}

function Avatars() {
  return (
    <div className="flex items-center">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="-ml-1 size-5 rounded-full ring-2 ring-background first:ml-0" />
      ))}
    </div>
  );
}

function MonthLabel() {
  return (
    <div data-testid="skeleton-month" className={ROW_GRID}>
      <div />
      <div className={RAIL_LINE} />
      <div className={LABEL_CLASS}>
        <Bar className="h-2.5 w-16" />
      </div>
    </div>
  );
}

function FullStamp() {
  return (
    <div className="pt-2 pr-3 text-right">
      <div className="text-sm font-semibold">
        <Bar className="h-3.5 w-10" />
      </div>
      <div className="text-xs">
        <Bar className="h-3 w-7" />
      </div>
    </div>
  );
}

function QuietStamp() {
  return (
    <div className="pt-2 pr-3 text-right text-xs font-medium whitespace-nowrap">
      <Bar className="h-3 w-12" />
    </div>
  );
}

function IssuesCell() {
  return (
    <div className="flex w-[150px] flex-none items-center">
      <div className="flex h-5 items-center">
        <Skeleton className="h-1.5 w-[92px]" />
      </div>
    </div>
  );
}

function Row({
  stamp,
  quiet,
  last,
  children,
}: {
  stamp: ReactNode;
  quiet: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-testid="skeleton-row" className={ROW_GRID}>
      {stamp}
      <div className={cn(RAIL_LINE, last && 'before:bottom-[calc(100%-16px)]')}>
        <AgendaDot kind="planned" quiet={quiet} />
      </div>
      {children}
    </div>
  );
}

function QuietRow({ nameWidth, last }: { nameWidth: string; last?: boolean }) {
  return (
    <Row stamp={<QuietStamp />} quiet last={last}>
      <div className="flex items-center gap-4 rounded-lg px-3 py-1.5">
        <div className="min-w-0 flex-1 text-sm">
          <Bar className={cn('h-3.5', nameWidth)} />
        </div>
        <IssuesCell />
        <div className="hidden w-[104px] flex-none @[640px]:flex" />
        <div className="flex w-[100px] flex-none justify-end pr-1.5 text-[12.5px]">
          <Bar className="h-3 w-14" />
        </div>
      </div>
    </Row>
  );
}

const RELEASED_NAME_WIDTHS = ['w-40', 'w-32', 'w-48'];

export function ReleasesSkeleton() {
  return (
    <div aria-hidden="true" className="@container min-w-0">
      <div className="mt-5 min-w-0">
        <div data-testid="skeleton-today" className={cn(ROW_GRID, 'items-center py-1.5')}>
          <div className="pr-3 text-right text-[10px] font-semibold">
            <Bar className="h-2.5 w-9" />
          </div>
          <div className={cn(RAIL_LINE, 'self-stretch')}>
            <span className="absolute top-1/2 left-1/2 h-0.5 w-3 -translate-x-1/2 bg-muted-foreground/40" />
          </div>
          <div className="flex items-center gap-2.5 pl-3">
            <span className="text-[11.5px]">
              <Bar className="h-3 w-16" />
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <MonthLabel />
        <Row stamp={<FullStamp />} quiet={false}>
          <div className="py-1.5 pl-3">
            <Card size="sm" data-testid="skeleton-next-card" className="relative gap-1.5 px-3.5">
              <div className="text-[11px] font-bold">
                <Bar className="h-2.5 w-20" />
              </div>
              <div className="flex items-center justify-between gap-2.5">
                <div className="text-base font-semibold">
                  <Bar className="h-4 w-40" />
                </div>
                <Skeleton className="h-5 w-[5.5rem] rounded" />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <Skeleton className="h-3 w-28" />
                <Avatars />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-2 w-full" />
              </div>
            </Card>
          </div>
        </Row>
        <Row stamp={<FullStamp />} quiet={false}>
          <div className="flex items-center gap-4 rounded-lg px-3 py-[9px]">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                <Bar className="h-3.5 w-40" />
              </div>
              <div className="mt-0.5 flex">
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <IssuesCell />
            <div className="hidden w-[104px] flex-none @[640px]:flex">
              <Avatars />
            </div>
            <div className="flex w-[100px] flex-none justify-end">
              <Skeleton className="h-5 w-[5.5rem] rounded" />
            </div>
          </div>
        </Row>
        <MonthLabel />
        <QuietRow nameWidth="w-36" />
        <QuietRow nameWidth="w-44" />
        <QuietRow nameWidth="w-32" last />
      </div>
      <section
        data-testid="skeleton-released"
        className="mt-7 rounded-xl bg-muted/55 px-2 pt-3 pb-2"
      >
        <div className="flex items-baseline gap-2 px-3 pb-2">
          <span className="text-[11px] font-bold">
            <Bar className="h-2.5 w-16" />
          </span>
          <span className="text-xs">
            <Bar className="h-3 w-20" />
          </span>
        </div>
        {RELEASED_NAME_WIDTHS.map((w) => (
          <div
            key={w}
            data-testid="skeleton-released-row"
            className="grid w-full grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-lg px-3 py-[7px]"
          >
            <span className="text-right text-[12.5px]">
              <Bar className="h-3 w-12" />
            </span>
            <span className="text-[13.5px]">
              <Bar className={cn('h-3.5', w)} />
            </span>
            <span className="text-[12.5px]">
              <Bar className="h-3 w-14" />
            </span>
          </div>
        ))}
        <div className="py-1.5 pr-3 pl-[100px] text-[12.5px]">
          <Bar className="h-3 w-32" />
        </div>
      </section>
    </div>
  );
}
