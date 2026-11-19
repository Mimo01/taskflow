import { getSchema } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadWiki, wikiSchema } from '@/lib/wiki/editor';
import { EDITOR_RULE_OPTIONS, editorExtensions } from '../extensions';
import { setCodeLanguage } from '../panel-commands';
import { richExtensions } from '../rich-extensions';
import { EDIT_IN_SOURCE_EVENT } from './events';

beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
  Element.prototype.scrollIntoView = vi.fn();
});

type Doc = Record<string, unknown>;

function wikiDoc(text: string): Doc {
  const load = loadWiki(text);
  if (!('doc' in load)) throw new Error('not rich');
  return load.doc as Doc;
}

let current: ReturnType<typeof useEditor>;

function Harness({ content }: { content: Doc }) {
  const editor = useEditor({
    extensions: richExtensions,
    content,
    immediatelyRender: true,
    ...EDITOR_RULE_OPTIONS,
  });
  current = editor;
  return (
    <MemoryRouter>
      <EditorContent editor={editor} />
    </MemoryRouter>
  );
}

function describeSchema(s: ReturnType<typeof getSchema>) {
  return Object.fromEntries(
    Object.entries(s.nodes).map(([n, t]) => [
      n,
      {
        attrs: Object.keys(t.spec.attrs ?? {}).sort(),
        content: t.spec.content,
        atom: t.spec.atom ?? false,
      },
    ]),
  );
}

describe('richExtensions', () => {
  it('has schema parity with editorExtensions and wikiSchema', () => {
    const rich = getSchema(richExtensions);
    expect(describeSchema(rich)).toEqual(describeSchema(getSchema(editorExtensions)));
    expect(Object.keys(rich.nodes).sort()).toEqual(Object.keys(wikiSchema.nodes).sort());
  });
});

describe('PanelView', () => {
  it('renders callout classes, title input and edits params', async () => {
    const { container } = render(<Harness content={wikiDoc('{info:title=Hi}\nx\n{info}')} />);
    const input = (await screen.findByPlaceholderText('Title (optional)')) as HTMLInputElement;
    const callout = container.querySelector('[data-callout="info"]');
    expect(callout?.className).toContain('border-blue-500');
    expect(input.value).toBe('Hi');
    fireEvent.change(input, { target: { value: 'New' } });
    expect(current?.state.doc.firstChild?.attrs.params).toBe('title=New');
  });

  it('offers a type menu including Remove panel', async () => {
    render(<Harness content={wikiDoc('{info}\nx\n{info}')} />);
    const trigger = await screen.findByLabelText('Panel options');
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);
    expect(await screen.findByText('Warning')).toBeTruthy();
    expect(screen.getByText('Remove panel')).toBeTruthy();
    fireEvent.click(screen.getByText('Warning'));
    expect(current?.state.doc.firstChild?.attrs.type).toBe('warning');
  });

  it.each([
    ['Note', 'switching type'],
    ['Remove panel', 'removing the panel'],
  ])('closes the menu and returns focus to the editor after %s (%s)', async (item) => {
    render(<Harness content={wikiDoc('Intro\n\n{info}\nx\n{info}')} />);
    const trigger = await screen.findByLabelText('Panel options');
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText(item));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(current?.view.dom));
  });
});

describe('CodeBlockView', () => {
  it('shows a language select', async () => {
    render(<Harness content={wikiDoc('{code:java}\nx\n{code}')} />);
    const select = await screen.findByLabelText('Code language');
    expect(select.textContent).toContain('Java');
  });

  it('shows Noformat without a select', async () => {
    render(<Harness content={wikiDoc('{noformat}\nx\n{noformat}')} />);
    expect(await screen.findByText('Noformat')).toBeTruthy();
    expect(screen.queryByLabelText('Code language')).toBeNull();
  });

  describe('syntax highlighting', () => {
    function codeBlockPos(): number {
      let found = -1;
      current?.state.doc.descendants((n, p) => {
        if (n.type.name === 'codeBlock') found = p;
      });
      return found;
    }

    it('highlights {code:java} inside the node view, in the shared frame', async () => {
      const { container } = render(
        <Harness content={wikiDoc('{code:java}\npublic class X {}\n{code}')} />,
      );
      await screen.findByLabelText('Code language');
      expect(container.querySelector('pre code .hljs-keyword')).not.toBeNull();
      const frame = container.querySelector('.wiki-code');
      expect(frame?.classList.contains('not-prose')).toBe(true);
    });

    it('nests token spans like the renderer (subst inside string, not merged classes)', async () => {
      const { container } = render(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: JS template literal under test
        <Harness content={wikiDoc('{code:javascript}\nconst s = `a ${b} c`;\n{code}')} />,
      );
      await screen.findByLabelText('Code language');
      const subst = container.querySelector('pre code .hljs-string .hljs-subst');
      expect(subst?.textContent).toBe(`$${'{'}b}`);
      expect(subst?.classList.contains('hljs-string')).toBe(false);
    });

    it("keeps CodeBlock's own plugins (VS Code paste handler) alongside the highlighter", async () => {
      render(<Harness content={wikiDoc('{code:java}\nint x;\n{code}')} />);
      await screen.findByLabelText('Code language');
      const keys = current?.state.plugins.map((p) => (p as unknown as { key: string }).key) ?? [];
      expect(keys.some((k) => k.startsWith('codeBlockVSCodeHandler'))).toBe(true);
      expect(keys.some((k) => k.startsWith('wikiCodeHighlight'))).toBe(true);
    });

    it('keeps {noformat} and bare {code} plain', async () => {
      const a = render(<Harness content={wikiDoc('{noformat}\npublic class X {}\n{noformat}')} />);
      await screen.findByText('Noformat');
      expect(a.container.querySelector('[class*="hljs-"]')).toBeNull();
      a.unmount();
      const b = render(<Harness content={wikiDoc('{code}\npublic class X {}\n{code}')} />);
      await screen.findByLabelText('Code language');
      expect(b.container.querySelector('[class*="hljs-"]')).toBeNull();
    });

    it('re-highlights when the language changes and clears on None', async () => {
      const { container } = render(
        <Harness content={wikiDoc('{code:java}\ndef f(): pass\n{code}')} />,
      );
      await screen.findByLabelText('Code language');
      act(() => {
        setCodeLanguage(current as NonNullable<typeof current>, codeBlockPos(), null);
      });
      expect(container.querySelector('[class*="hljs-"]')).toBeNull();
      act(() => {
        setCodeLanguage(current as NonNullable<typeof current>, codeBlockPos(), 'python');
      });
      expect(container.querySelector('pre code .hljs-keyword')).not.toBeNull();
    });
  });
});

describe('raw atoms', () => {
  const rawDoc: Doc = {
    type: 'doc',
    content: [
      { type: 'rawBlock', attrs: { raw: '{foo:bar}\nhello\n{foo}' } },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'a ' },
          { type: 'rawInline', attrs: { raw: '{inl}' } },
        ],
      },
    ],
  };

  it('renders raw block in a dashed frame and fires edit-in-source', async () => {
    const { container } = render(<Harness content={rawDoc} />);
    const button = await screen.findByText('Edit in source');
    const frame = container.querySelector('.border-dashed');
    expect(frame?.getAttribute('contenteditable')).toBe('false');
    const seen = vi.fn();
    container.addEventListener(EDIT_IN_SOURCE_EVENT, (e) => seen((e as CustomEvent).detail));
    fireEvent.click(button);
    expect(seen).toHaveBeenCalledWith({ pos: 0 });
  });

  it('renders raw inline as a chip', async () => {
    const { container } = render(<Harness content={rawDoc} />);
    await screen.findByText('Edit in source');
    const chip = container.querySelector('span.rounded.bg-muted\\/40.px-1.text-xs');
    expect(chip?.textContent).toBe('{inl}');
  });
});
