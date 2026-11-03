import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { updateMergeRequest } from '@/services/gitlab';
import { addIssueFixVersion } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import type { DriftRow } from './driftDetection';
import type { MrFixContext } from './UnifiedTaskTable';
import { invalidateMrChannelCaches, patchMrInChannelCaches } from './useMrFixMutation';

// GitLab only treats an MR as a draft when one of these starts the title, so a
// task key must go AFTER the prefix or the MR is silently un-drafted.
const DRAFT_PREFIX_RE = /^\s*(?:\[draft\]|\(draft\)|draft:|wip:)\s*/i;

/** Prepend a task key to an MR title, preserving a leading draft prefix. */
export function prependTaskKeyToTitle(title: string, key: string): string {
  const m = DRAFT_PREFIX_RE.exec(title);
  return m ? `${m[0]}${key} ${title.slice(m[0].length)}` : `${key} ${title}`;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Update failed';
}

/**
 * Section-level fix state for the "Not covered by tasks above" rows. Pending
 * and errors live here, keyed by mr.id, so an error survives the row
 * unmounting/remounting (the row leaves the section when a fix succeeds).
 */
export function useNotCoveredFixes(input: {
  fix: MrFixContext;
  jiraFix?: { baseUrl: string | null; versionId: string };
}) {
  const { fix, jiraFix } = input;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const start = (mrId: number, label: string) => {
    setErrors((prev) => {
      if (!(mrId in prev)) return prev;
      const { [mrId]: _drop, ...rest } = prev;
      return rest;
    });
    setPending((prev) => ({ ...prev, [mrId]: label }));
  };
  const finish = (mrId: number) => {
    setPending((prev) => {
      const { [mrId]: _drop, ...rest } = prev;
      return rest;
    });
  };
  const fail = (mrId: number, message: string) => {
    setErrors((prev) => ({ ...prev, [mrId]: message }));
    finish(mrId);
  };

  const applyFixVersion = async (mrId: number, key: string): Promise<void> => {
    start(mrId, key);
    try {
      const baseUrl = jiraFix?.baseUrl;
      const versionId = jiraFix?.versionId;
      if (!baseUrl || !versionId) throw new Error('Jira is not configured');
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira credentials');
      await addIssueFixVersion(baseUrl, token, key, versionId);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail'] });
      await queryClient.invalidateQueries({ queryKey: ['jira-fixversion-issues', versionId] });
      finish(mrId);
    } catch (e) {
      fail(mrId, messageOf(e));
    }
  };

  const linkTask = async (row: DriftRow, key: string): Promise<void> => {
    const { mr } = row;
    start(mr.id, key);
    try {
      const { projectId, baseUrl, token } = fix;
      if (!projectId || !baseUrl || !token || !mr.iid) {
        throw new Error('GitLab is not configured for this merge request');
      }
      const updated = await updateMergeRequest(baseUrl, token, projectId, mr.iid, {
        title: prependTaskKeyToTitle(mr.title, key),
      });
      patchMrInChannelCaches(queryClient, projectId, mr.id, { title: updated.title });
      invalidateMrChannelCaches(queryClient, projectId);
      finish(mr.id);
    } catch (e) {
      fail(mr.id, messageOf(e));
    }
  };

  return { pending, errors, applyFixVersion, linkTask };
}
