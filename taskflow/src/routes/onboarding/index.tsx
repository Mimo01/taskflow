import { Navigate } from 'react-router-dom';
import OnboardingWizard from '@/components/app/OnboardingWizard';
import { useSettingsStore } from '@/stores/settings.store';

export default function Onboarding() {
  const { onboardingComplete } = useSettingsStore();
  if (onboardingComplete) return <Navigate to="/dashboard" replace />;
  return <OnboardingWizard />;
}
