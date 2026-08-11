import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { GitLabMilestone } from '@/services/gitlab';
import { updateMilestone } from '@/services/gitlab';
import type { JiraFixVersion } from '@/services/jira';
import { updateFixVersion } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { mrChannelKeys } from './mrChannelKeys';

interface UseEditReleaseArgs {
  version: JiraFixVersion | null;
  matchedMilestone: GitLabMilestone | null;
  versionId: string | undefined;
  jiraBaseUrl: string | null | undefined;
  activeJiraProject: string | null | undefined;
  gitlabBaseUrl: string | null | undefined;
  activeGitlabProject: number | null | undefined;
  gitlabToken: string | null | undefined;
}

/**
 * useEditRelease — edit-modal state, diff builders and the combined save for
 * the release detail page. Moved verbatim from `ReleaseDetailPage.tsx` (D-16
 * — a move of existing state/handlers, not new structure).
 */
export function useEditRelease({
  version,
  matchedMilestone,
  versionId,
  jiraBaseUrl,
  activeJiraProject,
  gitlabBaseUrl,
  activeGitlabProject,
  gitlabToken,
}: UseEditReleaseArgs) {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReleased, setEditReleased] = useState(false);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState('');
  const [editMilestoneDescription, setEditMilestoneDescription] = useState('');
  // Per-source save errors (partial-failure handling). Jira and GitLab fail independently.
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [gitlabError, setGitlabError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Populate edit form when entering edit mode (seeds both Jira + GitLab fields)
  const startEditing = () => {
    if (!version) return;
    setEditName(version.name);
    setEditDate(version.releaseDate ?? '');
    setEditDescription(version.description ?? '');
    setEditReleased(version.released);
    setEditMilestoneTitle(matchedMilestone?.title ?? '');
    setEditMilestoneDescription(matchedMilestone?.description ?? '');
    setJiraError(null);
    setGitlabError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setJiraError(null);
    setGitlabError(null);
  };

  // Compute the changed Jira fields (only what differs from the current version).
  const buildJiraDiff = () => {
    const fields: {
      name?: string;
      releaseDate?: string | null;
      description?: string;
      released?: boolean;
    } = {};
    if (editName !== version?.name) fields.name = editName;
    if (editDate !== (version?.releaseDate ?? '')) {
      fields.releaseDate = editDate || null;
    }
    if (editDescription !== (version?.description ?? '')) fields.description = editDescription;
    if (editReleased !== version?.released) fields.released = editReleased;
    return fields;
  };

  // Compute the changed GitLab milestone fields (title/description only).
  const buildGitlabDiff = () => {
    const fields: { title?: string; description?: string } = {};
    if (!matchedMilestone) return fields;
    if (editMilestoneTitle !== matchedMilestone.title) fields.title = editMilestoneTitle;
    if (editMilestoneDescription !== (matchedMilestone.description ?? '')) {
      fields.description = editMilestoneDescription;
    }
    return fields;
  };

  // Save is enabled only when at least one field across either source changed.
  const isEditDirty =
    Object.keys(buildJiraDiff()).length > 0 || Object.keys(buildGitlabDiff()).length > 0;

  // GitLab rejects an empty milestone title (400). Block the save when a matched
  // milestone's title has been cleared, mirroring the required Jira name guard.
  const isMilestoneTitleInvalid = !!matchedMilestone && editMilestoneTitle.trim() === '';

  // Combined save: writes Jira + GitLab via Promise.allSettled, sending only
  // changed fields per source. Partial failure keeps the modal open with a
  // per-source error; the succeeded side is NOT rolled back.
  const handleSave = async () => {
    const jiraFields = buildJiraDiff();
    const gitlabFields = buildGitlabDiff();
    const hasJiraChanges = Object.keys(jiraFields).length > 0;
    const hasGitlabChanges = Object.keys(gitlabFields).length > 0;

    // Nothing changed — just close.
    if (!hasJiraChanges && !hasGitlabChanges) {
      setEditing(false);
      return;
    }

    setIsSaving(true);
    setJiraError(null);
    setGitlabError(null);

    const jiraPromise = hasJiraChanges
      ? (async () => {
          const token = await readSecret('jira-pat').catch(() => null);
          if (!token || !jiraBaseUrl || !versionId) throw new Error('No credentials');
          return updateFixVersion(jiraBaseUrl, token, versionId, jiraFields);
        })()
      : null;

    const gitlabPromise =
      hasGitlabChanges && matchedMilestone
        ? updateMilestone(
            gitlabBaseUrl ?? '',
            gitlabToken ?? '',
            activeGitlabProject ?? 0,
            matchedMilestone.id,
            gitlabFields,
          )
        : null;

    const [jiraResult, gitlabResult] = await Promise.allSettled([
      jiraPromise ?? Promise.resolve(null),
      gitlabPromise ?? Promise.resolve(null),
    ]);

    let anyFailed = false;

    if (jiraPromise && jiraResult.status === 'rejected') {
      anyFailed = true;
      setJiraError((jiraResult.reason as Error)?.message ?? 'Failed to update Jira');
    }
    if (gitlabPromise && gitlabResult.status === 'rejected') {
      anyFailed = true;
      setGitlabError(
        (gitlabResult.reason as Error)?.message ?? 'Failed to update GitLab milestone',
      );
    }

    // Invalidate caches for whichever side succeeded.
    if (jiraPromise && jiraResult.status === 'fulfilled') {
      queryClient.invalidateQueries({ queryKey: ['jira-fix-versions', activeJiraProject] });
      queryClient.invalidateQueries({ queryKey: ['jira-version-counts', versionId] });
    }
    if (gitlabPromise && gitlabResult.status === 'fulfilled') {
      queryClient.invalidateQueries({ queryKey: ['gitlab-milestones', activeGitlabProject] });
      // The milestone-MR query is keyed on the milestone title — invalidate it
      // too so a title rename doesn't leave the MR list/labels querying the old
      // title.
      queryClient.invalidateQueries({
        queryKey: mrChannelKeys.channelForProject('gitlab-milestone-mrs', activeGitlabProject),
      });
    }

    setIsSaving(false);

    // Full success closes the modal; any failure keeps it open with per-source error.
    if (!anyFailed) {
      setEditing(false);
    }
  };

  return {
    editing,
    setEditing,
    editName,
    setEditName,
    editDate,
    setEditDate,
    editDescription,
    setEditDescription,
    editReleased,
    setEditReleased,
    editMilestoneTitle,
    setEditMilestoneTitle,
    editMilestoneDescription,
    setEditMilestoneDescription,
    jiraError,
    gitlabError,
    isSaving,
    isEditDirty,
    isMilestoneTitleInvalid,
    startEditing,
    cancelEditing,
    handleSave,
  };
}
