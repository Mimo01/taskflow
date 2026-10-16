import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HighlightedText } from './HighlightedText';

describe('highlight', () => {
  it('renders two marks with matched substrings', () => {
    const { container } = render(
      <HighlightedText
        text="Cart and cart"
        ranges={[
          [0, 4],
          [9, 13],
        ]}
      />,
    );
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe('Cart');
    expect(marks[1].textContent).toBe('cart');
    expect(container.textContent).toBe('Cart and cart');
  });

  it('renders no marks without ranges', () => {
    const { container } = render(<HighlightedText text="hello" />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    const empty = render(<HighlightedText text="hello" ranges={[]} />);
    expect(empty.container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('hello');
  });

  it('caps marks at 6', () => {
    const ranges = Array.from({ length: 8 }, (_, i) => [i * 2, i * 2 + 1] as [number, number]);
    const { container } = render(<HighlightedText text={'ab'.repeat(10)} ranges={ranges} />);
    expect(container.querySelectorAll('mark').length).toBe(6);
  });

  it('clamps out-of-bounds and merges overlapping ranges', () => {
    const { container } = render(
      <HighlightedText
        text="abcdef"
        ranges={[
          [2, 4],
          [3, 5],
          [4, 99],
          [-5, 1],
        ]}
      />,
    );
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe('a');
    expect(marks[1].textContent).toBe('cdef');
    expect(container.textContent).toBe('abcdef');
  });

  it('renders HTML payloads as literal text', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const { container } = render(<HighlightedText text={payload} ranges={[[0, 4]]} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe(payload);
  });

  it('applies the underline-only mark classes', () => {
    const { container } = render(<HighlightedText text="abc" ranges={[[0, 1]]} />);
    const mark = container.querySelector('mark');
    for (const c of [
      'bg-transparent',
      'text-inherit',
      'underline',
      'decoration-primary/60',
      'underline-offset-2',
    ]) {
      expect(mark?.classList.contains(c)).toBe(true);
    }
  });
});
