import { useEffect, useSyncExternalStore } from 'react';
import { PEEK_PANEL_DEFAULT_WIDTH, shouldAutoRailSidebar } from '@/lib/sidebar-layout';
import { usePeekStore } from '@/stores/peek.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useSidebarOverlayStore } from '@/stores/sidebar-overlay.store';

function subscribeResize(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}
const getViewportWidth = () => window.innerWidth;

/** True when the window can't fit the expanded sidebar (+ peek) and 720px of main. */
export function useSidebarAutoRail(): boolean {
  const viewportWidth = useSyncExternalStore(subscribeResize, getViewportWidth);
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const peekPanelWidth = useSettingsStore((s) => s.peekPanelWidth);
  const peekIssueKey = usePeekStore((s) => s.peekIssueKey);
  const peekWidth = peekIssueKey ? (peekPanelWidth ?? PEEK_PANEL_DEFAULT_WIDTH) : 0;
  const autoRail = shouldAutoRailSidebar({ viewportWidth, sidebarWidth, peekWidth });

  useEffect(() => {
    if (!autoRail) useSidebarOverlayStore.getState().setOverlayOpen(false);
  }, [autoRail]);

  return autoRail;
}
