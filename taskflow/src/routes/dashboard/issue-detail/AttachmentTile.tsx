import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JiraAttachment } from '@/services/jira';
import { AuthImage } from '../AuthImage';
import { formatFileSize, getAttachmentImageSrc, getFileIcon } from './attachment-format';
import { getExtension } from './resolvePreviewKind';

interface AttachmentTileProps {
  attachment: JiraAttachment;
  isImage: boolean;
  onDownload: (attachment: JiraAttachment) => void;
  onDelete?: (attachment: JiraAttachment) => void;
  onPreview?: (attachment: JiraAttachment) => void;
}

const ACTION_VISIBILITY =
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto';

export function AttachmentTile({
  attachment,
  isImage,
  onDownload,
  onDelete,
  onPreview,
}: AttachmentTileProps) {
  const Icon = getFileIcon(attachment.mimeType);
  const sizeText = formatFileSize(attachment.size);
  const ext = getExtension(attachment.filename ?? '').toUpperCase();

  return (
    <div
      data-testid="attachment-tile"
      className={`relative group p-1 -m-1 rounded-lg ${onPreview ? 'hover:bg-muted/60 focus-within:bg-muted/60' : ''}`}
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
        <div className="relative aspect-[4/3] w-full rounded-md border border-border bg-muted overflow-hidden">
          {isImage ? (
            <AuthImage
              {...getAttachmentImageSrc(attachment)}
              alt={attachment.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="size-[26px] text-muted-foreground" />
              </div>
              {ext && (
                <span className="absolute bottom-1.5 inset-x-0 text-center font-mono text-[10px] text-muted-foreground">
                  {ext}
                </span>
              )}
            </>
          )}
        </div>
        <div className="mt-1.5">
          <span
            title={attachment.filename}
            className={`block text-xs leading-snug line-clamp-2 [overflow-wrap:anywhere] min-h-[2.75em] ${onPreview ? 'group-hover:underline' : ''}`}
          >
            {attachment.filename}
          </span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            {sizeText || attachment.mimeType}
          </span>
        </div>
      </div>
      <div
        className={`absolute top-2.5 right-2.5 z-10 flex gap-0.5 rounded bg-background/80 backdrop-blur-sm ${ACTION_VISIBILITY}`}
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
