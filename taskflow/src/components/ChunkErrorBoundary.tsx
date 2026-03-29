import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ChunkErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-lg w-full space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-7" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Something went wrong loading this page
              </h1>
              <p className="text-sm text-muted-foreground">
                The page failed to load. Check your connection and try again.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="ghost" size="lg" onClick={() => window.location.reload()}>
                <RefreshCw />
                Retry Loading
              </Button>
              <Button size="lg" onClick={() => window.location.assign('/#/dashboard')}>
                <Home />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
