import type { ReactNode } from 'react';

type Range = readonly [number, number];

const MAX_MARKS = 6;

interface HighlightedTextProps {
  text: string;
  ranges?: ReadonlyArray<Range>;
  className?: string;
}

/** Clamp to text bounds, drop empties, sort and merge overlaps, cap at MAX_MARKS. */
function normalizeRanges(ranges: ReadonlyArray<Range>, length: number): Array<[number, number]> {
  const clamped = ranges
    .map(
      ([s, e]) =>
        [Math.max(0, Math.min(s, length)), Math.max(0, Math.min(e, length))] as [number, number],
    )
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of clamped) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged.slice(0, MAX_MARKS);
}

/**
 * Renders text with matched ranges wrapped in React <mark> elements (underline only).
 * Never uses innerHTML: Jira text is user-controlled (T-92-02).
 */
export function HighlightedText({ text, ranges, className }: HighlightedTextProps) {
  const normalized = ranges && ranges.length > 0 ? normalizeRanges(ranges, text.length) : [];
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of normalized) {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark
        key={start}
        className="bg-transparent text-inherit underline decoration-primary/60 underline-offset-2"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <span className={className}>{nodes.length > 0 ? nodes : text}</span>;
}
