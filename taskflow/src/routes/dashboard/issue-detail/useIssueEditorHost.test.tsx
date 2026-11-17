import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAttachment, uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useIssueEditorHost } from './useIssueEditorHost';

vi.mock('@/services/jira/attachments');
vi.mock('@/services/stronghold');

const att = { id: '9', filename: 'a.png' } as never;
const KEY = ['jira-issue-detail', 'ABC-1', 'https://j'];
const emptyAttachments: never[] = [];
const emptyMap = {};

function setup(over: { issueKey?: string | null } = {}) {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const initial = {
    issueKey: 'ABC-1' as string | null,
    attachments: emptyAttachments,
    userMap: emptyMap,
    referenceTexts: ['see !a.png!'] as string[],
    ...over,
  };
  const hook = renderHook((p: typeof initial) => useIssueEditorHost(p), {
    wrapper,
    initialProps: initial,
  });
  return { ...hook, spy, initial };
}

describe('useIssueEditorHost', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ jiraBaseUrl: 'https://j' } as never);
    vi.mocked(readSecret).mockResolvedValue('tok');
  });

  it('uploadFile uploads, invalidates and returns first created', async () => {
    vi.mocked(uploadAttachment).mockResolvedValue([att]);
    const { result, spy } = setup();
    const file = new File(['x'], 'a.png');
    await expect(result.current.uploadFile?.(file)).resolves.toBe(att);
    expect(uploadAttachment).toHaveBeenCalledWith('https://j', 'tok', 'ABC-1', file);
    expect(spy).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('uploadFile rejects without token, base URL or result', async () => {
    const f = new File(['x'], 'a.png');
    vi.mocked(readSecret).mockResolvedValue(null as never);
    await expect(setup().result.current.uploadFile?.(f)).rejects.toThrow();
    vi.mocked(readSecret).mockResolvedValue('tok');
    useAuthStore.setState({ jiraBaseUrl: null } as never);
    await expect(setup().result.current.uploadFile?.(f)).rejects.toThrow();
    useAuthStore.setState({ jiraBaseUrl: 'https://j' } as never);
    vi.mocked(uploadAttachment).mockResolvedValue([]);
    await expect(setup().result.current.uploadFile?.(f)).rejects.toThrow();
  });

  it('deleteAttachment deletes and invalidates', async () => {
    vi.mocked(deleteAttachment).mockResolvedValue(undefined);
    const { result, spy } = setup();
    await result.current.deleteAttachment?.('9');
    expect(deleteAttachment).toHaveBeenCalledWith('https://j', 'tok', '9');
    expect(spy).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('isReferencedElsewhere checks reference texts', () => {
    const { result } = setup();
    expect(result.current.isReferencedElsewhere?.('a.png')).toBe(true);
    expect(result.current.isReferencedElsewhere?.('b.png')).toBe(false);
  });

  it('is stable across re-renders with equal inputs', () => {
    const { result, rerender, initial } = setup();
    const first = result.current;
    rerender({ ...initial, referenceTexts: ['changed'] });
    expect(result.current).toBe(first);
  });

  it('null issueKey omits upload/delete', () => {
    const { result } = setup({ issueKey: null });
    expect(result.current.uploadFile).toBeUndefined();
    expect(result.current.deleteAttachment).toBeUndefined();
  });
});
