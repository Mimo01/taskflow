import 'highlight.js/styles/github-dark.css';
import { ChevronLeft, ChevronRight, Download, File, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { JiraAttachment } from '@/services/jira';
import { AuthImage } from '../AuthImage';
import { formatFileSize } from './AttachmentFileRow';
import { highlightCode } from './highlightCode';
import { resolvePreviewKind } from './resolvePreviewKind';
import { useAuthBlob } from './useAuthBlob';

interface AttachmentPreviewModalProps {
  items: JiraAttachment[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDownload: (attachment: JiraAttachment) => void;
}

// Text/code preview size guard: truncate content beyond this length (~256 KB),
// or when the attachment's reported size exceeds ~2 MB.
const MAX_PREVIEW_CHARS = 256 * 1024;
const MAX_PREVIEW_FILE_SIZE = 2 * 1024 * 1024;

function truncateForPreview(text: string, attachment: JiraAttachment) {
  const oversized = (attachment.size ?? 0) > MAX_PREVIEW_FILE_SIZE;
  const truncated = oversized || text.length > MAX_PREVIEW_CHARS;
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

function TextPreview({ attachment }: { attachment: JiraAttachment }) {
  const { loading, error, getText } = useAuthBlob(attachment.content);
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: getText is derived from attachment.content via useAuthBlob and is stable per resolved src; attachment.content is the intentional re-run trigger for navigation between attachments
  useEffect(() => {
    setText(null);
    setTextError(false);
    if (loading || error) return;
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
  }, [attachment.content, loading, error]);

  if (error || textError) {
    return <span className="text-white/80 text-sm">[content not available]</span>;
  }

  if (loading || text === null) {
    return <span className="inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />;
  }

  const { truncated, shown } = truncateForPreview(text, attachment);

  return (
    <div>
      <pre className="max-w-[90vw] max-h-[85vh] overflow-auto font-mono text-xs whitespace-pre-wrap bg-white text-black rounded-lg p-4">
        {shown}
      </pre>
      {truncated && <TruncationNotice />}
    </div>
  );
}

function CodePreview({ attachment }: { attachment: JiraAttachment }) {
  const { loading, error, getText } = useAuthBlob(attachment.content);
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: getText is derived from attachment.content via useAuthBlob and is stable per resolved src; attachment.content is the intentional re-run trigger for navigation between attachments
  useEffect(() => {
    setText(null);
    setTextError(false);
    if (loading || error) return;
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
  }, [attachment.content, loading, error]);

  if (error || textError) {
    return <span className="text-white/80 text-sm">[content not available]</span>;
  }

  if (loading || text === null) {
    return <span className="inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />;
  }

  const { truncated, shown } = truncateForPreview(text, attachment);
  const highlighted = highlightCode(shown, attachment.filename);

  return (
    <div>
      <pre className="max-w-[90vw] max-h-[85vh] overflow-auto rounded-lg p-4 text-xs">
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
}: {
  attachment: JiraAttachment;
  onFallback: () => void;
}) {
  const { blobUrl, loading, error } = useAuthBlob(attachment.content);

  if (error) {
    onFallback();
    return null;
  }
  if (loading || !blobUrl) {
    return <span className="inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />;
  }
  return (
    <iframe
      title={attachment.filename}
      src={blobUrl}
      className="w-[90vw] h-[85vh] rounded-lg bg-white"
    />
  );
}

function VideoPreview({
  attachment,
  onFallback,
}: {
  attachment: JiraAttachment;
  onFallback: () => void;
}) {
  const { blobUrl, loading, error } = useAuthBlob(attachment.content);

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
      className="max-w-[90vw] max-h-[85vh] rounded-lg"
      onError={onFallback}
    />
  );
}

function AudioPreview({
  attachment,
  onFallback,
}: {
  attachment: JiraAttachment;
  onFallback: () => void;
}) {
  const { blobUrl, loading, error } = useAuthBlob(attachment.content);

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
}: AttachmentPreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  // Reset the fallback flag whenever the active attachment changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentIndex is an intentional re-run trigger — the body doesn't reference it but bumping it resets fallback for the newly navigated attachment.
  useEffect(() => {
    setFallback(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1) {
        onNavigate(currentIndex + 1);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, onNavigate, currentIndex, items.length]);

  // Auto-focus overlay for keyboard events
  useEffect(() => {
    if (open && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [open]);

  if (!open || items.length === 0) return null;

  const current = items[currentIndex];
  if (!current) return null;

  const kind = fallback ? 'other' : resolvePreviewKind(current);

  let body: React.ReactNode;
  switch (kind) {
    case 'image':
      body = (
        <div className="bg-white rounded-lg">
          <AuthImage
            src={current.content}
            alt={current.filename}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
          />
        </div>
      );
      break;
    case 'text':
      body = <TextPreview attachment={current} />;
      break;
    case 'code':
      body = <CodePreview attachment={current} />;
      break;
    case 'pdf':
      body = <PdfPreview attachment={current} onFallback={() => setFallback(true)} />;
      break;
    case 'video':
      body = <VideoPreview attachment={current} onFallback={() => setFallback(true)} />;
      break;
    case 'audio':
      body = <AudioPreview attachment={current} onFallback={() => setFallback(true)} />;
      break;
    default:
      body = <DownloadFallback attachment={current} onDownload={onDownload} />;
      break;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation-stopper to prevent backdrop close when clicking preview/caption */}
      <div
        className="flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {body}
        <p className="text-white/80 text-sm">
          {current.filename}
          {current.size != null && ` - ${formatFileSize(current.size)}`}
        </p>
      </div>
    </div>
  );
}
