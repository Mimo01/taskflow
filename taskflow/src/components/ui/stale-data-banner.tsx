import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StaleDataBannerProps {
  onRetry: () => void;
  onDismiss: () => void;
}

export function StaleDataBanner({ onRetry, onDismiss }: StaleDataBannerProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
      <RefreshCw className="size-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground flex-1">
        Couldn't refresh — showing cached data
      </span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
