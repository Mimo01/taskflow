/**
 * Settings — Full settings page with Credentials, Role, and Appearance sections.
 *
 * Accessible from the sidebar gear icon at any time after onboarding.
 * All sections allow changes without re-running onboarding.
 */
import TokenSection from './TokenSection';
import RoleSection from './RoleSection';
import ThemeSection from './ThemeSection';

export default function Settings() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your credentials, role, and appearance.
        </p>
      </div>

      <div className="flex flex-col gap-8 divide-y divide-border">
        <TokenSection />

        <div className="pt-8">
          <RoleSection />
        </div>

        <div className="pt-8">
          <ThemeSection />
        </div>
      </div>
    </div>
  );
}
