/**
 * DebugModeSection — Advanced settings for Developer Tools.
 *
 * Master toggle + granular toggles + retention limit + clear notifications.
 * Rendered inside Settings → Advanced.
 */

import { Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { readSecret, removeSecret } from '../../services/stronghold';
import { useAuthStore } from '../../stores/auth.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useSettingsStore } from '../../stores/settings.store';

const RETENTION_OPTIONS = ['50', '100', '200', '500', '1000'] as const;
const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 6, 8, 10, 12] as const;

export default function DebugModeSection() {
  const navigate = useNavigate();
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const setDevToolsEnabled = useSettingsStore((s) => s.setDevToolsEnabled);
  const requestLogging = useSettingsStore((s) => s.requestLogging);
  const setRequestLogging = useSettingsStore((s) => s.setRequestLogging);
  const responseBodyCapture = useSettingsStore((s) => s.responseBodyCapture);
  const setResponseBodyCapture = useSettingsStore((s) => s.setResponseBodyCapture);
  const operationProfiling = useSettingsStore((s) => s.operationProfiling);
  const setOperationProfiling = useSettingsStore((s) => s.setOperationProfiling);
  const performanceWaterfall = useSettingsStore((s) => s.performanceWaterfall);
  const setPerformanceWaterfall = useSettingsStore((s) => s.setPerformanceWaterfall);
  const retentionLimit = useSettingsStore((s) => s.retentionLimit);
  const setRetentionLimit = useSettingsStore((s) => s.setRetentionLimit);
  const jiraConcurrencyLimit = useSettingsStore((s) => s.jiraConcurrencyLimit);
  const setJiraConcurrencyLimit = useSettingsStore((s) => s.setJiraConcurrencyLimit);
  const clearAll = useNotificationsStore((s) => s.clearAll);
  const itemCount = useNotificationsStore((s) => s.items.length);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const setOnboardingComplete = useSettingsStore((s) => s.setOnboardingComplete);
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const gitlabBaseUrl = useAuthStore((s) => s.gitlabBaseUrl);
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject);
  const activeGitlabProject = useAuthStore((s) => s.activeGitlabProject);
  const setWizardState = useOnboardingStore((s) => s.set);
  const [cleared, setCleared] = useState(false);
  const [resetDone, setResetDone] = useState<null | 'preferences' | 'all'>(null);

  function handleClear() {
    clearAll();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  async function handleResetWizard() {
    const [jiraToken, gitlabToken] = await Promise.all([
      readSecret('jira-pat').catch(() => ''),
      readSecret('gitlab-pat').catch(() => ''),
    ]);
    setWizardState({
      step: 0,
      jiraUrl: jiraBaseUrl ?? '',
      jiraToken,
      jiraProject: activeJiraProject,
      jiraProjects: [],
      jiraValidated: false,
      gitlabUrl: gitlabBaseUrl ?? '',
      gitlabToken,
      gitlabProject: activeGitlabProject,
      gitlabProjects: [],
      gitlabValidated: false,
      integrationsVisited: false,
    });
    setOnboardingComplete(false);
    navigate('/');
  }

  function handleResetPreferences() {
    resetSettings('preferences');
    setResetDone('preferences');
    setTimeout(() => setResetDone(null), 3000);
  }

  async function handleResetAll() {
    useSettingsStore.getState().resetSettings('all');
    useAuthStore.getState().resetAuth();
    await removeSecret('jira-pat').catch(() => {});
    await removeSecret('gitlab-pat').catch(() => {});
    setResetDone('all');
    setTimeout(() => setResetDone(null), 3000);
  }

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Advanced</h2>

      {/* Developer Tools section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Developer Tools
        </h3>

        {/* Master toggle */}
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Enable Developer Tools</p>
            <p className="text-xs text-muted-foreground">
              Capture API requests, profile operations, and record performance data.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable Developer Tools"
            checked={devToolsEnabled}
            onChange={(e) => setDevToolsEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary shrink-0"
          />
        </label>

        {/* Granular toggles */}
        <div className={!devToolsEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <div className="flex flex-col gap-3 ml-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Request logging</p>
              <input
                type="checkbox"
                aria-label="Request logging"
                checked={requestLogging}
                onChange={(e) => setRequestLogging(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Response body capture</p>
              <input
                type="checkbox"
                aria-label="Response body capture"
                checked={responseBodyCapture}
                onChange={(e) => setResponseBodyCapture(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Operation profiling</p>
              <input
                type="checkbox"
                aria-label="Operation profiling"
                checked={operationProfiling}
                onChange={(e) => setOperationProfiling(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <p className="text-sm font-medium">Performance waterfall</p>
              <input
                type="checkbox"
                aria-label="Performance waterfall"
                checked={performanceWaterfall}
                onChange={(e) => setPerformanceWaterfall(e.target.checked)}
                className="h-4 w-4 accent-primary shrink-0"
              />
            </label>

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Retention limit</p>
              <Select
                value={retentionLimit.toString()}
                onValueChange={(val) => setRetentionLimit(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Jira concurrency limit</p>
                <p className="text-xs text-muted-foreground">Max parallel API calls (default: 6)</p>
              </div>
              <Select
                value={jiraConcurrencyLimit.toString()}
                onValueChange={(val) => setJiraConcurrencyLimit(Number(val))}
              >
                <SelectTrigger aria-label="Jira concurrency limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONCURRENCY_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Clear notifications */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Data
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Clear notification cache</p>
            <p className="text-xs text-muted-foreground">
              {cleared
                ? 'Done — next poll will re-fetch the last 24 hours'
                : `${itemCount} notification${itemCount !== 1 ? 's' : ''} cached. Clears all and resets the polling cursor.`}
            </p>
          </div>
          {cleared ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
              <Check className="h-3.5 w-3.5" />
              Cleared
            </div>
          ) : (
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={itemCount === 0}
                    className="shrink-0"
                  />
                }
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Clear all notifications?</DialogTitle>
                  <DialogDescription>
                    This removes all {itemCount} cached notification{itemCount !== 1 ? 's' : ''} and
                    resets the polling cursor. The next poll cycle will re-fetch the last 24 hours
                    of activity.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <DialogClose render={<Button variant="destructive" onClick={handleClear} />}>
                    Clear all
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Reset section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Reset
        </h3>

        {/* Row 1: Reset onboarding wizard */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reset onboarding wizard</p>
            <p className="text-xs text-muted-foreground">
              Re-run the setup wizard. Your existing credentials will be pre-filled.
            </p>
          </div>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
              Reset
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Re-run the setup wizard?</DialogTitle>
                <DialogDescription>
                  The wizard will open now with your existing Jira and GitLab credentials
                  pre-filled. Your connections and preferences are not affected.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <DialogClose render={<Button variant="destructive" onClick={handleResetWizard} />}>
                  Open Wizard
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Row 2: Reset preferences */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reset preferences</p>
            <p className="text-xs text-muted-foreground">
              {resetDone === 'preferences'
                ? 'Done — preferences restored to defaults'
                : 'Restore appearance, sidebar, notifications, workflow, integrations, and update settings to defaults.'}
            </p>
          </div>
          {resetDone === 'preferences' ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
              <Check className="h-3.5 w-3.5" />
              Done
            </div>
          ) : (
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
                Reset
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Reset preferences?</DialogTitle>
                  <DialogDescription>
                    Restores defaults for: Appearance, Sidebar, Notifications, Workflow,
                    Integrations, and Updates. Jira/GitLab connection settings and custom field keys
                    are kept.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <DialogClose
                    render={<Button variant="destructive" onClick={handleResetPreferences} />}
                  >
                    Reset
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Row 3: Reset all */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reset all</p>
            <p className="text-xs text-muted-foreground">
              {resetDone === 'all'
                ? 'Done — all settings and connections cleared'
                : 'Wipe all preferences AND remove Jira/GitLab connection details and stored access tokens.'}
            </p>
          </div>
          {resetDone === 'all' ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
              <Check className="h-3.5 w-3.5" />
              Done
            </div>
          ) : (
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
                Reset all
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Reset everything?</DialogTitle>
                  <DialogDescription>
                    This will restore all preferences to defaults, disconnect Jira and GitLab, and
                    permanently remove your stored access tokens from the secure vault. You will
                    need to reconnect your integrations.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <DialogClose render={<Button variant="destructive" onClick={handleResetAll} />}>
                    Reset all
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
