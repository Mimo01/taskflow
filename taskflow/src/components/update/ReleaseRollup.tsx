/**
 * ReleaseRollup — compact rows for releases skipped between two versions.
 * One row = one line (`1.14.19 — summary`); expanding shows the shared notes body.
 */

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { parseReleaseNotes, summarizeNotes } from '@/lib/release-notes/parse';
import { cn } from '@/lib/utils';
import type { ReleaseEntry } from '@/services/releases';
import { ReleaseNotesBody } from './ReleaseNotesBody';

function RollupRow({ release }: { release: ReleaseEntry }) {
  const [open, setOpen] = useState(false);
  const summary = summarizeNotes(parseReleaseNotes(release.body))?.replace(/\*\*|`/g, '') ?? null;
  const text = summary ? `${release.version} — ${summary}` : release.version;
  return (
    <li className="list-none">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 rounded-sm py-1 text-left text-sm"
      >
        <span className="min-w-0 flex-1 truncate" title={text}>
          <span className="font-mono text-xs">{release.version}</span>
          {summary && <span className="text-muted-foreground"> — {summary}</span>}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100',
            open && 'rotate-90',
          )}
        />
      </button>
      {open && (
        <div className="pb-2 pl-3">
          <ReleaseNotesBody notes={release.body} compact />
        </div>
      )}
    </li>
  );
}

export function ReleaseRollup({ releases }: { releases: ReleaseEntry[] }) {
  if (releases.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Skipped releases
      </h4>
      <ul className="m-0 flex flex-col p-0">
        {releases.map((r) => (
          <RollupRow key={r.version} release={r} />
        ))}
      </ul>
    </section>
  );
}
