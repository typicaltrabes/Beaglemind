import { describe, it, expect } from 'vitest';
import { buildAttachmentBlock, mimeLabel } from './attachment-block';

describe('mimeLabel', () => {
  it.each([
    ['application/pdf', 'PDF'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'DOCX',
    ],
    ['image/png', 'PNG'],
    ['image/jpeg', 'JPEG'],
    ['image/webp', 'WEBP'],
    ['text/plain', 'TXT'],
    ['text/markdown', 'MD'],
  ])('maps %s to %s', (mime, label) => {
    expect(mimeLabel(mime)).toBe(label);
  });

  it('falls back to the raw mime type for unknown values', () => {
    expect(mimeLabel('application/xyz')).toBe('application/xyz');
  });
});

describe('buildAttachmentBlock', () => {
  it('returns empty string for empty input', () => {
    expect(buildAttachmentBlock([])).toBe('');
  });

  it('builds the canonical block with extracted text', () => {
    const block = buildAttachmentBlock([
      {
        filename: 'spec.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 142_000,
        extractedText: 'project plan v1',
        description: null,
      },
    ]);
    expect(block).toContain('--- USER ATTACHMENTS ---');
    expect(block).toContain('[1] spec.pdf (PDF, 138.7 KB)');
    expect(block).toContain('project plan v1');
    expect(block).toContain('--- END ATTACHMENTS ---');
    expect(block.endsWith('\n\n')).toBe(true);
  });

  it('emits unavailable-description placeholder when image description is null', () => {
    const block = buildAttachmentBlock([
      {
        filename: 'screenshot.png',
        mimeType: 'image/png',
        sizeBytes: 38_000,
        extractedText: null,
        description: null,
      },
    ]);
    expect(block).toContain('(image attached — description unavailable)');
    expect(block).not.toContain('(image — included with this message)');
  });

  it('emits no-text placeholder when extractedText is null and mime is non-image', () => {
    const block = buildAttachmentBlock([
      {
        filename: 'broken.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        extractedText: null,
        description: null,
      },
    ]);
    expect(block).toContain('(no extracted text available)');
  });

  it('numbers attachments starting at 1 and preserves array order', () => {
    const block = buildAttachmentBlock([
      {
        filename: 'a.txt',
        mimeType: 'text/plain',
        sizeBytes: 10,
        extractedText: 'A',
        description: null,
      },
      {
        filename: 'b.txt',
        mimeType: 'text/plain',
        sizeBytes: 10,
        extractedText: 'B',
        description: null,
      },
    ]);
    expect(block.indexOf('[1] a.txt')).toBeLessThan(block.indexOf('[2] b.txt'));
  });

  it('mixes extracted-text and image-with-description attachments correctly', () => {
    const block = buildAttachmentBlock([
      {
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5000,
        extractedText: 'doc body',
        description: null,
      },
      {
        filename: 'pic.png',
        mimeType: 'image/png',
        sizeBytes: 5000,
        extractedText: null,
        description: 'a screenshot of a dashboard',
      },
    ]);
    // Both numbered correctly
    expect(block).toContain('[1] doc.pdf (PDF,');
    expect(block).toContain('[2] pic.png (PNG,');
    // Each gets its appropriate body
    expect(block).toContain('doc body');
    expect(block).toContain('Description: a screenshot of a dashboard');
    // Defensive: V1 placeholder must be gone
    expect(block).not.toContain('(image — included with this message)');
    // Ends with sentinel + double newline
    expect(block.endsWith('--- END ATTACHMENTS ---\n\n')).toBe(true);
  });

  it('emits Description line when image has a non-null description', () => {
    const block = buildAttachmentBlock([
      {
        filename: 'screenshot.png',
        mimeType: 'image/png',
        sizeBytes: 38_000,
        extractedText: null,
        description: 'A dashboard with four KPI cards',
      },
    ]);
    expect(block).toContain('Description: A dashboard with four KPI cards');
    expect(block).not.toContain('(image — included with this message)');
  });

  it('image description takes precedence over extractedText (defensive)', () => {
    // In normal flow extractedText is always null for image mimes, but the
    // image branch must check description FIRST regardless of extractedText.
    const block = buildAttachmentBlock([
      {
        filename: 'pic.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        extractedText: 'should not appear',
        description: 'real description here',
      },
    ]);
    expect(block).toContain('Description: real description here');
    expect(block).not.toContain('should not appear');
  });
});
