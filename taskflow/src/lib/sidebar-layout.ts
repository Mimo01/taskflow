/**
 * Sidebar auto-rail layout helper.
 *
 * Root cause it addresses: the app shell keeps the sidebar (and the peek panel)
 * in normal flow at a fixed width regardless of window width, so narrow windows
 * squeeze main content. When the remaining main width would drop below
 * MIN_MAIN_CONTENT_WIDTH the sidebar shows as the icon rail instead.
 *
 * The decision always uses the EXPANDED sidebar width, never the 64px rail
 * width. Using the rail width would free space, flip the decision back, and
 * make the layout oscillate.
 */

/** Minimum main-content width (CSS px) before rows start losing content. */
export const MIN_MAIN_CONTENT_WIDTH = 720;

/** PeekPanel default width (CSS px) when the user has not resized it. */
export const PEEK_PANEL_DEFAULT_WIDTH = 480;

export function shouldAutoRailSidebar({
  viewportWidth,
  sidebarWidth,
  peekWidth,
}: {
  viewportWidth: number;
  sidebarWidth: number;
  peekWidth: number;
}): boolean {
  return viewportWidth - sidebarWidth - peekWidth < MIN_MAIN_CONTENT_WIDTH;
}
