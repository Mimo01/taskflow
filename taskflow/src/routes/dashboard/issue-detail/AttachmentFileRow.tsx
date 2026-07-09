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

export function AttachmentFileRow({
  attachment,
  onDownload,
  onDelete,
  onPreview,
}: AttachmentFileRowProps) {
  const Icon = getFileIcon(attachment.mimeType);
  const sizeText = formatFileSize(attachment.size);

  const nameContent = (
    <>
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <span className={`text-sm truncate max-w-[240px] ${onPreview ? 'hover:underline' : ''}`}>
        {attachment.filename}
      </span>
      {sizeText && <span className="text-xs text-muted-foreground shrink-0">{sizeText}</span>}
      {!sizeText && (
        <span className="text-xs text-muted-foreground shrink-0">{attachment.mimeType}</span>
      )}
    </>
  );

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group">
      {onPreview ? (
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-left"
          onClick={() => onPreview(attachment)}
        >
          {nameContent}
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">{nameContent}</div>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100"
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
            className="size-7 opacity-0 group-hover:opacity-100 hover:text-destructive"
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
