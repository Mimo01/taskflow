/**
 * LogWorkPopover -- Popover form for logging time on an issue.
 *
 * Uses DurationInput for natural language time entry, a date picker,
 * and an optional comment. Calls createWorklog on submit.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { parseDuration } from '@/services/jira/duration';
import { createWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import { DurationInput } from './DurationInput';

interface LogWorkPopoverProps {
  issueKey: string;
  jiraBaseUrl: string;
  onSuccess?: () => void;
  /** Pre-fill the date input with this YYYY-MM-DD value. Defaults to today. */
  initialDate?: string;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function LogWorkPopover({ issueKey, jiraBaseUrl, onSuccess, initialDate }: LogWorkPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState('');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [date, setDate] = useState(() => initialDate ?? todayString());
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (params: { timeSpentSeconds: number; started: string; comment?: string }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return createWorklog(jiraBaseUrl, token, issueKey, params);
    },
    onSuccess: () => {
      setOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-worklogs', issueKey, jiraBaseUrl] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  function resetForm() {
    setDuration('');
    setDurationError(null);
    setDate(initialDate ?? todayString());
    setComment('');
    setSubmitError(null);
  }

  function handleSubmit() {
    setSubmitError(null);
    const parsed = parseDuration(duration);
    if (!parsed) {
      setDurationError('invalid');
      return;
    }
    setDurationError(null);
    // Jira worklog API requires "+0000" offset, not "Z" suffix
    const started = new Date(`${date}T12:00:00`).toISOString().replace('Z', '+0000');
    mutation.mutate({
      timeSpentSeconds: parsed.seconds,
      started,
      comment: comment.trim() || undefined,
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) resetForm();
      }}
    >
      <PopoverTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <Clock className="size-3.5" />
        Log Work
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4">
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1">Time Spent</Label>
            <DurationInput
              value={duration}
              onChange={(v) => {
                setDuration(v);
                setDurationError(null);
              }}
              error={durationError}
              autoFocus
            />
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
              className="min-h-[60px] resize-none text-xs"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || !duration.trim()}
            className="w-full"
            size="sm"
          >
            {mutation.isPending ? 'Logging...' : 'Log Time'}
          </Button>
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
