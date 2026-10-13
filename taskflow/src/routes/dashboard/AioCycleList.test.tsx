import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AioCycleList } from './AioCycleList';

const cycle = (ID: number) => ({
  ID,
  jiraProjectID: 1,
  detail: {
    key: `PROJ-CY-${ID}`,
    title: `Cycle ${ID}`,
    ownedByID: '',
    folder: null,
    isClosed: false,
    startDate: null,
    endDate: null,
  },
  summary: null,
});

function renderList(props: {
  isLoading: boolean;
  isPending: boolean;
  items?: ReturnType<typeof cycle>[];
}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AioCycleList
          projectKey="PROJ"
          folderLabel="All cycles"
          folderTitle="All cycles"
          items={props.items ?? []}
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

describe('AioCycleList large lists', () => {
  it('renders every row for small folders', () => {
    renderList({ isLoading: false, isPending: false, items: [1, 2, 3].map(cycle) });
    expect(screen.getAllByTestId(/^cycle-row-/)).toHaveLength(3);
  });
  it('does not mount all rows when there are many cycles', () => {
    const items = Array.from({ length: 1300 }, (_, i) => cycle(i + 1));
    renderList({ isLoading: false, isPending: false, items });
    expect(screen.queryAllByTestId(/^cycle-row-/).length).toBeLessThan(100);
  });
});
