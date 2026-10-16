import { Clock, FileText, MessageSquare } from 'lucide-react';
import type React from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { epicColorToTailwind } from '@/lib/epicColors';
import { isDoneStatus } from '@/lib/issueDisplayUtils';
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

/**
 * Strict row grid: [icon 14px] gap 8 [key column] gap 8 [title …] … [status] [avatar].
 * Subtasks use the same columns (no row shift — variable key lengths would break the
 * alignment); nesting is shown by the subtask type icon (↳) under its dimmed parent.
 */
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
  // Done issues show a struck-through key, like TaskCard / StoryHeaderRow.
  const done = isDoneStatus(statusCategoryKey ? { key: statusCategoryKey } : null);
  return (
    <div className="@container w-full min-w-0">
      {/* Line 1 is a fixed 18px (= avatar / status pill height) on every row. */}
      <div
        data-indent={indent || undefined}
        className={cn(
          'flex h-[18px] min-w-0 items-center gap-2 whitespace-nowrap',
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
            className={cn(
              KEY_CLASS,
              'cursor-pointer',
              done
                ? 'line-through hover:[text-decoration-line:underline_line-through]'
                : 'hover:underline',
            )}
            onClick={(e) => onKeyClick(e, issueKey)}
          >
            {keyLabel ?? issueKey}
          </button>
        ) : (
          <span className={cn(KEY_CLASS, done && 'line-through')}>{keyLabel ?? issueKey}</span>
        )}
        <HighlightedText
          text={title}
          ranges={dimmed ? undefined : titleRanges}
          className="truncate text-[0.8125rem] min-w-0 flex-[0_1_auto]"
        />
        <span className="flex-1" />
        {epic && epicColor && (
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
      {matchTag && (
        // Body match (description / comment): a second line under the title column with up to
        // two lines of highlighted context, so you can see what actually matched.
        <div
          data-match-line
          className="mt-0.5 flex min-w-0 items-start gap-1.5 pl-[calc(0.875rem+0.5rem+4.25rem+0.5rem)] text-xs leading-4 text-muted-foreground"
        >
          <span
            role="img"
            aria-label={MATCH_LABEL[matchTag]}
            title={MATCH_LABEL[matchTag]}
            className="mt-0.5 inline-flex shrink-0 text-muted-foreground/70"
          >
            {matchTag === 'desc' ? (
              <FileText className="size-3" />
            ) : (
              <MessageSquare className="size-3" />
            )}
          </span>
          {snippet ? (
            <HighlightedText
              text={snippet.text}
              ranges={snippet.ranges}
              className="line-clamp-2 min-w-0 whitespace-normal break-words"
            />
          ) : (
            <span className="italic pr-0.5">{MATCH_LABEL[matchTag]}</span>
          )}
        </div>
      )}
    </div>
  );
}
