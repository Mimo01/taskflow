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

function describeChange(field: string, fromString: string | null, toString: string | null): string {
  const fieldName = capitalize(field);
  if (fromString == null && toString != null) {
    return `set ${fieldName} to ${toString}`;
  }
  if (toString == null && fromString != null) {
    return `cleared ${fieldName}`;
  }
  if (fromString != null && toString != null) {
    return `changed ${fieldName} from ${fromString} to ${toString}`;
  }
  return `updated ${fieldName}`;
}

export function ChangelogEntry({ history }: ChangelogEntryProps) {
  const { author, items, created } = history;

  return (
    <div className="flex items-start gap-2 py-1.5">
      <GitCommit className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {items.map((item, i) => (
          <p key={`${history.id}-${i}`} className="text-sm text-muted-foreground">
            <span className="font-medium">{author.displayName}</span>{' '}
            {describeChange(item.field, item.fromString, item.toString)}
          </p>
        ))}
        <span className="text-xs text-muted-foreground">{relativeTime(created)}</span>
      </div>
    </div>
  );
}
