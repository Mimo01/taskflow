import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  ExternalLink,
  type LucideIcon,
  MoreHorizontal,
} from 'lucide-react';
import {
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { openExternal } from '@/lib/openExternal';
import { cn } from '@/lib/utils';

/*
 * Shared detail-page header (issue, release, merge request, AIO cycle, AIO run).
 *
 * Quiet toolbar (one @container breakpoint on the header, 860px):
 * - wide: secondary + primary tools as borderless ghost tools in one soft rounded group, plus a
 *   single filled primary pair (Open in X + Copy link) where the page has a web URL;
 * - narrow: primary tools collapse to icons (sr-only text + tooltip), secondary tools move
 *   into a ⋯ menu;
 * - tiny (< 720px header width): everything but `fixed` tools and `trailing` moves into ⋯.
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
 * Below this header content width every action moves into the ⋯ menu so the key and
 * title get the row. Measured with a ResizeObserver: the menu is portaled, so container
 * queries can't decide its items.
 */
const TINY_WIDTH = 720;
/** Quiet nav crumb (trail entry / parent) in the meta row. */
const CRUMB_CLASS =
  'cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline';
const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

export const DETAIL_HEADER_CLASSES = { TOOL_CLASS, PRIMARY_TOOL_CLASS, LABEL_CLASS };

/** One entry of the full page's navigation trail (where the user came from). */
export interface HeaderNavEntry {
  path: string;
  label: string;
}

/**
 * Full page only: the navigation trail merged into the header's meta row
 * (`← Backlog / PROJ-1 / KEY`), replacing a separate breadcrumb bar.
 */
export interface HeaderNav {
  trail: HeaderNavEntry[];
  onBack: () => void;
  /** Navigate to trail entry `index` (the host trims the trail to before it). */
  onNavigate: (index: number) => void;
}

interface DetailHeaderContextValue {
  tiny: boolean;
  moreTriggerEl: HTMLButtonElement | null;
}

const DetailHeaderContext = createContext<DetailHeaderContextValue>({
  tiny: false,
  moreTriggerEl: null,
});

/** Header measurements for tools that render their own chrome (e.g. an anchored popover). */
export function useDetailHeader(): DetailHeaderContextValue {
  return useContext(DetailHeaderContext);
}

function CrumbSeparator() {
  return (
    <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground/50">
      /
    </span>
  );
}

export interface HeaderToolProps {
  /** primary: icon below 860px, labelled above, hidden when tiny. secondary: inline at 860px+.
   *  fixed: inline at every width. */
  tier: 'primary' | 'secondary' | 'fixed';
  icon: LucideIcon;
  spin?: boolean;
  label?: ReactNode;
  'aria-label'?: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  iconClassName?: string;
  'data-testid'?: string;
}

/** A ghost tool inside the header's toolbar group. */
export function HeaderTool({
  tier,
  icon: Icon,
  spin,
  label,
  iconClassName,
  ...rest
}: HeaderToolProps) {
  const { tiny } = useDetailHeader();
  if (tier === 'primary' && tiny) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={rest['aria-label']}
      title={rest.title}
      onClick={rest.onClick}
      disabled={rest.disabled}
      data-testid={rest['data-testid']}
      className={
        tier === 'primary'
          ? PRIMARY_TOOL_CLASS
          : tier === 'secondary'
            ? SECONDARY_TOOL_CLASS
            : TOOL_CLASS
      }
    >
      <Icon className={cn('size-3.5', spin && 'animate-spin', iconClassName)} />
      {label != null && (tier === 'primary' ? <span className={LABEL_CLASS}>{label}</span> : label)}
    </Button>
  );
}

export interface HeaderMenuItemProps {
  icon: LucideIcon;
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Keep the menu open after the click (e.g. Copy link flash). */
  closeOnClick?: boolean;
  spin?: boolean;
  iconClassName?: string;
}

export function HeaderMenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  closeOnClick,
  spin,
  iconClassName,
}: HeaderMenuItemProps) {
  return (
    <DropdownMenuItem
      className={MENU_ITEM_CLASS}
      disabled={disabled}
      closeOnClick={closeOnClick}
      onClick={onClick}
    >
      <Icon className={cn('size-3.5', spin && 'animate-spin', iconClassName)} />
      {label}
    </DropdownMenuItem>
  );
}

export function HeaderMenuSeparator() {
  return <DropdownMenuSeparator />;
}

export interface DetailHeaderProps {
  /** `peek` is issue-only: tighter padding and smaller title. */
  layout?: 'page' | 'peek';
  /** Content is scrolled: same header, condensed (one slim row, title inline). */
  compact?: boolean;
  /** Full page: back button + navigation trail at the start of the meta row. */
  nav?: HeaderNav;
  /** The last N trail entries are not rendered as crumbs (the host shows them as `crumbTail`). */
  trimTrail?: number;
  /** Rendered once after the trail crumbs, before the identity (issue: parent; AIO run: cycle). */
  crumbTail?: ReactNode;
  /** Type icon / mono key / status pill: the current entry, never repeated in the trail. */
  identity: ReactNode;
  /** False while loading: no toolbar, primary pair, title. Default true. */
  ready?: boolean;
  /** Big title (2-line clamp), also shown inline when compact. */
  title?: string;
  titleAs?: 'h1' | 'h2';
  titleTestId?: string;
  /** Rendered in place of the heading while `title` is undefined and the header is ready. */
  titlePlaceholder?: ReactNode;
  /** Expanded-only content under the title; collapses together with it. */
  extra?: ReactNode;
  toolbarLabel?: string;
  /** `<HeaderTool>` children (or any toolbar content), inline order. */
  tools?: ReactNode;
  /** Content of the ⋯ menu; omit for no menu (unless there is a primary pair). */
  menu?: ReactNode | ((ctx: { tiny: boolean }) => ReactNode);
  /** Filled "Open in X" + "Copy link" pair; in ⋯ when tiny. */
  primary?: {
    href: string;
    openLabel: string;
    copyLabel: string;
    copiedLabel: string;
    menuCopyLabel?: string;
  };
  /** Never collapsed; preceded by a divider when ready. */
  trailing?: ReactNode;
  'data-testid'?: string;
}

/**
 * Sticky header shared by every detail page. A meta row (← trail / identity, toolbar, primary
 * pair, trailing controls) over the title, clamped to two lines with the full text as tooltip.
 */
export function DetailHeader({
  layout = 'page',
  compact = false,
  nav,
  trimTrail = 0,
  crumbTail,
  identity,
  ready = true,
  title,
  titleAs = 'h2',
  titleTestId,
  titlePlaceholder,
  extra,
  toolbarLabel,
  tools,
  menu,
  primary,
  trailing,
  'data-testid': testId,
}: DetailHeaderProps) {
  const peek = layout === 'peek';

  // ─ Smallest width: only ⋯ (+ trailing) ───────────────────────────────────
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
  const [moreTriggerEl, setMoreTriggerEl] = useState<HTMLButtonElement | null>(null);

  // ─ Nav trail ────────────────────────────────────────────────────────────
  const trail = nav?.trail ?? [];
  const crumbs = trimTrail > 0 ? trail.slice(0, trail.length - trimTrail) : trail;

  // ─ Copy link ────────────────────────────────────────────────────────────
  const [copiedLink, setCopiedLink] = useState(false);
  const copiedLinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedLinkTimer.current) clearTimeout(copiedLinkTimer.current);
    },
    [],
  );

  function handleCopyLink() {
    if (!primary) return;
    // Only flash "Copied" once the write actually resolves: a rejected clipboard
    // (unavailable in the webview) must not show a false success.
    navigator.clipboard
      .writeText(primary.href)
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

  const hasTitle = title !== undefined;
  const showHeading = ready && (hasTitle || !!titlePlaceholder);
  const showTitleBlock = showHeading || !!extra;
  const menuContent = typeof menu === 'function' ? menu({ tiny }) : menu;
  const hasMenu = menu !== undefined || !!primary;
  const HeadingTag = titleAs;

  return (
    <DetailHeaderContext.Provider value={{ tiny, moreTriggerEl }}>
      <div
        ref={setRootEl}
        data-testid={testId}
        className={cn(
          '@container shrink-0 border-b bg-(--detail-surface,var(--background)) transition-[padding] duration-250 ease-in-out',
          peek ? 'px-4' : 'px-6',
          compact ? 'py-1.5' : peek ? 'py-2.5' : 'py-3',
        )}
      >
        {/* z-10: the title below tucks 4px under this row (-mt-1) and must not take its clicks. */}
        <div className="relative z-10 flex h-7 items-center gap-3">
          {/* Left: ← trail / crumbTail / identity (+ the title, inline, when compact).
              Wide (1200px+): every trail entry; narrower: a single entry, or a … menu for longer
              trails. */}
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
            {crumbTail && (
              <>
                {crumbs.length > 0 && <CrumbSeparator />}
                {crumbTail}
              </>
            )}
            {(crumbs.length > 0 || !!crumbTail) && <CrumbSeparator />}
            {identity}
            {ready && hasTitle && (
              /* Inline (compact) title: always mounted so it can fade + slide in as the big title
                 below collapses. Decorative copy — the big heading stays the one accessible one.
                 pr-0.5 guards the italic/overhang truncate-clip pitfall. */
              <span
                aria-hidden="true"
                className={cn(
                  'ml-0.5 min-w-0 flex-1 truncate pr-0.5 font-medium leading-tight',
                  peek ? 'text-sm' : 'text-base',
                  // Compact (680px+): claim at least 35% of the row so the crumbs shrink
                  // smoothly to make room, instead of the inline title getting squeezed out.
                  compact
                    ? 'translate-y-0 opacity-100 @[680px]:min-w-[35%] [transition:opacity_150ms_linear_75ms,transform_250ms_cubic-bezier(0.4,0,0.2,1),min-width_250ms_cubic-bezier(0.4,0,0.2,1)]'
                    : 'pointer-events-none translate-y-1 opacity-0 [transition:opacity_120ms_linear,transform_250ms_cubic-bezier(0.4,0,0.2,1),min-width_250ms_cubic-bezier(0.4,0,0.2,1)]',
                )}
                title={title}
              >
                {title}
              </span>
            )}
          </div>

          {/* Right: quiet toolbar + primary accent pair + host controls */}
          <div className="flex shrink-0 items-center gap-2">
            {ready && (
              <>
                <div
                  role="toolbar"
                  aria-label={toolbarLabel}
                  className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
                >
                  {tools}
                  {/* Narrow only: the secondary tools hidden above. */}
                  {hasMenu && (
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
                      <DropdownMenuContent align="end" className="min-w-44">
                        {tiny && primary && (
                          <>
                            <DropdownMenuItem
                              className={MENU_ITEM_CLASS}
                              onClick={() => openExternal(primary.href)}
                            >
                              <ExternalLink className="size-3.5" />
                              {primary.openLabel}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={MENU_ITEM_CLASS}
                              closeOnClick={false}
                              onClick={handleCopyLink}
                            >
                              {copiedLink ? (
                                <Check className="size-3.5 text-primary" />
                              ) : (
                                <ClipboardCopy className="size-3.5" />
                              )}
                              {copiedLink ? 'Copied' : (primary.menuCopyLabel ?? primary.copyLabel)}
                            </DropdownMenuItem>
                            {menuContent != null && <DropdownMenuSeparator />}
                          </>
                        )}
                        {menuContent}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {/* Primary action: Open in X + Copy link, one filled accent segmented pair.
                    `LinkContextMenu`'s default trigger is `span.contents` (no box). */}
                {!tiny && primary && (
                  <div className="inline-flex items-stretch">
                    <LinkContextMenu href={primary.href}>
                      <Button
                        size="sm"
                        onClick={() => openExternal(primary.href)}
                        aria-label={primary.openLabel}
                        title={primary.openLabel}
                        className="gap-1.5 rounded-r-none px-2.5 text-xs"
                      >
                        <ExternalLink className="size-3.5" />
                        {primary.openLabel}
                      </Button>
                    </LinkContextMenu>
                    <Button
                      size="icon-sm"
                      onClick={handleCopyLink}
                      aria-label={copiedLink ? primary.copiedLabel : primary.copyLabel}
                      title={copiedLink ? 'Copied!' : primary.copyLabel}
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
            {trailing && (
              <>
                {ready && <div aria-hidden="true" className="h-4 w-px bg-border" />}
                {trailing}
              </>
            )}
          </div>
        </div>

        {/* Big title: up to two lines below the meta row at the top. On scroll it collapses
            smoothly (grid row 1fr → 0fr + fade) while the inline copy above slides in, so the
            compact header ends up a single slim row. `extra` collapses with it. */}
        {showTitleBlock && (
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
              {showHeading &&
                (hasTitle ? (
                  <HeadingTag
                    data-testid={titleTestId}
                    className={cn(
                      'line-clamp-2 font-medium leading-tight',
                      peek ? 'text-lg' : 'text-xl',
                    )}
                    title={title}
                  >
                    {title}
                  </HeadingTag>
                ) : (
                  titlePlaceholder
                ))}
              {extra}
            </div>
          </div>
        )}
      </div>
    </DetailHeaderContext.Provider>
  );
}
