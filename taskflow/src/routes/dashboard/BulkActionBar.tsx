/**
 * BulkActionBar -- floating toolbar for bulk status/assignee/priority changes.
 *
 * Appears at the bottom of the viewport when 1+ sprint board cards are selected.
 * Executes parallel API calls with concurrency limit of 5 and shows progress.
 * Escape key clears selection and hides the bar.
 */
import { useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { JiraIssue } from '@/services/jira';
import { fetchTransitions, postTransition, updateIssueField } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { BulkProgressIndicator } from './BulkProgressIndicator';

/** Run async tasks with a concurrency limit */
async function parallelBatch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
  onSettled: (result: { item: T; ok: boolean; error?: string }) => void,
) {
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    const item = items[i];
    try {
      await fn(item);
      onSettled({ item, ok: true });
    } catch (err) {
      onSettled({
        item,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
}

interface BulkActionBarProps {
  selectedKeys: Set<string>;
  issues: JiraIssue[];
  statuses: string[];
  assignees: string[];
  priorities: string[];
  onClearSelection: () => void;
  onBulkComplete: () => void;
  /** Optimistic update callback: mutate local issues before API calls */
  onOptimisticUpdate?: (updater: (issues: JiraIssue[]) => JiraIssue[]) => void;
}

export function BulkActionBar({
  selectedKeys,
  issues,
  statuses,
  assignees,
  priorities,
  onClearSelection,
  onBulkComplete,
  onOptimisticUpdate,
}: BulkActionBarProps) {
  const { jiraBaseUrl } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [targetAssignee, setTargetAssignee] = useState<string | null>(null);
  const [targetPriority, setTargetPriority] = useState<string | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState({
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    failures: [] as Array<{ key: string; error: string }>,
    isComplete: false,
  });

  // Keep a snapshot of original issues for rollback
  const originalIssuesRef = useRef<Map<string, JiraIssue>>(new Map());

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  // Escape clears selection
  useHotkeys('escape', onClearSelection, { enabled: selectedKeys.size > 0 && !isExecuting });

  const hasChange = targetStatus !== null || targetAssignee !== null || targetPriority !== null;
  const selectedIssues = issues.filter((i) => selectedKeys.has(i.key));

  const handleApply = async () => {
    if (!jiraBaseUrl || !jiraToken || !hasChange) return;

    const keys = Array.from(selectedKeys);
    const total = keys.length;

    // Snapshot originals for rollback
    const origMap = new Map<string, JiraIssue>();
    for (const issue of selectedIssues) {
      origMap.set(issue.key, structuredClone(issue));
    }
    originalIssuesRef.current = origMap;

    setIsExecuting(true);
    setProgress({ total, completed: 0, succeeded: 0, failed: 0, failures: [], isComplete: false });

    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ key: string; error: string }> = [];
    let completed = 0;

    // Apply optimistic updates
    if (onOptimisticUpdate) {
      onOptimisticUpdate((prev) =>
        prev.map((issue) => {
          if (!selectedKeys.has(issue.key)) return issue;
          const updated = { ...issue, fields: { ...issue.fields } };
          if (targetAssignee !== null) {
            updated.fields = {
              ...updated.fields,
              assignee: {
                ...updated.fields.assignee,
                displayName: targetAssignee,
                name: targetAssignee,
              } as JiraIssue['fields']['assignee'],
            };
          }
          if (targetPriority !== null) {
            updated.fields = {
              ...updated.fields,
            };
            (updated.fields as Record<string, unknown>).priority = { name: targetPriority };
          }
          return updated;
        }),
      );
    }

    // Execute status transitions
    if (targetStatus !== null) {
      await parallelBatch(
        keys,
        async (key) => {
          const transitions = await fetchTransitions(jiraBaseUrl, jiraToken, key);
          const transition = transitions.find(
            (t) => t.to.name.toLowerCase() === targetStatus.toLowerCase(),
          );
          if (!transition) {
            throw new Error(`No transition to "${targetStatus}"`);
          }
          await postTransition(jiraBaseUrl, jiraToken, key, transition.id);
        },
        5,
        (result) => {
          completed++;
          if (result.ok) succeeded++;
          else {
            failed++;
            failures.push({ key: result.item, error: result.error ?? 'Unknown error' });
            // Rollback this issue optimistically
            rollbackIssue(result.item);
          }
          setProgress({
            total,
            completed,
            succeeded,
            failed,
            failures: [...failures],
            isComplete: false,
          });
        },
      );
    }

    // Execute assignee changes
    if (targetAssignee !== null) {
      // If we already did status, don't double-count. Reset counters for combined ops.
      if (targetStatus === null) {
        // Only assignee
        await parallelBatch(
          keys,
          async (key) => {
            await updateIssueField(jiraBaseUrl, jiraToken, key, 'assignee', {
              name: targetAssignee,
            });
          },
          5,
          (result) => {
            completed++;
            if (result.ok) succeeded++;
            else {
              failed++;
              failures.push({ key: result.item, error: result.error ?? 'Unknown error' });
              rollbackIssue(result.item);
            }
            setProgress({
              total,
              completed,
              succeeded,
              failed,
              failures: [...failures],
              isComplete: false,
            });
          },
        );
      }
    }

    // Execute priority changes
    if (targetPriority !== null) {
      if (targetStatus === null && targetAssignee === null) {
        await parallelBatch(
          keys,
          async (key) => {
            await updateIssueField(jiraBaseUrl, jiraToken, key, 'priority', {
              name: targetPriority,
            });
          },
          5,
          (result) => {
            completed++;
            if (result.ok) succeeded++;
            else {
              failed++;
              failures.push({ key: result.item, error: result.error ?? 'Unknown error' });
              rollbackIssue(result.item);
            }
            setProgress({
              total,
              completed,
              succeeded,
              failed,
              failures: [...failures],
              isComplete: false,
            });
          },
        );
      }
    }

    // Handle combined operations (multiple fields changed)
    if (targetStatus !== null && (targetAssignee !== null || targetPriority !== null)) {
      // After status transitions done, run field updates for the same keys
      const fieldKeys = keys.filter((k) => !failures.some((f) => f.key === k));
      if (targetAssignee !== null) {
        await parallelBatch(
          fieldKeys,
          async (key) => {
            await updateIssueField(jiraBaseUrl, jiraToken, key, 'assignee', {
              name: targetAssignee,
            });
          },
          5,
          (result) => {
            if (!result.ok) {
              failures.push({ key: result.item, error: result.error ?? 'Unknown error' });
              rollbackIssue(result.item);
            }
          },
        );
      }
      if (targetPriority !== null) {
        await parallelBatch(
          fieldKeys,
          async (key) => {
            await updateIssueField(jiraBaseUrl, jiraToken, key, 'priority', {
              name: targetPriority,
            });
          },
          5,
          (result) => {
            if (!result.ok) {
              failures.push({ key: result.item, error: result.error ?? 'Unknown error' });
              rollbackIssue(result.item);
            }
          },
        );
      }
    }

    setProgress({ total, completed: total, succeeded, failed, failures, isComplete: true });

    if (failed === 0) {
      // All succeeded -- will auto-dismiss via BulkProgressIndicator
    }
  };

  function rollbackIssue(key: string) {
    const orig = originalIssuesRef.current.get(key);
    if (orig && onOptimisticUpdate) {
      onOptimisticUpdate((prev) => prev.map((issue) => (issue.key === key ? orig : issue)));
    }
  }

  function handleDismissProgress() {
    setIsExecuting(false);
    setTargetStatus(null);
    setTargetAssignee(null);
    setTargetPriority(null);
    setProgress({
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
      isComplete: false,
    });
    onBulkComplete();
  }

  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions for ${selectedKeys.size} selected issues`}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-[640px] w-full"
    >
      <div className="bg-card shadow-lg border border-border rounded-xl px-4 py-3">
        {isExecuting ? (
          <BulkProgressIndicator
            total={progress.total}
            completed={progress.completed}
            succeeded={progress.succeeded}
            failed={progress.failed}
            failures={progress.failures}
            isComplete={progress.isComplete}
            onDismiss={handleDismissProgress}
          />
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="secondary" className="shrink-0">
              {selectedKeys.size} selected
            </Badge>

            <Select
              value={targetStatus ?? undefined}
              onValueChange={(v) => setTargetStatus(v ?? null)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={targetAssignee ?? undefined}
              onValueChange={(v) => setTargetAssignee(v ?? null)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={targetPriority ?? undefined}
              onValueChange={(v) => setTargetPriority(v ?? null)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="default" size="sm" disabled={!hasChange} onClick={handleApply}>
              Apply Changes
            </Button>

            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Deselect All
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
