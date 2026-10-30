import { ReleasePackageCell } from '@/components/release/ReleasePackageCell';
import { ReleaseStatusPill } from '@/components/release/ReleaseStatusPill';
import { type AgendaEntry, type AgendaRelease, dateStamp } from '@/lib/release-agenda';
import { breakdownTotal, type DerivedPackage, type StatusBreakdown } from '@/lib/release-list';
import { cn } from '@/lib/utils';
import type { VersionAssignee } from '@/services/jira';
import { AgendaDot, NextReleaseCard, ReleaseIssuesSlot, ReleaseTeam } from './ReleaseAgendaParts';

const ROW_GRID = 'grid grid-cols-[74px_24px_minmax(0,1fr)]';
const RAIL_LINE =
  'relative before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-border';
const LABEL_CLASS =
  'pt-4 pb-1 pl-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground';
const NO_TEAM: readonly VersionAssignee[] = [];

type Props = {
  entries: AgendaEntry[];
  breakdowns: ReadonlyMap<string, StatusBreakdown>;
  loadingIds: ReadonlySet<string>;
  teams: ReadonlyMap<string, VersionAssignee[]>;
  showPackage: boolean;
  pkgLoading: boolean;
  packageFor: (releaseDate?: string) => DerivedPackage | null;
  onOpen: (id: string) => void;
};

function Stamp({ entry }: { entry: AgendaRelease }) {
  const date = entry.version.releaseDate;
  if (!date) {
    return <div className="pt-2 pr-3 text-right text-sm font-semibold tabular-nums">No date</div>;
  }
  const s = dateStamp(date);
  if (entry.quiet) {
    return (
      <div className="pt-2 pr-3 text-right text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums">
        {s.inline}
      </div>
    );
  }
  return (
    <div className="pt-2 pr-3 text-right tabular-nums">
      <div className="text-sm font-semibold">{s.day}</div>
      <div className="text-xs text-muted-foreground">{s.weekday}</div>
    </div>
  );
}

function ReleaseRow({
  entry: base,
  last,
  props,
}: {
  entry: AgendaRelease;
  last: boolean;
  props: Props;
}) {
  const { breakdowns, loadingIds, teams, showPackage, pkgLoading, packageFor, onOpen } = props;
  const breakdown = breakdowns.get(base.version.id);
  // A quiet planned row that has issues gets the full row treatment.
  const entry =
    base.quiet && breakdown && breakdownTotal(breakdown) > 0
      ? { ...base, quiet: false, pill: true }
      : base;
  const { version, kind, quiet } = entry;
  const loading = loadingIds.has(version.id);
  const team = teams.get(version.id) ?? NO_TEAM;

  return (
    <div data-testid="release-row" data-kind={kind} data-quiet={String(quiet)} className={ROW_GRID}>
      <Stamp entry={entry} />
      <div className={cn(RAIL_LINE, last && 'before:bottom-[calc(100%-16px)]')}>
        <AgendaDot kind={kind} quiet={quiet} />
      </div>
      {kind === 'next' ? (
        <div data-testid="release-body" className="py-1.5 pl-3">
          <NextReleaseCard
            entry={entry}
            breakdown={breakdown}
            loading={loading}
            team={team}
            showPackage={showPackage}
            pkg={packageFor(version.releaseDate)}
            pkgLoading={pkgLoading}
            onOpen={onOpen}
          />
        </div>
      ) : (
        <div
          data-testid="release-body"
          className={cn(
            'group/row relative flex items-center gap-4 rounded-lg px-3 hover:bg-muted/50',
            quiet ? 'py-1.5' : 'py-[9px]',
          )}
        >
          <button
            type="button"
            aria-label={`Open release ${version.name}`}
            className="absolute inset-0 cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => onOpen(version.id)}
          />
          <div className="pointer-events-none relative min-w-0 flex-1">
            <span
              title={version.name}
              className={cn('block truncate text-sm', quiet ? 'font-normal' : 'font-medium')}
            >
              {version.name}
            </span>
            {!quiet && showPackage && (
              <div className="mt-0.5 flex">
                <ReleasePackageCell pkg={packageFor(version.releaseDate)} loading={pkgLoading} />
              </div>
            )}
          </div>
          <div className="flex w-[150px] flex-none items-center">
            <ReleaseIssuesSlot breakdown={breakdown} loading={loading} variant="row" />
          </div>
          <div className="hidden w-[104px] flex-none @[640px]:flex">
            {!quiet && <ReleaseTeam assignees={team} max={5} />}
          </div>
          <div className="flex w-[100px] flex-none justify-end">
            {entry.pill ? (
              <ReleaseStatusPill pill={entry.countdown} />
            ) : (
              <span
                data-testid="release-timing-text"
                className="pr-1.5 text-[12.5px] whitespace-nowrap text-muted-foreground"
              >
                {entry.countdown.label}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** F5 agenda rail rendered from the pure 93-07 agenda model. */
export function ReleaseAgenda(props: Props) {
  const { entries } = props;
  let lastReleaseIdx = -1;
  entries.forEach((e, i) => {
    if (e.type === 'release') lastReleaseIdx = i;
  });

  return (
    <div className="@container mt-5 min-w-0">
      {entries.map((entry, i) => {
        if (entry.type === 'release') {
          return (
            <ReleaseRow
              key={entry.version.id}
              entry={entry}
              last={i === lastReleaseIdx}
              props={props}
            />
          );
        }
        if (entry.type === 'today') {
          return (
            <div
              key="today"
              data-testid="agenda-today"
              className={cn(ROW_GRID, 'items-center py-1.5')}
            >
              <div className="pr-3 text-right text-[10px] font-semibold tracking-widest uppercase">
                Today
              </div>
              <div className={cn(RAIL_LINE, 'self-stretch')}>
                <span className="absolute top-1/2 left-1/2 h-0.5 w-3 -translate-x-1/2 bg-foreground" />
              </div>
              <div className="flex items-center gap-2.5 pl-3">
                <span className="text-[11.5px] text-muted-foreground">
                  {dateStamp(entry.date).inline}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          );
        }
        const isSection = entry.type === 'section';
        return (
          <div
            key={isSection ? 'section' : `month-${entry.label}`}
            data-testid={isSection ? 'agenda-section' : 'agenda-month'}
            className={ROW_GRID}
          >
            <div />
            <div className={RAIL_LINE} />
            <div className={LABEL_CLASS}>
              {entry.label}
              {isSection && <span className="ml-1.5 font-normal tabular-nums">{entry.count}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
