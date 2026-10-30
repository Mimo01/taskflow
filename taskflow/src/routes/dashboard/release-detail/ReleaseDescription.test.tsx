import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReleaseDescription } from './ReleaseDescription';

// jsdom has no layout: stub the geometry the overflow check reads.
function stubGeometry(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReleaseDescription', () => {
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
    expect(screen.queryByText('MILESTONE')).not.toBeInTheDocument();
  });

  it('renders a differing milestone description after a MILESTONE label, as markdown', () => {
    render(
      <ReleaseDescription jiraDescription="Jira text" milestoneDescription="Notes with **bold**" />,
    );
    expect(screen.getByText('MILESTONE')).toHaveClass('uppercase', 'tracking-wide', 'text-xs');
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
