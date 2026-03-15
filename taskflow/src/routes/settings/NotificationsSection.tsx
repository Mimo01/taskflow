/**
 * NotificationsSection — Settings page for notification preferences.
 *
 * Thin wrapper that mounts the existing NotificationSettingsSection component
 * (which contains poll interval + OS notification toggles and reads directly
 * from useSettingsStore).
 */
import NotificationSettingsSection from './NotificationSettingsSection';

export default function NotificationsSection() {
  return (
    <div data-testid="section-notifications" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <NotificationSettingsSection />
    </div>
  );
}
