/**
 * Single source of truth for notification event colours + glyphs.
 * Meaning is never colour-only: every style carries a glyph, and the row
 * aria-label spells the event out.
 */
import {
  AtSign,
  Bell,
  CalendarClock,
  Check,
  MessageSquare,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { NotificationType } from '../../stores/notifications.store';

export interface EventStyle {
  /** Stable kind id (used by tests / data attributes). */
  kind: 'mention' | 'comment' | 'assignment' | 'approval' | 'failure' | 'due' | 'status' | 'update';
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  /** Solid badge background (white glyph on top). */
  badge: string;
  /** Verb text colour, light + dark. */
  text: string;
}

const MENTION: EventStyle = {
  kind: 'mention',
  Icon: AtSign,
  badge: 'bg-violet-600',
  text: 'text-violet-600 dark:text-violet-400',
};
const COMMENT: EventStyle = {
  kind: 'comment',
  Icon: MessageSquare,
  badge: 'bg-blue-600',
  text: 'text-blue-600 dark:text-blue-400',
};

export const UPDATE_STYLE: EventStyle = {
  kind: 'update',
  Icon: Bell,
  badge: 'bg-slate-500',
  text: 'text-slate-600 dark:text-slate-400',
};

export const EVENT_STYLE: Record<NotificationType, EventStyle> = {
  'comment-mention': MENTION,
  'gitlab-mention': MENTION,
  'jira-comment': COMMENT,
  'mr-note': COMMENT,
  'issue-assignment': {
    kind: 'assignment',
    Icon: UserPlus,
    badge: 'bg-teal-600',
    text: 'text-teal-600 dark:text-teal-400',
  },
  'mr-approval': {
    kind: 'approval',
    Icon: Check,
    badge: 'bg-emerald-600',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  'pipeline-failure': {
    kind: 'failure',
    Icon: X,
    badge: 'bg-red-600',
    text: 'text-red-600 dark:text-red-400',
  },
  'due-date-reminder': {
    kind: 'due',
    Icon: CalendarClock,
    badge: 'bg-amber-600',
    text: 'text-amber-600 dark:text-amber-400',
  },
  // Plain issue updates are generic; a status change upgrades to STATUS_STYLE.
  'issue-update': UPDATE_STYLE,
};

export const STATUS_STYLE: EventStyle = {
  kind: 'status',
  Icon: RefreshCw,
  badge: 'bg-amber-600',
  text: 'text-amber-600 dark:text-amber-400',
};
