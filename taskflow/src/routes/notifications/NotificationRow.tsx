/**
 * NotificationRow — a rounded notification card (Phase 95).
 *
 * STYLE CONTRACT (one rule per element; every card obeys it):
 *  A. Skeleton: [unread-dot slot, inside the card padding, centred on line 1] [36px lead:
 *     avatar circle or system tile, same box + badge position] [content column]. Content:
 *     line 1 (key, parent > title, time), line 2, optional list. Line 2 and list rows start
 *     at the same x as the key.
 *  B. Line 2 grammar: Actor (foreground, medium) + action phrase (action colour, medium) +
 *     optional detail = comment text (muted) or a value change. System events omit the actor.
 *  C. Value changes use ONE component (ValueChange), inline for a single change and in every
 *     list row: old (muted) -> new (foreground, medium); status = status pill; labels = chips.
 *  D. Single change: "Cara changed priority  Minor -> Major"; several: "Cara updated 3 fields"
 *     + list. Phrase = "changed <field>" (state events / description: "merged", "edited description").
 *  E. List rows share one geometry: 12px coloured icon, gap-1.5, h-5, 11px. Comment rows: icon + text.
 *     Change rows: a grid (icon | field | old | arrow | new) so arrows align down the list; empty side = "none".
 *     Comment rows: text right after the icon. "+N more" rows align with the row text.
 *  F. Chips (status pill, label chip) share CHIP_CLASS: h-4, rounded, px-1.5, 11px medium.
 *  G. Type scale: title 12px; key, time, line 2, lists, chips 11px. Single ellipsis at the end
 *     of whatever overflows; lines are h-5 so nothing clips vertically.
 *  H. Read vs unread changes ONLY: title weight/colour, card tint + border, dot visibility.
 *  I. Merged and single cards share the skeleton; merged only adds the list.
 *  J. The hover tray sits in the time slot of line 1 (right-0, centred) in every card.
 *  K. Densities scale padding / gaps / lead size; grammar is identical.
 *  L. Key column: min-w 5rem (fits PROJ-1234 / !1234); longer keys extend, never wrap.
 *
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
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import { useIsPeeked } from '@/stores/peek.store';
import type { NotificationItem } from '../../stores/notifications.store';
import NotificationAvatar from './NotificationAvatar';
import {
  ACTION_STYLE,
  EVENT_STYLE,
  type EventStyle,
  MENTION_STYLE,
  UPDATE_STYLE,
} from './notification-colours';
import {
  type ChangeLine,
  type CommentLine,
  describeEntryParts,
  describeEventAria,
  describeEventAriaText,
  type EventParts,
  eventStyleFor,
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

/* ── chips, value changes, list rows ────────────────── */

/** ONE chip geometry for every pill / tag (status, label); only colour differs. */
export const CHIP_CLASS =
  'inline-flex h-4 items-center whitespace-nowrap rounded px-1.5 align-middle text-[11px] font-medium leading-none';

function StatusPill({ name }: { name: string }) {
  return (
    <span
      data-chip="status"
      className={cn(CHIP_CLASS, statusCategoryBadgeClass(statusCategoryGuess(name)))}
    >
      {name}
    </span>
  );
}

function LabelChips({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((tok, i) => (
        <span key={tok}>
          {i > 0 ? ' ' : null}
          <span data-chip="label" className={cn(CHIP_CLASS, 'bg-foreground/10 text-foreground')}>
            {tok}
          </span>
        </span>
      ))}
    </>
  );
}

const ARROW = (
  <span aria-hidden="true" className="text-muted-foreground">
    {'\u2192'}
  </span>
);

/**
 * THE value-change renderer: old (muted) -> new (foreground, medium). Used inline on line 2
 * (single change) and in every change-list row. Inline-level only, so one ellipsis ends the line.
 */
/** Text-only changes (labels diff, "edited", review list) — no old/new pair. */
function TextValue({ change }: { change: ChangeLine }) {
  if (change.field === 'labels') return <LabelChips text={change.text ?? ''} />;
  return change.text === 'edited' ? (
    <span className="text-muted-foreground">{change.text}</span>
  ) : (
    <span className="font-medium text-foreground">{change.text}</span>
  );
}

/** Empty side of a change: "none", muted, so "none → 1.14.0" / "Ben → none" both read explicitly. */
const NONE = (
  <span
    data-value-none
    className={cn(
      CHIP_CLASS,
      'border border-dashed border-muted-foreground/40 bg-transparent font-normal text-muted-foreground/70',
    )}
  >
    none
  </span>
);

/** Old value cell (muted; status as pill; "none" when there was no value). */
function FromValue({ change }: { change: ChangeLine }) {
  // Review requests have no "old" side (it's a request to people, not a field value).
  if (!change.from) return change.action === 'review' ? null : NONE;
  return change.field === 'status' ? (
    <StatusPill name={change.from} />
  ) : (
    <span className="text-muted-foreground">{change.from}</span>
  );
}

/** New value cell (foreground medium; status as pill; "none" when cleared). */
function ToValue({ change }: { change: ChangeLine }) {
  if (!change.to) return NONE;
  return change.field === 'status' ? (
    <StatusPill name={change.to} />
  ) : (
    <span className="font-medium text-foreground">{change.to}</span>
  );
}

/**
 * THE value-change renderer for line 2: old (muted) -> new (foreground, medium). The change list
 * renders the same FromValue / ARROW / ToValue cells in grid columns so arrows align.
 */
export function ValueChange({ change }: { change: ChangeLine }) {
  if (change.text) return <TextValue change={change} />;
  if (!change.from && !change.to) return null;
  return (
    <span data-value-change>
      {change.from || change.action !== 'review' ? (
        <>
          <FromValue change={change} />{' '}
        </>
      ) : null}
      {ARROW} <ToValue change={change} />
    </span>
  );
}

/** Whether a change has something to show after its phrase ("merged", "edited description" do not). */
function hasValue(c: ChangeLine): boolean {
  return c.text !== 'edited' && Boolean(c.text || c.from || c.to);
}

/** Line 2: Actor + coloured action phrase + optional detail; one truncating block, one ellipsis. */
export function NotificationDetailLine({
  parts,
  colour,
  actor,
}: {
  parts: EventParts;
  colour: string;
  /** Who did it (full display name); omitted for system events (pipeline, due). */
  actor?: string;
}) {
  const single = parts.changes && parts.changes.length === 1 ? parts.changes[0] : null;
  const kind = single ? 'changes' : parts.commentText ? 'comment' : parts.detail ? 'text' : 'verb';
  const text = parts.commentText || parts.detail;
  const verb = actor ? parts.verb : parts.verb.charAt(0).toUpperCase() + parts.verb.slice(1);
  return (
    <span
      data-line="detail"
      data-detail={kind}
      className="pointer-events-none relative block h-5 truncate text-[11px] leading-5"
    >
      {actor ? (
        <span data-actor className="mr-1 font-medium text-foreground">
          {actor}{' '}
        </span>
      ) : null}
      <span className={cn('font-medium', colour)}>{verb}</span>
      {single && hasValue(single) ? (
        <>
          {' '}
          <span data-detail-gap className="ml-1">
            <ValueChange change={single} />
          </span>
        </>
      ) : !single && text && !parts.comments ? (
        <>
          {' '}
          <span data-detail-gap className="ml-1 text-muted-foreground">
            {text}
          </span>
        </>
      ) : null}
    </span>
  );
}

export const MAX_LISTED_CHANGES = 3;

/** ONE list-row geometry for change AND comment lists: 12px icon, optional field column, value. */
function ListRow({
  rowAttr,
  Icon,
  iconClass,
  children,
}: {
  rowAttr: string;
  Icon: EventStyle['Icon'];
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <li
      {...{ [rowAttr]: true }}
      data-list-row
      className="flex h-5 items-center gap-1.5 text-[11px] leading-5"
    >
      <Icon aria-hidden="true" className={cn('size-3 flex-none', iconClass)} />
      <span data-list-value className="min-w-0 flex-1 truncate">
        {children}
      </span>
    </li>
  );
}

function MoreRow({ attr, text }: { attr: string; text: string }) {
  return (
    <li
      {...{ [attr]: true }}
      data-list-more
      className="h-5 pl-[1.125rem] text-[11px] leading-5 text-muted-foreground"
    >
      {text}
    </li>
  );
}

const LIST_CLASS = 'pointer-events-none relative mt-1 flex flex-col gap-1';

/**
 * Compact change list for multi-field updates. A 5-column grid — icon | field | old | arrow | new —
 * so every row's field, old value, arrow and new value line up. Text-only changes (labels diff,
 * "edited") span old..new. Same 12px icon / h-5 / 11px geometry as ListRow.
 */
export function NotificationChangeList({ changes }: { changes: ChangeLine[] }) {
  const shown = changes.slice(0, MAX_LISTED_CHANGES);
  const hidden = changes.length - shown.length;
  return (
    <ul
      data-change-list
      className="pointer-events-none relative mt-1 grid grid-cols-[auto_auto_auto_auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1 text-[11px] leading-5"
    >
      {shown.map((c) => {
        const style = c.action ? ACTION_STYLE[c.action] : UPDATE_STYLE;
        const Icon = style.Icon;
        const textOnly = Boolean(c.text) || (!c.from && !c.to);
        return (
          <li
            key={`${c.field}|${c.action ?? ''}|${c.text ?? c.to ?? ''}`}
            data-change-row
            data-list-row
            className="contents"
          >
            <Icon aria-hidden="true" className={cn('size-3 flex-none', style.text)} />
            <span data-list-field className="h-5 max-w-[5.5rem] truncate text-muted-foreground">
              {c.field}
            </span>
            {textOnly ? (
              <span data-list-value className="col-span-3 h-5 min-w-0 truncate">
                {c.text ? <TextValue change={c} /> : null}
              </span>
            ) : (
              <>
                <span data-list-from className="h-5 max-w-[9rem] min-w-0 truncate">
                  <FromValue change={c} />
                </span>
                <span data-list-arrow className="h-5">
                  {ARROW}
                </span>
                <span data-list-value className="h-5 min-w-0 truncate">
                  <ToValue change={c} />
                </span>
              </>
            )}
          </li>
        );
      })}
      {hidden > 0 ? (
        <li
          data-change-more
          data-list-more
          className="col-span-full h-5 pl-[1.125rem] text-muted-foreground"
        >
          +{hidden} more change{hidden === 1 ? '' : 's'}
        </li>
      ) : null}
    </ul>
  );
}

/** Merged conversation: one row per comment (icon, text), newest first; max 3 + "+N more". */
export function NotificationCommentList({ comments }: { comments: CommentLine[] }) {
  const shown = comments.slice(0, MAX_LISTED_CHANGES);
  const hidden = comments.length - shown.length;
  return (
    <ul data-comment-list className={LIST_CLASS}>
      {shown.map((c) => {
        const style = c.mention ? MENTION_STYLE : EVENT_STYLE['jira-comment'];
        return (
          <ListRow key={c.id} rowAttr="data-comment-row" Icon={style.Icon} iconClass={style.text}>
            <span className="text-muted-foreground">{c.text}</span>
          </ListRow>
        );
      })}
      {hidden > 0 ? (
        <MoreRow
          attr="data-comment-more"
          text={`+${hidden} more comment${hidden === 1 ? '' : 's'}`}
        />
      ) : null}
    </ul>
  );
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
  const parentLabel = item.parentKey
    ? `${item.parentKey}${item.parentSummary ? ` ${item.parentSummary}` : ''}`
    : '';
  const ariaText = describeEventAriaText(parts);
  const ariaLabel = `${isUnread ? 'Unread. ' : ''}${describeEventAria(parts)} on ${ref ? `${ref} ` : ''}${title}${parentLabel ? ` (in ${parentLabel})` : ''}${ariaText ? `: ${ariaText}` : ''}`;
  const listChanges = parts.changes && parts.changes.length >= 2 ? parts.changes : null;

  return (
    <div
      data-card
      data-unread-card={isUnread ? 'true' : 'false'}
      className={cn(
        'group/row relative flex items-start gap-3 rounded-xl border py-2.5 pr-3 pl-4 text-xs transition-colors density-compact:gap-2.5 density-compact:py-1.5 density-compact:pr-2.5 density-compact:pl-3.5 density-comfortable:gap-3.5 density-comfortable:py-3.5 density-comfortable:pr-3.5 density-comfortable:pl-5 hover:bg-accent hover:shadow-sm focus-within:bg-accent',
        isUnread
          ? 'border-border bg-primary/[0.03] dark:bg-primary/[0.07]'
          : 'border-border/60 bg-card',
        peeked && PEEKED_ROW_CLASS,
      )}
      data-peeked={peeked ? 'true' : undefined}
    >
      <button
        type="button"
        data-entry-primary
        aria-label={ariaLabel}
        onClick={onOpen}
        className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <span
        data-unread={isUnread ? 'true' : 'false'}
        className={cn(
          'pointer-events-none absolute top-[17px] left-1.5 size-1.5 rounded-full bg-primary density-compact:top-[13px] density-compact:left-1 density-comfortable:top-[21px] density-comfortable:left-2',
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
              className="relative z-10 min-w-[5rem] flex-none cursor-pointer pr-1 whitespace-nowrap text-left font-mono text-[11px] text-muted-foreground hover:underline @max-[22rem]:hidden"
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
          <time
            dateTime={item.createdAt}
            className="pointer-events-none relative w-9 flex-none text-right text-[11px] tabular-nums text-muted-foreground group-hover/row:opacity-0 group-focus-within/row:opacity-0"
          >
            {relTime(item.createdAt, now)}
          </time>
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
