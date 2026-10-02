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
  GitCommit,
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
import { CHIP_TONE_CLASS, statusPillClass } from '@/lib/statusStyles';
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const EMPTY = <span className="text-muted-foreground">∅</span>;

function formatValue(kind: MergedItem['kind'], v: string | null): string | null {
  if (v == null || v === '') return null;
  if (kind === 'duration') {
    const n = Number(v);
    return Number.isFinite(n) ? formatDuration(n) : v;
  }
  return v;
}

function ShortChange({ item }: { item: MergedItem }) {
  const from = formatValue(item.kind, item.from);
  const to = formatValue(item.kind, item.to);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {from == null ? (
        EMPTY
      ) : (
        <span className="text-muted-foreground line-through truncate pr-0.5">{from}</span>
      )}
      <ArrowRight className="size-3 flex-none text-muted-foreground" />
      {to == null ? EMPTY : <span className="truncate pr-0.5">{to}</span>}
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
    <div className="flex items-center gap-1.5 min-w-0">
      {item.from ? (
        <span className={`${statusPillClass(categoryFor(item.fromId, item.from))} opacity-60`}>
          {item.from}
        </span>
      ) : (
        EMPTY
      )}
      <ArrowRight className="size-3 flex-none text-muted-foreground" />
      {item.to ? (
        <span className={statusPillClass(categoryFor(item.toId, item.to))}>{item.to}</span>
      ) : (
        EMPTY
      )}
    </div>
  );
}

function MultiValueChange({ item }: { item: MergedItem }) {
  if (item.added.length === 0 && item.removed.length === 0) return <ShortChange item={item} />;
  return (
    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
      {item.added.map((t) => (
        <span
          key={`a-${t}`}
          className={`${CHIP_TONE_CLASS.green} rounded px-1.5 text-xs whitespace-nowrap`}
        >
          +{t}
        </span>
      ))}
      {item.removed.map((t) => (
        <span
          key={`r-${t}`}
          className={`${CHIP_TONE_CLASS.red} rounded px-1.5 text-xs whitespace-nowrap`}
        >
          −{t}
        </span>
      ))}
    </div>
  );
}

function LongTextDiff({ item }: { item: MergedItem }) {
  const [expanded, setExpanded] = useState(false);
  const diff = useMemo(() => wordDiff(item.from, item.to), [item.from, item.to]);

  if (diff.whitespaceOnly) {
    return <span className="text-xs text-muted-foreground">Whitespace / formatting only</span>;
  }

  const firstAdded = diff.parts.find((p) => p.added)?.value.trim();
  const preview = firstAdded || (item.to ? item.to.slice(0, 80) : '') || '∅';

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-none items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {`Show changes (+${diff.addedWords} / −${diff.removedWords} words)`}
        </button>
        {!expanded && <span className="truncate pr-0.5 text-muted-foreground">{preview}</span>}
      </div>
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          <DiffColumn title="Before" side="removed" diff={diff} fallbackText={item.from} />
          <DiffColumn title="After" side="added" diff={diff} fallbackText={item.to} />
          {diff.fallback && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Too many changes to highlight
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
  const tone = side === 'added' ? CHIP_TONE_CLASS.green : CHIP_TONE_CLASS.red;
  // Key by cumulative character offset: stable and unique per part.
  let offset = 0;
  const keyedParts = diff.parts
    .filter((p) => !p[other])
    .map((part) => {
      const key = `${offset}-${side}`;
      offset += part.value.length;
      return { key, part };
    });
  return (
    <div className="rounded border border-border p-2 min-w-0">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="whitespace-pre-wrap break-words text-sm">
        {diff.fallback
          ? (fallbackText ?? '')
          : keyedParts.map(({ key, part }) => (
              <span key={key} className={part[side] ? tone : undefined}>
                {part.value}
              </span>
            ))}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: MergedItem }) {
  const Icon = ICONS[item.field.toLowerCase()] ?? Pencil;
  let value: React.ReactNode;
  switch (item.kind) {
    case 'long':
      value = <LongTextDiff item={item} />;
      break;
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
    <div className="flex items-center gap-2 min-w-0 text-sm">
      <div className="flex-none w-32 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 flex-none" />
        <span className="truncate pr-0.5">{capitalize(item.field)}</span>
      </div>
      <div className="flex-1 min-w-0">{value}</div>
    </div>
  );
}

export function ChangelogEntry({ histories }: ChangelogEntryProps) {
  const latest = latestHistory(histories);
  const items = useMemo(() => mergeGroupItems(histories), [histories]);
  if (!latest) return null;

  return (
    <div className="flex items-start gap-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5">
      <GitCommit className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{latest.author?.displayName ?? 'Unknown'}</span>{' '}
          <span
            className="text-xs text-muted-foreground"
            title={new Date(latest.created).toLocaleString()}
          >
            {relativeTime(latest.created)}
          </span>
        </div>
        {items.map((item) => (
          <ItemRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}
