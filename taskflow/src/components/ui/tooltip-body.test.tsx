import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from './tooltip-body';

describe('tooltip-body', () => {
  it('TOOLTIP_SURFACE is the ring surface', () => {
    expect(TOOLTIP_SURFACE).toContain('ring-1');
    expect(TOOLTIP_SURFACE).toContain('rounded-lg');
  });

  it('TooltipRow renders swatch, label, value and sub as direct children', () => {
    const { container } = render(
      <TooltipRow color="rgb(1, 2, 3)" label="Done" value="5" sub="50%" />,
    );
    const row = container.querySelector('[data-slot="tooltip-row"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.children).toHaveLength(4);
    expect((row.children[0] as HTMLElement).style.background).toContain('rgb(1, 2, 3)');
    expect(row.children[1].textContent).toBe('Done');
    expect(row.children[2].textContent).toBe('5');
    expect(row.children[3].textContent).toBe('50%');
  });

  it('dashed gives a dashed neutral border glyph', () => {
    const { container } = render(
      <TooltipRow marker="dashed" color="rgb(4, 5, 6)" label="Forecast" value="2" />,
    );
    const glyph = container.querySelector('[data-slot="tooltip-row"] span') as HTMLElement;
    expect(glyph.className).toContain('border-dashed');
    expect(glyph.style.borderColor).toBe('var(--color-muted-foreground)');
  });

  it('TooltipBody renders title and a muted note', () => {
    const { getByText } = render(
      <TooltipBody title="Amy" note="a note">
        <TooltipRow label="Done" value="1" />
      </TooltipBody>,
    );
    expect(getByText('Amy')).toBeInTheDocument();
    const note = getByText('a note');
    expect(note.className).toContain('text-muted-foreground');
    expect(note.className).toContain('border-t');
  });

  it('a row with no colour or icon gets a muted line glyph', () => {
    const { container } = render(<TooltipRow label="Likely" value="Oct 7" />);
    const m = container.querySelector('[data-slot="tooltip-row"] > span') as HTMLElement;
    expect(m.getAttribute('data-marker')).toBe('line');
    expect(m.getAttribute('data-tone')).toBe('muted');
    expect(m.style.background).toBe('var(--color-muted-foreground)');
  });

  it('marker line gives a short horizontal bar in the tone colour, ignoring color', () => {
    const { container } = render(
      <TooltipRow marker="line" tone="strong" color="rgb(7, 8, 9)" label="Remaining" value="2" />,
    );
    const m = container.querySelector('[data-slot="tooltip-row"] > span') as HTMLElement;
    expect(m.className).toContain('h-0.5');
    expect(m.getAttribute('data-tone')).toBe('strong');
    expect(m.style.background).toBe('var(--color-foreground)');
    expect(m.style.background).not.toContain('rgb(7, 8, 9)');
  });

  it('marker band gives a neutral translucent fill', () => {
    const { container } = render(<TooltipRow marker="band" label="Range" value="1–2" />);
    const m = container.querySelector('[data-slot="tooltip-row"] > span') as HTMLElement;
    expect(m.getAttribute('data-marker')).toBe('band');
    expect(m.className).toContain('opacity-30');
    expect(m.style.background).toBe('var(--color-muted-foreground)');
  });

  it('icon renders inside the marker slot, muted, with no extra text', () => {
    const { container } = render(
      <TooltipRow icon={<svg data-testid="ic" />} color="rgb(1, 1, 1)" label="Risk" value="2" />,
    );
    const row = container.querySelector('[data-slot="tooltip-row"]') as HTMLElement;
    const m = row.children[0] as HTMLElement;
    expect(m.getAttribute('data-marker')).toBe('icon');
    expect(m.querySelector('[data-testid="ic"]')).not.toBeNull();
    expect(m.className).toContain('text-muted-foreground');
    expect(m.style.color).toBe('');
    expect(m.textContent).toBe('');
    expect(row.children).toHaveLength(3);
  });

  it('no neutral marker renders a status colour', () => {
    const statusColors = Object.values(STATUS_CATEGORY_COLOR);
    for (const marker of ['line', 'dashed', 'band'] as const) {
      const { container } = render(
        <TooltipRow marker={marker} color={statusColors[0]} label="x" value="1" />,
      );
      const html = container.innerHTML;
      for (const c of statusColors) expect(html).not.toContain(c);
    }
  });
});
