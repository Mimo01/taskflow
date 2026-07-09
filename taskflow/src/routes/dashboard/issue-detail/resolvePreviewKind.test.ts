import { describe, expect, it } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { resolvePreviewKind } from './resolvePreviewKind';

function makeAttachment(filename: string, mimeType: string): JiraAttachment {
  return { id: '1', filename, content: 'https://example.com/file', mimeType };
}

describe('resolvePreviewKind', () => {
  it('classifies image/png as image', () => {
    expect(resolvePreviewKind(makeAttachment('photo.png', 'image/png'))).toBe('image');
  });

  it('classifies application/pdf as pdf', () => {
    expect(resolvePreviewKind(makeAttachment('doc.pdf', 'application/pdf'))).toBe('pdf');
  });

  it('classifies video/mp4 as video', () => {
    expect(resolvePreviewKind(makeAttachment('clip.mp4', 'video/mp4'))).toBe('video');
  });

  it('classifies .mov with generic mimeType as video', () => {
    expect(resolvePreviewKind(makeAttachment('clip.mov', 'application/octet-stream'))).toBe(
      'video',
    );
  });

  it('classifies audio/mpeg as audio', () => {
    expect(resolvePreviewKind(makeAttachment('song.mp3', 'audio/mpeg'))).toBe('audio');
  });

  it('classifies .wav with generic mimeType as audio', () => {
    expect(resolvePreviewKind(makeAttachment('note.wav', 'application/octet-stream'))).toBe(
      'audio',
    );
  });

  it('classifies text/plain as text', () => {
    expect(resolvePreviewKind(makeAttachment('notes.txt', 'text/plain'))).toBe('text');
  });

  it('classifies .md with generic mimeType as text', () => {
    expect(resolvePreviewKind(makeAttachment('readme.md', 'application/octet-stream'))).toBe(
      'text',
    );
  });

  it('classifies .log with generic mimeType as text', () => {
    expect(resolvePreviewKind(makeAttachment('server.log', 'application/octet-stream'))).toBe(
      'text',
    );
  });

  it('classifies .csv with generic mimeType as text', () => {
    expect(resolvePreviewKind(makeAttachment('data.csv', 'application/octet-stream'))).toBe('text');
  });

  it('classifies .ts with generic mimeType as code', () => {
    expect(resolvePreviewKind(makeAttachment('app.ts', 'application/octet-stream'))).toBe('code');
  });

  it('classifies .json with generic mimeType as code', () => {
    expect(resolvePreviewKind(makeAttachment('config.json', 'application/octet-stream'))).toBe(
      'code',
    );
  });

  it('classifies .js with generic mimeType as code', () => {
    expect(resolvePreviewKind(makeAttachment('index.js', 'application/octet-stream'))).toBe('code');
  });

  it('classifies .py with generic mimeType as code', () => {
    expect(resolvePreviewKind(makeAttachment('script.py', 'application/octet-stream'))).toBe(
      'code',
    );
  });

  it('classifies .zip with application/zip as other', () => {
    expect(resolvePreviewKind(makeAttachment('bundle.zip', 'application/zip'))).toBe('other');
  });

  it('classifies .docx as other', () => {
    expect(
      resolvePreviewKind(
        makeAttachment(
          'doc.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ),
    ).toBe('other');
  });

  it('prefers mimeType over extension for unambiguous types', () => {
    // .txt extension but mimeType says image — mimeType wins
    expect(resolvePreviewKind(makeAttachment('weird.txt', 'image/png'))).toBe('image');
  });

  it('applies extension fallback only when mimeType is generic', () => {
    expect(resolvePreviewKind(makeAttachment('app.ts', ''))).toBe('code');
  });
});
