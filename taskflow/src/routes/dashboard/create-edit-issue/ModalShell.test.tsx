import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ModalCancelButton,
  ModalField,
  ModalPrimaryButton,
  ModalShell,
  type ModalShellProps,
} from './ModalShell';

function renderShell(props: Partial<ModalShellProps> = {}) {
  const onOpenChange = vi.fn();
  const utils = render(
    <ModalShell
      open
      onOpenChange={onOpenChange}
      title="Create thing"
      footerActions={<button type="button">Act</button>}
      {...props}
    >
      <div data-testid="main-content">main</div>
    </ModalShell>,
  );
  return { onOpenChange, ...utils };
}

describe('ModalShell', () => {
  it('renders the title and an optional subtitle in muted xs text', () => {
    renderShell({ subtitle: 'Sub text' });
    expect(screen.getByText('Create thing')).toBeTruthy();
    expect(screen.getByText('Sub text').className).toContain('text-xs text-muted-foreground');
  });

  it('renders the aside next to the main column only when provided', () => {
    const { unmount } = renderShell({ aside: <div>side</div>, asideLabel: 'Details' });
    const aside = screen.getByLabelText('Details');
    expect(aside.tagName).toBe('ASIDE');
    expect(aside.className).toContain('w-[300px]');
    expect(screen.getByTestId('main-content')).toBeTruthy();
    unmount();
    renderShell();
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.getByTestId('main-content')).toBeTruthy();
  });

  it('renders the toolbar outside the scrolling main column', () => {
    renderShell({ toolbar: <div data-testid="tb">tools</div> });
    const tb = screen.getByTestId('tb');
    const main = screen.getByTestId('main-content').parentElement as HTMLElement;
    expect(main.contains(tb)).toBe(false);
    expect(main.className).toContain('overflow-y-auto');
  });

  it('renders footer status before the actions', () => {
    renderShell({ footerStatus: <span>status text</span> });
    const status = screen.getByTestId('modal-footer-status');
    expect(status.textContent).toBe('status text');
    const act = screen.getByText('Act');
    expect(status.compareDocumentPosition(act) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('wraps in a form and fires the shortcut on Cmd+Enter when onSubmit is given', () => {
    const onSubmitShortcut = vi.fn();
    renderShell({ onSubmit: (e) => e.preventDefault(), onSubmitShortcut });
    expect(document.querySelector('form')).toBeTruthy();
    const main = screen.getByTestId('main-content');
    fireEvent.keyDown(main, { key: 'Enter', metaKey: true });
    expect(onSubmitShortcut).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(main, { key: 'Enter' });
    expect(onSubmitShortcut).toHaveBeenCalledTimes(1);
  });

  it('has no form element without onSubmit', () => {
    renderShell();
    expect(document.querySelector('form')).toBeNull();
  });

  it('passes Base UI details through on Escape', () => {
    const { onOpenChange } = renderShell();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalled();
    const [open, details] = onOpenChange.mock.calls[0];
    expect(open).toBe(false);
    expect(details.reason).toBe('escape-key');
    expect(typeof details.cancel).toBe('function');
  });

  it('disables the Close button with closeDisabled', () => {
    renderShell({ closeDisabled: true });
    expect((screen.getByLabelText('Close') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('modal footer helpers', () => {
  it('ModalPrimaryButton shows pendingLabel and a spinner while pending', () => {
    const { container } = render(
      <ModalPrimaryButton label="Create" pendingLabel="Creating..." pending />,
    );
    expect(screen.getByText('Creating...')).toBeTruthy();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('ModalPrimaryButton tooltip shows the label with command and enter keycaps', async () => {
    render(<ModalPrimaryButton label="Create" pendingLabel="Creating..." />);
    await userEvent.hover(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('⌘')).toBeTruthy();
    expect(screen.getByText('↵')).toBeTruthy();
  });

  it('ModalCancelButton tooltip shows the Esc keycap and calls onClick', async () => {
    const onClick = vi.fn();
    render(<ModalCancelButton onClick={onClick} />);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    await userEvent.hover(btn);
    expect(await screen.findByText('Esc')).toBeTruthy();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('ModalField renders a muted label and a required marker', () => {
    render(
      <ModalField htmlFor="x" label="Name" required>
        <input id="x" />
      </ModalField>,
    );
    const label = screen.getByText('Name', { selector: 'label' });
    expect(label.className).toContain('text-xs font-semibold text-muted-foreground');
    expect(label.querySelector('.text-destructive')).toBeTruthy();
  });
});
