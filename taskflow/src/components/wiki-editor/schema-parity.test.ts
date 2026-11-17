import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { loadWiki, saveWiki, wikiSchema } from '@/lib/wiki/editor';
import { WIKI_CORPUS } from '@/lib/wiki/corpus.fixtures';
import { buildEditorExtensions, editorExtensions } from './extensions';
import { makeEditor } from './test-utils';

const stub = (() => () => ({})) as never;

function describeSchema(schema: typeof wikiSchema) {
  const nodes = Object.fromEntries(
    Object.entries(schema.nodes).map(([name, t]) => [
      name,
      {
        attrs: Object.fromEntries(
          Object.entries(t.spec.attrs ?? {}).map(([k, v]) => [
            k,
            (v as { default?: unknown }).default,
          ]),
        ),
        content: t.spec.content,
        group: t.spec.group,
        inline: t.spec.inline ?? false,
        atom: t.spec.atom ?? false,
      },
    ]),
  );
  const marks = Object.keys(schema.marks).map((name) => [
    name,
    Object.fromEntries(
      Object.entries(schema.marks[name]?.spec.attrs ?? {}).map(([k, v]) => [
        k,
        (v as { default?: unknown }).default,
      ]),
    ),
  ]);
  return { nodes, marks };
}

describe('editor schema parity', () => {
  const expected = describeSchema(wikiSchema);

  it.each([
    ['editorExtensions', () => getSchema(editorExtensions)],
    [
      'with node views',
      () =>
        getSchema(
          buildEditorExtensions({ panel: stub, codeBlock: stub, rawBlock: stub, rawInline: stub }),
        ),
    ],
  ])('%s matches wikiSchema', (_n, build) => {
    const schema = build();
    const actual = describeSchema(schema);
    expect(Object.keys(actual.nodes).sort()).toEqual(Object.keys(expected.nodes).sort());
    expect(actual.nodes).toEqual(expected.nodes);
    expect(actual.marks).toEqual(expected.marks);
    expect(Object.values(schema.nodes).find((n) => n.isBlock && n.name !== 'doc')?.name).toBe(
      'paragraph',
    );
  });

  it('keeps a stable module-scope array', async () => {
    const again = await import('./extensions');
    expect(again.editorExtensions).toBe(editorExtensions);
  });

  it('only builds the list at module scope', () => {
    const files = import.meta.glob('./**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const callers = Object.entries(files)
      .filter(([, src]) => /buildEditorExtensions\(/.test(src as string))
      .map(([p]) => p)
      .filter((p) => !p.endsWith('.test.ts') && !p.endsWith('.test.tsx'))
      .sort();
    for (const c of callers) {
      expect(['./extensions.ts', './rich-extensions.ts']).toContain(c);
    }
  });

  it('keeps trailing node off', () => {
    const { editor } = makeEditor('a');
    expect(editor.state.doc.childCount).toBe(1);
  });

  it('renders colour only for safe values', () => {
    const doc = (value: string) => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'color', attrs: { value } }] }],
        },
      ],
    });
    const { editor } = makeEditor('a');
    editor.commands.setContent(doc('red'));
    expect(editor.getHTML()).toContain('style="color: red');
    editor.commands.setContent(doc('red;background:url(x)'));
    expect(editor.getHTML()).not.toContain('style=');
  });
});

describe('corpus no-op', () => {
  for (const { path, wiki } of WIKI_CORPUS) {
    const load = loadWiki(wiki);
    if (load.kind !== 'rich' && load.kind !== 'rich-demoted') continue;
    it(`${path} renders and saves unchanged`, () => {
      const { editor, load: l } = makeEditor(wiki);
      expect(() => editor.getHTML()).not.toThrow();
      const saved = saveWiki(l, editor.state.doc);
      expect(saved.kind).toBe('unchanged');
      if (saved.kind === 'unchanged') expect(saved.text).toBe(wiki);
      editor.destroy();
    });
  }
});
