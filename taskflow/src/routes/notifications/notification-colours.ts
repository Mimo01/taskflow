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
  CircleCheck,
  CircleDot,
  Clock,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  IterationCw,
  MessageSquare,
  Milestone,
  Puzzle,
  Shapes,
  Signal,
  SquarePen,
  Tag,
  Type,
  UserMinus,
  UserPen,
  UserPlus,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { NotificationType } from '../../stores/notifications.store';

export type ActionKey =
  | 'status'
  | 'priority'
  | 'sprint'
  | 'assignee'
  | 'unassigned'
  | 'reporter'
  | 'description'
  | 'title'
  | 'labels'
  | 'version'
  | 'milestone'
  | 'component'
  | 'estimate'
  | 'duedate'
  | 'resolution'
  | 'issuetype'
  | 'review'
  | 'unreview'
  | 'branch'
  | 'merged'
  | 'closed'
  | 'reopened'
  | 'draft'
  | 'automerge';

export type EventKind =
  | 'mention'
  | 'comment'
  | 'assignment'
  | 'approval'
  | 'failure'
  | 'due'
  | 'update'
  | 'multi'
  | ActionKey;

export interface EventStyle {
  /** Stable kind id (used by tests / data attributes). */
  kind: EventKind;
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

/** Generic "updated N fields" style for issue updates / system notes with several changes. */
export const MULTI_UPDATE_STYLE: EventStyle = {
  kind: 'multi',
  Icon: SquarePen,
  badge: 'bg-indigo-600',
  text: 'text-indigo-600 dark:text-indigo-400',
};

export const MENTION_STYLE = MENTION;

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
  Icon: CircleDot,
  badge: 'bg-amber-600',
  text: 'text-amber-600 dark:text-amber-400',
};

type Family =
  | 'amber'
  | 'orange'
  | 'indigo'
  | 'teal'
  | 'slate'
  | 'pink'
  | 'cyan'
  | 'green'
  | 'violet'
  | 'purple'
  | 'red'
  | 'emerald';

// Static class strings (Tailwind cannot see interpolated names).
const FAMILY: Record<Family, { badge: string; text: string }> = {
  amber: {
    badge: 'bg-amber-600',
    text: 'text-amber-600 dark:text-amber-400',
  },
  orange: {
    badge: 'bg-orange-600',
    text: 'text-orange-600 dark:text-orange-400',
  },
  indigo: {
    badge: 'bg-indigo-600',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  teal: {
    badge: 'bg-teal-600',
    text: 'text-teal-600 dark:text-teal-400',
  },
  slate: {
    badge: 'bg-slate-500',
    text: 'text-slate-600 dark:text-slate-400',
  },
  pink: {
    badge: 'bg-pink-600',
    text: 'text-pink-600 dark:text-pink-400',
  },
  cyan: {
    badge: 'bg-cyan-600',
    text: 'text-cyan-700 dark:text-cyan-400',
  },
  green: {
    badge: 'bg-green-600',
    text: 'text-green-600 dark:text-green-400',
  },
  violet: {
    badge: 'bg-violet-600',
    text: 'text-violet-600 dark:text-violet-400',
  },
  purple: {
    badge: 'bg-purple-600',
    text: 'text-purple-600 dark:text-purple-400',
  },
  red: {
    badge: 'bg-red-600',
    text: 'text-red-600 dark:text-red-400',
  },
  emerald: {
    badge: 'bg-emerald-600',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
};

function action(kind: ActionKey, Icon: EventStyle['Icon'], family: Family): EventStyle {
  return { kind, Icon, ...FAMILY[family] };
}

/** One glyph + colour family per tracked change / MR system event. */
export const ACTION_STYLE: Record<ActionKey, EventStyle> = {
  status: STATUS_STYLE,
  priority: action('priority', Signal, 'orange'),
  sprint: action('sprint', IterationCw, 'indigo'),
  assignee: action('assignee', UserPlus, 'teal'),
  unassigned: action('unassigned', UserMinus, 'teal'),
  reporter: action('reporter', UserPen, 'slate'),
  description: action('description', FileText, 'slate'),
  title: action('title', Type, 'slate'),
  labels: action('labels', Tag, 'pink'),
  version: action('version', Milestone, 'cyan'),
  milestone: action('milestone', Milestone, 'cyan'),
  component: action('component', Puzzle, 'slate'),
  estimate: action('estimate', Clock, 'slate'),
  duedate: action('duedate', CalendarClock, 'amber'),
  resolution: action('resolution', CircleCheck, 'green'),
  issuetype: action('issuetype', Shapes, 'slate'),
  review: action('review', Eye, 'violet'),
  unreview: action('unreview', EyeOff, 'violet'),
  branch: action('branch', GitBranch, 'slate'),
  merged: action('merged', GitMerge, 'purple'),
  closed: action('closed', GitPullRequestClosed, 'red'),
  reopened: action('reopened', GitPullRequest, 'green'),
  draft: action('draft', GitPullRequestDraft, 'slate'),
  automerge: action('automerge', GitMerge, 'slate'),
};

/** Map a lower-cased change field label to its action key (undefined = no dedicated style). */
export function actionKeyForField(field: string): ActionKey | undefined {
  switch (field) {
    case 'status':
      return 'status';
    case 'priority':
      return 'priority';
    case 'sprint':
      return 'sprint';
    case 'assignee':
      return 'assignee';
    case 'reporter':
      return 'reporter';
    case 'description':
      return 'description';
    case 'title':
      return 'title';
    case 'labels':
      return 'labels';
    case 'fix version':
    case 'fix version/s':
      return 'version';
    case 'milestone':
      return 'milestone';
    case 'component':
      return 'component';
    case 'story points':
    case 'estimate':
      return 'estimate';
    case 'due date':
      return 'duedate';
    case 'resolution':
      return 'resolution';
    case 'type':
      return 'issuetype';
    case 'review':
      return 'review';
    case 'target branch':
      return 'branch';
    case 'merged':
      return 'merged';
    case 'closed':
      return 'closed';
    case 'reopened':
      return 'reopened';
    case 'draft':
    case 'ready':
      return 'draft';
    case 'auto-merge':
      return 'automerge';
    default:
      return undefined;
  }
}

/**
 * Ledger (261111-i2o): colour is reserved for events that ask something of you. Only these kinds
 * paint their action phrase in the event colour; plain updates stay neutral.
 */
const ACTIONABLE_KINDS: ReadonlySet<EventKind> = new Set<EventKind>([
  'mention',
  'review',
  'assignment',
  'failure',
  'due',
]);

export function isActionableKind(kind: EventKind): boolean {
  return ACTIONABLE_KINDS.has(kind);
}
