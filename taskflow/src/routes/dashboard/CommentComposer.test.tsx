/**
 * CommentComposer on the new WikiEditor (shared textarea stub): send, Esc blur, Reply focus,
 * per-issue draft, and the PERF-DETAIL-03 post-mutation invalidation.
 */

vi.mock('@/services/jira', () => ({
  postComment: vi.fn(),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_DEBOUNCE_MS } from '@/hooks/useEditorDraft';
import { postComment } from '@/services/jira';
import { useComposerFocus } from '@/stores/composer-focus.store';
import { useDraftsStore } from '@/stores/drafts.store';
import { lastStubProps } from '@/test/wiki-editor-stub';

import { CommentComposer } from './CommentComposer';

const ISSUE_KEY = 'PROJ-42';
const JIRA_BASE_URL = 'https://jira.example.com';
const DRAFT_KEY = `comment:new:${ISSUE_KEY}`;

const mockPostComment = vi.mocked(postComment);

let hydratedSpy: ReturnType<typeof vi.spyOn>;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderComposer(qc: QueryClient = makeQueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <CommentComposer issueKey={ISSUE_KEY} jiraBaseUrl={JIRA_BASE_URL} />
    </QueryClientProvider>,
  );
}

const editor = () => screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;
const commentButton = () => screen.getByRole('button', { name: 'Comment' });

beforeEach(() => {
  vi.clearAllMocks();
  useComposerFocus.setState({ composerFocus: null });
  useDraftsStore.setState({ drafts: {}, owner: null });
  hydratedSpy = vi.spyOn(useDraftsStore.persist, 'hasHydrated').mockReturnValue(true);
});

afterEach(() => {
  hydratedSpy.mockRestore();
});

describe('CommentComposer — editor wiring', () => {
  it('renders the compact editor with placeholder, label and host', () => {
    renderComposer();
    expect(lastStubProps.current?.preset).toBe('compact');
    expect(lastStubProps.current?.placeholder).toBe('Add a comment…');
    expect(lastStubProps.current?.['aria-label']).toBe('Add a comment');
    expect(lastStubProps.current?.host?.issueKey).toBe(ISSUE_KEY);
    expect(screen.getByLabelText('Add a comment')).toBeInTheDocument();
  });

  it('disables the Comment button while the text is empty', () => {
    renderComposer();
    expect(commentButton()).toBeDisabled();
    fireEvent.change(editor(), { target: { value: '  ' } });
    expect(commentButton()).toBeDisabled();
    fireEvent.change(editor(), { target: { value: 'hi' } });
    expect(commentButton()).toBeEnabled();
  });

  it('labels the button Comment (not Send)', () => {
    renderComposer();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });
});

describe('CommentComposer — post mutation', () => {
  it('Comment click posts the text once with the PAT and base URL', async () => {
    mockPostComment.mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderComposer();
    await user.type(editor(), 'Hello world');
    await user.click(commentButton());
    await waitFor(() =>
      expect(mockPostComment).toHaveBeenCalledWith(
        JIRA_BASE_URL,
        'mock-token',
        ISSUE_KEY,
        'Hello world',
      ),
    );
    expect(mockPostComment).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Enter posts the comment', async () => {
    mockPostComment.mockResolvedValue(undefined as never);
    renderComposer();
    fireEvent.change(editor(), { target: { value: 'via shortcut' } });
    fireEvent.keyDown(editor(), { key: 'Enter', metaKey: true });
    await waitFor(() => expect(mockPostComment).toHaveBeenCalledTimes(1));
    expect(mockPostComment.mock.calls[0][3]).toBe('via shortcut');
  });

  it('Cmd+Enter with empty text does nothing', () => {
    renderComposer();
    fireEvent.keyDown(editor(), { key: 'Enter', metaKey: true });
    expect(mockPostComment).not.toHaveBeenCalled();
  });

  it('Cmd+Enter while a post is pending does not post twice', async () => {
    let resolve: (() => void) | undefined;
    mockPostComment.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }) as never,
    );
    renderComposer();
    fireEvent.change(editor(), { target: { value: 'once' } });
    fireEvent.keyDown(editor(), { key: 'Enter', metaKey: true });
    await waitFor(() => expect(mockPostComment).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(editor(), { key: 'Enter', metaKey: true });
    expect(mockPostComment).toHaveBeenCalledTimes(1);
    resolve?.();
  });

  it('success clears the text, invalidates both keys, clears the draft and refocuses', async () => {
    mockPostComment.mockResolvedValue(undefined as never);
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    useDraftsStore.setState({
      drafts: {
        [DRAFT_KEY]: { kind: 'comment-new', issueKey: ISSUE_KEY, text: 'x', updatedAt: 1 },
      },
    });
    renderComposer(qc);
    fireEvent.change(editor(), { target: { value: 'Posting' } });
    fireEvent.click(commentButton());
    await waitFor(() => expect(editor().value).toBe(''));
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey?: unknown[] }).queryKey);
    expect(keys).toContainEqual(['jira-issue-detail', ISSUE_KEY, JIRA_BASE_URL]);
    expect(keys).toContainEqual(['jira-issue-comments', ISSUE_KEY, JIRA_BASE_URL]);
    expect(useDraftsStore.getState().drafts[DRAFT_KEY]).toBeUndefined();
    expect(editor()).toHaveFocus();
  });

  it('failure keeps the text and draft and shows the error', async () => {
    mockPostComment.mockRejectedValue(new Error('boom'));
    renderComposer();
    fireEvent.change(editor(), { target: { value: 'keep me' } });
    fireEvent.blur(editor()); // flush the draft
    fireEvent.click(commentButton());
    expect(await screen.findByText('Failed to post comment — please try again')).toBeVisible();
    expect(editor().value).toBe('keep me');
    expect(useDraftsStore.getState().drafts[DRAFT_KEY]?.text).toBe('keep me');
  });
});

describe('CommentComposer — Esc', () => {
  it('blurs the editor, keeps text and draft, and shows no dialog', () => {
    renderComposer();
    fireEvent.change(editor(), { target: { value: 'half typed' } });
    editor().focus();
    expect(editor()).toHaveFocus();
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(editor()).not.toHaveFocus();
    expect(editor().value).toBe('half typed');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('CommentComposer — composer focus request (notification Reply)', () => {
  it('focuses the editor when the flag matches the issue key, then clears the flag', async () => {
    useComposerFocus.setState({ composerFocus: ISSUE_KEY });
    renderComposer();
    await waitFor(() => expect(editor()).toHaveFocus());
    expect(useComposerFocus.getState().composerFocus).toBeNull();
  });

  it('does nothing for a different issue key and keeps the flag', () => {
    useComposerFocus.setState({ composerFocus: 'OTHER-1' });
    renderComposer();
    expect(editor()).not.toHaveFocus();
    expect(useComposerFocus.getState().composerFocus).toBe('OTHER-1');
  });

  it('waits for the editor handle before focusing', async () => {
    // The stub's handle is attached on mount; a request made before mount is honoured only after.
    useComposerFocus.setState({ composerFocus: ISSUE_KEY });
    const { unmount } = renderComposer();
    await waitFor(() => expect(useComposerFocus.getState().composerFocus).toBeNull());
    unmount();
    useComposerFocus.setState({ composerFocus: ISSUE_KEY });
    renderComposer();
    await waitFor(() => expect(editor()).toHaveFocus());
  });
});

describe('CommentComposer — draft', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes the draft after the debounce and shows the note', () => {
    renderComposer();
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    fireEvent.change(editor(), { target: { value: 'wip' } });
    expect(useDraftsStore.getState().drafts[DRAFT_KEY]).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 10);
    });
    expect(useDraftsStore.getState().drafts[DRAFT_KEY]?.text).toBe('wip');
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
  });

  it('Discard empties the composer, clears the draft and focuses the editor', () => {
    renderComposer();
    fireEvent.change(editor(), { target: { value: 'wip' } });
    act(() => {
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 10);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(editor().value).toBe('');
    expect(useDraftsStore.getState().drafts[DRAFT_KEY]).toBeUndefined();
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    expect(editor()).toHaveFocus();
  });

  it('starts with the stored draft text when already hydrated', () => {
    useDraftsStore.setState({
      drafts: {
        [DRAFT_KEY]: { kind: 'comment-new', issueKey: ISSUE_KEY, text: 'restored', updatedAt: 1 },
      },
    });
    renderComposer();
    expect(editor().value).toBe('restored');
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
  });

  it('seeds the draft once when hydration finishes after mount', () => {
    hydratedSpy.mockReturnValue(false);
    let finish: (() => void) | undefined;
    const unsub = vi.spyOn(useDraftsStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      finish = () => fn(useDraftsStore.getState());
      return () => {};
    });
    renderComposer();
    expect(editor().value).toBe('');
    useDraftsStore.setState({
      drafts: {
        [DRAFT_KEY]: { kind: 'comment-new', issueKey: ISSUE_KEY, text: 'late', updatedAt: 1 },
      },
    });
    hydratedSpy.mockReturnValue(true);
    act(() => finish?.());
    expect(editor().value).toBe('late');
    unsub.mockRestore();
  });

  it('does not overwrite text the user typed before hydration finished', () => {
    hydratedSpy.mockReturnValue(false);
    let finish: (() => void) | undefined;
    const unsub = vi.spyOn(useDraftsStore.persist, 'onFinishHydration').mockImplementation((fn) => {
      finish = () => fn(useDraftsStore.getState());
      return () => {};
    });
    renderComposer();
    fireEvent.change(editor(), { target: { value: 'typed first' } });
    useDraftsStore.setState({
      drafts: {
        [DRAFT_KEY]: { kind: 'comment-new', issueKey: ISSUE_KEY, text: 'late', updatedAt: 1 },
      },
    });
    hydratedSpy.mockReturnValue(true);
    act(() => finish?.());
    expect(editor().value).toBe('typed first');
    unsub.mockRestore();
  });
});

describe('CommentComposer — post-mutation invalidation (PERF-DETAIL-03)', () => {
  it('invalidates jira-issue-comments with the issue key and base URL after a post', async () => {
    mockPostComment.mockResolvedValue(undefined as never);
    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const user = userEvent.setup();
    renderComposer(qc);
    await user.type(editor(), 'Scoped invalidation test');
    await user.click(commentButton());
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => (c[0] as { queryKey?: unknown[] }).queryKey);
      expect(keys).toContainEqual(['jira-issue-comments', ISSUE_KEY, JIRA_BASE_URL]);
    });
  });
});

describe('CommentComposer — ported from IssueDetailSheet (ISSUE-08)', () => {
  it('calls postComment with issueKey and compose box text on submit', async () => {
    mockPostComment.mockResolvedValue(undefined as never);
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <CommentComposer issueKey="PROJ-1" jiraBaseUrl="https://jira.example.com" />
      </QueryClientProvider>,
    );
    fireEvent.change(editor(), { target: { value: 'My new comment' } });
    fireEvent.click(commentButton());
    await waitFor(() =>
      expect(mockPostComment).toHaveBeenCalledWith(
        'https://jira.example.com',
        'mock-token',
        'PROJ-1',
        'My new comment',
      ),
    );
  });

  it('clears compose box after successful submission', async () => {
    mockPostComment.mockResolvedValue(undefined as never);
    renderComposer();
    fireEvent.change(editor(), { target: { value: 'My new comment' } });
    fireEvent.click(commentButton());
    await waitFor(() => expect(editor().value).toBe(''));
  });
});
