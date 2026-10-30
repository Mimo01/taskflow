import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from '@/lib/openExternal';
import { ReleaseDescription } from './ReleaseDescription';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));

// jsdom has no layout: stub the geometry the overflow check reads.
function stubGeometry(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReleaseDescription', () => {
  // 94-REVIEW WR-07: a markdown link must open in the external browser, never
  // navigate the app's own webview away.
  it('opens milestone-description links externally and keeps the webview in place', () => {
    vi.mocked(openExternal).mockClear();
    render(
      <ReleaseDescription milestoneDescription="See [the notes](https://example.com/notes)" />,
    );
    const link = screen.getByRole('link', { name: 'the notes' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(openExternal).toHaveBeenCalledWith('https://example.com/notes');
  });

  it('renders nothing when both descriptions are empty or whitespace', () => {
    const { container } = render(
      <ReleaseDescription jiraDescription="  " milestoneDescription="" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a muted 2-line clamped paragraph for the Jira description', () => {
    render(<ReleaseDescription jiraDescription="Ships the new header." />);
    const el = screen.getByTestId('release-description');
    expect(el).toHaveTextContent('Ships the new header.');
    expect(el).toHaveClass('text-[13px]', 'text-muted-foreground', 'max-w-[78ch]', 'line-clamp-2');
  });

  it('does not repeat a milestone description equal to the Jira one', () => {
    render(<ReleaseDescription jiraDescription="Same text" milestoneDescription=" Same text " />);
    expect(screen.getAllByText('Same text')).toHaveLength(1);
    expect(screen.queryByTitle('GitLab milestone description')).not.toBeInTheDocument();
  });

  it('renders a differing milestone description as plain muted text (no caps label), as markdown', () => {
    render(
      <ReleaseDescription jiraDescription="Jira text" milestoneDescription="Notes with **bold**" />,
    );
    expect(screen.queryByText('MILESTONE')).toBeNull();
    expect(screen.getByTitle('GitLab milestone description')).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('does not render raw HTML from the milestone description', () => {
    const { container } = render(
      <ReleaseDescription milestoneDescription={'<img src=x onerror=alert(1)> hi'} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows no toggle when the text does not overflow', () => {
    stubGeometry(20, 20);
    render(<ReleaseDescription jiraDescription="Short" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows "more" on overflow, and toggles to "less" and removes the clamp', async () => {
    stubGeometry(80, 40);
    const user = userEvent.setup();
    render(<ReleaseDescription jiraDescription="A very long description" />);
    const toggle = screen.getByRole('button', { name: 'more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const less = screen.getByRole('button', { name: 'less' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('release-description')).not.toHaveClass('line-clamp-2');
    await user.click(less);
    expect(screen.getByTestId('release-description')).toHaveClass('line-clamp-2');
  });
});
