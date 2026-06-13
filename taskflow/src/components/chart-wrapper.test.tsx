import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartWrapper } from './chart-wrapper';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ChartWrapper — loading state', () => {
  it('renders Skeleton when isLoading={true} and does not render children', () => {
    render(
      <ChartWrapper title="Test Chart" isLoading>
        <div>my chart</div>
      </ChartWrapper>,
    );
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    expect(screen.queryByText('my chart')).toBeNull();
  });
});

describe('ChartWrapper — success state', () => {
  it('renders children when no loading/error/empty flags set', () => {
    render(
      <ChartWrapper title="Test Chart">
        <div>my chart</div>
      </ChartWrapper>,
    );
    expect(screen.getByText('my chart')).toBeTruthy();
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull();
  });
});

describe('ChartWrapper — error state', () => {
  it('renders ErrorState and does not render children when error is set', () => {
    render(
      <MemoryRouter>
        <ChartWrapper title="Test Chart" error={new Error('oops')}>
          <div>my chart</div>
        </ChartWrapper>
      </MemoryRouter>,
    );
    expect(screen.getByText("Couldn't load Test Chart")).toBeTruthy();
    expect(screen.queryByText('my chart')).toBeNull();
  });
});

describe('ChartWrapper — empty state', () => {
  it('renders EmptyState with "No data yet" when isEmpty={true} and does not render children', () => {
    render(
      <ChartWrapper title="Test Chart" isEmpty>
        <div>my chart</div>
      </ChartWrapper>,
    );
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.queryByText('my chart')).toBeNull();
  });
});
