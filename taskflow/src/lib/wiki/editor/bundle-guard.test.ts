import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Bundle-isolation guard (T-97-06): WikiRenderer is imported eagerly all over
 * the app, so its static import graph must never reach ProseMirror/TipTap or
 * the lib/wiki/editor module. Dynamic import() and type-only imports are fine.
 */

const SRC_ROOT = path.resolve(__dirname, '../../..');
const EDITOR_DIR = path.join(SRC_ROOT, 'lib/wiki/editor') + path.sep;
const EXTS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

function specifiersOf(source: string): string[] {
  const out: string[] = [];
  const patterns = [
    /^\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /^\s*export\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm,
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) if (m[1]) out.push(m[1]);
  return out;
}

function resolveFile(base: string): string | null {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** BFS over static imports. `chains` maps each reached file/bare specifier to its import chain. */
function collectStaticImports(
  entry: string,
  srcRoot: string,
): { files: string[]; bare: string[]; chains: Map<string, string[]> } {
  const files: string[] = [];
  const bare: string[] = [];
  const chains = new Map<string, string[]>();
  const seen = new Set<string>([entry]);
  const queue: string[] = [entry];
  chains.set(entry, [entry]);
  while (queue.length > 0) {
    const file = queue.shift() as string;
    files.push(file);
    const chain = chains.get(file) ?? [file];
    for (const spec of specifiersOf(fs.readFileSync(file, 'utf8'))) {
      let target: string | null = null;
      if (spec.startsWith('@/')) target = resolveFile(path.join(srcRoot, spec.slice(2)));
      else if (spec.startsWith('.')) target = resolveFile(path.resolve(path.dirname(file), spec));
      else {
        if (!bare.includes(spec)) {
          bare.push(spec);
          chains.set(spec, [...chain, spec]);
        }
        continue;
      }
      if (target && !seen.has(target)) {
        seen.add(target);
        chains.set(target, [...chain, target]);
        queue.push(target);
      }
    }
  }
  return { files, bare, chains };
}

const FORBIDDEN_BARE = /^(@tiptap\/|prosemirror)/;

/**
 * The only editor-chunk files an eager entry may reach: the lazy wrapper and the
 * types module. Everything else under components/wiki-editor/ must stay behind
 * a dynamic import().
 */
const ALLOWED_EDITOR_ENTRY_FILES = [
  'components/wiki-editor/WikiEditorLazy.tsx',
  'components/wiki-editor/types.ts',
].map((f) => path.join(SRC_ROOT, f));
const EDITOR_COMPONENTS_DIR = path.join(SRC_ROOT, 'components/wiki-editor') + path.sep;

function violations(
  result: ReturnType<typeof collectStaticImports>,
  opts: { allowEditorEntryFiles?: boolean } = {},
): string[] {
  const hits = [
    ...result.bare.filter((b) => FORBIDDEN_BARE.test(b)),
    ...result.files.filter((f) => f.startsWith(EDITOR_DIR)),
    ...(opts.allowEditorEntryFiles
      ? result.files.filter(
          (f) => f.startsWith(EDITOR_COMPONENTS_DIR) && !ALLOWED_EDITOR_ENTRY_FILES.includes(f),
        )
      : []),
  ];
  return hits.map((h) =>
    (result.chains.get(h) ?? [h]).map((c) => path.relative(SRC_ROOT, c)).join(' -> '),
  );
}

const tmpDirs: string[] = [];
function tmpGraph(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-guard-'));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files))
    fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('WikiRenderer bundle isolation', () => {
  const entry = path.join(SRC_ROOT, 'routes/dashboard/WikiRenderer.tsx');
  const result = collectStaticImports(entry, SRC_ROOT);

  it('walker follows the barrel to the pipeline', () => {
    expect(result.files.some((f) => f.endsWith('src/lib/wiki/pipeline.ts'))).toBe(true);
  });

  it('reaches no tiptap/prosemirror module and nothing under lib/wiki/editor', () => {
    expect(violations(result), violations(result).join('\n')).toEqual([]);
  });

  it('keeps the wiki barrel and equivalence module free of ./editor', () => {
    for (const f of ['index.ts', 'equivalence.ts']) {
      const text = fs.readFileSync(path.join(SRC_ROOT, 'lib/wiki', f), 'utf8');
      expect(/from\s+['"]\.\/editor/.test(text), f).toBe(false);
    }
  });
});

describe.each([
  'main.tsx',
  'routes/dev-tools/index.tsx',
  'routes/dev-tools/DevToolsPage.tsx',
])('eager entry %s bundle isolation', (rel) => {
  const entry = path.join(SRC_ROOT, rel);

  it('entry file exists', () => {
    expect(fs.existsSync(entry), rel).toBe(true);
  });

  it('reaches no tiptap/prosemirror, no lib/wiki/editor, and only the lazy wrapper/types of wiki-editor', () => {
    const result = collectStaticImports(entry, SRC_ROOT);
    const v = violations(result, { allowEditorEntryFiles: true });
    expect(v, v.join('\n')).toEqual([]);
  });
});

describe('lib/wiki/prose.ts bundle isolation', () => {
  it('reaches nothing under lib/wiki/editor or @tiptap/', () => {
    const entry = path.join(SRC_ROOT, 'lib/wiki/prose.ts');
    expect(fs.existsSync(entry)).toBe(true);
    const result = collectStaticImports(entry, SRC_ROOT);
    const v = violations(result);
    expect(v, v.join('\n')).toEqual([]);
  });
});

describe('collectStaticImports (mutation)', () => {
  it('reports a tiptap import reached through a relative chain', () => {
    const dir = tmpGraph({
      'a.ts': "import { x } from './b';\nexport const a = x;\n",
      'b.ts': "import { Node } from '@tiptap/core';\nexport const x = Node;\n",
    });
    const res = collectStaticImports(path.join(dir, 'a.ts'), dir);
    expect(res.bare).toContain('@tiptap/core');
    expect(res.chains.get('@tiptap/core')?.length).toBe(3);
  });

  it('reports a side-effect and a re-export import', () => {
    const dir = tmpGraph({
      'a.ts': "import 'prosemirror-model';\nexport * from './b';\n",
      'b.ts': "export { y } from '@tiptap/pm/state';\n",
    });
    const res = collectStaticImports(path.join(dir, 'a.ts'), dir);
    expect(res.bare).toEqual(expect.arrayContaining(['prosemirror-model', '@tiptap/pm/state']));
  });

  it('ignores type-only and dynamic imports', () => {
    const dir = tmpGraph({
      'a.ts':
        "import type { Node } from '@tiptap/core';\nexport type { Y } from '@tiptap/pm/state';\nexport const load = () => import('@tiptap/core');\n",
    });
    const res = collectStaticImports(path.join(dir, 'a.ts'), dir);
    expect(res.bare).toEqual([]);
  });
});
