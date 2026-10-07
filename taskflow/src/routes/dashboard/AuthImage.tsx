import { useState } from 'react';
import { useAuthBlob } from './issue-detail/useAuthBlob';

interface AuthImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  /** Used when `src` fails to fetch or decode (e.g. Jira thumbnail missing/unrenderable). */
  fallbackSrc?: string;
}

/**
 * Image component that handles Jira attachment URLs requiring Bearer auth.
 * Sources blob/loading/error state from the shared `useAuthBlob` hook so
 * there is one auth-fetch implementation shared with AttachmentPreviewModal.
 */
export function AuthImage({ src, alt, className, onClick, fallbackSrc }: AuthImageProps) {
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [fetchFailedSrc, setFetchFailedSrc] = useState<string | null>(null);
  const canFallback = !!fallbackSrc && fallbackSrc !== src;
  const useFallback = canFallback && (decodeFailed || fetchFailedSrc === src);
  const activeSrc = useFallback ? (fallbackSrc as string) : src;
  const { blobUrl, loading, error } = useAuthBlob(activeSrc);
  if (error && canFallback && !useFallback && fetchFailedSrc !== src) {
    setFetchFailedSrc(src);
  }

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
      onError={() => {
        if (canFallback && !useFallback) setDecodeFailed(true);
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    />
  );
}
