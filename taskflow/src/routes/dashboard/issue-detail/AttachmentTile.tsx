import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JiraAttachment } from '@/services/jira';
import { AuthImage } from '../AuthImage';
import { formatFileSize, getAttachmentImageSrc, getFileIcon } from './attachment-format';
import { getExtension, type PreviewUnavailable } from './resolvePreviewKind';

interface AttachmentTileProps {
  attachment: JiraAttachment;
  isImage: boolean;
  onDownload: (attachment: JiraAttachment) => void;
  onDelete?: (attachment: JiraAttachment) => void;
  onPreview?: (attachment: JiraAttachment) => void;
  /** Non-clickable tile: softer, faded thumbnail with a faint reason inside it (261112-fy2). */
  previewUnavailable?: PreviewUnavailable;
}

const UNAVAILABLE_LABEL: Record<PreviewUnavailable, string> = {
  unsupported: 'No preview',
  'too-large': 'Too large to preview',
};

const ACTION_VISIBILITY =
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto';

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
      <div className="pointer-events-none">
        <div
          className={`relative aspect-[4/3] w-full rounded-md border overflow-hidden ${unavailable ? 'border-border/70 bg-muted/40' : 'border-border bg-muted'}`}
        >
          {isImage ? (
            <AuthImage
              {...getAttachmentImageSrc(attachment)}
              alt={attachment.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2">
              <div
                className={`flex flex-col items-center gap-1.5 ${unavailable ? 'opacity-50' : ''}`}
              >
                <Icon className="size-[26px] text-muted-foreground" />
                {ext && (
                  <span className="font-mono text-[10px] leading-none text-muted-foreground">
                    {ext}
                  </span>
                )}
              </div>
              {unavailable && (
                <span className="text-center text-[10px] leading-tight text-muted-foreground/70">
                  {unavailable}
                </span>
              )}
            </div>
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
        className={`absolute top-3 right-3 z-10 flex gap-0.5 rounded bg-background/80 backdrop-blur-sm ${ACTION_VISIBILITY}`}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(attachment);
          }}
          title="Download"
          aria-label={`Download ${attachment.filename}`}
        >
          <Download className="size-3.5" />
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(attachment);
            }}
            aria-label={`Delete ${attachment.filename}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
