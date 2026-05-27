import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { openPath } from '@tauri-apps/plugin-opener';
import { ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { useRef, useState } from 'react';
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
  const [downloadFeedback, setDownloadFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const downloadFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  function showDownloadFeedback(message: string, isError: boolean) {
    if (downloadFeedbackTimer.current) clearTimeout(downloadFeedbackTimer.current);
    setDownloadFeedback({ message, isError });
    downloadFeedbackTimer.current = setTimeout(() => setDownloadFeedback(null), 3000);
  }

  async function handleDownload(att: JiraAttachment) {
    try {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) {
        showDownloadFeedback('No Jira credentials found.', true);
        return;
      }
      const resp = await fetch(att.content, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await resp.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      const savedPath = await invoke<string>('save_attachment', {
        bytes,
        filename: att.filename,
      });
      showDownloadFeedback(`${att.filename} saved to Downloads.`, false);
      openPath(savedPath).catch(() => undefined);
    } catch {
      showDownloadFeedback(`Failed to download ${att.filename}.`, true);
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
                <div className="flex flex-wrap gap-2">
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
                  {downloadFeedback && (
                    <p
                      className={`text-xs mt-1 ${downloadFeedback.isError ? 'text-destructive' : 'text-muted-foreground'}`}
                    >
                      {downloadFeedback.message}
                    </p>
                  )}
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
