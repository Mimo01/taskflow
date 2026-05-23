/**
 * WorklogEntryRow — Single Tempo worklog entry row with edit/delete affordances.
 *
 * Renders: [time spent] [author displayName] [optional comment truncated] [pencil] [trash]
 * Pencil click: swaps in place with EditWorklogForm.
 * Trash click: immediate deleteWorklog mutation (no confirmation dialog — T-64-09 accepted).
 *
 * Pattern mirrors IssueDetailPage.tsx worklogDeleteMutation (lines 287–296).
 * T-64-08: Jira server enforces permissions; 401/403 surfaces as mutation onError.
 */

import { useMutation } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import type { TempoWorklog } from '@/services/tempo';
import { EditWorklogForm } from './EditWorklogForm';

interface WorklogEntryRowProps {
  entry: TempoWorklog;
  issueKey: string;
  jiraBaseUrl: string;
  onMutationSuccess: () => void;
}

/** D-08: format seconds like formatSeconds in WorklogsPage (same logic, local copy for decoupling) */
function formatSecs(secs: number): string {
  if (secs === 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function WorklogEntryRow({
  entry,
  issueKey,
  jiraBaseUrl,
  onMutationSuccess,
}: WorklogEntryRowProps) {
  const [editing, setEditing] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      const worklogId = entry.jiraWorklogId?.toString() ?? entry.tempoWorklogId?.toString();
      if (!worklogId) throw new Error('No worklog ID');
      return deleteWorklog(jiraBaseUrl, token, issueKey, worklogId);
    },
    onSuccess: () => {
      onMutationSuccess();
    },
  });

  if (editing) {
    return (
      <EditWorklogForm
        entry={entry}
        issueKey={issueKey}
        jiraBaseUrl={jiraBaseUrl}
        onDiscard={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          onMutationSuccess();
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs font-semibold shrink-0">{formatSecs(entry.timeSpentSeconds)}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {entry.author.displayName ?? entry.author.name}
      </span>
      {entry.comment && (
        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
          {entry.comment}
        </span>
      )}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        <button
          type="button"
          aria-label="Edit worklog entry"
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete worklog entry"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
