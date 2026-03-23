/**
 * PinnedIssuesWidget -- compact pinned issues list for the widget grid.
 *
 * Reads pinned issue keys from the pinned-tabs store (no token loading needed).
 * Each item shows the issue key as a clickable link that navigates to the issue detail.
 */

import { Pin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';

export default function PinnedIssuesWidget(_props: { widgetId: string }) {
  const pinnedKeys = usePinnedTabsStore((s) => s.pinnedKeys);
  const navigate = useNavigate();

  if (pinnedKeys.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Pin className="size-5" />
          <span className="text-sm">No pinned issues</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2 overflow-auto">
      {pinnedKeys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => navigate(`/issue/${key}`)}
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm text-left w-full transition-colors"
        >
          <Pin className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-primary">{key}</span>
        </button>
      ))}
    </div>
  );
}
