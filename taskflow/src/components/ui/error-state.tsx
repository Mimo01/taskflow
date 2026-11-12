import { AlertCircle, ShieldAlert } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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

interface CardErrorStateProps {
  error: Error | unknown;
  onRetry?: () => void;
  viewName: string;
  className?: string;
}

/**
 * Compact, centred in-card error. Built on EmptyState so it matches the empty states
 * of the same cards. Never renders error.message (may contain URLs / server internals).
 * The action wrapper stops click/keydown propagation so a whole-card clickable parent
 * never navigates when the button is used.
 */
export function CardErrorState({ error, onRetry, viewName, className }: CardErrorStateProps) {
  const navigate = useNavigate();
  const authError = isAuthError(error);
  const source = getErrorSource(error);

  useEffect(() => {
    console.error(`[CardErrorState] ${viewName}:`, error);
  }, [error, viewName]);

  const service = source === 'gitlab' ? 'GitLab' : 'Jira';

  const wrapAction = (button: ReactNode) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops propagation to a clickable parent card
    <span
      className="inline-block"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {button}
    </span>
  );

  return (
    <div role="alert" className="w-full">
      {authError ? (
        <EmptyState
          compact
          className={className}
          icon={ShieldAlert}
          title={`${service} token rejected`}
          subtitle={`Update your ${service} token in Settings.`}
          action={wrapAction(
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
              Open Settings
            </Button>,
          )}
        />
      ) : (
        <EmptyState
          compact
          className={className}
          icon={AlertCircle}
          title={`Couldn't load ${viewName}`}
          subtitle="Check your connection and try again."
          action={
            onRetry
              ? wrapAction(
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    Retry
                  </Button>,
                )
              : undefined
          }
        />
      )}
    </div>
  );
}
