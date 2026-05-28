/**
 * BulkActionBar -- floating toolbar for bulk status/assignee/priority changes.
 *
 * Appears at the bottom of the viewport when 1+ sprint board cards are selected.
 * Executes parallel API calls with concurrency limit of 5 and shows progress.
 * Escape key clears selection and hides the bar.
 */
import { useQueryClient } from '@tanstack/react-query';
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
import { getGhTransitions, postTransition, updateIssueField } from '@/services/jira';
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
  const queryClient = useQueryClient();

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

    // CR-01: unify all selected mutations into a single per-key async
    // function. Previously each field (status/assignee/priority) ran its
    // own parallelBatch with separate counter updates, which caused:
    //   - secondary passes (assignee/priority after status) never
    //     incremented completed/succeeded/failed, so the final progress
    //     totals were wrong and the failures list contradicted succeeded.
    //   - the priority branch's `targetStatus === null && targetAssignee
    //     === null` gate silently dropped priority when assignee was also
    //     set with status null.
    // Single-pass dispatch fixes both: each key runs status -> assignee ->
    // priority sequentially, any failure short-circuits that key into the
    // failure path, and counters increment exactly once per key.
    const applyOps = async (key: string): Promise<void> => {
      const issue = issues.find((i) => i.key === key);
      if (!issue) throw new Error(`Issue ${key} not in selection`);

      if (targetStatus !== null) {
        // Phase 72 (Plan 02): resolve transitions through the GH cache.
        // Deriving (projectId, issueTypeId) from the selected issue lets us
        // hit the project-scoped envelope (one fetch per project per
        // session) instead of one /transitions REST call per key.
        const projectId = Number(issue.fields.project?.id ?? 0);
        const issueTypeId = issue.fields.issuetype?.id ?? '';
        const transitions = await getGhTransitions(
          queryClient,
          jiraBaseUrl,
          jiraToken,
          projectId,
          issueTypeId,
        );
        const transition = transitions.find(
          (t) => t.to.name.toLowerCase() === targetStatus.toLowerCase(),
        );
        if (!transition) {
          throw new Error(`No transition to "${targetStatus}"`);
        }
        await postTransition(jiraBaseUrl, jiraToken, key, transition.id);
      }

      if (targetAssignee !== null) {
        await updateIssueField(jiraBaseUrl, jiraToken, key, 'assignee', {
          name: targetAssignee,
        });
      }

      if (targetPriority !== null) {
        await updateIssueField(jiraBaseUrl, jiraToken, key, 'priority', {
          name: targetPriority,
        });
      }
    };

    await parallelBatch(keys, applyOps, 5, (result) => {
      completed++;
      if (result.ok) {
        succeeded++;
      } else {
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
    });

    setProgress({ total, completed, succeeded, failed, failures, isComplete: true });

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
