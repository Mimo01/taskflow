/**
 * Actor avatar with a small coloured event badge on its bottom-right corner.
 * System events (pipeline failure, due reminder) get a neutral tile instead.
 * Fixed pixel sizing (CachedAvatar / explicit size classes) so WebKit never
 * collapses the slot to 0 width.
 */
import { CalendarClock, GitBranch } from 'lucide-react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '../../stores/notifications.store';
import type { EventStyle } from './notification-colours';

interface NotificationAvatarProps {
  item: NotificationItem;
  style: EventStyle;
  /** Smaller variant for nested group children. */
  small?: boolean;
  /** Grouped row: the next distinct actor, drawn peeking out behind the newest actor's avatar. */
  behind?: NotificationItem;
  /** Grouped row: number of earlier events, drawn as a "+N" bubble ending the stack. */
  moreCount?: number;
  onToggleMore?: () => void;
}

export default function NotificationAvatar({
  item,
  style,
  small = false,
  behind,
  moreCount = 0,
  onToggleMore,
}: NotificationAvatarProps) {
  const type = item.notificationType;
  const px = small ? 'size-5' : 'size-6';
  const Icon = style.Icon;
  const badgeSize = small ? 'size-3' : 'size-3.5';
  const glyph = small ? 'size-2' : 'size-2.5';
  let lead: React.ReactNode;
  let showBadge = true;
  if (type === 'pipeline-failure') {
    lead = (
      <span
        data-avatar-tile="ci"
        className={cn('flex flex-none items-center justify-center rounded-md bg-muted', px)}
      >
        <GitBranch aria-hidden="true" className="size-3 text-muted-foreground" />
      </span>
    );
  } else if (type === 'due-date-reminder') {
    showBadge = false;
    lead = (
      <span
        data-avatar-tile="due"
        className={cn('flex flex-none items-center justify-center rounded-md bg-amber-500/15', px)}
      >
        <CalendarClock aria-hidden="true" className="size-3.5 text-amber-600 dark:text-amber-400" />
      </span>
    );
  } else {
    lead = (
      <CachedAvatar
        url={item.authorAvatarUrl}
        name={item.author}
        size={small ? 20 : 24}
        className={cn(
          'rounded-full [&_div]:text-[8px]',
          behind
            ? 'ring-2 ring-popover group-hover/row:ring-accent group-focus-within/row:ring-accent'
            : 'ring-1 ring-foreground/15',
        )}
      />
    );
  }
  return (
    <span
      data-event-kind={style.kind}
      data-avatar-stack={behind ? 'true' : undefined}
      className="pointer-events-none relative flex h-6 w-[3.75rem] flex-none items-center"
    >
      {behind ? (
        <span data-avatar-behind className={cn('absolute left-5 flex', px)}>
          <CachedAvatar
            url={behind.authorAvatarUrl}
            name={behind.author}
            size={24}
            className="rounded-full ring-1 ring-foreground/15 [&_div]:text-[8px]"
          />
        </span>
      ) : null}
      <span className={cn('relative flex flex-none', px)}>
        {lead}
        {showBadge ? (
          <span
            data-event-badge={style.kind}
            className={cn(
              'absolute -right-1 -bottom-1 flex items-center justify-center rounded-full text-white ring-2 ring-popover group-hover/row:ring-accent group-focus-within/row:ring-accent',
              badgeSize,
              style.badge,
            )}
          >
            <Icon aria-hidden="true" className={glyph} />
          </span>
        ) : null}
      </span>
      {moreCount > 0 ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          data-group-more
          onClick={(e) => {
            e.stopPropagation();
            onToggleMore?.();
          }}
          className={cn(
            'pointer-events-auto absolute z-10 flex h-[18px] min-w-[18px] cursor-pointer items-center justify-center rounded-full bg-muted px-1 text-[9px] font-medium tabular-nums text-muted-foreground ring-2 ring-popover hover:text-foreground group-hover/row:ring-accent group-focus-within/row:ring-accent',
            behind ? 'left-10' : 'left-6',
          )}
        >
          +{moreCount}
        </button>
      ) : null}
    </span>
  );
}
