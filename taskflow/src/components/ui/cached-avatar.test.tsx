import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockGetCachedBlobUrl = vi.fn();
const mockFetchAndCacheAvatar = vi.fn();
const mockEvictAvatar = vi.fn();
vi.mock('@/services/avatarCache', () => ({
  getCachedBlobUrl: (...args: unknown[]) => mockGetCachedBlobUrl(...args),
  fetchAndCacheAvatar: (...args: unknown[]) => mockFetchAndCacheAvatar(...args),
  evictAvatar: (...args: unknown[]) => mockEvictAvatar(...args),
}));

beforeEach(() => {
  mockGetCachedBlobUrl.mockReset();
  mockFetchAndCacheAvatar.mockReset();
  // Default: no cache hit, fetch returns null
  mockGetCachedBlobUrl.mockReturnValue(null);
  mockFetchAndCacheAvatar.mockResolvedValue(null);
});

describe('CachedAvatar component', () => {
  it('Test 1 (no url): renders initials div with role="img" and aria-label, no img tag', async () => {
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');
    const { container } = render(<CachedAvatar url={null} name="Jane Doe" />);

    // Should show initials fallback
    const initialsEl = screen.getByRole('img');
    expect(initialsEl).toHaveAttribute('aria-label', 'Jane Doe');
    expect(initialsEl).toHaveTextContent('JD');
    // No img tag
    expect(container.querySelector('img')).toBeNull();
  });

  it('Test 2 (loading state): shows initials initially, then shows img after cache resolves', async () => {
    mockFetchAndCacheAvatar.mockResolvedValue('blob:test-1');
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');

    const { container } = render(
      <CachedAvatar url="https://example.com/avatar.jpg" name="Jane Doe" />
    );

    // Initially shows initials (loading state)
    expect(screen.getByRole('img')).toHaveTextContent('JD');
    expect(container.querySelector('img')).toBeNull();

    // After fetch resolves, shows img with blob URL
    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img).toHaveAttribute('src', 'blob:test-1');
    });
  });

  it('Test 3 (cache hit): when getCachedBlobUrl returns value, renders img immediately on first paint', async () => {
    mockGetCachedBlobUrl.mockReturnValue('blob:cached-1');
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');

    const { container } = render(
      <CachedAvatar url="https://example.com/avatar.jpg" name="Jane Doe" />
    );

    // Should render img immediately (no loading flash)
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute('src', 'blob:cached-1');
    // fetchAndCacheAvatar should NOT have been called
    expect(mockFetchAndCacheAvatar).not.toHaveBeenCalled();
  });

  it('Test 4 (initials generation): getInitials handles various name formats', async () => {
    const { getInitials } = await import('@/components/ui/cached-avatar');
    expect(getInitials('Jane Doe')).toBe('JD');
    expect(getInitials('Alice')).toBe('A');
    expect(getInitials('')).toBe('');
  });

  it('Test 5 (onError fallback): when img fires onError, hides img and shows initials again', async () => {
    mockFetchAndCacheAvatar.mockResolvedValue('blob:bad-data');
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');

    const { container } = render(
      <CachedAvatar url="https://example.com/avatar.jpg" name="Jane Doe" />
    );

    // Wait for img to appear
    await waitFor(() => {
      expect(container.querySelector('img')).toBeTruthy();
    });

    // Simulate img decode failure
    const img = container.querySelector('img')!;
    fireEvent.error(img);

    // After error, img should be removed and initials should be visible again
    await waitFor(() => {
      expect(container.querySelector('img')).toBeNull();
    });
    const initialsEl = screen.getByRole('img');
    expect(initialsEl).toHaveTextContent('JD');
    // Bad entry should be evicted from cache
    expect(mockEvictAvatar).toHaveBeenCalledWith('https://example.com/avatar.jpg');
  });

  it('Test 6 (size prop): renders correct Tailwind size class for each size value', async () => {
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');

    const { rerender, container } = render(
      <CachedAvatar url={null} name="Test" size={20} />
    );
    // size=20 -> size-5
    expect(container.firstChild).toHaveClass('size-5');

    rerender(<CachedAvatar url={null} name="Test" size={40} />);
    // size=40 -> size-10
    expect(container.firstChild).toHaveClass('size-10');
  });
});
