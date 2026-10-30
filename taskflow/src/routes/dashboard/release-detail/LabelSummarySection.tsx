import { Tag } from 'lucide-react';

interface LabelSummarySectionProps {
  milestoneMRsLoaded: boolean;
  labelSummary: Array<{
    label: { name: string; color: string; text_color: string };
    count: number;
  }>;
}

export function LabelSummarySection({
  milestoneMRsLoaded,
  labelSummary,
}: LabelSummarySectionProps) {
  if (!milestoneMRsLoaded || labelSummary.length === 0) return null;
  return (
    <section
      data-testid="label-summary-section"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-6 pt-4"
    >
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Tag className="size-3.5 text-muted-foreground" />
        Labels
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {labelSummary.map((l) => (
          <span
            key={l.label.name}
            className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: l.label.color,
              color: l.label.text_color,
              borderColor: `${l.label.color}80`,
            }}
          >
            {l.label.name} ({l.count})
          </span>
        ))}
      </div>
    </section>
  );
}
