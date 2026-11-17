import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { EditorContent, useEditor } from '@tiptap/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWiki, saveWiki } from '@/lib/wiki/editor';
import { useAuthStore } from '@/stores/auth.store';
import { EDITOR_RULE_OPTIONS, editorExtensions } from '../extensions';
import { installLayoutStubs } from '../shell-test-utils';
import { WikiMentionSuggestion } from './mention-suggestion';

installLayoutStubs();

const fetchAssignableUsers = vi.fn();
vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: (...a: unknown[]) => fetchAssignableUsers(...a),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: async () => 'tok' }));

const EXTENSIONS = [...editorExtensions, WikiMentionSuggestion];
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

async function setup(content: string | object): Promise<Editor> {
  render(<Harness content={content} />);
  await waitFor(() => expect(current).not.toBeNull());
  const editor = current as Editor;
  editor.storage.wikiHost.set({ projectKey: 'DEMO', issueKey: 'DEMO-1' }, new QueryClient());
  act(() => {
    editor.commands.focus('end');
  });
  return editor;
}

beforeEach(() => {
  current = null;
  fetchAssignableUsers.mockReset();
  fetchAssignableUsers.mockResolvedValue([
    {
      name: 'jdoe',
      displayName: 'Jane Doe',
      avatarUrls: { '24x24': 'https://jira.example.invalid/a.png' },
    },
  ]);
  useAuthStore.setState({ jiraBaseUrl: 'https://jira.example.invalid' });
});

describe('@ mention suggestion', () => {
  it('opens after a space and shows name plus username', async () => {
    const editor = await setup('<p>Hi</p>');
    typeChars(editor, ' @ja');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(screen.getByRole('option').textContent).toContain('Jane Doe');
    expect(screen.getByRole('option').textContent).toContain('jdoe');
    expect(fetchAssignableUsers).toHaveBeenCalledWith(
      'https://jira.example.invalid',
      'tok',
      'DEMO',
      'ja',
      { issueKey: 'DEMO-1' },
    );
  });

  it('opens at line start and after an open paren', async () => {
    const editor = await setup('<p></p>');
    typeChars(editor, '@ja');
    await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
  });

  it('opens after an open paren', async () => {
    const editor = await setup('<p>x</p>');
    typeChars(editor, ' (@ja');
    await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
  });

  it('does not open mid-word (a@b)', async () => {
    const editor = await setup('<p>a</p>');
    typeChars(editor, '@b');
    await new Promise((r) => setTimeout(r, 400));
    expect(popovers()).toHaveLength(0);
    expect(fetchAssignableUsers).not.toHaveBeenCalled();
  });

  it('does not open inside a code block', async () => {
    const editor = await setup('<pre><code>x</code></pre>');
    typeChars(editor, ' @ja');
    await new Promise((r) => setTimeout(r, 400));
    expect(popovers()).toHaveLength(0);
  });

  it('Enter inserts a mention node plus a space, one undo restores the trigger, saves [~id]', async () => {
    const load = loadWiki('Hi');
    if (!('doc' in load)) throw new Error('not rich');
    const editor = await setup(load.doc);
    typeChars(editor, ' @ja');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    act(() => {
      editor.view.dispatch(closeHistory(editor.state.tr));
    });
    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: 'Enter' });
    });
    let mentionId: string | null = null;
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'mention') mentionId = n.attrs.id;
    });
    expect(mentionId).toBe('jdoe');
    expect(editor.state.doc.textContent.endsWith(' ')).toBe(true);
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
    const saved = saveWiki(load, editor.state.doc);
    expect(saved.kind).toBe('saved');
    if (saved.kind === 'saved') expect(saved.text).toBe('Hi [~jdoe]');
    act(() => {
      editor.commands.undo();
    });
    expect(editor.state.doc.textContent).toBe('Hi @ja');
  });

  it('shows the empty copy when nobody matches', async () => {
    fetchAssignableUsers.mockResolvedValue([]);
    const editor = await setup('<p>Hi</p>');
    typeChars(editor, ' @zz');
    await waitFor(() => expect(screen.getByText('No matching people')).toBeTruthy());
  });
});
