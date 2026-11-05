import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';

vi.mock('./useAuthBlob', () => ({
  useAuthBlob: () => ({
    blobUrl: 'blob:x',
    loading: false,
    error: false,
    getText: async () => 'sample text',
    getDataUrl: async () => 'data:application/pdf;base64,AA==',
  }),
}));
vi.mock('@/lib/save-attachment', () => ({
  filenameFromSrc: (_s: string, alt?: string) => alt || 'image',
  saveBlobUrl: vi.fn(),
  openSavedFile: vi.fn(),
  REVEALED_MESSAGE: 'Shown in Finder (test)',
}));

import { AttachmentPreviewModal } from './AttachmentPreviewModal';

const att = (id: string, filename: string, mimeType: string): JiraAttachment => ({
  id,
  filename,
  mimeType,
  content: `https://example.invalid/att/${id}/${filename}`,
  size: 100,
});

const img1 = att('1', 'one.png', 'image/png');
const img2 = att('2', 'two.png', 'image/png');
const txt = att('3', 'notes.txt', 'text/plain');
const pdf = att('4', 'doc.pdf', 'application/pdf');

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

afterEach(() => vi.clearAllMocks());

function renderModal(
  items: JiraAttachment[],
  currentIndex: number,
  extra: Partial<React.ComponentProps<typeof AttachmentPreviewModal>> = {},
) {
  const props = {
    items,
    currentIndex,
    open: true,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    onDownload: vi.fn(),
  };
  Object.assign(props, extra);
  const utils = render(<AttachmentPreviewModal {...props} />);
  return { ...utils, props };
}

const loadImage = () => fireEvent.load(document.querySelector('img') as HTMLImageElement);
const readout = (re = /^\d+%$/) => screen.getByText(re).textContent;
const key = (k: string) => fireEvent.keyDown(document.body, { key: k });

describe('AttachmentPreviewModal image viewer', () => {
  it('renders the image toolbar and resets zoom on navigation', () => {
    const { rerender, props } = renderModal([img1, img2], 0);
    loadImage();
    expect(screen.getByRole('toolbar', { name: 'Image controls' })).toBeTruthy();
    key('+');
    expect(readout()).toBe('67%');
    rerender(<AttachmentPreviewModal {...props} currentIndex={1} />);
    loadImage();
    expect(readout()).toBe('50%');
  });

  it('ArrowRight navigates at fit but not when zoomed; Esc always closes', () => {
    const { props } = renderModal([img1, img2], 0);
    loadImage();
    key('ArrowRight');
    expect(props.onNavigate).toHaveBeenCalledWith(1);
    props.onNavigate.mockClear();
    key('+');
    key('ArrowRight');
    expect(props.onNavigate).not.toHaveBeenCalled();
    key('Escape');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows Open externally errors in the viewer', async () => {
    const onOpenExternal = vi.fn().mockRejectedValue(new Error("Couldn't open one.png: denied"));
    renderModal([img1], 0, { onOpenExternal });
    loadImage();
    fireEvent.click(screen.getByLabelText('Open externally'));
    await waitFor(() => expect(screen.getByText("Couldn't open one.png: denied")).toBeTruthy());
    expect(onOpenExternal).toHaveBeenCalledWith(img1);
  });
});

describe('AttachmentPreviewModal text zoom', () => {
  it('font-size zoom with + and 0', async () => {
    renderModal([txt], 0);
    const pre = await waitFor(() => {
      const el = document.querySelector('pre');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(screen.getByRole('toolbar', { name: 'Text controls' })).toBeTruthy();
    expect(readout(/px$/)).toBe('12px');
    key('+');
    expect(pre.style.fontSize).toBe('13px');
    key('0');
    expect(pre.style.fontSize).toBe('12px');
  });

  it('resets font size on navigation', async () => {
    const txt2 = att('5', 'other.txt', 'text/plain');
    const { rerender, props } = renderModal([txt, txt2], 0);
    await waitFor(() => expect(document.querySelector('pre')).toBeTruthy());
    key('+');
    expect(readout(/px$/)).toBe('13px');
    rerender(<AttachmentPreviewModal {...props} currentIndex={1} />);
    expect(readout(/px$/)).toBe('12px');
  });

  it('shows Open externally errors inside the modal', async () => {
    const onOpenExternal = vi.fn().mockRejectedValue(new Error('blocked'));
    renderModal([txt], 0, { onOpenExternal });
    await waitFor(() => expect(document.querySelector('pre')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Open externally'));
    await waitFor(() => expect(screen.getByText('blocked')).toBeTruthy());
  });
});

describe('AttachmentPreviewModal keyboard with focus inside', () => {
  it('Escape closes exactly once when a toolbar button has focus', async () => {
    const { props } = renderModal([txt], 0);
    await waitFor(() => expect(document.querySelector('pre')).toBeTruthy());
    const btn = screen.getByLabelText('Zoom in');
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('text font zoom keys work while a toolbar button has focus', async () => {
    renderModal([txt], 0);
    const pre = await waitFor(() => {
      const el = document.querySelector('pre');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    const btn = screen.getByLabelText('Zoom in');
    btn.focus();
    fireEvent.keyDown(btn, { key: '-' });
    expect(pre.style.fontSize).toBe('11px');
  });

  it('ArrowRight navigates at fit while an image toolbar button has focus', () => {
    const { props } = renderModal([img1, img2], 0);
    loadImage();
    const btn = screen.getByLabelText('Fit');
    btn.focus();
    fireEvent.keyDown(btn, { key: 'ArrowRight' });
    expect(props.onNavigate).toHaveBeenCalledWith(1);
  });
});

describe('AttachmentPreviewModal reveal', () => {
  it('shows an info message when Open externally reveals instead of launching', async () => {
    const onOpenExternal = vi.fn().mockResolvedValue('revealed');
    renderModal([pdf], 0, { onOpenExternal });
    fireEvent.click(await screen.findByLabelText('Open externally'));
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Shown in Finder (test)',
    );
  });

  it('shows the reveal message in the image viewer too', async () => {
    const onOpenExternal = vi.fn().mockResolvedValue('revealed');
    renderModal([img1], 0, { onOpenExternal });
    loadImage();
    fireEvent.click(screen.getByLabelText('Open externally'));
    expect(await screen.findByText('Shown in Finder (test)')).toBeTruthy();
  });
});

describe('AttachmentPreviewModal pdf', () => {
  it('shows only Download + Open externally and does not intercept zoom keys', async () => {
    const onOpenExternal = vi.fn().mockResolvedValue(undefined);
    const { props } = renderModal([pdf], 0, { onOpenExternal });
    const toolbar = await screen.findByRole('toolbar', { name: 'File actions' });
    expect(toolbar.querySelectorAll('button').length).toBe(2);
    const ev = new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByLabelText('Download'));
    expect(props.onDownload).toHaveBeenCalledWith(pdf);
    await waitFor(() =>
      expect(screen.getByLabelText('Download').getAttribute('aria-busy')).toBe('false'),
    );
    fireEvent.click(screen.getByLabelText('Open externally'));
    expect(onOpenExternal).toHaveBeenCalledWith(pdf);
  });
});

describe('AttachmentPreviewModal Escape in fullscreen / over a sheet', () => {
  it('prevents default, stops before document listeners, closes once', () => {
    const sheetHandler = vi.fn();
    document.addEventListener('keydown', sheetHandler, { capture: true });
    const { props } = renderModal([img1], 0);
    loadImage();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(ev);
    });
    document.removeEventListener('keydown', sheetHandler, { capture: true });
    expect(ev.defaultPrevented).toBe(true);
    expect(sheetHandler).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AttachmentPreviewModal backdrop', () => {
  it('clicking the empty stage around an image closes; the caption does not', () => {
    const { props } = renderModal([img1], 0);
    loadImage();
    const caption = screen.getByText(/one\.png/, { selector: 'p' });
    fireEvent.pointerDown(caption);
    fireEvent.click(caption);
    expect(props.onClose).not.toHaveBeenCalled();
    const stage = screen.getByTestId('image-viewer-stage');
    fireEvent.pointerDown(stage);
    fireEvent.click(stage);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the press started on content, closes when on backdrop', () => {
    const { props } = renderModal([txt], 0);
    const dialog = screen.getByRole('dialog');
    fireEvent.pointerDown(dialog.querySelector('p') as HTMLElement);
    fireEvent.click(dialog);
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
