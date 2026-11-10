/**
 * NotificationRow — flat two-line notification row (Phase 95).
 *
 *   [unread dot][avatar + action badge] line 1: KEY  parent › title            time
 *                                       line 2: coloured verb + details (full width)
 * - Line 2 starts at the same x as the key. Comments show their text; updates show every
 *   change inline ("field old → new · field old → new"); system events show a short detail.
 * - An absolute inset-0 overlay <button> is the primary target; the key and tray
 *   buttons are SIBLINGS (relative z-10), never nested inside it.
 * - Unread vs read only changes class strings / the aria prefix, never the tree (D-05).
 * - Absolute time and full body live in a 600ms tooltip; the hover tray replaces the time.
 */
import { Check, ExternalLink, Mail, MailOpen } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { useIsPeeked } from '@/stores/peek.store';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationAvatar from './NotificationAvatar';
import { ACTION_STYLE, UPDATE_STYLE } from './notification-colours';
import {
  type ChangeLine,
  describeEventAria,
  describeEventAriaText,
  describeEventParts,
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
  item: NotificationItem;
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
        'whitespace-nowrap rounded px-1 py-px',
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
}: {
  parts: EventParts;
  colour: string;
  unread: boolean;
}) {
  let content: ReactNode;
  let kind: string;
  if (parts.changes && parts.changes.length > 0) {
    kind = 'changes';
    content = parts.changes.map((c, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable list
      <Fragment key={i}>
        {i > 0 ? (
          <span aria-hidden="true" className="text-muted-foreground">
            {' \u00B7 '}
          </span>
        ) : null}
        <ChangeInline change={c} />
      </Fragment>
    ));
  } else {
    const text = parts.commentText || parts.detail;
    kind = parts.commentText ? 'comment' : parts.detail ? 'text' : 'verb';
    content = (
      <>
        <span className={cn('font-medium', colour, !unread && 'opacity-80')}>{parts.verb}</span>
        {text ? <span className="text-muted-foreground"> {text}</span> : null}
      </>
    );
  }
  return (
    <span
      data-line="detail"
      data-detail={kind}
      className="pointer-events-none relative block h-4 truncate text-[11px] leading-4"
    >
      {content}
    </span>
  );
}

/* ── component ──────────────────────────────────────── */

export default function NotificationRow({
  item,
  isUnread,
  now,
  onOpen,
  onToggleRead,
  onDone,
  onOpenInBrowser,
}: NotificationRowProps) {
  const ref = getEntityRef(item);
  const title = getEntityTitle(item);
  const parts = describeEventParts(item);
  const style = eventStyleFor(item, parts);
  const peeked = useIsPeeked(getJiraKey(item) ?? '');
  const typeLabel = (item.notificationType && TYPE_LABEL[item.notificationType]) || 'Notification';
  const sourceLabel = item.source === 'jira' ? 'Jira' : 'GitLab';
  const parentLabel = item.parentKey
    ? `${item.parentKey}${item.parentSummary ? ` ${item.parentSummary}` : ''}`
    : '';
  const ariaText = describeEventAriaText(parts);
  const ariaLabel = `${isUnread ? 'Unread. ' : ''}${describeEventAria(parts)} on ${ref ? `${ref} ` : ''}${title}${parentLabel ? ` (in ${parentLabel})` : ''}${ariaText ? `: ${ariaText}` : ''}`;

  return (
    <div
      className={cn(
        'group/row relative flex h-14 items-center gap-2 border-b border-border/60 px-2 text-xs density-compact:h-12 density-comfortable:h-16 hover:bg-accent focus-within:bg-accent',
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
              className="absolute inset-0 cursor-pointer rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            />
          }
        />
        <TooltipContent>
          <TooltipBody
            title={item.entityTitle}
            note={`${sourceLabel} · ${typeLabel} · ${formatAbsoluteTime(item.createdAt)}`}
          >
            {item.fullBody ? (
              <div className="line-clamp-3 whitespace-pre-line">{item.fullBody}</div>
            ) : null}
            {item.parentKey ? (
              <div className="truncate text-muted-foreground">
                Parent: {item.parentKey} {item.parentSummary}
              </div>
            ) : null}
            {!item.fullBody && parts.changes && parts.changes.length > 0 ? (
              <div className="whitespace-pre-line">{item.bodyPreview}</div>
            ) : null}
          </TooltipBody>
        </TooltipContent>
      </Tooltip>

      <span className="pointer-events-none flex w-2 flex-none justify-center">
        <span
          data-unread={isUnread ? 'true' : 'false'}
          className={cn('size-1.5 rounded-full bg-primary', !isUnread && 'opacity-0')}
        />
      </span>

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
                isUnread ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
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
        <NotificationDetailLine parts={parts} colour={style.text} unread={isUnread} />
      </div>
    </div>
  );
}
