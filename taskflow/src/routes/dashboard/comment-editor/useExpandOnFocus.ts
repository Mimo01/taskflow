import { type FocusEvent, useState } from 'react';

interface Options {
  hasContent: boolean;
  onBlur?: () => void;
}

/**
 * Expanded/collapsed state for the idle-collapsed comment composer (D-03).
 * Explicit state rather than :focus-within, because the collapsed field unmounts on expansion
 * and React does not reliably fire blur for removed nodes. Collapses only when the text is
 * empty and focus leaves the wrapper (relatedTarget containment keeps the action row clickable).
 */
export function useExpandOnFocus({ hasContent, onBlur }: Options) {
  const [open, setOpen] = useState(false);
  const [wantsFocus, setWantsFocus] = useState(false);
  const expanded = open || hasContent;

  return {
    expanded,
    wantsFocus,
    expand: () => {
      setOpen(true);
      setWantsFocus(true);
    },
    focusHandled: () => setWantsFocus(false),
    wrapperProps: {
      onFocus: () => setOpen(true),
      onBlur: (e: FocusEvent<HTMLDivElement>) => {
        onBlur?.();
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !hasContent) {
          setOpen(false);
        }
      },
    },
  };
}
