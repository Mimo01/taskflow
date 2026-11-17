/**
 * EditorTab — UAT surface for the wiki editor (Phase 98, D-10).
 *
 * Load a placeholder fixture, a blank doc or pasted wiki text, switch preset and width, and read
 * the engine verdicts (load kind, demoted blocks, save kind, emitted text) as rendered previews.
 * Everything lives in component state: the pasted text and the document are never stored.
 */
import { FileText } from 'lucide-react';
import { Profiler, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Switch } from '../../components/ui/switch';
import type {
  WikiEditorHost,
  WikiEditorPreset,
  WikiEditorVerdict,
} from '../../components/wiki-editor/types';
import { WikiEditorLazy } from '../../components/wiki-editor/WikiEditorLazy';
import type { JiraAttachment } from '../../services/jira';
import { useSettingsStore } from '../../stores/settings.store';
import { WikiRenderer } from '../dashboard/WikiRenderer';

const FIXTURES = import.meta.glob('../../lib/wiki/__fixtures__/**/*.wiki', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const PASTE_SAMPLES = import.meta.glob('../../components/wiki-editor/__fixtures__/paste/*.html', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;
const PASTE_PREFIX = '../../components/wiki-editor/__fixtures__/paste/';
const PASTE_OPTIONS = Object.keys(PASTE_SAMPLES).map((path) => {
  const label = path.slice(PASTE_PREFIX.length);
  return { value: path, label, keywords: [label] };
});

type UploadOutcome = 'succeed' | 'fail' | 'slow';

const PLACEHOLDER_ATTACHMENTS: JiraAttachment[] = [
  { id: 'dev-a', filename: 'diagram.png', content: '', mimeType: 'image/png', size: 1024 },
  { id: 'dev-b', filename: 'report.pdf', content: '', mimeType: 'application/pdf', size: 2048 },
];

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
  const [projectKey, setProjectKey] = useState('');
  const [staged, setStaged] = useState(false);
  const [outcome, setOutcome] = useState<UploadOutcome>('succeed');
  const [uploaded, setUploaded] = useState<JiraAttachment[]>([]);
  const [stagedFiles, setStagedFiles] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [captureArmed, setCaptureArmed] = useState(false);
  const [captured, setCaptured] = useState<{ html: string; plain: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const uploadCount = useRef(0);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const host = useMemo<WikiEditorHost>(
    () => ({
      projectKey: projectKey.trim() || 'DEMO',
      staged,
      userMap: { jdoe: 'Jane Doe' },
      attachments: [...PLACEHOLDER_ATTACHMENTS, ...uploaded].filter((a) => !removed.includes(a.id)),
      uploadFile: async (file: File) => {
        if (outcome === 'fail') throw new Error('Simulated upload failure');
        if (outcome === 'slow') await new Promise((r) => setTimeout(r, 3000));
        uploadCount.current += 1;
        const att: JiraAttachment = {
          id: `dev-${uploadCount.current}`,
          filename: file.name,
          mimeType: file.type,
          content: '',
          size: file.size,
        };
        setUploaded((u) => [...u, att]);
        return att;
      },
      stageFile: (file: File) => setStagedFiles((f) => [...f, file.name]),
      deleteAttachment: async (id: string) => {
        setRemoved((r) => [...r, id]);
      },
      onOpenIssue: (key: string) => setLastAction(`Open issue ${key}`),
    }),
    [projectKey, staged, outcome, uploaded, removed],
  );

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

  const armCapture = () => {
    setCaptureArmed(true);
    window.addEventListener(
      'paste',
      (e) => {
        setCaptured({
          html: e.clipboardData?.getData('text/html') ?? '',
          plain: e.clipboardData?.getData('text/plain') ?? '',
        });
        setCaptureArmed(false);
      },
      { capture: true, once: true },
    );
  };

  const pickSample = async (id: string) => {
    setSampleId(id);
    const loader = PASTE_SAMPLES[id];
    if (!loader || typeof ClipboardEvent === 'undefined') return;
    const html = await loader();
    const plain = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
    const target = areaRef.current?.querySelector<HTMLElement>('.ProseMirror');
    if (!target) return;
    target.focus();
    const dt = new DataTransfer();
    dt.setData('text/html', html);
    dt.setData('text/plain', plain);
    target.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
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
          <h2 className="text-base font-semibold">Host context</h2>
          <label htmlFor="editor-project-key" className="text-sm font-medium">
            Project key
          </label>
          <input
            id="editor-project-key"
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
            placeholder="DEMO"
            className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <span id="editor-staged-label" className="text-sm">
              Staged mode
            </span>
            <Switch
              checked={staged}
              onCheckedChange={setStaged}
              aria-labelledby="editor-staged-label"
            />
          </div>
          <span className="text-sm">Upload</span>
          <div className="flex flex-wrap gap-2">
            <SegButton active={outcome === 'succeed'} onClick={() => setOutcome('succeed')}>
              Succeed
            </SegButton>
            <SegButton active={outcome === 'fail'} onClick={() => setOutcome('fail')}>
              Fail
            </SegButton>
            <SegButton active={outcome === 'slow'} onClick={() => setOutcome('slow')}>
              Slow 3s
            </SegButton>
          </div>
          {stagedFiles.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Staged files</p>
              <ul>
                {stagedFiles.map((f, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: names may repeat
                  <li key={`${f}-${i}`}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {lastAction && <p className="text-xs text-muted-foreground">Last action: {lastAction}</p>}
        </div>
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <h2 className="text-base font-semibold">Paste sample</h2>
          <SearchableSelect
            value={sampleId}
            onValueChange={(v) => void pickSample(v)}
            options={PASTE_OPTIONS}
            placeholder="Pick a paste sample"
            searchPlaceholder="Search samples"
            aria-label="Paste sample"
          />
          <button
            type="button"
            onClick={armCapture}
            disabled={captureArmed}
            className="self-start rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-60"
          >
            {captureArmed ? 'Paste now...' : 'Capture next paste'}
          </button>
          <SegButton active={dialogOpen} onClick={() => setDialogOpen(true)}>
            Open in dialog
          </SegButton>
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
            <div ref={areaRef} className={width === 'narrow' ? 'w-[360px]' : 'w-full'}>
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
                  host={host}
                  maxHeightClass="max-h-[640px]"
                  aria-label="Wiki editor"
                />
              </Profiler>
            </div>
            {captured && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h2 className="text-base font-semibold">Captured paste</h2>
                {(['html', 'plain'] as const).map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {k === 'html' ? 'text/html' : 'text/plain'}
                    </span>
                    <textarea
                      readOnly
                      value={captured[k]}
                      rows={6}
                      aria-label={k === 'html' ? 'Captured text/html' : 'Captured text/plain'}
                      className="w-full rounded-md border border-border bg-transparent p-2 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(captured[k])}
                      className="self-start rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
                    >
                      {k === 'html' ? 'Copy html' : 'Copy plain'}
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Replace names and text with placeholders before committing a fixture.
                </p>
              </div>
            )}
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle>Editor in a dialog</DialogTitle>
          <WikiEditorLazy
            value={text}
            onChange={setText}
            preset={preset}
            host={host}
            maxHeightClass="max-h-[400px]"
            aria-label="Wiki editor in dialog"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
