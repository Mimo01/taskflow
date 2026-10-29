export function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  // WR-05: a stable, label-derived test hook that survives arbitrary
  // className/layout changes to this row — the D-12 "no interactive control"
  // regression lock scopes to this attribute rather than a Tailwind selector.
  const slug = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div
      className="flex items-start gap-2 @max-[240px]:flex-col @max-[240px]:gap-0.5"
      data-testid={`meta-row-${slug}`}
    >
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5 @max-[240px]:w-auto">
        {label}
      </span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}
