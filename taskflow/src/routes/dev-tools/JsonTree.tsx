/**
 * JsonTree: shared theme-aware JSON viewer for Developer Tools.
 *
 * Coloured, collapsible tree (default depth 2) with Expand all, Collapse all, a Raw / Tree toggle
 * and an in-body search that highlights matches (real <mark> elements, WKWebView does not paint
 * ::highlight reliably) and auto-expands their ancestors. Clicking a key copies its JSON path;
 * hovering a line reveals a copy button for that value (absolute overlay, no layout shift).
 *
 * Large payloads stay fast: children render only when expanded, arrays show ARRAY_PAGE items
 * then a "Show N more" row, and bodies over MAX_TREE_BYTES (or non-JSON text) fall back to a
 * capped plain <pre>.
 */
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { byteSize, safeStringify } from '@/lib/dev-tools/json-preview';
import {
  ARRAY_PAGE,
  collectContainerKeys,
  DEFAULT_EXPAND_DEPTH,
  findJsonMatches,
  formatJsonPath,
  type JsonPath,
  nodeSummary,
  type ParsedBody,
  parseJsonBody,
  pathKey,
} from '@/lib/dev-tools/json-tree';
import { cn } from '@/lib/utils';
import { SectionSegmented } from '../dashboard/issue-detail/SectionHeader';
import { JsonBlock } from './dev-tools-ui';
import { formatBytes } from './utils';

const TOKEN_CLASS = {
  key: 'text-sky-700 dark:text-sky-300',
  string: 'text-emerald-700 dark:text-emerald-300',
  number: 'text-violet-700 dark:text-violet-300',
  boolean: 'text-amber-700 dark:text-amber-300',
  null: 'text-muted-foreground',
  punctuation: 'text-muted-foreground',
} as const;

/** Long strings render capped; the copy button always copies the full value. */
const MAX_STRING_CHARS = 5000;

const MODE_OPTIONS = [
  { value: 'tree', label: 'Tree' },
  { value: 'raw', label: 'Raw' },
] as const;

type Mode = (typeof MODE_OPTIONS)[number]['value'];

interface TreeCtx {
  isOpen: (key: string, depth: number) => boolean;
  toggle: (key: string, depth: number) => void;
  pageOf: (key: string) => number;
  showMore: (key: string) => void;
  needle: string;
  copy: (text: string, message: string) => void;
}

const Ctx = createContext<TreeCtx | null>(null);

function useTree(): TreeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('JsonTree node rendered outside its provider');
  return ctx;
}

function Highlighted({ text, needle }: { text: string; needle: string }) {
  if (needle === '') return <>{text}</>;
  const lower = text.toLowerCase();
  const q = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let idx = lower.indexOf(q, from);
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx));
    parts.push(
      <mark key={idx} className="rounded-sm bg-yellow-300/60 text-inherit dark:bg-yellow-500/40">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    from = idx + q.length;
    idx = lower.indexOf(q, from);
  }
  if (from === 0) return <>{text}</>;
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

/** Hover-revealed copy button, absolutely positioned so it never shifts layout. */
function ValueCopy({ getText, message }: { getText: () => string; message: string }) {
  const { copy } = useTree();
  return (
    <button
      type="button"
      aria-label="Copy value"
      title="Copy value"
      onClick={() => copy(getText(), message)}
      className="absolute top-0 right-0 z-10 flex h-5 items-center rounded bg-background px-1 text-muted-foreground opacity-0 outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
    >
      <Copy className="size-3" />
    </button>
  );
}

function KeyLabel({ path, label }: { path: JsonPath; label: string | number | null }) {
  const { copy, needle } = useTree();
  if (label === null) return null;
  const isIndex = typeof label === 'number';
  return (
    <>
      <button
        type="button"
        title={`Copy path ${formatJsonPath(path)}`}
        onClick={() => copy(formatJsonPath(path), 'Copied path')}
        className={cn(
          'cursor-pointer rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring',
          isIndex ? TOKEN_CLASS.punctuation : TOKEN_CLASS.key,
        )}
      >
        {isIndex ? label : <Highlighted text={JSON.stringify(label)} needle={needle} />}
      </button>
      <span className={TOKEN_CLASS.punctuation}>: </span>
    </>
  );
}

function Primitive({ value }: { value: unknown }) {
  const { needle } = useTree();
  if (value === null) return <span className={TOKEN_CLASS.null}>null</span>;
  if (typeof value === 'string') {
    const inner = JSON.stringify(value).slice(1, -1);
    const shown =
      inner.length > MAX_STRING_CHARS
        ? `${inner.slice(0, MAX_STRING_CHARS)}… (${inner.length - MAX_STRING_CHARS} more chars)`
        : inner;
    return (
      <span className={cn(TOKEN_CLASS.string, 'break-words whitespace-pre-wrap')}>
        &quot;
        <Highlighted text={shown} needle={needle} />
        &quot;
      </span>
    );
  }
  if (typeof value === 'number') {
    return (
      <span className={TOKEN_CLASS.number}>
        <Highlighted text={String(value)} needle={needle} />
      </span>
    );
  }
  if (typeof value === 'boolean') {
    return (
      <span className={TOKEN_CLASS.boolean}>
        <Highlighted text={String(value)} needle={needle} />
      </span>
    );
  }
  return <span className={TOKEN_CLASS.punctuation}>{String(value)}</span>;
}

function Node({
  value,
  path,
  depth,
  label,
  trailingComma,
}: {
  value: unknown;
  path: JsonPath;
  depth: number;
  label: string | number | null;
  trailingComma: boolean;
}) {
  const { isOpen, toggle, pageOf, showMore } = useTree();
  const comma = trailingComma ? <span className={TOKEN_CLASS.punctuation}>,</span> : null;

  if (typeof value !== 'object' || value === null) {
    return (
      <div className="group relative flex pr-6">
        <span className="w-4 shrink-0" />
        <span className="min-w-0">
          <KeyLabel path={path} label={label} />
          <Primitive value={value} />
          {comma}
        </span>
        <ValueCopy
          getText={() => (typeof value === 'string' ? value : String(value))}
          message="Copied value"
        />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: [string | number, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [i, v])
    : Object.entries(value as Record<string, unknown>);
  const [openBrace, closeBrace] = isArray ? ['[', ']'] : ['{', '}'];
  const key = pathKey(path);

  if (entries.length === 0) {
    return (
      <div className="group relative flex pr-6">
        <span className="w-4 shrink-0" />
        <span className="min-w-0">
          <KeyLabel path={path} label={label} />
          <span className={TOKEN_CLASS.punctuation}>
            {openBrace}
            {closeBrace}
          </span>
          {comma}
        </span>
      </div>
    );
  }

  const open = isOpen(key, depth);
  const shownCount = isArray ? Math.min(entries.length, pageOf(key)) : entries.length;
  const remaining = entries.length - shownCount;

  return (
    <div>
      <div className="group relative flex pr-6">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Toggle ${formatJsonPath(path)}`}
          onClick={() => toggle(key, depth)}
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <span className="min-w-0">
          <KeyLabel path={path} label={label} />
          <span className={TOKEN_CLASS.punctuation}>{openBrace}</span>
          {!open && (
            <>
              <span className="ml-1 text-muted-foreground">{nodeSummary(value)}</span>
              <span className={TOKEN_CLASS.punctuation}>{closeBrace}</span>
              {comma}
            </>
          )}
        </span>
        <ValueCopy getText={() => safeStringify(value)} message="Copied value" />
      </div>
      {open && (
        <>
          <div className="ml-[7px] border-l border-border/60 pl-3">
            {entries.slice(0, shownCount).map(([k, child], i) => (
              <Node
                key={String(k)}
                value={child}
                path={[...path, k]}
                depth={depth + 1}
                label={k}
                trailingComma={i < entries.length - 1}
              />
            ))}
            {remaining > 0 && (
              <div className="flex">
                <span className="w-4 shrink-0" />
                <button
                  type="button"
                  onClick={() => showMore(key)}
                  className="rounded-sm text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {`Show ${remaining} more`}
                </button>
              </div>
            )}
          </div>
          <div className="flex">
            <span className="w-4 shrink-0" />
            <span className={TOKEN_CLASS.punctuation}>
              {closeBrace}
              {comma}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function JsonTree({
  text,
  value,
  label,
  maxHeightClass,
}: {
  text?: string;
  value?: unknown;
  label?: string;
  maxHeightClass?: string;
}) {
  const parsed: ParsedBody = useMemo(
    () => (value !== undefined ? { kind: 'json', value } : parseJsonBody(text ?? '')),
    [text, value],
  );
  const [mode, setMode] = useState<Mode>('tree');
  const [search, setSearch] = useState('');
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [collapseAll, setCollapseAll] = useState(false);
  const [pages, setPages] = useState<ReadonlyMap<string, number>>(new Map());
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const needle = search.trim();
  const jsonValue = parsed.kind === 'json' ? parsed.value : undefined;

  const matches = useMemo(
    () =>
      parsed.kind === 'json' && needle !== ''
        ? findJsonMatches(parsed.value, needle)
        : { matches: new Set<string>(), expand: new Set<string>(), count: 0, capped: false },
    [parsed, needle],
  );

  const copy = useCallback((payload: string, message: string) => {
    const settle = (msg: string) => {
      setStatus(msg);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus(''), 1500);
    };
    try {
      navigator.clipboard.writeText(payload).then(
        () => settle(message),
        () => settle('Copy failed'),
      );
    } catch {
      settle('Copy failed');
    }
  }, []);

  const ctx: TreeCtx = {
    isOpen: (key, depth) => {
      if (needle !== '' && matches.expand.has(key)) return true;
      const override = overrides.get(key);
      if (override !== undefined) return override;
      return collapseAll ? false : depth < DEFAULT_EXPAND_DEPTH;
    },
    toggle: (key, depth) => {
      const next = new Map(overrides);
      next.set(key, !ctx.isOpen(key, depth));
      setOverrides(next);
    },
    pageOf: (key) => pages.get(key) ?? ARRAY_PAGE,
    showMore: (key) => {
      const next = new Map(pages);
      next.set(key, (pages.get(key) ?? ARRAY_PAGE) + ARRAY_PAGE);
      setPages(next);
    },
    needle,
    copy,
  };

  const expandAll = () => {
    const next = new Map<string, boolean>();
    for (const k of collectContainerKeys(jsonValue)) next.set(k, true);
    setOverrides(next);
    setCollapseAll(false);
  };
  const doCollapseAll = () => {
    setOverrides(new Map());
    setCollapseAll(true);
  };

  const rawText = text ?? (value !== undefined ? safeStringify(value) : '');
  const isTree = parsed.kind === 'json';
  const size = text !== undefined ? formatBytes(byteSize(text)) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {label && (
          <span className="text-xs font-medium text-foreground">
            {label}
            {size && <span className="ml-1.5 font-normal text-muted-foreground">{size}</span>}
          </span>
        )}
        {isTree && mode === 'tree' && (
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              aria-label="Search in body"
              className="h-6 w-32 text-xs"
            />
            {needle !== '' && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {matches.count === 0
                  ? 'No matches'
                  : `${matches.count}${matches.capped ? '+' : ''} ${matches.count === 1 ? 'match' : 'matches'}`}
              </span>
            )}
            <Button type="button" variant="ghost" size="xs" onClick={expandAll}>
              Expand all
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={doCollapseAll}>
              Collapse all
            </Button>
          </>
        )}
        {parsed.kind === 'text' && parsed.reason === 'too-large' && (
          <span className="text-xs text-muted-foreground">Large body: raw view</span>
        )}
        <span
          role="status"
          aria-live="polite"
          className="ml-auto text-xs text-muted-foreground empty:hidden"
        >
          {status}
        </span>
        {isTree && (
          <SectionSegmented
            label="View mode"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
        )}
      </div>

      <div
        className={cn(
          'min-w-0 overflow-x-auto font-mono text-xs leading-5 tabular-nums',
          maxHeightClass && `overflow-y-auto ${maxHeightClass}`,
        )}
      >
        {isTree && mode === 'tree' ? (
          <Ctx.Provider value={ctx}>
            <Node value={jsonValue} path={[]} depth={0} label={null} trailingComma={false} />
          </Ctx.Provider>
        ) : parsed.kind === 'text' && parsed.reason === 'empty' ? (
          <p className="text-muted-foreground">Empty</p>
        ) : (
          <JsonBlock text={rawText} />
        )}
      </div>
    </div>
  );
}
