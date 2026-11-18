import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CommentActionRow } from './CommentActionRow';

function setup(over: Partial<ComponentProps<typeof CommentActionRow>> = {}) {
  const props = {
    draftState: null,
    onDiscard: vi.fn(),
    onUseJira: vi.fn(),
    onAttachFiles: vi.fn(),
    onCancel: vi.fn(),
    primaryLabel: 'Save',
    pendingLabel: 'Saving…',
    pending: false,
    primaryDisabled: false,
    onPrimary: vi.fn(),
    ...over,
  } as ComponentProps<typeof CommentActionRow>;
  const utils = render(<CommentActionRow {...props} />);
  return { props, ...utils };
}

describe('CommentActionRow', () => {
  it('renders draft note, then Attach, Cancel, primary in order', () => {
    setup({ draftState: 'draft' });
    expect(screen.getByText('Draft saved')).toBeTruthy();
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(['Discard', 'Attach files', 'Cancel', 'Save']);
  });

  it('omits Cancel without onCancel', () => {
    setup({ onCancel: undefined });
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('Attach clicks the hidden multi-file input and forwards files, resetting the input', () => {
    const { props, container } = setup();
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }));
    expect(click).toHaveBeenCalled();
    const f1 = new File(['a'], 'a.txt');
    const f2 = new File(['b'], 'b.txt');
    fireEvent.change(input, { target: { files: [f1, f2] } });
    expect(props.onAttachFiles).toHaveBeenCalledWith([f1, f2]);
    expect(input.value).toBe('');
  });

  it('shows pending label and disables primary while pending', () => {
    setup({ pending: true });
    const btn = screen.getByRole('button', { name: 'Saving…' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onPrimary on click', async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onPrimary).toHaveBeenCalledTimes(1);
  });

  it('primaryDisabled disables the primary button', () => {
    setup({ primaryDisabled: true });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('attachDisabled disables Attach', () => {
    setup({ attachDisabled: true });
    expect(
      (screen.getByRole('button', { name: 'Attach files' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('primary tooltip shows keycaps', async () => {
    setup();
    await userEvent.hover(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('⌘')).toBeTruthy();
    expect(screen.getByText('↵')).toBeTruthy();
  });
});
