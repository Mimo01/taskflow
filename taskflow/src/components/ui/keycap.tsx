export const keycapClass =
  'inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 text-[11px] font-medium font-mono bg-gradient-to-b from-muted to-muted/80 text-muted-foreground border border-border/80 rounded-[4px] shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]';

export function Keycap({ children }: { children: React.ReactNode }) {
  return <kbd className={keycapClass}>{children}</kbd>;
}
