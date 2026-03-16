import { useState, useEffect } from 'react'
import { fetch } from '@tauri-apps/plugin-http'
import { readSecret } from '@/services/stronghold'
import { useAuthStore } from '@/stores/auth.store'

interface AuthImageProps {
  src: string
  alt?: string
  className?: string
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void
}

/**
 * Image component that handles Jira attachment URLs requiring Bearer auth.
 * For URLs matching the Jira base URL, fetches via authenticated request
 * and renders as a blob URL. External URLs render directly.
 */
export function AuthImage({ src, alt, className, onClick }: AuthImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl)

  const needsAuth = jiraBaseUrl && src.startsWith(jiraBaseUrl.replace(/\/$/, ''))

  useEffect(() => {
    if (!needsAuth) return

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const token = await readSecret('jira-pat')
        const response = await fetch(src, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          setError(true)
          return
        }
        const blob = await response.blob()
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, needsAuth])

  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
        [image not available]
      </span>
    )
  }

  if (needsAuth && loading) {
    return (
      <span className="inline-block w-32 h-20 bg-muted animate-pulse rounded-md" />
    )
  }

  return (
    <img
      src={needsAuth ? (blobUrl ?? '') : src}
      alt={alt ?? ''}
      className={className}
      onClick={onClick}
    />
  )
}
