import { Loader2 } from 'lucide-react';

export function RouteSpinner() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="min-h-screen flex items-center justify-center"
    >
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
