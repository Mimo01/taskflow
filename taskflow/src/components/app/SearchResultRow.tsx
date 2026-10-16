import { Clock, FileText, MessageSquare } from 'lucide-react';
import type React from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { epicColorToTailwind } from '@/lib/epicColors';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { HighlightedText } from './HighlightedText';

type Range = readonly [number, number];

export interface SearchResultRowProps {
  issueKey: string;
  /** Display label for the key cell (e.g. "!67" for MRs); defaults to issueKey. */
  keyLabel?: string;
  title: string;
  titleRanges?: ReadonlyArray<Range>;
  /** Issue type for the leading icon; falls back to `icon`, then a clock glyph. */
  typeName?: string;
  icon?: React.ReactNode;
  /** Omitted for rows without status data (MRs, uncached recents): pill is not rendered. */
  statusName?: string;
  statusCategoryKey?: string;
  epic?: { key: string; name: string; color: string } | null;
  /** false for subtasks and epics (stories only). */
  showEpic: boolean;
  /** undefined = no assignee data (empty, aligned slot); null = Unassigned. */
  assigneeName?: string | null;
  avatarUrl?: string | null;
  snippet?: { text: string; ranges: ReadonlyArray<Range> } | null;
  matchTag?: 'desc' | 'comment' | null;
  /** Context-only parent row: same layout and size as any row, only faded (opacity-40). */
  dimmed?: boolean;
  indent?: boolean;
  /** When omitted the key renders as plain text (e.g. inside a parent <button>). */
  onKeyClick?: (e: React.MouseEvent, issueKey: string) => void;
}

const MATCH_LABEL = { desc: 'Matched in description', comment: 'Matched in a comment' } as const;

/** Key cell: min width so titles line up across rows with different key lengths. */
const KEY_CLASS =
  'min-w-[4.25rem] shrink-0 text-left font-mono text-[0.6875rem] text-muted-foreground';

/**
 * Subtle hairline above a row that starts a new story group (a story, or a dimmed
 * parent + its subtasks). Pseudo-element so it never shifts layout or clashes
 * with the item's selection background. Not applied to the first row of a list.
 */
export const GROUP_DIVIDER_CLASS =
  'relative before:pointer-events-none before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-border/60';

/** True when `rows[i]` starts a new story group below another group. */
export function startsGroup(rows: ReadonlyArray<{ indent: boolean }>, i: number): boolean {
  return i > 0 && !rows[i].indent;
}

/** One-line search result row content; the palette wraps it in a CommandItem. */
export function SearchResultRow({
  issueKey,
  keyLabel,
  title,
  titleRanges,
  typeName,
  icon,
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
      {/* Fixed 18px (= avatar / status pill height): every row is the same height. */}
      <div
        className={cn(
          'flex h-[18px] min-w-0 items-center gap-2 whitespace-nowrap',
          indent && 'pl-6',
          dimmed && 'opacity-40',
        )}
      >
        {icon ??
          (typeName !== undefined ? (
            <IssueTypeIcon typeName={typeName} className="size-3.5 shrink-0" />
          ) : (
            <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          ))}
        {onKeyClick ? (
          <button
            type="button"
            className={cn(KEY_CLASS, 'cursor-pointer hover:underline')}
            onClick={(e) => onKeyClick(e, issueKey)}
          >
            {keyLabel ?? issueKey}
          </button>
        ) : (
          <span className={KEY_CLASS}>{keyLabel ?? issueKey}</span>
        )}
        {/* The title has priority: the snippet starts at basis 0 and only fills leftover
            space, so it can never squeeze the title. When space runs out the epic badge
            gives way before the title. The tag stays so a body match is always labelled. */}
        <HighlightedText
          text={title}
          ranges={dimmed ? undefined : titleRanges}
          className={cn(
            'truncate text-[0.8125rem] min-w-0 flex-[0_1_auto]',
            // Body match: title and snippet each keep a minimum so both stay readable.
            snippet && 'min-w-[7rem] @[600px]:min-w-[10rem]',
          )}
        />
        {matchTag && (
          // Compact icon label (description / comment); the tooltip carries the matched text.
          <span
            role="img"
            aria-label={MATCH_LABEL[matchTag]}
            title={`${MATCH_LABEL[matchTag]}${snippet ? `: ${snippet.text}` : ''}`}
            className="inline-flex shrink-0 text-muted-foreground"
          >
            {matchTag === 'desc' ? (
              <FileText className="size-3.5" />
            ) : (
              <MessageSquare className="size-3.5" />
            )}
          </span>
        )}
        {snippet ? (
          <HighlightedText
            text={snippet.text}
            ranges={snippet.ranges}
            className="min-w-[6rem] @[600px]:min-w-[8rem] flex-[1_1_0%] truncate text-xs text-muted-foreground"
          />
        ) : null}
        {/* Spacer; a snippet already fills the free space. */}
        {!snippet && <span className="flex-1" />}
        {/* Body-match rows trade the epic badge for the matched snippet. */}
        {epic && epicColor && !snippet && (
          <span
            className={cn(
              'hidden @[560px]:inline-flex min-w-14 max-w-28 flex-[0_100_auto] items-center overflow-hidden rounded border px-1 text-[0.6875rem] leading-4 font-medium',
              epicColor.className,
            )}
            style={epicColor.style}
            title={`${epic.key}: ${epic.name}`}
          >
            <span className="truncate">{epic.name}</span>
          </span>
        )}
        {statusName && (
          // Compact pill (status colour only): short statuses share one width so they align,
          // long ones grow up to max-w-28 instead of truncating.
          <span
            title={statusName}
            className={cn(
              'inline-flex min-w-[4.25rem] max-w-28 shrink-0 justify-center rounded px-1.5 py-px text-[0.6875rem] leading-4 font-medium',
              statusCategoryBadgeClass(statusCategoryKey),
            )}
          >
            <span className="truncate">{statusName}</span>
          </span>
        )}
        {assigneeName === undefined ? (
          <span className="flex-none w-[18px]" aria-hidden="true" />
        ) : (
          <span
            className="flex-none w-[18px]"
            title={assigneeName ?? 'Unassigned'}
            aria-hidden="true"
          >
            <CachedAvatar
              url={avatarUrl ?? undefined}
              name={assigneeName || 'Unassigned'}
              size={18}
            />
          </span>
        )}
      </div>
    </div>
  );
}
