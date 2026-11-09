import { AlertCircle, Check, Copy, ExternalLink, Lock, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { openExternal } from '@/lib/openExternal';
import { getIssueUnavailableInfo } from './unavailable-info';

interface IssueUnavailableProps {
  issueKey: string;
  jiraBaseUrl: string;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
}

export function IssueUnavailable({
  issueKey,
  jiraBaseUrl,
  error,
  onRetry,
  retrying = false,
}: IssueUnavailableProps) {
  const info = getIssueUnavailableInfo(error);
  const unavailable = info.kind === 'unavailable';
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.error('[IssueUnavailable]', error);
  }, [error]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = () => {
    void navigator.clipboard.writeText(issueKey).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  const Icon = unavailable ? Lock : AlertCircle;
  const explanation = unavailable
    ? `You may not have permission to see it, it may have been deleted or moved, or the key may be wrong.${info.status === 401 ? ' Your Jira session may also have expired.' : ''}`
    : "Jira didn't respond as expected. Check your connection and try again.";

  const openButton = jiraBaseUrl ? (
    <Button
      key="open"
      size="sm"
      variant={unavailable ? 'default' : 'outline'}
      onClick={() => void openExternal(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`)}
    >
      <ExternalLink />
      Open in Jira
    </Button>
  ) : null;
  const copyButton = (
    <Button key="copy" size="sm" variant="outline" onClick={handleCopy}>
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : 'Copy key'}
    </Button>
  );
  const retryButton = (
    <Button
      key="retry"
      size="sm"
      variant={unavailable ? 'ghost' : 'default'}
      onClick={onRetry}
      disabled={retrying}
    >
      <RotateCw className={retrying ? 'animate-spin' : undefined} />
      Try again
    </Button>
  );

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Icon className="mb-3 size-8 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">
          {unavailable ? "You can't view " : "Couldn't load "}
          <span className="font-mono">{issueKey}</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {unavailable
            ? [openButton, copyButton, retryButton]
            : [retryButton, openButton, copyButton]}
        </div>
      </div>
    </div>
  );
}
