/**
 * OtherCommitsGroup — commit rows for commits with no linked Jira issue (D-08).
 *
 * Rendered under the "OTHER COMMITS" section header in the Yesterday column,
 * so it emits only the commit rows (the section header provides the label).
 */

import { GitBranch } from 'lucide-react';
import type { GitLabCommit } from '@/services/gitlab';

interface OtherCommitsGroupProps {
  commits: GitLabCommit[];
}

export default function OtherCommitsGroup({ commits }: OtherCommitsGroupProps) {
  if (commits.length === 0) return null;

  return (
    <div className="divide-y divide-border [&>*]:py-1.5">
      {commits.map((commit) => (
        <div key={commit.id} className="flex items-center gap-2 px-2">
          <GitBranch className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 min-w-0 truncate text-sm text-foreground">
            {commit.title}{' '}
            <span className="text-muted-foreground font-mono">{commit.short_id}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
