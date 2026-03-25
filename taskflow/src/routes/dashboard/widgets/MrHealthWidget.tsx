/**
 * MrHealthWidget -- wrapper around MrHealthPanel for the widget grid.
 *
 * Loads GitLab credentials internally from Stronghold and auth store,
 * shows skeleton while loading, then renders the underlying panel.
 */

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import MrHealthPanel from '../MrHealthPanel';

export default function MrHealthWidget(_props: { widgetId: string }) {
  const { gitlabBaseUrl, _hasHydrated } = useAuthStore();
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  useEffect(() => {
    if (gitlabBaseUrl) {
      setTokenLoading(true);
      readSecret('gitlab-pat')
        .then(setGitlabToken)
        .catch(() => setGitlabToken(null))
        .finally(() => setTokenLoading(false));
    } else if (_hasHydrated) {
      setTokenLoading(false);
    }
  }, [gitlabBaseUrl, _hasHydrated]);

  if (tokenLoading || !gitlabBaseUrl) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  return (
    <MrHealthPanel
      gitlabBaseUrl={gitlabBaseUrl}
      gitlabToken={gitlabToken ?? ''}
      tokenLoading={tokenLoading}
    />
  );
}
