import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchVersionPolicy, isBelow } from './versionPolicy';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';

describe('fetchVersionPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed policy on valid response', async () => {
    vi.mocked(mockFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ softMinimum: '1.0.0', hardMinimum: '0.5.0', message: 'Please update' }),
    } as Response);

    const result = await fetchVersionPolicy('https://example.com/version-policy.json');
    expect(result).toEqual({ softMinimum: '1.0.0', hardMinimum: '0.5.0', message: 'Please update' });
  });

  it('returns null on fetch error', async () => {
    vi.mocked(mockFetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchVersionPolicy('https://example.com/version-policy.json');
    expect(result).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(mockFetch).mockResolvedValueOnce({
      ok: false,
    } as Response);

    const result = await fetchVersionPolicy('https://example.com/version-policy.json');
    expect(result).toBeNull();
  });

  it('returns null on malformed JSON (missing softMinimum)', async () => {
    vi.mocked(mockFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hardMinimum: '1.0.0' }),
    } as Response);

    const result = await fetchVersionPolicy('https://example.com/version-policy.json');
    expect(result).toBeNull();
  });

  it('returns null when response is not an object', async () => {
    vi.mocked(mockFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => 'not-an-object',
    } as Response);

    const result = await fetchVersionPolicy('https://example.com/version-policy.json');
    expect(result).toBeNull();
  });
});

describe('isBelow', () => {
  it("isBelow('1.5.0', '1.6.0') returns true", () => {
    expect(isBelow('1.5.0', '1.6.0')).toBe(true);
  });

  it("isBelow('1.6.0', '1.6.0') returns false", () => {
    expect(isBelow('1.6.0', '1.6.0')).toBe(false);
  });

  it("isBelow('1.7.0', '1.6.0') returns false", () => {
    expect(isBelow('1.7.0', '1.6.0')).toBe(false);
  });

  it("isBelow('0.0.0-dev', '1.0.0') returns false (dev build skip)", () => {
    expect(isBelow('0.0.0-dev', '1.0.0')).toBe(false);
  });

  it("isBelow('1.5.0-dev', '1.6.0') returns false (dev suffix skip)", () => {
    expect(isBelow('1.5.0-dev', '1.6.0')).toBe(false);
  });

  it('isBelow with invalid version string returns false (fail-open)', () => {
    expect(isBelow('not-a-version', '1.0.0')).toBe(false);
  });
});
