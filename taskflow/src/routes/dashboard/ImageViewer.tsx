import { useRef, useState } from 'react';
import { fitScale, isPannable, MAX_SCALE, minScale } from '@/lib/image-viewer';
import { useAuthBlob } from './issue-detail/useAuthBlob';
import { useImageViewer } from './useImageViewer';
import { ViewerToolbar } from './ViewerToolbar';

/** An action may resolve to an info message to show under the image. */
type ViewerAction = (blobUrl: string) => unknown;

interface ImageViewerProps {
  src: string;
  alt: string;
  onDownload?: ViewerAction;
  onOpenExternal?: ViewerAction;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Shared zoomable image viewer (stage + image + toolbar). Mount with
 * `key={src}` so zoom/rotation reset on navigation.
 */
export function ImageViewer({ src, alt, onDownload, onOpenExternal }: ImageViewerProps) {
  const { blobUrl, loading, error } = useAuthBlob(src);
  const stageRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useImageViewer(stageRef);
  const [imgFailed, setImgFailed] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  const { loaded, scale, tx, ty, rot, naturalW, naturalH } = state;
  const pannable = isPannable(state);
  const floor = minScale(fitScale(naturalW, naturalH, state.stageW, state.stageH, rot));
  const zoomOutDisabled = !loaded || scale <= floor + 1e-3;
  const zoomInDisabled = !loaded || scale >= MAX_SCALE - 1e-3;
  const canClickZoom = loaded && !zoomInDisabled;

  async function run(action: ViewerAction | undefined, label: string) {
    if (!action || !blobUrl) return;
    setStatus(null);
    try {
      const message = await action(blobUrl);
      if (typeof message === 'string' && message) setStatus({ text: message, tone: 'info' });
    } catch (err) {
      setStatus({ text: errorMessage(err, `${label} failed`), tone: 'error' });
    }
  }

  const showPlaceholder = !loaded && !error && !imgFailed;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stage is a pointer surface; keyboard control is handled by a window listener in useImageViewer */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: click only stops backdrop close; keyboard is handled by window listeners */}
      <div
        ref={stageRef}
        className="relative overflow-hidden w-[90vw] h-[80vh] select-none touch-none"
        data-testid="image-viewer-stage"
        onClick={(e) => e.stopPropagation()}
      >
        {(error || imgFailed) && (
          <span className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
            [image not available]
          </span>
        )}
        {showPlaceholder && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-block w-64 h-40 bg-muted animate-pulse rounded-md" />
        )}
        {blobUrl && !error && !imgFailed && (
          <img
            src={blobUrl}
            alt={alt}
            draggable={false}
            className="absolute select-none bg-white max-w-none"
            style={{
              left: '50%',
              top: '50%',
              width: loaded ? naturalW : undefined,
              height: loaded ? naturalH : undefined,
              marginLeft: loaded ? -naturalW / 2 : undefined,
              marginTop: loaded ? -naturalH / 2 : undefined,
              transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rot}deg)`,
              transformOrigin: 'center',
              // grab = drag to pan (click returns to rest); zoom-in = click zooms toward the cursor.
              cursor: pannable ? 'grab' : canClickZoom ? 'zoom-in' : 'default',
              opacity: loaded ? 1 : 0,
            }}
            onLoad={(e) => {
              const img = e.currentTarget;
              dispatch({
                type: 'loaded',
                naturalW: img.naturalWidth,
                naturalH: img.naturalHeight,
              });
            }}
            onError={() => setImgFailed(true)}
          />
        )}
      </div>
      <ViewerToolbar
        aria-label="Image controls"
        zoom={{
          readout: `${Math.round(scale * 100)}%`,
          onZoomOut: () => dispatch({ type: 'zoomOut' }),
          onZoomIn: () => dispatch({ type: 'zoomIn' }),
          zoomOutDisabled,
          zoomInDisabled,
        }}
        onFit={() => dispatch({ type: 'fit' })}
        onActual={() => dispatch({ type: 'actual' })}
        onRotate={() => dispatch({ type: 'rotate', dir: 1 })}
        onDownload={
          onDownload && blobUrl && !loading ? () => void run(onDownload, 'Download') : undefined
        }
        onOpenExternal={
          onOpenExternal && blobUrl && !loading
            ? () => void run(onOpenExternal, 'Open externally')
            : undefined
        }
        controlsDisabled={!loaded}
        status={status?.text ?? null}
        statusTone={status?.tone}
      />
    </div>
  );
}
