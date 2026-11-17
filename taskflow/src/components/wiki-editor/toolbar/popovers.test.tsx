import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from '@/lib/openExternal';
import { TEXT_PALETTE } from '../palette';
import { ColourPopover } from './ColourPopover';
import { LinkPopover } from './LinkPopover';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));

describe('ColourPopover', () => {
  const setup = (current: string | null) => {
    const onPick = vi.fn();
    const onRemove = vi.fn();
    render(
      <ColourPopover
        current={current}
        onPick={onPick}
        onRemove={onRemove}
        trigger={<button type="button">Colour</button>}
      />,
    );
    return { onPick, onRemove };
  };

  it('shows one swatch per palette entry and picks', async () => {
    const user = userEvent.setup();
    const { onPick, onRemove } = setup(null);
    await user.click(screen.getByRole('button', { name: 'Colour' }));
    for (const p of TEXT_PALETTE) {
      expect(screen.getByRole('button', { name: p.name })).toBeInTheDocument();
    }
    const first = TEXT_PALETTE[0];
    await user.click(screen.getByRole('button', { name: first?.name ?? '' }));
    expect(onPick).toHaveBeenCalledWith(first?.value);
    await user.click(screen.getByRole('button', { name: 'Remove colour' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('marks the current palette swatch with the ring', async () => {
    const user = userEvent.setup();
    const target = TEXT_PALETTE[2];
    setup(target?.value ?? null);
    await user.click(screen.getByRole('button', { name: 'Colour' }));
    expect(screen.getByRole('button', { name: target?.name ?? '' })).toHaveClass('ring-2');
  });

  it('shows a disabled Custom (kept) swatch for off-palette colours', async () => {
    const user = userEvent.setup();
    setup('#123abc');
    await user.click(screen.getByRole('button', { name: 'Colour' }));
    expect(screen.getByRole('button', { name: 'Custom (kept)' })).toBeDisabled();
    expect(screen.getByTestId('colour-bar')).toBeInTheDocument();
  });

  it('renders no inline style for unsafe current values', async () => {
    const user = userEvent.setup();
    setup('red;background:url(x)');
    await user.click(screen.getByRole('button', { name: 'Colour' }));
    expect(screen.queryByTestId('colour-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom (kept)' })).toBeNull();
    expect(document.body.innerHTML).not.toContain('url(x)');
  });
});

describe('LinkPopover', () => {
  beforeEach(() => vi.clearAllMocks());

  const setup = (currentUrl: string | null) => {
    const onApply = vi.fn();
    const onRemove = vi.fn();
    render(
      <LinkPopover
        open
        onOpenChange={vi.fn()}
        trigger={<button type="button">Link</button>}
        currentUrl={currentUrl}
        onApply={onApply}
        onRemove={onRemove}
      />,
    );
    return { onApply, onRemove };
  };

  it('rejects unsafe URLs with the inline error', () => {
    const { onApply } = setup(null);
    fireEvent.change(screen.getByLabelText('Link URL'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Enter an http(s) or mailto link.')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies on button and on Enter', () => {
    const { onApply } = setup(null);
    const input = screen.getByLabelText('Link URL');
    fireEvent.change(input, { target: { value: 'a.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith('a.com');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onApply).toHaveBeenCalledTimes(2);
  });

  it('offers Open and Remove for an existing link', () => {
    const { onRemove } = setup('https://a.com');
    expect(screen.getByLabelText('Link URL')).toHaveValue('https://a.com');
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(openExternal).toHaveBeenCalledWith('https://a.com');
    fireEvent.click(screen.getByRole('button', { name: 'Remove link' }));
    expect(onRemove).toHaveBeenCalled();
  });
});
