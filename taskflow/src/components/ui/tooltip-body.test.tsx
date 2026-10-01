import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('dashed gives a dashed-border swatch', () => {
    const { container } = render(
      <TooltipRow dashed color="rgb(4, 5, 6)" label="Forecast" value="2" />,
    );
    const swatch = container.querySelector('[data-slot="tooltip-row"] span') as HTMLElement;
    expect(swatch.className).toContain('border-dashed');
    expect(swatch.style.borderColor).toBe('rgb(4, 5, 6)');
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

  it('a row with no colour gets a visible neutral dot', () => {
    const { container } = render(<TooltipRow label="Likely" value="Oct 7" />);
    const m = container.querySelector('[data-slot="tooltip-row"] > span') as HTMLElement;
    expect(m.className).toContain('rounded-full');
    expect(m.style.background).not.toBe('transparent');
    expect(m.style.background).not.toBe('');
  });

  it('marker line gives a short horizontal bar in the colour', () => {
    const { container } = render(
      <TooltipRow marker="line" color="rgb(7, 8, 9)" label="Remaining" value="2" />,
    );
    const m = container.querySelector('[data-slot="tooltip-row"] > span') as HTMLElement;
    expect(m.className).toContain('h-0.5');
    expect(m.style.background).toContain('rgb(7, 8, 9)');
  });

  it('icon renders inside the marker slot, coloured, with no extra text', () => {
    const { container } = render(
      <TooltipRow icon={<svg data-testid="ic" />} color="rgb(1, 1, 1)" label="Risk" value="2" />,
    );
    const row = container.querySelector('[data-slot="tooltip-row"]') as HTMLElement;
    const m = row.children[0] as HTMLElement;
    expect(m.querySelector('[data-testid="ic"]')).not.toBeNull();
    expect(m.style.color).toBe('rgb(1, 1, 1)');
    expect(m.textContent).toBe('');
    expect(row.children).toHaveLength(3);
  });
});
