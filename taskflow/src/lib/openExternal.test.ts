import { openUrl } from '@tauri-apps/plugin-opener';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import { openExternal, openExternalWith } from './openExternal';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

const mockedOpenUrl = vi.mocked(openUrl);

describe('openExternal', () => {
  beforeEach(() => {
    mockedOpenUrl.mockReset();
    useSettingsStore.setState({ externalBrowser: null });
  });

  it('calls openUrl with a single argument when no browser is selected', async () => {
    mockedOpenUrl.mockResolvedValue(undefined);

    await openExternal('https://example.com');

    expect(mockedOpenUrl).toHaveBeenCalledTimes(1);
    expect(mockedOpenUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('calls openUrl with the selected browser path when one is set', async () => {
    useSettingsStore.setState({ externalBrowser: '/Applications/Firefox.app' });
    mockedOpenUrl.mockResolvedValue(undefined);

    await openExternal('https://example.com');

    expect(mockedOpenUrl).toHaveBeenCalledWith('https://example.com', '/Applications/Firefox.app');
  });

  it('falls back to the default browser when the selected browser fails, without throwing', async () => {
    useSettingsStore.setState({ externalBrowser: '/Applications/Firefox.app' });
    mockedOpenUrl
      .mockRejectedValueOnce(new Error('launch failed'))
      .mockResolvedValueOnce(undefined);

    await expect(openExternal('https://example.com')).resolves.toBeUndefined();

    expect(mockedOpenUrl).toHaveBeenCalledTimes(2);
    expect(mockedOpenUrl).toHaveBeenNthCalledWith(
      1,
      'https://example.com',
      '/Applications/Firefox.app',
    );
    expect(mockedOpenUrl).toHaveBeenNthCalledWith(2, 'https://example.com');
  });

  it('does not retry and does not throw when no browser is selected and openUrl rejects', async () => {
    mockedOpenUrl.mockRejectedValue(new Error('no browser available'));

    await expect(openExternal('https://example.com')).resolves.toBeUndefined();

    expect(mockedOpenUrl).toHaveBeenCalledTimes(1);
  });
});

describe('openExternalWith', () => {
  beforeEach(() => {
    mockedOpenUrl.mockReset();
    useSettingsStore.setState({ externalBrowser: null });
  });

  it('calls openUrl with the explicit browser path when one is given', async () => {
    mockedOpenUrl.mockResolvedValue(undefined);

    await openExternalWith('https://example.com', '/Applications/Firefox.app');

    expect(mockedOpenUrl).toHaveBeenCalledTimes(1);
    expect(mockedOpenUrl).toHaveBeenCalledWith('https://example.com', '/Applications/Firefox.app');
  });

  it('calls openUrl with a single argument when browserPath is null (System Default)', async () => {
    mockedOpenUrl.mockResolvedValue(undefined);

    await openExternalWith('https://example.com', null);

    expect(mockedOpenUrl).toHaveBeenCalledTimes(1);
    expect(mockedOpenUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('ignores the settings store externalBrowser entirely', async () => {
    useSettingsStore.setState({ externalBrowser: '/Applications/Chrome.app' });
    mockedOpenUrl.mockResolvedValue(undefined);

    await openExternalWith('https://example.com', '/Applications/Firefox.app');

    // Explicit browser wins, not the store's default — and openUrl is called
    // exactly once (no fallback rung reads the store either).
    expect(mockedOpenUrl).toHaveBeenCalledTimes(1);
    expect(mockedOpenUrl).toHaveBeenCalledWith('https://example.com', '/Applications/Firefox.app');
  });

  it('resolves (never throws) when openUrl rejects', async () => {
    mockedOpenUrl.mockRejectedValue(new Error('launch failed'));

    await expect(
      openExternalWith('https://example.com', '/Applications/Firefox.app'),
    ).resolves.toBeUndefined();
    expect(mockedOpenUrl).toHaveBeenCalledTimes(1);
  });
});
