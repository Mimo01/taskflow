import { ArrowLeft, Rocket } from 'lucide-react';
import type { TrailEntry } from '@/stores/breadcrumb.store';

interface ReleaseBreadcrumbHeaderProps {
  trail: TrailEntry[];
  versionName: string | undefined;
  onBack: () => void;
  onBreadcrumbClick: (index: number, path: string) => void;
}

export function ReleaseBreadcrumbHeader({
  trail,
  versionName,
  onBack,
  onBreadcrumbClick,
}: ReleaseBreadcrumbHeaderProps) {
  if (trail.length === 0) return null;
  return (
    <div className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" />
      </button>
      {trail.map((entry, i) => (
        <span key={entry.path} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted-foreground">/</span>}
          <button
            type="button"
            onClick={() => onBreadcrumbClick(i, entry.path)}
            className="text-muted-foreground hover:text-foreground"
          >
            {entry.label}
          </button>
        </span>
      ))}
      <span className="text-muted-foreground">/</span>
      <span className="font-medium">{versionName ?? 'Release'}</span>
    </div>
  );
}

interface ReleaseTitleHeadingProps {
  versionId: string;
  versionName: string;
}

export function ReleaseTitleHeading({ versionId, versionName }: ReleaseTitleHeadingProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Rocket className="size-4 text-muted-foreground" />
        <p className="text-xs font-mono text-muted-foreground">v{versionId}</p>
      </div>
      <h2 className="text-xl font-semibold leading-snug">{versionName}</h2>
    </div>
  );
}
