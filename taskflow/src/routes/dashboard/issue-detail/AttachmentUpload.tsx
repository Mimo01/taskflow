import { Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';

interface AttachmentUploadProps {
  issueKey: string;
  jiraBaseUrl: string;
  onUploadComplete?: () => void;
}

export function AttachmentUpload({ issueKey, jiraBaseUrl, onUploadComplete }: AttachmentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira credentials');
      return uploadAttachment(jiraBaseUrl, token, issueKey, file);
    },
    onSuccess: () => {
      setUploadingFilename(null);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      onUploadComplete?.();
    },
    onError: () => {
      const fname = uploadingFilename ?? 'file';
      setUploadError(`Failed to upload ${fname}. Check file size and try again.`);
      setUploadingFilename(null);
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      setUploadError(null);
      setUploadingFilename(file.name);
      mutation.mutate(file);
    },
    [mutation],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden="true"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        disabled={mutation.isPending}
        className="gap-1.5 text-xs"
      >
        <Upload className="size-3.5" />
        Attach file
      </Button>

      {/* Upload progress */}
      {uploadingFilename && mutation.isPending && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">{uploadingFilename} uploading...</p>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="text-xs text-destructive mt-1">{uploadError}</p>
      )}
    </div>
  );
}
