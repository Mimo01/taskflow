/**
 * NotificationRow — one-line, neutral event row (Phase 95 D-02..D-05, D-08, D-14).
 *
 * Layout: [unread dot][type glyph][avatar][KEY][action + snippet][time]
 * - An absolute inset-0 overlay <button> is the primary target; the key and tray
 *   buttons are SIBLINGS (relative z-10), never nested inside it.
 * - Unread vs read only changes class strings / the aria prefix, never the tree (D-05).
 * - Body, parent and absolute time live in a 600ms tooltip only.
 */
import {
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ExternalLink,
  Mail,
  MailOpen,
  MessageSquare,
  RefreshCw,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { cn } from '@/lib/utils';
import { useIsPeeked } from '@/stores/peek.store';
import type { NotificationItem } from '../../stores/notifications.store';
import {
  describeEvent,
  formatAbsoluteTime,
  getEntityRef,
  getEntityTitle,
  getJiraKey,
  relTime,
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

/* ── type glyph (only 3 types carry colour) ─────────── */

export function NotificationTypeGlyph({ item }: { item: NotificationItem }) {
  const neutral = 'size-4 text-muted-foreground';
  let icon: ReactNode;
  let status = false;
  switch (item.notificationType) {
    case 'comment-mention':
    case 'jira-comment':
    case 'gitlab-mention':
    case 'mr-note':
      icon = <MessageSquare aria-hidden="true" className={neutral} />;
      break;
    case 'issue-update':
      icon = <RefreshCw aria-hidden="true" className={neutral} />;
      break;
    case 'issue-assignment':
      icon = <UserPlus aria-hidden="true" className={neutral} />;
      break;
    case 'mr-approval':
      status = true;
      icon = (
        <CheckCircle2 aria-hidden="true" className="size-4 text-green-600 dark:text-green-400" />
      );
      break;
    case 'pipeline-failure':
      status = true;
      icon = <XCircle aria-hidden="true" className="size-4 text-destructive" />;
      break;
    case 'due-date-reminder':
      status = true;
      icon = (
        <CalendarClock aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />
      );
      break;
    default:
      icon = <Bell aria-hidden="true" className={neutral} />;
  }
  return (
    <span
      data-tone={status ? 'status' : 'neutral'}
      className="pointer-events-none relative flex size-4 flex-none items-center justify-center"
    >
      {icon}
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
  const text = describeEvent(item);
  const peeked = useIsPeeked(getJiraKey(item) ?? '');
  const typeLabel = (item.notificationType && TYPE_LABEL[item.notificationType]) || 'Notification';
  const sourceLabel = item.source === 'jira' ? 'Jira' : 'GitLab';
  const ariaLabel = `${isUnread ? 'Unread. ' : ''}${ref ? `${ref} ` : ''}${title}: ${text}`;

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

      <NotificationTypeGlyph item={item} />

      <span className="relative size-5 flex-none">
        {item.author ? (
          <CachedAvatar url={item.authorAvatarUrl} name={item.author} size={20} />
        ) : null}
      </span>

      {!nested && ref ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="relative z-10 flex-none cursor-pointer font-mono text-[11px] text-muted-foreground hover:underline @max-[22rem]:hidden"
        >
          {ref}
        </button>
      ) : null}

      <span
        className={cn(
          'pointer-events-none relative min-w-0 flex-1 truncate',
          isUnread ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
        )}
      >
        {text}
      </span>

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
