import { QueryClient } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { EDITOR_RULE_OPTIONS, editorExtensions } from './extensions';
import { WikiIssueKeyDecoration } from './issue-key-decoration';
import { installLayoutStubs } from './shell-test-utils';
import { WikiIssueKeySuggestion } from './suggestion/key-suggestion';
import { makeEditor, saveText } from './test-utils';

const searchMock = vi.fn();
vi.mock('@/services/jira', async (orig) => ({
  ...(await orig<typeof import('@/services/jira')>()),
  searchJiraForLink: (...a: unknown[]) => searchMock(...a),
}));
vi.mock('@/services/stronghold', async (orig) => ({
  ...(await orig<typeof import('@/services/stronghold')>()),
  readSecret: vi.fn(async () => 'secret-token'),
}));

installLayoutStubs();

const EXTS = [...editorExtensions, WikiIssueKeyDecoration, WikiIssueKeySuggestion];
const onOpenIssue = vi.fn();
let qc: QueryClient;

function setup(text: string, host: Record<string, unknown> = { projectKey: 'DEMO' }) {
  const made = makeEditor(text, EXTS);
  made.editor.storage.wikiHost.set({ ...host, onOpenIssue }, qc);
  return made;
}

let live: Editor | null = null;
function Harness({ html }: { html: string }) {
  const editor = useEditor({ extensions: EXTS, content: html, ...EDITOR_RULE_OPTIONS });
  live = editor;
  if (editor && !editor.isDestroyed)
    editor.storage.wikiHost.set({ projectKey: 'DEMO', onOpenIssue }, qc);
  return createElement(EditorContent, { editor });
}
async function setupLive(html = '<p>a</p>'): Promise<Editor> {
  live = null;
  render(createElement(Harness, { html }));
  await waitFor(() => expect(live).not.toBeNull());
  return live as unknown as Editor;
}

const keys = (editor: Editor) =>
  [...editor.view.dom.querySelectorAll('[data-issue-key]')].map((e) =>
    e.getAttribute('data-issue-key'),
  );

function type(editor: Editor, text: string) {
  act(() => {
    editor.commands.focus('end');
  });
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
    });
  }
}

const popovers = () => document.body.querySelectorAll('[data-suggestion]');
const settle = () => new Promise((r) => setTimeout(r, 400));

beforeEach(() => {
  qc = new QueryClient();
  searchMock.mockReset();
  onOpenIssue.mockReset();
  useAuthStore.setState({ activeJiraProject: null, jiraBaseUrl: 'https://jira.example.com' });
});

describe('issue key decoration', () => {
  it('decorates a known key without writing markup', () => {
    const { editor, load } = setup('see DEMO-12 now');
    expect(keys(editor)).toEqual(['DEMO-12']);
    expect(editor.view.dom.querySelector('[data-issue-key]')?.className).toBe(
      'text-primary hover:underline',
    );
    expect(JSON.stringify(editor.getJSON())).not.toContain('"link"');
    expect(saveText(editor, load)).toEqual({ kind: 'unchanged', text: 'see DEMO-12 now' });
  });

  it('skips unknown prefixes', () => {
    const { editor } = setup('see XYZ-1 now');
    expect(keys(editor)).toEqual([]);
  });

  it('skips code blocks, mono and links', () => {
    const { editor } = setup('{{DEMO-1}}\n\n{code}\nDEMO-2\n{code}\n\n[DEMO-3|http://x.example]');
    expect(keys(editor)).toEqual([]);
  });

  it('recomputes on host change and unions known prefixes', () => {
    const { editor } = setup('see DEMO-12 and OTHER-3', { projectKey: 'DEMO' });
    expect(keys(editor)).toEqual(['DEMO-12']);
    act(() => {
      editor.storage.wikiHost.set({ projectKey: 'OTHER', onOpenIssue }, qc);
    });
    expect(keys(editor)).toEqual(['OTHER-3']);
    act(() => {
      editor.storage.wikiHost.set({ projectKey: 'OTHER', issueKey: 'DEMO-1', onOpenIssue }, qc);
    });
    expect(keys(editor)).toEqual(['DEMO-12', 'OTHER-3']);
  });

  it('cmd+click opens the issue, plain click is not handled', () => {
    const { editor } = setup('see DEMO-12 now');
    document.elementFromPoint = () => null;
    const el = editor.view.dom.querySelector('[data-issue-key]') as HTMLElement;
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(onOpenIssue).not.toHaveBeenCalled();
    const meta = new MouseEvent('mousedown', { bubbles: true, cancelable: true, metaKey: true });
    el.dispatchEvent(meta);
    expect(onOpenIssue).toHaveBeenCalledWith('DEMO-12');
    expect(meta.defaultPrevented).toBe(true);
  });
});

describe('issue key suggestion', () => {
  const issue = { key: 'DEMO-123', fields: { summary: 'Fix it' } };

  it('opens on a known prefix and searches server-side without the token in the key', async () => {
    searchMock.mockResolvedValue([issue]);
    const editor = await setupLive();
    type(editor, ' DEMO-1');
    await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(searchMock).toHaveBeenCalledWith(
        'https://jira.example.com',
        'secret-token',
        'DEMO',
        'DEMO-1',
      ),
    );
    const cached = qc.getQueryCache().getAll();
    expect(cached[0].queryKey).toEqual([
      'wiki-editor-issue-search',
      'https://jira.example.com',
      'DEMO',
      'DEMO-1',
    ]);
    expect(JSON.stringify(cached[0].queryKey)).not.toContain('secret-token');
    await waitFor(() => expect(document.body.textContent).toContain('Fix it'));
  });

  it('does not open for unknown prefix, glued letters, URLs or code', async () => {
    searchMock.mockResolvedValue([]);
    for (const c of [' XYZ-', ' XDEMO-', ' https://x/DEMO-']) {
      const editor = await setupLive();
      type(editor, c);
      await settle();
      expect(popovers().length).toBe(0);
    }
    const editor = await setupLive('<pre><code>a</code></pre>');
    type(editor, ' DEMO-');
    await settle();
    expect(popovers().length).toBe(0);
  });

  it('never opens on #', async () => {
    const editor = await setupLive();
    type(editor, ' #');
    await settle();
    expect(popovers().length).toBe(0);
  });

  it('selecting inserts the plain key and one undo restores the typed text', async () => {
    searchMock.mockResolvedValue([issue]);
    const editor = await setupLive();
    type(editor, ' DEMO-1');
    await waitFor(() => expect(document.body.textContent).toContain('Fix it'));
    // A typed key with digits only commits a row the user navigated to (CR-01).
    for (const key of ['ArrowDown', 'Enter']) {
      act(() => {
        editor.view.dom.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
        );
      });
    }
    await waitFor(() => expect(editor.getText()).toContain('DEMO-123 '));
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getText()).toMatch(/DEMO-1$/);
  });
});
