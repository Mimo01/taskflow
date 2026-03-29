import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';

function ThrowingComponent(): never {
  throw new Error('Test chunk load error');
}

describe('ChunkErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress React's error boundary console.error output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when no error', () => {
    render(
      <ChunkErrorBoundary>
        <div>Normal content</div>
      </ChunkErrorBoundary>,
    );
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders error heading when child throws', () => {
    render(
      <ChunkErrorBoundary>
        <ThrowingComponent />
      </ChunkErrorBoundary>,
    );
    expect(
      screen.getByText('Something went wrong loading this page'),
    ).toBeInTheDocument();
  });

  it('renders "Retry Loading" button in error state', () => {
    render(
      <ChunkErrorBoundary>
        <ThrowingComponent />
      </ChunkErrorBoundary>,
    );
    expect(screen.getByText('Retry Loading')).toBeInTheDocument();
  });

  it('renders "Go to Dashboard" button in error state', () => {
    render(
      <ChunkErrorBoundary>
        <ThrowingComponent />
      </ChunkErrorBoundary>,
    );
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });
});
