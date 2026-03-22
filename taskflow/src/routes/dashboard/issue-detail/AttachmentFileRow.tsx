import { Download, File, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JiraAttachment } from '@/services/jira';

interface AttachmentFileRowProps {
  attachment: JiraAttachment;
  onDownload: (attachment: JiraAttachment) => void;
  onDelete?: (attachment: JiraAttachment) => void;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
    return FileText;
  }
  return File;
}

export function AttachmentFileRow({ attachment, onDownload, onDelete }: AttachmentFileRowProps) {
  const Icon = getFileIcon(attachment.mimeType);
  const sizeText = formatFileSize(attachment.size);

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <span className="text-sm truncate max-w-[240px]">{attachment.filename}</span>
      {sizeText && (
        <span className="text-xs text-muted-foreground shrink-0">{sizeText}</span>
      )}
      {!sizeText && (
        <span className="text-xs text-muted-foreground shrink-0">{attachment.mimeType}</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100"
          onClick={() => onDownload(attachment)}
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
            onClick={() => onDelete(attachment)}
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
