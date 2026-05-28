/**
 * EditWorklogForm — Inline edit form for an existing Tempo worklog entry.
 *
 * Renders duration input + date input + comment textarea + Save/Discard buttons.
 * Called from WorklogEntryRow when the pencil icon is clicked.
 *
 * Pattern mirrors IssueDetailPage.tsx worklogEditMutation and LogWorkPopover.tsx form layout.
 * T-64-06: All duration strings parsed via parseDuration (STRIDE mitigate).
 * T-64-07: started constructed via .replace('Z', '+0000') (STRIDE mitigate).
 */

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseDuration } from '@/services/jira/duration';
import { updateWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import type { TempoWorklog } from '@/services/tempo';

interface EditWorklogFormProps {
  entry: TempoWorklog;
  issueKey: string;
  jiraBaseUrl: string;
  onDiscard: () => void;
  onSuccess: () => void;
  onDelete: () => void;
}

/**
 * Format seconds into a user-editable duration string like "2h 30m".
 * Guards against sub-minute values with '0m' fallback (never returns empty
 * string when seconds > 0).
 */
function formatSecondsForInput(secs: number): string {
  if (secs <= 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function EditWorklogForm({
  entry,
  issueKey,
  jiraBaseUrl,
  onDiscard,
  onSuccess,
  onDelete,
}: EditWorklogFormProps) {
  const worklogId = entry.jiraWorklogId?.toString() ?? entry.tempoWorklogId?.toString();

  const [duration, setDuration] = useState(() => formatSecondsForInput(entry.timeSpentSeconds));
  const [date, setDate] = useState(entry.dateStarted);
  const [comment, setComment] = useState(entry.comment ?? '');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const editMutation = useMutation({
    mutationFn: async (params: { timeSpentSeconds: number; started: string; comment?: string }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      if (!worklogId) throw new Error('No worklog ID');
      return updateWorklog(jiraBaseUrl, token, issueKey, worklogId, params);
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => {
      setMutationError(err.message);
    },
  });

  function handleSave() {
    setDurationError(null);
    setMutationError(null);

    const parsed = parseDuration(duration);
    if (!parsed) {
      setDurationError('Invalid duration');
      return;
    }

    // T-64-07: Jira worklog API requires "+0000" offset, not "Z" suffix
    const started = new Date(`${date}T12:00:00`).toISOString().replace('Z', '+0000');

    editMutation.mutate({
      timeSpentSeconds: parsed.seconds,
      started,
      comment: comment.trim() || undefined,
    });
  }

  return (
    <div className="space-y-2 py-1">
      <div>
        <Label className="text-xs mb-1">Duration</Label>
        <Input
          type="text"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            setDurationError(null);
          }}
          placeholder="e.g. 2h 30m"
          className="h-8 text-xs"
        />
        {durationError && <p className="text-xs text-destructive mt-0.5">{durationError}</p>}
      </div>
      <div>
        <Label className="text-xs mb-1">Date</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div>
        <Label className="text-xs mb-1">Comment</Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Work description (optional)"
          className="min-h-[48px] resize-none text-xs"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={editMutation.isPending}
          className="flex-1"
        >
          {editMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={onDelete}
          disabled={editMutation.isPending}
        >
          Delete
        </Button>
      </div>
      {mutationError && <p className="text-xs text-destructive">{mutationError}</p>}
    </div>
  );
}
