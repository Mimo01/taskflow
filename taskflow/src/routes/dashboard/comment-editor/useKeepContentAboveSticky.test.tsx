import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollParent, useKeepContentAboveSticky } from './useKeepContentAboveSticky';

let fire: (() => void) | null = null;
const OriginalRO = global.ResizeObserver;

function Harness() {
  const ref = useKeepContentAboveSticky();
  return (
    <div data-testid="scroller" style={{ overflowY: 'auto' }}>
      <div>
        <div data-testid="sticky" ref={ref} />
      </div>
    </div>
  );
}

function setHeight(el: HTMLElement, h: number) {
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: h });
}

describe('useKeepContentAboveSticky', () => {
  afterEach(() => {
    global.ResizeObserver = OriginalRO;
    fire = null;
  });

  function mount() {
    global.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        fire = () => cb([], this as unknown as ResizeObserver);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const utils = render(<Harness />);
    const scroller = utils.getByTestId('scroller');
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as unknown as typeof scroller.scrollBy;
    return { ...utils, sticky: utils.getByTestId('sticky'), scrollBy };
  }

  it('scrolls the container by the growth when the strip expands', () => {
    const { sticky, scrollBy } = mount();
    setHeight(sticky, 190);
    fire?.();
    // offsetHeight was 0 in jsdom at mount; growth is the full new height
    expect(scrollBy).toHaveBeenCalledWith({ top: 190 });
  });

  it('does not scroll when the strip shrinks or keeps its height', () => {
    const { sticky, scrollBy } = mount();
    setHeight(sticky, 190);
    fire?.();
    scrollBy.mockClear();
    setHeight(sticky, 190);
    fire?.();
    setHeight(sticky, 56);
    fire?.();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('scrollParent finds the nearest vertically scrolling ancestor', () => {
    const { sticky, getByTestId } = mount();
    expect(scrollParent(sticky)).toBe(getByTestId('scroller'));
  });
});
