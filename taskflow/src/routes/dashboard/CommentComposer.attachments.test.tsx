import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import { useAuthStore } from '@/stores/auth.store';
import { lastStubProps } from '@/test/wiki-editor-stub';

vi.mock(
  '@/components/wiki-editor/WikiEditorLazy',
  async () => (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock,
);

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/services/jira', () => ({
  postComment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/jira/attachments', () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

const BASE_URL = 'https://jira.example.com';

const IMAGE_ATT: JiraAttachment = {
  id: '1',
  filename: 'diagram.png',
  content: `${BASE_URL}/secure/attachment/1/diagram.png`,
  mimeType: 'image/png',
};

const CREATED: JiraAttachment = {
  id: '9',
  filename: 'new.png',
  content: `${BASE_URL}/secure/attachment/9/new.png`,
  mimeType: 'image/png',
};

let qc: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function renderComposer(attachments: JiraAttachment[] = []) {
  const { CommentComposer } = await import('./CommentComposer');
  const view = render(
    <CommentComposer issueKey="PROJ-1" jiraBaseUrl={BASE_URL} attachments={attachments} />,
    { wrapper },
  );
  // Expand the collapsed composer so the editor (and its host) is mounted.
  act(() => screen.getByRole('textbox', { name: 'Add a comment' }).focus());
  return view;
}

describe('CommentComposer attachments (editor host contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ jiraBaseUrl: BASE_URL });
  });

  it('passes the issue attachments to the editor host', async () => {
    await renderComposer([IMAGE_ATT]);
    expect(lastStubProps.current?.host?.attachments).toEqual([IMAGE_ATT]);
  });

  it('host.uploadFile uploads to the composer issue and returns the created attachment', async () => {
    vi.mocked(uploadAttachment).mockResolvedValue([CREATED]);
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await renderComposer();
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    const result = await lastStubProps.current?.host?.uploadFile?.(file);
    expect(uploadAttachment).toHaveBeenCalledWith(BASE_URL, 'test-jira-token', 'PROJ-1', file);
    expect(result).toEqual(CREATED);
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey?: unknown[] }).queryKey);
    expect(keys).toContainEqual(['jira-issue-detail', 'PROJ-1', BASE_URL]);
  });

  it('host.uploadFile rejects when the upload fails', async () => {
    vi.mocked(uploadAttachment).mockRejectedValue(new Error('too large'));
    await renderComposer();
    const file = new File(['x'], 'big.png', { type: 'image/png' });
    await expect(lastStubProps.current?.host?.uploadFile?.(file)).rejects.toThrow('too large');
  });
});
