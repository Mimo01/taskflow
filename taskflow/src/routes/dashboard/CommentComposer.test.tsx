/**
 * CommentComposer — PERF-DETAIL-03 post-mutation invalidation test.
 *
 * Asserts that a successful comment POST invalidates both:
 *   - ['jira-issue-detail', issueKey, jiraBaseUrl]  (base key)
 *   - ['jira-issue-comments', issueKey, jiraBaseUrl] (section key — the gap)
 *
 * Mirrors the vi.spyOn(queryClient,'invalidateQueries') pattern used in
 * IssueDetailPage.progressive.test.tsx.
 */

// --- Mocks (hoisted before imports) ---

vi.mock('@/services/jira', () => ({
  postComment: vi.fn(),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

// MentionPopover has unresolvable deps in jsdom; stub it out.
vi.mock('./MentionPopover', () => ({
  MentionPopover: vi.fn().mockReturnValue(null),
}));

// --- Imports ---

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postComment } from '@/services/jira';

import { CommentComposer } from './CommentComposer';

// --- Constants ---

const ISSUE_KEY = 'PROJ-42';
const JIRA_BASE_URL = 'https://jira.example.com';

// --- Helpers ---

const mockPostComment = vi.mocked(postComment);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderComposer(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <CommentComposer issueKey={ISSUE_KEY} jiraBaseUrl={JIRA_BASE_URL} />
    </QueryClientProvider>,
  );
}

// --- Tests ---

describe('CommentComposer — post mutation invalidation (PERF-DETAIL-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successful comment post invalidates jira-issue-comments key', async () => {
    mockPostComment.mockResolvedValue(undefined as never);

    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const user = userEvent.setup();
    renderComposer(qc);

    // Type a comment into the textarea
    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'Hello world');

    // Submit via the Comment button
    const submitButton = screen.getByRole('button', { name: 'Comment' });
    await user.click(submitButton);

    // Wait for postComment to be called
    await waitFor(() => expect(mockPostComment).toHaveBeenCalled());

    // Assert jira-issue-comments was invalidated
    await waitFor(() => {
      const calls = spy.mock.calls.map((c) => c[0]);
      const invalidatedKeys = calls.map((arg) => (arg as { queryKey?: unknown[] }).queryKey);
      expect(
        invalidatedKeys.some(
          (key) => Array.isArray(key) && key[0] === 'jira-issue-comments',
        ),
      ).toBe(true);
    });
  });

  it('successful comment post also invalidates jira-issue-detail base key', async () => {
    mockPostComment.mockResolvedValue(undefined as never);

    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const user = userEvent.setup();
    renderComposer(qc);

    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'Another comment');

    const submitButton = screen.getByRole('button', { name: 'Comment' });
    await user.click(submitButton);

    await waitFor(() => expect(mockPostComment).toHaveBeenCalled());

    await waitFor(() => {
      const calls = spy.mock.calls.map((c) => c[0]);
      const invalidatedKeys = calls.map((arg) => (arg as { queryKey?: unknown[] }).queryKey);
      expect(
        invalidatedKeys.some(
          (key) => Array.isArray(key) && key[0] === 'jira-issue-detail',
        ),
      ).toBe(true);
    });
  });

  it('invalidates jira-issue-comments with the correct issueKey and jiraBaseUrl', async () => {
    mockPostComment.mockResolvedValue(undefined as never);

    const qc = makeQueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const user = userEvent.setup();
    renderComposer(qc);

    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'Scoped invalidation test');

    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(mockPostComment).toHaveBeenCalled());

    await waitFor(() => {
      const calls = spy.mock.calls.map((c) => c[0]);
      const matched = calls.find((arg) => {
        const key = (arg as { queryKey?: unknown[] }).queryKey;
        return (
          Array.isArray(key) &&
          key[0] === 'jira-issue-comments' &&
          key[1] === ISSUE_KEY &&
          key[2] === JIRA_BASE_URL
        );
      });
      expect(matched).toBeTruthy();
    });
  });
});
