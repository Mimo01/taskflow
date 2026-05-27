import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkUpdateIssue, createIssue, wrapCustomFieldValue } from '@/services/jira';
import { createIssueLink } from '@/services/jira/links';
import type { CreatemetaField } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import type { EditInitialValues, FormState } from './useCreateEditForm';

// ── Types ────────────────────────────────────────────────────────────────────

interface UseIssueMutationsOptions {
  jiraBaseUrl: string | null;
  projectKey: string;
  mode: 'create' | 'edit';
  initialValues?: EditInitialValues;
  state: FormState;
  creatmetaFields?: CreatemetaField[];
  issueTypeId?: string;
  parentInheritMap?: Record<string, unknown>;
  epicLinkFieldKey: string | null;
  storyPointsFieldKey: string | null;
  onSuccess: () => void;
  onError: (message: string) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useIssueMutations({
  jiraBaseUrl,
  projectKey,
  mode,
  initialValues,
  state,
  creatmetaFields,
  issueTypeId,
  parentInheritMap,
  epicLinkFieldKey,
  storyPointsFieldKey,
  onSuccess,
  onError,
}: UseIssueMutationsOptions) {
  const queryClient = useQueryClient();

  const isSubtask = state.selectedIssueType === 'Subtask';

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) throw new Error('No credentials');

      const options: Record<string, unknown> = {};

      if (state.description.trim()) options.description = state.description;
      if (state.selectedAssigneeName) options.assignee = { name: state.selectedAssigneeName };
      if (state.priority) options.priority = { name: state.priority };
      if (!isSubtask && state.storyPoints !== '' && storyPointsFieldKey)
        options[storyPointsFieldKey] = Number(state.storyPoints);

      if (isSubtask) {
        if (state.parentKey) options.parent = { key: state.parentKey };
        if (state.timeEstimate.trim())
          options.timetracking = { originalEstimate: state.timeEstimate.trim() };
        // CRITICAL: never include epicLinkFieldKey or storyPointsFieldKey on Subtasks
      } else {
        if (state.epicLinkKey && epicLinkFieldKey) options[epicLinkFieldKey] = state.epicLinkKey;
      }

      // Add custom field values
      for (const [k, v] of Object.entries(state.customFieldValues)) {
        if (v.trim() === '') continue;
        const fieldMeta = creatmetaFields?.find((f) => f.fieldId === k);
        options[k] = fieldMeta ? wrapCustomFieldValue(fieldMeta, v) : v;
      }

      // Inherit required fields from parent using the raw Jira value (preserves
      // original types such as integer account IDs that wrapCustomFieldValue would
      // stringify). Only applies when the user hasn't manually entered a value.
      if (parentInheritMap) {
        for (const [k, raw] of Object.entries(parentInheritMap)) {
          if (raw == null || (state.customFieldValues[k] ?? '').trim()) continue;
          const item = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
          if (item == null) continue;
          // Object values: extract the primary scalar — Tempo Accounts and similar
          // plugins expect just the id string, not the full object.
          if (typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            const scalar = obj.id ?? obj.key ?? obj.name;
            if (scalar != null) options[k] = String(scalar);
          } else {
            options[k] = item;
          }
        }
      }

      const newIssue = await createIssue(jiraBaseUrl, token, projectKey, state.summary.trim(), {
        issuetype: state.selectedIssueType,
        issueTypeId,
        ...options,
      });

      // Post-create: create issue links (Jira DC constraint -- cannot be in create body)
      for (const row of state.linkRows) {
        if (!row.linkTypeId || !row.issueKey) continue;
        try {
          await createIssueLink(jiraBaseUrl, token, row.linkTypeId, newIssue.key, row.issueKey);
        } catch (e) {
          console.error('Failed to create issue link:', e);
          // Individual link failures are silent -- do not fail the overall submit
        }
      }

      return newIssue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
      if (isSubtask && state.parentKey && jiraBaseUrl) {
        queryClient.invalidateQueries({
          queryKey: ['jira-issue-detail', state.parentKey, jiraBaseUrl],
        });
      }
      onSuccess();
    },
    onError: (err: Error) => {
      onError(err.message);
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !initialValues?.issueKey)
        throw new Error('No credentials or issue key');

      const fields: Record<string, unknown> = {
        summary: state.summary.trim(),
      };

      if (state.description.trim() !== (initialValues.description ?? '')) {
        fields.description = state.description;
      }
      if (state.selectedAssigneeName !== initialValues.assigneeName) {
        fields.assignee = state.selectedAssigneeName ? { name: state.selectedAssigneeName } : null;
      }
      if (state.priority !== initialValues.priority) {
        fields.priority = state.priority ? { name: state.priority } : null;
      }
      if (state.storyPoints !== '' && storyPointsFieldKey) {
        const sp = Number(state.storyPoints);
        if (!Number.isNaN(sp)) fields[storyPointsFieldKey] = sp;
      }
      if (state.epicLinkKey !== initialValues.epicLinkKey && epicLinkFieldKey) {
        fields[epicLinkFieldKey] = state.epicLinkKey;
      }

      // Add custom field values
      for (const [k, v] of Object.entries(state.customFieldValues)) {
        if (v.trim() === '') continue;
        const fieldMeta = creatmetaFields?.find((f) => f.fieldId === k);
        fields[k] = fieldMeta ? wrapCustomFieldValue(fieldMeta, v) : v;
      }

      await bulkUpdateIssue(jiraBaseUrl, token, initialValues.issueKey, fields);

      // Post-update: create new issue links
      for (const row of state.linkRows) {
        if (!row.linkTypeId || !row.issueKey) continue;
        try {
          await createIssueLink(
            jiraBaseUrl,
            token,
            row.linkTypeId,
            initialValues.issueKey,
            row.issueKey,
          );
        } catch (e) {
          console.error('Failed to create issue link:', e);
          // Individual link failures are silent -- do not fail the overall submit
        }
      }
    },
    onSuccess: () => {
      if (initialValues?.issueKey && jiraBaseUrl) {
        queryClient.invalidateQueries({
          queryKey: ['jira-issue-detail', initialValues.issueKey, jiraBaseUrl],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
      onSuccess();
    },
    onError: (err: Error) => {
      onError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError(''); // clear previous error
    if (mode === 'create') {
      createMutation.mutate();
    } else {
      editMutation.mutate();
    }
  }

  const isPending = createMutation.isPending || editMutation.isPending;

  return {
    createMutation,
    editMutation,
    handleSubmit,
    isPending,
  };
}
