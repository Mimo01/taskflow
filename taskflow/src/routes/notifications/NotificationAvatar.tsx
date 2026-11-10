/**
 * Actor avatar with a small coloured action badge on its bottom-right corner.
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
}

export default function NotificationAvatar({ item, style }: NotificationAvatarProps) {
  const type = item.notificationType;
  const Icon = style.Icon;
  let lead: React.ReactNode;
  let showBadge = true;
  if (type === 'pipeline-failure') {
    lead = (
      <span
        data-avatar-tile="ci"
        className="flex size-9 flex-none items-center justify-center rounded-lg bg-muted density-compact:size-8 density-comfortable:size-10"
      >
        <GitBranch aria-hidden="true" className="size-[18px] text-muted-foreground" />
      </span>
    );
  } else if (type === 'due-date-reminder') {
    showBadge = false;
    lead = (
      <span
        data-avatar-tile="due"
        className="flex size-9 flex-none items-center justify-center rounded-lg bg-amber-500/15 density-compact:size-8 density-comfortable:size-10"
      >
        <CalendarClock aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />
      </span>
    );
  } else {
    lead = (
      <CachedAvatar
        url={item.authorAvatarUrl}
        name={item.author}
        size={40}
        className="size-9 rounded-full density-compact:size-8 density-comfortable:size-10 ring-1 ring-foreground/15 [&>*]:size-full! [&_div]:text-[10px]"
      />
    );
  }
  return (
    <span
      data-event-kind={style.kind}
      className="pointer-events-none relative mt-px flex size-9 flex-none density-compact:size-8 density-comfortable:size-10"
    >
      {lead}
      {showBadge ? (
        <span
          data-event-badge={style.kind}
          className={cn(
            'absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full text-white density-compact:size-4 ring-2 ring-card group-hover/row:ring-accent group-focus-within/row:ring-accent',
            style.badge,
          )}
        >
          <Icon aria-hidden="true" className="size-[11px]" />
        </span>
      ) : null}
    </span>
  );
}
