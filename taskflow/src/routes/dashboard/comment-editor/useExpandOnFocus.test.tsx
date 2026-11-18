import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useExpandOnFocus } from './useExpandOnFocus';

function Harness({ hasContent, onBlur }: { hasContent: boolean; onBlur?: () => void }) {
  const x = useExpandOnFocus({ hasContent, onBlur });
  return (
    <div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: test harness for focusout containment */}
      <div {...x.wrapperProps}>
        <button type="button">inner</button>
        <button type="button">inner2</button>
      </div>
      <button type="button">outer</button>
      <span data-testid="state">{x.expanded ? 'open' : 'closed'}</span>
    </div>
  );
}

const state = () => screen.getByTestId('state').textContent;

describe('useExpandOnFocus', () => {
  it('is collapsed without content and expanded with content', () => {
    expect(renderHook(() => useExpandOnFocus({ hasContent: false })).result.current.expanded).toBe(
      false,
    );
    expect(renderHook(() => useExpandOnFocus({ hasContent: true })).result.current.expanded).toBe(
      true,
    );
  });

  it('expand() sets expanded and wantsFocus; focusHandled() resets wantsFocus', () => {
    const { result } = renderHook(() => useExpandOnFocus({ hasContent: false }));
    act(() => result.current.expand());
    expect(result.current.expanded).toBe(true);
    expect(result.current.wantsFocus).toBe(true);
    act(() => result.current.focusHandled());
    expect(result.current.wantsFocus).toBe(false);
    expect(result.current.expanded).toBe(true);
  });

  it('focus expands', () => {
    render(<Harness hasContent={false} />);
    fireEvent.focus(screen.getByText('inner'));
    expect(state()).toBe('open');
  });

  it('blur to inside the wrapper keeps expanded', () => {
    render(<Harness hasContent={false} />);
    fireEvent.focus(screen.getByText('inner'));
    fireEvent.blur(screen.getByText('inner'), { relatedTarget: screen.getByText('inner2') });
    expect(state()).toBe('open');
  });

  it('blur outside with no content collapses', () => {
    render(<Harness hasContent={false} />);
    fireEvent.focus(screen.getByText('inner'));
    fireEvent.blur(screen.getByText('inner'), { relatedTarget: screen.getByText('outer') });
    expect(state()).toBe('closed');
  });

  it('blur to null with no content collapses', () => {
    render(<Harness hasContent={false} />);
    fireEvent.focus(screen.getByText('inner'));
    fireEvent.blur(screen.getByText('inner'), { relatedTarget: null });
    expect(state()).toBe('closed');
  });

  it('blur outside with content stays expanded', () => {
    render(<Harness hasContent />);
    fireEvent.focus(screen.getByText('inner'));
    fireEvent.blur(screen.getByText('inner'), { relatedTarget: screen.getByText('outer') });
    expect(state()).toBe('open');
  });

  it('calls onBlur on every blur', () => {
    const onBlur = vi.fn();
    render(<Harness hasContent={false} onBlur={onBlur} />);
    fireEvent.blur(screen.getByText('inner'), { relatedTarget: screen.getByText('inner2') });
    fireEvent.blur(screen.getByText('inner'), { relatedTarget: screen.getByText('outer') });
    expect(onBlur).toHaveBeenCalledTimes(2);
  });
});
