/**
 * Offer to move a parent story to done after its last open subtask was closed
 * (quick 261014-m6e). One shared hook + dialog used by both transition entry
 * points (Sprint Board and the issue-detail sidebar).
 *
 * Flow: ask -> pick (parent's done-category transitions) -> optional resolution.
 * The parent is only transitioned after an explicit pick; dismiss never POSTs.
 */

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { statusPillClass } from '@/lib/statusStyles';
import {
  checkParentCompletion,
  invalidateAfterTransition,
  type ParentCompletionResult,
} from '@/services/jira/parentCompletion';
import {
  fetchIssueTransitionsWithFields,
  postTransition,
  resolveDropResolution,
  transitionsWithFieldsKey,
} from '@/services/jira/transitions';
import type { JiraTransitionWithFields } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { BoardResolutionDialog } from './BoardResolutionDialog';

type Prompt = Extract<ParentCompletionResult, { shouldPrompt: true }>;

export interface ParentCheckArgs {
  issueKey: string;
  parentKey?: string;
  isSubtask: boolean;
  fromCategory?: string;
  toCategory?: string;
}

interface HookOptions {
  jiraBaseUrl: string;
  boardId?: number | null;
}

export function useParentCompletionPrompt({ jiraBaseUrl, boardId }: HookOptions): {
  check: (args: ParentCheckArgs) => Promise<void>;
  dialog: ReactNode;
} {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const promptOpenRef = useRef(false);
  const inFlightRef = useRef(false);

  const check = useCallback(
    async ({ issueKey, parentKey, isSubtask, fromCategory, toCategory }: ParentCheckArgs) => {
      if (!isSubtask || !parentKey || toCategory !== 'done' || fromCategory === 'done') return;
      if (promptOpenRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const token = await readSecret('jira-pat').catch(() => null);
        if (!token) return;
        const result = await checkParentCompletion(jiraBaseUrl, token, issueKey, parentKey);
        if (result.shouldPrompt && !promptOpenRef.current) {
          promptOpenRef.current = true;
          setPrompt(result);
        }
      } catch {
        // never throws: a failed check just means no prompt
      } finally {
        inFlightRef.current = false;
      }
    },
    [jiraBaseUrl],
  );

  const handleClose = useCallback(() => {
    promptOpenRef.current = false;
    setPrompt(null);
  }, []);

  const dialog = prompt ? (
    <CompleteParentDialog
      key={prompt.parentKey}
      open
      prompt={prompt}
      jiraBaseUrl={jiraBaseUrl}
      boardId={boardId}
      onClose={handleClose}
    />
  ) : null;

  return { check, dialog };
}

type Step = 'ask' | 'pick' | 'resolution';

interface CompleteParentDialogProps {
  open: boolean;
  prompt: Prompt;
  jiraBaseUrl: string;
  boardId?: number | null;
  onClose: () => void;
}

export function CompleteParentDialog({
  open,
  prompt,
  jiraBaseUrl,
  boardId,
  onClose,
}: CompleteParentDialogProps) {
  const queryClient = useQueryClient();
  const { parentKey, parentSummary, parentStatusId, parentStatusName } = prompt;
  const [step, setStep] = useState<Step>('ask');
  const [transitions, setTransitions] = useState<JiraTransitionWithFields[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutionFor, setResolutionFor] = useState<{
    transition: JiraTransitionWithFields;
    allowedValues: Array<{ id: string; name: string }>;
  } | null>(null);

  async function getToken(): Promise<string> {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return token;
  }

  async function handleMove() {
    setError(null);
    setStep('pick');
    setLoading(true);
    try {
      const token = await getToken();
      const all = await queryClient.fetchQuery({
        queryKey: transitionsWithFieldsKey(parentKey, jiraBaseUrl, parentStatusId),
        queryFn: () => fetchIssueTransitionsWithFields(jiraBaseUrl, token, parentKey),
        staleTime: 0,
      });
      setTransitions(all.filter((t) => t.to.statusCategory?.key === 'done'));
    } catch (e) {
      setTransitions([]);
      setError(e instanceof Error ? e.message : 'Failed to load transitions');
    } finally {
      setLoading(false);
    }
  }

  async function runTransition(transitionId: string, fields?: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const token = await getToken();
      if (fields === undefined) {
        await postTransition(jiraBaseUrl, token, parentKey, transitionId);
      } else {
        await postTransition(jiraBaseUrl, token, parentKey, transitionId, fields);
      }
      invalidateAfterTransition(queryClient, parentKey, jiraBaseUrl, boardId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move the story');
      // Return to the pick step so the inline error is visible in the main dialog.
      setResolutionFor(null);
      setStep('pick');
    } finally {
      setPending(false);
    }
  }

  function handlePick(transition: JiraTransitionWithFields) {
    const decision = resolveDropResolution(transition);
    if (decision.kind === 'block') {
      setError('This transition requires a resolution but none are available');
      return;
    }
    if (decision.kind === 'dialog') {
      setError(null);
      setResolutionFor({ transition, allowedValues: decision.allowedValues });
      setStep('resolution');
      return;
    }
    void runTransition(transition.id);
  }

  function handleOpenChange(next: boolean) {
    if (!next && !pending) onClose();
  }

  return (
    <>
      <Dialog open={open && step !== 'resolution'} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>All subtasks of {parentKey} are done</DialogTitle>
            <DialogDescription>
              {parentSummary ? <span className="text-foreground">{parentSummary}</span> : null}
              {parentSummary ? ' — ' : ''}
              {step === 'ask'
                ? 'Move the story to done as well?'
                : `Pick a done status to move it to (currently ${parentStatusName}).`}
            </DialogDescription>
          </DialogHeader>
          {step === 'pick' && (
            <div className="flex flex-col gap-1">
              {loading && <p className="text-sm text-muted-foreground">Loading transitions…</p>}
              {!loading && transitions && transitions.length === 0 && !error && (
                <p className="text-sm text-muted-foreground">
                  No done transition available from {parentStatusName}
                </p>
              )}
              {!loading &&
                transitions?.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={pending}
                    onClick={() => handlePick(t)}
                    className="flex w-full items-center rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className={statusPillClass('done')}>{t.to.name}</span>
                  </button>
                ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              {step === 'ask' ? 'Not now' : 'Cancel'}
            </DialogClose>
            {step === 'ask' && <Button onClick={() => void handleMove()}>Move story…</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {step === 'resolution' && resolutionFor && (
        <BoardResolutionDialog
          key={parentKey}
          open
          onOpenChange={(next) => {
            if (!next && !pending) onClose();
          }}
          issueKey={parentKey}
          toStatusName={resolutionFor.transition.to.name}
          allowedValues={resolutionFor.allowedValues}
          onConfirm={(resolution) =>
            void runTransition(resolutionFor.transition.id, { resolution })
          }
          isPending={pending}
        />
      )}
    </>
  );
}
