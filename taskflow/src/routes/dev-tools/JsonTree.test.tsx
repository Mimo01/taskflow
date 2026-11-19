import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import JsonTree from './JsonTree';

const DOC = JSON.stringify({
  key: 'ABC-1',
  fields: { status: { name: 'Done', deep: { deeper: 1 } }, summary: 'Hello' },
});

describe('JsonTree', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders keys and values for JSON text at the default depth', () => {
    render(<JsonTree text={DOC} />);
    expect(screen.getByText('"key"')).toBeTruthy();
    expect(screen.getByText(/ABC-1/)).toBeTruthy();
    // depth 2 containers are collapsed by default and show a summary
    expect(screen.getByText('{…} 2 keys', { exact: false })).toBeTruthy();
    expect(screen.queryByText('"name"')).toBeNull();
  });

  it('expands and collapses a node', () => {
    render(<JsonTree text={DOC} />);
    expect(screen.queryByText('"name"')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle fields.status' }));
    expect(screen.getByText('"name"')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle fields.status' }));
    expect(screen.queryByText('"name"')).toBeNull();
  });

  it('Expand all and Collapse all work', () => {
    render(<JsonTree text={DOC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('"deeper"')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('"fields"')).toBeNull();
  });

  it('search highlights matches and auto-expands their ancestors', () => {
    const { container } = render(<JsonTree text={DOC} />);
    fireEvent.change(screen.getByLabelText('Search in body'), { target: { value: 'deeper' } });
    expect(screen.getByText('1 match')).toBeTruthy();
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(container.querySelector('mark')?.textContent).toBe('deeper');
  });

  it('clicking a key copies its path', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<JsonTree text={DOC} />);
    fireEvent.click(screen.getByTitle('Copy path fields.summary'));
    expect(writeText).toHaveBeenCalledWith('fields.summary');
  });

  it('pages long arrays with a Show N more row', () => {
    const arr = JSON.stringify(Array.from({ length: 130 }, (_, i) => i));
    render(<JsonTree text={arr} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show 30 more' }));
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).toBeNull();
  });

  it('falls back to a plain block for non-JSON text', () => {
    render(<JsonTree text="plain text body" />);
    expect(screen.getByText('plain text body')).toBeTruthy();
    expect(screen.queryByLabelText('Search in body')).toBeNull();
  });

  it('Raw toggle shows the raw text', () => {
    render(<JsonTree text={DOC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
    expect(screen.getByText(DOC)).toBeTruthy();
  });

  it('accepts a value prop', () => {
    render(<JsonTree value={{ a: 1 }} />);
    expect(screen.getByText('"a"')).toBeTruthy();
  });
});
