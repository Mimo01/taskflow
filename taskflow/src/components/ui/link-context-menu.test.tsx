import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternalWith } from '@/lib/openExternal';
import { useDetectedBrowsers } from '@/lib/useDetectedBrowsers';
import { LinkContextMenu } from './link-context-menu';

vi.mock('@/lib/openExternal', () => ({
  openExternalWith: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/useDetectedBrowsers', () => ({
  useDetectedBrowsers: vi.fn(),
}));

const mockedOpenExternalWith = vi.mocked(openExternalWith);
const mockedUseDetectedBrowsers = vi.mocked(useDetectedBrowsers);

const TWO_BROWSERS = [
  { id: 'firefox', label: 'Firefox', path: '/Applications/Firefox.app' },
  { id: 'chrome', label: 'Google Chrome', path: '/Applications/Google Chrome.app' },
];

function openMenu(container: HTMLElement) {
  const trigger = container.querySelector('[data-slot="context-menu-trigger"]');
  if (!trigger) throw new Error('trigger not found');
  fireEvent.contextMenu(trigger);
}

describe('LinkContextMenu', () => {
  beforeEach(() => {
    mockedOpenExternalWith.mockClear();
    mockedUseDetectedBrowsers.mockReturnValue(TWO_BROWSERS);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('opens a popup on right-click with System Default + per-browser + Copy link items', async () => {
    const { container } = render(
      <LinkContextMenu href="https://example.com">
        <a href="https://example.com">link</a>
      </LinkContextMenu>,
    );
    openMenu(container);

    expect(await screen.findByText('Open in System Default')).toBeInTheDocument();
    expect(screen.getByText('Open in Firefox')).toBeInTheDocument();
    expect(screen.getByText('Open in Google Chrome')).toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('clicking "Open in {label}" calls openExternalWith(href, browser.path)', async () => {
    const { container } = render(
      <LinkContextMenu href="https://example.com">
        <a href="https://example.com">link</a>
      </LinkContextMenu>,
    );
    openMenu(container);

    fireEvent.click(await screen.findByText('Open in Firefox'));

    expect(mockedOpenExternalWith).toHaveBeenCalledWith(
      'https://example.com',
      '/Applications/Firefox.app',
    );
  });

  it('clicking "Open in System Default" calls openExternalWith(href, null)', async () => {
    const { container } = render(
      <LinkContextMenu href="https://example.com">
        <a href="https://example.com">link</a>
      </LinkContextMenu>,
    );
    openMenu(container);

    fireEvent.click(await screen.findByText('Open in System Default'));

    expect(mockedOpenExternalWith).toHaveBeenCalledWith('https://example.com', null);
  });

  it('clicking "Copy link" writes to clipboard and flashes "Copied!"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = render(
      <LinkContextMenu href="https://example.com">
        <a href="https://example.com">link</a>
      </LinkContextMenu>,
    );
    openMenu(container);

    fireEvent.click(await screen.findByText('Copy link'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com');
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());

    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.getByText('Copy link')).toBeInTheDocument());
    vi.useRealTimers();
  });

  it('a rejected clipboard write leaves the label as "Copy link"', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Document is not focused')) },
    });
    const { container } = render(
      <LinkContextMenu href="https://example.com">
        <a href="https://example.com">link</a>
      </LinkContextMenu>,
    );
    openMenu(container);

    fireEvent.click(await screen.findByText('Copy link'));

    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('renders System Default + Copy link when the browser query returns []', async () => {
    mockedUseDetectedBrowsers.mockReturnValue([]);
    const { container } = render(
      <LinkContextMenu href="https://example.com">
        <a href="https://example.com">link</a>
      </LinkContextMenu>,
    );
    openMenu(container);

    expect(await screen.findByText('Open in System Default')).toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
    expect(screen.queryByText(/^Open in Firefox$/)).not.toBeInTheDocument();
  });

  it('accepts a render prop to attach the trigger to an existing element', async () => {
    const { container } = render(
      <LinkContextMenu
        href="https://example.com"
        render={
          <a href="https://example.com" data-testid="my-anchor">
            link
          </a>
        }
      />,
    );
    expect(container.querySelector('[data-testid="my-anchor"]')).toBeInTheDocument();
    openMenu(container);
    expect(await screen.findByText('Open in System Default')).toBeInTheDocument();
  });
});
