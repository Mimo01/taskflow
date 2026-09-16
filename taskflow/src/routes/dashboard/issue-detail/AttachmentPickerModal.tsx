import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { isImageAttachment } from '@/lib/attachment-markup';
import type { JiraAttachment } from '@/services/jira';
import { formatFileSize } from './AttachmentFileRow';
import { AttachmentThumbnail } from './AttachmentThumbnail';

interface AttachmentPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachments: JiraAttachment[];
  onSelect: (attachment: JiraAttachment) => void;
}

export function AttachmentPickerModal({
  open,
  onOpenChange,
  attachments,
  onSelect,
}: AttachmentPickerModalProps) {
  const [filter, setFilter] = useState('');

  const lowerFilter = filter.trim().toLowerCase();
  const filtered = lowerFilter
    ? attachments.filter((a) => a.filename.toLowerCase().includes(lowerFilter))
    : attachments;
  const images = filtered.filter((a) => isImageAttachment(a));
  const nonImages = filtered.filter((a) => !isImageAttachment(a));

  function handleSelect(att: JiraAttachment) {
    onSelect(att);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert attachment</DialogTitle>
          <DialogDescription>
            Select an attachment to reference it in your comment.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Filter attachments…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attachments on this issue
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attachments match "{filter}"
          </p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((att) => (
                  <AttachmentThumbnail
                    key={att.id}
                    attachment={att}
                    onClick={() => handleSelect(att)}
                  />
                ))}
              </div>
            )}
            {nonImages.length > 0 && (
              <div>
                {nonImages.map((att) => (
                  <button
                    key={att.id}
                    type="button"
                    aria-label={att.filename}
                    className="flex items-center gap-2 w-full py-1.5 px-2 rounded hover:bg-muted/50 text-left"
                    onClick={() => handleSelect(att)}
                  >
                    <span className="text-sm truncate flex-1 min-w-0">{att.filename}</span>
                    {att.size != null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatFileSize(att.size)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
