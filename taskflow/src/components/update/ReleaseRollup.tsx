/**
 * ReleaseRollup — releases skipped between two versions, shown with the same
 * rows as Settings → Updates (version | summary | date, opens into a card).
 */

import { useState } from 'react';
import { parseReleaseNotes, summarizeNotes } from '@/lib/release-notes/parse';
import type { ReleaseEntry } from '@/services/releases';
import { ReleaseRow } from './ReleaseRow';

export function ReleaseRollup({ releases }: { releases: ReleaseEntry[] }) {
  const [openVersions, setOpenVersions] = useState<Record<string, boolean>>({});
  if (releases.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h4 className="m-0 text-xs font-medium text-muted-foreground">Also included</h4>
      <ul className="m-0 -mx-2 flex flex-col p-0">
        {releases.map((r) => (
          <ReleaseRow
            key={r.version}
            release={r}
            summary={summarizeNotes(parseReleaseNotes(r.body))}
            open={openVersions[r.version] ?? false}
            onToggle={() =>
              setOpenVersions((o) => ({ ...o, [r.version]: !(o[r.version] ?? false) }))
            }
          />
        ))}
      </ul>
    </section>
  );
}
