/**
 * React Compiler acceptance (Phase 98, SAFE-05). vitest runs without the compiler, so ref reads
 * in render and similar bail-outs would otherwise only show up in the real build. Each editor
 * component file is compiled with panicThreshold 'all_errors' and must not throw.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
// @ts-expect-error @babel/core ships no types and @types/babel__core is not a dependency
import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = [
  ...walk(join(ROOT, 'src/components/wiki-editor')).filter(
    (f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'),
  ),
];

describe('React Compiler acceptance', () => {
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1);
    it(`compiles ${rel}`, () => {
      const source = readFileSync(file, 'utf8');
      const result = transformSync(source, {
        filename: file,
        babelrc: false,
        configFile: false,
        presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
        plugins: [['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }]],
      });
      expect(result?.code).toBeTruthy();
      // A file defining a component gets the memo cache helper.
      if (/export (default )?function [A-Z]/.test(source) || /\bfunction [A-Z]\w*\(/.test(source)) {
        expect(result?.code).toContain('react/compiler-runtime');
      }
    });
  }
});
