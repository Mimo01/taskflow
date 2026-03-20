import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBreadcrumbStore } from './breadcrumb.store';

describe('breadcrumb.store', () => {
  beforeEach(() => {
    act(() => {
      useBreadcrumbStore.setState({ trail: [] });
    });
  });

  it('push adds an entry to the trail', () => {
    act(() => {
      useBreadcrumbStore.getState().push({ path: '/dash', label: 'Dashboard' });
    });
    expect(useBreadcrumbStore.getState().trail).toHaveLength(1);
    expect(useBreadcrumbStore.getState().trail[0]).toEqual({
      path: '/dash',
      label: 'Dashboard',
    });
  });

  it('two pushes produce trail with 2 entries in order', () => {
    act(() => {
      useBreadcrumbStore.getState().push({ path: '/dash', label: 'Dashboard' });
      useBreadcrumbStore.getState().push({ path: '/settings', label: 'Settings' });
    });
    const { trail } = useBreadcrumbStore.getState();
    expect(trail).toHaveLength(2);
    expect(trail[0].label).toBe('Dashboard');
    expect(trail[1].label).toBe('Settings');
  });

  it('pop removes last entry', () => {
    act(() => {
      useBreadcrumbStore.getState().push({ path: '/dash', label: 'Dashboard' });
      useBreadcrumbStore.getState().push({ path: '/settings', label: 'Settings' });
    });
    act(() => {
      useBreadcrumbStore.getState().pop();
    });
    const { trail } = useBreadcrumbStore.getState();
    expect(trail).toHaveLength(1);
    expect(trail[0].label).toBe('Dashboard');
  });

  it('reset clears the trail', () => {
    act(() => {
      useBreadcrumbStore.getState().push({ path: '/dash', label: 'Dashboard' });
      useBreadcrumbStore.getState().push({ path: '/settings', label: 'Settings' });
    });
    act(() => {
      useBreadcrumbStore.getState().reset();
    });
    expect(useBreadcrumbStore.getState().trail).toHaveLength(0);
  });
});
