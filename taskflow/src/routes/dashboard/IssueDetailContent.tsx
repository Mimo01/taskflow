import { useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  Check,
  ClipboardCopy,
  Copy,
  ExternalLink,
  LayoutList,
  Pencil,
  Pin,
  Plus,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { BulkCreateSubtasksModal } from './BulkCreateSubtasksModal';
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
  if (diffSecs <= 0) return 'now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute');
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour');
  const YEAR_SECS = 365 * 86_400;
  if (diffSecs >= YEAR_SECS) {
    const years = Math.floor(diffSecs / YEAR_SECS);
    const remainingDays = Math.floor((diffSecs % YEAR_SECS) / 86_400);
    const yearLabel = years === 1 ? '1 year' : `${years} years`;
    return remainingDays === 0
      ? `${yearLabel} ago`
      : `${yearLabel} ${remainingDays} day${remainingDays === 1 ? '' : 's'} ago`;
  }
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
  enrichedParent,
}: IssueDetailContentProps) {
  const { summary, description, subtasks } = issue.fields;
  const parent = issue.fields.parent;
  // Parent row data: assignee only comes from the enriched fetch; summary/status
  // fall back to the base parent payload so the row renders before enrichment lands.
  const parentStatus = enrichedParent?.fields.status ?? parent?.fields.status;
  const parentAssignee = enrichedParent?.fields.assignee ?? null;
  // Comments now come from the parent's independent comments query (phase 75 split);
  // `issue.fields.comment` is no longer populated by the slimmed fetchIssueDetail.
  const comments = commentsProp ?? [];
  const { storyPointsFieldKey, epicLinkFieldKey } = useSettingsStore();
  const queryClient = useQueryClient();
  const jiraBaseUrlFromStore = useAuthStore((s) => s.jiraBaseUrl);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);

  // ─ Copy Jira link ───────────────────────────────────────────────────────
  const [copiedLink, setCopiedLink] = useState(false);
  const copiedLinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedLinkTimer.current) clearTimeout(copiedLinkTimer.current);
    },
    [],
  );

  function handleCopyJiraLink() {
    const url = `${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`;
    // Only flash "Copied!" once the write actually resolves — a rejected clipboard
    // (unavailable in the webview) must not show a false success.
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedLink(true);
        if (copiedLinkTimer.current) clearTimeout(copiedLinkTimer.current);
        copiedLinkTimer.current = setTimeout(() => {
          setCopiedLink(false);
          copiedLinkTimer.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard unavailable — leave the button in its idle state.
      });
  }

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

  return (
    <div className="space-y-6">
      {/* Title (the subtask parent link now lives in the Fields/sidebar block) */}
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
          <div className="mt-1 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="gap-1.5"
              onClick={() => onAddSubtask?.(issueKey)}
            >
              <Plus className="size-3.5" />
              Add subtask
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="gap-1.5"
              onClick={() => setBulkCreateOpen(true)}
            >
              <LayoutList className="size-3.5" />
              Bulk Create Subtasks
            </Button>
          </div>
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
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Parent</h3>
          <button
            type="button"
            aria-label={`Open parent issue ${parent.key}`}
            onClick={() => onOpenIssue?.(parent.key)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-accent text-sm text-left cursor-pointer"
          >
            <span className="font-mono text-xs text-muted-foreground shrink-0">{parent.key}</span>
            <span className="flex-1 truncate">{parent.fields.summary}</span>
            {parentAssignee && (
              <div
                className="flex items-center gap-1.5 shrink-0"
                title={parentAssignee.displayName}
              >
                <CachedAvatar
                  url={parentAssignee.avatarUrls?.['48x48']}
                  name={parentAssignee.displayName}
                  size={20}
                />
                <span className="text-xs text-muted-foreground">{parentAssignee.displayName}</span>
              </div>
            )}
            {parentStatus?.name && (
              <span className={statusPillClass(parentStatus.statusCategory?.key)}>
                {parentStatus.name}
              </span>
            )}
          </button>
        </section>
      )}

      {/* Pin + Edit + Log Work + Open in Jira + Copy Jira link */}
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
          onClick={() => {
            // Collect raw values for all customfield_* keys so the edit modal can
            // pre-fill required custom fields (e.g. Account) from the current issue.
            const customFields: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(issue.fields as Record<string, unknown>)) {
              if (k.startsWith('customfield_') && v != null) customFields[k] = v;
            }
            onEdit?.({
              issueKey,
              summary: issue.fields.summary,
              description: issue.fields.description ?? '',
              assigneeName: issue.fields.assignee?.name ?? null,
              priority: issue.fields.priority?.name ?? null,
              storyPoints: (issue.fields[storyPointsFieldKey] as number) ?? null,
              epicLinkKey: (issue.fields[epicLinkFieldKey] as string) ?? null,
              customFields,
            });
          }}
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
        <div className="inline-flex items-stretch">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openUrl(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`).catch(() => {})
            }
            className="gap-1.5 rounded-r-none border-r-0 text-xs"
          >
            <ExternalLink className="size-3.5" />
            Open in Jira
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleCopyJiraLink}
            aria-label="Copy Jira link"
            title={copiedLink ? 'Copied!' : 'Copy Jira link'}
            className="rounded-l-none"
          >
            {copiedLink ? (
              <Check className="size-3.5 text-primary" />
            ) : (
              <ClipboardCopy className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
