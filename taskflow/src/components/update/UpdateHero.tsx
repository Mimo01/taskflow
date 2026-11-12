/**
 * UpdateHero — celebratory header for the Update available / What's new dialogs.
 * Built from the app's own flair: the dashboard hero's ambient curves and the
 * About dialog's app icon, then the version, the release headline and a count of
 * what's inside (same kind icons as the notes).
 */

import type { ReactNode } from 'react';
import { AmbientCurves } from '@/components/ambient-curves';
import AppIcon from '@/components/app/AppIcon';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { type NoteKind, parseReleaseNotes } from '@/lib/release-notes/parse';
import { cn } from '@/lib/utils';
import { KIND_ICON } from './ReleaseNotesBody';

const COUNT_LABEL: Partial<Record<NoteKind, string>> = {
  new: 'new',
  improved: 'improved',
  fixed: 'fixed',
};

function NoteCounts({ notes }: { notes: string | null | undefined }) {
  const parsed = parseReleaseNotes(notes);
  const counts = (Object.keys(COUNT_LABEL) as NoteKind[])
    .map((kind) => ({
      kind,
      n: parsed.sections.filter((s) => s.kind === kind).reduce((a, s) => a + s.items.length, 0),
    }))
    .filter((c) => c.n > 0);
  if (counts.length === 0) return null;
  return (
    <ul className="m-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground">
      {counts.map(({ kind, n }) => {
        const { icon: Icon, className } = KIND_ICON[kind];
        return (
          <li key={kind} className="flex list-none items-center gap-1.5 tabular-nums">
            <Icon aria-hidden="true" className={cn('size-3.5', className)} />
            {n} {COUNT_LABEL[kind]}
          </li>
        );
      })}
    </ul>
  );
}

export function UpdateHero({
  eyebrow,
  title,
  headline,
  meta,
  notes,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  headline: string | null;
  meta?: ReactNode;
  notes: string | null | undefined;
}) {
  return (
    <div className="relative -mx-4 -mt-4 overflow-hidden rounded-t-xl border-b border-border/60 px-6 pb-5 pt-7 text-center">
      {/* Same curves as the dashboard hero; strokes kept crisp at this smaller, wider box. */}
      <AmbientCurves className="[&_path]:[stroke-width:1.25px] [&_path]:[vector-effect:non-scaling-stroke]" />
      <div className="relative flex flex-col items-center gap-3">
        <AppIcon className="size-14 drop-shadow-sm" />
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{eyebrow}</span>
          <DialogTitle className="text-2xl font-semibold tracking-tight">{title}</DialogTitle>
          {headline && (
            <DialogDescription className="max-w-md text-sm text-foreground">
              {headline.replace(/\*\*|`/g, '')}
            </DialogDescription>
          )}
          {meta && <p className="m-0 text-xs text-muted-foreground tabular-nums">{meta}</p>}
        </div>
        <NoteCounts notes={notes} />
      </div>
    </div>
  );
}
