import {
  Check,
  Download,
  ExternalLink,
  Loader2,
  Maximize,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * A file action run by the toolbar. May return a promise; a resolved string is
 * shown as an info message, a rejection's message as an error.
 */
export type ToolbarAction = () => unknown;

type ActionId = 'download' | 'open';
type ActionPhase = { id: ActionId; phase: 'busy' | 'done' | 'failed' } | null;
type Message = { text: string; tone: 'error' | 'info' } | null;

const DONE_MS = 1500;
const INFO_MS = 3000;
const ERROR_MS = 6000;

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

interface ViewerToolbarProps {
  'aria-label'?: string;
  /** Zoom group: out / readout / in. */
  zoom?: {
    readout: string;
    onZoomOut: () => void;
    onZoomIn: () => void;
    zoomOutDisabled?: boolean;
    zoomInDisabled?: boolean;
  };
  onFit?: () => void;
  onActual?: () => void;
  onRotate?: () => void;
  onDownload?: ToolbarAction;
  onOpenExternal?: ToolbarAction;
  /** Disables the view controls (zoom/fit/actual/rotate), not Download/Open. */
  controlsDisabled?: boolean;
}

const BTN = 'text-white/80 hover:text-white hover:bg-white/10';

function Divider() {
  return <span className="bg-white/20 w-px h-5 mx-1" aria-hidden="true" />;
}

export function ViewerToolbar({
  'aria-label': ariaLabel = 'Image controls',
  zoom,
  onFit,
  onActual,
  onRotate,
  onDownload,
  onOpenExternal,
  controlsDisabled = false,
}: ViewerToolbarProps) {
  const hasView = !!(zoom || onFit || onActual || onRotate);
  const hasActions = !!(onDownload || onOpenExternal);
  const [action, setAction] = useState<ActionPhase>(null);
  const [message, setMessage] = useState<Message>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(actionTimer.current);
      clearTimeout(messageTimer.current);
    };
  }, []);

  function showMessage(next: Message) {
    clearTimeout(messageTimer.current);
    setMessage(next);
    if (next) {
      messageTimer.current = setTimeout(
        () => setMessage(null),
        next.tone === 'error' ? ERROR_MS : INFO_MS,
      );
    }
  }

  async function runAction(id: ActionId, fn: ToolbarAction, label: string) {
    if (action?.phase === 'busy') return;
    clearTimeout(actionTimer.current);
    showMessage(null);
    setAction({ id, phase: 'busy' });
    let failed = false;
    try {
      const result = await fn();
      if (!mounted.current) return;
      if (typeof result === 'string' && result) showMessage({ text: result, tone: 'info' });
    } catch (err) {
      if (!mounted.current) return;
      failed = true;
      showMessage({ text: errorText(err, `${label} failed`), tone: 'error' });
    }
    setAction({ id, phase: failed ? 'failed' : 'done' });
    actionTimer.current = setTimeout(() => setAction(null), DONE_MS);
  }

  function actionIcon(id: ActionId, Idle: typeof Download) {
    if (action?.id !== id) return <Idle className="size-4" />;
    if (action.phase === 'busy') return <Loader2 className="size-4 animate-spin" />;
    if (action.phase === 'done') return <Check className="size-4 text-emerald-300" />;
    return <X className="size-4 text-red-300" />;
  }

  return (
    // Keys are deliberately not stopped: shortcuts/Escape/arrows must reach the window/document listeners.
    // biome-ignore lint/a11y/noStaticElementInteractions: propagation-stopper so toolbar clicks never reach the backdrop close handler
    // biome-ignore lint/a11y/useKeyWithClickEvents: click-only stopper; keyboard is handled by window listeners
    <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
      {/* Floats above the pill (out of flow) so showing it never shifts the layout. */}
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-black/70 rounded-full px-3 py-1 pointer-events-none ${
            message.tone === 'error' ? 'text-red-300' : 'text-white/90'
          }`}
        >
          {message.text}
        </p>
      )}
      <div
        role="toolbar"
        aria-label={ariaLabel}
        className="bg-black/60 rounded-full px-2 py-1 flex items-center gap-1"
      >
        {zoom && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className={BTN}
              onClick={zoom.onZoomOut}
              disabled={controlsDisabled || zoom.zoomOutDisabled}
              aria-label="Zoom out"
              title="Zoom out (-)"
              aria-keyshortcuts="-"
            >
              <ZoomOut className="size-4" />
            </Button>
            <span className="text-white/80 text-xs tabular-nums min-w-10 text-center select-none">
              {zoom.readout}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className={BTN}
              onClick={zoom.onZoomIn}
              disabled={controlsDisabled || zoom.zoomInDisabled}
              aria-label="Zoom in"
              title="Zoom in (+)"
              aria-keyshortcuts="+"
            >
              <ZoomIn className="size-4" />
            </Button>
          </>
        )}
        {onFit && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={BTN}
            onClick={onFit}
            disabled={controlsDisabled}
            aria-label="Fit"
            title="Fit (0)"
            aria-keyshortcuts="0"
          >
            <Maximize className="size-4" />
          </Button>
        )}
        {onActual && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={`${BTN} text-xs`}
            onClick={onActual}
            disabled={controlsDisabled}
            aria-label="Actual size"
            title="Actual size (1)"
            aria-keyshortcuts="1"
          >
            1:1
          </Button>
        )}
        {onRotate && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={BTN}
            onClick={onRotate}
            disabled={controlsDisabled}
            aria-label="Rotate"
            title="Rotate (r)"
            aria-keyshortcuts="r"
          >
            <RotateCw className="size-4" />
          </Button>
        )}
        {hasView && hasActions && <Divider />}
        {onDownload && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={BTN}
            onClick={() => void runAction('download', onDownload, 'Download')}
            aria-label="Download"
            aria-busy={action?.id === 'download' && action.phase === 'busy'}
            title="Download to Downloads folder"
          >
            {actionIcon('download', Download)}
          </Button>
        )}
        {onOpenExternal && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={BTN}
            onClick={() => void runAction('open', onOpenExternal, 'Open externally')}
            aria-label="Open externally"
            aria-busy={action?.id === 'open' && action.phase === 'busy'}
            title="Open in external app"
          >
            {actionIcon('open', ExternalLink)}
          </Button>
        )}
      </div>
    </div>
  );
}
