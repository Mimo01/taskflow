import type { JiraAttachment } from '@/services/jira';
import { AuthImage } from '../AuthImage';

interface AttachmentThumbnailProps {
  attachment: JiraAttachment;
  onClick: () => void;
}

export function AttachmentThumbnail({ attachment, onClick }: AttachmentThumbnailProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${attachment.filename} - click to view full size`}
      className="w-20 h-20 rounded-md overflow-hidden bg-muted relative group cursor-pointer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <AuthImage
        src={attachment.thumbnail ?? attachment.content}
        alt={attachment.filename}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
