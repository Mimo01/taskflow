import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FindBar } from './FindBar';

class FakeHighlight {
  ranges: Range[];
  priority = 0;
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

let scope: HTMLElement;
let scrollSpy: ReturnType<typeof vi.fn>;
const g = globalThis as unknown as Record<string, unknown>;
const proto = Element.prototype as unknown as Record<string, unknown>;

function renderBar(extra: Partial<React.ComponentProps<typeof FindBar>> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <FindBar scope={scope} kind="main" focusSignal={0} onClose={onClose} {...extra} />,
  );
  return { onClose, ...utils };
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText('Find in page'), { target: { value } });
}

function hl(name: string) {
  return (CSS as unknown as { highlights: Map<string, FakeHighlight> }).highlights.get(name);
}

beforeEach(() => {
  scope = document.createElement('main');
  scope.innerHTML = '<p>Café one</p><p>café two</p>';
  scope.setAttribute('data-find-scope', 'main');
  document.body.append(scope);
  g.Highlight = FakeHighlight;
  (CSS as unknown as { highlights: Map<string, FakeHighlight> }).highlights = new Map();
  scrollSpy = vi.fn();
  proto.scrollIntoView = scrollSpy;
  proto.checkVisibility = () => true;
});

afterEach(() => {
  scope.remove();
  delete g.Highlight;
  delete (CSS as unknown as Record<string, unknown>).highlights;
  delete proto.scrollIntoView;
  delete proto.checkVisibility;
  vi.useRealTimers();
});

describe('FindBar', () => {
  it('counts matches and sets highlights', () => {
    renderBar();
    type('cafe');
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(hl('find-all')?.ranges).toHaveLength(2);
    expect(hl('find-current')?.ranges).toHaveLength(1);
  });

  it('navigates with Enter / Shift+Enter and wraps', () => {
    renderBar();
    type('cafe');
    const input = screen.getByLabelText('Find in page');
    scrollSpy.mockClear();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2/2')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('1/2')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('2/2')).toBeTruthy();
    expect(scrollSpy).toHaveBeenCalledTimes(3);
  });

  it('closes when its scope element is removed from the document', async () => {
    const wrapper = document.createElement('div');
    document.body.append(wrapper);
    wrapper.append(scope);
    const { onClose } = renderBar();
    wrapper.remove();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows No results and clears on empty query', () => {
    renderBar();
    type('zzz');
    expect(screen.getByText('No results')).toBeTruthy();
    type('cafe');
    type('');
    expect(hl('find-all')).toBeUndefined();
    expect(hl('find-current')).toBeUndefined();
    expect(screen.queryByText(/\d\/\d/)).toBeNull();
  });

  it('Escape closes without propagating and unmount clears highlights', () => {
    const docListener = vi.fn();
    document.addEventListener('keydown', docListener);
    const { onClose, unmount } = renderBar();
    type('cafe');
    fireEvent.keyDown(screen.getByLabelText('Find in page'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(docListener).not.toHaveBeenCalled();
    document.removeEventListener('keydown', docListener);
    unmount();
    expect(hl('find-all')).toBeUndefined();
    expect(hl('find-current')).toBeUndefined();
  });

  it('recomputes live on DOM mutation without scrolling', async () => {
    renderBar();
    type('cafe');
    vi.useFakeTimers();
    scrollSpy.mockClear();
    await act(async () => {
      const p = document.createElement('p');
      p.textContent = 'another café';
      scope.append(p);
      await Promise.resolve();
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText(/\/3$/)).toBeTruthy();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('ignores mutations inside the find bar', async () => {
    scope.removeAttribute('data-find-scope');
    scope.setAttribute('data-slot', 'dialog-content');
    renderBar({ kind: 'modal' });
    vi.useFakeTimers();
    await act(async () => {
      type('cafe'); // counter text mutates inside [data-find-bar] within scope
      await Promise.resolve();
    });
    const before = hl('find-all');
    expect(before).toBeDefined();
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(300);
    });
    expect(hl('find-all')).toBe(before);
  });

  it('re-focuses and selects on focusSignal change', () => {
    const { rerender, onClose } = renderBar();
    const input = screen.getByLabelText('Find in page') as HTMLInputElement;
    type('cafe');
    input.blur();
    rerender(<FindBar scope={scope} kind="main" focusSignal={1} onClose={onClose} />);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(4);
  });

  it('works without the Highlight API', () => {
    delete g.Highlight;
    delete (CSS as unknown as Record<string, unknown>).highlights;
    renderBar();
    type('cafe');
    expect(screen.getByText('1/2')).toBeTruthy();
  });
});
