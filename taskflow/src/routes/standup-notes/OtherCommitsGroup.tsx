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
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground italic">
        <GitBranch className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <span>Other commits</span>
          <p className="text-xs font-normal not-italic">Commits without a linked Jira issue</p>
        </div>
      </div>

      {/* Commit sub-items */}
      <ul className="mt-1 flex flex-col gap-1 pl-8">
        {commits.map((commit) => (
          <li key={commit.id} className="flex items-start gap-1.5 text-xs text-foreground">
            <GitBranch className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
            <span className="min-w-0">
              {commit.title}{' '}
              <span className="text-muted-foreground font-mono">{commit.short_id}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
