import { useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ArrowUpRight, Copy, ExternalLink, Pencil, Pin, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { ErrorState } from '@/components/ui/error-state';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type {
  JiraAttachment,
  JiraComment,
  JiraIssue,
  JiraIssueDetail,
  JiraIssueLink,
} from '@/services/jira';
import { deleteAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { EditInitialValues } from './CreateEditIssueModal';
import { AttachmentsSection } from './issue-detail/AttachmentsSection';
import { LogWorkPopover } from './issue-detail/LogWorkPopover';
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
  onEdit?: (initialValues: EditInitialValues) => void;
  onClone?: (initialValues: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  epicStories?: JiraIssue[];
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
  /** Enriched subtasks from independent query (undefined = pending, [] = empty/loaded) */
  enrichedSubtasks?: Array<{
    id: string;
    key: string;
    fields: {
      summary: string;
      status: { name: string; statusCategory?: { key: string } | unknown };
      assignee?: { displayName: string; name: string; avatarUrls?: { '48x48': string } } | null;
    };
  }>;
  /** Show subtasks skeleton (200ms-gated) */
  showSubtasksSkeleton?: boolean;
  /** Subtask enrichment query error */
  subtaskError?: Error | null;
  /** Retry callback for subtask enrichment */
  onSubtaskRetry?: () => void;
}

/** Shared subtask item shape — union of base (no assignee) and enriched (with assignee) */
type SubtaskDisplayItem = {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory?: { key: string } | unknown };
    assignee?: { displayName: string; name: string; avatarUrls?: { '48x48': string } } | null;
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
  if (displaySubtasks.length === 0) {
    if (enrichedSubtasks !== undefined) {
      return <p className="text-sm text-muted-foreground italic">No subtasks.</p>;
    }
    return null;
  }
  return (
    <>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        Subtasks ({displaySubtasks.length})
      </h3>
      <ul className="space-y-1">
        {displaySubtasks.map((sub) => {
          const statusCat = sub.fields.status.statusCategory as { key?: string } | undefined;
          return (
            <li key={sub.id}>
              <button
                type="button"
                onClick={() => onOpenIssue?.(sub.key)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-accent text-sm text-left cursor-pointer"
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0">{sub.key}</span>
                <span className="flex-1 truncate">{sub.fields.summary}</span>
                {sub.fields.assignee && (
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    title={sub.fields.assignee.displayName}
                  >
                    <CachedAvatar
                      url={sub.fields.assignee.avatarUrls?.['48x48']}
                      name={sub.fields.assignee.displayName}
                      size={20}
                    />
                    <span className="text-xs text-muted-foreground">
                      {sub.fields.assignee.displayName}
                    </span>
                  </div>
                )}
                <span className={statusPillClass(statusCat?.key)}>{sub.fields.status.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute');
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour');
  return rtf.format(-Math.floor(diffSecs / 86400), 'day');
}

export function IssueDetailContent({
  issue,
  issueKey,
  jiraBaseUrl,
  comments: commentsProp,
  onOpenIssue,
  onEdit,
  onClone,
  onAddSubtask,
  epicStories,
  isPinned,
  onTogglePin,
  enrichedSubtasks,
  showSubtasksSkeleton,
  subtaskError,
  onSubtaskRetry,
}: IssueDetailContentProps) {
  const { summary, description, subtasks } = issue.fields;
  // Comments now come from the parent's independent comments query (phase 75 split);
  // `issue.fields.comment` is no longer populated by the slimmed fetchIssueDetail.
  const comments = commentsProp ?? [];
  const { storyPointsFieldKey, epicLinkFieldKey } = useSettingsStore();
  const queryClient = useQueryClient();
  const jiraBaseUrlFromStore = useAuthStore((s) => s.jiraBaseUrl);

  async function handleDeleteAttachment(attachment: JiraAttachment) {
    const token = await readSecret('jira-pat');
    await deleteAttachment(jiraBaseUrl, token, attachment.id);
    queryClient.invalidateQueries({
      queryKey: ['jira-issue-detail', issueKey, jiraBaseUrlFromStore],
    });
  }

  // After logging work, invalidate the issue detail so TimeTrackingSummary updates.
  // The worklogs list itself is invalidated inside LogWorkPopover (jira-worklogs key).
  // These two invalidations are kept separate so that only one refetch fires at a time,
  // preventing a race condition that caused the new entry to appear twice in the timeline.
  function handleLogWorkSuccess() {
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

  const parent = issue.fields.parent;

  return (
    <div className="space-y-6">
      {/* Title (with optional parent breadcrumb above for subtasks — DETAIL-01) */}
      <div>
        {isSubtask && parent && (
          <button
            type="button"
            className="flex items-center gap-1 mb-1 cursor-pointer hover:underline"
            onClick={() => onOpenIssue?.(parent.key)}
          >
            <ArrowUpRight className="size-3 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">{parent.key}</span>
            <span className="text-sm text-muted-foreground">— {parent.fields.summary}</span>
          </button>
        )}
        <p className="text-xs font-mono text-muted-foreground mb-1">{issue.key}</p>
        <h2 className="text-xl font-semibold leading-snug">{summary}</h2>
      </div>

      {/* Description */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
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

      {/* Epic → Stories list */}
      {isEpic && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Stories{epicStories && epicStories.length > 0 ? ` (${epicStories.length})` : ''}
          </h3>
          {!epicStories && <p className="text-sm text-muted-foreground">Loading stories…</p>}
          {epicStories && epicStories.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No stories in this epic</p>
          )}
          {epicStories && epicStories.length > 0 && (
            <ul className="space-y-1">
              {epicStories.map((story) => (
                <li key={story.key}>
                  <button
                    type="button"
                    onClick={() => onOpenIssue?.(story.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left cursor-pointer"
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {story.key}
                    </span>
                    <span className="flex-1 truncate">{story.fields.summary}</span>
                    {story.fields.assignee && (
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        title={story.fields.assignee.displayName}
                      >
                        <CachedAvatar
                          url={story.fields.assignee.avatarUrls?.['48x48']}
                          name={story.fields.assignee.displayName}
                          size={20}
                        />
                        <span className="text-xs text-muted-foreground">
                          {story.fields.assignee.displayName}
                        </span>
                      </div>
                    )}
                    <span className={statusPillClass(story.fields.status.statusCategory?.key)}>
                      {story.fields.status.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Story/task → Subtasks list */}
      {!isEpic && !isSubtask && (
        <section>
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
          <button
            type="button"
            onClick={() => onAddSubtask?.(issueKey)}
            className="mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            Add subtask
          </button>
        </section>
      )}

      {/* Pin + Edit + Log Work + Open in Jira */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTogglePin?.(issueKey)}
          aria-label={isPinned ? `Unpin issue ${issueKey}` : `Pin issue ${issueKey}`}
          title={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
          className="gap-1.5 text-xs"
        >
          <Pin className={cn('size-3.5', isPinned && 'fill-current text-primary')} />
          {isPinned ? 'Unpin' : 'Pin'}
        </Button>
        <LogWorkPopover
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl}
          onSuccess={handleLogWorkSuccess}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onEdit?.({
              issueKey,
              summary: issue.fields.summary,
              description: issue.fields.description ?? '',
              assigneeName: issue.fields.assignee?.name ?? null,
              priority: issue.fields.priority?.name ?? null,
              storyPoints: (issue.fields[storyPointsFieldKey] as number) ?? null,
              epicLinkKey: (issue.fields[epicLinkFieldKey] as string) ?? null,
            })
          }
          className="gap-1.5 text-xs"
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onClone?.({
              issueKey: '',
              summary: `Clone - ${issue.fields.summary}`,
              description: issue.fields.description ?? '',
              assigneeName: issue.fields.assignee?.name ?? null,
              priority: issue.fields.priority?.name ?? null,
              storyPoints: (issue.fields[storyPointsFieldKey] as number) ?? null,
              epicLinkKey: (issue.fields[epicLinkFieldKey] as string) ?? null,
              linkRows: (issue.fields.issuelinks ?? []).map((link: JiraIssueLink) => ({
                id: crypto.randomUUID(),
                linkTypeId: link.type.id,
                issueKey: link.outwardIssue?.key ?? link.inwardIssue?.key ?? '',
              })),
            })
          }
          className="gap-1.5 text-xs"
          aria-label="Clone issue"
        >
          <Copy className="size-3.5" />
          Clone
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openUrl(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`).catch(() => {})
          }
          className="gap-1.5 text-xs"
        >
          <ExternalLink className="size-3.5" />
          Open in Jira
        </Button>
      </div>
    </div>
  );
}
