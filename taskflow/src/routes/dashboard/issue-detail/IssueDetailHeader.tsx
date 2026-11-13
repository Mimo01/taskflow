import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronRight,
  ClipboardCopy,
  Copy,
  ExternalLink,
  Pencil,
  Pin,
  RefreshCw,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { openExternal } from '@/lib/openExternal';
import { cn } from '@/lib/utils';
import type { JiraIssueDetail } from '@/services/jira';
import { useAuthStore } from '@/stores/auth.store';
import type { EditInitialValues } from '../CreateEditIssueModal';
import { buildCloneInitialValues, buildEditInitialValues } from './issue-actions';
import { LogWorkPopover } from './LogWorkPopover';

/** Below an 860px header every action collapses to a square icon button (label kept as sr-only text + tooltip). */
const COLLAPSE_CLASS = 'gap-1.5 text-xs w-7 px-0 @[860px]:w-auto @[860px]:px-2.5';
/** `not-sr-only` resets white-space, so re-apply nowrap or labels wrap. */
const LABEL_CLASS = 'sr-only @[860px]:not-sr-only @[860px]:whitespace-nowrap';

export interface IssueDetailHeaderProps {
  issueKey: string;
  issue?: JiraIssueDetail;
  jiraBaseUrl: string;
  layout: 'page' | 'peek';
  /** True once the big in-content title has scrolled out of view. */
  compact: boolean;
  /** Peek only: parent of a subtask, shown as a breadcrumb link. */
  parent?: { key: string; summary: string; typeName?: string };
  onOpenIssue?: (key: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
  onEdit?: (initialValues: EditInitialValues) => void;
  onClone?: (initialValues: EditInitialValues) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  /** Extra trailing controls (peek: Open full page + Close). Rendered even while loading. */
  headerTrailing?: ReactNode;
}

/**
 * Fixed-height header shared by the full page and the peek: key / compact title on the left,
 * the main actions on the right. Height never changes (the compact title is mounted into the
 * same row), so scrolling never shifts the layout.
 */
export function IssueDetailHeader({
  issueKey,
  issue,
  jiraBaseUrl,
  layout,
  compact,
  parent,
  onOpenIssue,
  onRefresh,
  refreshing,
  isPinned,
  onTogglePin,
  onEdit,
  onClone,
  storyPointsFieldKey,
  epicLinkFieldKey,
  headerTrailing,
}: IssueDetailHeaderProps) {
  const queryClient = useQueryClient();
  const jiraBaseUrlFromStore = useAuthStore((s) => s.jiraBaseUrl);
  const peek = layout === 'peek';
  const jiraUrl = `${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`;

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
    // Only flash "Copied" once the write actually resolves: a rejected clipboard
    // (unavailable in the webview) must not show a false success.
    navigator.clipboard
      .writeText(jiraUrl)
      .then(() => {
        setCopiedLink(true);
        if (copiedLinkTimer.current) clearTimeout(copiedLinkTimer.current);
        copiedLinkTimer.current = setTimeout(() => {
          setCopiedLink(false);
          copiedLinkTimer.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard unavailable: leave the item in its idle state.
      });
  }

  // After logging work, invalidate the issue detail so TimeTrackingSummary updates.
  // The worklogs list itself is invalidated inside LogWorkPopover (jira-worklogs key).
  // Kept separate so only one refetch fires at a time (prevents the duplicate-entry race).
  function handleLogWorkSuccess() {
    queryClient.invalidateQueries({
      queryKey: ['jira-issue-detail', issueKey, jiraBaseUrlFromStore],
    });
  }

  return (
    <div
      className={cn(
        '@container flex h-12 shrink-0 items-center gap-3 border-b bg-(--detail-surface,var(--background))',
        peek ? 'px-4' : 'px-6',
      )}
    >
      {/* Left: parent link (peek), key while loading, compact "KEY title" once scrolled past */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {peek && parent && (
          <>
            <button
              type="button"
              onClick={() => onOpenIssue?.(parent.key)}
              title={parent.summary}
              aria-label={`Open parent issue ${parent.key}`}
              className="flex shrink-0 cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {parent.typeName && <IssueTypeIcon typeName={parent.typeName} />}
              {parent.key}
            </button>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        {!issue && (
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{issueKey}</span>
        )}
        {issue && compact && (
          <div className="flex min-w-0 items-center gap-2 animate-in fade-in-0">
            <IssueTypeIcon typeName={issue.fields.issuetype.name} />
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{issueKey}</span>
            {/* pr-0.5 guards the italic/overhang truncate-clip pitfall */}
            <span className="truncate pr-0.5 text-sm font-medium" title={issue.fields.summary}>
              {issue.fields.summary}
            </span>
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {issue && (
          <>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Refresh issue"
                title="Refresh issue"
                className={COLLAPSE_CLASS}
              >
                <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
                <span className={LABEL_CLASS}>Refresh</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTogglePin?.(issueKey)}
              aria-label={isPinned ? `Unpin issue ${issueKey}` : `Pin issue ${issueKey}`}
              title={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
              className={COLLAPSE_CLASS}
            >
              <Pin className={cn('size-3.5', isPinned && 'fill-current text-primary')} />
              <span className={LABEL_CLASS}>{isPinned ? 'Unpin' : 'Pin'}</span>
            </Button>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onEdit(buildEditInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey))
                }
                aria-label="Edit issue"
                title="Edit issue"
                className={COLLAPSE_CLASS}
              >
                <Pencil className="size-3.5" />
                <span className={LABEL_CLASS}>Edit</span>
              </Button>
            )}
            <LogWorkPopover
              issueKey={issueKey}
              jiraBaseUrl={jiraBaseUrl}
              onSuccess={handleLogWorkSuccess}
              triggerLabel="Log work"
              triggerClassName={COLLAPSE_CLASS}
              triggerLabelClassName={LABEL_CLASS}
            />
            {onClone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onClone(buildCloneInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey))
                }
                aria-label="Clone issue"
                title="Clone issue"
                className={COLLAPSE_CLASS}
              >
                <Copy className="size-3.5" />
                <span className={LABEL_CLASS}>Clone</span>
              </Button>
            )}
            {/* Open in Jira + Copy link as one joined segmented control.
                `LinkContextMenu`'s default trigger is `span.contents` (no box). */}
            <div className="inline-flex items-stretch">
              <LinkContextMenu href={jiraUrl}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openExternal(jiraUrl)}
                  aria-label="Open in Jira"
                  title="Open in Jira"
                  className={cn(COLLAPSE_CLASS, 'rounded-r-none border-r-0')}
                >
                  <ExternalLink className="size-3.5" />
                  <span className={LABEL_CLASS}>Open in Jira</span>
                </Button>
              </LinkContextMenu>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleCopyJiraLink}
                aria-label={copiedLink ? 'Copied Jira link' : 'Copy Jira link'}
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
          </>
        )}
        {headerTrailing && (
          <>
            {issue && <div aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />}
            {headerTrailing}
          </>
        )}
      </div>
    </div>
  );
}
