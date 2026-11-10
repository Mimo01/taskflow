/**
 * NotificationRow — a rounded notification card (Phase 95).
 *
 *   [avatar + action badge]  line 1: KEY  parent > title                       time
 *                            line 2: coloured action + comment / single change
 *                            lines 3+: change list (multi-field updates) or "+N earlier comments"
 * - One card may stand for several merged notifications (same actor, same entity, <= 60 min apart);
 *   read / done / open act on all of them.
 * - An absolute inset-0 overlay <button> is the primary target; the key and tray
 *   buttons are SIBLINGS (relative z-10), never nested inside it.
 * - Unread vs read only changes class strings / the aria prefix, never the tree (D-05).
 * - Absolute time and full body live in a 600ms tooltip; the hover tray replaces the time.
 */
import { Check, ExternalLink, Mail, MailOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { useIsPeeked } from '@/stores/peek.store';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationAvatar from './NotificationAvatar';
import { ACTION_STYLE, EVENT_STYLE, MENTION_STYLE, UPDATE_STYLE } from './notification-colours';
import {
  type ChangeLine,
  type CommentLine,
  cleanCommentText,
  describeEntryParts,
  describeEventAria,
  describeEventAriaText,
  type EventParts,
  eventStyleFor,
  formatAbsoluteTime,
  getEntityRef,
  getEntityTitle,
  getJiraKey,
  relTime,
  statusCategoryGuess,
} from './notification-view';

interface NotificationRowProps {
  /** Latest notification of the card. */
  item: NotificationItem;
  /** All merged notifications, newest first; defaults to just `item`. */
  items?: NotificationItem[];
  isUnread: boolean;
  now: number;
  onOpen: () => void;
  onToggleRead: () => void;
  onDone: () => void;
  onOpenInBrowser?: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  'comment-mention': 'Mention',
  'gitlab-mention': 'Mention',
  'issue-update': 'Update',
  'mr-note': 'Comment',
  'jira-comment': 'Comment',
  'mr-approval': 'Approval',
  'pipeline-failure': 'Pipeline failure',
  'issue-assignment': 'Assignment',
  'due-date-reminder': 'Due date',
};

/* ── shared tray button ─────────────────────────────── */

export function NotificationTrayButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        render={
          <button
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="relative z-10 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <span className="flex items-center gap-2">
          {label}
          {shortcut ? (
            <kbd className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              {shortcut}
            </kbd>
          ) : null}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── line 2 ─────────────────────────────────────────── */

function StatusPill({ name }: { name: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 leading-none',
        statusCategoryBadgeClass(statusCategoryGuess(name)),
      )}
    >
      {name}
    </span>
  );
}

const ARROW = (
  <span aria-hidden="true" className="text-muted-foreground">
    {'\u2192'}
  </span>
);

function Value({ field, name }: { field: string; name: string }) {
  if (field === 'status') return <StatusPill name={name} />;
  return <span className="text-foreground">{name}</span>;
}

/** One change inline: coloured field label, then "old → new" / preformatted text. */
function ChangeInline({ change }: { change: ChangeLine }) {
  const colour = (change.action ? ACTION_STYLE[change.action] : UPDATE_STYLE).text;
  let tail: ReactNode = null;
  if (change.text) {
    tail = <span className="text-foreground">{change.text}</span>;
  } else if (change.from || change.to) {
    tail = (
      <>
        {change.from ? <Value field={change.field} name={change.from} /> : null}
        {change.from ? ' ' : null}
        {ARROW}{' '}
        {change.to ? (
          <Value field={change.field} name={change.to} />
        ) : (
          <span className="text-muted-foreground">none</span>
        )}
      </>
    );
  }
  return (
    <>
      <span className={cn('font-medium', colour)}>{change.field}</span>
      {tail ? <> {tail}</> : null}
    </>
  );
}

/** Line 2: one truncating block of inline runs, so a single ellipsis ends the whole line. */
export function NotificationDetailLine({
  parts,
  colour,
  unread,
  actor,
}: {
  parts: EventParts;
  colour: string;
  unread: boolean;
  /** Who did it (full display name); omitted for system events (pipeline, due). */
  actor?: string;
}) {
  let content: ReactNode;
  let kind: string;
  if (parts.changes && parts.changes.length === 1) {
    kind = 'changes';
    content = <ChangeInline change={parts.changes[0]} />;
  } else {
    const text = parts.commentText || parts.detail;
    kind = parts.commentText ? 'comment' : parts.detail ? 'text' : 'verb';
    content = (
      <>
        <span className={cn('font-medium', colour, !unread && 'opacity-80')}>{parts.verb}</span>
        {parts.verbSuffix ? (
          <span className="mx-1 rounded bg-foreground/10 px-1 text-foreground/80">
            {parts.verbSuffix}
          </span>
        ) : null}
        {text && !parts.comments ? <span className="text-muted-foreground"> {text}</span> : null}
      </>
    );
  }
  return (
    <span
      data-line="detail"
      data-detail={kind}
      className="pointer-events-none relative block h-5 truncate text-[11px] leading-5"
    >
      {actor ? (
        <span data-actor className="font-medium text-foreground">
          {actor}{' '}
        </span>
      ) : null}
      {content}
    </span>
  );
}

export const MAX_LISTED_CHANGES = 3;

function LabelChips({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((tok) => (
        <span key={tok} className="rounded bg-foreground/10 px-1 text-foreground">
          {tok}
        </span>
      ))}
    </>
  );
}

function ChangeValue({ change }: { change: ChangeLine }) {
  if (change.text) {
    return change.field === 'labels' ? (
      <LabelChips text={change.text} />
    ) : (
      <span className="font-medium text-foreground">{change.text}</span>
    );
  }
  return (
    <>
      {change.from ? (
        <>
          {change.field === 'status' ? (
            <StatusPill name={change.from} />
          ) : (
            <span className="truncate text-muted-foreground">{change.from}</span>
          )}
          {ARROW}
        </>
      ) : (
        ARROW
      )}
      {change.to ? (
        change.field === 'status' ? (
          <StatusPill name={change.to} />
        ) : (
          <span className="truncate font-medium text-foreground">{change.to}</span>
        )
      ) : (
        <span className="text-muted-foreground">none</span>
      )}
    </>
  );
}

/** Compact change list for multi-field updates: icon, fixed-width field name, old → new; max 3 + "+N more". */
export function NotificationChangeList({ changes }: { changes: ChangeLine[] }) {
  const shown = changes.slice(0, MAX_LISTED_CHANGES);
  const hidden = changes.length - shown.length;
  return (
    <ul data-change-list className="pointer-events-none relative mt-1 flex flex-col gap-1">
      {shown.map((c) => {
        const style = c.action ? ACTION_STYLE[c.action] : UPDATE_STYLE;
        const Icon = style.Icon;
        return (
          <li
            key={`${c.field}|${c.action ?? ''}|${c.text ?? c.to ?? ''}`}
            data-change-row
            className="flex h-5 items-center gap-1.5 text-[11px] leading-5"
          >
            <Icon aria-hidden="true" className={cn('size-3 flex-none', style.text)} />
            <span className="w-[6.5rem] flex-none truncate text-muted-foreground">{c.field}</span>
            <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap">
              <ChangeValue change={c} />
            </span>
          </li>
        );
      })}
      {hidden > 0 ? (
        <li
          data-change-more
          className="h-5 pl-[1.125rem] text-[11px] leading-5 text-muted-foreground"
        >
          +{hidden} more change{hidden === 1 ? '' : 's'}
        </li>
      ) : null}
    </ul>
  );
}

/** Merged conversation: one line per comment (icon, text), newest first; max 3 + "+N more". */
export function NotificationCommentList({ comments }: { comments: CommentLine[] }) {
  const shown = comments.slice(0, MAX_LISTED_CHANGES);
  const hidden = comments.length - shown.length;
  return (
    <ul data-comment-list className="pointer-events-none relative mt-1 flex flex-col gap-1">
      {shown.map((c) => {
        const style = c.mention ? MENTION_STYLE : EVENT_STYLE['jira-comment'];
        const Icon = style.Icon;
        return (
          <li
            key={c.id}
            data-comment-row
            className="flex h-5 items-center gap-1.5 text-[11px] leading-5"
          >
            <Icon aria-hidden="true" className={cn('size-3 flex-none', style.text)} />
            <span className="min-w-0 flex-1 truncate text-foreground/90">{c.text}</span>
          </li>
        );
      })}
      {hidden > 0 ? (
        <li
          data-comment-more
          className="h-5 pl-[1.125rem] text-[11px] leading-5 text-muted-foreground"
        >
          +{hidden} more comment{hidden === 1 ? '' : 's'}
        </li>
      ) : null}
    </ul>
  );
}

/** Tooltip lines for a merged card: all changes, or the comments latest first. */
function mergedTooltip(items: NotificationItem[], parts: EventParts): ReactNode {
  if (parts.changes && parts.changes.length > MAX_LISTED_CHANGES) {
    return (
      <div className="flex flex-col gap-0.5">
        {parts.changes.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          <div key={i}>
            {c.field}
            {c.text ? ` ${c.text}` : ''}
            {c.from ? ` ${c.from}` : ''}
            {c.from || c.to ? ` \u2192 ${c.to ?? 'none'}` : ''}
          </div>
        ))}
      </div>
    );
  }
  if (parts.count && parts.count > 1) {
    return (
      <div className="flex flex-col gap-1">
        {items.map((i) => (
          <div key={i.id} className="line-clamp-2">
            {cleanCommentText(i.fullBody || i.bodyPreview)}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/* ── component ──────────────────────────────────────── */

export default function NotificationRow({
  item,
  items,
  isUnread,
  now,
  onOpen,
  onToggleRead,
  onDone,
  onOpenInBrowser,
}: NotificationRowProps) {
  const all = items && items.length > 0 ? items : [item];
  const ref = getEntityRef(item);
  const title = getEntityTitle(item);
  const parts = describeEntryParts(all);
  const style = eventStyleFor(item, parts);
  const peeked = useIsPeeked(getJiraKey(item) ?? '');
  const typeLabel = (item.notificationType && TYPE_LABEL[item.notificationType]) || 'Notification';
  const sourceLabel = item.source === 'jira' ? 'Jira' : 'GitLab';
  const parentLabel = item.parentKey
    ? `${item.parentKey}${item.parentSummary ? ` ${item.parentSummary}` : ''}`
    : '';
  const ariaText = describeEventAriaText(parts);
  const ariaLabel = `${isUnread ? 'Unread. ' : ''}${describeEventAria(parts)} on ${ref ? `${ref} ` : ''}${title}${parentLabel ? ` (in ${parentLabel})` : ''}${ariaText ? `: ${ariaText}` : ''}`;
  const listChanges = parts.changes && parts.changes.length >= 2 ? parts.changes : null;
  const merged = mergedTooltip(all, parts);

  return (
    <div
      data-card
      data-unread-card={isUnread ? 'true' : 'false'}
      className={cn(
        'group/row relative flex items-start gap-3 rounded-xl border px-3 py-2.5 text-xs transition-colors density-compact:gap-2.5 density-compact:px-2.5 density-compact:py-1.5 density-comfortable:gap-3.5 density-comfortable:px-3.5 density-comfortable:py-3.5 hover:bg-accent hover:shadow-sm focus-within:bg-accent',
        isUnread
          ? 'border-border bg-primary/[0.03] dark:bg-primary/[0.07]'
          : 'border-border/60 bg-card',
        peeked && PEEKED_ROW_CLASS,
      )}
      data-peeked={peeked ? 'true' : undefined}
    >
      <Tooltip>
        <TooltipTrigger
          delay={600}
          render={
            <button
              type="button"
              data-entry-primary
              aria-label={ariaLabel}
              onClick={onOpen}
              className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        />
        <TooltipContent>
          <TooltipBody
            title={item.entityTitle}
            note={`${sourceLabel} \u00B7 ${typeLabel} \u00B7 ${formatAbsoluteTime(item.createdAt)}`}
          >
            {merged ??
              (item.fullBody ? (
                <div className="line-clamp-3 whitespace-pre-line">{item.fullBody}</div>
              ) : null)}
            {item.parentKey ? (
              <div className="truncate text-muted-foreground">
                Parent: {item.parentKey} {item.parentSummary}
              </div>
            ) : null}
            {!merged && !item.fullBody && parts.changes && parts.changes.length > 0 ? (
              <div className="whitespace-pre-line">{item.bodyPreview}</div>
            ) : null}
          </TooltipBody>
        </TooltipContent>
      </Tooltip>

      <span
        data-unread={isUnread ? 'true' : 'false'}
        className={cn(
          'pointer-events-none absolute top-3.5 left-1 size-1.5 rounded-full bg-primary',
          !isUnread && 'opacity-0',
        )}
      />

      <NotificationAvatar item={item} style={style} />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="relative flex h-5 items-center gap-1.5">
          {ref ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="relative z-10 min-w-[5rem] flex-none cursor-pointer whitespace-nowrap text-left font-mono text-[11px] text-muted-foreground hover:underline @max-[22rem]:hidden"
            >
              {ref}
            </button>
          ) : null}
          <span className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden pr-0.5">
            {item.parentKey && item.parentSummary ? (
              <span
                data-parent
                className="flex min-w-[3rem] max-w-[55%] flex-[0_100_auto] items-baseline gap-1 overflow-hidden text-muted-foreground @max-[26rem]:hidden"
              >
                <span className="min-w-0 truncate">{item.parentSummary}</span>
                <span aria-hidden="true" className="flex-none">
                  {'\u203A'}
                </span>
              </span>
            ) : null}
            <span
              className={cn(
                'min-w-0 flex-[0_1_auto] truncate',
                isUnread ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
              )}
            >
              {title}
            </span>
          </span>
          <span className="pointer-events-none relative w-9 flex-none text-right text-[11px] tabular-nums text-muted-foreground group-hover/row:opacity-0 group-focus-within/row:opacity-0">
            {relTime(item.createdAt, now)}
          </span>
          <span className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 bg-accent pl-1 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100">
            <NotificationTrayButton
              label={isUnread ? 'Mark as read' : 'Mark as unread'}
              shortcut="U"
              onClick={onToggleRead}
            >
              {isUnread ? <MailOpen className="size-3.5" /> : <Mail className="size-3.5" />}
            </NotificationTrayButton>
            {onOpenInBrowser && item.url ? (
              <LinkContextMenu href={item.url}>
                <NotificationTrayButton label="Open in browser" onClick={onOpenInBrowser}>
                  <ExternalLink className="size-3.5" />
                </NotificationTrayButton>
              </LinkContextMenu>
            ) : null}
            <NotificationTrayButton label="Done" shortcut="E" onClick={onDone}>
              <Check className="size-3.5" />
            </NotificationTrayButton>
          </span>
        </div>
        <NotificationDetailLine
          parts={parts}
          colour={style.text}
          unread={isUnread}
          actor={
            item.notificationType === 'pipeline-failure' ||
            item.notificationType === 'due-date-reminder'
              ? undefined
              : item.author || undefined
          }
        />
        {listChanges ? <NotificationChangeList changes={listChanges} /> : null}
        {parts.comments && parts.comments.length > 1 ? (
          <NotificationCommentList comments={parts.comments} />
        ) : null}
      </div>
    </div>
  );
}
