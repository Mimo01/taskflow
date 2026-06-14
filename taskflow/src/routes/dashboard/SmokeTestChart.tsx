// SCAFFOLD: smoke-test only — remove when Phase 83 rebuilds Dashboard
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const data = [
  { name: 'Mon', value: 12 },
  { name: 'Tue', value: 19 },
  { name: 'Wed', value: 8 },
  { name: 'Thu', value: 15 },
  { name: 'Fri', value: 22 },
];

const chartConfig = {
  value: { label: 'Value', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function SmokeTestChart() {
  return (
    <ChartWrapper
      title="Chart smoke test"
      description="Verifies charting stack — temporary scaffold"
      height={240}
    >
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--chart-1)" isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </ChartWrapper>
  );
}
