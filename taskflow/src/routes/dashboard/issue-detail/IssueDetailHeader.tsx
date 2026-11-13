import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronRight,
  ClipboardCopy,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Pin,
  RefreshCw,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { openExternal } from '@/lib/openExternal';
import { cn } from '@/lib/utils';
import type { JiraIssueDetail } from '@/services/jira';
import { useAuthStore } from '@/stores/auth.store';
import type { EditInitialValues } from '../CreateEditIssueModal';
import { buildCloneInitialValues, buildEditInitialValues } from './issue-actions';
import { LogWorkPopover } from './LogWorkPopover';

/** Peek only: below a 520px header the labelled actions collapse to square icon buttons. */
const PEEK_COLLAPSE_CLASS = 'w-7 px-0 @[520px]:w-auto @[520px]:px-2.5';
const PEEK_LABEL_CLASS = 'sr-only @[520px]:not-sr-only @[520px]:whitespace-nowrap';

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
                size="icon-sm"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Refresh issue"
                title="Refresh issue"
              >
                <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onTogglePin?.(issueKey)}
              aria-label={isPinned ? `Unpin issue ${issueKey}` : `Pin issue ${issueKey}`}
              title={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
            >
              <Pin className={cn('size-3.5', isPinned && 'fill-current text-primary')} />
            </Button>
            {onEdit && (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  onEdit(buildEditInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey))
                }
                aria-label="Edit issue"
                title="Edit issue"
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            <LogWorkPopover
              issueKey={issueKey}
              jiraBaseUrl={jiraBaseUrl}
              onSuccess={handleLogWorkSuccess}
              triggerLabel="Log work"
              triggerClassName={peek ? PEEK_COLLAPSE_CLASS : undefined}
              triggerLabelClassName={peek ? PEEK_LABEL_CLASS : undefined}
            />
            {/* `LinkContextMenu`'s default trigger is `span.contents` (no box). */}
            <LinkContextMenu href={jiraUrl}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openExternal(jiraUrl)}
                aria-label="Open in Jira"
                title="Open in Jira"
                className={cn('gap-1.5 text-xs', peek && PEEK_COLLAPSE_CLASS)}
              >
                <ExternalLink className="size-3.5" />
                <span className={peek ? PEEK_LABEL_CLASS : undefined}>Open in Jira</span>
              </Button>
            </LinkContextMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="More actions"
                    title="More actions"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onClone && (
                  <DropdownMenuItem
                    className="cursor-pointer text-xs"
                    aria-label="Clone issue"
                    onClick={() =>
                      onClone(buildCloneInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey))
                    }
                  >
                    <Copy className="size-3.5" />
                    Clone
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="cursor-pointer text-xs"
                  aria-label="Copy Jira link"
                  closeOnClick={false}
                  onClick={handleCopyJiraLink}
                >
                  {copiedLink ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <ClipboardCopy className="size-3.5" />
                  )}
                  {copiedLink ? 'Copied' : 'Copy Jira link'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
