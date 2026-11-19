/**
 * Small shared pieces for the Developer Tools tabs: toolbar search, copy button, inspector
 * sections, key/value table, capped JSON block, one-line list rows and list keyboard navigation.
 */
import { ChevronDown } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { capText } from '@/lib/dev-tools/json-preview';
import { cn } from '@/lib/utils';

export function ToolbarSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-7 w-56 text-xs"
    />
  );
}

export type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Clipboard write with transient feedback. `copy` calls navigator.clipboard.writeText
 * synchronously inside the event handler (user gesture in WKWebView); the state resets after 1.5 s.
 */
export function useCopyFeedback(): { state: CopyState; copy: (text: string) => void } {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const settle = (next: 'copied' | 'failed') => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1500);
  };
  const copy = (text: string) => {
    try {
      navigator.clipboard.writeText(text).then(
        () => settle('copied'),
        () => settle('failed'),
      );
    } catch {
      settle('failed');
    }
  };
  return { state, copy };
}

/** Copies on click. */
export function CopyButton({
  label,
  getText,
  disabled,
}: {
  label: string;
  getText: () => string;
  disabled?: boolean;
}) {
  const { state, copy } = useCopyFeedback();
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={disabled}
      onClick={() => copy(getText())}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </Button>
  );
}

export interface CopyMenuItem {
  label: string;
  getText: () => string;
  disabled?: boolean;
}

/** Outline "Copy" menu button; each item copies `getText()` and the trigger shows the feedback. */
export function CopyMenu({ items, label = 'Copy' }: { items: CopyMenuItem[]; label?: string }) {
  const { state, copy } = useCopyFeedback();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="xs" />}>
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            onClick={() => copy(item.getText())}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b px-4 py-3">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function KeyValueTable({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">None</p>;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ text }: { text: string }) {
  const capped = capText(text);
  return (
    <div>
      <pre className="overflow-auto font-mono text-xs whitespace-pre">{capped.text}</pre>
      {capped.truncated && (
        <p className="mt-1 text-xs text-muted-foreground">
          {`Showing first 200 KB of ${Math.round(capped.totalBytes / 1000)} KB. Use the copy button for the full text.`}
        </p>
      )}
    </div>
  );
}

/** Roving tab stop: the selected row, or the first row when nothing (visible) is selected. */
export function isTabStop(ids: string[], selectedId: string | null, id: string): boolean {
  return selectedId !== null && ids.includes(selectedId) ? id === selectedId : id === ids[0];
}

/**
 * One-line list row. The overlay button is a sibling of the content (never a parent of other
 * interactive elements) and carries the test id. `actions` is a hover-revealed overlay at the
 * right edge (absolute, so it never shifts the row layout).
 */
export function ListRow({
  selected,
  onSelect,
  label,
  title,
  actions,
  tabStop = true,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  title?: string;
  actions?: ReactNode;
  /** Roving tabindex: only one row of a list is a tab stop. */
  tabStop?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'group relative flex h-7 items-center gap-3 px-6 text-xs hover:bg-accent/50',
        selected && 'bg-accent shadow-[inset_2px_0_0_var(--primary)]',
      )}
    >
      <button
        type="button"
        data-testid="devtools-row"
        aria-label={label}
        aria-current={selected ? 'true' : undefined}
        title={title}
        tabIndex={tabStop ? 0 : -1}
        onClick={onSelect}
        className="absolute inset-0 z-0 cursor-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-3">
        {children}
      </div>
      {actions && (
        <div className="absolute inset-y-0 right-0 z-20 flex items-center bg-accent pr-3 pl-2 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}

/** ArrowUp/ArrowDown move the selection within `ids`; Escape clears it. */
export function useListKeyboard(
  ids: string[],
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
) {
  return useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (ids.length === 0) return;
      e.preventDefault();
      const idx = selectedId === null ? -1 : ids.indexOf(selectedId);
      const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, idx + 1) : Math.max(0, idx - 1);
      const nextId = ids[next];
      setSelectedId(nextId);
      const rows = e.currentTarget.querySelectorAll<HTMLElement>('[data-testid="devtools-row"]');
      rows[next]?.focus?.();
      rows[next]?.scrollIntoView?.({ block: 'nearest' });
    },
    [ids, selectedId, setSelectedId],
  );
}
