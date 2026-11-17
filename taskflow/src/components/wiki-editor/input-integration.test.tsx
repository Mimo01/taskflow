import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { Slice } from '@tiptap/pm/model';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { installLayoutStubs, liveEditor } from './shell-test-utils';
import type { WikiEditorHost } from './types';
import WikiEditor from './WikiEditor';

installLayoutStubs();

const fetchAssignableUsers = vi.fn();
vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: (...a: unknown[]) => fetchAssignableUsers(...a),
}));
const searchJiraForLink = vi.fn();
vi.mock('@/services/jira', async (orig) => ({
  ...(await orig<object>()),
  searchJiraForLink: (...a: unknown[]) => searchJiraForLink(...a),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: async () => 'token' }));

const HOST: WikiEditorHost = { projectKey: 'DEMO', userMap: { jdoe: 'Jane Doe' } };

beforeEach(() => {
  fetchAssignableUsers.mockReset();
  fetchAssignableUsers.mockResolvedValue([
    {
      name: 'jdoe',
      displayName: 'Jane Doe',
      avatarUrls: { '24x24': 'https://jira.example.invalid/a.png' },
    },
  ]);
  searchJiraForLink.mockReset();
  searchJiraForLink.mockResolvedValue([
    { key: 'DEMO-12', fields: { summary: 'First issue' } },
    { key: 'DEMO-13', fields: { summary: 'Second issue' } },
  ]);
  useAuthStore.setState({ jiraBaseUrl: 'https://jira.example.invalid' });
});

function mount(value: string) {
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WikiEditor value={value} onChange={onChange} host={HOST} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const editor = liveEditor();
  act(() => {
    editor.commands.focus('end');
  });
  return { editor, onChange, ...result };
}

function typeChars(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
    });
  }
}

const enter = (editor: Editor) =>
  act(() => {
    fireEvent.keyDown(editor.view.dom, { key: 'Enter' });
  });
const popovers = () => document.body.querySelectorAll('[data-suggestion]');
const lastSaved = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.lastCall?.[0] as string | undefined;

function paste(editor: Editor, map: Record<string, string>): boolean {
  const { view } = editor;
  const ev = {
    clipboardData: { files: [], types: Object.keys(map), getData: (t: string) => map[t] ?? '' },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
  return Boolean(view.someProp('handlePaste', (f) => f(view, ev, Slice.empty)));
}

describe('input extensions through WikiEditor', () => {
  it('@ mention: Enter saves [~jdoe]', async () => {
    const { editor, onChange } = mount('Hi');
    typeChars(editor, ' @ja');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    enter(editor);
    await waitFor(() => expect(lastSaved(onChange)).toBe('Hi [~jdoe]'));
    expect(document.body.textContent).toContain('@Jane Doe');
  });

  it(': emoticon: Enter saves (/)', async () => {
    const { editor, onChange } = mount('Hi');
    typeChars(editor, ' :ch');
    await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
    enter(editor);
    await waitFor(() => expect(lastSaved(onChange)).toContain('(/)'));
  });

  it('/ slash: /h2 turns the line into a heading', async () => {
    const { editor } = mount('');
    typeChars(editor, '/h2');
    await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
    enter(editor);
    await waitFor(() => expect(editor.state.doc.firstChild?.type.name).toBe('heading'));
  });

  it('KEY- lists issues and Enter inserts the key', async () => {
    const { editor, onChange } = mount('see');
    typeChars(editor, ' DEMO-');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    enter(editor);
    await waitFor(() => expect(lastSaved(onChange)).toContain('DEMO-12'));
  });

  it('decorates a known key without changing the saved text', () => {
    const { editor, onChange } = mount('see DEMO-12');
    expect(document.querySelector('[data-issue-key="DEMO-12"]')).not.toBeNull();
    act(() => {
      editor.commands.focus('end');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('HTML paste goes through WikiSmartPaste', async () => {
    const { editor, onChange } = mount('');
    const handled = paste(editor, {
      'text/html': '<h2>Title</h2><ul><li>one</li><li>two</li></ul>',
      'text/plain': 'Title one two',
    });
    expect(handled).toBe(true);
    await waitFor(() => expect(lastSaved(onChange)).toContain('h2. Title'));
    expect(lastSaved(onChange)).toContain('* one');
  });

  it('a URL pasted over a selection still becomes a link', () => {
    const { editor, onChange } = mount('word');
    act(() => {
      editor.commands.selectAll();
    });
    paste(editor, { 'text/plain': 'https://example.invalid/x' });
    expect(lastSaved(onChange)).toBe('[word|https://example.invalid/x]');
  });

  it('only one popover at a time, none left after unmount', async () => {
    const { editor, unmount } = mount('Hi');
    typeChars(editor, ' @ja');
    await waitFor(() => expect(document.querySelectorAll('[role="listbox"]').length).toBe(1));
    typeChars(editor, '/');
    await new Promise((r) => setTimeout(r, 300));
    // The renderer wrapper and the popover both carry data-suggestion: count listboxes.
    expect(document.querySelectorAll('[role="listbox"]').length).toBeLessThanOrEqual(1);
    unmount();
    expect(popovers()).toHaveLength(0);
  });
});
