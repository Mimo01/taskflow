import { File, FileText } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { getFileIcon } from './attachment-format';

describe('getFileIcon', () => {
  it.each([
    ['application/xml', FileText],
    ['application/json', FileText],
    ['text/plain', FileText],
    ['application/pdf', FileText],
    ['application/zip', File],
  ])('%s', (mime, icon) => {
    expect(getFileIcon(mime)).toBe(icon);
  });
});
