import { describe, expect, it } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { attachmentRef, isImageAttachment } from './attachment-markup';

function makeAttachment(overrides: Partial<JiraAttachment> = {}): JiraAttachment {
  return {
    id: '1',
    filename: 'diagram.png',
    content: 'https://jira.example.com/secure/attachment/1/diagram.png',
    mimeType: 'image/png',
    ...overrides,
  };
}

describe('isImageAttachment', () => {
  it('returns true for an image mimeType', () => {
    expect(isImageAttachment({ mimeType: 'image/png' })).toBe(true);
  });

  it('returns false for a non-image mimeType', () => {
    expect(isImageAttachment({ mimeType: 'application/pdf' })).toBe(false);
  });

  it('returns false for an undefined mimeType', () => {
    expect(isImageAttachment({ mimeType: undefined as unknown as string })).toBe(false);
  });
});

describe('attachmentRef', () => {
  it('renders an image attachment as !filename!', () => {
    const att = makeAttachment({ filename: 'diagram.png', mimeType: 'image/png' });
    expect(attachmentRef(att)).toBe('!diagram.png!');
  });

  it('renders a non-image attachment as [^filename]', () => {
    const att = makeAttachment({ filename: 'report.pdf', mimeType: 'application/pdf' });
    expect(attachmentRef(att)).toBe('[^report.pdf]');
  });

  it('treats a missing mimeType as non-image', () => {
    const att = makeAttachment({
      filename: 'mystery.bin',
      mimeType: undefined as unknown as string,
    });
    expect(attachmentRef(att)).toBe('[^mystery.bin]');
  });

  it('falls back to the resolved-URL form for a hazardous image filename (!)', () => {
    const att = makeAttachment({
      filename: 'weird!name.png',
      mimeType: 'image/png',
      content: 'https://jira.example.com/secure/attachment/2/weird%21name.png',
    });
    expect(attachmentRef(att)).toBe('!https://jira.example.com/secure/attachment/2/weird%21name.png!');
  });

  it('falls back to the resolved-URL form for a hazardous non-image filename (|)', () => {
    const att = makeAttachment({
      filename: 'weird|name.pdf',
      mimeType: 'application/pdf',
      content: 'https://jira.example.com/secure/attachment/3/weird%7Cname.pdf',
    });
    expect(attachmentRef(att)).toBe(
      '[weirdname.pdf|https://jira.example.com/secure/attachment/3/weird%7Cname.pdf]',
    );
  });

  it('falls back to the resolved-URL form for a hazardous filename (])', () => {
    const att = makeAttachment({
      filename: 'weird]name.txt',
      mimeType: 'text/plain',
      content: 'https://jira.example.com/secure/attachment/4/weird%5Dname.txt',
    });
    expect(attachmentRef(att)).toBe(
      '[weirdname.txt|https://jira.example.com/secure/attachment/4/weird%5Dname.txt]',
    );
  });
});
