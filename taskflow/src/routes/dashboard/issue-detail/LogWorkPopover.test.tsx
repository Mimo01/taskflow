import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LogWorkPopover } from './LogWorkPopover';

const { createWorklog } = vi.hoisted(() => ({
  createWorklog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/jira/worklogs', () => ({ createWorklog }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('tok') }));

describe('LogWorkPopover', () => {
  it('refreshes list views (jira-issues caches) after logging work', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <LogWorkPopover issueKey="A-1" jiraBaseUrl="https://j" open hideTrigger />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. 2h 30m'), { target: { value: '1h' } });
    fireEvent.click(screen.getByRole('button', { name: /log/i }));

    await waitFor(() => expect(createWorklog).toHaveBeenCalled());
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['jira-issues'] }));
    // Must not touch the issue-detail query (races the worklogs refetch → duplicate entries).
    expect(invalidate).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['jira-issue-detail']) }),
    );
  });
});
