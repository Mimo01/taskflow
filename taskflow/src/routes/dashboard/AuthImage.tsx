import { fetch } from '@tauri-apps/plugin-http';
import { useEffect, useRef, useState } from 'react';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

interface AuthImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}

/**
 * Image component that handles Jira attachment URLs requiring Bearer auth.
 * For URLs matching the Jira base URL, fetches via authenticated request
 * and renders as a blob URL. External URLs render directly.
 *
 * Follows redirects manually to preserve the Authorization header
 * (the Fetch spec strips it on cross-origin redirects).
 */
export function AuthImage({ src, alt, className, onClick }: AuthImageProps) {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const needsAuth = !!(jiraBaseUrl && src.startsWith(jiraBaseUrl.replace(/\/$/, '')));

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!needsAuth) return;

    setBlobUrl(null);
    setError(false);

    let cancelled = false;

    (async () => {
      try {
        const token = await readSecret('jira-pat');
        const headers = { Authorization: `Bearer ${token}` };

        const response = await fetch(src, { headers });

        if (cancelled) return;
        if (!response.ok) {
          setError(true);
          return;
        }
        const blob = await response.blob();
        if (cancelled) return;
        if (blob.size === 0) {
          setError(true);
          return;
        }
        const blobObjUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobObjUrl;
        setBlobUrl(blobObjUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src, needsAuth]);

  if (!needsAuth) {
    return <img src={src} alt={alt ?? ''} className={className} onClick={onClick} />;
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
        [image not available]
      </span>
    );
  }

  if (!blobUrl) {
    return <span className="inline-block w-32 h-20 bg-muted animate-pulse rounded-md" />;
  }

  return <img src={blobUrl} alt={alt ?? ''} className={className} onClick={onClick} />;
}
