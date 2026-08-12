/**
 * ChangelogEntry — compact single-line rendering of a Jira changelog history.
 *
 * Each ChangelogHistory may contain multiple changed items; we render each
 * item as a separate line grouped under the same author/timestamp block.
 */
import { GitCommit } from 'lucide-react';
import type { ChangelogHistory } from '@/services/jira';
import { relativeTime } from '../IssueDetailContent';

interface ChangelogEntryProps {
  history: ChangelogHistory;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function describeChange(field: string, fromVal: string | null, toVal: string | null): string {
  const fieldName = capitalize(field);
  if (fromVal == null && toVal != null) {
    return `set ${fieldName} to ${toVal}`;
  }
  if (toVal == null && fromVal != null) {
    return `cleared ${fieldName}`;
  }
  if (fromVal != null && toVal != null) {
    return `changed ${fieldName} from ${fromVal} to ${toVal}`;
  }
  return `updated ${fieldName}`;
}

export function ChangelogEntry({ history }: ChangelogEntryProps) {
  const { author, items, created } = history;

  return (
    <div className="flex items-start gap-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5">
      <GitCommit className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {items.map((item) => (
          <p key={`${history.id}-${item.field}`} className="text-sm text-muted-foreground">
            <span className="font-medium">{author.displayName}</span>{' '}
            {describeChange(item.field, item.fromString, item.toString)}
          </p>
        ))}
        <span className="text-xs text-muted-foreground" title={new Date(created).toLocaleString()}>
          {relativeTime(created)}
        </span>
      </div>
    </div>
  );
}
