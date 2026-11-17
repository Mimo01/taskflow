import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calloutStyles, WIKI_PROSE_CLASSES } from './prose';

describe('shared wiki prose module', () => {
  it('exposes the prose and density class tiers', () => {
    const all = WIKI_PROSE_CLASSES.join(' ');
    expect(all).toContain('prose prose-sm dark:prose-invert');
    expect(all).toContain('density-compact:prose-p:my-1.5');
    expect(all).toContain('density-comfortable:prose-p:my-5');
  });

  it('has all callout kinds', () => {
    expect(Object.keys(calloutStyles).sort()).toEqual(['info', 'note', 'panel', 'tip', 'warning']);
  });

  it('imports nothing from the editor, tiptap or prosemirror', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'prose.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"](\.\/editor|@tiptap\/|prosemirror)/);
    expect(src).not.toMatch(/^import /m);
  });

  it('WikiRenderer uses the shared module instead of a local calloutStyles', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../routes/dashboard/WikiRenderer.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/const calloutStyles/);
    expect(src).toMatch(/from '@\/lib\/wiki\/prose'/);
  });
});
