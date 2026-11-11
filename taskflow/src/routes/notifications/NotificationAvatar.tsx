/**
 * Actor avatar with a small neutral action badge on its bottom-right corner.
 * System events (pipeline failure, due reminder) get a neutral tile instead.
 * Fixed pixel sizing (CachedAvatar / explicit size classes) so WebKit never
 * collapses the slot to 0 width.
 */
import { CalendarClock, GitBranch, User } from 'lucide-react';
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
        className="flex size-8 flex-none items-center justify-center rounded-lg bg-muted density-compact:size-7 density-comfortable:size-9"
      >
        <GitBranch aria-hidden="true" className="size-[18px] text-muted-foreground" />
      </span>
    );
  } else if (type === 'due-date-reminder') {
    showBadge = false;
    lead = (
      <span
        data-avatar-tile="due"
        className="flex size-8 flex-none items-center justify-center rounded-lg bg-amber-500/15 density-compact:size-7 density-comfortable:size-9"
      >
        <CalendarClock aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />
      </span>
    );
  } else if (!item.author?.trim() && !item.authorAvatarUrl) {
    lead = (
      <span
        data-avatar-tile="anon"
        className="flex size-8 flex-none items-center justify-center rounded-full bg-muted ring-1 ring-foreground/15 dark:bg-foreground/20 density-compact:size-7 density-comfortable:size-9"
      >
        <User aria-hidden="true" className="size-4 text-muted-foreground" />
      </span>
    );
  } else {
    lead = (
      <CachedAvatar
        url={item.authorAvatarUrl}
        name={item.author}
        size={32}
        className="size-8 rounded-full density-compact:size-7 density-comfortable:size-9 ring-1 ring-foreground/15 [&>*]:size-full! [&_div]:text-[10px] dark:[&>div]:bg-foreground/20!"
      />
    );
  }
  return (
    <span
      data-event-kind={style.kind}
      className={cn(
        'pointer-events-none relative mt-px flex size-8 flex-none transition-transform duration-[250ms] ease-(--spring) group-hover/row:scale-[1.06] density-compact:size-7 density-comfortable:size-9',
      )}
    >
      {lead}
      {showBadge ? (
        <span
          data-event-badge={style.kind}
          className={cn(
            'absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground density-compact:size-[14px] ring-2 ring-card',
          )}
        >
          <Icon aria-hidden="true" className="size-[11px]" />
        </span>
      ) : null}
    </span>
  );
}
