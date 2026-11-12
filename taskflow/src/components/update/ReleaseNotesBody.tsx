/**
 * ReleaseNotesBody — the single renderer for release notes, shared by the
 * Update available modal, the What's new modal and Settings → Updates.
 *
 * Parses markdown into headline + grouped titles (see lib/release-notes/parse).
 * Titles show by default; clicking a bullet reveals its detail. Anything that
 * does not parse into bullets falls back to plain markdown.
 */

import { ChevronRight } from 'lucide-react';
import { type ComponentPropsWithoutRef, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openExternal } from '@/lib/openExternal';
import {
  type NoteItem,
  type NoteKind,
  type NoteSection,
  parseReleaseNotes,
} from '@/lib/release-notes/parse';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<NoteKind, string | null> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
  removed: 'Removed',
  security: 'Security',
  other: null,
};

/** Fixed sections longer than this collapse into one "N fixes" row. */
const FIXED_COLLAPSE_OVER = 3;

const INLINE_ELEMENTS = ['strong', 'em', 'code', 'del', 'a'];

type AnchorProps = ComponentPropsWithoutRef<'a'> & { node?: unknown };

const LINK_COMPONENTS = {
  a: ({ href, children, node: _node, ...rest }: AnchorProps) => {
    // Remote release bodies: only http(s) links may reach the OS opener.
    if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>;
    return (
      <a
        href={href}
        {...rest}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openExternal(href);
        }}
        className="underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
};

// Inside a button a nested anchor would be invalid interactive nesting.
const NO_LINK_COMPONENTS = {
  a: ({ children }: AnchorProps) => <span>{children}</span>,
};

function InlineMarkdown({ text, links = true }: { text: string; links?: boolean }) {
  return (
    <ReactMarkdown
      allowedElements={INLINE_ELEMENTS}
      unwrapDisallowed
      components={links ? LINK_COMPONENTS : NO_LINK_COMPONENTS}
    >
      {text}
    </ReactMarkdown>
  );
}

const PROSE_CLASS =
  'prose prose-sm dark:prose-invert max-w-none [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4 [&_li]:my-0 [&_p]:my-1';

function plainText(s: string): string {
  return s.replace(/\*\*|`/g, '');
}

function matches(item: NoteItem, needle: string | undefined): boolean {
  if (!needle) return false;
  return item.raw.toLowerCase().includes(needle.toLowerCase());
}

function ItemRow({
  item,
  highlight,
  nested = false,
}: {
  item: NoteItem;
  highlight?: string;
  nested?: boolean;
}) {
  const expandable = item.detail !== null || item.children.length > 0;
  const detailMatch =
    !!highlight &&
    (item.detail?.toLowerCase().includes(highlight.toLowerCase()) ||
      item.children.some((c) => matches(c, highlight)));
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? !!detailMatch;
  const hit = matches(item, highlight);

  const titleEl = (
    <span className="min-w-0 flex-1 truncate" title={plainText(item.title)}>
      <InlineMarkdown text={item.title} links={false} />
    </span>
  );

  return (
    <li className={cn('list-none', nested && 'pl-3')}>
      {expandable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setToggled(!open)}
          className={cn(
            'group flex w-full items-center gap-2 rounded-sm py-0.5 text-left text-sm',
            hit && 'bg-primary/10',
          )}
        >
          {titleEl}
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100',
              open && 'rotate-90',
            )}
          />
        </button>
      ) : (
        <div
          className={cn(
            'flex w-full items-center gap-2 rounded-sm py-0.5 text-sm',
            hit && 'bg-primary/10',
          )}
        >
          {titleEl}
        </div>
      )}
      {expandable && open && (
        <div className="pb-1 pl-3 text-xs text-muted-foreground">
          {item.detail && (
            <p className="my-0.5">
              <InlineMarkdown text={item.detail} />
            </p>
          )}
          {item.children.length > 0 && (
            <ul className="m-0 p-0">
              {item.children.map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
                <ItemRow key={`${c.raw}-${i}`} item={c} highlight={highlight} nested />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Inline-details item (Settings history): one line per item, the title then its short
 * description in muted text on the same line. Inline bold is flattened so every line
 * reads the same; long legacy text truncates (full text on hover).
 */
function DetailItemRow({ item, nested = false }: { item: NoteItem; nested?: boolean }) {
  const title = plainText(item.title);
  const detail = item.detail ? plainText(item.detail) : null;
  return (
    <>
      <li
        className={cn('list-none truncate py-0.5 text-sm leading-5', nested && 'pl-3')}
        title={detail ? `${title} · ${detail}` : title}
      >
        {title}
        {detail && <span className="text-muted-foreground"> · {detail}</span>}
      </li>
      {item.children.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
        <DetailItemRow key={`${c.raw}-${i}`} item={c} nested />
      ))}
    </>
  );
}

function CollapsedFixes({ items, highlight }: { items: NoteItem[]; highlight?: string }) {
  const anyHit = !!highlight && items.some((i) => matches(i, highlight));
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? anyHit;
  return (
    <li className="list-none">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setToggled(!open)}
        className="group flex w-full items-center gap-2 rounded-sm py-0.5 text-left text-sm"
      >
        <span className="min-w-0 flex-1 truncate">{items.length} fixes</span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100',
            open && 'rotate-90',
          )}
        />
      </button>
      {open && (
        <ul className="m-0 p-0 pl-3">
          {items.map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
            <ItemRow key={`${it.raw}-${i}`} item={it} highlight={highlight} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Section({
  section,
  highlight,
  compact,
  details,
}: {
  section: NoteSection;
  highlight?: string;
  compact?: boolean;
  details?: boolean;
}) {
  const label = section.label ?? KIND_LABEL[section.kind];
  const collapse =
    !details && section.kind === 'fixed' && section.items.length > FIXED_COLLAPSE_OVER;
  if (details) {
    // Two columns that line up with the Settings history row grid:
    // section label under the version column, items under the summary column.
    return (
      <section className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3">
        <h4 className="m-0 py-0.5 text-xs leading-5 text-muted-foreground">{label}</h4>
        <ul className="m-0 flex min-w-0 flex-col p-0">
          {section.items.map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
            <DetailItemRow key={`${it.raw}-${i}`} item={it} />
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1')}>
      {label && (
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h4>
      )}
      <ul className="m-0 flex flex-col p-0">
        {collapse ? (
          <CollapsedFixes items={section.items} highlight={highlight} />
        ) : (
          section.items.map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
            <ItemRow key={`${it.raw}-${i}`} item={it} highlight={highlight} />
          ))
        )}
      </ul>
    </section>
  );
}

export interface ReleaseNotesBodyProps {
  notes: string | null | undefined;
  compact?: boolean;
  filterKinds?: NoteKind[];
  highlight?: string;
  /** One line per item: title · description (no per-bullet toggles). */
  details?: boolean;
  /** Omit the headline sentence (e.g. when the row already shows it). */
  hideHeadline?: boolean;
}

export function ReleaseNotesBody({
  notes,
  compact = false,
  filterKinds,
  highlight,
  details = false,
  hideHeadline = false,
}: ReleaseNotesBodyProps) {
  const parsed = useMemo(() => parseReleaseNotes(notes), [notes]);

  if (parsed.raw === '') {
    return <p className="text-sm text-muted-foreground">No release notes</p>;
  }

  if (!parsed.structured) {
    return (
      <div className={PROSE_CLASS}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.raw}</ReactMarkdown>
      </div>
    );
  }

  const sections = filterKinds
    ? parsed.sections.filter((s) => filterKinds.includes(s.kind))
    : parsed.sections;

  return (
    <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
      {parsed.headline && !hideHeadline && (
        <p className="m-0 text-sm font-medium">
          <InlineMarkdown text={parsed.headline} />
        </p>
      )}
      {sections.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
        <Section
          key={`${s.kind}-${i}`}
          section={s}
          highlight={highlight}
          compact={compact}
          details={details}
        />
      ))}
      {parsed.extra.length > 0 && (
        <div className={PROSE_CLASS}>
          {parsed.extra.map((p, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
            <ReactMarkdown key={`${i}-${p}`} remarkPlugins={[remarkGfm]}>
              {p}
            </ReactMarkdown>
          ))}
        </div>
      )}
    </div>
  );
}
