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

/*
 * Quiet toolbar (one @container breakpoint on the header, 860px):
 * - wide: Refresh, Pin, Edit, Clone | Open in Jira + Copy link as borderless ghost buttons in one
 *   soft rounded group, plus Log work as the single filled accent button;
 * - narrow: Edit | Open in Jira + Copy link as icons (label kept as sr-only text + tooltip),
 *   Refresh / Pin / Clone move into a ⋯ menu, Log work becomes an icon.
 */
/** Ghost button inside the toolbar group. */
const TOOL_CLASS =
  'h-7 gap-1.5 rounded-md px-2 text-xs font-normal text-muted-foreground hover:bg-background hover:text-foreground aria-expanded:bg-background aria-expanded:text-foreground dark:hover:bg-background/60';
/** Primary tool: square icon below 860px, labelled above. */
const PRIMARY_TOOL_CLASS = cn(TOOL_CLASS, 'w-7 px-0 @[860px]:w-auto @[860px]:px-2');
/** `not-sr-only` resets white-space, so re-apply nowrap or labels wrap. */
const LABEL_CLASS = 'sr-only @[860px]:not-sr-only @[860px]:whitespace-nowrap';
/** Secondary tool: inline only at 860px+, otherwise it lives in the ⋯ menu. */
const SECONDARY_TOOL_CLASS = cn(TOOL_CLASS, 'hidden @[860px]:inline-flex');
const TOOL_DIVIDER = <div aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-border" />;
const MENU_ITEM_CLASS = 'cursor-pointer text-xs';

export interface IssueDetailHeaderProps {
  issueKey: string;
  issue?: JiraIssueDetail;
  jiraBaseUrl: string;
  layout: 'page' | 'peek';
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
 * Sticky header shared by the full page and the peek. It looks the same at every scroll
 * position: a meta row (parent › type icon + key, toolbar, Log work, host controls) over the
 * title, clamped to two lines with the full summary as tooltip.
 */
export function IssueDetailHeader({
  issueKey,
  issue,
  jiraBaseUrl,
  layout,
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
        '@container shrink-0 border-b bg-(--detail-surface,var(--background))',
        peek ? 'px-4 py-2.5' : 'px-6 py-3',
      )}
    >
      <div className="flex h-8 items-center gap-3">
        {/* Left: parent link (subtasks) › type icon + key */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {parent && (
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
          {issue && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{issueKey}</span>
        </div>

        {/* Right: quiet toolbar + Log work accent + host controls (peek: Open full page, Close) */}
        <div className="flex shrink-0 items-center gap-2">
          {issue && (
            <>
              <div
                role="toolbar"
                aria-label="Issue actions"
                className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
              >
                {onRefresh && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label="Refresh issue"
                    title="Refresh issue"
                    className={SECONDARY_TOOL_CLASS}
                  >
                    <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
                    Refresh
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTogglePin?.(issueKey)}
                  aria-label={isPinned ? `Unpin issue ${issueKey}` : `Pin issue ${issueKey}`}
                  title={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
                  className={SECONDARY_TOOL_CLASS}
                >
                  <Pin className={cn('size-3.5', isPinned && 'fill-current text-primary')} />
                  {isPinned ? 'Unpin' : 'Pin'}
                </Button>
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onEdit(buildEditInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey))
                    }
                    aria-label="Edit issue"
                    title="Edit issue"
                    className={PRIMARY_TOOL_CLASS}
                  >
                    <Pencil className="size-3.5" />
                    <span className={LABEL_CLASS}>Edit</span>
                  </Button>
                )}
                {onClone && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onClone(buildCloneInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey))
                    }
                    aria-label="Clone issue"
                    title="Clone issue"
                    className={SECONDARY_TOOL_CLASS}
                  >
                    <Copy className="size-3.5" />
                    Clone
                  </Button>
                )}
                {TOOL_DIVIDER}
                {/* Open in Jira + Copy link stay side by side.
                    `LinkContextMenu`'s default trigger is `span.contents` (no box). */}
                <LinkContextMenu href={jiraUrl}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openExternal(jiraUrl)}
                    aria-label="Open in Jira"
                    title="Open in Jira"
                    className={PRIMARY_TOOL_CLASS}
                  >
                    <ExternalLink className="size-3.5" />
                    <span className={LABEL_CLASS}>Open in Jira</span>
                  </Button>
                </LinkContextMenu>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopyJiraLink}
                  aria-label={copiedLink ? 'Copied Jira link' : 'Copy Jira link'}
                  title={copiedLink ? 'Copied!' : 'Copy Jira link'}
                  className={cn(TOOL_CLASS, 'w-7 px-0')}
                >
                  {copiedLink ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <ClipboardCopy className="size-3.5" />
                  )}
                </Button>
                {/* Narrow only: the secondary tools hidden above. */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="More actions"
                        title="More actions"
                        className={cn(TOOL_CLASS, 'w-7 px-0 @[860px]:hidden')}
                      />
                    }
                  >
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onRefresh && (
                      <DropdownMenuItem
                        className={MENU_ITEM_CLASS}
                        disabled={refreshing}
                        onClick={onRefresh}
                      >
                        <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
                        Refresh
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className={MENU_ITEM_CLASS}
                      onClick={() => onTogglePin?.(issueKey)}
                    >
                      <Pin className={cn('size-3.5', isPinned && 'fill-current text-primary')} />
                      {isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
                    </DropdownMenuItem>
                    {onClone && (
                      <DropdownMenuItem
                        className={MENU_ITEM_CLASS}
                        onClick={() =>
                          onClone(
                            buildCloneInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey),
                          )
                        }
                      >
                        <Copy className="size-3.5" />
                        Clone
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <LogWorkPopover
                issueKey={issueKey}
                jiraBaseUrl={jiraBaseUrl}
                onSuccess={handleLogWorkSuccess}
                triggerLabel="Log work"
                triggerVariant="default"
                triggerClassName="gap-1.5 text-xs w-7 px-0 @[860px]:w-auto @[860px]:px-2.5"
                triggerLabelClassName={LABEL_CLASS}
              />
            </>
          )}
          {headerTrailing && (
            <>
              {issue && <div aria-hidden="true" className="h-4 w-px bg-border" />}
              {headerTrailing}
            </>
          )}
        </div>
      </div>

      {/* Title: same at every scroll position; two lines max, full summary as tooltip */}
      {issue && (
        <h2
          className={cn(
            'mt-1 line-clamp-2 font-semibold leading-snug',
            peek ? 'text-base' : 'text-lg',
          )}
          title={issue.fields.summary}
        >
          {issue.fields.summary}
        </h2>
      )}
    </div>
  );
}
