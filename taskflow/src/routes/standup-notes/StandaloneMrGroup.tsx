/**
 * StandaloneMrGroup — MR group for MR events not linked to any Jira issue (D-09).
 *
 * Heading: !{iid} {title}
 * Sub-items: "Commented on !{iid}" or "Approved !{iid}" per action_name (D-05).
 */

import { CheckCircle, GitMerge, MessageSquare } from 'lucide-react';
import type { GitLabUserMREvent } from '@/services/gitlab';

interface StandaloneMrGroupProps {
  iid: number;
  title: string;
  events: GitLabUserMREvent[];
}

export default function StandaloneMrGroup({ iid, title, events }: StandaloneMrGroupProps) {
  return (
    <div className="py-2">
      {/* Group header: !{iid} {title} */}
      <div className="flex items-center gap-2 text-sm font-semibold">
        <GitMerge className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 min-w-0 truncate">
          <span className="text-muted-foreground font-mono mr-1">!{iid}</span>
          {title}
        </span>
      </div>

      {/* Sub-items: one per event */}
      {events.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1 pl-8">
          {events.map((event) => {
            const isApproval = event.action_name === 'approved';
            const SubIcon = isApproval ? CheckCircle : MessageSquare;
            const label = isApproval
              ? `Approved !${event.target_iid}`
              : `Commented on !${event.target_iid}`;
            return (
              <li key={event.id} className="flex items-start gap-1.5 text-xs text-foreground">
                <SubIcon className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
                <span className="min-w-0">{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
