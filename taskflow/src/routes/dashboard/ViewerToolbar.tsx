import { Download, ExternalLink, Maximize, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onDownload?: () => void;
  onOpenExternal?: () => void;
  /** Disables the view controls (zoom/fit/actual/rotate), not Download/Open. */
  controlsDisabled?: boolean;
  /** Error/status line rendered above the pill. */
  status?: string | null;
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
  status,
}: ViewerToolbarProps) {
  const hasView = !!(zoom || onFit || onActual || onRotate);
  const hasActions = !!(onDownload || onOpenExternal);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: propagation-stopper so toolbar clicks never reach the backdrop close handler
    <div
      className="flex flex-col items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {status && (
        <p role="alert" className="text-xs text-red-300 bg-black/60 rounded-full px-3 py-1">
          {status}
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
            onClick={onDownload}
            aria-label="Download"
            title="Download"
          >
            <Download className="size-4" />
          </Button>
        )}
        {onOpenExternal && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={BTN}
            onClick={onOpenExternal}
            aria-label="Open externally"
            title="Open in external app"
          >
            <ExternalLink className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
