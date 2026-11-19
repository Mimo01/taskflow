/**
 * DebugModeSection — Advanced settings for Developer Tools.
 *
 * Master "Enable Developer Tools" toggle (capture options live in the Developer Tools
 * page's gear popover), clear notifications / cache, and reset actions.
 * Rendered inside Settings → Advanced.
 */

import { useQueryClient } from '@tanstack/react-query';
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
import { startWizardRerun } from '@/lib/onboarding-rerun';
import { clearAvatarCache } from '../../services/avatarCache';
import { removeSecret } from '../../services/stronghold';
import { useAuthStore } from '../../stores/auth.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useSettingsStore } from '../../stores/settings.store';

export default function DebugModeSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const setDevToolsEnabled = useSettingsStore((s) => s.setDevToolsEnabled);
  const clearAll = useNotificationsStore((s) => s.clearAll);
  const itemCount = useNotificationsStore((s) => s.items.length);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const [cleared, setCleared] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [resetDone, setResetDone] = useState<null | 'preferences' | 'all'>(null);

  function handleClear() {
    clearAll();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  async function handleClearCache() {
    await clearAvatarCache();
    queryClient.clear();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  }

  async function handleResetWizard() {
    await startWizardRerun(0);
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
    // onboardingComplete is now false: AppLayout renders a bare <Outlet/>, so leave
    // /settings (empty) and land on the wizard route.
    navigate('/', { replace: true });
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
              Capture API requests and inspect the query cache.
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

        <p className="text-xs text-muted-foreground">
          Capture options live in Developer Tools → settings
        </p>
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
                : itemCount === 0
                  ? 'No notifications cached. Resets the polling cursor.'
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
              <DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Clear all notifications?</DialogTitle>
                  <DialogDescription>
                    {itemCount === 0
                      ? 'This resets the polling cursor.'
                      : `This removes all ${itemCount} cached notification${itemCount !== 1 ? 's' : ''} and resets the polling cursor.`}{' '}
                    The next poll cycle will re-fetch the last 24 hours of activity.
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

        {/* Clear all app cache */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Clear all app cache</p>
            <p className="text-xs text-muted-foreground">
              {cacheCleared
                ? 'Done — data will re-fetch as you navigate.'
                : 'Clears cached avatars and all in-memory query data. Your settings and connections are not affected.'}
            </p>
          </div>
          {cacheCleared ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
              <Check className="h-3.5 w-3.5" />
              Cleared
            </div>
          ) : (
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" className="shrink-0" />}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Clear all app cache?</DialogTitle>
                  <DialogDescription>
                    This removes cached avatar images and all in-memory query results. Your
                    preferences, sidebar, connections, and stored tokens are NOT affected. Data
                    re-fetches automatically as you use the app.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <DialogClose render={<Button variant="destructive" onClick={handleClearCache} />}>
                    Clear cache
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
