/**
 * NotificationRow — one-line, neutral event row (Phase 95 D-02..D-05, D-08, D-14).
 *
 * Layout: [unread dot][avatar+event badge][KEY][entity title][coloured verb | status pills][time]
 * Nested (grouped) rows: [dot][avatar+badge][coloured verb][muted snippet][time]
 * - An absolute inset-0 overlay <button> is the primary target; the key and tray
 *   buttons are SIBLINGS (relative z-10), never nested inside it.
 * - Unread vs read only changes class strings / the aria prefix, never the tree (D-05).
 * - Body, parent and absolute time live in a 600ms tooltip only.
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
import type { EventStyle } from './notification-colours';
import {
  describeEventAria,
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
  /** Child of a group: extra indent, key hidden. */
  nested?: boolean;
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

/* ── event tail: coloured verb, or status pills ────── */

export function NotificationTail({
  parts,
  style,
  unread,
}: {
  parts: EventParts;
  style: EventStyle;
  unread: boolean;
}) {
  if (parts.to) {
    return (
      <span
        data-tail="status"
        className="pointer-events-none relative flex flex-none items-center gap-1 text-[11px]"
      >
        {parts.from ? (
          <>
            <div className="flex">
              <span
                className={cn(
                  'whitespace-nowrap rounded px-1',
                  statusCategoryBadgeClass(statusCategoryGuess(parts.from)),
                )}
              >
                {parts.from}
              </span>
            </div>
            <span aria-hidden="true" className="text-muted-foreground">
              {'\u2192'}
            </span>
          </>
        ) : (
          <span aria-hidden="true" className="text-muted-foreground">
            {'\u2192'}
          </span>
        )}
        <div className="flex">
          <span
            className={cn(
              'whitespace-nowrap rounded px-1',
              statusCategoryBadgeClass(statusCategoryGuess(parts.to)),
            )}
          >
            {parts.to}
          </span>
        </div>
      </span>
    );
  }
  return (
    <span
      data-tail="verb"
      className={cn(
        'pointer-events-none relative max-w-[40%] flex-none truncate pr-0.5 font-medium',
        style.text,
        !unread && 'opacity-80',
      )}
    >
      {parts.verb}
    </span>
  );
}

/* ── component ──────────────────────────────────────── */

export default function NotificationRow({
  item,
  isUnread,
  now,
  nested = false,
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
  const ariaLabel = `${isUnread ? 'Unread. ' : ''}${describeEventAria(parts)} on ${ref ? `${ref} ` : ''}${title}`;

  return (
    <div
      className={cn(
        'group relative flex h-8 items-center gap-1 px-2 text-xs density-compact:h-7 density-comfortable:h-9 hover:bg-accent focus-within:bg-accent',
        nested && 'pl-8',
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
          </TooltipBody>
        </TooltipContent>
      </Tooltip>

      <span className="pointer-events-none relative flex w-2 flex-none justify-center">
        <span
          data-unread={isUnread ? 'true' : 'false'}
          className={cn('size-1.5 rounded-full bg-primary', !isUnread && 'opacity-0')}
        />
      </span>

      <NotificationAvatar item={item} style={style} small={nested} />

      {nested ? (
        <>
          <NotificationTail parts={parts} style={style} unread={isUnread} />
          <span className="pointer-events-none relative min-w-0 flex-1 truncate text-muted-foreground">
            {parts.snippet}
          </span>
        </>
      ) : (
        <>
          {ref ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="relative z-10 min-w-[3.75rem] flex-none text-left cursor-pointer font-mono text-[11px] text-muted-foreground hover:underline @max-[22rem]:hidden"
            >
              {ref}
            </button>
          ) : null}
          <span
            className={cn(
              'pointer-events-none relative min-w-0 flex-1 truncate pr-0.5',
              isUnread ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
            )}
          >
            {title}
          </span>
          <NotificationTail parts={parts} style={style} unread={isUnread} />
        </>
      )}

      <span className="pointer-events-none relative w-12 flex-none text-right text-[11px] tabular-nums text-muted-foreground group-hover:opacity-0 group-focus-within:opacity-0">
        {relTime(item.createdAt, now)}
      </span>

      <span className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 bg-accent pl-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
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
  );
}
