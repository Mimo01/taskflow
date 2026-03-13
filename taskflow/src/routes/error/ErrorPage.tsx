import { isRouteErrorResponse, useRouteError, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = 'Something went wrong';
  let description = 'An unexpected error occurred. Please try again or go back to the dashboard.';
  let detail: string | undefined;
  let statusCode: number | undefined;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    if (error.status === 404) {
      title = 'Page not found';
      description = "The page you're looking for doesn't exist or has been moved.";
    } else if (error.status === 401) {
      title = 'Unauthorized';
      description = "You don't have permission to view this page.";
    } else {
      title = error.statusText || title;
      description = typeof error.data === 'string' ? error.data : description;
    }
  } else if (error instanceof Error) {
    detail = error.message;
    if (error.stack) {
      // Show only the first line of the stack trace
      const stackLine = error.stack.split('\n')[1]?.trim();
      if (stackLine) detail = `${error.message}\n${stackLine}`;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Icon + status */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" />
          </div>
          {statusCode && (
            <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {statusCode}
            </span>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        </div>

        {/* Error detail (dev-friendly) */}
        {detail && (
          <pre className="text-xs font-mono bg-muted border border-border rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
            {detail}
          </pre>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button variant="ghost" size="lg" onClick={() => window.location.reload()}>
            <RefreshCw />
            Retry
          </Button>
          <Button size="lg" onClick={() => navigate('/dashboard')}>
            <Home />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
