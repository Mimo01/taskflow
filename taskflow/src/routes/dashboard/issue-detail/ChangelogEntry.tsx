/**
 * ChangelogEntry — renders a burst of Jira changelog histories (same author, close in time).
 *
 * Rows are chosen by field kind: long text gets a collapsible side-by-side word diff,
 * short fields an Old -> New chip, multi-value fields +/- token chips. All changelog
 * strings are rendered as React text nodes only (never HTML / WikiRenderer).
 */
import {
  ArrowRight,
  ArrowUpDown,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  FileText,
  Hash,
  Link2,
  ListOrdered,
  Milestone,
  Paperclip,
  Pencil,
  Repeat,
  Tag,
  Type,
  User,
} from 'lucide-react';
import { type ComponentType, useMemo, useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { statusPillClass } from '@/lib/statusStyles';
import type { ChangelogHistory } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { relativeTime } from '../IssueDetailContent';
import { latestHistory, type MergedItem, mergeGroupItems, wordDiff } from './changelogDiff';
import { useJiraStatusList } from './useEpicProgressQueries';

interface ChangelogEntryProps {
  histories: ChangelogHistory[];
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  status: CircleDot,
  priority: ArrowUpDown,
  assignee: User,
  reporter: User,
  labels: Tag,
  sprint: Repeat,
  'fix version': Milestone,
  fixversions: Milestone,
  version: Milestone,
  component: Boxes,
  description: FileText,
  environment: FileText,
  summary: Type,
  'story points': Hash,
  timeestimate: Clock,
  timeoriginalestimate: Clock,
  timespent: Clock,
  attachment: Paperclip,
  link: Link2,
  rank: ListOrdered,
};

/** Jira's internal field ids → readable labels. Anything else is just capitalised. */
const LABELS: Record<string, string> = {
  timespent: 'Time spent',
  timeestimate: 'Remaining estimate',
  timeoriginalestimate: 'Original estimate',
  fixversions: 'Fix version',
  'fix version': 'Fix version',
  duedate: 'Due date',
  issuetype: 'Issue type',
  resolutiondate: 'Resolved',
};

function fieldLabel(field: string): string {
  return LABELS[field.toLowerCase()] ?? field.charAt(0).toUpperCase() + field.slice(1);
}

const EMPTY = <span className="italic text-muted-foreground pr-0.5">None</span>;

function formatValue(kind: MergedItem['kind'], v: string | null): string | null {
  if (v == null || v === '') return null;
  if (kind === 'duration') {
    const n = Number(v);
    return Number.isFinite(n) ? formatDuration(n) : v;
  }
  return v;
}

function Arrow() {
  return <ArrowRight className="size-3.5 flex-none text-muted-foreground/70" />;
}

function ShortChange({ item }: { item: MergedItem }) {
  const from = formatValue(item.kind, item.from);
  const to = formatValue(item.kind, item.to);
  return (
    <div className="flex items-center gap-2 min-w-0">
      {from == null ? (
        EMPTY
      ) : (
        <span
          className="text-muted-foreground line-through decoration-muted-foreground/50 truncate pr-0.5"
          title={from}
        >
          {from}
        </span>
      )}
      <Arrow />
      {to == null ? (
        EMPTY
      ) : (
        <span className="font-medium text-foreground truncate pr-0.5" title={to}>
          {to}
        </span>
      )}
    </div>
  );
}

function StatusChangeValue({ item }: { item: MergedItem }) {
  const { data } = useJiraStatusList(true);
  const categoryFor = (id: string | null, name: string | null): string | undefined => {
    const list = Array.isArray(data) ? data : [];
    const byId = id ? list.find((s) => s.id === id) : undefined;
    const match =
      byId ?? (name ? list.find((s) => s.name?.toLowerCase() === name.toLowerCase()) : undefined);
    return match?.statusCategory?.key;
  };
  return (
    <div className="flex items-center gap-2 min-w-0">
      {item.from ? (
        <span className={`${statusPillClass(categoryFor(item.fromId, item.from))} opacity-60`}>
          {item.from}
        </span>
      ) : (
        EMPTY
      )}
      <Arrow />
      {item.to ? (
        <span className={statusPillClass(categoryFor(item.toId, item.to))}>{item.to}</span>
      ) : (
        EMPTY
      )}
    </div>
  );
}

/** Multi-value fields read like any other change: removed values → added values. */
function MultiValueChange({ item }: { item: MergedItem }) {
  if (item.added.length === 0 && item.removed.length === 0) return <ShortChange item={item} />;
  const from = item.removed.join(', ') || null;
  const to = item.added.join(', ') || null;
  return <ShortChange item={{ ...item, kind: 'short', from, to }} />;
}

function FieldLabel({ field }: { field: string }) {
  const Icon = ICONS[field.toLowerCase()] ?? Pencil;
  return (
    <div className="flex-none w-36 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 flex-none" />
      <span className="truncate pr-0.5">{fieldLabel(field)}</span>
    </div>
  );
}

const ROW = 'flex items-center gap-3 min-w-0 min-h-6 text-sm';

function LongTextRow({ item }: { item: MergedItem }) {
  const [expanded, setExpanded] = useState(false);
  const diff = useMemo(() => wordDiff(item.from, item.to), [item.from, item.to]);

  if (diff.whitespaceOnly) {
    return (
      <div className={ROW}>
        <FieldLabel field={item.field} />
        <span className="text-xs italic text-muted-foreground pr-0.5">
          Whitespace / formatting only
        </span>
      </div>
    );
  }

  const label = `${expanded ? 'Hide' : 'Show'} changes (+${diff.addedWords} / −${diff.removedWords} words)`;

  return (
    <div className="min-w-0">
      <div className={ROW}>
        <FieldLabel field={item.field} />
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={label}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex flex-none items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs hover:bg-accent transition-colors"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <span className="font-medium">{expanded ? 'Hide changes' : 'Show changes'}</span>
          <span className="tabular-nums text-green-600 dark:text-green-400">
            +{diff.addedWords}
          </span>
          <span className="tabular-nums text-red-600 dark:text-red-400">−{diff.removedWords}</span>
        </button>
      </div>
      {expanded && (
        <div className="mt-2 overflow-hidden rounded-lg border">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
            <DiffColumn title="Before" side="removed" diff={diff} fallbackText={item.from} />
            <DiffColumn title="After" side="added" diff={diff} fallbackText={item.to} />
          </div>
          {diff.fallback && (
            <p className="border-t bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              Too many changes to highlight — showing full text.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const HIGHLIGHT = {
  added: 'rounded-sm bg-green-500/20 text-green-800 dark:text-green-300',
  removed:
    'rounded-sm bg-red-500/20 text-red-800 dark:text-red-300 line-through decoration-red-500/50',
} as const;

function DiffColumn({
  title,
  side,
  diff,
  fallbackText,
}: {
  title: string;
  side: 'added' | 'removed';
  diff: ReturnType<typeof wordDiff>;
  fallbackText: string | null;
}) {
  const other = side === 'added' ? 'removed' : 'added';
  // Key by cumulative character offset: stable and unique per part.
  let offset = 0;
  const keyedParts = diff.parts
    .filter((p) => !p[other])
    .map((part) => {
      const key = `${offset}-${side}`;
      offset += part.value.length;
      return { key, part };
    });
  const text = diff.fallback ? (fallbackText ?? '') : null;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <span
          className={`size-1.5 rounded-full ${side === 'added' ? 'bg-green-500' : 'bg-red-500'}`}
        />
        {title}
      </div>
      <div className="px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
        {text != null
          ? text || EMPTY
          : keyedParts.length === 0
            ? EMPTY
            : keyedParts.map(({ key, part }) => (
                <span key={key} className={part[side] ? HIGHLIGHT[side] : undefined}>
                  {part.value}
                </span>
              ))}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: MergedItem }) {
  if (item.kind === 'long') return <LongTextRow item={item} />;
  let value: React.ReactNode;
  switch (item.kind) {
    case 'status':
      value = <StatusChangeValue item={item} />;
      break;
    case 'multi':
      value = <MultiValueChange item={item} />;
      break;
    default:
      value = <ShortChange item={item} />;
  }
  return (
    <div className={ROW}>
      <FieldLabel field={item.field} />
      <div className="flex-1 min-w-0">{value}</div>
    </div>
  );
}

export function ChangelogEntry({ histories }: ChangelogEntryProps) {
  const latest = latestHistory(histories);
  const items = useMemo(() => mergeGroupItems(histories), [histories]);
  if (!latest) return null;

  const name = latest.author?.displayName ?? 'Unknown';
  const action =
    items.length === 1 ? `changed ${fieldLabel(items[0].field)}` : `changed ${items.length} fields`;

  return (
    <div className="py-1.5 density-compact:py-1 density-comfortable:py-2.5">
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <CachedAvatar url={latest.author?.avatarUrls?.['48x48']} name={name} size={20} />
        <span className="font-semibold text-sm truncate pr-0.5">{name}</span>
        <span className="text-muted-foreground truncate pr-0.5">{action}</span>
        <span aria-hidden className="flex-none text-muted-foreground/60">
          ·
        </span>
        <span
          className="flex-none text-muted-foreground"
          title={new Date(latest.created).toLocaleString()}
        >
          {relativeTime(latest.created)}
        </span>
      </div>
      {items.length > 0 && (
        <div className="mt-1.5 ml-2.5 border-l pl-4 space-y-1.5 density-compact:space-y-1">
          {items.map((item) => (
            <ItemRow key={item.key} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
