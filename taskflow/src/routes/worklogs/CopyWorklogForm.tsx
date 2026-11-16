/**
 * CopyWorklogForm — Inline prefilled create form for copying someone else's worklog as mine.
 *
 * Seeds duration/date/comment from the source entry, then calls createWorklog on the same
 * issue for the authenticated user (never updateWorklog). Shows a "Logging as {me}" line.
 * Same parseDuration + "+0000" started path as EditWorklogForm (T-64-06 / T-64-07).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseDuration } from '@/services/jira/duration';
import { createWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import type { TempoWorklog } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { formatSecondsForInput } from './EditWorklogForm';

interface CopyWorklogFormProps {
  entry: TempoWorklog;
  issueKey: string;
  jiraBaseUrl: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CopyWorklogForm({
  entry,
  issueKey,
  jiraBaseUrl,
  onSuccess,
  onCancel,
}: CopyWorklogFormProps) {
  const queryClient = useQueryClient();
  const displayName = useAuthStore((s) => s.jiraUserDisplayName);
  const avatarUrl = useAuthStore((s) => s.jiraUserAvatarUrl);

  const [duration, setDuration] = useState(() => formatSecondsForInput(entry.timeSpentSeconds));
  const [date, setDate] = useState(entry.dateStarted);
  const [comment, setComment] = useState(entry.comment ?? '');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (params: { timeSpentSeconds: number; started: string; comment?: string }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return createWorklog(jiraBaseUrl, token, issueKey, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-worklogs', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] });
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
    const started = new Date(`${date}T12:00:00`).toISOString().replace('Z', '+0000');
    mutation.mutate({
      timeSpentSeconds: parsed.seconds,
      started,
      comment: comment.trim() || undefined,
    });
  }

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {avatarUrl && <CachedAvatar url={avatarUrl} name={displayName} size={16} />}
        <span>Logging as {displayName ?? 'me'}</span>
      </div>
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
        <DatePicker value={date} onChange={setDate} size="sm" className="h-8 text-xs" />
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
          disabled={mutation.isPending || !duration.trim()}
          className="flex-1"
        >
          {mutation.isPending ? 'Logging…' : 'Log as me'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
      {mutationError && <p className="text-xs text-destructive">{mutationError}</p>}
    </div>
  );
}
