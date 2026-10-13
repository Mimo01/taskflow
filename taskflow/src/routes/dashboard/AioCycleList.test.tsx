import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AioCycleList } from './AioCycleList';

function renderList(props: { isLoading: boolean; isPending: boolean }) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AioCycleList
          projectKey="PROJ"
          folderLabel="All cycles"
          folderTitle="All cycles"
          items={[]}
          error={null}
          onRetry={() => {}}
          summaryByID={{}}
          summariesLoading={false}
          statusConfig={[]}
          token={null}
          jiraBaseUrl={undefined}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AioCycleList pending state', () => {
  it('does not flash the empty state during the skeleton grace period', () => {
    renderList({ isLoading: false, isPending: true });
    expect(screen.queryByText('No cycles in this folder')).toBeNull();
  });
  it('shows the empty state once loaded with no cycles', () => {
    renderList({ isLoading: false, isPending: false });
    expect(screen.getByText('No cycles in this folder')).toBeTruthy();
  });
});
