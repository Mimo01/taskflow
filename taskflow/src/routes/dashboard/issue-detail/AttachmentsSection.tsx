import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch } from '@tauri-apps/plugin-http';
import { ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { useState } from 'react';
import type { JiraAttachment } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { AttachmentFileRow } from './AttachmentFileRow';
import { AttachmentLightbox } from './AttachmentLightbox';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { AttachmentUpload } from './AttachmentUpload';

interface AttachmentsSectionProps {
  attachments: JiraAttachment[];
  issueKey: string;
  jiraBaseUrl: string;
  onDelete?: (attachment: JiraAttachment) => void;
}

export function AttachmentsSection({
  attachments,
  issueKey,
  jiraBaseUrl,
  onDelete,
}: AttachmentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(attachments.length > 0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dropUploadName, setDropUploadName] = useState<string | null>(null);
  const [dropUploadError, setDropUploadError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const nonImages = attachments.filter((a) => !a.mimeType.startsWith('image/'));

  // Mutation for drag-drop uploads
  const dropMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira credentials');
      return uploadAttachment(jiraBaseUrl, token, issueKey, file);
    },
    onSuccess: () => {
      setDropUploadName(null);
      setDropUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    },
    onError: () => {
      const fname = dropUploadName ?? 'file';
      setDropUploadError(`Failed to upload ${fname}. Check file size and try again.`);
      setDropUploadName(null);
    },
  });

  async function handleDownload(att: JiraAttachment) {
    try {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return;
      const resp = await fetch(att.content, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    }
  }

  function handleThumbnailClick(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setDropUploadError(null);
      setDropUploadName(file.name);
      dropMutation.mutate(file);
    }
  }

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Drag and drop files to attach"
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm font-semibold hover:text-foreground/80"
        >
          <ChevronIcon className="size-4" />
          <Paperclip className="size-3.5 text-muted-foreground" />
          Attachments ({attachments.length})
        </button>
        <div className="ml-auto">
          <AttachmentUpload issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />
        </div>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="border-2 border-dashed border-primary/50 rounded-lg p-6 text-center text-sm text-muted-foreground bg-primary/5 mb-2">
          Drop file here to attach
        </div>
      )}

      {/* Drop upload progress */}
      {dropUploadName && dropMutation.isPending && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">{dropUploadName} uploading...</p>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-primary rounded-full animate-pulse"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      )}

      {/* Drop upload error */}
      {dropUploadError && <p className="text-xs text-destructive mb-2">{dropUploadError}</p>}

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3">
          {attachments.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm font-medium text-muted-foreground">No attachments</p>
              <p className="text-xs text-muted-foreground mt-1">
                Attach files using the button above or drag and drop.
              </p>
            </div>
          ) : (
            <>
              {/* Image thumbnails grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, idx) => (
                    <AttachmentThumbnail
                      key={img.id}
                      attachment={img}
                      onClick={() => handleThumbnailClick(idx)}
                    />
                  ))}
                </div>
              )}

              {/* Non-image file list */}
              {nonImages.length > 0 && (
                <div>
                  {nonImages.map((file) => (
                    <AttachmentFileRow
                      key={file.id}
                      attachment={file}
                      onDownload={handleDownload}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      <AttachmentLightbox
        images={images}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </section>
  );
}
