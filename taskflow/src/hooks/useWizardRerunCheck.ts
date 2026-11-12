/**
 * Launch-time check: when the user completed an older wizard version, seed the wizard from
 * saved values, flag a re-run (in-memory) and send them to `/`. onboardingComplete is left
 * untouched, so quitting part-way simply re-runs again next launch.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { landingStepFor, needsWizardRerun, startWizardRerun } from '@/lib/onboarding-rerun';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';

export function useWizardRerunCheck(): void {
  const navigate = useNavigate();
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const onboardingVersion = useSettingsStore((s) => s.onboardingVersion);
  const authHydrated = useAuthStore((s) => s._hasHydrated);
  const rerunActive = useOnboardingStore((s) => s.rerunActive);
  const [settingsHydrated, setSettingsHydrated] = useState(() =>
    useSettingsStore.persist.hasHydrated(),
  );
  const fired = useRef(false);

  useEffect(() => {
    if (settingsHydrated) return;
    return useSettingsStore.persist.onFinishHydration(() => setSettingsHydrated(true));
  }, [settingsHydrated]);

  useEffect(() => {
    if (fired.current || rerunActive || !authHydrated || !settingsHydrated) return;
    if (!needsWizardRerun({ onboardingComplete, onboardingVersion })) return;
    fired.current = true;
    void startWizardRerun(landingStepFor(onboardingVersion)).then(() => navigate('/'));
  }, [
    authHydrated,
    settingsHydrated,
    onboardingComplete,
    onboardingVersion,
    rerunActive,
    navigate,
  ]);
}
