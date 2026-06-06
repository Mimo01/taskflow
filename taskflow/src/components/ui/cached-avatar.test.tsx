import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      <CachedAvatar url="https://example.com/avatar.jpg" name="Jane Doe" />,
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
      <CachedAvatar url="https://example.com/avatar.jpg" name="Jane Doe" />,
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
      <CachedAvatar url="https://example.com/avatar.jpg" name="Jane Doe" />,
    );

    // Wait for img to appear
    await waitFor(() => {
      expect(container.querySelector('img')).toBeTruthy();
    });

    // Simulate img decode failure
    const img = container.querySelector('img') as HTMLImageElement;
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

    const { rerender, container } = render(<CachedAvatar url={null} name="Test" size={20} />);
    // size=20 -> size-5
    expect(container.firstChild).toHaveClass('size-5');

    rerender(<CachedAvatar url={null} name="Test" size={40} />);
    // size=40 -> size-10
    expect(container.firstChild).toHaveClass('size-10');
  });

  it('Test 7 (unassigned icon): when name is "Unassigned" and url is null, renders User icon (svg), not "U" text', async () => {
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');
    const { container } = render(<CachedAvatar url={null} name="Unassigned" />);

    const fallback = screen.getByRole('img');
    expect(fallback).toHaveAttribute('aria-label', 'Unassigned');
    // Should contain an SVG (the User icon), not the letter "U"
    expect(fallback.querySelector('svg')).toBeTruthy();
    expect(fallback.textContent).toBe('');
    // No img tag
    expect(container.querySelector('img')).toBeNull();
  });

  it('Test 8 (real name no avatar): when name is "Uma Thompson" and url is null, renders initials "UT", not icon', async () => {
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');
    render(<CachedAvatar url={null} name="Uma Thompson" />);

    const fallback = screen.getByRole('img');
    expect(fallback).toHaveAttribute('aria-label', 'Uma Thompson');
    expect(fallback).toHaveTextContent('UT');
    // No svg (no unassigned icon)
    expect(fallback.querySelector('svg')).toBeNull();
  });

  it('Test 9 (distinct unassigned styling): unassigned fallback has border-dashed; assigned-initials fallback does not', async () => {
    const { CachedAvatar } = await import('@/components/ui/cached-avatar');

    // Unassigned case: name="Unassigned", url=null
    const { unmount: unmountUnassigned } = render(<CachedAvatar url={null} name="Unassigned" />);
    const unassignedFallback = screen.getByRole('img', { name: 'Unassigned' });
    expect(unassignedFallback).toHaveClass('border-dashed');
    unmountUnassigned();

    // Assigned-initials case: name="Uma Thompson", url=null
    render(<CachedAvatar url={null} name="Uma Thompson" />);
    const assignedFallback = screen.getByRole('img', { name: 'Uma Thompson' });
    expect(assignedFallback).not.toHaveClass('border-dashed');
  });
});
