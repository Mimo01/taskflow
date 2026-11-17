import { X } from 'lucide-react';
import { formatFileSize } from './issue-detail/attachment-format';

/** Chips for files staged in a create flow; they upload after the issue exists. */
export function StagedFilesStrip({
  files,
  onRemove,
  disabled,
}: {
  files: readonly File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((file, index) => (
        <div
          // File objects have no stable unique id, so the index is part of the key.
          // biome-ignore lint/suspicious/noArrayIndexKey: no stable id on File
          key={`${file.name}-${index}`}
          title="will upload on save"
          className="flex items-center gap-1.5 rounded border border-dashed px-2 py-1 text-xs text-muted-foreground bg-muted/30"
        >
          <span className="truncate max-w-[160px]">{file.name}</span>
          {file.size > 0 && <span className="shrink-0">{formatFileSize(file.size)}</span>}
          <span className="shrink-0 italic">will upload on save</span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            className="shrink-0 rounded p-0.5 hover:bg-accent"
            onClick={() => onRemove(index)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
