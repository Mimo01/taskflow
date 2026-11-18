import { Component, type ErrorInfo, lazy, type ReactNode, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { WikiEditorPreset, WikiEditorProps } from './types';

const WikiEditor = lazy(() => import('./WikiEditor'));

const FRAME = 'rounded-lg border border-input bg-transparent dark:bg-input/30';
const MIN_HEIGHT: Record<WikiEditorPreset, string> = {
  full: 'min-h-[160px]',
  compact: 'min-h-[96px]',
};

function EditorSkeleton({ preset }: { preset: WikiEditorPreset }) {
  return (
    <div className={FRAME} data-testid="wiki-editor-skeleton">
      <Skeleton className="h-10 w-full rounded-b-none" />
      <div className={`${MIN_HEIGHT[preset]} px-4 py-3`}>
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

class EditorLoadBoundary extends Component<
  { preset: WikiEditorPreset; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WikiEditor] failed to load:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={FRAME}>
          <div className="h-10" />
          <div
            className={`${MIN_HEIGHT[this.props.preset]} px-4 py-3 text-sm text-muted-foreground`}
          >
            The editor couldn't load. Reload the page to try again.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function WikiEditorLazy(props: WikiEditorProps) {
  const preset = props.preset ?? 'full';
  return (
    <EditorLoadBoundary preset={preset}>
      <Suspense fallback={<EditorSkeleton preset={preset} />}>
        <WikiEditor {...props} />
      </Suspense>
    </EditorLoadBoundary>
  );
}
