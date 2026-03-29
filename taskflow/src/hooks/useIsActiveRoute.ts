import { useLocation } from 'react-router-dom';

/**
 * Returns true when the given pathname prefix matches the current route.
 * Used to pause polling queries when their view is not visible.
 *
 * @param routePath — exact pathname or prefix (e.g., '/sprint-board')
 */
export function useIsActiveRoute(routePath: string): boolean {
  const { pathname } = useLocation();
  return pathname === routePath || pathname.startsWith(routePath + '/');
}
