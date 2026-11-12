import { Navigate } from 'react-router-dom';
import OnboardingWizard from '@/components/app/OnboardingWizard';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function Onboarding() {
  const { onboardingComplete } = useSettingsStore();
  const rerunActive = useOnboardingStore((s) => s.rerunActive);
  if (onboardingComplete && !rerunActive) return <Navigate to="/dashboard" replace />;
  return <OnboardingWizard />;
}
