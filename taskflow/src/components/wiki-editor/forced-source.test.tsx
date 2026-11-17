import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import { installLayoutStubs, textarea, renderEditor } from './shell-test-utils';

vi.mock('@/lib/wiki/editor', async (orig) => {
  const actual = await orig<typeof import('@/lib/wiki/editor')>();
  return {
    ...actual,
    loadWiki: (text: string, ...rest: unknown[]) =>
      text.includes('FORCE_FAIL')
        ? { kind: 'failed' as const, original: text, reason: 'test' }
        : (actual.loadWiki as (...a: unknown[]) => unknown)(text, ...rest),
  };
});

installLayoutStubs();

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('forced source', () => {
  it('opens in source with a quiet notice, disables Rich and keeps the preference', () => {
    renderEditor({ value: 'FORCE_FAIL text', onChange: vi.fn() });
    expect(textarea()).toBeInTheDocument();
    const notice = screen.getByText(
      "This text uses formatting the rich editor can't keep safely, so it opens in source.",
    );
    expect(notice.getAttribute('title')).toBe(notice.textContent);
    expect(screen.getByRole('radio', { name: /rich/i })).toBeDisabled();
    expect(useSettingsStore.getState().wikiEditorMode).toBe('rich');

    const ta = textarea();
    fireEvent.change(ta, { target: { value: 'clean text' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('radio', { name: /rich/i })).not.toBeDisabled();
    expect(textarea()).toBeInTheDocument();
    expect(useSettingsStore.getState().wikiEditorMode).toBe('rich');
  });
});
