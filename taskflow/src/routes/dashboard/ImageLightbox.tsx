import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { filenameFromSrc, openSavedFile, saveBlobUrl } from '@/lib/save-attachment';
import { ImageViewer } from './ImageViewer';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  // Only close when the press started on the backdrop too, so a pan drag
  // that is released over the backdrop doesn't dismiss the lightbox.
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const filename = filenameFromSrc(src, alt);

  // Same behaviour as the attachment Download: save, then auto-open (best effort).
  async function handleDownload(blobUrl: string) {
    const path = await saveBlobUrl(blobUrl, filename);
    openSavedFile(path).catch(() => undefined);
  }

  async function handleOpenExternal(blobUrl: string) {
    const path = await saveBlobUrl(blobUrl, filename);
    try {
      await openSavedFile(path);
    } catch (err) {
      throw new Error(
        `Couldn't open ${filename}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? 'Image preview'}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold z-10 cursor-pointer"
        aria-label="Close lightbox"
      >
        &times;
      </button>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation-stopper to prevent backdrop close when clicking the viewer */}
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <ImageViewer
          key={src}
          src={src}
          alt={alt ?? ''}
          onDownload={handleDownload}
          onOpenExternal={handleOpenExternal}
        />
      </div>
    </div>,
    document.body,
  );
}
