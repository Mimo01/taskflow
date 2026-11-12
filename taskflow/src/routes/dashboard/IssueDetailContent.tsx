import { useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardCopy, Copy, ExternalLink, Pencil, Pin, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import { openExternal } from '@/lib/openExternal';
import { timeBarIssues } from '@/lib/time-bar';
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
import { EpicProgressSection } from './issue-detail/EpicProgressSection';
import { LogWorkPopover } from './issue-detail/LogWorkPopover';
import { RelatedIssueRow } from './issue-detail/RelatedIssueRow';
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
  onEdit?: (initialValues: EditInitialValues) => void;
  onClone?: (initialValues: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  epicStories?: JiraIssue[];
  /** Tailwind text-size class for the summary title. Defaults to text-xl (peek sheet); the full page passes text-2xl. */
  titleClassName?: string;
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
  /** Refetch the issue and all its sections; renders the Refresh button when set. */
  onRefresh?: () => void;
  /** True while a refresh is in flight (spins and disables the button). */
  refreshing?: boolean;
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
  titleClassName,
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
  onRefresh,
  refreshing,
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
    <div className="space-y-6 density-compact:space-y-4 density-comfortable:space-y-8">
      {/* Title (the subtask parent link now lives in the Fields/sidebar block) */}
      <div>
        <p className="text-xs font-mono text-muted-foreground mb-1">{issue.key}</p>
        <h2 className={cn(titleClassName ?? 'text-xl', 'font-semibold leading-snug')}>{summary}</h2>
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
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Stories{epicStories && epicStories.length > 0 ? ` (${epicStories.length})` : ''}
          </h3>
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
          {/* Header row: fixed height so it is identical with or without subtasks. N comes from
              the base `subtasks` field so the label does not shift when enrichment lands. */}
          <div className="flex h-7 items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Subtasks{subtasks.length > 0 ? ` (${subtasks.length})` : ''}
            </h3>
            <SubtaskCreateControl
              onAdd={() => onAddSubtask?.(issueKey)}
              onBulk={() => setBulkCreateOpen(true)}
            />
          </div>
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
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Parent</h3>
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

      {/* Refresh + Pin + Edit + Log Work + Open in Jira + Copy Jira link.
          The row is its own @container: below 600px of row width the secondary
          actions collapse to square icon buttons (label kept as sr-only text +
          tooltip); Open in Jira always keeps its full label. */}
      <div className="@container flex items-center justify-end gap-2">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh issue"
            title="Refresh issue"
            className={cn('gap-1.5 text-xs', COMPACT_ACTION_CLASS)}
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            <span className={COMPACT_LABEL_CLASS}>Refresh</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTogglePin?.(issueKey)}
          aria-label={isPinned ? `Unpin issue ${issueKey}` : `Pin issue ${issueKey}`}
          title={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
          className={cn('gap-1.5 text-xs', COMPACT_ACTION_CLASS)}
        >
          <Pin className={cn('size-3.5', isPinned && 'fill-current text-primary')} />
          <span className={COMPACT_LABEL_CLASS}>{isPinned ? 'Unpin' : 'Pin'}</span>
        </Button>
        <LogWorkPopover
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl}
          onSuccess={handleLogWorkSuccess}
          triggerClassName={COMPACT_ACTION_CLASS}
          triggerLabelClassName={COMPACT_LABEL_CLASS}
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
              assigneeDisplayName: issue.fields.assignee?.displayName ?? null,
              assigneeAvatarUrl: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
              priority: issue.fields.priority?.name ?? null,
              storyPoints: (issue.fields[storyPointsFieldKey] as number) ?? null,
              epicLinkKey: (issue.fields[epicLinkFieldKey] as string) ?? null,
              customFields,
              attachments: issue.fields.attachment ?? [],
            });
          }}
          title="Edit issue"
          className={cn('gap-1.5 text-xs', COMPACT_ACTION_CLASS)}
        >
          <Pencil className="size-3.5" />
          <span className={COMPACT_LABEL_CLASS}>Edit</span>
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
              assigneeDisplayName: issue.fields.assignee?.displayName ?? null,
              assigneeAvatarUrl: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
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
          className={cn('gap-1.5 text-xs', COMPACT_ACTION_CLASS)}
          aria-label="Clone issue"
          title="Clone issue"
        >
          <Copy className="size-3.5" />
          <span className={COMPACT_LABEL_CLASS}>Clone</span>
        </Button>
        <div className="inline-flex items-stretch">
          {/* `LinkContextMenu`'s default trigger is `span.contents` (no box), so this
              wrap does not disturb the joined-border segmented-control layout below. */}
          <LinkContextMenu href={`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExternal(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`)}
              className="gap-1.5 rounded-r-none border-r-0 text-xs"
            >
              <ExternalLink className="size-3.5" />
              Open in Jira
            </Button>
          </LinkContextMenu>
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

/** Secondary action buttons: square icon-only (size-7, like `icon-sm`) below a 600px row, full `sm` above. */
const COMPACT_ACTION_CLASS = 'w-7 px-0 @[600px]:w-auto @[600px]:px-2.5';
/** Action label: screen-reader-only below a 600px row (accessible name kept), visible above. */
const COMPACT_LABEL_CLASS = 'sr-only @[600px]:not-sr-only';

export { relativeTime } from '@/lib/relative-time';
