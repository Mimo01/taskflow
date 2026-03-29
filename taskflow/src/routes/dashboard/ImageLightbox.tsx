import { useEffect } from 'react';
import { AuthImage } from './AuthImage';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
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
      <AuthImage
        src={src}
        alt={alt ?? ''}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      />
    </div>
  );
}
