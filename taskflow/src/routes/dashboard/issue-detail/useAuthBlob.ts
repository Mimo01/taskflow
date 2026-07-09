import { fetch } from '@tauri-apps/plugin-http';
import { useEffect, useRef, useState } from 'react';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Translates AIO bridge attachment URLs (`/plugins/servlet/aio-tcms/bridge/tcms/browse?...`)
 * into the direct AIO binary download endpoint
 * `/rest/aio-tcms-api/1.0/project/{projectKey}/attachment/{attachmentId}`.
 * The bridge URL returns HTML (login/redirect page) so it can never be used as
 * a binary source — see 54-PROBE-FINDINGS.md Probe D. Returns the original src
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

interface UseAuthBlobResult {
  blobUrl: string | null;
  loading: boolean;
  error: boolean;
  getText: () => Promise<string>;
  getDataUrl: (mimeType?: string) => Promise<string>;
}

interface UseAuthBlobOptions {
  /**
   * Skip the automatic blob-URL fetch effect. Use for consumers that only
   * call getText()/getDataUrl() on demand (text/code/PDF previews) so the
   * attachment isn't fetched twice — once for the unused blobUrl, once for
   * the text/data-url the consumer actually renders.
   */
  lazy?: boolean;
}

const MAX_DATA_URL_SOURCE_BYTES = 8 * 1024 * 1024; // 8 MB — base64 overhead + WKWebView data-URI limits

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Shared auth-fetch-to-blob hook for Jira attachment content.
 *
 * Fetches URLs matching the Jira base URL via an authenticated request
 * (Bearer PAT) and exposes the result as an object URL. External URLs pass
 * through unchanged (no fetch, no auth). Follows redirects manually to
 * preserve the Authorization header (the Fetch spec strips it on
 * cross-origin redirects) by using `@tauri-apps/plugin-http` fetch, which
 * escapes the webview origin (browser `fetch` cannot reach Jira directly).
 *
 * `getText()` re-fetches the same resolved URL and returns the body as text
 * — used by text/code preview branches that need the raw content rather
 * than an object URL.
 */
export function useAuthBlob(src: string, options?: UseAuthBlobOptions): UseAuthBlobResult {
  const lazy = options?.lazy ?? false;
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject);
  const resolvedSrc = resolveAttachmentUrl(src, jiraBaseUrl, activeJiraProject);
  const needsAuth = !!(jiraBaseUrl && resolvedSrc.startsWith(jiraBaseUrl.replace(/\/$/, '')));

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(needsAuth && !lazy);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!needsAuth || lazy) {
      setLoading(false);
      return;
    }

    setBlobUrl(null);
    setError(false);
    setLoading(true);

    let cancelled = false;

    (async () => {
      try {
        const token = await readSecret('jira-pat');
        const headers = { Authorization: `Bearer ${token}` };

        const response = await fetch(resolvedSrc, { headers });

        if (cancelled) return;
        if (!response.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const blob = await response.blob();
        if (cancelled) return;
        if (blob.size === 0) {
          setError(true);
          setLoading(false);
          return;
        }
        const blobObjUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobObjUrl;
        setBlobUrl(blobObjUrl);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [resolvedSrc, needsAuth, lazy]);

  async function getText(): Promise<string> {
    if (!needsAuth) {
      const resp = await fetch(resolvedSrc);
      if (!resp.ok) throw new Error('Failed to fetch attachment text');
      return resp.text();
    }
    const token = await readSecret('jira-pat');
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch(resolvedSrc, { headers });
    if (!response.ok) throw new Error('Failed to fetch attachment text');
    const blob = await response.blob();
    return blob.text();
  }

  // Fetches the attachment as bytes and returns a `data:` URI rather than a
  // `blob:` object URL. WKWebView (Tauri's macOS/iOS webview) frequently
  // fails to render `blob:` URLs with application/pdf content inline via
  // <iframe>/<embed> even though the identical bytes render fine as a
  // `data:` URI — this is the PDF-preview equivalent of the blobUrl path
  // above, used only by consumers that hit that gap (PdfPreview).
  async function getDataUrl(mimeType = 'application/octet-stream'): Promise<string> {
    if (!needsAuth) return resolvedSrc;
    const token = await readSecret('jira-pat');
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch(resolvedSrc, { headers });
    if (!response.ok) throw new Error('Failed to fetch attachment');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DATA_URL_SOURCE_BYTES) {
      throw new Error('Attachment too large to preview inline');
    }
    return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
  }

  if (!needsAuth) {
    return { blobUrl: src, loading: false, error: false, getText, getDataUrl };
  }

  return { blobUrl, loading, error, getText, getDataUrl };
}
