/**
 * NotificationRow — a rounded notification card (Phase 95).
 *
 * STYLE CONTRACT (one rule per element; every card obeys it):
 *  A. Skeleton: [36px lead: avatar circle or system tile, same box + badge position]
 *     [content column]; no unread-dot slot, padding is symmetric left/right at every density. Content:
 *     line 1 (key, parent > title, time), line 2, optional list. Line 2 and list rows start
 *     at the same x as the key.
 *  B. Line 2 grammar: Actor (foreground, medium) + action phrase (action colour, medium) +
 *     optional detail = comment text (muted) or a value change. System events omit the actor.
 *  C. Value changes use ONE component (ValueChange), inline for a single change and in every
 *     list row: old (muted) -> new (foreground, medium); status = status pill; labels = chips.
 *     Person values (assignee, reporter, reviewers) = 16px avatar (initials fallback) + name,
 *     inline; the "none" chip has no avatar.
 *  D. Single change: "Cara changed priority  Minor -> Major"; several: "Cara updated 3 fields"
 *     + list. Phrase = "changed <field>" (state events / description: "merged", "edited description").
 *  E. List rows share one geometry: 12px coloured icon, gap-1.5, h-5, 11px. Comment rows: icon + text.
 *     Change rows: a grid (icon | field | old | arrow | new) so arrows align down the list; empty side = "none".
 *     Comment rows: text right after the icon. "+N more" rows align with the row text.
 *  F. Chips (status pill, label chip) share CHIP_CLASS: h-4, rounded, px-1.5, 11px medium.
 *     Status pills additionally have a 5rem min width with centred text so they line up;
 *     label chips (and "none") size to content.
 *  G. Type scale: title 12px; key, time, line 2, lists, chips 11px. Single ellipsis at the end
 *     of whatever overflows; lines are h-5 so nothing clips vertically.
 *  H. Ledger unread vs read (261111-i2o, restyled 261111-m0g): ONE colour carrier = the action phrase,
 *     painted in its event colour for EVERY event (comments, updates, status, fields too — 261111-m0g
 *     UAT reversed the "actionable only" rule: single-change rows read as uncoloured). The avatar badge is a small neutral
 *     glyph, no halo. ONE unread signal = surface: unread = solid bg-card + semibold title; read = 82%
 *     translucent card (solid on hover) + normal-weight title. Text colours are identical: read cards
 *     are never dimmed. Cards float: --sh-rest + --hair ring; hover lifts 1px (--sh-hover) and springs
 *     the avatar to 1.06; press scales .99. Read vs unread changes ONLY classes. Nothing moves.
 *  I. Merged and single cards share the skeleton; merged only adds the list.
 *  J. The hover tray is a floating pill (bg-card, hairline) in the time slot of line 1 (right-0, centred):
 *     it slides in from 6px right on hover while the time fades out. The corner X springs in from .6.
 *  K. Densities scale padding / gaps / lead size; grammar is identical.
 *  L. Key: inline right before the title, same 12px size (muted, medium, tabular), fixed 6px gap; no fixed column, never wraps.
 *
 * - Corner X (Done), hover cluster (read/unread, open in browser) and the optional quick-action pill are
 *   siblings of the overlay button. Only the hovered / focus-within card (group/row) shows its X + cluster.
 * - A StackCard is the newest card plus peek edges and "+N"; its overlay button expands the stack.
 * - One card may stand for several merged notifications (same actor, same entity, <= 60 min apart);
 *   read / done / open act on all of them.
 * - An absolute inset-0 overlay <button> is the primary target; the key and tray
 *   buttons are SIBLINGS (relative z-10), never nested inside it.
 * - Unread vs read only changes class strings / the aria prefix, never the tree (D-05).
 * - Absolute time and full body live in a 600ms tooltip; the hover tray replaces the time.
 */
import { ExternalLink, Mail, MailOpen, X } from 'lucide-react';
import { createContext, type ReactNode, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
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
  visibleCount,
} from './notification-view';
import { usePersonAvatar } from './usePersonAvatar';

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
  /** One context action (Reply / Review / View pipeline), rendered as a pill under line 2. */
  quick?: { label: string; onClick: () => void };
  /** `banner` = in-app banner: pop shadow, no hover tray, "Dismiss notification" on the X. */
  variant?: 'list' | 'banner';
  /** Set on a collapsed stack's top card: notifications hidden behind it ("+N"); the card expands, not opens. */
  stackMore?: number;
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

/** Status pills only: a shared minimum width with centred text so pills line up down a list. */
const STATUS_PILL_WIDTH_CLASS = 'min-w-[5rem] justify-center text-center';

function StatusPill({ name }: { name: string }) {
  return (
    <span
      data-chip="status"
      className={cn(
        CHIP_CLASS,
        STATUS_PILL_WIDTH_CLASS,
        statusCategoryBadgeClass(statusCategoryGuess(name)),
      )}
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

/** Change fields whose values are people (ChangeLine.field is lower-cased). */
const PERSON_FIELDS = new Set(['assignee', 'reporter', 'review', 'reviewer', 'reviewers']);

/**
 * Avatars for the people named in a card: merged from every item's personAvatars. `lists`:
 * values are comma-joined names (GitLab usernames); Jira values are ONE display name that may
 * itself contain a comma ("Smith, John"), so they are never split.
 */
const PersonAvatarsContext = createContext<{
  avatars: Record<string, string>;
  lists: boolean;
  source: 'jira' | 'gitlab';
  issueKey: string | null;
}>({
  avatars: {},
  lists: false,
  source: 'jira',
  issueKey: null,
});

/** One person's 16px avatar: captured URL first, else a cached render-time lookup (initials on miss). */
function PersonAvatar({ name }: { name: string }) {
  const { avatars, source, issueKey } = useContext(PersonAvatarsContext);
  const url = usePersonAvatar(name, source, issueKey, avatars[name]);
  return (
    <span aria-hidden="true" className="mr-1 inline-block align-middle">
      <CachedAvatar url={url} name={name} size={16} />
    </span>
  );
}

/**
 * Person value: 16px avatar (real image when captured, else initials) + name, per name.
 * Inline-level only (inline-block avatar + inline text) so line 2 keeps a single ellipsis and
 * the 16px avatar fits the h-5 row.
 */
function PersonValue({ value, className }: { value: string; className?: string }) {
  const { lists } = useContext(PersonAvatarsContext);
  const names = lists
    ? value
        .split(/,\s*/)
        .map((n) => n.trim())
        .filter(Boolean)
    : [value];
  return (
    <>
      {names.map((name, i) => (
        <span key={name}>
          {i > 0 ? ', ' : null}
          <span data-person className={className}>
            <PersonAvatar name={name} />
            {name}
          </span>
        </span>
      ))}
    </>
  );
}

/** Text-only changes (labels diff, "edited", review list) — no old/new pair. */
function TextValue({ change }: { change: ChangeLine }) {
  if (change.field === 'labels') return <LabelChips text={change.text ?? ''} />;
  const text = change.text ?? '';
  if (PERSON_FIELDS.has(change.field) && text && text !== 'removed' && text !== 'edited') {
    // GitLab "−alice" (unassigned / review removed); single-change mode passes it sign-stripped.
    const signed = text.startsWith('\u2212');
    const rest = signed ? text.slice(1) : text;
    return (
      <span className="font-medium text-foreground">
        {signed ? '\u2212' : null}
        <PersonValue value={rest} />
      </span>
    );
  }
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
  if (PERSON_FIELDS.has(change.field)) {
    return <PersonValue value={change.from} className="text-muted-foreground" />;
  }
  return change.field === 'status' ? (
    <StatusPill name={change.from} />
  ) : (
    <span className="text-muted-foreground">{change.from}</span>
  );
}

/** New value cell (foreground medium; status as pill; "none" when cleared). */
function ToValue({ change }: { change: ChangeLine }) {
  if (!change.to) return NONE;
  if (PERSON_FIELDS.has(change.field)) {
    return <PersonValue value={change.to} className="font-medium text-foreground" />;
  }
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
            {single.text && parts.singleMode ? (
              <TextValue change={single} />
            ) : parts.singleMode === 'added' ? (
              <ToValue change={single} />
            ) : parts.singleMode === 'removed' ? (
              <span
                data-value-removed
                className="text-muted-foreground line-through decoration-muted-foreground/60"
              >
                <FromValue change={single} />
              </span>
            ) : (
              <ValueChange change={single} />
            )}
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
  const shown = changes.slice(0, visibleCount(changes.length));
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
            <Icon aria-hidden="true" className="size-3 flex-none text-muted-foreground" />
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
  const shown = comments.slice(0, visibleCount(comments.length));
  const hidden = comments.length - shown.length;
  return (
    <ul data-comment-list className={LIST_CLASS}>
      {shown.map((c) => {
        const style = c.mention ? MENTION_STYLE : EVENT_STYLE['jira-comment'];
        return (
          <ListRow
            key={c.id}
            rowAttr="data-comment-row"
            Icon={style.Icon}
            iconClass="text-muted-foreground"
          >
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
  quick,
  stackMore,
  variant = 'list',
}: NotificationRowProps) {
  const isBanner = variant === 'banner';
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
  const stackAria = stackMore
    ? ` (${stackMore} more notification${stackMore === 1 ? '' : 's'}, expand)`
    : '';
  const ariaLabel = `${isUnread ? 'Unread. ' : ''}${describeEventAria(parts)} on ${ref ? `${ref} ` : ''}${title}${parentLabel ? ` (in ${parentLabel})` : ''}${ariaText ? `: ${ariaText}` : ''}${stackAria}`;
  const listChanges = parts.changes && parts.changes.length >= 2 ? parts.changes : null;
  // Merged cards mix changes from several items: look avatars up across all of them.
  const personAvatars = {
    avatars: Object.assign({}, ...all.map((i) => i.personAvatars ?? {})) as Record<string, string>,
    lists: item.source === 'gitlab',
    source: item.source,
    issueKey: getJiraKey(item),
  };

  return (
    <div
      data-card
      data-unread-card={isUnread ? 'true' : 'false'}
      className={cn(
        'group/row relative flex cursor-pointer items-start gap-3 rounded-[14px] px-3.5 py-3 text-xs transition-[translate,scale,transform,opacity,box-shadow,background-color] duration-200 ease-(--ease-out) hover:-translate-y-px active:scale-[.99] active:duration-75 density-compact:gap-2.5 density-compact:px-3 density-compact:py-2 density-comfortable:gap-3.5 density-comfortable:px-4 density-comfortable:py-3.5',
        // A banner floats over page content, so its fill stays opaque: no read-state translucency
        // and no peek tint (bg-primary/10 would replace bg-card and let the page bleed through).
        isBanner
          ? 'bg-card shadow-(--notif-sh-pop) hover:shadow-(--notif-sh-pop)'
          : cn(
              'shadow-(--notif-sh-rest) hover:shadow-(--notif-sh-hover)',
              isUnread
                ? 'bg-card'
                : 'bg-[color-mix(in_oklch,var(--color-card)_82%,transparent)] hover:bg-card focus-within:bg-card',
              peeked && PEEKED_ROW_CLASS,
            ),
      )}
      data-peeked={peeked ? 'true' : undefined}
    >
      <button
        type="button"
        data-entry-primary
        aria-label={ariaLabel}
        aria-expanded={stackMore ? false : undefined}
        onClick={onOpen}
        className="absolute inset-0 cursor-pointer rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <button
        type="button"
        aria-label={
          isBanner
            ? 'Dismiss notification'
            : stackMore
              ? `Clear ${stackMore + 1} notifications`
              : 'Clear notification'
        }
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
        data-corner-x
        className="pointer-events-none absolute -top-[7px] -left-[7px] z-20 flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-full bg-card text-muted-foreground opacity-0 shadow-(--notif-sh-hover) transition-opacity duration-150 ease-out hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100"
      >
        <X aria-hidden="true" className="size-3" />
      </button>

      <NotificationAvatar item={item} style={style} />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {/* pointer-events-none: this positioned line sits above the full-card overlay button;
            without it, clicks on its gaps (around key / title / time) did nothing. */}
        <div className="pointer-events-none relative flex h-5 items-center gap-1.5">
          {ref ? (
            <span
              data-entity-key
              className="pointer-events-none relative flex-none whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground @max-[22rem]:hidden"
            >
              {ref}
            </span>
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
                isUnread ? 'font-semibold text-foreground' : 'font-normal text-foreground',
              )}
            >
              {title}
            </span>
          </span>
          {/* No visible "+N" on stacks: the peek edges show it is a group (261111-m0g UAT); the
              count stays in the overlay's aria-label and the Clear label. */}
          <time
            dateTime={item.createdAt}
            className="pointer-events-none relative min-w-9 flex-none whitespace-nowrap text-right text-[11px] tabular-nums text-muted-foreground group-hover/row:opacity-0 group-focus-within/row:opacity-0"
          >
            {relTime(item.createdAt, now)}
          </time>
          <span
            data-tray
            className={cn(
              // Clickable only while shown: an invisible tray must not swallow clicks on the card.
              'pointer-events-none absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-lg bg-card p-0.5 opacity-0 shadow-(--notif-hair) transition-opacity duration-150 ease-out group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100',
              isBanner && 'hidden',
            )}
          >
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
          </span>
        </div>
        <PersonAvatarsContext.Provider value={personAvatars}>
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
        </PersonAvatarsContext.Provider>
        {quick ? (
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              data-quick-action
              onClick={(e) => {
                e.stopPropagation();
                quick.onClick();
              }}
              className="relative z-10 h-5 cursor-pointer rounded-full px-2 text-[11px] font-medium text-foreground ring-1 ring-foreground/15 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {quick.label}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── stacks ─────────────────────────────────────────── */

/** Collapsed stack: the newest card with two peek edges behind it; they spread 3px / 6px on hover. */
/**
 * Collapsed group: the top card with peek edges behind it, one edge per hidden card, max 2
 * (261111-m0g UAT: one hidden card must show one edge, not two). The row keeps its pb-3 either
 * way so its height (and the open/close swap) does not depend on the count.
 */
export function StackCard({ children, hidden = 2 }: { children: ReactNode; hidden?: number }) {
  const edges = Math.max(1, Math.min(hidden, 2));
  return (
    <div data-stack className="group/stack relative pb-3">
      {edges >= 2 ? (
        <div
          aria-hidden="true"
          data-stack-edge="2"
          className="pointer-events-none absolute inset-x-5 bottom-0 h-5 rounded-b-xl bg-card opacity-60 shadow-(--notif-sh-rest)"
        />
      ) : null}
      <div
        aria-hidden="true"
        data-stack-edge="1"
        className="pointer-events-none absolute inset-x-2.5 bottom-1.5 h-5 rounded-b-xl bg-card opacity-85 shadow-(--notif-sh-rest)"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Header of an expanded stack: entity ref + title, "Show less" and "Clear". */
export function StackHeader({
  entityRef,
  title,
  onCollapse,
  onClear,
}: {
  entityRef: string;
  title: string;
  onCollapse: () => void;
  onClear: () => void;
}) {
  return (
    <div data-stack-header className="flex h-7 items-center justify-between gap-2 px-1">
      <p className="min-w-0 truncate text-xs font-semibold text-foreground">
        {entityRef ? (
          <span className="mr-1 font-medium tabular-nums text-muted-foreground">{entityRef}</span>
        ) : null}
        {title}
      </p>
      <div className="flex flex-none items-center gap-1">
        <Button variant="ghost" size="xs" onClick={onCollapse}>
          Show less
        </Button>
        <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={onClear}>
          <X aria-hidden="true" />
          Clear
        </Button>
      </div>
    </div>
  );
}
