/**
 * Small shared pieces for the Developer Tools tabs: toolbar search, copy button, inspector
 * sections, key/value table, capped JSON block, one-line list rows and list keyboard navigation.
 */
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
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

/** Copies on click. The clipboard call is synchronous in the handler (user gesture in WKWebView). */
export function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
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
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={() => {
        try {
          navigator.clipboard.writeText(getText()).then(
            () => settle('copied'),
            () => settle('failed'),
          );
        } catch {
          settle('failed');
        }
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </Button>
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

/**
 * One-line list row. The overlay button is a sibling of the content (never a parent of other
 * interactive elements) and carries the test id.
 */
export function ListRow({
  selected,
  onSelect,
  label,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex h-7 items-center gap-3 px-6 text-xs hover:bg-accent/50',
        selected && 'bg-accent',
      )}
    >
      <button
        type="button"
        data-testid="devtools-row"
        aria-label={label}
        aria-pressed={selected}
        onClick={onSelect}
        className="absolute inset-0 z-0 cursor-default outline-none"
      />
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-3">
        {children}
      </div>
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
      const rows = e.currentTarget.querySelectorAll('[data-testid="devtools-row"]');
      rows[next]?.scrollIntoView?.({ block: 'nearest' });
    },
    [ids, selectedId, setSelectedId],
  );
}
