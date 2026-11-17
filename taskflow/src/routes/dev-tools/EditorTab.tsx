/**
 * EditorTab — UAT surface for the wiki editor (Phase 98, D-10).
 *
 * Load a placeholder fixture, a blank doc or pasted wiki text, switch preset and width, and read
 * the engine verdicts (load kind, demoted blocks, save kind, emitted text) as rendered previews.
 * Everything lives in component state: the pasted text and the document are never stored.
 */
import { FileText } from 'lucide-react';
import { Profiler, useRef, useState } from 'react';
import { EmptyState } from '../../components/ui/empty-state';
import { SearchableSelect } from '../../components/ui/searchable-select';
import type { WikiEditorPreset, WikiEditorVerdict } from '../../components/wiki-editor/types';
import { WikiEditorLazy } from '../../components/wiki-editor/WikiEditorLazy';
import { useSettingsStore } from '../../stores/settings.store';
import { WikiRenderer } from '../dashboard/WikiRenderer';

const FIXTURES = import.meta.glob('../../lib/wiki/__fixtures__/**/*.wiki', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const FIXTURE_PREFIX = '../../lib/wiki/__fixtures__/';
const BLANK = '__blank__';

const FIXTURE_OPTIONS = Object.keys(FIXTURES).map((path) => {
  const label = path.slice(FIXTURE_PREFIX.length);
  return { value: path, label, keywords: [label] };
});

function pillClass(kind: string): string {
  const base = 'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold';
  if (kind === 'failed') return `${base} bg-red-500/15 text-red-600 dark:text-red-400`;
  if (kind === 'saved' || kind === 'rich-demoted')
    return `${base} border border-primary text-primary`;
  return `${base} bg-muted text-muted-foreground`;
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md border px-3 py-1 text-sm transition-colors ${
        active ? 'border-primary text-primary' : 'border-border hover:bg-accent'
      }`}
    >
      {children}
    </button>
  );
}

function VerdictPanel({
  verdict,
  commitsRef,
}: {
  verdict: WikiEditorVerdict;
  commitsRef: React.RefObject<HTMLElement | null>;
}) {
  const { load, save } = verdict;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="text-base font-semibold">Verdict</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Load</span>
        <span className={pillClass(load.kind)}>{load.kind}</span>
        {load.demoted.map((i) => (
          <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">
            {i}
          </span>
        ))}
        {load.reason && <span className="text-xs text-muted-foreground">{load.reason}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Save</span>
        {save ? (
          <>
            <span className={pillClass(save.kind)}>{save.kind}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {save.ms.toFixed(1)} ms
            </span>
            {save.reason && <span className="text-xs text-muted-foreground">{save.reason}</span>}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">no save yet</span>
        )}
      </div>
      {save?.text != null && (
        <div className="grid grid-cols-2 gap-4">
          <pre className="max-h-[240px] overflow-auto rounded-md border border-border p-2 font-mono text-xs whitespace-pre-wrap">
            {save.text}
          </pre>
          <div className="max-h-[240px] overflow-auto rounded-md border border-border p-2 text-sm">
            <WikiRenderer wikiText={save.text} />
          </div>
        </div>
      )}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>Created</dt>
          <dd className="tabular-nums text-foreground">{verdict.created}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Render commits</dt>
          <dd ref={commitsRef} className="tabular-nums text-foreground">
            0
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Mode</dt>
          <dd className="text-foreground">{verdict.mode}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Forced</dt>
          <dd className="text-foreground">{String(verdict.forced)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function EditorTab() {
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const [docKey, setDocKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [preset, setPreset] = useState<WikiEditorPreset>('full');
  const [width, setWidth] = useState<'narrow' | 'wide'>('wide');
  const [paste, setPaste] = useState('');
  const [verdict, setVerdict] = useState<WikiEditorVerdict | null>(null);
  // Profiler commits fire on every commit; state here would loop, so the counter writes to the DOM.
  const commitCount = useRef(0);
  const commitsRef = useRef<HTMLElement | null>(null);

  if (!devToolsEnabled) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Developer Tools are disabled. Toggle the master switch in Settings to start capturing data.
      </p>
    );
  }

  const mount = (next: string) => {
    setText(next);
    setVerdict(null);
    commitCount.current = 0;
    setLoaded(true);
    setDocKey((k) => k + 1);
  };

  const pick = async (id: string) => {
    setDocId(id);
    if (id === BLANK) {
      mount('');
      return;
    }
    const loader = FIXTURES[id];
    if (loader) mount(await loader());
  };

  return (
    <div className="flex gap-6 items-start">
      <div className="w-64 shrink-0 flex flex-col gap-4">
        <h2 className="text-base font-semibold">Document</h2>
        <SearchableSelect
          value={docId}
          onValueChange={(v) => void pick(v)}
          options={FIXTURE_OPTIONS}
          pinnedOption={{ value: BLANK, label: 'Blank doc', keywords: ['blank', 'empty'] }}
          placeholder="Pick a fixture"
          searchPlaceholder="Search fixtures"
          aria-label="Fixture"
        />
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <label htmlFor="editor-paste" className="text-sm font-medium">
            Paste wiki
          </label>
          <textarea
            id="editor-paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-border bg-transparent p-2 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">Local only. Never saved.</p>
          <button
            type="button"
            onClick={() => {
              setDocId(null);
              mount(paste);
            }}
            className="self-start rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
          >
            Load
          </button>
        </div>
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <h2 className="text-base font-semibold">Preset</h2>
          <div className="flex gap-2">
            <SegButton active={preset === 'full'} onClick={() => setPreset('full')}>
              Full
            </SegButton>
            <SegButton active={preset === 'compact'} onClick={() => setPreset('compact')}>
              Compact
            </SegButton>
          </div>
        </div>
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <h2 className="text-base font-semibold">Width</h2>
          <div className="flex gap-2">
            <SegButton active={width === 'narrow'} onClick={() => setWidth('narrow')}>
              Narrow (360px)
            </SegButton>
            <SegButton active={width === 'wide'} onClick={() => setWidth('wide')}>
              Wide (100%)
            </SegButton>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-4">
        {loaded ? (
          <>
            <div className={width === 'narrow' ? 'w-[360px]' : 'w-full'}>
              <Profiler
                id="wiki-editor"
                onRender={() => {
                  commitCount.current += 1;
                  if (commitsRef.current)
                    commitsRef.current.textContent = String(commitCount.current);
                }}
              >
                <WikiEditorLazy
                  key={docKey}
                  value={text}
                  onChange={setText}
                  preset={preset}
                  onVerdict={setVerdict}
                  maxHeightClass="max-h-[640px]"
                  aria-label="Wiki editor"
                />
              </Profiler>
            </div>
            {verdict && <VerdictPanel verdict={verdict} commitsRef={commitsRef} />}
          </>
        ) : (
          <EmptyState
            icon={FileText}
            title="No document loaded"
            subtitle="Pick a fixture or paste wiki text to start."
          />
        )}
      </div>
    </div>
  );
}
