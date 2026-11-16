/**
 * WorklogEntryRow — Single Tempo worklog entry row with edit/delete affordances.
 *
 * Renders: [time spent] [optional comment truncated] then, on hover:
 * - my entries: [pencil] [trash]
 * - other people's entries: read-only, a single "Copy worklog as mine" button
 * Pencil click: swaps in place with EditWorklogForm (own entries only, guarded at render).
 * Copy click: swaps in place with CopyWorklogForm (creates a new worklog for me).
 * Trash click: immediate deleteWorklog mutation (no confirmation dialog — T-64-09 accepted).
 *
 * Pattern mirrors IssueDetailPage.tsx worklogDeleteMutation (lines 287–296).
 * T-64-08: Jira server enforces permissions; 401/403 surfaces as mutation onError.
 */

import { useMutation } from '@tanstack/react-query';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { isOwnWorklog } from '@/lib/worklog-ownership';
import { deleteWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import type { TempoWorklog } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { CopyWorklogForm } from './CopyWorklogForm';
import { EditWorklogForm } from './EditWorklogForm';

interface WorklogEntryRowProps {
  entry: TempoWorklog;
  issueKey: string;
  jiraBaseUrl: string;
  onMutationSuccess: () => void;
  onEditingChange?: (editing: boolean) => void;
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
  onEditingChange,
}: WorklogEntryRowProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'copy'>('view');
  const username = useAuthStore((s) => s.jiraUsername);
  const userKey = useAuthStore((s) => s.jiraUserKey);
  const isMine = isOwnWorklog(entry.author, { username, userKey });

  function changeMode(next: 'view' | 'edit' | 'copy') {
    setMode(next);
    onEditingChange?.(next !== 'view');
  }

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

  if (mode === 'copy') {
    return (
      <CopyWorklogForm
        entry={entry}
        issueKey={issueKey}
        jiraBaseUrl={jiraBaseUrl}
        onSuccess={() => {
          changeMode('view');
          onMutationSuccess();
        }}
        onCancel={() => changeMode('view')}
      />
    );
  }

  if (mode === 'edit' && isMine) {
    return (
      <EditWorklogForm
        entry={entry}
        issueKey={issueKey}
        jiraBaseUrl={jiraBaseUrl}
        onDelete={() => deleteMutation.mutate()}
        onSuccess={() => {
          changeMode('view');
          onMutationSuccess();
        }}
      />
    );
  }

  return (
    <div className="group relative flex items-center gap-2 py-0.5 density-compact:py-0 density-comfortable:py-1 min-w-0">
      <span className="text-xs font-semibold shrink-0">{formatSecs(entry.timeSpentSeconds)}</span>
      {entry.comment && (
        <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
          {entry.comment}
        </span>
      )}
      <div className="absolute right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-popover pl-2">
        {isMine ? (
          <>
            <button
              type="button"
              aria-label="Edit worklog entry"
              onClick={() => changeMode('edit')}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete worklog entry"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label="Copy worklog as mine"
            title="Copy as mine"
            onClick={() => changeMode('copy')}
            className="p-0.5 text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
