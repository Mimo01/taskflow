/**
 * NotificationGroupHeader — one-line entity group header (Phase 95 D-06, D-09).
 *
 * [dot][chevron][KEY][title][+N chip][state pill][time] with a hover/focus
 * tray for group-wide Mark read/unread and Done. Same overlay-button pattern as
 * NotificationRow: the primary button is absolute inset-0, everything interactive
 * else is a relative z-10 sibling.
 */
import { Check, ChevronRight, Mail, MailOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { useIsPeeked } from '@/stores/peek.store';
import { NotificationTrayButton } from './NotificationRow';
import {
  formatAbsoluteTime,
  type GroupEntry,
  getEntityRef,
  getEntityTitle,
  getJiraKey,
  relTime,
} from './notification-view';

interface NotificationGroupHeaderProps {
  group: GroupEntry;
  now: number;
  onOpen: () => void;
  onToggleExpanded: () => void;
  onToggleRead: () => void;
  onDone: () => void;
}

const STATE_PILL: Record<string, { cat: string; label: string }> = {
  opened: { cat: 'indeterminate', label: 'Open' },
  merged: { cat: 'done', label: 'Merged' },
  closed: { cat: 'new', label: 'Closed' },
};

export default function NotificationGroupHeader({
  group,
  now,
  onOpen,
  onToggleExpanded,
  onToggleRead,
  onDone,
}: NotificationGroupHeaderProps) {
  const { newest, items, unreadCount, expanded } = group;
  const ref = getEntityRef(newest);
  const title = getEntityTitle(newest);
  const unread = unreadCount > 0;
  const more = items.length - 1;
  const peeked = useIsPeeked(getJiraKey(newest) ?? '');
  const pill = newest.entityState ? STATE_PILL[newest.entityState] : undefined;
  const refLabel = ref ?? title;
  const ariaLabel = `${unread ? 'Unread. ' : ''}${ref ? `${ref} ` : ''}${title}, ${items.length} updates`;

  return (
    <div
      className={cn(
        'group relative flex h-8 items-center gap-1 px-2 text-xs density-compact:h-7 density-comfortable:h-9 hover:bg-accent focus-within:bg-accent',
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
          <TooltipBody title={newest.entityTitle} note={formatAbsoluteTime(newest.createdAt)}>
            {newest.parentKey ? (
              <div className="truncate text-muted-foreground">
                Parent: {newest.parentKey} {newest.parentSummary}
              </div>
            ) : null}
            <div>{items.length} updates</div>
          </TooltipBody>
        </TooltipContent>
      </Tooltip>

      <span className="pointer-events-none relative flex w-2 flex-none justify-center">
        <span
          data-unread={unread ? 'true' : 'false'}
          className={cn('size-1.5 rounded-full bg-primary', !unread && 'opacity-0')}
        />
      </span>

      <button
        type="button"
        tabIndex={-1}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${refLabel}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpanded();
        }}
        className="relative z-10 flex size-4 flex-none cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn('size-3.5', expanded && 'rotate-90')} />
      </button>

      {ref ? (
        <span className="pointer-events-none relative min-w-[3.75rem] flex-none text-left font-mono text-[11px] text-muted-foreground @max-[22rem]:hidden">
          {ref}
        </span>
      ) : null}

      <span
        className={cn(
          'pointer-events-none relative min-w-0 flex-1 truncate',
          unread ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
        )}
      >
        {title}
      </span>

      {more > 0 ? (
        <span
          title={`${more} more updates`}
          className="pointer-events-none relative flex-none rounded bg-muted px-1 text-[11px] text-muted-foreground"
        >
          +{more}
        </span>
      ) : null}

      {pill ? (
        <div className="pointer-events-none relative flex flex-none">
          <span
            className={cn(
              'whitespace-nowrap rounded px-1 text-[11px]',
              statusCategoryBadgeClass(pill.cat),
            )}
          >
            {pill.label}
          </span>
        </div>
      ) : null}

      <span className="pointer-events-none relative w-12 flex-none text-right text-[11px] tabular-nums text-muted-foreground group-hover:opacity-0 group-focus-within:opacity-0">
        {relTime(newest.createdAt, now)}
      </span>

      <span className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 bg-accent pl-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
        <NotificationTrayButton
          label={unread ? 'Mark group read' : 'Mark group unread'}
          shortcut="U"
          onClick={onToggleRead}
        >
          {unread ? <MailOpen className="size-3.5" /> : <Mail className="size-3.5" />}
        </NotificationTrayButton>
        <NotificationTrayButton label="Done" shortcut="E" onClick={onDone}>
          <Check className="size-3.5" />
        </NotificationTrayButton>
      </span>
    </div>
  );
}
