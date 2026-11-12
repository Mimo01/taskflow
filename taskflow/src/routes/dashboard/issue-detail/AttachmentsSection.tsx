import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetch } from '@tauri-apps/plugin-http';
import { useRef, useState } from 'react';
import { assertOk, openSavedFile, saveBytes } from '@/lib/save-attachment';
import type { JiraAttachment } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { AttachmentFileRow } from './AttachmentFileRow';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { AttachmentUpload } from './AttachmentUpload';
import { resolvePreviewKind } from './resolvePreviewKind';
import { SectionHeader } from './SectionHeader';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dropUploadName, setDropUploadName] = useState<string | null>(null);
  const [dropUploadError, setDropUploadError] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const downloadFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const previewKinds = new Map(attachments.map((a) => [a.id, resolvePreviewKind(a)]));
  const images = attachments.filter((a) => previewKinds.get(a.id) === 'image');
  const nonImages = attachments.filter((a) => previewKinds.get(a.id) !== 'image');
  const previewable = attachments.filter((a) => previewKinds.get(a.id) !== 'other');

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

  async function fetchAndSave(att: JiraAttachment): Promise<string | null> {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) return null;
    const resp = await fetch(att.content, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrayBuffer = await assertOk(resp).arrayBuffer();
    return saveBytes(new Uint8Array(arrayBuffer), att.filename);
  }

  // Save only — launching is the explicit "Open externally" action.
  async function handleDownload(att: JiraAttachment) {
    try {
      const savedPath = await fetchAndSave(att);
      if (!savedPath) {
        showDownloadFeedback('No Jira credentials found.', true);
        return;
      }
      showDownloadFeedback(`${att.filename} saved to Downloads.`, false);
    } catch {
      showDownloadFeedback(`Failed to download ${att.filename}.`, true);
    }
  }

  // Preview-toolbar Download: the toolbar shows busy/✓/✕ on the button, so this
  // throws on failure and resolves to the confirmation it floats above the pill.
  async function handlePreviewDownload(att: JiraAttachment): Promise<string> {
    let savedPath: string | null;
    try {
      savedPath = await fetchAndSave(att);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Couldn't download ${att.filename}: ${reason}`);
    }
    if (!savedPath) throw new Error('No Jira credentials found.');
    return `${att.filename} saved to Downloads.`;
  }

  // Throws a readable Error so the preview modal can show it.
  async function handleOpenExternal(att: JiraAttachment): Promise<'opened' | 'revealed'> {
    try {
      const savedPath = await fetchAndSave(att);
      if (!savedPath) throw new Error('No Jira credentials found.');
      return await openSavedFile(savedPath);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Couldn't open ${att.filename}: ${reason}`);
    }
  }

  function handleThumbnailClick(img: JiraAttachment) {
    const index = previewable.indexOf(img);
    if (index === -1) return;
    setPreviewIndex(index);
    setPreviewOpen(true);
  }

  function handlePreviewClick(file: JiraAttachment) {
    const index = previewable.indexOf(file);
    if (index === -1) return;
    setPreviewIndex(index);
    setPreviewOpen(true);
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

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Drag and drop files to attach"
    >
      {/* Section header */}
      <SectionHeader
        title="Attachments"
        count={attachments.length}
        expanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        actions={<AttachmentUpload issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />}
      />

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
        <div className="space-y-3 density-compact:space-y-2 density-comfortable:space-y-4">
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No attachments</p>
          ) : (
            <>
              {/* Image thumbnails grid */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((img) => (
                    <AttachmentThumbnail
                      key={img.id}
                      attachment={img}
                      onClick={() => handleThumbnailClick(img)}
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
                      onPreview={
                        previewKinds.get(file.id) !== 'other'
                          ? () => handlePreviewClick(file)
                          : undefined
                      }
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

      {/* Preview modal */}
      <AttachmentPreviewModal
        items={previewable}
        currentIndex={previewIndex}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onNavigate={setPreviewIndex}
        onDownload={handlePreviewDownload}
        onOpenExternal={handleOpenExternal}
      />
    </section>
  );
}
