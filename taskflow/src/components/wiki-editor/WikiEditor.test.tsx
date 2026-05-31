/**
 * WikiEditor — behaviour tests (Task 5 TDD RED gate).
 *
 * Tests use jsdom + @testing-library/react.
 * TipTap / ProseMirror is mocked at the @tiptap/react boundary so tests
 * run fast without a real editor DOM; we assert on the component's
 * controlled-value and toggle behaviour.
 */

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

vi.mock('@tiptap/react', () => {
  const mockEditor = {
    getHTML: vi.fn(() => '<p></p>'),
    commands: {
      setContent: vi.fn(),
      focus: vi.fn(),
    },
    state: { doc: { type: 'doc', content: [] } },
    isEditable: true,
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    setEditable: vi.fn(),
    isEmpty: false,
    isDestroyed: false,
  };

  const useEditor = vi.fn(() => mockEditor);
  const EditorContent = vi.fn(({ editor }: { editor: unknown }) =>
    editor ? <div data-testid="tiptap-editor" contentEditable /> : null,
  );
  const ReactRenderer = vi.fn();

  return { useEditor, EditorContent, ReactRenderer };
});

vi.mock('./jiraToTiptap', () => ({
  jiraToTiptap: vi.fn((wiki: string) => ({
    type: 'doc',
    content: wiki
      ? [{ type: 'paragraph', content: [{ type: 'text', text: wiki }] }]
      : [{ type: 'paragraph' }],
  })),
}));

vi.mock('./jiraWikiSerializer', () => ({
  serializeToJiraWiki: vi.fn(
    (doc: { content?: Array<{ content?: Array<{ text?: string }> }> }) =>
      doc?.content?.[0]?.content?.[0]?.text ?? '',
  ),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-jira-token'),
}));

vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: vi.fn().mockResolvedValue([]),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useEditor } from '@tiptap/react';

import { WikiEditor } from './WikiEditor';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WikiEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-initialise useEditor mock to return a fresh editor object each test
    vi.mocked(useEditor).mockReturnValue({
      getHTML: vi.fn(() => '<p></p>'),
      commands: { setContent: vi.fn(), focus: vi.fn() },
      state: { doc: { type: 'doc', content: [] } },
      isEditable: true,
      on: vi.fn(),
      off: vi.fn(),
      destroy: vi.fn(),
      setEditable: vi.fn(),
      isEmpty: false,
      isDestroyed: false,
    } as unknown as ReturnType<typeof useEditor>);
  });

  // ── Render ──────────────────────────────────────────────────────────────

  it('renders the TipTap editor content area in WYSIWYG mode by default', () => {
    render(<WikiEditor value="*hello*" onChange={vi.fn()} />);
    expect(screen.getByTestId('tiptap-editor')).toBeTruthy();
  });

  it('renders a Source toggle button', () => {
    render(<WikiEditor value="test" onChange={vi.fn()} />);
    const sourceBtn = screen.getByRole('button', { name: /source/i });
    expect(sourceBtn).toBeTruthy();
  });

  // ── Source toggle ────────────────────────────────────────────────────────

  it('toggling to Source reveals a textarea with the current wiki value', async () => {
    render(<WikiEditor value="*bold text*" onChange={vi.fn()} />);
    const sourceBtn = screen.getByRole('button', { name: /source/i });
    fireEvent.click(sourceBtn);

    // Source textarea should appear with aria-label
    const textarea = await screen.findByRole('textbox', { name: /source/i });
    expect(textarea).toBeTruthy();
    // TipTap editor should be hidden
    expect(screen.queryByTestId('tiptap-editor')).toBeNull();
  });

  it('toggling back from Source to WYSIWYG hides the textarea', async () => {
    render(<WikiEditor value="test" onChange={vi.fn()} />);
    const sourceBtn = screen.getByRole('button', { name: /source/i });

    // Go to Source
    fireEvent.click(sourceBtn);
    await screen.findByRole('textbox', { name: /source/i });

    // Toggle back to WYSIWYG
    const wysiwygBtn = screen.getByRole('button', { name: /wysiwyg|rich|visual/i });
    fireEvent.click(wysiwygBtn);

    expect(screen.queryByRole('textbox', { name: /source/i })).toBeNull();
    expect(screen.getByTestId('tiptap-editor')).toBeTruthy();
  });

  // ── No-op dirty-flag guard (RESEARCH Pitfall 2 / D-source-authority) ────

  it('no-op: toggling Source and back without editing does NOT call onChange', async () => {
    const onChange = vi.fn();
    render(<WikiEditor value="*bold*" onChange={onChange} />);

    // Toggle to Source
    fireEvent.click(screen.getByRole('button', { name: /source/i }));
    await screen.findByRole('textbox', { name: /source/i });

    // Toggle back without editing source textarea
    fireEvent.click(screen.getByRole('button', { name: /wysiwyg|rich|visual/i }));

    // onChange must NOT have been called (no edits made, dirty flag clean)
    expect(onChange).not.toHaveBeenCalled();
  });

  // ── disabled prop ────────────────────────────────────────────────────────

  it('disabled prop passes editable: false to useEditor', () => {
    render(<WikiEditor value="test" onChange={vi.fn()} disabled />);
    expect(vi.mocked(useEditor)).toHaveBeenCalledWith(
      expect.objectContaining({ editable: false }),
      expect.anything(),
    );
  });
});
