/**
 * StandaloneMrGroup — MR group for MR events not linked to any Jira issue (D-09).
 *
 * Heading: !{iid} {title}
 * Sub-items: "{n} comments on !{iid}" (collapsed count, D-05) and/or
 * "Approved !{iid}" — approvals stay discrete, comments are aggregated.
 * All rows (header + sub-items) navigate to MR detail.
 */

import { CheckCircle, GitMerge, MessageSquare } from 'lucide-react';

interface StandaloneMrGroupProps {
  iid: number;
  projectId: number;
  title: string;
  commentCount: number;
  approvals: number;
  onMRClick: (projectIdAndIid: string) => void;
}

function MrRow({
  icon: Icon,
  label,
  projectId,
  iid,
  onMRClick,
  dense = false,
}: {
  icon: typeof GitMerge;
  label: React.ReactNode;
  projectId: number;
  iid: number;
  onMRClick: (s: string) => void;
  dense?: boolean;
}) {
  return (
    <button
      type="button"
      className={`w-full text-left flex items-center gap-2 ${dense ? 'py-1.5' : 'py-3'} px-2 rounded hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer`}
      onClick={() => onMRClick(`${projectId}/${iid}`)}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      {label}
    </button>
  );
}

import type React from 'react';

export default function StandaloneMrGroup({
  iid,
  projectId,
  title,
  commentCount,
  approvals,
  onMRClick,
}: StandaloneMrGroupProps) {
  return (
    <div>
      {/* Group header: !{iid} {title} — clickable to MR detail */}
      <MrRow
        icon={GitMerge}
        label={
          <>
            <span className="text-xs text-muted-foreground font-mono shrink-0">!{iid}</span>
            <span className="flex-1 min-w-0 truncate text-sm">{title}</span>
          </>
        }
        projectId={projectId}
        iid={iid}
        onMRClick={onMRClick}
      />

      {/* Sub-items: collapsed comment count + approval (D-05) — also navigate to MR */}
      {(commentCount > 0 || approvals > 0) && (
        <div className="pl-6 ml-2">
          {commentCount > 0 && (
            <MrRow
              icon={MessageSquare}
              label={
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                  {commentCount} comment{commentCount === 1 ? '' : 's'} on !{iid}
                </span>
              }
              projectId={projectId}
              iid={iid}
              onMRClick={onMRClick}
              dense
            />
          )}
          {approvals > 0 && (
            <MrRow
              icon={CheckCircle}
              label={
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                  Approved !{iid}
                </span>
              }
              projectId={projectId}
              iid={iid}
              onMRClick={onMRClick}
              dense
            />
          )}
        </div>
      )}
    </div>
  );
}
