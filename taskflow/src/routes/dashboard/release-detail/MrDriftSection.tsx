import { openUrl } from '@tauri-apps/plugin-opener';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type React from 'react';
import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { extractTicketKeys } from '@/services/linkEngine';
import type { Channel, DriftMark, DriftRow } from './driftDetection';

/**
 * D-11: freeze the row order for the life of the mounted list.
 *
 * Wrong-branch and missing-milestone co-occur constantly on the same row, so
 * a live re-sort (the flagged-first comparator in `driftDetection.ts` keeps
 * re-sorting on every render) would move a row out from under the pointer
 * between the user's two fixes. `heldIds` is a `useRef` snapshot captured
 * once by the caller — never a `useMemo`, which is not a stability guarantee
 * under React Compiler. Re-sorting resumes naturally on the next mount (i.e.
 * navigating away and back), since the ref is re-created then.
 *
 * @param rows - the freshly computed (and possibly re-sorted) drift rows
 * @param heldIds - the MR ids in their originally captured order
 * @returns rows reordered to match heldIds, with any new/unknown-id rows appended last
 */
export function applyHeldOrder(rows: DriftRow[], heldIds: number[]): DriftRow[] {
  if (heldIds.length === 0) return rows;
  const byId = new Map(rows.map((r) => [r.mr.id, r] as const));
  const held: DriftRow[] = [];
  for (const id of heldIds) {
    const row = byId.get(id);
    if (row) {
      held.push(row);
      byId.delete(id);
    }
  }
  // Remaining rows (new ids not in heldIds) keep their incoming relative order.
  const rest = rows.filter((r) => byId.has(r.mr.id));
  return [...held, ...rest];
}

interface MrDriftSectionProps {
  rows: DriftRow[];
  flaggedCount: number;
  hasMatchedMilestone: boolean;
  isLoading: boolean;
  onNavigateToIssueFromMR: (key: string) => void;
}

const CHANNEL_NAMES: Record<Channel, string> = {
  A: 'Jira link',
  B: 'GitLab milestone',
  C: 'release branch',
};

/**
 * Locate a normalised ticket key's ORIGINAL spelling inside a title.
 *
 * `extractTicketKeys` returns normalised keys — uppercased, and with the space
 * form ("PROJ 123") rewritten to the dash form ("PROJ-123"). The returned key is
 * therefore often not a literal substring of the title it came from, so callers
 * must not use `title.indexOf(key)` to locate it.
 *
 * @returns The match position and the text as it actually appears in the title,
 *          or `null` when the key cannot be located (caller should skip it).
 */
export function matchTicketKeyInTitle(
  title: string,
  normalisedKey: string,
): { index: number; text: string } | null {
  const [project, number] = normalisedKey.split('-');
  if (!project || !number) return null;
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Either separator, any case — mirrors the two patterns extractTicketKeys accepts.
  const re = new RegExp(`${escapeRe(project)}[\\s-]${escapeRe(number)}`, 'i');
  const m = re.exec(title);
  return m ? { index: m.index, text: m[0] } : null;
}

function channelsTitle(channels: Set<Channel>): string {
  const names = (['A', 'B', 'C'] as Channel[])
    .filter((c) => channels.has(c))
    .map((c) => CHANNEL_NAMES[c]);
  return `Found via: ${names.join(', ')}`;
}

function DriftMarkCell({
  mark,
  testId,
  title,
}: {
  mark: DriftMark;
  testId: string;
  title?: string;
}) {
  return (
    <span
      data-testid={testId}
      title={title}
      className="flex-none w-[28px] flex items-center justify-center"
    >
      {mark === 'ok' ? (
        <Check className="size-3.5 text-green-600 dark:text-green-400" />
      ) : mark === 'flag' ? (
        <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400" />
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      )}
    </span>
  );
}

export function MrDriftSection({
  rows,
  flaggedCount,
  hasMatchedMilestone,
  isLoading,
  onNavigateToIssueFromMR,
}: MrDriftSectionProps) {
  // D-11: capture the incoming row order on first non-empty render and hold
  // it for the life of the mounted list. Wrong-branch and missing-milestone
  // co-occur constantly, so a live re-sort (buildDriftRows keeps re-sorting
  // flagged-first on every render) would move a row out from under the
  // pointer between the user's two fixes. This is a `useRef` snapshot, never
  // a `useMemo` — React Compiler is on and a memo is not a stability
  // guarantee. Re-sorting resumes on the next mount/navigation, since the
  // ref is re-created then.
  const orderRef = useRef<number[] | null>(null);
  if (orderRef.current === null && rows.length > 0) {
    orderRef.current = rows.map((r) => r.mr.id);
  }
  const orderedRows = applyHeldOrder(rows, orderRef.current ?? []);

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <div className="flex items-center gap-1.5 mb-1">
        <h4 className="text-sm font-medium">
          MR Drift
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {flaggedCount}
          </Badge>
        </h4>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        Merge requests linked to this release, checked against branch, milestone, and task
      </p>

      {!hasMatchedMilestone && (
        <div
          data-testid="drift-degraded-banner"
          className="flex items-center gap-2 rounded-md border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 mb-2"
        >
          <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <p className="text-xs text-orange-700 dark:text-orange-300">
            Showing Jira-linked MRs only &mdash; no GitLab milestone matched, so branch and
            milestone checks can&apos;t run.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" />
          Loading merge requests...
        </div>
      ) : rows.length === 0 ? (
        <div className="py-4">
          <p className="text-sm text-muted-foreground">No merge requests found</p>
          <p className="text-xs text-muted-foreground">
            No MRs were discovered via Jira linkage, milestone, or branch target for this release.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium py-1">
            <span className="flex-none w-[44px]" />
            <span className="flex-none w-[72px]" />
            <span className="flex-1 min-w-0" />
            <span className="flex-none" />
            <span className="flex-none w-[64px]" />
            <span
              className="flex-none w-[28px] text-center"
              title="Target branch matches release branch"
            >
              BR
            </span>
            <span className="flex-none w-[28px] text-center" title="Release milestone assigned">
              MS
            </span>
            <span
              className="flex-none w-[28px] text-center"
              title="Jira task is in this fix version"
            >
              TASK
            </span>
          </div>

          {orderedRows.map((row) => {
            const { mr } = row;
            const muted = !row.evaluated;
            const key = row.taskKeys[0];
            const taskTitle =
              row.taskReason === 'no-linked-task'
                ? 'No linked task'
                : row.taskReason === 'not-in-fix-version'
                  ? `${key} not in this fix version`
                  : undefined;

            return (
              <div
                key={mr.id}
                data-testid="drift-row"
                className="flex items-center gap-2 text-sm py-1 border-b border-border/50"
              >
                <button
                  type="button"
                  onClick={() => openUrl(mr.web_url)}
                  title={channelsTitle(row.channels)}
                  className="flex-none w-[44px] font-mono text-xs hover:underline"
                >
                  !{mr.iid}
                </button>
                <span
                  className={`flex-none w-[72px] font-mono text-xs ${muted ? 'text-muted-foreground' : ''}`}
                >
                  {key ?? <span className="text-muted-foreground">&mdash;</span>}
                </span>
                <span
                  className={`flex-1 min-w-0 truncate text-xs ${muted ? 'text-muted-foreground' : ''}`}
                >
                  {(() => {
                    const keys = extractTicketKeys(mr.title);
                    if (keys.length === 0) return mr.title;
                    const parts: React.ReactNode[] = [];
                    let remaining = mr.title;
                    for (const k of keys) {
                      // `extractTicketKeys` NORMALISES what it returns: it uppercases
                      // the key and rewrites the space form ("PROJ 123") to the dash
                      // form ("PROJ-123"). So the returned key is frequently NOT a
                      // literal substring of the title, and a plain indexOf() misses.
                      // Locate the original spelling instead — case-insensitive, with
                      // either separator — and skip the key entirely when it cannot be
                      // located, rather than slicing on a -1 index (which silently ate
                      // `key.length - 1` characters of the title).
                      const match = matchTicketKeyInTitle(remaining, k);
                      if (!match) continue;
                      if (match.index > 0) parts.push(remaining.slice(0, match.index));
                      parts.push(
                        <button
                          key={k}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToIssueFromMR(k);
                          }}
                          className="text-primary hover:underline font-mono"
                        >
                          {match.text}
                        </button>,
                      );
                      remaining = remaining.slice(match.index + match.text.length);
                    }
                    if (remaining) parts.push(remaining);
                    return parts;
                  })()}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground flex-none">
                  <CachedAvatar url={mr.author.avatar_url} name={mr.author.name} size={20} />
                  {mr.author.name}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] flex-none w-[64px] justify-center ${
                    mr.state === 'merged'
                      ? 'border-green-500 text-green-600'
                      : mr.state === 'opened'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-gray-400 text-gray-500'
                  }`}
                >
                  {mr.state}
                </Badge>
                {row.evaluated ? (
                  <>
                    <DriftMarkCell mark={row.br} testId="drift-br" />
                    <DriftMarkCell mark={row.ms} testId="drift-ms" />
                    <DriftMarkCell mark={row.task} testId="drift-task" title={taskTitle} />
                  </>
                ) : (
                  <>
                    <DriftMarkCell mark="na" testId="drift-br" />
                    <DriftMarkCell mark="na" testId="drift-ms" />
                    <DriftMarkCell mark="na" testId="drift-task" />
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
