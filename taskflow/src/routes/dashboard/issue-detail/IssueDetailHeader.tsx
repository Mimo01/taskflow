import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Clock,
  Copy,
  ExternalLink,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Pin,
  RefreshCw,
} from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
 * - wide: Refresh, Pin, Edit, Clone, Log work as borderless ghost tools in one soft rounded group,
 *   plus Open in Jira + Copy link as the single filled accent (primary) pair;
 * - narrow: Edit and Log work collapse to icons (Open in Jira always keeps its label) (sr-only text +
 *   tooltip), Refresh / Pin / Clone move into a ⋯ menu.
 */
/** Ghost button inside the toolbar group. */
const TOOL_CLASS =
  'h-6 gap-1.5 rounded-md px-2 text-xs font-normal text-muted-foreground hover:bg-background hover:text-foreground aria-expanded:bg-background aria-expanded:text-foreground dark:hover:bg-background/60';
/** Primary tool: square icon below 860px, labelled above. */
const PRIMARY_TOOL_CLASS = cn(TOOL_CLASS, 'w-6 px-0 @[860px]:w-auto @[860px]:px-2');
/** `not-sr-only` resets white-space, so re-apply nowrap or labels wrap. */
const LABEL_CLASS = 'sr-only @[860px]:not-sr-only @[860px]:whitespace-nowrap';
/** Secondary tool: inline only at 860px+, otherwise it lives in the ⋯ menu. */
const SECONDARY_TOOL_CLASS = cn(TOOL_CLASS, 'hidden @[860px]:inline-flex');
const MENU_ITEM_CLASS = 'cursor-pointer text-xs';
/**
 * Below this header content width every issue action moves into the ⋯ menu so the key and
 * title get the row (only ⋯, Open full page and Close stay). 720: the in-between layout
 * (icon tools + labelled Open in Jira + Open full page ≈ 400px of buttons) left the title
 * only a few characters in typical peeks; ⋯-only needs ≈ 200px. Measured with a
 * ResizeObserver: the menu is portaled, so container queries can't decide its items.
 */
const TINY_WIDTH = 720;
/** Quiet nav crumb (trail entry / parent) in the meta row. */
const CRUMB_CLASS =
  'cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline';
const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/** One entry of the full page's navigation trail (where the user came from). */
export interface HeaderNavEntry {
  path: string;
  label: string;
}

/**
 * Full page only: the navigation trail merged into the header's meta row
 * (`← Backlog / PROJ-1 / [parent] / KEY`), replacing a separate breadcrumb bar.
 */
export interface HeaderNav {
  trail: HeaderNavEntry[];
  onBack: () => void;
  /** Navigate to trail entry `index` (the host trims the trail to before it). */
  onNavigate: (index: number) => void;
}

function CrumbSeparator() {
  return (
    <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground/50">
      /
    </span>
  );
}

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
  const peek = layout === 'peek';
  const jiraUrl = `${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`;

  // ─ Smallest width: only ⋯ (+ Close) ──────────────────────────────────────
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const [tiny, setTiny] = useState(false);
  useEffect(() => {
    if (!rootEl || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[entries.length - 1]?.contentRect.width;
      if (w) setTiny(w < TINY_WIDTH);
    });
    ro.observe(rootEl);
    return () => ro.disconnect();
  }, [rootEl]);
  // Log work opened from the ⋯ menu (tiny): positioned against the ⋯ trigger.
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  const [moreTriggerEl, setMoreTriggerEl] = useState<HTMLButtonElement | null>(null);

  // ─ Nav trail ────────────────────────────────────────────────────────────
  // A trail ending at the parent is shown once, as the parent crumb (which then walks the
  // trail back instead of pushing a new entry).
  const trail = nav?.trail ?? [];
  const parentInTrail = !!parent && trail[trail.length - 1]?.label === parent.key;
  const crumbs = parentInTrail ? trail.slice(0, -1) : trail;
  function openParent() {
    if (!parent) return;
    if (parentInTrail && nav) nav.onNavigate(trail.length - 1);
    else onOpenIssue?.(parent.key);
  }

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
      ref={setRootEl}
      className={cn(
        '@container shrink-0 border-b bg-(--detail-surface,var(--background)) transition-[padding] duration-250 ease-in-out',
        peek ? 'px-4' : 'px-6',
        compact ? 'py-1.5' : peek ? 'py-2.5' : 'py-3',
      )}
    >
      {/* z-10: the title below tucks 4px under this row (-mt-1) and must not take its clicks. */}
      <div className="relative z-10 flex h-7 items-center gap-3">
        {/* Left: ← trail / parent / type icon + key (+ the title, inline, when compact).
            Wide (1200px+): every trail entry; narrower: a single entry, or a … menu for longer
            trails. The parent's title shows from 760px and shrinks first; its key shrinks only below
            760px (down to its icon), and the current key never shrinks. */}
        {/* -ml-1.5 pl-1.5: widens the clip box so the back button's -ml-1.5 hover background
            (icon aligned to the gutter) is not cut in half by overflow-hidden. */}
        <div className="-ml-1.5 flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden pl-1.5">
          {nav && trail.length > 0 && (
            <button
              type="button"
              onClick={nav.onBack}
              aria-label="Go back"
              title="Go back"
              className="-ml-1.5 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          {nav && crumbs.length > 0 && (
            <>
              <span className="hidden @[1200px]:contents">
                {crumbs.map((entry, i) => (
                  <Fragment key={entry.path}>
                    {i > 0 && <CrumbSeparator />}
                    <button
                      type="button"
                      onClick={() => nav.onNavigate(i)}
                      className={cn(
                        CRUMB_CLASS,
                        'shrink-0 whitespace-nowrap',
                        ISSUE_KEY_RE.test(entry.label) && 'font-mono',
                      )}
                    >
                      {entry.label}
                    </button>
                  </Fragment>
                ))}
              </span>
              <span className="contents @[1200px]:hidden">
                {crumbs.length === 1 ? (
                  <button
                    type="button"
                    onClick={() => nav.onNavigate(0)}
                    className={cn(
                      CRUMB_CLASS,
                      'min-w-[2ch] truncate',
                      ISSUE_KEY_RE.test(crumbs[0].label) && 'font-mono',
                    )}
                  >
                    {crumbs[0].label}
                  </button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          aria-label="Show earlier pages"
                          title="Earlier pages"
                          className="inline-flex h-5 shrink-0 cursor-pointer items-center rounded px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
                        />
                      }
                    >
                      …
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {crumbs.map((entry, i) => (
                        <DropdownMenuItem
                          key={entry.path}
                          className={cn(
                            MENU_ITEM_CLASS,
                            ISSUE_KEY_RE.test(entry.label) && 'font-mono',
                          )}
                          onClick={() => nav.onNavigate(i)}
                        >
                          {entry.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </span>
            </>
          )}
          {parent && (
            <>
              {crumbs.length > 0 && <CrumbSeparator />}
              {/* One link for the parent: icon + key + title (title from 760px). The title shrinks
                  first; below 760px the key may shrink down to the icon. */}
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
            </>
          )}
          {(crumbs.length > 0 || parent) && <CrumbSeparator />}
          {issue && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
          <span className="shrink-0 font-mono text-xs text-foreground/80">{issueKey}</span>
          {issue && (
            /* Inline (compact) title: always mounted so it can fade + slide in as the big title
               below collapses. Decorative copy — the big <h2> stays the one accessible heading.
               pr-0.5 guards the italic/overhang truncate-clip pitfall. */
            <span
              aria-hidden="true"
              className={cn(
                'ml-0.5 min-w-0 flex-1 truncate pr-0.5 font-medium leading-tight',
                peek ? 'text-sm' : 'text-base',
                // Compact (680px+): claim at least 35% of the row so the parent title shrinks
                // smoothly to make room, instead of the inline title getting squeezed out.
                compact
                  ? 'translate-y-0 opacity-100 @[680px]:min-w-[35%] [transition:opacity_150ms_linear_75ms,transform_250ms_cubic-bezier(0.4,0,0.2,1),min-width_250ms_cubic-bezier(0.4,0,0.2,1)]'
                  : 'pointer-events-none translate-y-1 opacity-0 [transition:opacity_120ms_linear,transform_250ms_cubic-bezier(0.4,0,0.2,1),min-width_250ms_cubic-bezier(0.4,0,0.2,1)]',
              )}
              title={issue.fields.summary}
            >
              {issue.fields.summary}
            </span>
          )}
        </div>

        {/* Right: quiet toolbar + Open in Jira/Copy accent + host controls (peek: Open full page, Close) */}
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
                {onEdit && !tiny && (
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
                <LogWorkPopover
                  issueKey={issueKey}
                  jiraBaseUrl={jiraBaseUrl}
                  onSuccess={handleLogWorkSuccess}
                  triggerLabel="Log work"
                  triggerVariant="ghost"
                  triggerClassName={PRIMARY_TOOL_CLASS}
                  triggerLabelClassName={LABEL_CLASS}
                  open={logWorkOpen}
                  onOpenChange={setLogWorkOpen}
                  hideTrigger={tiny}
                  anchor={tiny ? moreTriggerEl : undefined}
                />
                {/* Narrow only: the secondary tools hidden above. */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        ref={setMoreTriggerEl}
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="More actions"
                        title="More actions"
                        className={cn(TOOL_CLASS, 'w-6 px-0 @[860px]:hidden')}
                      />
                    }
                  >
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {tiny && (
                      <>
                        <DropdownMenuItem
                          className={MENU_ITEM_CLASS}
                          onClick={() => openExternal(jiraUrl)}
                        >
                          <ExternalLink className="size-3.5" />
                          Open in Jira
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={MENU_ITEM_CLASS}
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
                        <DropdownMenuSeparator />
                        {onEdit && (
                          <DropdownMenuItem
                            className={MENU_ITEM_CLASS}
                            onClick={() =>
                              onEdit(
                                buildEditInitialValues(
                                  issue,
                                  storyPointsFieldKey,
                                  epicLinkFieldKey,
                                ),
                              )
                            }
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className={MENU_ITEM_CLASS}
                          onClick={() => setLogWorkOpen(true)}
                        >
                          <Clock className="size-3.5" />
                          Log work
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
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
              {/* Primary action: Open in Jira + Copy link, one filled accent segmented pair.
                  `LinkContextMenu`'s default trigger is `span.contents` (no box). */}
              {!tiny && (
                <div className="inline-flex items-stretch">
                  <LinkContextMenu href={jiraUrl}>
                    <Button
                      size="sm"
                      onClick={() => openExternal(jiraUrl)}
                      aria-label="Open in Jira"
                      title="Open in Jira"
                      className="gap-1.5 rounded-r-none px-2.5 text-xs"
                    >
                      <ExternalLink className="size-3.5" />
                      Open in Jira
                    </Button>
                  </LinkContextMenu>
                  <Button
                    size="icon-sm"
                    onClick={handleCopyJiraLink}
                    aria-label={copiedLink ? 'Copied Jira link' : 'Copy Jira link'}
                    title={copiedLink ? 'Copied!' : 'Copy Jira link'}
                    className="rounded-l-none border-l border-l-primary-foreground/20"
                  >
                    {copiedLink ? (
                      <Check className="size-3.5" />
                    ) : (
                      <ClipboardCopy className="size-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
          {(headerTrailing || onOpenFullPage) && (
            <>
              {issue && <div aria-hidden="true" className="h-4 w-px bg-border" />}
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
          )}
        </div>
      </div>

      {/* Big title: up to two lines below the key row at the top. On scroll it collapses smoothly
          (grid row 1fr → 0fr + fade) while the inline copy above slides in, so the compact header
          ends up a single slim row. Full summary as tooltip. */}
      {issue && (
        <div
          className={cn(
            // Staged crossfade: the big title fades out fast while its row collapses; on the way
            // back it fades in after a short delay. Overlap is kept small so no frame is title-less.
            'grid',
            compact
              ? 'mt-0 grid-rows-[0fr] opacity-0 [transition:grid-template-rows_250ms_cubic-bezier(0.4,0,0.2,1),margin_250ms_cubic-bezier(0.4,0,0.2,1),opacity_150ms_linear]'
              : '-mt-1 grid-rows-[1fr] opacity-100 [transition:grid-template-rows_250ms_cubic-bezier(0.4,0,0.2,1),margin_250ms_cubic-bezier(0.4,0,0.2,1),opacity_180ms_linear_30ms]',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <h2
              className={cn('line-clamp-2 font-medium leading-tight', peek ? 'text-lg' : 'text-xl')}
              title={issue.fields.summary}
            >
              {issue.fields.summary}
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}
