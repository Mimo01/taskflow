import { Check, Download, Loader2, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JiraAttachment } from '@/services/jira';
import { AuthImage } from '../AuthImage';
import { formatFileSize, getAttachmentImageSrc, getFileIcon } from './attachment-format';
import { getExtension, type PreviewUnavailable } from './resolvePreviewKind';

interface AttachmentTileProps {
  attachment: JiraAttachment;
  isImage: boolean;
  /** May return a promise: a resolved string is shown as the confirmation, a rejection as the error. */
  onDownload: (attachment: JiraAttachment) => unknown;
  /** Runs only after the inline two-click confirmation. May return a promise. */
  onDelete?: (attachment: JiraAttachment) => unknown;
  onPreview?: (attachment: JiraAttachment) => void;
  /** Non-clickable tile: same thumbnail as previewable tiles plus a faint reason line (261112-fy2). */
  previewUnavailable?: PreviewUnavailable;
}

const UNAVAILABLE_LABEL: Record<PreviewUnavailable, string> = {
  unsupported: 'No preview',
  'too-large': 'Too large to preview',
};

// Same rhythm as the preview toolbar (ViewerToolbar) and notifications "Clear all".
export const ACTION_DONE_MS = 1500;
const INFO_MS = 3000;
const ERROR_MS = 6000;
export const DELETE_CONFIRM_MS = 3000;

type Phase = 'busy' | 'done' | 'failed';
type Message = { text: string; tone: 'info' | 'error' };

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function AttachmentTile({
  attachment,
  isImage,
  onDownload,
  onDelete,
  onPreview,
  previewUnavailable,
}: AttachmentTileProps) {
  const unavailable = previewUnavailable ? UNAVAILABLE_LABEL[previewUnavailable] : null;
  const Icon = getFileIcon(attachment.mimeType);
  const sizeText = formatFileSize(attachment.size);
  const ext = getExtension(attachment.filename ?? '').toUpperCase();

  const [download, setDownload] = useState<Phase | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const downloadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(downloadTimer.current);
      clearTimeout(messageTimer.current);
    };
  }, []);

  // Armed delete reverts on its own, and on any click outside the confirm button.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), DELETE_CONFIRM_MS);
    const onDown = (e: PointerEvent) => {
      if (deleteRef.current && !deleteRef.current.contains(e.target as Node)) setArmed(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [armed]);

  function showMessage(next: Message | null) {
    clearTimeout(messageTimer.current);
    setMessage(next);
    if (next) {
      messageTimer.current = setTimeout(
        () => setMessage(null),
        next.tone === 'error' ? ERROR_MS : INFO_MS,
      );
    }
  }

  async function runDownload() {
    if (download === 'busy') return;
    clearTimeout(downloadTimer.current);
    showMessage(null);
    setDownload('busy');
    let failed = false;
    try {
      const result = await onDownload(attachment);
      if (!mounted.current) return;
      showMessage({
        text: typeof result === 'string' && result ? result : 'Downloaded',
        tone: 'info',
      });
    } catch (err) {
      if (!mounted.current) return;
      failed = true;
      showMessage({ text: errorText(err, "Couldn't download"), tone: 'error' });
    }
    setDownload(failed ? 'failed' : 'done');
    downloadTimer.current = setTimeout(() => setDownload(null), ACTION_DONE_MS);
  }

  async function runDelete() {
    if (!onDelete || deleting) return;
    setArmed(false);
    setDeleting(true);
    showMessage(null);
    try {
      await onDelete(attachment);
      // On success the tile unmounts once the issue refetches; keep the spinner until then.
    } catch (err) {
      if (!mounted.current) return;
      setDeleting(false);
      showMessage({ text: errorText(err, "Couldn't delete"), tone: 'error' });
    }
  }

  // Keep the action bar up while something is in flight, confirming or reporting.
  const pinned = download !== null || deleting || armed || message !== null;

  return (
    <div
      data-testid="attachment-tile"
      className={`relative group p-1.5 -m-1.5 rounded-lg ${onPreview ? 'hover:bg-muted/60 focus-within:bg-muted/60' : ''}`}
    >
      {onPreview && (
        <button
          type="button"
          aria-label={`Preview ${attachment.filename}`}
          className="absolute inset-0 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onPreview(attachment)}
        />
      )}
      <div className={cn('pointer-events-none', deleting && 'opacity-50 transition-opacity')}>
        <div className="relative aspect-[4/3] w-full rounded-md border border-border bg-muted overflow-hidden">
          {isImage ? (
            <AuthImage
              {...getAttachmentImageSrc(attachment)}
              alt={attachment.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2">
              <div className="flex flex-col items-center gap-1.5">
                <Icon className="size-[26px] text-muted-foreground" />
                {ext && (
                  <span className="font-mono text-[10px] leading-none text-muted-foreground">
                    {ext}
                  </span>
                )}
              </div>
              {unavailable && (
                <span
                  className={cn(
                    'text-center text-[10px] leading-tight text-muted-foreground/60',
                    message && 'invisible',
                  )}
                >
                  {unavailable}
                </span>
              )}
            </div>
          )}
          {/* Bottom strip over the thumbnail (out of flow) so it never shifts the grid. */}
          {message && (
            <p
              role={message.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'absolute inset-x-0 bottom-0 line-clamp-2 border-t border-border bg-background px-1.5 py-1 text-center text-[10px] leading-tight',
                message.tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {message.text}
            </p>
          )}
        </div>
        {/* Reserve 2 name lines + the size line on the block, not the name, so the
            size sits right under a short name while tiles still align. */}
        <div className="mt-1.5 text-xs leading-snug min-h-[calc(2.75em+1rem)]">
          <span
            title={attachment.filename}
            className={`line-clamp-2 [overflow-wrap:anywhere] ${onPreview ? 'group-hover:underline' : ''}`}
          >
            {attachment.filename}
          </span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground tabular-nums">
            {sizeText || attachment.mimeType}
          </span>
        </div>
      </div>
      <div
        className={cn(
          'absolute top-3 right-3 z-10 flex gap-0.5 rounded bg-background/80 backdrop-blur-sm',
          pinned
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto',
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={(e) => {
            e.stopPropagation();
            void runDownload();
          }}
          title="Download"
          aria-label={`Download ${attachment.filename}`}
          aria-busy={download === 'busy'}
        >
          {download === 'busy' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : download === 'done' ? (
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : download === 'failed' ? (
            <X className="size-3.5 text-destructive" />
          ) : (
            <Download className="size-3.5" />
          )}
        </Button>
        {onDelete && (
          <button
            ref={deleteRef}
            type="button"
            disabled={deleting}
            data-armed={armed ? 'true' : undefined}
            aria-label={
              armed ? `Confirm: delete ${attachment.filename}` : `Delete ${attachment.filename}`
            }
            title={armed ? undefined : 'Delete'}
            onClick={(e) => {
              e.stopPropagation();
              if (armed) void runDelete();
              else setArmed(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && armed) {
                // Disarm only; don't let Escape also close the surrounding view.
                e.stopPropagation();
                e.preventDefault();
                setArmed(false);
              }
            }}
            onBlur={() => setArmed(false)}
            className={cn(
              'inline-flex h-6 items-center justify-center gap-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
              armed
                ? 'bg-destructive px-1.5 text-white hover:bg-destructive/90'
                : 'w-6 hover:bg-muted hover:text-destructive dark:hover:bg-muted/50',
            )}
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5 flex-none" />
            )}
            {armed && <span>Delete?</span>}
          </button>
        )}
      </div>
    </div>
  );
}
