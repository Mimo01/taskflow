import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import { timeBarIssues } from '@/lib/time-bar';
import type { JiraAttachment, JiraComment, JiraIssue, JiraIssueDetail } from '@/services/jira';
import { deleteAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { BulkCreateSubtasksModal } from './BulkCreateSubtasksModal';
import { AttachmentsSection } from './issue-detail/AttachmentsSection';
import { EpicProgressSection } from './issue-detail/EpicProgressSection';
import { EpicStoryCreateControl } from './issue-detail/EpicStoryCreateControl';
import { RelatedIssueRow } from './issue-detail/RelatedIssueRow';
import { SectionHeader } from './issue-detail/SectionHeader';
import { SubtaskCreateControl } from './issue-detail/SubtaskCreateControl';
import { SubtasksSkeleton } from './issue-detail/SubtasksSkeleton';
import type { AttachmentMap } from './WikiRenderer';
import { WikiRenderer } from './WikiRenderer';

interface IssueDetailContentProps {
  issue: JiraIssueDetail;
  issueKey: string;
  jiraBaseUrl: string;
  /** Comments from the independent comments query — seeds the description @mention map.
      `fetchIssueDetail` no longer returns `issue.fields.comment` after the phase 75 split. */
  comments?: JiraComment[];
  onOpenIssue?: (key: string) => void;
  storyPointsFieldKey: string;
  sprintFieldKey: string;
  epicLinkFieldKey: string;
  onAddSubtask?: (parentKey: string) => void;
  /** Epic detail: open the create modal for a Story prefilled with this epic. */
  onAddEpicStory?: (epicKey: string) => void;
  epicStories?: JiraIssue[];
  /** Enriched subtasks from independent query (undefined = pending, [] = empty/loaded) */
  enrichedSubtasks?: Array<{
    id: string;
    key: string;
    fields: {
      summary: string;
      status: { name: string; statusCategory?: { key: string } | unknown };
      assignee?: { displayName: string; name: string; avatarUrls?: { '48x48': string } } | null;
      timetracking?: {
        originalEstimateSeconds?: number;
        timeSpentSeconds?: number;
        remainingEstimateSeconds?: number;
      };
    };
  }>;
  /** Show subtasks skeleton (200ms-gated) */
  showSubtasksSkeleton?: boolean;
  /** Subtask enrichment query error */
  subtaskError?: Error | null;
  /** Retry callback for subtask enrichment */
  onSubtaskRetry?: () => void;
  /** Enriched parent (summary, status, assignee, issuetype) for the Parent section row.
      The base issue.fields.parent omits assignee; this fills the gap so the row matches
      the Subtasks section. Undefined while the parent fetch is pending. */
  enrichedParent?: JiraIssue;
}

/** Shared subtask item shape — union of base (no assignee) and enriched (with assignee) */
type SubtaskDisplayItem = {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory?: { key: string } | unknown };
    assignee?: { displayName: string; name: string; avatarUrls?: { '48x48': string } } | null;
    timetracking?: {
      originalEstimateSeconds?: number;
      timeSpentSeconds?: number;
      remainingEstimateSeconds?: number;
    };
  };
};

function subtaskListContent({
  enrichedSubtasks,
  subtasks,
  onOpenIssue,
}: {
  enrichedSubtasks: SubtaskDisplayItem[] | undefined;
  subtasks: JiraIssueDetail['fields']['subtasks'];
  onOpenIssue: ((key: string) => void) | undefined;
}) {
  const displaySubtasks: SubtaskDisplayItem[] =
    enrichedSubtasks ?? (subtasks as SubtaskDisplayItem[] | undefined) ?? [];
  if (displaySubtasks.length === 0) return null;
  return (
    <>
      <ul className="space-y-1 density-compact:space-y-0.5 density-comfortable:space-y-2">
        {displaySubtasks.map((sub) => {
          const statusCat = sub.fields.status.statusCategory as { key?: string } | undefined;
          return (
            <li key={sub.id}>
              <RelatedIssueRow
                issueKey={sub.key}
                summary={sub.fields.summary}
                assignee={sub.fields.assignee}
                statusName={sub.fields.status.name}
                statusCategoryKey={statusCat?.key}
                timeBarIssues={timeBarIssues(sub, null, { isSubtask: true })}
                onClick={() => onOpenIssue?.(sub.key)}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function IssueDetailContent({
  issue,
  issueKey,
  jiraBaseUrl,
  comments: commentsProp,
  onOpenIssue,
  onAddSubtask,
  onAddEpicStory,
  epicStories,
  enrichedSubtasks,
  showSubtasksSkeleton,
  subtaskError,
  onSubtaskRetry,
  enrichedParent,
}: IssueDetailContentProps) {
  const { description, subtasks } = issue.fields;
  const parent = issue.fields.parent;
  // Parent row data: assignee only comes from the enriched fetch; summary/status
  // fall back to the base parent payload so the row renders before enrichment lands.
  const parentStatus = enrichedParent?.fields.status ?? parent?.fields.status;
  const parentAssignee = enrichedParent?.fields.assignee ?? null;
  // Comments now come from the parent's independent comments query (phase 75 split);
  // `issue.fields.comment` is no longer populated by the slimmed fetchIssueDetail.
  const comments = commentsProp ?? [];
  const { storyPointsFieldKey } = useSettingsStore();
  const queryClient = useQueryClient();
  const jiraBaseUrlFromStore = useAuthStore((s) => s.jiraBaseUrl);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);

  async function handleDeleteAttachment(attachment: JiraAttachment) {
    const token = await readSecret('jira-pat');
    await deleteAttachment(jiraBaseUrl, token, attachment.id);
    queryClient.invalidateQueries({
      queryKey: ['jira-issue-detail', issueKey, jiraBaseUrlFromStore],
    });
  }

  const isEpic = issue.fields.issuetype.name === 'Epic';
  const isSubtask = issue.fields.issuetype.subtask;

  // Build attachment filename → URL map for resolving !image.png! references
  const attachmentMap: AttachmentMap = {};
  for (const att of issue.fields.attachment ?? []) {
    attachmentMap[att.filename] = att.content;
  }

  const { assignee, reporter } = issue.fields;
  const initialUserMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (assignee) map[assignee.name] = assignee.displayName;
    if (reporter) {
      if (reporter.name) map[reporter.name] = reporter.displayName;
      map[reporter.displayName] = reporter.displayName;
    }
    for (const c of comments) {
      if (c.author?.displayName) {
        const authorObj = c.author as { displayName: string; name?: string };
        if (authorObj.name) map[authorObj.name] = authorObj.displayName;
        map[authorObj.displayName] = authorObj.displayName;
      }
    }
    return map;
  }, [assignee, reporter, comments]);

  const descriptionTexts = useMemo(() => [description], [description]);
  const userMap = useMentionUserMap(initialUserMap, descriptionTexts, jiraBaseUrl);

  return (
    <div className="space-y-6 density-compact:space-y-4 density-comfortable:space-y-8">
      {/* Description */}
      <section>
        <SectionHeader title="Description" />
        {description ? (
          <WikiRenderer wikiText={description} attachments={attachmentMap} users={userMap} />
        ) : (
          <p className="text-sm text-muted-foreground italic">No description</p>
        )}
      </section>

      {/* Attachments */}
      <AttachmentsSection
        attachments={issue.fields.attachment ?? []}
        issueKey={issueKey}
        jiraBaseUrl={jiraBaseUrl}
        onDelete={handleDeleteAttachment}
      />

      {/* Epic → progress charts + Stories list */}
      {isEpic && (
        <EpicProgressSection
          epicKey={issueKey}
          stories={epicStories}
          storyPointsFieldKey={storyPointsFieldKey}
          epicCreated={issue.fields.created}
          epicDueDate={issue.fields.duedate}
          onOpenIssue={onOpenIssue}
        />
      )}
      {isEpic && (
        <section>
          <SectionHeader
            title="Stories"
            count={epicStories && epicStories.length > 0 ? epicStories.length : undefined}
            actions={<EpicStoryCreateControl onAdd={() => onAddEpicStory?.(issueKey)} />}
          />
          {!epicStories && <p className="text-sm text-muted-foreground">Loading stories…</p>}
          {epicStories && epicStories.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No stories in this epic</p>
          )}
          {epicStories && epicStories.length > 0 && (
            <ul className="space-y-1 density-compact:space-y-0.5 density-comfortable:space-y-2">
              {epicStories.map((story) => {
                return (
                  <li key={story.key}>
                    <RelatedIssueRow
                      issueKey={story.key}
                      summary={story.fields.summary}
                      assignee={story.fields.assignee}
                      statusName={story.fields.status.name}
                      statusCategoryKey={story.fields.status.statusCategory?.key}
                      timeBarIssues={timeBarIssues(story)}
                      onClick={() => onOpenIssue?.(story.key)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Story/task → Subtasks list */}
      {!isEpic && !isSubtask && (
        <section>
          {/* N comes from the base `subtasks` field so the label does not shift when
              enrichment lands. */}
          <SectionHeader
            title="Subtasks"
            count={subtasks.length > 0 ? subtasks.length : undefined}
            actions={
              <SubtaskCreateControl
                onAdd={() => onAddSubtask?.(issueKey)}
                onBulk={() => setBulkCreateOpen(true)}
              />
            }
          />
          {subtasks.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No subtasks</p>
          )}
          {/* Subtask skeleton — shown while enrichment query is pending (200ms-gated).
              Guard on subtasks.length: the enrichment query is `enabled: false` for issues
              with no subtasks, so it reports `isPending` forever — without this guard the
              skeleton would render permanently on every subtask-less issue (CR-01 sibling). */}
          {subtasks.length > 0 && enrichedSubtasks === undefined && showSubtasksSkeleton && (
            <SubtasksSkeleton />
          )}
          {/* Subtask error — inline retry without blanking panel */}
          {subtaskError && onSubtaskRetry && (
            <div className="p-4">
              <ErrorState error={subtaskError} onRetry={onSubtaskRetry} viewName="subtasks" />
            </div>
          )}
          {/* Subtask list — use enriched data when available, fall back to base subtasks */}
          {subtaskListContent({ enrichedSubtasks, subtasks, onOpenIssue })}
          <BulkCreateSubtasksModal
            open={bulkCreateOpen}
            onClose={() => setBulkCreateOpen(false)}
            parentKey={issueKey}
            parentIssue={issue}
          />
        </section>
      )}

      {/* Subtask → Parent link — same relationships region, row style AND data
          (key, summary, assignee, status pill) as a Story's Subtasks section. */}
      {isSubtask && parent && (
        <section>
          <SectionHeader title="Parent" />
          <RelatedIssueRow
            issueKey={parent.key}
            summary={parent.fields.summary}
            assignee={parentAssignee}
            statusName={parentStatus?.name}
            statusCategoryKey={parentStatus?.statusCategory?.key}
            ariaLabel={`Open parent issue ${parent.key}`}
            buttonClassName="py-2 density-compact:py-1 density-comfortable:py-3"
            onClick={() => onOpenIssue?.(parent.key)}
          />
        </section>
      )}
    </div>
  );
}

export { relativeTime } from '@/lib/relative-time';
