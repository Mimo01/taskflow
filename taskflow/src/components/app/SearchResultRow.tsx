import type React from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { epicColorToTailwind } from '@/lib/epicColors';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { HighlightedText } from './HighlightedText';

type Range = readonly [number, number];

export interface SearchResultRowProps {
  issueKey: string;
  title: string;
  titleRanges?: ReadonlyArray<Range>;
  typeName: string;
  statusName: string;
  statusCategoryKey?: string;
  epic?: { key: string; name: string; color: string } | null;
  /** false for subtasks and epics (stories only). */
  showEpic: boolean;
  assigneeName?: string | null;
  avatarUrl?: string | null;
  snippet?: { text: string; ranges: ReadonlyArray<Range> } | null;
  matchTag?: 'desc' | 'comment' | null;
  dimmed?: boolean;
  indent?: boolean;
  onKeyClick: (e: React.MouseEvent, issueKey: string) => void;
}

/** One-line search result row content; the palette wraps it in a CommandItem. */
export function SearchResultRow({
  issueKey,
  title,
  titleRanges,
  typeName,
  statusName,
  statusCategoryKey,
  epic,
  showEpic,
  assigneeName,
  avatarUrl,
  snippet,
  matchTag,
  dimmed,
  indent,
  onKeyClick,
}: SearchResultRowProps) {
  const epicColor = showEpic && epic ? epicColorToTailwind(epic.color, epic.key) : null;
  return (
    <div className="@container w-full min-w-0">
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 whitespace-nowrap',
          indent && 'pl-6',
          dimmed && 'opacity-60',
        )}
      >
        {indent && <span className="text-xs text-muted-foreground shrink-0">↳</span>}
        <IssueTypeIcon typeName={typeName} className="size-3.5 shrink-0" />
        <button
          type="button"
          className="text-muted-foreground font-mono text-xs cursor-pointer hover:underline shrink-0"
          onClick={(e) => onKeyClick(e, issueKey)}
        >
          {issueKey}
        </button>
        <HighlightedText
          text={title}
          ranges={dimmed ? undefined : titleRanges}
          className="truncate text-sm min-w-0 flex-[0_100_auto]"
        />
        {(snippet || matchTag) && (
          <span className="hidden @[560px]:flex min-w-24 flex-[0_1_auto] items-center gap-1">
            {snippet && (
              <HighlightedText
                text={snippet.text}
                ranges={snippet.ranges}
                className="truncate text-xs text-muted-foreground"
              />
            )}
            {matchTag && (
              <span className="shrink-0 rounded border border-border bg-muted px-1 py-0 text-xs font-medium text-muted-foreground">
                {matchTag}
              </span>
            )}
          </span>
        )}
        <span className="flex-1" />
        {epic && epicColor && (
          <span
            className={cn(
              'hidden @[560px]:inline-flex min-w-14 shrink items-center overflow-hidden rounded border px-1.5 py-0.5 text-xs font-medium',
              epicColor.className,
            )}
            style={epicColor.style}
            title={`${epic.key}: ${epic.name}`}
          >
            <span className="truncate">{epic.name}</span>
          </span>
        )}
        <div className="flex shrink-0">
          <span className={statusPillClass(statusCategoryKey)}>{statusName}</span>
        </div>
        <span className="flex-none w-5" title={assigneeName ?? 'Unassigned'} aria-hidden="true">
          <CachedAvatar
            url={avatarUrl ?? undefined}
            name={assigneeName || 'Unassigned'}
            size={20}
          />
        </span>
      </div>
    </div>
  );
}
