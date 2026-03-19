import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface UseListNavigationOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  enabled?: boolean;
}

export function useListNavigation({
  itemCount,
  onSelect,
  enabled = true,
}: UseListNavigationOptions) {
  const [focusIndex, setFocusIndex] = useState(-1);

  // Reset focus when item count changes (data reload / route change)
  useEffect(() => {
    setFocusIndex(-1);
  }, []);

  // Reset on unmount (route navigation)
  useEffect(() => () => setFocusIndex(-1), []);

  // J = next row (stop at last item, no wrap)
  useHotkeys(
    'j',
    () => {
      setFocusIndex((prev) => Math.min(prev + 1, itemCount - 1));
    },
    { enabled: enabled && itemCount > 0 },
  );

  // K = previous row (stop at first item, no wrap)
  useHotkeys(
    'k',
    () => {
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    },
    { enabled: enabled && itemCount > 0 },
  );

  // Enter = open selected item
  useHotkeys(
    'enter',
    () => {
      if (focusIndex >= 0 && focusIndex < itemCount) {
        onSelect(focusIndex);
      }
    },
    { enabled: enabled && focusIndex >= 0 },
  );

  return { focusIndex, setFocusIndex };
}
