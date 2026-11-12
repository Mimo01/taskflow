import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { openExternal } from '@/lib/openExternal';

/** One-line "Create a token" link + hint, shared by wizard and Settings. */
export function TokenLinkHint({
  url,
  hint,
  details,
}: {
  url: string | null;
  hint: ReactNode;
  /** Optional checklist lines shown under the hint (e.g. permissions to grant). */
  details?: readonly string[];
}) {
  if (!url) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <p>
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
      {details && details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
