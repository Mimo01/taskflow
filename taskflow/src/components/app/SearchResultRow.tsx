import { Clock, FileText, MessageSquare, TextSearch } from 'lucide-react';
import type React from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { epicColorToTailwind } from '@/lib/epicColors';
import type { MatchTag } from '@/lib/global-search';
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
  matchTag?: MatchTag | null;
  /** Context-only parent row: same layout and size as any row, only faded (opacity-40). */
  dimmed?: boolean;
  indent?: boolean;
  /** When omitted the key renders as plain text (e.g. inside a parent <button>). */
  onKeyClick?: (e: React.MouseEvent, issueKey: string) => void;
}

const MATCH_LABEL: Record<MatchTag, string> = {
  desc: 'Matched in description',
  comment: 'Matched in a comment',
  other: 'Matched in another field',
};

const MATCH_ICON: Record<MatchTag, typeof FileText> = {
  desc: FileText,
  comment: MessageSquare,
  other: TextSearch,
};

/**
 * Row grid: [icon 14px] gap 8 [key column] gap 8 [title …] … [status] [avatar].
 * Subtasks indent the whole row (both lines) by one fixed step (pl-3), so every subtask
 * sits at the same level; right-hand cells stay aligned. The match line starts under the
 * key column of its own row.
 */
const KEY_CLASS = 'min-w-[4.5rem] shrink-0 text-left font-mono text-xs text-muted-foreground';

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
  const MatchIcon = matchTag ? MATCH_ICON[matchTag] : null;
  return (
    <div className={cn('@container w-full min-w-0', indent && 'pl-3')}>
      {/* Line 1 is a fixed 20px (= avatar / status pill height) on every row. */}
      <div
        data-indent={indent || undefined}
        className={cn(
          'flex h-5 min-w-0 items-center gap-2 whitespace-nowrap',
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
          className="truncate text-sm min-w-0 flex-[0_1_auto]"
        />
        <span className="flex-1" />
        {epic && epicColor && (
          <span
            className={cn(
              'hidden @[560px]:inline-flex min-w-14 max-w-32 flex-[0_100_auto] items-center overflow-hidden rounded border px-1.5 py-0.5 text-xs leading-4 font-medium',
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
              'inline-flex min-w-[4.5rem] max-w-28 shrink-0 justify-center rounded px-1.5 py-0.5 text-xs leading-4 font-medium',
              statusCategoryBadgeClass(statusCategoryKey),
            )}
          >
            <span className="truncate">{statusName}</span>
          </span>
        )}
        {assigneeName === undefined ? (
          <span className="flex-none w-5" aria-hidden="true" />
        ) : (
          <span className="flex-none w-5" title={assigneeName ?? 'Unassigned'} aria-hidden="true">
            <CachedAvatar
              url={avatarUrl ?? undefined}
              name={assigneeName || 'Unassigned'}
              size={20}
            />
          </span>
        )}
      </div>
      {matchTag && (
        // Body match (description / comment): one truncating line of highlighted context under
        // the row's key column, so you can see what actually matched.
        <div
          data-match-line
          className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-[1.375rem] text-xs leading-4 text-muted-foreground"
        >
          <span
            role="img"
            aria-label={MATCH_LABEL[matchTag]}
            title={MATCH_LABEL[matchTag]}
            className="inline-flex shrink-0 text-muted-foreground/70"
          >
            {MatchIcon && <MatchIcon className="size-3" />}
          </span>
          {snippet ? (
            <HighlightedText
              text={snippet.text}
              ranges={snippet.ranges}
              className="min-w-0 truncate"
            />
          ) : (
            <span className="italic pr-0.5">{MATCH_LABEL[matchTag]}</span>
          )}
        </div>
      )}
    </div>
  );
}
