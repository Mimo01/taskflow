/**
 * ConnectionsSection — Jira + GitLab connection cards with inline test feedback.
 *
 * Each card shows the service URL and a password token field. Test Connection
 * calls readSecret then validateJira/validateGitLab with inline feedback.
 * Status resets when URL or token changes.
 *
 * Locked decisions (from CONTEXT.md):
 * - No toast/sonner — all feedback is inline
 * - No createContext/useContext — prop drilling only
 */

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateGitLab } from '@/services/gitlab';
import { validateJira } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

type TestStatus = 'idle' | 'pending' | 'success' | 'error';

interface ConnectionCardProps {
  title: string;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  secretKey: string;
  validateFn: (url: string, token: string) => Promise<unknown>;
  urlPlaceholder: string;
  urlId: string;
  tokenId: string;
}

function ConnectionCard({
  title,
  baseUrl,
  setBaseUrl,
  secretKey,
  validateFn,
  urlPlaceholder,
  urlId,
  tokenId,
}: ConnectionCardProps) {
  const [draftUrl, setDraftUrl] = useState(baseUrl);
  const [draftToken, setDraftToken] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const resetTestStatus = () => {
    setTestStatus('idle');
    setTestError(null);
  };

  const handleUrlChange = (value: string) => {
    setDraftUrl(value);
    resetTestStatus();
  };

  const handleTokenChange = (value: string) => {
    setDraftToken(value);
    resetTestStatus();
  };

  const handleSave = () => {
    setBaseUrl(draftUrl);
  };

  const handleTest = async () => {
    setTestStatus('pending');
    setTestError(null);
    try {
      const token = await readSecret(secretKey);
      await validateFn(draftUrl || baseUrl, token);
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error');
      setTestError((err as Error)?.message ?? 'Connection failed');
    }
  };

  return (
    <div className="border border-border rounded-lg p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold">{title}</span>
      </div>

      {/* URL field */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={urlId} className="text-sm font-medium">URL</label>
        <Input
          id={urlId}
          type="url"
          value={draftUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={urlPlaceholder}
          className="truncate"
        />
      </div>

      {/* Token field — masked, editable for pasting new token */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={tokenId} className="text-sm font-medium">Token</label>
        <Input
          id={tokenId}
          type="password"
          value={draftToken}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={!draftUrl}>
          Save
        </Button>
        <Button type="button" size="sm" disabled={testStatus === 'pending'} onClick={handleTest}>
          {testStatus === 'pending' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Testing…
            </>
          ) : (
            'Test Connection'
          )}
        </Button>
      </div>

      {/* Inline test status */}
      {testStatus === 'pending' && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Testing connection…</span>
        </div>
      )}
      {testStatus === 'success' && (
        <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Connected</span>
        </div>
      )}
      {testStatus === 'error' && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{testError}</span>
        </div>
      )}
    </div>
  );
}

export default function ConnectionsSection() {
  const { jiraBaseUrl, setJiraConnected, gitlabBaseUrl, setGitlabConnected } = useAuthStore();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Connections</h2>
      <ConnectionCard
        title="Jira"
        baseUrl={jiraBaseUrl ?? ''}
        setBaseUrl={(url) => setJiraConnected(true, url)}
        secretKey="jira-pat"
        validateFn={validateJira}
        urlPlaceholder="https://yourorg.atlassian.net"
        urlId="jira-base-url"
        tokenId="jira-api-token"
      />
      <ConnectionCard
        title="GitLab"
        baseUrl={gitlabBaseUrl ?? ''}
        setBaseUrl={(url) => setGitlabConnected(true, url)}
        secretKey="gitlab-pat"
        validateFn={validateGitLab}
        urlPlaceholder="https://gitlab.com"
        urlId="gitlab-base-url"
        tokenId="gitlab-token"
      />
    </div>
  );
}
