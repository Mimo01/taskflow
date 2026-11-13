import { useQueryClient } from '@tanstack/react-query';
import { Clock, Copy, Maximize2, Pencil, Pin, RefreshCw } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DETAIL_HEADER_CLASSES,
  DetailHeader,
  HeaderMenuItem,
  HeaderMenuSeparator,
  type HeaderNav,
  HeaderTool,
  useDetailHeader,
} from '@/components/ui/detail-header';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { cn } from '@/lib/utils';
import type { JiraIssueDetail } from '@/services/jira';
import { useAuthStore } from '@/stores/auth.store';
import type { EditInitialValues } from '../CreateEditIssueModal';
import { buildCloneInitialValues, buildEditInitialValues } from './issue-actions';
import { LogWorkPopover } from './LogWorkPopover';

export type { HeaderNav, HeaderNavEntry } from '@/components/ui/detail-header';

const { PRIMARY_TOOL_CLASS, LABEL_CLASS } = DETAIL_HEADER_CLASSES;
const CRUMB_CLASS =
  'cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline';

export interface IssueDetailHeaderProps {
  issueKey: string;
  issue?: JiraIssueDetail;
  jiraBaseUrl: string;
  layout: 'page' | 'peek';
  /** Content is scrolled: same header, condensed (one-line smaller title, tighter padding). */
  compact?: boolean;
  /** Parent of a subtask: a crumb before the key (key always, title where the row has room). */
  parent?: { key: string; summary: string; typeName?: string };
  /** Full page: back button + navigation trail at the start of the meta row. */
  nav?: HeaderNav;
  onOpenIssue?: (key: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
  onEdit?: (initialValues: EditInitialValues) => void;
  onClone?: (initialValues: EditInitialValues) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  /** Peek: "Open full page". Always a labelled button, at every width. */
  onOpenFullPage?: () => void;
  /** Extra trailing controls (peek: Close). Rendered even while loading; never collapsed. */
  headerTrailing?: ReactNode;
}

/** Log work popover as a toolbar tool; anchors to the ⋯ trigger when the header is tiny. */
function LogWorkTool({
  issueKey,
  jiraBaseUrl,
  onSuccess,
  open,
  onOpenChange,
}: {
  issueKey: string;
  jiraBaseUrl: string;
  onSuccess: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { tiny, moreTriggerEl } = useDetailHeader();
  return (
    <LogWorkPopover
      issueKey={issueKey}
      jiraBaseUrl={jiraBaseUrl}
      onSuccess={onSuccess}
      triggerLabel="Log work"
      triggerVariant="ghost"
      triggerClassName={PRIMARY_TOOL_CLASS}
      triggerLabelClassName={LABEL_CLASS}
      open={open}
      onOpenChange={onOpenChange}
      hideTrigger={tiny}
      anchor={tiny ? moreTriggerEl : undefined}
    />
  );
}

/**
 * Sticky header shared by the full page and the peek. It looks the same at every scroll
 * position: a meta row (parent › type icon + key, toolbar, Log work, host controls) over the
 * title, clamped to two lines with the full summary as tooltip. Composes the shared DetailHeader.
 */
export function IssueDetailHeader({
  issueKey,
  issue,
  jiraBaseUrl,
  layout,
  compact = false,
  parent,
  nav,
  onOpenIssue,
  onRefresh,
  refreshing,
  isPinned,
  onTogglePin,
  onEdit,
  onClone,
  storyPointsFieldKey,
  epicLinkFieldKey,
  onOpenFullPage,
  headerTrailing,
}: IssueDetailHeaderProps) {
  const queryClient = useQueryClient();
  const jiraBaseUrlFromStore = useAuthStore((s) => s.jiraBaseUrl);
  const jiraUrl = `${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`;

  // Log work opened from the ⋯ menu (tiny): positioned against the ⋯ trigger.
  const [logWorkOpen, setLogWorkOpen] = useState(false);

  // A trail ending at the parent is shown once, as the parent crumb (which then walks the
  // trail back instead of pushing a new entry).
  const trail = nav?.trail ?? [];
  const parentInTrail = !!parent && trail[trail.length - 1]?.label === parent.key;
  function openParent() {
    if (!parent) return;
    if (parentInTrail && nav) nav.onNavigate(trail.length - 1);
    else onOpenIssue?.(parent.key);
  }

  // After logging work, invalidate the issue detail so TimeTrackingSummary updates.
  // The worklogs list itself is invalidated inside LogWorkPopover (jira-worklogs key).
  // Kept separate so only one refetch fires at a time (prevents the duplicate-entry race).
  function handleLogWorkSuccess() {
    queryClient.invalidateQueries({
      queryKey: ['jira-issue-detail', issueKey, jiraBaseUrlFromStore],
    });
  }

  function handleEdit() {
    if (issue && onEdit) {
      onEdit(buildEditInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey));
    }
  }

  function handleClone() {
    if (issue && onClone) {
      onClone(buildCloneInitialValues(issue, storyPointsFieldKey, epicLinkFieldKey));
    }
  }

  const parentCrumb = parent ? (
    /* One link for the parent: icon + key + title (title from 760px). The title shrinks
       first; below 760px the key may shrink down to the icon. */
    <button
      type="button"
      onClick={openParent}
      title={`${parent.key} ${parent.summary}`}
      aria-label={`Open parent issue ${parent.key}`}
      className={cn(
        CRUMB_CLASS,
        'flex min-w-3.5 shrink-[200] items-center gap-1.5 overflow-hidden @[760px]:min-w-auto',
      )}
    >
      {parent.typeName && <IssueTypeIcon typeName={parent.typeName} />}
      <span className="min-w-0 truncate font-mono @[760px]:shrink-0">{parent.key}</span>
      <span className="hidden min-w-16 max-w-48 truncate pr-0.5 @[760px]:block @[1200px]:max-w-80">
        {parent.summary}
      </span>
    </button>
  ) : undefined;

  return (
    <DetailHeader
      layout={layout}
      compact={compact}
      nav={nav}
      trimTrail={parentInTrail ? 1 : 0}
      crumbTail={parentCrumb}
      identity={
        <>
          {issue && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
          <span className="shrink-0 font-mono text-xs text-foreground/80">{issueKey}</span>
        </>
      }
      ready={!!issue}
      title={issue?.fields.summary}
      toolbarLabel="Issue actions"
      tools={
        <>
          {onRefresh && (
            <HeaderTool
              tier="secondary"
              icon={RefreshCw}
              spin={refreshing}
              label="Refresh"
              aria-label="Refresh issue"
              title="Refresh issue"
              onClick={onRefresh}
              disabled={refreshing}
            />
          )}
          <HeaderTool
            tier="secondary"
            icon={Pin}
            iconClassName={isPinned ? 'fill-current text-primary' : undefined}
            label={isPinned ? 'Unpin' : 'Pin'}
            aria-label={isPinned ? `Unpin issue ${issueKey}` : `Pin issue ${issueKey}`}
            title={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
            onClick={() => onTogglePin?.(issueKey)}
          />
          {onEdit && (
            <HeaderTool
              tier="primary"
              icon={Pencil}
              label="Edit"
              aria-label="Edit issue"
              title="Edit issue"
              onClick={handleEdit}
            />
          )}
          {onClone && (
            <HeaderTool
              tier="secondary"
              icon={Copy}
              label="Clone"
              aria-label="Clone issue"
              title="Clone issue"
              onClick={handleClone}
            />
          )}
          <LogWorkTool
            issueKey={issueKey}
            jiraBaseUrl={jiraBaseUrl}
            onSuccess={handleLogWorkSuccess}
            open={logWorkOpen}
            onOpenChange={setLogWorkOpen}
          />
        </>
      }
      /* Groups (user-chosen order): Jira · Refresh, Pin, Log work · Edit, Clone.
         Below 720px (tiny) the menu holds every action; otherwise only the ones
         hidden inline below 860px (Refresh, Pin · Clone). */
      menu={({ tiny }) => (
        <>
          {onRefresh && (
            <HeaderMenuItem
              icon={RefreshCw}
              spin={refreshing}
              label="Refresh"
              disabled={refreshing}
              onClick={onRefresh}
            />
          )}
          <HeaderMenuItem
            icon={Pin}
            iconClassName={isPinned ? 'fill-current text-primary' : undefined}
            label={isPinned ? 'Unpin from tabs' : 'Pin to tabs'}
            onClick={() => onTogglePin?.(issueKey)}
          />
          {tiny && (
            <HeaderMenuItem icon={Clock} label="Log work" onClick={() => setLogWorkOpen(true)} />
          )}
          {((tiny && onEdit) || onClone) && <HeaderMenuSeparator />}
          {tiny && onEdit && <HeaderMenuItem icon={Pencil} label="Edit" onClick={handleEdit} />}
          {onClone && <HeaderMenuItem icon={Copy} label="Clone" onClick={handleClone} />}
        </>
      )}
      primary={{
        href: jiraUrl,
        openLabel: 'Open in Jira',
        copyLabel: 'Copy Jira link',
        copiedLabel: 'Copied Jira link',
      }}
      trailing={
        headerTrailing || onOpenFullPage ? (
          <>
            {/* Always a labelled button, at every width (it never moves into ⋯). */}
            {onOpenFullPage && (
              <Button
                variant="outline"
                size="sm"
                aria-label="Open full page"
                title="Open full page"
                onClick={onOpenFullPage}
                className="gap-1.5 whitespace-nowrap text-xs"
              >
                <Maximize2 className="size-3.5" />
                Open full page
              </Button>
            )}
            {headerTrailing}
          </>
        ) : undefined
      }
    />
  );
}
