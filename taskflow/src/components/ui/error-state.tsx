import { AlertCircle, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getErrorSource, isAuthError } from '@/lib/api-error';

interface ErrorStateProps {
  error: Error | unknown;
  onRetry?: () => void;
  viewName: string;
}

export function ErrorState({ error, onRetry, viewName }: ErrorStateProps) {
  const navigate = useNavigate();
  const authError = isAuthError(error);
  const source = getErrorSource(error);

  useEffect(() => {
    console.error(`[ErrorState] ${viewName}:`, error);
  }, [error, viewName]);

  if (authError) {
    const serviceName = source === 'gitlab' ? 'GitLab' : 'Jira';
    return (
      <Alert variant="destructive">
        <ShieldAlert />
        <AlertTitle>Session expired</AlertTitle>
        <AlertDescription>
          Your {serviceName} token may have been revoked or expired.
        </AlertDescription>
        <AlertAction>
          <Button variant="default" size="sm" onClick={() => navigate('/settings')}>
            Reconnect
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Couldn't load {viewName}</AlertTitle>
      <AlertDescription />
      {onRetry && (
        <AlertAction>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
