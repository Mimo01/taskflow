import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { QueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor } from '@tiptap/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWiki, saveWiki } from '@/lib/wiki/editor';
import { useSettingsStore } from '@/stores/settings.store';
import { EDITOR_RULE_OPTIONS, editorExtensions } from '../extensions';
import { INSERT_ITEMS } from '../insert-items';
import { WIKI_OPEN_ATTACH_EVENT } from '../nodeviews/events';
import { installLayoutStubs } from '../shell-test-utils';
import { WikiEmoticonForce, WikiEmoticonSuggestion } from './emoticon-suggestion';
import { WikiMentionSuggestion } from './mention-suggestion';
import { filterSlashItems, SLASH_ITEMS } from './slash-items';
import { WikiSlashSuggestion } from './slash-suggestion';

installLayoutStubs();

vi.mock('@/services/jira/users', () => ({ fetchAssignableUsers: async () => [] }));
vi.mock('@/services/stronghold', () => ({ readSecret: async () => 'tok' }));

const EXTENSIONS = [
  ...editorExtensions,
  WikiMentionSuggestion,
  WikiEmoticonForce,
  WikiEmoticonSuggestion,
  WikiSlashSuggestion,
];
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
const popoverText = () => popovers()[0]?.textContent ?? '';
const settle = () => new Promise((r) => setTimeout(r, 150));

async function setup(content: string | object = '<p></p>'): Promise<Editor> {
  render(<Harness content={content} />);
  await waitFor(() => expect(current).not.toBeNull());
  const editor = current as Editor;
  editor.storage.wikiHost.set({ projectKey: 'DEMO', issueKey: 'DEMO-1' }, new QueryClient());
  act(() => {
    editor.commands.focus('end');
  });
  return editor;
}

async function pick(editor: Editor, label: string) {
  act(() => {
    editor.view.dispatch(closeHistory(editor.state.tr));
  });
  const option = await screen.findByRole('option', { name: new RegExp(`^${label}`) });
  act(() => {
    fireEvent.mouseDown(option);
    fireEvent.click(option);
  });
  await settle();
  return editor;
}

beforeEach(() => {
  current = null;
  for (const el of document.body.querySelectorAll('[data-suggestion]')) el.remove();
  useSettingsStore.setState({ recentSlashItems: [] });
});

describe('slash items', () => {
  it('lists Text, Blocks (every INSERT_ITEM) and Insert groups', () => {
    const labels = (g: string) => SLASH_ITEMS.filter((i) => i.group === g).map((i) => i.label);
    expect(labels('Text')).toEqual([
      'Paragraph',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Heading 4',
      'Heading 5',
      'Heading 6',
      'Quote',
      'Bullet list',
      'Numbered list',
    ]);
    expect(SLASH_ITEMS.filter((i) => i.group === 'Blocks').map((i) => i.id)).toEqual(
      INSERT_ITEMS.map((i) => i.id),
    );
    expect(labels('Insert')).toEqual(['Mention', 'Attachment or image', 'Emoticon']);
  });

  it('filters by label and keyword', () => {
    expect(filterSlashItems('tab')[0].id).toBe('table');
    expect(filterSlashItems('zzz')).toEqual([]);
  });
});

describe('slash trigger', () => {
  it('opens at line start and after a space, not in a/b, urls or code', async () => {
    const editor = await setup();
    typeChars(editor, '/');
    await waitFor(() => expect(popovers().length).toBe(1));
    const text = popoverText();
    expect(text.indexOf('Text')).toBeLessThan(text.indexOf('Blocks'));
    expect(text.indexOf('Blocks')).toBeLessThan(text.indexOf('Insert'));
    expect(text).not.toContain('Recent');
  });

  it('opens after a space', async () => {
    const editor = await setup();
    typeChars(editor, 'hi /');
    await waitFor(() => expect(popovers().length).toBe(1));
  });

  it('does not open in a/b or https://x/', async () => {
    const editor = await setup();
    typeChars(editor, 'a/b https://x/');
    await settle();
    expect(popovers().length).toBe(0);
  });

  it('does not open inside a code block', async () => {
    const editor = await setup({
      type: 'doc',
      content: [{ type: 'codeBlock', attrs: { language: null } }],
    });
    act(() => {
      editor.commands.focus('end');
    });
    typeChars(editor, '/');
    await settle();
    expect(popovers().length).toBe(0);
  });

  it('closes on no match and keeps the literal text', async () => {
    const editor = await setup();
    typeChars(editor, '/zzz');
    await settle();
    expect(popovers().length).toBe(0);
    expect(editor.state.doc.textContent).toBe('/zzz');
  });

  it('Esc closes and leaves the slash', async () => {
    const editor = await setup();
    typeChars(editor, '/');
    await waitFor(() => expect(popovers().length).toBe(1));
    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: 'Escape' });
    });
    await settle();
    expect(popovers().length).toBe(0);
    expect(editor.state.doc.textContent).toBe('/');
  });

  it('filters to Table for /tab', async () => {
    const editor = await setup();
    typeChars(editor, '/tab');
    await waitFor(() => expect(screen.getByRole('option', { name: /^Table/ })).toBeTruthy());
  });
});

describe('slash selection', () => {
  it('Heading 2 replaces /h2 and one undo restores it', async () => {
    const editor = await setup();
    typeChars(editor, '/h2');
    await pick(editor, 'Heading 2');
    expect(editor.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2);
    expect(editor.state.doc.textContent).toBe('');
    expect(popovers().length).toBe(0);
    const load = loadWiki('');
    if (!('doc' in load)) throw new Error('not rich');
    expect(saveWiki(load, editor.state.doc).kind).toBe('saved');
    act(() => {
      editor.commands.undo();
    });
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(editor.state.doc.textContent).toBe('/h2');
  });

  it('Table inserts a 3x3 header table', async () => {
    const editor = await setup();
    typeChars(editor, '/tab');
    await pick(editor, 'Table');
    const table =
      editor.state.doc.firstChild?.type.name === 'table' ? editor.state.doc.firstChild : null;
    expect(table).not.toBeNull();
    expect(table?.childCount).toBe(3);
    expect(table?.firstChild?.childCount).toBe(3);
    expect(editor.state.doc.textContent).not.toContain('/');
  });

  it('Info inserts an info panel', async () => {
    const editor = await setup();
    typeChars(editor, '/info');
    await pick(editor, 'Info');
    let found = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'panel' && n.attrs.type === 'info') found = true;
    });
    expect(found).toBe(true);
  });

  it('Mention leaves @ and the mention list opens', async () => {
    const editor = await setup();
    typeChars(editor, '/ment');
    await pick(editor, 'Mention');
    expect(editor.state.doc.textContent).toBe('@');
    await waitFor(() =>
      expect(editor.view.dom.getAttribute('aria-controls')).toBe('wiki-suggestion-wikiMention'),
    );
  });

  it('Emoticon opens the emoticon list', async () => {
    const editor = await setup();
    typeChars(editor, '/emot');
    await pick(editor, 'Emoticon');
    expect(editor.state.doc.textContent).toBe(':');
    await waitFor(() =>
      expect(editor.view.dom.getAttribute('aria-controls')).toBe('wiki-suggestion-wikiEmoticon'),
    );
  });

  it('Attachment dispatches the open-attach event', async () => {
    const editor = await setup();
    let fired = false;
    document.body.addEventListener(WIKI_OPEN_ATTACH_EVENT, () => {
      fired = true;
    });
    typeChars(editor, '/attach');
    await pick(editor, 'Attachment');
    expect(fired).toBe(true);
    expect(editor.state.doc.textContent).toBe('');
  });

  it('records recents, shows at most 3 first, ignores unknown ids, hides while typing', async () => {
    const editor = await setup();
    typeChars(editor, '/h2');
    await pick(editor, 'Heading 2');
    expect(useSettingsStore.getState().recentSlashItems).toEqual(['h2']);
    useSettingsStore.setState({ recentSlashItems: ['table', 'nope', 'h2', 'rule', 'info'] });
    act(() => {
      editor.commands.setContent('<p></p>');
      editor.commands.focus('end');
    });
    typeChars(editor, '/');
    await waitFor(() => expect(popovers().length).toBe(1));
    const text = popoverText();
    expect(text.startsWith('Recent')).toBe(true);
    expect(text).not.toContain('nope');
    const recentBlock = text.slice(0, text.indexOf('Text'));
    expect(recentBlock).toContain('Table');
    expect(recentBlock).toContain('Heading 2');
    expect(recentBlock).toContain('Horizontal rule');
    expect(recentBlock).not.toContain('Info');
    typeChars(editor, 'tab');
    await waitFor(() => expect(popoverText()).not.toContain('Recent'));
  });
});
