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

  it('single click on the image zooms in; click again returns; cursor matches', () => {
    const { img } = setup();
    expect(readout()).toBe('50%');
    expect(img.style.cursor).toBe('zoom-in');
    fireEvent.pointerDown(img, { clientX: 10, clientY: 10 });
    fireEvent.click(img, { clientX: 10, clientY: 10 });
    expect(readout()).toBe('100%');
    expect(img.style.cursor).toBe('grab');
    fireEvent.pointerDown(img, { clientX: 10, clientY: 10 });
    fireEvent.click(img, { clientX: 10, clientY: 10 });
    expect(readout()).toBe('50%');
  });

  it('a click that ends a drag, or lands on the empty stage, does not zoom', () => {
    const { img, stage } = setup();
    fireEvent.pointerDown(img, { clientX: 0, clientY: 0 });
    fireEvent.click(img, { clientX: 40, clientY: 0 });
    expect(readout()).toBe('50%');
    fireEvent.pointerDown(stage, { clientX: 0, clientY: 0 });
    fireEvent.click(stage, { clientX: 0, clientY: 0 });
    expect(readout()).toBe('50%');
  });

  it('Fit and 1:1 differ for an image smaller than the stage', () => {
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
      configurable: true,
      get: () => 150,
    });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
      configurable: true,
      get: () => 100,
    });
    setup();
    expect(readout()).toBe('100%');
    fireEvent.click(screen.getByLabelText('Fit'));
    expect(readout()).toBe('400%');
    fireEvent.click(screen.getByLabelText('Actual size'));
    expect(readout()).toBe('100%');
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
    // One file action at a time: wait for Download to settle before Open.
    await waitFor(() =>
      expect(screen.getByLabelText('Download').getAttribute('aria-busy')).toBe('false'),
    );
    fireEvent.click(screen.getByLabelText('Open externally'));
    await waitFor(() => expect(screen.getByText('denied by capability')).toBeTruthy());
  });

  it('Download button shows busy, then a check, and the message floats without shifting layout', async () => {
    let resolve: (v: string) => void = () => undefined;
    const onDownload = vi.fn(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        }),
    );
    setup({ onDownload });
    const btn = screen.getByLabelText('Download');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.querySelector('.animate-spin')).toBeTruthy();
    fireEvent.click(btn);
    expect(onDownload).toHaveBeenCalledTimes(1);
    await act(async () => resolve('a.png saved to Downloads.'));
    expect(btn.getAttribute('aria-busy')).toBe('false');
    expect(btn.querySelector('.text-emerald-300')).toBeTruthy();
    const msg = screen.getByRole('status');
    expect(msg.textContent).toBe('a.png saved to Downloads.');
    expect(msg.className).toContain('absolute');
  });

  it('Download failure shows a cross on the button and the error', async () => {
    setup({ onDownload: vi.fn().mockRejectedValue(new Error('HTTP 404')) });
    const btn = screen.getByLabelText('Download');
    fireEvent.click(btn);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'HTTP 404');
    expect(btn.querySelector('.text-red-300')).toBeTruthy();
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

  it('clicking empty space around the image closes; clicking the image or toolbar does not', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://x/a.png" alt="a.png" open onClose={onClose} />);
    const img = document.querySelector('img') as HTMLImageElement;
    fireEvent.load(img);
    const stage = screen.getByTestId('image-viewer-stage');
    fireEvent.pointerDown(img);
    fireEvent.click(img);
    const toolbar = screen.getByRole('toolbar');
    fireEvent.pointerDown(toolbar);
    fireEvent.click(toolbar);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(stage);
    fireEvent.click(stage);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a pan drag from the image released over the empty stage does not close', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="https://x/a.png" alt="a.png" open onClose={onClose} />);
    const img = document.querySelector('img') as HTMLImageElement;
    fireEvent.load(img);
    fireEvent.pointerDown(img);
    fireEvent.click(screen.getByTestId('image-viewer-stage'));
    expect(onClose).not.toHaveBeenCalled();
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
