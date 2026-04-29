import { describe, it, expect } from 'vitest';
import { mimeFromExtension, resolveMime } from './mime-from-extension';

describe('mimeFromExtension', () => {
  it.each([
    ['notes.md', 'text/markdown'],
    ['NOTES.MD', 'text/markdown'],
    ['report.pdf', 'application/pdf'],
    ['photo.PNG', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['photo.webp', 'image/webp'],
    [
      'memo.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['log.txt', 'text/plain'],
  ])('maps %s -> %s', (name, mime) => {
    expect(mimeFromExtension(name)).toBe(mime);
  });

  it('returns null for unsupported extensions', () => {
    expect(mimeFromExtension('archive.zip')).toBeNull();
    expect(mimeFromExtension('binary.exe')).toBeNull();
    expect(mimeFromExtension('noextension')).toBeNull();
  });

  it('handles double extensions by using the final segment', () => {
    expect(mimeFromExtension('notes.tar.md')).toBe('text/markdown');
  });
});

describe('resolveMime', () => {
  function fakeFile(name: string, type: string): File {
    return { name, type } as unknown as File;
  }

  it('prefers the browser-reported mime when it is a recognized allowed mime', () => {
    expect(resolveMime(fakeFile('notes.md', 'text/markdown'))).toBe(
      'text/markdown',
    );
    expect(resolveMime(fakeFile('photo.png', 'image/png'))).toBe('image/png');
  });

  it('falls back to extension when file.type is empty', () => {
    expect(resolveMime(fakeFile('notes.md', ''))).toBe('text/markdown');
    expect(resolveMime(fakeFile('report.pdf', ''))).toBe('application/pdf');
  });

  it('falls back to extension when file.type is application/octet-stream', () => {
    expect(
      resolveMime(fakeFile('notes.md', 'application/octet-stream')),
    ).toBe('text/markdown');
  });

  it('returns null when neither file.type nor extension resolves to an allowed mime', () => {
    expect(resolveMime(fakeFile('archive.zip', ''))).toBeNull();
    expect(resolveMime(fakeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});
