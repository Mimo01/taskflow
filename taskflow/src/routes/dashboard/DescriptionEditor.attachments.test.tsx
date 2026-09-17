import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { DescriptionEditor, type DescriptionEditorHandle } from './DescriptionEditor';

// Mock react-router-dom — WikiRenderer's `a` override needs useNavigate/useLocation.
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({
    pathname: '/dashboard',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  })),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-jira-token'),
}));

vi.mock('@/lib/useDetectedBrowsers', () => ({
  useDetectedBrowsers: () => [],
}));

const IMAGE_ATT: JiraAttachment = {
  id: '1',
  filename: 'diagram.png',
  content: 'https://jira.example.com/secure/attachment/1/diagram.png',
  mimeType: 'image/png',
};

const PDF_ATT: JiraAttachment = {
  id: '2',
  filename: 'report.pdf',
  content: 'https://jira.example.com/secure/attachment/2/report.pdf',
  mimeType: 'application/pdf',
};

function Harness({
  value,
  onChange,
  attachments,
  stagedFiles,
  onFileSelected,
  onRemoveStagedFile,
}: {
  value: string;
  onChange: (v: string) => void;
  attachments?: JiraAttachment[];
  stagedFiles?: File[];
  onFileSelected?: (file: File) => void;
  onRemoveStagedFile?: (index: number) => void;
}) {
  return (
    <DescriptionEditor
      value={value}
      onChange={onChange}
      attachments={attachments}
      stagedFiles={stagedFiles}
      onFileSelected={onFileSelected}
      onRemoveStagedFile={onRemoveStagedFile}
    />
  );
}

describe('DescriptionEditor attachments', () => {
  it('opens the attachment picker from the Paperclip toolbar button', () => {
    render(<Harness value="" onChange={vi.fn()} attachments={[IMAGE_ATT]} />);

    expect(screen.queryByText('Insert attachment')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Insert attachment'));
    expect(screen.getByText('Insert attachment')).toBeInTheDocument();
  });

  it('selecting an image attachment inserts !name.png! at the cursor via onChange', () => {
    const onChange = vi.fn();
    render(<Harness value="" onChange={onChange} attachments={[IMAGE_ATT]} />);

    fireEvent.click(screen.getByTitle('Insert attachment'));
    fireEvent.click(screen.getByRole('button', { name: /diagram\.png/i }));

    expect(onChange).toHaveBeenCalledWith('!diagram.png!');
  });

  it('selecting a non-image attachment inserts [^report.pdf]', () => {
    const onChange = vi.fn();
    render(<Harness value="" onChange={onChange} attachments={[PDF_ATT]} />);

    fireEvent.click(screen.getByTitle('Insert attachment'));
    fireEvent.click(screen.getByRole('button', { name: 'report.pdf' }));

    expect(onChange).toHaveBeenCalledWith('[^report.pdf]');
  });

  it('pasting a file fires onFileSelected with that File and performs no upload itself', () => {
    const onFileSelected = vi.fn();
    render(<Harness value="" onChange={vi.fn()} onFileSelected={onFileSelected} />);

    const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
    const file = new File(['data'], 'diagram.png', { type: 'image/png' });
    fireEvent.paste(textarea, { clipboardData: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('dropping a file fires onFileSelected and calls stopPropagation on the drop event', () => {
    const onFileSelected = vi.fn();
    const outerDrop = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test-only outer drop-target to prove stopPropagation
      <div onDrop={outerDrop}>
        <Harness value="" onChange={vi.fn()} onFileSelected={onFileSelected} />
      </div>,
    );

    const textarea = screen.getByPlaceholderText('Describe the issue...') as HTMLTextAreaElement;
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.drop(textarea, { dataTransfer: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
    // stopPropagation prevents the drop from bubbling to an outer drop-target ancestor
    expect(outerDrop).not.toHaveBeenCalled();
  });

  it('renders staged file chips labelled as pending and fires onRemoveStagedFile with the index', () => {
    const onRemoveStagedFile = vi.fn();
    const stagedFile = new File(['data'], 'staged.png', { type: 'image/png' });
    render(
      <Harness
        value=""
        onChange={vi.fn()}
        stagedFiles={[stagedFile]}
        onRemoveStagedFile={onRemoveStagedFile}
      />,
    );

    expect(screen.getByText('staged.png')).toBeInTheDocument();
    expect(screen.getByText('will upload on save')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove staged.png'));
    expect(onRemoveStagedFile).toHaveBeenCalledWith(0);
  });

  it('Preview tab renders !name.png! as an img when a matching attachments entry is supplied', async () => {
    render(<Harness value="!diagram.png!" onChange={vi.fn()} attachments={[IMAGE_ATT]} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    await waitFor(() => {
      const img = document.querySelector('img[src*="diagram.png"]');
      expect(img).not.toBeNull();
    });
  });

  it('exposes insertRef via the imperative handle', () => {
    const onChange = vi.fn();
    const ref = createRef<DescriptionEditorHandle>();
    render(<DescriptionEditor ref={ref} value="" onChange={onChange} />);

    ref.current?.insertRef('[^manual.pdf]');
    expect(onChange).toHaveBeenCalledWith('[^manual.pdf]');
  });
});
