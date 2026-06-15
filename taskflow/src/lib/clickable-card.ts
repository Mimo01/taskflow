import type { KeyboardEvent } from 'react';

interface ClickableCardProps {
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  tabIndex?: number;
}

/**
 * Makes a dashboard <Card> behave like a button (click + Enter/Space + focus ring)
 * while keeping its existing role="region" (so landmark/heading semantics and tests
 * are preserved). Returns a no-op when `onActivate` is undefined.
 *
 * Usage:
 *   const click = clickableCard(onActivate);
 *   <Card className={`relative overflow-hidden ${click.className}`} {...click.props}>
 */
export function clickableCard(onActivate?: () => void): {
  props: ClickableCardProps;
  className: string;
} {
  if (!onActivate) return { props: {}, className: '' };
  return {
    props: {
      onClick: onActivate,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      },
      tabIndex: 0,
    },
    className:
      'cursor-pointer transition-all hover:bg-muted/30 hover:shadow-md hover:ring-2 hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  };
}
