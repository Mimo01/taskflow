import { useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Copy, ExternalLink, Pencil, Pin, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { statusCategoryBadgeClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraAttachment, JiraIssue, JiraIssueDetail, JiraIssueLink } from '@/services/jira';
import { deleteAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { useSettingsStore } from '@/stores/settings.store';
import type { EditInitialValues } from './CreateEditIssueModal';
import { AttachmentsSection } from './issue-detail/AttachmentsSection';
import { LogWorkPopover } from './issue-detail/LogWorkPopover';
import type { AttachmentMap, UserMap } from './WikiRenderer';
import { WikiRenderer } from './WikiRenderer';

function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface IssueDetailContentProps {
  issue: JiraIssueDetail;
  issueKey: string;
  jiraBaseUrl: string;
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
  onOpenIssue,
  onEdit,
  onClone,
  onAddSubtask,
  epicStories,
  isPinned,
  onTogglePin,
}: IssueDetailContentProps) {
  const { summary, description, subtasks } = issue.fields;
  const comments = issue.fields.comment?.comments ?? [];
  const { storyPointsFieldKey, epicLinkFieldKey } = useSettingsStore();
  const queryClient = useQueryClient();

  async function handleDeleteAttachment(attachment: JiraAttachment) {
    const token = await readSecret('jira-pat');
    await deleteAttachment(jiraBaseUrl, token, attachment.id);
    queryClient.invalidateQueries({ queryKey: ['issue-detail', issueKey] });
  }
  const isEpic = issue.fields.issuetype.name === 'Epic';
  const isSubtask = issue.fields.issuetype.subtask;

  // Build attachment filename → URL map for resolving !image.png! references
  const attachmentMap = useMemo<AttachmentMap>(() => {
    const map: AttachmentMap = {};
    for (const att of issue.fields.attachment ?? []) {
      map[att.filename] = att.content;
    }
    return map;
  }, [issue.fields.attachment]);

  // Build user lookup map from available issue data (assignee, reporter, comment authors)
  const userMap = useMemo<UserMap>(() => {
    const map: UserMap = {};
    const { assignee, reporter } = issue.fields;
    if (assignee) {
      map[assignee.name] = assignee.displayName;
    }
    if (reporter) {
      if (reporter.name) map[reporter.name] = reporter.displayName;
      map[reporter.displayName] = reporter.displayName;
    }
    for (const c of comments) {
      if (c.author?.displayName) {
        // Comment author may have name field in some Jira versions
        const authorObj = c.author as { displayName: string; name?: string };
        if (authorObj.name) map[authorObj.name] = authorObj.displayName;
        map[authorObj.displayName] = authorObj.displayName;
      }
    }
    return map;
  }, [issue.fields.assignee, issue.fields.reporter, comments, issue.fields]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
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
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left"
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
                        <div className="relative h-5 w-5 shrink-0">
                          {story.fields.assignee.avatarUrls?.['48x48'] && (
                            <img
                              src={story.fields.assignee.avatarUrls['48x48']}
                              alt={story.fields.assignee.displayName}
                              className="h-5 w-5 rounded-full"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const sib = e.currentTarget
                                  .nextElementSibling as HTMLElement | null;
                                if (sib) sib.style.display = 'flex';
                              }}
                            />
                          )}
                          <div
                            className="h-5 w-5 rounded-full bg-primary text-primary-foreground items-center justify-center text-[10px] font-medium"
                            style={{
                              display: story.fields.assignee.avatarUrls?.['48x48']
                                ? 'none'
                                : 'flex',
                            }}
                          >
                            {getInitials(story.fields.assignee.displayName)}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {story.fields.assignee.displayName}
                        </span>
                      </div>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                        statusCategoryBadgeClass(story.fields.status.statusCategory?.key),
                      )}
                    >
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
          {subtasks && subtasks.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Subtasks ({subtasks.length})
              </h3>
              <ul className="space-y-1">
                {subtasks.map((sub) => (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onClick={() => onOpenIssue?.(sub.key)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left"
                    >
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {sub.key}
                      </span>
                      <span className="flex-1 truncate">{sub.fields.summary}</span>
                      {sub.fields.assignee && (
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          title={sub.fields.assignee.displayName}
                        >
                          <div className="relative h-5 w-5 shrink-0">
                            {sub.fields.assignee.avatarUrls?.['48x48'] && (
                              <img
                                src={sub.fields.assignee.avatarUrls['48x48']}
                                alt={sub.fields.assignee.displayName}
                                className="h-5 w-5 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const sib = e.currentTarget
                                    .nextElementSibling as HTMLElement | null;
                                  if (sib) sib.style.display = 'flex';
                                }}
                              />
                            )}
                            <div
                              className="h-5 w-5 rounded-full bg-primary text-primary-foreground items-center justify-center text-[10px] font-medium"
                              style={{
                                display: sub.fields.assignee.avatarUrls?.['48x48']
                                  ? 'none'
                                  : 'flex',
                              }}
                            >
                              {getInitials(sub.fields.assignee.displayName)}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {sub.fields.assignee.displayName}
                          </span>
                        </div>
                      )}
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                          statusCategoryBadgeClass(sub.fields.status.statusCategory?.key),
                        )}
                      >
                        {sub.fields.status.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={() => onAddSubtask?.(issueKey)}
            className="mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
        <LogWorkPopover issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />
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
