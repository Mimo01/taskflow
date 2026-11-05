import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { headerActionLabel, headerSecondaryText, PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Epics" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Epics' })).toBeTruthy();
  });

  it('is text-3xl with a subtitle and text-2xl without', () => {
    const { rerender } = render(<PageHeader title="T" subtitle="sub" />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-3xl');
    rerender(<PageHeader title="T" />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-2xl');
  });

  it('lets titleSize override', () => {
    render(<PageHeader title="T" titleSize="3xl" />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-3xl');
  });

  it('renders subtitle, actions and titleAside', () => {
    render(
      <PageHeader
        title="T"
        subtitle="the sub"
        actions={<button type="button">Go</button>}
        titleAside={<span>aside</span>}
      />,
    );
    expect(screen.getByText('the sub')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
    expect(screen.getByText('aside')).toBeTruthy();
  });

  it('omits subtitle and actions wrappers when not provided', () => {
    const { container } = render(<PageHeader title="T" />);
    expect(container.querySelector('.flex-none')).toBeNull();
    expect(container.querySelector('.text-muted-foreground')).toBeNull();
  });

  it('has the expected structure classes and passes data-testid', () => {
    const { container } = render(
      <PageHeader title="T" actions={<span>a</span>} data-testid="hdr" />,
    );
    const header = screen.getByTestId('hdr');
    expect(header.tagName).toBe('HEADER');
    for (const c of ['@container', 'border-b', 'border-border', 'shrink-0']) {
      expect(header.classList.contains(c)).toBe(true);
    }
    const row = header.firstElementChild as HTMLElement;
    for (const c of ['px-6', 'py-4', 'flex-wrap', 'justify-between']) {
      expect(row.classList.contains(c)).toBe(true);
    }
    expect(container.querySelector('.flex-none')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).classList.contains('truncate')).toBe(true);
  });

  it('exports the compaction constants', () => {
    expect(headerSecondaryText).toBe('hidden @[52rem]:inline');
    expect(headerActionLabel).toBe('hidden @[44rem]:inline');
  });
});
