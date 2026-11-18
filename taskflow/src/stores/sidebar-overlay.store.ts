/**
 * Sidebar overlay store -- non-persisted flag for the auto-rail overlay.
 *
 * When the sidebar is auto-collapsed to the icon rail, the user can expand it
 * as an overlay. This never touches the persisted sidebarCollapsed preference.
 */
import { create } from 'zustand';

interface SidebarOverlayState {
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  toggleOverlay: () => void;
}

export const useSidebarOverlayStore = create<SidebarOverlayState>()((set) => ({
  overlayOpen: false,
  setOverlayOpen: (open) => set({ overlayOpen: open }),
  toggleOverlay: () => set((s) => ({ overlayOpen: !s.overlayOpen })),
}));
