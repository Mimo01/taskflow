import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
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

describe('ChartWrapper — recharts integration', () => {
  it('mounts a real recharts chart surface under jsdom', () => {
    const chartConfig = {
      value: { label: 'Value', color: 'var(--chart-1)' },
    } satisfies ChartConfig;
    const data = [
      { name: 'Mon', value: 12 },
      { name: 'Tue', value: 19 },
    ];

    render(
      <ChartWrapper title="Integration Chart">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Bar dataKey="value" fill="var(--chart-1)" isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </ChartWrapper>,
    );

    // Asserts the shadcn chart slot and the recharts SVG surface both mount —
    // guards the recharts + ResizeObserver-mock integration against regressions.
    expect(document.querySelector('[data-slot="chart"]')).toBeTruthy();
    expect(document.querySelector('.recharts-surface')).toBeTruthy();
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
