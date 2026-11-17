import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

async function loadWrapper(chunk: 'fails' | 'pending') {
  vi.resetModules();
  vi.doMock('./WikiEditor', async () => {
    if (chunk === 'fails') throw new Error('chunk failed');
    await new Promise(() => {});
    return {};
  });
  return (await import('./WikiEditorLazy')).WikiEditorLazy;
}

describe('WikiEditorLazy', () => {
  it('shows the load error in an equal-height frame', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const WikiEditorLazy = await loadWrapper('fails');
    const { container } = render(<WikiEditorLazy value="" onChange={() => {}} preset="compact" />);
    expect(
      await screen.findByText("The editor couldn't load. Reload the page to try again."),
    ).toBeTruthy();
    expect(container.innerHTML).toContain('min-h-[96px]');
    expect(container.innerHTML).toContain('rounded-lg border border-input');
  });

  it('shows the skeleton first with the full-preset height', async () => {
    const WikiEditorLazy = await loadWrapper('pending');
    const { container } = render(<WikiEditorLazy value="" onChange={() => {}} />);
    expect(container.querySelector('[data-testid="wiki-editor-skeleton"]')).toBeTruthy();
    expect(container.innerHTML).toContain('h-10');
    expect(container.innerHTML).toContain('min-h-[160px]');
  });

  it('imports nothing from the editor stack', () => {
    for (const f of ['WikiEditorLazy.tsx', 'types.ts']) {
      const src = readFileSync(resolve(process.cwd(), 'src/components/wiki-editor', f), 'utf8');
      expect(src).not.toMatch(/@tiptap|prosemirror|lib\/wiki\/editor/);
      const rel = [...src.matchAll(/from '(\.\/[^']+)'/g)].map((m) => m[1]);
      for (const r of rel) expect(['./types']).toContain(r);
    }
  });
});
