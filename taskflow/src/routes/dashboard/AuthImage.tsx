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
 * Translates AIO bridge attachment URLs (`/plugins/servlet/aio-tcms/bridge/tcms/browse?...`)
 * into the direct AIO binary download endpoint
 * `/rest/aio-tcms-api/1.0/project/{projectKey}/attachment/{attachmentId}`.
 * The bridge URL returns HTML (login/redirect page) so it can never be used as
 * `<img src>` — see 54-PROBE-FINDINGS.md Probe D. Returns the original src
 * unchanged when the URL is not an AIO bridge or the required context (base
 * URL + active project key) is missing.
 */
function resolveAttachmentUrl(
  src: string,
  jiraBaseUrl: string | null,
  activeJiraProject: string | null,
): string {
  if (!jiraBaseUrl || !activeJiraProject) return src;
  if (!src.includes('/plugins/servlet/aio-tcms/bridge/')) return src;
  try {
    const url = new URL(src);
    const base = new URL(jiraBaseUrl);
    if (url.host !== base.host) return src;
    const paramsStr = url.searchParams.get('params');
    if (!paramsStr) return src;
    const params = JSON.parse(paramsStr) as { attachmentId?: number | string };
    const attachmentId = params.attachmentId;
    if (attachmentId === undefined || attachmentId === null || attachmentId === '') return src;
    const baseStr = jiraBaseUrl.replace(/\/$/, '');
    return `${baseStr}/rest/aio-tcms-api/1.0/project/${activeJiraProject}/attachment/${attachmentId}`;
  } catch {
    return src;
  }
}

/**
 * Image component that handles Jira attachment URLs requiring Bearer auth.
 * For URLs matching the Jira base URL, fetches via authenticated request
 * and renders as a blob URL. External URLs render directly.
 *
 * AIO bridge attachment URLs are translated to the direct download endpoint
 * before fetching (see `resolveAttachmentUrl`).
 *
 * Follows redirects manually to preserve the Authorization header
 * (the Fetch spec strips it on cross-origin redirects).
 */
export function AuthImage({ src, alt, className, onClick }: AuthImageProps) {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject);
  const resolvedSrc = resolveAttachmentUrl(src, jiraBaseUrl, activeJiraProject);
  const needsAuth = !!(jiraBaseUrl && resolvedSrc.startsWith(jiraBaseUrl.replace(/\/$/, '')));

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

        const response = await fetch(resolvedSrc, { headers });

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
  }, [resolvedSrc, needsAuth]);

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
