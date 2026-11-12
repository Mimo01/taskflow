import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { openExternal } from '@/lib/openExternal';

/** One-line "Create a token" link + hint, shared by wizard and Settings. */
export function TokenLinkHint({ url, hint }: { url: string | null; hint: ReactNode }) {
  if (!url) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => void openExternal(url)}
        className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        Create a token
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </button>{' '}
      {hint}
    </p>
  );
}
