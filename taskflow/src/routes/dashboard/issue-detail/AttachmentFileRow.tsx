import { Download, File, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JiraAttachment } from '@/services/jira';

interface AttachmentFileRowProps {
  attachment: JiraAttachment;
  onDownload: (attachment: JiraAttachment) => void;
  onDelete?: (attachment: JiraAttachment) => void;
  onPreview?: (attachment: JiraAttachment) => void;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  const mime = mimeType ?? '';
  if (mime.startsWith('text/') || mime === 'application/pdf') {
    return FileText;
  }
  return File;
}

const ACTION_VISIBILITY =
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto';

export function AttachmentFileRow({
  attachment,
  onDownload,
  onDelete,
  onPreview,
}: AttachmentFileRowProps) {
  const Icon = getFileIcon(attachment.mimeType);
  const sizeText = formatFileSize(attachment.size);

  return (
    <div className="relative flex items-center gap-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 px-2 rounded hover:bg-muted/50 focus-within:bg-muted/50 group">
      {onPreview && (
        <button
          type="button"
          aria-label={`Preview ${attachment.filename}`}
          className="absolute inset-0 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onPreview(attachment)}
        />
      )}
      <div className="pointer-events-none flex items-center gap-2 flex-1 min-w-0">
        <Icon className="size-4 text-muted-foreground shrink-0" />
        <span
          className={`text-sm truncate max-w-[240px] ${onPreview ? 'group-hover:underline' : ''}`}
        >
          {attachment.filename}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {sizeText || attachment.mimeType}
        </span>
      </div>
      <div className="relative z-10 ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${ACTION_VISIBILITY}`}
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
            className={`size-7 ${ACTION_VISIBILITY} hover:text-destructive`}
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

export { formatFileSize };
