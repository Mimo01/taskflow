import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadWiki, saveWiki } from '@/lib/wiki/editor';
import { EDITOR_RULE_OPTIONS, editorExtensions } from '../extensions';
import { installLayoutStubs } from '../shell-test-utils';
import {
  filterEmoticons,
  openEmoticonSuggestion,
  WikiEmoticonForce,
  WikiEmoticonSuggestion,
} from './emoticon-suggestion';

installLayoutStubs();

const EXTENSIONS = [...editorExtensions, WikiEmoticonForce, WikiEmoticonSuggestion];
let current: Editor | null = null;

function Harness({ content }: { content: string | object }) {
  const editor = useEditor({ extensions: EXTENSIONS, content, ...EDITOR_RULE_OPTIONS });
  current = editor;
  return <EditorContent editor={editor} />;
}

function typeChars(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
    });
  }
}

const popovers = () => document.body.querySelectorAll('[data-suggestion]');
const settle = () => new Promise((r) => setTimeout(r, 150));

async function setup(content: string | object = '<p></p>'): Promise<Editor> {
  render(<Harness content={content} />);
  await waitFor(() => expect(current).not.toBeNull());
  const editor = current as Editor;
  act(() => {
    editor.commands.focus('end');
  });
  return editor;
}

beforeEach(() => {
  current = null;
});

describe('filterEmoticons', () => {
  it('ranks name-prefix matches before substring matches', () => {
    const names = filterEmoticons('st').map((e) => e.name);
    expect(names[0]).toBe('star');
    expect(names).toContain('red star');
    expect(names.indexOf('star')).toBeLessThan(names.indexOf('red star'));
  });

  it('fla -> flag, flag off', () => {
    expect(filterEmoticons('fla').map((e) => e.name)).toEqual(['flag', 'flag off']);
  });

  it('matches keywords and tokens', () => {
    expect(filterEmoticons('idea').map((e) => e.token)).toEqual(['(on)']);
    expect(filterEmoticons('flagoff').map((e) => e.token)).toContain('(flagoff)');
  });

  it('empty query lists all 16', () => {
    expect(filterEmoticons('')).toHaveLength(16);
  });
});

describe(': emoticon suggestion', () => {
  it('opens after a space with glyph, name and token', async () => {
    const editor = await setup('<p>a</p>');
    typeChars(editor, ' :c');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    const opt = screen.getAllByRole('option')[0] as HTMLElement;
    expect(opt.textContent).toContain('check');
    expect(opt.textContent).toContain('(/)');
  });

  it('opens at line start', async () => {
    const editor = await setup();
    typeChars(editor, ':c');
    await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
  });

  it.each([['10:30'], ['http:'], ['a:b'], [' :']])('does not open for %j', async (typed) => {
    const editor = await setup('<p>x</p>');
    typeChars(editor, typed === ' :' ? typed : ` ${typed}`);
    await settle();
    expect(popovers()).toHaveLength(0);
  });

  it('does not open inside a code block', async () => {
    const editor = await setup('<pre><code>x</code></pre>');
    typeChars(editor, ' :c');
    await settle();
    expect(popovers()).toHaveLength(0);
  });

  it('no match closes silently and leaves the text', async () => {
    const editor = await setup('<p>a</p>');
    typeChars(editor, ' :zzz');
    await settle();
    expect(popovers()).toHaveLength(0);
    expect(editor.state.doc.textContent).toBe('a :zzz');
  });

  it('Enter inserts the emoticon node without a trailing space and saves its token', async () => {
    const load = loadWiki('');
    if (!('doc' in load)) throw new Error('not rich');
    const editor = await setup(load.doc);
    typeChars(editor, ':che');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: 'Enter' });
    });
    const found: string[] = [];
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'emoticon') found.push(n.attrs.src);
    });
    expect(found).toEqual(['(/)']);
    expect(editor.state.doc.textContent).not.toContain(':che');
    expect(editor.state.doc.textContent.endsWith(' ')).toBe(false);
    const saved = saveWiki(load, editor.state.doc);
    expect(saved.kind).toBe('saved');
    if (saved.kind === 'saved') expect(saved.text.trim()).toBe('(/)');
  });

  it('openEmoticonSuggestion opens the full list, adding a space after a word', async () => {
    const editor = await setup('<p>word</p>');
    act(() => {
      openEmoticonSuggestion(editor);
    });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(16));
    expect(editor.state.doc.textContent).toBe('word :');
  });

  it('openEmoticonSuggestion at line start inserts no space', async () => {
    const editor = await setup();
    act(() => {
      openEmoticonSuggestion(editor);
    });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(16));
    expect(editor.state.doc.textContent).toBe(':');
  });
});
