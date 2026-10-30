/**
 * 94-REVIEW WR-03: React Compiler guard for the release detail page.
 *
 * The app builds with babel-plugin-react-compiler (vite.config.ts); vitest does
 * not. When the compiler bails out of a component it does so silently — the
 * build passes, and the component simply loses all memoisation. A try/finally
 * in `handleRefresh` made the compiler skip the whole page. This compiles the
 * source the same way and fails on any CompileError for the page component.
 *
 * `@babel/core` is loaded through createRequire: it ships with
 * @rolldown/plugin-babel and has no bundled types.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type CompilerEvent = { kind: string; fnName?: string | null; detail?: unknown };
type Babel = {
  transformSync: (code: string, opts: Record<string, unknown>) => { code?: string | null } | null;
};

const require = createRequire(import.meta.url);

function compile(file: string): { code: string; events: CompilerEvent[] } {
  const babel = require('@babel/core') as Babel;
  const events: CompilerEvent[] = [];
  const out = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx', 'typescript'] },
    plugins: [
      [
        require.resolve('babel-plugin-react-compiler'),
        { logger: { logEvent: (_f: string, e: CompilerEvent) => events.push(e) } },
      ],
    ],
  });
  return { code: out?.code ?? '', events };
}

describe('ReleaseDetailPage — React Compiler', () => {
  it('compiles without a bailout', () => {
    const { code, events } = compile(path.resolve(__dirname, 'ReleaseDetailPage.tsx'));
    const errors = events
      .filter((e) => e.kind !== 'CompileSuccess' && e.kind !== 'CompileSkip')
      .map((e) => `${e.kind}: ${JSON.stringify(e.detail)}`);
    expect(errors).toEqual([]);
    expect(code).toMatch(/_c\(\d+\)/);
  });
});
