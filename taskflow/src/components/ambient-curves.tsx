import { cn } from '@/lib/utils';

// Ambient hero background curves — orange top-right, cyan bottom-left.
// Restored verbatim from the pre-polish dashboard hero (260521-wbm AMBIENT_CURVES spec).
export const AMBIENT_CURVES: ReadonlyArray<{
  d: string;
  color: 'orange' | 'cyan';
  w: number;
  o: number;
}> = [
  { d: 'M -50 220 Q 400 90 1250 -20', color: 'orange', w: 1, o: 0.35 },
  { d: 'M -50 320 Q 500 160 1250 80', color: 'orange', w: 0.8, o: 0.25 },
  { d: 'M -50 420 Q 600 240 1250 180', color: 'orange', w: 0.6, o: 0.18 },
  { d: 'M -50 760 Q 500 540 1250 380', color: 'cyan', w: 1, o: 0.32 },
  { d: 'M -50 860 Q 600 640 1250 480', color: 'cyan', w: 0.8, o: 0.24 },
  { d: 'M -50 960 Q 700 740 1250 580', color: 'cyan', w: 0.6, o: 0.18 },
  { d: 'M -50 540 Q 550 380 1250 240', color: 'orange', w: 0.5, o: 0.14 },
  { d: 'M -50 660 Q 600 460 1250 320', color: 'cyan', w: 0.5, o: 0.14 },
];

export function AmbientCurves({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 900"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {AMBIENT_CURVES.map((c, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: static constant array, no reorder
          key={i}
          d={c.d}
          fill="none"
          stroke={c.color === 'orange' ? '#f97316' : '#06b6d4'}
          strokeWidth={c.w}
          strokeLinecap="round"
          opacity={c.o}
        />
      ))}
    </svg>
  );
}
