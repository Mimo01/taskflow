import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./issue-detail/useAuthBlob', () => ({
  useAuthBlob: () => ({ blobUrl: 'blob:x', loading: false, error: false }),
}));
vi.mock('@/lib/save-attachment', () => ({
  filenameFromSrc: (_s: string, alt?: string) => alt || 'image',
  saveBlobUrl: vi.fn().mockResolvedValue('/dl/a.png'),
  openSavedFile: vi.fn().mockResolvedValue('opened'),
  REVEALED_MESSAGE: 'Shown in Finder (test)',
}));

import { ImageLightbox } from './ImageLightbox';
import { ImageViewer } from './ImageViewer';

beforeEach(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get: () => 1200,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
    configurable: true,
    get: () => 800,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function setup(props: Partial<React.ComponentProps<typeof ImageViewer>> = {}) {
  const utils = render(<ImageViewer src="https://x/a.png" alt="a.png" {...props} />);
  const img = utils.container.querySelector('img') as HTMLImageElement;
  fireEvent.load(img);
  const stage = screen.getByTestId('image-viewer-stage');
  return { ...utils, img, stage };
}

const readout = () => screen.getByText(/^\d+%$/).textContent;
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.body, { key: k, ...init });

describe('ImageViewer', () => {
  it('fits on load and steps with + - 1 0', () => {
    setup();
    expect(readout()).toBe('50%');
    key('+');
    expect(readout()).toBe('67%');
    key('-');
    expect(readout()).toBe('50%');
    key('1');
    expect(readout()).toBe('100%');
    key('0');
    expect(readout()).toBe('50%');
  });

  it('reflects transform and rotates + re-fits with r', () => {
    const { img } = setup();
    expect(img.style.transform).toContain('scale(0.5)');
    key('r');
    expect(img.style.transform).toContain('rotate(90deg)');
    expect(readout()).toBe('33%');
  });

  it('ctrl+wheel zooms, plain wheel at fit does not', () => {
    const { stage } = setup();
    fireEvent.wheel(stage, { deltaY: -100 });
    expect(readout()).toBe('50%');
    fireEvent.wheel(stage, { ctrlKey: true, deltaY: -100 });
    expect(Number.parseInt(readout() ?? '0', 10)).toBeGreaterThan(50);
  });

  it('handles Safari gesture events and ignores ctrl-wheel during a gesture', () => {
    const { stage } = setup();
    act(() => {
      stage.dispatchEvent(new Event('gesturestart', { cancelable: true }));
    });
    act(() => {
      stage.dispatchEvent(
        Object.assign(new Event('gesturechange', { cancelable: true }), {
          scale: 2,
          clientX: 0,
          clientY: 0,
        }),
      );
    });
    expect(readout()).toBe('100%');
    fireEvent.wheel(stage, { ctrlKey: true, deltaY: -100 });
    expect(readout()).toBe('100%');
    act(() => {
      stage.dispatchEvent(new Event('gestureend', { cancelable: true }));
    });
    fireEvent.wheel(stage, { ctrlKey: true, deltaY: 100 });
    expect(readout()).not.toBe('100%');
  });

  it('a gesture that never ends stops suppressing ctrl-wheel after it goes stale', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { stage } = setup();
    act(() => {
      stage.dispatchEvent(new Event('gesturestart', { cancelable: true }));
    });
    // No gestureend ever arrives.
    now += 1000;
    fireEvent.wheel(stage, { ctrlKey: true, deltaY: -100 });
    expect(Number.parseInt(readout() ?? '0', 10)).toBeGreaterThan(50);
  });

  it('disables controls before load and zoom-in at max', () => {
    const utils = render(<ImageViewer src="https://x/a.png" alt="a.png" />);
    expect((screen.getByLabelText('Zoom in') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.load(utils.container.querySelector('img') as HTMLImageElement);
    expect((screen.getByLabelText('Zoom in') as HTMLButtonElement).disabled).toBe(false);
    for (let i = 0; i < 20; i++) key('+');
    expect(readout()).toBe('800%');
    expect((screen.getByLabelText('Zoom in') as HTMLButtonElement).disabled).toBe(true);
  });

  it('arrows navigate (not defaultPrevented) at fit and pan when zoomed', () => {
    const { img } = setup();
    const atFit = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(atFit);
    expect(atFit.defaultPrevented).toBe(false);
    key('1');
    const before = img.style.transform;
    const zoomed = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(zoomed);
    });
    expect(zoomed.defaultPrevented).toBe(true);
    expect(img.style.transform).not.toBe(before);
  });

  it('calls onDownload and shows Open externally errors', async () => {
    const onDownload = vi.fn();
    const onOpenExternal = vi.fn().mockRejectedValue(new Error('denied by capability'));
    setup({ onDownload, onOpenExternal });
    fireEvent.click(screen.getByLabelText('Download'));
    expect(onDownload).toHaveBeenCalledWith('blob:x');
    fireEvent.click(screen.getByLabelText('Open externally'));
    await waitFor(() => expect(screen.getByText('denied by capability')).toBeTruthy());
  });
});

describe('ImageLightbox', () => {
  it('renders dialog, closes on Esc', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://x/a.png" alt="a.png" open onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Download only saves and confirms; never launches the file', async () => {
    const { openSavedFile, saveBlobUrl } = await import('@/lib/save-attachment');
    render(<ImageLightbox src="https://x/a.png" alt="a.png" open onClose={vi.fn()} />);
    fireEvent.load(document.querySelector('img') as HTMLImageElement);
    fireEvent.click(screen.getByLabelText('Download'));
    expect(await screen.findByText('a.png saved to Downloads.')).toBeTruthy();
    expect(saveBlobUrl).toHaveBeenCalledWith('blob:x', 'a.png');
    expect(openSavedFile).not.toHaveBeenCalled();
  });

  it('Escape closes exactly once when focus is inside the viewer', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://x/a.png" alt="a.png" open onClose={onClose} />);
    fireEvent.load(document.querySelector('img') as HTMLImageElement);
    const btn = screen.getByLabelText('Zoom in');
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when a press starts on the image and ends on the backdrop', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://x/a.png" alt="a.png" open onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    const img = dialog.querySelector('img') as HTMLImageElement;
    fireEvent.pointerDown(img);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
