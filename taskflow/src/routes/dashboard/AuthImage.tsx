import { useAuthBlob } from './issue-detail/useAuthBlob';

interface AuthImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Image component that handles Jira attachment URLs requiring Bearer auth.
 * Sources blob/loading/error state from the shared `useAuthBlob` hook so
 * there is one auth-fetch implementation shared with AttachmentPreviewModal.
 */
export function AuthImage({ src, alt, className, onClick }: AuthImageProps) {
  const { blobUrl, loading, error } = useAuthBlob(src);

  const handleKeyDown = onClick
    ? (e: React.KeyboardEvent<HTMLImageElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;

  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
        [image not available]
      </span>
    );
  }

  if (loading || !blobUrl) {
    return <span className="inline-block w-32 h-20 bg-muted animate-pulse rounded-md" />;
  }

  return (
    <img
      src={blobUrl}
      alt={alt ?? ''}
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    />
  );
}
