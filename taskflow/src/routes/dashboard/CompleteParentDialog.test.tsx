import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/jira/parentCompletion', () => ({
  checkParentCompletion: vi.fn(),
  invalidateAfterTransition: vi.fn(),
}));
vi.mock('@/services/jira/transitions', async (orig) => ({
  ...(await orig<typeof import('@/services/jira/transitions')>()),
  postTransition: vi.fn(),
  fetchIssueTransitionsWithFields: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));

import { checkParentCompletion, invalidateAfterTransition } from '@/services/jira/parentCompletion';
import { fetchIssueTransitionsWithFields, postTransition } from '@/services/jira/transitions';
import type { JiraTransitionFieldMeta } from '@/services/jira/types';
import { useParentCompletionStore } from '@/stores/parent-completion.store';
import type { ParentCheckArgs } from './CompleteParentDialog';
import { ParentCompletionHost, useParentCompletionPrompt } from './CompleteParentDialog';

const BASE = 'https://j.example.com';
const PROMPT = {
  shouldPrompt: true as const,
  parentKey: 'P-1',
  parentSummary: 'The story',
  parentStatusId: '3',
  parentStatusName: 'In Progress',
  parentStatusCategory: 'indeterminate',
  parentIssueType: 'Story',
  parentPriority: 'Must',
  parentAssignee: 'Ada L',
  subtaskCount: 3,
};
const GOOD: ParentCheckArgs = {
  issueKey: 'S-1',
  parentKey: 'P-1',
  isSubtask: true,
  fromCategory: 'indeterminate',
  toCategory: 'done',
};

function Trigger({ args, label = 'run-check' }: { args: ParentCheckArgs; label?: string }) {
  const { check } = useParentCompletionPrompt({ jiraBaseUrl: BASE, boardId: 5 });
  return (
    <button type="button" onClick={() => void check(args)}>
      {label}
    </button>
  );
}

function Harness({ args }: { args: ParentCheckArgs }) {
  return (
    <>
      <Trigger args={args} />
      <ParentCompletionHost />
    </>
  );
}

function setup(args: ParentCheckArgs = GOOD) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Harness args={args} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const doneT = (id: string, name: string, fields?: Record<string, JiraTransitionFieldMeta>) => ({
  id,
  name,
  to: { id: `s${id}`, name, statusCategory: { key: 'done' } },
  fields,
});

describe('useParentCompletionPrompt + CompleteParentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParentCompletionStore.setState({ queue: [] });
    vi.mocked(checkParentCompletion).mockResolvedValue(PROMPT);
  });

  it.each([
    ['not a subtask', { ...GOOD, isSubtask: false }],
    ['no parent', { ...GOOD, parentKey: undefined }],
    ['target not done', { ...GOOD, toCategory: 'indeterminate' }],
    ['done -> done', { ...GOOD, fromCategory: 'done' }],
  ])('skips the check entirely: %s', async (_n, args) => {
    const user = setup(args);
    await user.click(screen.getByText('run-check'));
    await new Promise((r) => setTimeout(r, 10));
    expect(checkParentCompletion).not.toHaveBeenCalled();
    expect(screen.queryByText(/All subtasks of/)).toBeNull();
  });

  it('opens the ask step when the check says to prompt', async () => {
    const user = setup();
    await user.click(screen.getByText('run-check'));
    expect(await screen.findByText('All subtasks of P-1 are done')).toBeTruthy();
    expect(checkParentCompletion).toHaveBeenCalledWith(BASE, 'tok', 'S-1', 'P-1');
    expect(screen.getByText('The story')).toBeTruthy();
    expect(screen.getByText('Story')).toBeTruthy();
    expect(screen.getByText('Ada L')).toBeTruthy();
    expect(screen.getByText('Must')).toBeTruthy();
    expect(screen.getByText('3 of 3 done')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Move story/ })).toBeTruthy();
  });

  it('does not open when the check says no', async () => {
    vi.mocked(checkParentCompletion).mockResolvedValue({ shouldPrompt: false });
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await waitFor(() => expect(checkParentCompletion).toHaveBeenCalled());
    expect(screen.queryByText(/All subtasks of/)).toBeNull();
  });

  it('ignores a second check while a prompt is open', async () => {
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await screen.findByText('All subtasks of P-1 are done');
    await user.click(screen.getByText('run-check'));
    expect(checkParentCompletion).toHaveBeenCalledTimes(1);
  });

  it('Not now closes without posting', async () => {
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText(/All subtasks of/)).toBeNull());
    expect(postTransition).not.toHaveBeenCalled();
  });

  it('lists only done transitions, even a single one, and posts a plain one', async () => {
    vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([
      doneT('11', 'Done'),
      {
        id: '12',
        name: 'Start',
        to: { id: 's12', name: 'Doing', statusCategory: { key: 'indeterminate' } },
      },
    ]);
    vi.mocked(postTransition).mockResolvedValue(undefined);
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    expect(await screen.findByRole('button', { name: /In Progress\s*Done/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Doing' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /In Progress\s*Done/ }));
    await waitFor(() =>
      expect(postTransition).toHaveBeenCalledWith(BASE, 'tok', 'P-1', '11', undefined),
    );
    expect(invalidateAfterTransition).toHaveBeenCalledWith(expect.anything(), 'P-1', BASE, 5);
    await waitFor(() => expect(screen.queryByText(/All subtasks of/)).toBeNull());
  });

  it('shows an empty message when there is no done transition', async () => {
    vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([]);
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    expect(await screen.findByText('No done transition available from In Progress')).toBeTruthy();
  });

  it('asks for a resolution and posts it', async () => {
    vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([
      doneT('11', 'Done', {
        resolution: { required: true, allowedValues: [{ id: 'r1', name: 'Fixed' }] },
      }),
    ]);
    vi.mocked(postTransition).mockResolvedValue(undefined);
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    await user.click(await screen.findByRole('button', { name: /In Progress\s*Done/ }));
    expect(await screen.findByText('Set a resolution')).toBeTruthy();
    expect(postTransition).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Fixed/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm move' }));
    await waitFor(() =>
      expect(postTransition).toHaveBeenCalledWith(BASE, 'tok', 'P-1', '11', {
        resolution: { id: 'r1' },
      }),
    );
  });

  it('posts a null resolution when Unresolved is chosen', async () => {
    vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([
      doneT('11', 'Done', {
        resolution: { required: false, allowedValues: [{ id: 'r1', name: 'Fixed' }] },
      }),
    ]);
    vi.mocked(postTransition).mockResolvedValue(undefined);
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    await user.click(await screen.findByRole('button', { name: /In Progress\s*Done/ }));
    await user.click(await screen.findByRole('button', { name: /Unresolved/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm move' }));
    await waitFor(() =>
      expect(postTransition).toHaveBeenCalledWith(BASE, 'tok', 'P-1', '11', { resolution: null }),
    );
  });

  it('blocks with an inline error when a resolution is required but unavailable', async () => {
    vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([
      doneT('11', 'Done', { resolution: { required: true, allowedValues: [] } }),
    ]);
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    await user.click(await screen.findByRole('button', { name: /In Progress\s*Done/ }));
    expect(
      await screen.findByText('This transition requires a resolution but none are available'),
    ).toBeTruthy();
    expect(postTransition).not.toHaveBeenCalled();
  });

  it('shows an inline error and stays open when the POST rejects', async () => {
    vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([doneT('11', 'Done')]);
    vi.mocked(postTransition).mockRejectedValue(new Error('Jira said no'));
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    await user.click(await screen.findByRole('button', { name: /In Progress\s*Done/ }));
    expect(await screen.findByText('Jira said no')).toBeTruthy();
    expect(screen.getByText('All subtasks of P-1 are done')).toBeTruthy();
    expect(invalidateAfterTransition).not.toHaveBeenCalled();
  });

  it('queues a second story prompt instead of dropping it', async () => {
    const user = setup();
    await user.click(screen.getByText('run-check'));
    expect(await screen.findByText('All subtasks of P-1 are done')).toBeTruthy();
    vi.mocked(checkParentCompletion).mockResolvedValue({
      ...PROMPT,
      parentKey: 'P-2',
      parentSummary: 'Other story',
    });
    useParentCompletionStore.getState().enqueue({
      prompt: { ...PROMPT, parentKey: 'P-2', parentSummary: 'Other story' },
      jiraBaseUrl: BASE,
    });
    expect(screen.getByText('All subtasks of P-1 are done')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(await screen.findByText('All subtasks of P-2 are done')).toBeTruthy();
  });

  it('keeps the prompt when the triggering component unmounts mid-check', async () => {
    let resolveCheck: (v: typeof PROMPT) => void = () => {};
    vi.mocked(checkParentCompletion).mockReturnValue(
      new Promise((r) => {
        resolveCheck = r;
      }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={qc}>
        <Trigger args={GOOD} />
        <ParentCompletionHost />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText('run-check'));
    view.rerender(
      <QueryClientProvider client={qc}>
        <ParentCompletionHost />
      </QueryClientProvider>,
    );
    resolveCheck(PROMPT);
    expect(await screen.findByText('All subtasks of P-1 are done')).toBeTruthy();
  });

  it('offers Retry when loading transitions fails', async () => {
    vi.mocked(fetchIssueTransitionsWithFields)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([doneT('11', 'Done')]);
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    expect(await screen.findByText('boom')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /In Progress\s*Done/ })).toBeTruthy();
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('clears a stale error when another transition is picked', async () => {
    const needsRes = doneT('11', 'Done', {
      resolution: { required: true, allowedValues: [] } as unknown as JiraTransitionFieldMeta,
    });
    vi.mocked(fetchIssueTransitionsWithFields).mockResolvedValue([needsRes, doneT('12', 'Closed')]);
    vi.mocked(postTransition).mockResolvedValue(undefined);
    const user = setup();
    await user.click(screen.getByText('run-check'));
    await user.click(await screen.findByRole('button', { name: /Move story/ }));
    await user.click(await screen.findByRole('button', { name: /In Progress\s*Done/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /In Progress\s*Closed/ }));
    await waitFor(() => expect(postTransition).toHaveBeenCalled());
  });
});
