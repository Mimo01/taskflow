/**
 * LinkContextMenu — shared right-click menu for external links (quick task
 * 260827-f6e). Wraps any link-like element and offers "Open in System
 * Default", one "Open in {browser}" item per detected browser, and
 * "Copy link" — without changing the wrapped element's left-click behavior.
 *
 * By default the trigger renders `span.contents` so no block-level box is
 * introduced into inline flow (needed for wiki/markdown prose links, which
 * must stay a single inline `<a>`). Pass `render` to attach the trigger
 * directly to an existing element instead (the base-ui render-prop escape
 * hatch) — this is the pattern used everywhere else in this plan.
 */
import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { openExternalWith } from '@/lib/openExternal';
import { useDetectedBrowsers } from '@/lib/useDetectedBrowsers';

export function LinkContextMenu({
  href,
  children,
  render,
}: {
  href: string;
  children?: React.ReactNode;
  render?: React.ReactElement;
}) {
  const browsers = useDetectedBrowsers();
  const [copyLabel, setCopyLabel] = useState<'Copy link' | 'Copied!'>('Copy link');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  function handleCopyLink() {
    // Synchronous call, no preceding await — deferring this races the menu's
    // focus-return and throws `NotAllowedError: Document is not focused`
    // (RESEARCH Pitfall 3).
    navigator.clipboard
      .writeText(href)
      .then(() => {
        setCopyLabel('Copied!');
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => {
          setCopyLabel('Copy link');
          copyTimer.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard unavailable — leave the label in its idle state.
      });
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger render={render ?? <span className="contents" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => openExternalWith(href, null)}>
          <ExternalLink className="size-3.5" />
          Open in System Default
        </ContextMenuItem>
        {browsers.map((browser) => (
          <ContextMenuItem key={browser.id} onClick={() => openExternalWith(href, browser.path)}>
            <ExternalLink className="size-3.5" />
            Open in {browser.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem closeOnClick={false} onClick={handleCopyLink}>
          {copyLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
