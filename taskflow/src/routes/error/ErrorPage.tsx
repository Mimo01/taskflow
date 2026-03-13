import { useRouteError, useNavigate } from 'react-router-dom';

export default function ErrorPage() {
  const error = useRouteError() as { statusText?: string; message?: string };
  const navigate = useNavigate();

  const errorMessage =
    error?.statusText ?? error?.message ?? 'An unexpected error occurred.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 rounded-xl border border-border flex flex-col gap-4">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <button
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
          onClick={() => navigate('/dashboard')}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
