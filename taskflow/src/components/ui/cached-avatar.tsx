import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAvatarCache } from '@/hooks/useAvatarCache';
import { evictAvatar } from '@/services/avatarCache';

/** Generate 1-2 uppercase initials from a display name. */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const SIZE_MAP = { 20: 'size-5', 24: 'size-6', 32: 'size-8', 40: 'size-10' } as const;

interface CachedAvatarProps {
  /** Original avatar URL (Jira avatarUrls['48x48'] or GitLab avatar_url). Null/undefined shows initials permanently. */
  url: string | null | undefined;
  /** Display name — used to generate initials fallback and accessible label. */
  name: string;
  /** Pixel size (default: 32). Permitted: 20, 24, 32, 40. */
  size?: 20 | 24 | 32 | 40;
  /** Additional Tailwind classes for layout overrides. */
  className?: string;
}

/**
 * Drop-in replacement for all inline avatar <img> patterns.
 *
 * - Shows initials immediately as placeholder (no skeleton — initials are meaningful content per D-06)
 * - Swaps to <img> instantly when blob URL resolves from cache
 * - Handles null/undefined URL gracefully (permanent initials fallback)
 * - onError fallback: if blob URL contains non-image data (e.g. HTML auth redirect page),
 *   the img element fires onError and we fall back to initials
 */
export function CachedAvatar({ url, name, size = 32, className }: CachedAvatarProps) {
  const { blobUrl } = useAvatarCache(url);
  const sizeClass = SIZE_MAP[size];
  const initials = getInitials(name);
  const [imgFailed, setImgFailed] = useState(false);

  // Reset failure state when the source URL changes (different avatar)
  useEffect(() => setImgFailed(false), [url]);

  const handleError = useCallback(() => {
    setImgFailed(true);
    if (url) evictAvatar(url);
  }, [url]);

  const showImage = blobUrl && !imgFailed;

  return (
    <div className={cn('relative', sizeClass, className)}>
      {/* Initials fallback — always rendered, hidden when image is shown */}
      <div
        className={cn(
          sizeClass,
          'rounded-full bg-muted flex items-center justify-center',
          'text-[10px] font-medium text-foreground',
          showImage ? 'hidden' : 'flex',
        )}
        role="img"
        aria-label={name}
      >
        {initials}
      </div>
      {/* Image — shown only when blob URL is available and hasn't errored */}
      {showImage && (
        <img
          src={blobUrl}
          alt={name}
          className={cn(sizeClass, 'rounded-full object-cover')}
          onError={handleError}
        />
      )}
    </div>
  );
}
