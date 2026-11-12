import 'highlight.js/styles/github-dark.css';
import { ChevronLeft, ChevronRight, Download, File, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { DEFAULT_FONT_SIZE, FONT_SIZES, nextFontSize, prevFontSize } from '@/lib/image-viewer';
import { REVEALED_MESSAGE } from '@/lib/save-attachment';
import type { JiraAttachment } from '@/services/jira';
import { ImageViewer } from '../ImageViewer';
import { BACKDROP_ATTR, isBackdropTarget } from '../preview-backdrop';
import { usePreviewEscape } from '../usePreviewEscape';
import { ViewerToolbar } from '../ViewerToolbar';
import { formatFileSize } from './attachment-format';
import { highlightCode } from './highlightCode';
import { resolvePreviewKind } from './resolvePreviewKind';
import { useAuthBlob } from './useAuthBlob';

interface AttachmentPreviewModalProps {
  items: JiraAttachment[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** Toolbar Download: may return a promise; rejection shows an error on the button. */
  onDownload: (attachment: JiraAttachment) => unknown;
  /** Resolves to what was done: launched in the default app, or revealed in Finder. */
  onOpenExternal?: (attachment: JiraAttachment) => Promise<'opened' | 'revealed' | undefined>;
}

// Text/code preview size guard: skip fetching entirely (show DownloadFallback
// instead) once the attachment's reported size exceeds this. Applied
// *before* any fetch — unlike a post-fetch truncation, this never downloads
// an oversized file just to discard most of it.
const MAX_PREVIEW_FILE_SIZE = 2 * 1024 * 1024;
// Defense-in-depth: truncate the rendered string if a file with no reported
// `size` (or one just under the cap) still turns out to be huge in practice.
const MAX_PREVIEW_CHARS = 256 * 1024;
// PDF/video/audio previews are decoded/embedded as a whole (no streaming via
// blob/data URLs), so gate them behind a larger inline-preview cap too.
const MAX_MEDIA_PREVIEW_SIZE = 50 * 1024 * 1024;

function isOversized(attachment: JiraAttachment, cap: number) {
  return (attachment.size ?? 0) > cap;
}

function truncateForPreview(text: string) {
  const truncated = text.length > MAX_PREVIEW_CHARS;
  const shown = truncated ? text.slice(0, MAX_PREVIEW_CHARS) : text;
  return { truncated, shown };
}

function TruncationNotice() {
  return (
    <p className="text-xs text-muted-foreground/80 mt-2">
      Showing first 256 KB — download for full file.
    </p>
  );
}

function DownloadFallback({
  attachment,
  onDownload,
}: {
  attachment: JiraAttachment;
  onDownload: (attachment: JiraAttachment) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 bg-white rounded-lg p-8 text-black">
      <File className="size-12 text-muted-foreground" />
      <p className="text-sm font-medium">{attachment.filename}</p>
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDownload(attachment);
        }}
      >
        <Download className="size-4" />
        Download
      </Button>
    </div>
  );
}

function TextPreview({
  attachment,
  onDownload,
  fontSize,
}: {
  attachment: JiraAttachment;
  onDownload: (attachment: JiraAttachment) => void;
  fontSize: number;
}) {
  const oversized = isOversized(attachment, MAX_PREVIEW_FILE_SIZE);
  const { loading, error, getText } = useAuthBlob(attachment.content, { lazy: true });
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: getText is derived from attachment.content via useAuthBlob and is stable per resolved src; attachment.content is the intentional re-run trigger for navigation between attachments
  useEffect(() => {
    setText(null);
    setTextError(false);
    if (oversized || loading || error) return;
    let cancelled = false;
    getText()
      .then((full) => {
        if (!cancelled) setText(full);
      })
      .catch(() => {
        if (!cancelled) setTextError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.content, oversized, loading, error]);

  if (oversized) {
    return <DownloadFallback attachment={attachment} onDownload={onDownload} />;
  }

  if (error || textError) {
    return <span className="text-white/80 text-sm">[content not available]</span>;
  }

  if (loading || text === null) {
    return <span className="inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />;
  }

  const { truncated, shown } = truncateForPreview(text);

  return (
    <div>
      <pre
        className="max-w-[90vw] max-h-[75vh] overflow-auto font-mono whitespace-pre-wrap bg-white text-black rounded-lg p-4"
        style={{ fontSize }}
      >
        {shown}
      </pre>
      {truncated && <TruncationNotice />}
    </div>
  );
}

function CodePreview({
  attachment,
  onDownload,
  fontSize,
}: {
  attachment: JiraAttachment;
  onDownload: (attachment: JiraAttachment) => void;
  fontSize: number;
}) {
  const oversized = isOversized(attachment, MAX_PREVIEW_FILE_SIZE);
  const { loading, error, getText } = useAuthBlob(attachment.content, { lazy: true });
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: getText is derived from attachment.content via useAuthBlob and is stable per resolved src; attachment.content is the intentional re-run trigger for navigation between attachments
  useEffect(() => {
    setText(null);
    setTextError(false);
    if (oversized || loading || error) return;
    let cancelled = false;
    getText()
      .then((full) => {
        if (!cancelled) setText(full);
      })
      .catch(() => {
        if (!cancelled) setTextError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.content, oversized, loading, error]);

  if (oversized) {
    return <DownloadFallback attachment={attachment} onDownload={onDownload} />;
  }

  if (error || textError) {
    return <span className="text-white/80 text-sm">[content not available]</span>;
  }

  if (loading || text === null) {
    return <span className="inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />;
  }

  const { truncated, shown } = truncateForPreview(text);
  const highlighted = highlightCode(shown, attachment.filename);

  return (
    <div>
      <pre className="max-w-[90vw] max-h-[75vh] overflow-auto rounded-lg p-4" style={{ fontSize }}>
        <code
          className="hljs"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted HTML is hljs-escaped token spans, never raw attachment bytes
          dangerouslySetInnerHTML={{
            // biome-ignore lint/style/useNamingConvention: __html is the React DOM API property name
            __html: highlighted,
          }}
        />
      </pre>
      {truncated && <TruncationNotice />}
    </div>
  );
}

function PdfPreview({
  attachment,
  onFallback,
  onDownload,
}: {
  attachment: JiraAttachment;
  onFallback: () => void;
  onDownload: (attachment: JiraAttachment) => void;
}) {
  const oversized = isOversized(attachment, MAX_MEDIA_PREVIEW_SIZE);
  // WKWebView (Tauri's macOS/iOS webview) does not reliably render `blob:`
  // URLs with application/pdf content via <iframe>/<embed> — the same bytes
  // as a `data:` URI render fine, so PDFs use getDataUrl instead of blobUrl.
  const { getDataUrl } = useAuthBlob(attachment.content, { lazy: true });
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: getDataUrl is derived from attachment.content via useAuthBlob and is stable per resolved src; attachment.content is the intentional re-run trigger for navigation between attachments
  useEffect(() => {
    setDataUrl(null);
    setFailed(false);
    if (oversized) return;
    let cancelled = false;
    getDataUrl('application/pdf')
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.content, oversized]);

  useEffect(() => {
    if (failed) onFallback();
  }, [failed, onFallback]);

  if (oversized) {
    return <DownloadFallback attachment={attachment} onDownload={onDownload} />;
  }
  if (failed) return null;
  if (!dataUrl) {
    return <span className="inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />;
  }
  return (
    <embed
      title={attachment.filename}
      src={dataUrl}
      type="application/pdf"
      className="w-[90vw] h-[75vh] rounded-lg bg-white"
    />
  );
}

function VideoPreview({
  attachment,
  onFallback,
  onDownload,
}: {
  attachment: JiraAttachment;
  onFallback: () => void;
  onDownload: (attachment: JiraAttachment) => void;
}) {
  const oversized = isOversized(attachment, MAX_MEDIA_PREVIEW_SIZE);
  const { blobUrl, loading, error } = useAuthBlob(attachment.content, { lazy: oversized });

  if (oversized) {
    return <DownloadFallback attachment={attachment} onDownload={onDownload} />;
  }
  if (error) {
    onFallback();
    return null;
  }
  if (loading || !blobUrl) {
    return <span className="inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />;
  }
  return (
    // biome-ignore lint/a11y/useMediaCaption: attachment previews have no caption tracks available
    <video
      controls
      src={blobUrl}
      className="max-w-[90vw] max-h-[75vh] rounded-lg"
      onError={onFallback}
    />
  );
}

function AudioPreview({
  attachment,
  onFallback,
  onDownload,
}: {
  attachment: JiraAttachment;
  onFallback: () => void;
  onDownload: (attachment: JiraAttachment) => void;
}) {
  const oversized = isOversized(attachment, MAX_MEDIA_PREVIEW_SIZE);
  const { blobUrl, loading, error } = useAuthBlob(attachment.content, { lazy: oversized });

  if (oversized) {
    return <DownloadFallback attachment={attachment} onDownload={onDownload} />;
  }
  if (error) {
    onFallback();
    return null;
  }
  if (loading || !blobUrl) {
    return <span className="inline-block w-64 h-10 bg-muted animate-pulse rounded-md" />;
  }
  return (
    // biome-ignore lint/a11y/useMediaCaption: attachment previews have no caption tracks available
    <audio controls src={blobUrl} className="w-[80vw]" onError={onFallback} />
  );
}

export function AttachmentPreviewModal({
  items,
  currentIndex,
  open,
  onClose,
  onNavigate,
  onDownload,
  onOpenExternal,
}: AttachmentPreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Only close when the press also started on the backdrop (a pan drag
  // released over the backdrop must not dismiss the preview).
  const downOnBackdrop = useRef(false);
  const [fallback, setFallback] = useState(false);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  usePreviewEscape(open, onClose);

  const activeItem = items[currentIndex];
  const activeKind = activeItem && !fallback ? resolvePreviewKind(activeItem) : 'other';
  const fontZoomActive = activeKind === 'text' || activeKind === 'code';

  // Reset the fallback flag whenever the active attachment changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentIndex is an intentional re-run trigger — the body doesn't reference it but bumping it resets fallback for the newly navigated attachment.
  useEffect(() => {
    setFallback(false);
    setFontSize(DEFAULT_FONT_SIZE);
  }, [currentIndex]);

  useEffect(() => {
    if (!open) return;
    function isEditable(t: EventTarget | null) {
      return (
        t instanceof HTMLElement &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      );
    }
    function handleKeyDown(e: KeyboardEvent) {
      // The image viewer prevents arrows while zoomed (they pan instead).
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.defaultPrevented) return;
      if (fontZoomActive && !isEditable(e.target)) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setFontSize(nextFontSize);
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          setFontSize(prevFontSize);
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          setFontSize(DEFAULT_FONT_SIZE);
          return;
        }
      }
      // Escape is handled by usePreviewEscape (window capture, fullscreen-safe).
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1) {
        onNavigate(currentIndex + 1);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onNavigate, currentIndex, items.length, fontZoomActive]);

  // Auto-focus overlay for keyboard events
  useEffect(() => {
    if (open && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [open]);

  // If the previewable list shrinks while open (e.g. a concurrent delete)
  // and currentIndex no longer resolves, close rather than render nothing
  // while the parent still thinks the modal is open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: onClose is stable; items/currentIndex are the intentional re-run triggers
  useEffect(() => {
    if (open && items.length > 0 && !items[currentIndex]) {
      onClose();
    }
  }, [open, items, currentIndex]);

  if (!open || items.length === 0) return null;

  const current = items[currentIndex];
  if (!current) return null;

  // In-body Download buttons (oversized/unsupported fallbacks) have no feedback
  // slot of their own; swallow rejections so they never go unhandled.
  const bodyDownload = (attachment: JiraAttachment) => {
    Promise.resolve(onDownload(attachment)).catch(() => undefined);
  };

  // Run by the toolbar, which shows busy/done/failed on the button and floats any message.
  const actions = {
    onDownload: () => onDownload(current),
    onOpenExternal: onOpenExternal
      ? async () => ((await onOpenExternal(current)) === 'revealed' ? REVEALED_MESSAGE : undefined)
      : undefined,
  };

  const kind = fallback ? 'other' : resolvePreviewKind(current);

  let body: React.ReactNode;
  switch (kind) {
    case 'image':
      body = (
        <ImageViewer
          key={current.id}
          src={current.content}
          alt={current.filename}
          onDownload={actions.onDownload}
          onOpenExternal={actions.onOpenExternal}
        />
      );
      break;
    case 'text':
      body = <TextPreview attachment={current} onDownload={bodyDownload} fontSize={fontSize} />;
      break;
    case 'code':
      body = <CodePreview attachment={current} onDownload={bodyDownload} fontSize={fontSize} />;
      break;
    case 'pdf':
      body = (
        <PdfPreview
          attachment={current}
          onFallback={() => setFallback(true)}
          onDownload={bodyDownload}
        />
      );
      break;
    case 'video':
      body = (
        <VideoPreview
          attachment={current}
          onFallback={() => setFallback(true)}
          onDownload={bodyDownload}
        />
      );
      break;
    case 'audio':
      body = (
        <AudioPreview
          attachment={current}
          onFallback={() => setFallback(true)}
          onDownload={bodyDownload}
        />
      );
      break;
    default:
      body = <DownloadFallback attachment={current} onDownload={bodyDownload} />;
      break;
  }

  let toolbar: React.ReactNode = null;
  if (fontZoomActive) {
    toolbar = (
      <ViewerToolbar
        key={current.id}
        aria-label="Text controls"
        zoom={{
          readout: `${fontSize}px`,
          onZoomOut: () => setFontSize(prevFontSize),
          onZoomIn: () => setFontSize(nextFontSize),
          zoomOutDisabled: fontSize <= (FONT_SIZES[0] ?? 10),
          zoomInDisabled: fontSize >= (FONT_SIZES[FONT_SIZES.length - 1] ?? 24),
        }}
        onFit={() => setFontSize(DEFAULT_FONT_SIZE)}
        {...actions}
      />
    );
  } else if (kind === 'pdf' || kind === 'video' || kind === 'audio') {
    toolbar = <ViewerToolbar key={current.id} aria-label="File actions" {...actions} />;
  }

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close; Escape is handled by usePreviewEscape
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onPointerDown={(e) => {
        downOnBackdrop.current = isBackdropTarget(e.target, e.currentTarget);
      }}
      onClick={(e) => {
        // Press AND release on empty space close; a pan drag released there doesn't.
        if (downOnBackdrop.current && isBackdropTarget(e.target, e.currentTarget)) onClose();
        downOnBackdrop.current = false;
      }}
      role="dialog"
      aria-modal="true"
      aria-label={current.filename ?? 'Attachment preview'}
      tabIndex={-1}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close preview"
      >
        <X className="size-6" />
      </Button>

      {/* Prev button */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 z-10 size-12"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          aria-label="Previous attachment"
        >
          <ChevronLeft className="size-8" />
        </Button>
      )}

      {/* Next button */}
      {currentIndex < items.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 z-10 size-12"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          aria-label="Next attachment"
        >
          <ChevronRight className="size-8" />
        </Button>
      )}

      {/* Preview body + caption */}
      {/* Wrapper gaps count as backdrop; the body, toolbar and caption don't. */}
      <div className="flex flex-col items-center gap-3" {...BACKDROP_ATTR}>
        {body}
        {toolbar}
        <p className="text-white/80 text-sm">
          {current.filename}
          {current.size != null && ` - ${formatFileSize(current.size)}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
