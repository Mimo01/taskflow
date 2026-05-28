/**
 * QuickCreateInput — inline issue creation input for a kanban column.
 *
 * Shows a small "+ Add" button at the bottom of each column.
 * On click, expands to a text input. Enter submits, Escape cancels.
 *
 * Submission flow (Phase 72 Plan 02):
 * 1. createIssue → new issue created in Jira's default status
 * 2. getGhTransitions(queryClient, ..., projectId, issueTypeId) → resolve
 *    transitions for the new issue via the shared GreenHopper cache
 * 3. postTransition → move to target column status (if transition exists)
 * 4. onCreated() → invalidate sprint board query so the board re-fetches
 *
 * If postTransition has no valid transition, the issue lands in its default
 * status; the board re-fetch will show it in the correct column.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createIssue, getGhTransitions, postTransition } from '@/services/jira';

interface QuickCreateInputProps {
  statusId: string;
  statusName: string;
  projectKey: string;
  /** Numeric Jira project id (Phase 72 — GH transitions cache key). */
  projectId: number;
  /** Jira issuetype id for the column's default create type (Phase 72). */
  issueTypeId: string;
  jiraBaseUrl: string;
  jiraToken: string;
  onCreated: () => void;
}

export default function QuickCreateInput({
  statusId,
  statusName,
  projectKey,
  projectId,
  issueTypeId,
  jiraBaseUrl,
  jiraToken,
  onCreated,
}: QuickCreateInputProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!value.trim()) return;

    setIsSubmitting(true);
    setError(null);

    let newKey: string;
    try {
      ({ key: newKey } = await createIssue(jiraBaseUrl, jiraToken, projectKey, value.trim()));
    } catch (err) {
      // Creation itself failed — show the error and leave the input open so
      // the user can retry without producing duplicates.
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to create issue');
      return;
    }

    // WR-04: post-create transition is BEST-EFFORT. The issue is already in
    // Jira at this point; if we fail to move it, we must still call
    // onCreated() and reset the input so the user can see the new issue and
    // not retry, which would create duplicates.
    try {
      const transitions = await getGhTransitions(
        queryClient,
        jiraBaseUrl,
        jiraToken,
        projectId,
        issueTypeId,
      );
      const t = transitions.find((tr) => tr.to.id === statusId);
      if (t) {
        await postTransition(jiraBaseUrl, jiraToken, newKey, t.id);
      }
    } catch (err) {
      setError(
        `Created ${newKey} but couldn't move it to ${statusName}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }

    setValue('');
    setIsOpen(false);
    setIsSubmitting(false);
    onCreated();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 px-1"
      >
        + Add
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="flex-1 text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={`Issue summary...`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void handleSubmit();
            } else if (e.key === 'Escape') {
              setIsOpen(false);
              setValue('');
              setError(null);
            }
          }}
          disabled={isSubmitting}
          aria-label={`Add issue to ${statusName}`}
        />
        {isSubmitting && <span className="text-xs text-muted-foreground">Creating...</span>}
      </div>
      {error && <p className="text-xs text-destructive px-1">{error}</p>}
    </div>
  );
}
