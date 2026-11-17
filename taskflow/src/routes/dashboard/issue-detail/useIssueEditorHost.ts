import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import type { WikiEditorHost } from '@/components/wiki-editor/types';
import type { JiraAttachment } from '@/services/jira';
import { deleteAttachment, uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

interface Args {
  issueKey: string | null;
  projectKey?: string | null;
  attachments: readonly JiraAttachment[];
  userMap: Readonly<Record<string, string>>;
  referenceTexts: readonly string[];
  onOpenIssue?: (key: string) => void;
}

/**
 * One WikiEditorHost for live-issue hosts (composer, comment edit, Edit Issue). The PAT is
 * read per call and never stored on the host. Identity is stable across re-renders with
 * equal inputs; volatile inputs live in refs so comment refetches do not churn it.
 */
export function useIssueEditorHost({
  issueKey,
  projectKey,
  attachments,
  userMap,
  referenceTexts,
  onOpenIssue,
}: Args): WikiEditorHost {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const queryClient = useQueryClient();
  const textsRef = useRef(referenceTexts);
  textsRef.current = referenceTexts;
  const openRef = useRef(onOpenIssue);
  openRef.current = onOpenIssue;

  return useMemo<WikiEditorHost>(() => {
    const resolvedProject = projectKey ?? issueKey?.split('-')[0] ?? null;
    const base: WikiEditorHost = {
      issueKey,
      projectKey: resolvedProject,
      attachments,
      userMap,
      isReferencedElsewhere: (filename) => textsRef.current.some((t) => t.includes(filename)),
      onOpenIssue: (key) => openRef.current?.(key),
    };
    if (!issueKey) return base;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    const credentials = async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira credentials');
      if (!jiraBaseUrl) throw new Error('No Jira base URL');
      return { token, baseUrl: jiraBaseUrl };
    };
    return {
      ...base,
      uploadFile: async (file) => {
        const { token, baseUrl } = await credentials();
        const created = await uploadAttachment(baseUrl, token, issueKey, file);
        const first = created[0];
        if (!first) throw new Error('Upload returned no attachment');
        await invalidate();
        return first;
      },
      deleteAttachment: async (id) => {
        const { token, baseUrl } = await credentials();
        await deleteAttachment(baseUrl, token, id);
        await invalidate();
      },
    };
  }, [issueKey, projectKey, attachments, userMap, jiraBaseUrl, queryClient]);
}
