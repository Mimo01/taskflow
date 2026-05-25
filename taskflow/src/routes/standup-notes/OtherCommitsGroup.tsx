/**
 * OtherCommitsGroup — catch-all group for commits with no linked Jira issue (D-08).
 *
 * Rendered below all issue groups and above the stat line.
 * Copy per UI-SPEC Copywriting Contract.
 */

import { GitBranch } from 'lucide-react';
import type { GitLabCommit } from '@/services/gitlab';

interface OtherCommitsGroupProps {
  commits: GitLabCommit[];
}

export default function OtherCommitsGroup({ commits }: OtherCommitsGroupProps) {
  if (commits.length === 0) return null;

  return (
    <div className="py-2">
      {/* Group header */}
      <div className="flex items-center gap-2 py-2 px-2">
        <GitBranch className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <span>Other commits</span>
          <p className="text-xs text-muted-foreground">Commits without a linked Jira issue</p>
        </div>
      </div>

      {/* Commit sub-items */}
      <div className="pl-6 border-l border-border ml-2 divide-y divide-border">
        {commits.map((commit) => (
          <div key={commit.id} className="flex items-center gap-2 py-2 px-2">
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 min-w-0 truncate text-sm text-foreground">
              {commit.title}{' '}
              <span className="text-muted-foreground font-mono">{commit.short_id}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
