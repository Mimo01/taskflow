import { openUrl } from '@tauri-apps/plugin-opener';
import { GitMerge, Info } from 'lucide-react';
import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import type { GitLabMR } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';

interface UnmatchedMRsSectionProps {
  unmatchedMRs: GitLabMR[];
  onNavigateToIssueFromMR: (key: string) => void;
}

export function UnmatchedMRsSection({
  unmatchedMRs,
  onNavigateToIssueFromMR,
}: UnmatchedMRsSectionProps) {
  if (unmatchedMRs.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <div className="flex items-center gap-1.5 mb-1">
        <Info className="size-3.5 text-blue-500" />
        <h4 className="text-sm font-medium">
          Unmatched MRs
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {unmatchedMRs.length}
          </Badge>
        </h4>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        MRs in milestone not linked to any Jira task
      </p>
      <div className="space-y-1">
        {unmatchedMRs.map((mr) => (
          <div key={mr.id} className="flex items-center gap-2 text-sm py-1">
            <GitMerge
              className={`size-3.5 shrink-0 ${
                mr.state === 'merged'
                  ? 'text-green-600 dark:text-green-400'
                  : mr.state === 'opened'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-500'
              }`}
            />
            <button
              type="button"
              onClick={() => openUrl(mr.web_url)}
              className="text-xs font-mono hover:underline shrink-0"
            >
              !{mr.iid}
            </button>
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {(() => {
                const keys = extractTicketKeys(mr.title);
                if (keys.length === 0) return mr.title;
                const parts: React.ReactNode[] = [];
                let remaining = mr.title;
                for (const key of keys) {
                  const idx = remaining.indexOf(key);
                  if (idx > 0) parts.push(remaining.slice(0, idx));
                  parts.push(
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToIssueFromMR(key);
                      }}
                      className="text-primary hover:underline font-mono"
                    >
                      {key}
                    </button>,
                  );
                  remaining = remaining.slice(idx + key.length);
                }
                if (remaining) parts.push(remaining);
                return parts;
              })()}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto shrink-0">
              <CachedAvatar url={mr.author.avatar_url} name={mr.author.name} size={20} />
              {mr.author.name}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 ${
                mr.state === 'merged'
                  ? 'border-green-500 text-green-600'
                  : mr.state === 'opened'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-gray-400 text-gray-500'
              }`}
            >
              {mr.state}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
