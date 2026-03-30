import { GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import type { GitLabMR } from '@/services/gitlab';
import { mrDot, mrStateClasses } from './utils';

interface MergeRequestsSectionProps {
  linkedMRs: GitLabMR[];
  mrsLoading: boolean;
  gitlabConnected: boolean;
  gitlabBaseUrl: string;
}

export function MergeRequestsSection({
  linkedMRs,
  mrsLoading,
  gitlabConnected,
  gitlabBaseUrl,
}: MergeRequestsSectionProps) {
  const navigate = useNavigate();

  if (!gitlabConnected || !gitlabBaseUrl) return null;

  return (
    <section>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Merge Requests
      </p>
      {mrsLoading && <div className="h-5 rounded bg-muted animate-pulse" />}
      {!mrsLoading &&
        linkedMRs.length > 0 &&
        linkedMRs.map((mr) => (
          <button
            key={mr.iid}
            type="button"
            onClick={() => navigate(`/mr/${mr.project_id}/${mr.iid}`)}
            className="w-full text-left rounded px-1 py-1 hover:bg-accent transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full shrink-0 ${mrDot(mr.state)}`} />
              <span className="text-xs font-mono">!{mr.iid}</span>
              <Badge
                className={`text-[10px] h-4 px-1.5 border-0 font-normal ${mrStateClasses(mr.state)}`}
              >
                {mr.state === 'merged' ? 'Merged' : mr.state === 'opened' ? 'Open' : mr.state}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate pl-[18px]">{mr.title}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pl-[18px] mt-0.5">
              <CachedAvatar url={mr.author.avatar_url} name={mr.author.name} size={20} className="shrink-0" />
              <span className="truncate">{mr.author.name}</span>
              <GitBranch className="size-2.5 shrink-0 opacity-50" />
              <span className="font-mono truncate">{mr.source_branch}</span>
            </div>
          </button>
        ))}
      {!mrsLoading && linkedMRs.length === 0 && (
        <p className="text-xs text-muted-foreground">None</p>
      )}
    </section>
  );
}
