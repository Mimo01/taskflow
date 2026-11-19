/**
 * DraftsChip -- notebook icon button with a neutral count badge in the TopBar (left of Search) listing saved
 * create-issue / create-epic drafts. A row resumes the draft in the right
 * dialog; the trailing X discards it with a 5s inline Undo. Staged attachment
 * copies are deleted only when a discard commits (expiry, popover close,
 * unmount), so Undo never loses files. Draft text is rendered as React text
 * only and never logged.
 */

import { NotebookText, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { removeDraftFiles } from '@/lib/issue-draft-files';
import { shortRelativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { useCreateModalStore } from '@/stores/create-modal.store';
import {
  type IssueDraft,
  useIssueDraftsHydrated,
  useIssueDraftsStore,
  useSortedIssueDrafts,
} from '@/stores/issue-drafts.store';

const UNDO_WINDOW_MS = 5000;

interface PendingDiscard {
  draft: IssueDraft;
  timer: ReturnType<typeof setTimeout>;
}

function draftTitle(d: IssueDraft): string {
  return d.kind === 'epic' ? d.snapshot.epicName : d.snapshot.summary;
}

function draftKey(d: IssueDraft): string | null {
  if (d.kind === 'epic') return null;
  return d.snapshot.parentKey ?? d.snapshot.epicLinkKey ?? null;
}

export function DraftsChip() {
  const hydrated = useIssueDraftsHydrated();
  const drafts = useSortedIssueDrafts();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingDiscard>>({});
  const pendingRef = useRef(pending);
  const [active, setActive] = useState(0);

  function setPendingBoth(next: Record<string, PendingDiscard>) {
    pendingRef.current = next;
    setPending(next);
  }

  function commit(id: string) {
    const p = pendingRef.current[id];
    if (!p) return;
    clearTimeout(p.timer);
    const next = { ...pendingRef.current };
    delete next[id];
    setPendingBoth(next);
    void removeDraftFiles(id);
  }

  function commitAll() {
    for (const id of Object.keys(pendingRef.current)) commit(id);
  }

  // Unmount: commit what is still pending (timers must not outlive the chip).
  // biome-ignore lint/correctness/useExhaustiveDependencies: commitAll reads refs only
  useEffect(() => commitAll, []);

  const rows = [
    ...drafts.map((d) => ({ draft: d, discarded: false })),
    ...Object.values(pending).map((p) => ({ draft: p.draft, discarded: true })),
  ].sort((a, b) => b.draft.updatedAt - a.draft.updatedAt);

  const pendingCount = Object.keys(pending).length;

  // Last draft gone and nothing left to undo: close (chip unmounts).
  useEffect(() => {
    if (open && drafts.length === 0 && pendingCount === 0) setOpen(false);
  }, [open, drafts.length, pendingCount]);

  if (!hydrated || rows.length === 0) return null;

  function handleOpenChange(next: boolean) {
    if (!next) commitAll();
    setOpen(next);
  }

  function resume(id: string) {
    handleOpenChange(false);
    useCreateModalStore.getState().resumeDraft(id);
  }

  function discard(id: string) {
    const removed = useIssueDraftsStore.getState().removeDraft(id);
    if (!removed) return;
    const timer = setTimeout(() => commit(id), UNDO_WINDOW_MS);
    setPendingBoth({ ...pendingRef.current, [id]: { draft: removed, timer } });
  }

  function undo(id: string) {
    const p = pendingRef.current[id];
    if (!p) return;
    clearTimeout(p.timer);
    const next = { ...pendingRef.current };
    delete next[id];
    setPendingBoth(next);
    useIssueDraftsStore.getState().restoreDraft(p.draft);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.closest('[data-draft-action]')) return;
      const row = rows[Math.min(active, rows.length - 1)];
      if (row && !row.discarded) {
        e.preventDefault();
        resume(row.draft.id);
      }
    }
  }

  const count = drafts.length;

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                // Same icon button as Search / Recent / Bell beside it.
                className={cn(
                  'relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors',
                  open && 'bg-muted text-foreground',
                )}
                data-active={open ? 'true' : undefined}
                aria-haspopup="dialog"
                aria-label={`Drafts, ${count}`}
              />
            }
          >
            <NotebookText className="w-5 h-5" />
            {/* Bell's unread badge shape in a soft blue tint (red stays reserved for notifications). */}
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 bg-blue-200 text-blue-800 dark:bg-blue-500/55 dark:text-white font-medium text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5"
            >
              {count > 99 ? '99+' : count}
            </span>
          </TooltipTrigger>
          <TooltipContent>{count === 1 ? '1 saved draft' : `${count} saved drafts`}</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          className="w-[360px] max-w-[calc(100vw-2rem)] p-1"
          onKeyDown={handleKeyDown}
        >
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
            Drafts <span className="font-normal tabular-nums">{count}</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto" role="listbox" aria-label="Drafts">
            {rows.map(({ draft, discarded }, i) => {
              const title = draftTitle(draft);
              const key = draftKey(draft);
              if (discarded) {
                return (
                  <div
                    key={draft.id}
                    className="flex min-h-10 items-center gap-2 px-2 py-2 text-xs text-muted-foreground"
                  >
                    <span>Draft discarded · </span>
                    <button
                      type="button"
                      data-draft-action
                      className="underline hover:text-foreground"
                      onClick={() => undo(draft.id)}
                    >
                      Undo
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={draft.id}
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'group relative flex min-h-10 items-center gap-2 rounded px-2 py-2 hover:bg-muted',
                    i === active && 'bg-muted',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => resume(draft.id)}
                  >
                    <IssueTypeIcon
                      typeName={draft.kind === 'epic' ? 'Epic' : draft.snapshot.selectedIssueType}
                      className="size-4 shrink-0"
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm',
                        !title && 'italic pr-0.5 text-muted-foreground',
                      )}
                    >
                      {title || 'Untitled'}
                    </span>
                    {key && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {key}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {`edited ${shortRelativeTime(draft.updatedAt)}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-draft-action
                    aria-label="Discard draft"
                    className="flex size-6 shrink-0 items-center justify-center rounded opacity-0 hover:bg-background group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100"
                    onClick={() => discard(draft.id)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {/* Hairline separating Drafts from the Search / Recent / Bell icon group. */}
      <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
    </>
  );
}

export default DraftsChip;
