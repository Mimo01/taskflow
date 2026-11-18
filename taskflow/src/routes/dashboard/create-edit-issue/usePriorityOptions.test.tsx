import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatemetaField } from '@/services/jira';
import { usePriorityOptions } from './usePriorityOptions';
import { useCreateEditQueries } from './useCreateEditQueries';

const mocks = vi.hoisted(() => ({
  fetchIssuePriorityOptions: vi.fn(),
  fetchProjectPriorityOptions: vi.fn(),
  fetchPriorities: vi.fn(),
  fetchCreatemeta: vi.fn(),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('pat'),
}));

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ values: [{ id: '1', name: 'Epic', subtask: false }] }),
  }),
}));

vi.mock('@/services/jira', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/jira')>();
  return {
    ...actual,
    fetchIssuePriorityOptions: mocks.fetchIssuePriorityOptions,
    fetchProjectPriorityOptions: mocks.fetchProjectPriorityOptions,
    fetchPriorities: mocks.fetchPriorities,
    fetchCreatemeta: mocks.fetchCreatemeta,
    fetchIssueLinkTypes: vi.fn().mockResolvedValue([]),
  };
});

const P = (id: string, name: string) => ({ id, name, iconUrl: '' });
const BASE = 'https://jira.example.com';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const baseArgs = {
  mode: 'create' as const,
  open: true,
  jiraBaseUrl: BASE,
  projectKey: 'PROJ',
  selectedIssueType: 'Story',
  creatmetaLoading: false,
  issueTypesLoading: false,
};

function priorityField(values: unknown[]): CreatemetaField {
  return {
    fieldId: 'priority',
    name: 'Priority',
    required: false,
    schema: { type: 'priority', allowedValues: values },
  } as unknown as CreatemetaField;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchIssuePriorityOptions.mockResolvedValue([]);
  mocks.fetchProjectPriorityOptions.mockResolvedValue([]);
  mocks.fetchPriorities.mockResolvedValue([P('9', 'Global')]);
});

describe('usePriorityOptions', () => {
  it('uses createmeta allowedValues without hitting the network fetchers', () => {
    const { result } = renderHook(
      () =>
        usePriorityOptions({
          ...baseArgs,
          creatmetaFields: [priorityField([P('1', 'Must')])],
        }),
      { wrapper: wrapper() },
    );
    expect(result.current).toEqual([P('1', 'Must')]);
    expect(mocks.fetchProjectPriorityOptions).not.toHaveBeenCalled();
    expect(mocks.fetchPriorities).not.toHaveBeenCalled();
  });

  it('falls back to the global list when the reference scheme is empty', async () => {
    const { result } = renderHook(
      () => usePriorityOptions({ ...baseArgs, creatmetaFields: [], inheritFromKey: 'EP-1' }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current).toEqual([P('9', 'Global')]));
    expect(mocks.fetchProjectPriorityOptions).toHaveBeenCalledWith(
      BASE,
      'pat',
      'PROJ',
      'Story',
      'EP-1',
    );
  });

  it('uses the reference-issue scheme when present', async () => {
    mocks.fetchProjectPriorityOptions.mockResolvedValue([P('2', 'Scoped')]);
    const { result } = renderHook(() => usePriorityOptions({ ...baseArgs, creatmetaFields: [] }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current).toEqual([P('2', 'Scoped')]));
    expect(mocks.fetchPriorities).not.toHaveBeenCalled();
  });

  it('returns [] while createmeta is loading', () => {
    const { result } = renderHook(
      () => usePriorityOptions({ ...baseArgs, creatmetaLoading: true }),
      { wrapper: wrapper() },
    );
    expect(result.current).toEqual([]);
    expect(mocks.fetchPriorities).not.toHaveBeenCalled();
  });

  it('edit mode loads issue editmeta options', async () => {
    mocks.fetchIssuePriorityOptions.mockResolvedValue([P('3', 'Edit')]);
    const { result } = renderHook(
      () => usePriorityOptions({ ...baseArgs, mode: 'edit', issueKey: 'PROJ-5' }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current).toEqual([P('3', 'Edit')]));
    expect(mocks.fetchIssuePriorityOptions).toHaveBeenCalledWith(BASE, 'pat', 'PROJ-5');
  });
});

describe('useCreateEditQueries epicNameFieldKey', () => {
  it('excludes the Epic Name field from customRequiredFields', async () => {
    const req = (fieldId: string) =>
      ({
        fieldId,
        name: fieldId,
        required: true,
        schema: { type: 'string' },
      }) as unknown as CreatemetaField;
    mocks.fetchCreatemeta.mockResolvedValue([req('customfield_10011'), req('customfield_20000')]);
    const { result } = renderHook(
      () =>
        useCreateEditQueries({
          open: true,
          projectKey: 'PROJ',
          jiraBaseUrl: BASE,
          selectedIssueType: 'Epic' as never,
          epicLinkFieldKey: null,
          storyPointsFieldKey: null,
          epicNameFieldKey: 'customfield_10011',
        }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.customRequiredFields.length).toBeGreaterThan(0));
    expect(result.current.customRequiredFields.map((f) => f.fieldId)).toEqual([
      'customfield_20000',
    ]);
  });
});
