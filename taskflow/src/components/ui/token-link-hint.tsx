import { ExternalLink } from 'lucide-react';
import { openExternal } from '@/lib/openExternal';

/** "Create a token" link shared by wizard and Settings; hidden when url is null. */
export function TokenLinkHint({ url }: { url: string | null }) {
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
      </button>
    </p>
  );
}
